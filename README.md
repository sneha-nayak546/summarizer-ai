# Summarize AI · Build 500

Fully **local**, **free**, **fast-starting** AI text summarizer.
Uses `facebook/bart-large-cnn` — baked into the Docker image at build time.
No API keys. No internet needed at runtime. Zero cost per request.

## Quick start

```bash
# 1. Build (downloads model once, ~1.6 GB, takes ~5 min on first build)
docker-compose up --build

# 2. Open frontend
open frontend/index.html   # or just double-click it
# Backend API: http://localhost:5000
```

That's it. No API key. No signup. Runs completely offline after build.

---

## Why it's fast at runtime

The Dockerfile uses a **multi-stage build**:

| Stage | What happens |
|---|---|
| `builder` | Installs deps + downloads `bart-large-cnn` into `/app/model` |
| `runtime` | Copies only the model + code — clean slim image |

`TRANSFORMERS_OFFLINE=1` is set, so the container **never hits the internet** after build.
Container startup: **~3 seconds** (model loads from local disk).

---

## Features

- ✅ **6 summary styles**: Brief, Detailed, TL;DR, Short, Medium, Long
- ✅ **Document upload**: PDF, DOCX, TXT — max **5 MB**
- ✅ **Text paste**: max **50,000 characters** (~10,000 words)
- ✅ **Long document chunking**: auto-splits and merges for docs > 900 words
- ✅ **Copy to clipboard** button
- ✅ **Drag & drop** file upload
- ✅ **Zero API cost** — runs on CPU, no GPU needed

---

## Project structure

```
summarizer-project/
├── Dockerfile               ← multi-stage, build 500, model baked in
├── docker-compose.yml       ← no API key needed
├── backend/
│   ├── app.py               ← Flask + transformers pipeline
│   └── requirements.txt
└── frontend/
    ├── index.html
    ├── style.css
    └── script.js
```

## API

| Method | Path | Body |
|---|---|---|
| GET | `/` | — |
| GET | `/modes` | — |
| POST | `/summarize` | `{"text":"...","mode":"brief"}` or multipart file |

Modes: `brief` · `detailed` · `tldr` · `short` · `medium` · `long`
