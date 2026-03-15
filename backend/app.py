from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import pipeline
import os, io, PyPDF2, docx

app = Flask(__name__)
CORS(app)

# ── Limits ──────────────────────────────────────────────────────────────────
MAX_CHARS      = 50_000
MAX_FILE_MB    = 5
MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024

# ── Load model ONCE at startup (already baked into Docker image) ────────────
MODEL_PATH = os.environ.get("MODEL_PATH", "/app/model")
print(f"[startup] Loading model from {MODEL_PATH} ...")
summarizer = pipeline(
    "summarization",
    model=MODEL_PATH,
    tokenizer=MODEL_PATH,
    device=-1,      # CPU — no GPU needed
    framework="pt",
)
print("[startup] Model ready ✓")

# ── Summary mode configs ─────────────────────────────────────────────────────
MODES = {
    "brief":    {"label": "Brief",    "max_length": 80,  "min_length": 30},
    "detailed": {"label": "Detailed", "max_length": 300, "min_length": 120},
    "tldr":     {"label": "TL;DR",    "max_length": 45,  "min_length": 20},
    "short":    {"label": "Short",    "max_length": 60,  "min_length": 25},
    "medium":   {"label": "Medium",   "max_length": 150, "min_length": 60},
    "long":     {"label": "Long",     "max_length": 400, "min_length": 150},
}

# ── Helpers ──────────────────────────────────────────────────────────────────
def extract_text(file_storage) -> str:
    raw = file_storage.read()
    if len(raw) > MAX_FILE_BYTES:
        raise ValueError(f"File too large. Max allowed: {MAX_FILE_MB} MB.")
    name = file_storage.filename.lower()
    if name.endswith(".pdf"):
        reader = PyPDF2.PdfReader(io.BytesIO(raw))
        return "\n".join(p.extract_text() or "" for p in reader.pages).strip()
    elif name.endswith(".docx"):
        doc = docx.Document(io.BytesIO(raw))
        return "\n".join(p.text for p in doc.paragraphs).strip()
    elif name.endswith(".txt"):
        return raw.decode("utf-8", errors="replace").strip()
    else:
        raise ValueError("Unsupported format. Use .pdf, .docx, or .txt")


def chunk_text(text: str, max_words: int = 900) -> list:
    words = text.split()
    chunks, cur = [], []
    for w in words:
        cur.append(w)
        if len(cur) >= max_words:
            chunks.append(" ".join(cur))
            cur = []
    if cur:
        chunks.append(" ".join(cur))
    return chunks


def run_summarizer(text: str, mode_key: str) -> str:
    if len(text) > MAX_CHARS:
        raise ValueError(
            f"Text too long ({len(text):,} chars). Max is {MAX_CHARS:,} (~10 000 words)."
        )
    mode   = MODES.get(mode_key, MODES["brief"])
    chunks = chunk_text(text)

    summaries = []
    for chunk in chunks:
        out = summarizer(
            chunk,
            max_length=mode["max_length"],
            min_length=mode["min_length"],
            do_sample=False,
            num_beams=4,
            no_repeat_ngram_size=3,
            length_penalty=1.5,
            early_stopping=True,
        )
        summaries.append(out[0]["summary_text"])

    if len(summaries) == 1:
        return summaries[0]

    merged = " ".join(summaries)
    if len(merged.split()) > mode["max_length"]:
        final = summarizer(
            merged,
            max_length=mode["max_length"],
            min_length=mode["min_length"],
            do_sample=False,
            num_beams=4,
            no_repeat_ngram_size=3,
            early_stopping=True,
        )
        return final[0]["summary_text"]
    return merged


# ── Routes ───────────────────────────────────────────────────────────────────
@app.route("/")
def home():
    return jsonify({"status": "Text Summarizer API", "build": 500, "model": "bart-large-cnn"})

@app.route("/modes")
def get_modes():
    return jsonify([{"key": k, "label": v["label"]} for k, v in MODES.items()])

@app.route("/summarize", methods=["POST"])
def summarize():
    try:
        mode_key = (
            request.form.get("mode")
            or (request.get_json(silent=True) or {}).get("mode", "brief")
        )
        if "file" in request.files:
            f = request.files["file"]
            if not f.filename:
                return jsonify({"error": "No file selected."}), 400
            text = extract_text(f)
            if not text:
                return jsonify({"error": "Could not extract text from file."}), 400
        else:
            body = request.get_json(silent=True) or {}
            text = (body.get("text") or "").strip()
            if not text:
                return jsonify({"error": "No text provided."}), 400

        summary = run_summarizer(text, mode_key)
        return jsonify({"summary": summary, "mode": mode_key, "input_chars": len(text)})

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Model error: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
