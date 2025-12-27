# Karatrack Studio RunPod Handler v3.8
# WhisperX for precise word-level timestamps

FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Install ALL Python packages first
RUN pip install --no-cache-dir \
    runpod \
    boto3 \
    requests \
    Pillow \
    einops \
    lameenc \
    openunmix \
    dora-search \
    diffq \
    julius \
    submitit \
    treetable \
    matplotlib \
    "transformers>=4.36.0,<4.50.0" \
    faster-whisper \
    ctranslate2

# Pin pyannote.audio to older version
RUN pip install --no-cache-dir "pyannote.audio==3.1.1"

# Install demucs and whisperx without deps
RUN pip install --no-cache-dir --no-deps demucs
RUN pip install --no-cache-dir --no-deps git+https://github.com/m-bain/whisperx.git

# Reinstall compatible torch stack
RUN pip install --no-cache-dir --force-reinstall \
    torch==2.4.0 \
    torchvision==0.19.0 \
    torchaudio==2.4.0 \
    --index-url https://download.pytorch.org/whl/cu124

# Force NumPy 1.x LAST
RUN pip install --no-cache-dir --force-reinstall "numpy==1.26.4"

# Copy handler
COPY handler.py /app/handler.py

CMD ["python", "-u", "/app/handler.py"]