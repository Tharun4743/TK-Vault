import math
import torch
import torch.nn as nn
import torch.nn.functional as F

class CausalSelfAttention(nn.Module):
    """
    Multi-Head Causal Self-Attention with strictly causal triangular mask.
    Prevents token positions from attending to subsequent tokens during next-token prediction.
    """
    def __init__(self, d_model: int, n_heads: int, max_seq_len: int, dropout: float = 0.1):
        super().__init__()
        assert d_model % n_heads == 0, "d_model must be divisible by n_heads"
        self.d_model = d_model
        self.n_heads = n_heads
        self.head_dim = d_model // n_heads

        self.q_proj = nn.Linear(d_model, d_model, bias=False)
        self.k_proj = nn.Linear(d_model, d_model, bias=False)
        self.v_proj = nn.Linear(d_model, d_model, bias=False)
        self.out_proj = nn.Linear(d_model, d_model, bias=False)

        self.drop = nn.Dropout(dropout)

        # Register lower-triangular causal mask buffer
        mask = torch.tril(torch.ones(max_seq_len, max_seq_len)).unsqueeze(0).unsqueeze(0)
        self.register_buffer("causal_mask", mask)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        B, T, C = x.size()
        q = self.q_proj(x).view(B, T, self.n_heads, self.head_dim).transpose(1, 2)
        k = self.k_proj(x).view(B, T, self.n_heads, self.head_dim).transpose(1, 2)
        v = self.v_proj(x).view(B, T, self.n_heads, self.head_dim).transpose(1, 2)

        # Scaled Dot-Product Attention
        att = (q @ k.transpose(-2, -1)) * (1.0 / math.sqrt(self.head_dim))
        att = att.masked_fill(self.causal_mask[:, :, :T, :T] == 0, float('-inf'))
        att = F.softmax(att, dim=-1)
        att = self.drop(att)

        y = att @ v
        y = y.transpose(1, 2).contiguous().view(B, T, C)
        return self.out_proj(y)

class FeedForward(nn.Module):
    """Two-layer MLP with GELU activation and dropout."""
    def __init__(self, d_model: int, d_ff: int, dropout: float = 0.1):
        super().__init__()
        self.fc1 = nn.Linear(d_model, d_ff)
        self.fc2 = nn.Linear(d_ff, d_model)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.dropout(self.fc2(F.gelu(self.fc1(x))))

class TransformerBlock(nn.Module):
    """Pre-LN Transformer Block with residual skip connections."""
    def __init__(self, d_model: int, n_heads: int, d_ff: int, max_seq_len: int, dropout: float = 0.1):
        super().__init__()
        self.ln1 = nn.LayerNorm(d_model)
        self.attn = CausalSelfAttention(d_model, n_heads, max_seq_len, dropout)
        self.ln2 = nn.LayerNorm(d_model)
        self.ffn = FeedForward(d_model, d_ff, dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = x + self.attn(self.ln1(x))
        x = x + self.ffn(self.ln2(x))
        return x

class ScratchDecoderTransformer(nn.Module):
    """
    Decoder-Only Transformer Language Model built strictly from scratch.
    ZERO pretrained weights. All parameters initialized via random Xavier/Normal distributions.
    Optimized for NVIDIA GeForce RTX 4050 (6GB VRAM) and CPU fallback.
    """
    def __init__(
        self,
        vocab_size: int = 4096,
        max_seq_len: int = 256,
        d_model: int = 256,
        n_heads: int = 4,
        n_layers: int = 4,
        d_ff: int = 512,
        dropout: float = 0.1
    ):
        super().__init__()
        self.vocab_size = vocab_size
        self.max_seq_len = max_seq_len
        self.d_model = d_model

        # Token + Learnable Positional Embeddings
        self.tok_emb = nn.Embedding(vocab_size, d_model, padding_idx=0)
        self.pos_emb = nn.Embedding(max_seq_len, d_model)
        self.drop = nn.Dropout(dropout)

        # Transformer Blocks Stack
        self.blocks = nn.ModuleList([
            TransformerBlock(d_model, n_heads, d_ff, max_seq_len, dropout)
            for _ in range(n_layers)
        ])

        self.ln_final = nn.LayerNorm(d_model)
        # Output language model head
        self.lm_head = nn.Linear(d_model, vocab_size, bias=False)

        # 100% Random Weight Initialization
        self.apply(self._init_weights)

    def _init_weights(self, module):
        if isinstance(module, nn.Linear):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)
            if module.bias is not None:
                nn.init.zeros_(module.bias)
        elif isinstance(module, nn.Embedding):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)
        elif isinstance(module, nn.LayerNorm):
            nn.init.ones_(module.weight)
            nn.init.zeros_(module.bias)

    def forward(self, input_ids: torch.Tensor, targets: torch.Tensor = None):
        B, T = input_ids.size()
        assert T <= self.max_seq_len, f"Sequence length {T} exceeds max context {self.max_seq_len}"

        positions = torch.arange(0, T, dtype=torch.long, device=input_ids.device).unsqueeze(0)
        tok_out = self.tok_emb(input_ids)
        pos_out = self.pos_emb(positions)
        x = self.drop(tok_out + pos_out)

        for block in self.blocks:
            x = block(x)

        x = self.ln_final(x)
        logits = self.lm_head(x)

        loss = None
        if targets is not None:
            # Flatten cross-entropy loss over all tokens
            loss = F.cross_entropy(logits.view(-1, self.vocab_size), targets.view(-1), ignore_index=0)

        return logits, loss

    @torch.no_grad()
    def generate(self, input_ids: torch.Tensor, max_new_tokens: int = 128, temperature: float = 0.2, top_p: float = 0.9):
        """Autoregressive text generation loop."""
        self.eval()
        for _ in range(max_new_tokens):
            idx_cond = input_ids if input_ids.size(1) <= self.max_seq_len else input_ids[:, -self.max_seq_len:]
            logits, _ = self(idx_cond)
            logits = logits[:, -1, :] / max(1e-5, temperature)

            # Top-p (nucleus) filtering
            if top_p < 1.0:
                sorted_logits, sorted_indices = torch.sort(logits, descending=True)
                cumulative_probs = torch.cumsum(F.softmax(sorted_logits, dim=-1), dim=-1)
                sorted_indices_to_remove = cumulative_probs > top_p
                sorted_indices_to_remove[..., 1:] = sorted_indices_to_remove[..., :-1].clone()
                sorted_indices_to_remove[..., 0] = 0
                indices_to_remove = sorted_indices[sorted_indices_to_remove]
                logits[0, indices_to_remove] = float('-inf')

            probs = F.softmax(logits, dim=-1)
            idx_next = torch.multinomial(probs, num_samples=1)
            input_ids = torch.cat((input_ids, idx_next), dim=1)
            # Break if EOS token (3)
            if idx_next.item() == 3:
                break
        return input_ids
