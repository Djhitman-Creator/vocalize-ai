# Karatrack Studio RunPod Handler v3.4
# WhisperX for precise word-level timestamps
# Explicit version pinning for all torch components

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

# Install compatible torch stack together (2.4.0 versions)
RUN pip install --no-cache-dir --force-reinstall \
    torch==2.4.0 \
    torchvision==0.19.0 \
    torchaudio==2.4.0 \
    --index-url https://download.pytorch.org/whl/cu124

# Install demucs with --no-deps to prevent torch conflicts
RUN pip install --no-cache-dir --no-deps demucs

# Install demucs dependencies manually
RUN pip install --no-cache-dir \
    einops \
    lameenc \
    openunmix \
    dora-search \
    diffq \
    julius \
    submitit \
    treetable

# Install transformers (pinned to avoid conflicts)
RUN pip install --no-cache-dir "transformers>=4.36.0,<4.50.0"

# Install WhisperX dependencies
RUN pip install --no-cache-dir \
    faster-whisper \
    pyannote.audio \
    ctranslate2

# Install WhisperX (without deps to avoid torch conflicts)
RUN pip install --no-cache-dir --no-deps git+https://github.com/m-bain/whisperx.git

# Install remaining dependencies
RUN pip install --no-cache-dir \
    runpod \
    boto3 \
    requests \
    Pillow

# Copy handler
COPY handler.py /app/handler.py

CMD ["python", "-u", "/app/handler.py"]