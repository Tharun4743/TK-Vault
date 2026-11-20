import os
import sys
import threading
import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional

# Ensure local imports work
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from tokenizer.bpe_tokenizer import CustomBPETokenizer
from model.transformer import ScratchDecoderTransformer
from trainer import ScratchTrainer

app = FastAPI(title="TK-Vault Zero-Pretrained AI Service", version="1.0.0")

# Global instances
device = "cuda" if torch.cuda.is_available() else "cpu"
tokenizer = CustomBPETokenizer(vocab_size=2048)
model = ScratchDecoderTransformer(
    vocab_size=2048,
    max_seq_len=256,
    d_model=256,
    n_heads=4,
    n_layers=4,
    d_ff=512,
    dropout=0.1
)
trainer = ScratchTrainer(model, tokenizer, device=device)

# Auto-load existing tokenizer and model checkpoint if present
tokenizer_path = "ai_service/tokenizer/tokenizer.json"
checkpoint_path = "ai_service/checkpoints/best_model.pt"

if os.path.exists(tokenizer_path):
    try:
        tokenizer.load(tokenizer_path)
    except Exception as e:
        print(f"[AI Service] Tokenizer load notice: {e}")

if os.path.exists(checkpoint_path):
    try:
        ckpt = torch.load(checkpoint_path, map_location=device)
        model.load_state_dict(ckpt["model_state_dict"])
        model.eval()
        print(f"[AI Service] Loaded trained model checkpoint from {checkpoint_path}")
    except Exception as e:
        print(f"[AI Service] Checkpoint load notice: {e}")

class GenerateRequest(BaseModel):
    question: str
    context: Optional[str] = ""
    system_prompt: Optional[str] = ""
    max_tokens: Optional[int] = 128
    temperature: Optional[float] = 0.2

class TrainRequest(BaseModel):
    epochs: Optional[int] = 5
    batch_size: Optional[int] = 16

@app.get("/health")
def health_check():
    gpu_name = torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU"
    vram_mb = torch.cuda.memory_allocated(0) / (1024 * 1024) if torch.cuda.is_available() else 0
    return {
        "status": "healthy",
        "device": device,
        "hardware": gpu_name,
        "vram_allocated_mb": round(vram_mb, 2),
        "pretrained_models": 0,
        "mode": "100%_Offline_Zero_Pretrained"
    }

@app.get("/status")
def get_status():
    return {
        "training": trainer.training_status,
        "tokenizer_ready": len(tokenizer.vocab) > 0,
        "vocab_size": len(tokenizer.vocab),
        "model_parameters": sum(p.numel() for p in model.parameters()),
        "checkpoint_exists": os.path.exists(checkpoint_path)
    }

@app.post("/train")
def start_training(req: TrainRequest):
    if trainer.training_status["is_training"]:
        raise HTTPException(status_code=400, detail="Training is already in progress.")

    trainer.should_stop = False
    trainer.training_status["loss_history"] = []

    # Collect training texts from storage/documents or sample corpus
    training_texts = []
    sample_corpus = "ml/data/train_large.json"
    if os.path.exists(sample_corpus):
        import json
        with open(sample_corpus, "r", encoding="utf-8") as f:
            items = json.load(f)
            for it in items:
                training_texts.append(it["query"] + " " + it["pos"])

    if not training_texts:
        training_texts = [
            "Operating systems manage hardware memory, CPU scheduling, and process execution.",
            "Relational databases enforce referential integrity using primary and foreign keys.",
            "Computer networks utilize TCP IP protocol suites to route data packets reliably.",
            "TK-Vault is an offline retrieval augmented generation assistant built with zero pretrained models."
        ] * 20

    # Ensure tokenizer is trained
    if len(tokenizer.vocab) == 0:
        tokenizer.train_from_texts(training_texts)
        tokenizer.save(tokenizer_path)

    def run_async_train():
        trainer.train(training_texts, epochs=req.epochs, batch_size=req.batch_size)

    thread = threading.Thread(target=run_async_train)
    thread.start()

    return {"status": "started", "epochs": req.epochs, "samples": len(training_texts)}

@app.post("/stop")
def stop_training():
    if trainer.training_status["is_training"]:
        trainer.stop()
        return {"status": "stopping", "message": "Training cancellation requested."}
    return {"status": "idle", "message": "No active training process."}

@app.post("/generate")
def generate_answer(req: GenerateRequest):
    if not req.question:
        raise HTTPException(status_code=400, detail="Question is required.")

    # Strict Grounded RAG check: If no relevant context is supplied
    if not req.context or req.context.strip() == "":
        return {
            "answer": "I couldn't find sufficient information in the uploaded documents to answer this question accurately.",
            "grounded": False
        }

    # Format evidence-grounded prompt
    full_prompt = f"Context: {req.context.strip()}\nQuestion: {req.question.strip()}\nAnswer:"

    # If tokenizer is trained and model checkpoint exists, run autoregressive generation
    if len(tokenizer.vocab) > 0 and os.path.exists(checkpoint_path):
        try:
            tokens = tokenizer.encode(full_prompt, add_special_tokens=True)
            input_tensor = torch.tensor([tokens], dtype=torch.long, device=device)
            output_tensor = model.generate(input_tensor, max_new_tokens=req.max_tokens, temperature=req.temperature)
            generated_ids = output_tensor[0].tolist()[len(tokens):]
            generated_text = tokenizer.decode(generated_ids)
            if generated_text.strip():
                return {"answer": generated_text.strip(), "grounded": True}
        except Exception as e:
            print(f"[AI Service] Generation notice: {e}")

    # Deterministic Grounded Extractive Fallback: Synthesize directly from retrieved context
    lines = [b.strip() for b in req.context.split("\n\n") if b.strip()]
    response = "Based on the retrieved document evidence:\n\n"
    for idx, b in enumerate(lines[:3]):
        response += f"- {b}\n\n"

    return {
        "answer": response.strip(),
        "grounded": True
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=5000, log_level="info")
