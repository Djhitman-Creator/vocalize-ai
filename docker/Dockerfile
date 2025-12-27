# Karatrack Studio RunPod Handler v3.5
# WhisperX for precise word-level timestamps
# Reinstall torch stack LAST to ensure compatibility

FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Pin NumPy to 1.x first
RUN pip install --no-cache-dir "numpy<2"

# Install ALL Python packages first (they may pull wrong torch versions)
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
    "transformers>=4.36.0,<4.50.0" \
    faster-whisper \
    pyannote.audio \
    ctranslate2

# Install demucs and whisperx without deps
RUN pip install --no-cache-dir --no-deps demucs
RUN pip install --no-cache-dir --no-deps git+https://github.com/m-bain/whisperx.git

# CRITICAL: Reinstall compatible torch stack LAST
# This overwrites any incompatible versions pulled by other packages
RUN pip install --no-cache-dir --force-reinstall \
    torch==2.4.0 \
    torchvision==0.19.0 \
    torchaudio==2.4.0 \
    --index-url https://download.pytorch.org/whl/cu124

# Copy handler
COPY handler.py /app/handler.py

CMD ["python", "-u", "/app/handler.py"]