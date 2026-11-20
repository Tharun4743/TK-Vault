#!/usr/bin/env python3
import sys
import json
import os
import threading

# Force 100% strict offline mode
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["HF_DATASETS_OFFLINE"] = "1"

_model = None
_tokenizer = None
_lock = threading.Lock()

def load_generator():
    global _model, _tokenizer
    with _lock:
        if _model is not None and _tokenizer is not None:
            return _model, _tokenizer

        import torch
        from transformers import AutoTokenizer, AutoModelForCausalLM

        script_dir = os.path.dirname(os.path.abspath(__file__))
        backend_dir = os.path.dirname(script_dir)
        model_path = os.path.join(backend_dir, "models", "generator")

        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Local generator model not found at {model_path}. Run ml/download_local_generator.py first.")

        device = "cuda" if torch.cuda.is_available() else "cpu"
        dtype = torch.float16 if device == "cuda" else torch.float32

        _tokenizer = AutoTokenizer.from_pretrained(model_path)
        _model = AutoModelForCausalLM.from_pretrained(
            model_path,
            torch_dtype=dtype,
            low_cpu_mem_usage=True
        ).to(device)
        _model.eval()

        return _model, _tokenizer

def stream_response(prompt_text, system_prompt=None):
    import torch
    from transformers import TextIteratorStreamer

    model, tokenizer = load_generator()
    device = "cuda" if torch.cuda.is_available() else "cpu"

    if system_prompt is None or not system_prompt.strip():
        system_prompt = "You are Aura - AI unified retrieval assistant. Answer clearly and strictly using the provided context."

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": prompt_text}
    ]

    try:
        text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    except Exception:
        text = f"System: {system_prompt}\nUser: {prompt_text}\nAssistant:"

    model_inputs = tokenizer([text], return_tensors="pt").to(device)
    streamer = TextIteratorStreamer(tokenizer, skip_prompt=True, skip_special_tokens=True)

    generation_kwargs = dict(
        model_inputs,
        streamer=streamer,
        max_new_tokens=512,
        temperature=0.2,
        do_sample=True,
        top_p=0.9
    )

    thread = threading.Thread(target=model.generate, kwargs=generation_kwargs)
    thread.start()

    for new_text in streamer:
        if new_text:
            print(json.dumps({"response": new_text}), flush=True)

    thread.join()
    print(json.dumps({"done": True}), flush=True)

if __name__ == "__main__":
    prompt = None
    system_prompt = None

    # Check command-line arguments or standard input
    if len(sys.argv) > 1 and sys.argv[1] != "-":
        prompt = sys.argv[1]
        if len(sys.argv) > 2:
            system_prompt = sys.argv[2]
    else:
        # Read from stdin
        try:
            content = sys.stdin.read().strip()
            if content:
                # If JSON object was passed
                if content.startswith("{") and content.endswith("}"):
                    data = json.loads(content)
                    prompt = data.get("prompt", "")
                    system_prompt = data.get("system", "")
                else:
                    prompt = content
        except Exception:
            pass

    if not prompt:
        print(json.dumps({"error": "No prompt provided"}), flush=True)
        sys.exit(1)

    try:
        stream_response(prompt, system_prompt)
    except Exception as e:
        print(json.dumps({"response": f"[Local AI Generator Error: {str(e)}]", "done": True}), flush=True)
        sys.exit(1)
