import os
import time
import torch
from torch.utils.data import Dataset, DataLoader
from tokenizer.bpe_tokenizer import CustomBPETokenizer
from model.transformer import ScratchDecoderTransformer

class NextTokenDataset(Dataset):
    def __init__(self, token_ids_list, seq_len=128):
        self.samples = []
        for seq in token_ids_list:
            if len(seq) > seq_len:
                for i in range(0, len(seq) - seq_len, seq_len // 2):
                    self.samples.append(seq[i:i + seq_len + 1])
            else:
                padded = seq + [0] * (seq_len + 1 - len(seq))
                self.samples.append(padded)

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        chunk = self.samples[idx]
        x = torch.tensor(chunk[:-1], dtype=torch.long)
        y = torch.tensor(chunk[1:], dtype=torch.long)
        return x, y

class ScratchTrainer:
    def __init__(
        self,
        model: ScratchDecoderTransformer,
        tokenizer: CustomBPETokenizer,
        lr: float = 3e-4,
        device: str = "cuda" if torch.cuda.is_available() else "cpu",
        checkpoint_dir: str = "ai_service/checkpoints"
    ):
        self.model = model.to(device)
        self.tokenizer = tokenizer
        self.device = device
        self.checkpoint_dir = checkpoint_dir
        os.makedirs(checkpoint_dir, exist_ok=True)

        self.optimizer = torch.optim.AdamW(self.model.parameters(), lr=lr, weight_decay=0.01)
        self.scaler = torch.amp.GradScaler('cuda', enabled=(device == "cuda"))
        self.should_stop = False
        self.training_status = {
            "is_training": False,
            "epoch": 0,
            "total_epochs": 0,
            "train_loss": 0.0,
            "val_loss": 0.0,
            "best_loss": 0.0,
            "loss_history": [],
            "device": device
        }

    def stop(self):
        self.should_stop = True

    def train(self, raw_texts, epochs=5, batch_size=16, seq_len=128):
        self.training_status["is_training"] = True
        self.training_status["total_epochs"] = epochs
        print(f"[Trainer] Training on device: {self.device}")

        # 1. Encode all texts with local BPE tokenizer
        encoded_data = [self.tokenizer.encode(t, add_special_tokens=True) for t in raw_texts if t.strip()]
        split_idx = int(len(encoded_data) * 0.85)
        train_data = encoded_data[:split_idx]
        val_data = encoded_data[split_idx:] if split_idx < len(encoded_data) else encoded_data

        train_ds = NextTokenDataset(train_data, seq_len=seq_len)
        val_ds = NextTokenDataset(val_data, seq_len=seq_len)

        train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
        val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False)

        best_loss = float("inf")

        for epoch in range(1, epochs + 1):
            if self.should_stop:
                print(f"[Trainer] Stop signal received at epoch {epoch}. Terminating training.")
                break
            self.model.train()
            total_loss = 0.0
            start_time = time.time()

            for step, (x, y) in enumerate(train_loader):
                x = x.to(self.device)
                y = y.to(self.device)

                self.optimizer.zero_grad()
                with torch.amp.autocast('cuda', enabled=(self.device == "cuda")):
                    _, loss = self.model(x, targets=y)

                self.scaler.scale(loss).backward()
                self.scaler.unscale_(self.optimizer)
                torch.nn.utils.clip_grad_norm_(self.model.parameters(), 1.0)
                self.scaler.step(self.optimizer)
                self.scaler.update()

                total_loss += loss.item()

            avg_train_loss = total_loss / max(1, len(train_loader))

            # Validation
            self.model.eval()
            val_loss = 0.0
            with torch.no_grad():
                for x, y in val_loader:
                    x = x.to(self.device)
                    y = y.to(self.device)
                    with torch.amp.autocast('cuda', enabled=(self.device == "cuda")):
                        _, loss = self.model(x, targets=y)
                    val_loss += loss.item()

            avg_val_loss = val_loss / max(1, len(val_loader))
            elapsed = time.time() - start_time

            self.training_status["epoch"] = epoch
            self.training_status["train_loss"] = avg_train_loss
            self.training_status["val_loss"] = avg_val_loss
            self.training_status["loss_history"].append({
                "epoch": epoch,
                "train_loss": round(avg_train_loss, 4),
                "val_loss": round(avg_val_loss, 4),
                "time_sec": round(elapsed, 2)
            })

            print(f"[Epoch {epoch:02d}/{epochs:02d}] Train Loss: {avg_train_loss:.4f} | Val Loss: {avg_val_loss:.4f} | Time: {elapsed:.2f}s")

            # Checkpoint save
            if avg_val_loss < best_loss:
                best_loss = avg_val_loss
                self.training_status["best_loss"] = best_loss
                save_path = os.path.join(self.checkpoint_dir, "best_model.pt")
                torch.save({
                    "epoch": epoch,
                    "model_state_dict": self.model.state_dict(),
                    "optimizer_state_dict": self.optimizer.state_dict(),
                    "val_loss": best_loss,
                    "config": {
                        "vocab_size": self.model.vocab_size,
                        "d_model": self.model.d_model,
                        "max_seq_len": self.model.max_seq_len
                    }
                }, save_path)
                print(f"  -> Checkpoint saved: {save_path} (Val Loss: {best_loss:.4f})")

        self.training_status["is_training"] = False
        print("[Trainer] Training completed successfully!")
