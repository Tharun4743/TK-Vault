import json
import os
import re
from collections import defaultdict
from typing import List, Dict, Tuple

class CustomBPETokenizer:
    """
    Byte-Pair Encoding (BPE) subword tokenizer built entirely from scratch.
    Zero pretrained tokenizers. Learns subword merges directly from local training corpora.
    """
    def __init__(self, vocab_size: int = 4096):
        self.target_vocab_size = vocab_size
        self.special_tokens = ["[PAD]", "[UNK]", "[BOS]", "[EOS]"]
        self.pad_id = 0
        self.unk_id = 1
        self.bos_id = 2
        self.eos_id = 3
        
        self.vocab: Dict[str, int] = {}
        self.inv_vocab: Dict[int, str] = {}
        self.merges: List[Tuple[str, str]] = []

    def _get_stats(self, word_freqs: Dict[str, int]) -> Dict[Tuple[str, str], int]:
        pairs = defaultdict(int)
        for word, freq in word_freqs.items():
            symbols = word.split()
            for i in range(len(symbols) - 1):
                pairs[(symbols[i], symbols[i + 1])] += freq
        return pairs

    def _merge_vocab(self, pair: Tuple[str, str], word_freqs: Dict[str, int]) -> Dict[str, int]:
        out = {}
        bigram = " ".join(pair)
        replacement = "".join(pair)
        pattern = re.compile(r'(?<!\S)' + re.escape(bigram) + r'(?!\S)')
        for word, freq in word_freqs.items():
            new_word = pattern.sub(replacement, word)
            out[new_word] = freq
        return out

    def train_from_texts(self, texts: List[str]):
        # 1. Initialize base character vocabulary + special tokens
        char_set = set()
        raw_words = defaultdict(int)
        for text in texts:
            for w in text.strip().split():
                clean = "".join(c for c in w.lower() if c.isprintable())
                if clean:
                    raw_words[clean] += 1
                    char_set.update(list(clean))

        self.vocab = {tok: idx for idx, tok in enumerate(self.special_tokens)}
        for c in sorted(char_set):
            self.vocab[c] = len(self.vocab)

        # Word representation split by characters
        word_freqs = {" ".join(list(w)): freq for w, freq in raw_words.items()}

        # 2. Iterative BPE pair merge calculation
        num_merges = self.target_vocab_size - len(self.vocab)
        self.merges = []

        for i in range(max(0, num_merges)):
            pairs = self._get_stats(word_freqs)
            if not pairs:
                break
            best_pair = max(pairs, key=pairs.get)
            word_freqs = self._merge_vocab(best_pair, word_freqs)
            self.merges.append(best_pair)
            merged_token = "".join(best_pair)
            self.vocab[merged_token] = len(self.vocab)

        self.inv_vocab = {idx: tok for tok, idx in self.vocab.items()}
        print(f"[BPE Tokenizer] Trained from scratch. Final Vocabulary Size: {len(self.vocab)} tokens.")

    def encode(self, text: str, add_special_tokens: bool = True) -> List[int]:
        if not self.vocab:
            raise RuntimeError("Tokenizer is not trained yet. Call train_from_texts() first.")

        tokens = []
        if add_special_tokens:
            tokens.append(self.bos_id)

        words = text.strip().split()
        for w in words:
            clean = "".join(c for c in w.lower() if c.isprintable())
            if not clean:
                continue
            
            # Start with characters
            subwords = list(clean)
            
            # Apply learned merges
            for pair in self.merges:
                i = 0
                while i < len(subwords) - 1:
                    if subwords[i] == pair[0] and subwords[i + 1] == pair[1]:
                        subwords[i] = "".join(pair)
                        del subwords[i + 1]
                    else:
                        i += 1

            for sw in subwords:
                tokens.append(self.vocab.get(sw, self.unk_id))

        if add_special_tokens:
            tokens.append(self.eos_id)
        return tokens

    def decode(self, token_ids: List[int]) -> str:
        words = []
        for tid in token_ids:
            if tid in [self.pad_id, self.bos_id, self.eos_id]:
                continue
            token_str = self.inv_vocab.get(tid, "")
            words.append(token_str)
        return " ".join("".join(words).split())

    def save(self, filepath: str):
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        data = {
            "target_vocab_size": self.target_vocab_size,
            "vocab": self.vocab,
            "merges": self.merges
        }
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        print(f"[BPE Tokenizer] Saved configuration -> {filepath}")

    def load(self, filepath: str):
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.target_vocab_size = data["target_vocab_size"]
        self.vocab = data["vocab"]
        self.inv_vocab = {int(idx): tok for tok, idx in self.vocab.items()}
        self.merges = [tuple(m) for m in data["merges"]]
        print(f"[BPE Tokenizer] Loaded configuration from {filepath} ({len(self.vocab)} tokens).")
