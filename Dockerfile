# ===============================================================
#  AI Text Summarizer  |  Build 500
#  Optimized for fast build:
#    - torch CPU-only (~300 MB vs ~800 MB GPU)
#    - distilbart-cnn-6-6 model (~300 MB vs ~1.6 GB)
#    - multi-stage: clean runtime image
#  Expected build time: ~5-8 minutes
# ===============================================================

FROM python:3.11-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc g++ \
    && rm -rf /var/lib/apt/lists/*

# Install CPU-only torch first (much smaller than default GPU torch)
RUN pip install --no-cache-dir --prefix=/install \
    torch==2.3.0+cpu \
    --extra-index-url https://download.pytorch.org/whl/cpu

# Install remaining deps
COPY backend/requirements.txt .
RUN pip install --no-cache-dir --prefix=/install \
    flask==3.0.3 \
    flask-cors==4.0.1 \
    transformers==4.40.2 \
    sentencepiece==0.2.0 \
    PyPDF2==3.0.1 \
    python-docx==1.1.2 \
    gunicorn==22.0.0

# Download small distilbart model (~300 MB)
COPY backend/download_model.py .
RUN PYTHONPATH=/install/lib/python3.11/site-packages python download_model.py

# ── Runtime stage ────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

LABEL build="500" app="text-summarizer"

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local
COPY --from=builder /app/model ./model
COPY backend/ .
COPY frontend/ ./static/

EXPOSE 5000

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    MODEL_PATH=/app/model \
    TRANSFORMERS_OFFLINE=1 \
    HF_DATASETS_OFFLINE=1

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "120", "--preload", "app:app"]
