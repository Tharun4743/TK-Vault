#!/usr/bin/env python3
import sys
import json
import os
import numpy as np

# Force 100% offline mode
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["HF_DATASETS_OFFLINE"] = "1"

_session = None
_vocab = None

def get_vocab():
    global _vocab
    if _vocab is None:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        backend_dir = os.path.dirname(script_dir)
        vocab_path = os.path.join(backend_dir, "models", "vocab.txt")
        _vocab = {}
        if os.path.exists(vocab_path):
            with open(vocab_path, "r", encoding="utf-8") as f:
                for idx, line in enumerate(f):
                    token = line.strip()
                    if token:
                        _vocab[token] = idx
    return _vocab

def get_session():
    global _session
    if _session is None:
        import onnxruntime as ort
        script_dir = os.path.dirname(os.path.abspath(__file__))
        backend_dir = os.path.dirname(script_dir)
        model_path = os.path.join(backend_dir, "models", "aura_embedder.onnx")
        
        opts = ort.SessionOptions()
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        opts.intra_op_num_threads = 4
        _session = ort.InferenceSession(model_path, opts, providers=["CPUExecutionProvider"])
    return _session

def tokenize_custom(text, max_len=128):
    vocab = get_vocab()
    unk_id = vocab.get("[UNK]", 1)
    cls_id = vocab.get("[CLS]", 2)
    sep_id = vocab.get("[SEP]", 3)

    tokens = [cls_id]
    for word in text.lower().split():
        clean = "".join(c for c in word if c.isalnum())
        tokens.append(vocab.get(clean, unk_id))
        if len(tokens) >= max_len - 1:
            break
    tokens.append(sep_id)

    seq_len = min(len(tokens), max_len)
    tokens = tokens[:seq_len]

    input_ids = np.zeros((1, max_len), dtype=np.int64)
    attention_mask = np.zeros((1, max_len), dtype=np.int64)

    input_ids[0, :seq_len] = tokens
    attention_mask[0, :seq_len] = 1

    return input_ids, attention_mask

def embed_text(text):
    session = get_session()
    input_ids, attention_mask = tokenize_custom(text)

    # Inspect model inputs dynamically
    input_names = [inp.name for inp in session.get_inputs()]
    inputs = {
        "input_ids": input_ids,
        "attention_mask": attention_mask
    }
    if "token_type_ids" in input_names:
        inputs["token_type_ids"] = np.zeros_like(input_ids)

    outputs = session.run(None, inputs)
    vector = outputs[0][0] # First batch item

    # If output is 3D (batch, seq, dim), mean pool
    if len(vector.shape) == 2:
        mask_expanded = np.expand_dims(attention_mask[0], axis=-1)
        sum_embeddings = np.sum(vector * mask_expanded, axis=0)
        sum_mask = np.clip(np.sum(mask_expanded, axis=0), 1e-9, None)
        vector = sum_embeddings / sum_mask

    # L2 normalize
    norm = np.linalg.norm(vector)
    if norm > 0:
        vector = vector / norm

    return vector.tolist()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: embedder_sidecar.py <text_to_embed>"}))
        sys.exit(1)

    text_arg = " ".join(sys.argv[1:])
    try:
        vec = embed_text(text_arg)
        print(json.dumps(vec))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)
