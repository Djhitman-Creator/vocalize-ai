# Karatrack Studio RunPod Handler v3.1
# WhisperX for precise word-level timestamps
# Using PyTorch 2.1 for compatibility (avoids weights_only issue in 2.6+)

FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies (these may pull in newer PyTorch)
RUN pip install --no-cache-dir \
    runpod \
    boto3 \
    requests \
    numpy \
    Pillow \
    demucs

# Install WhisperX
RUN pip install --no-cache-dir git+https://github.com/m-bain/whisperx.git

# CRITICAL: Force PyTorch back to 2.1.x AFTER all other installs
# This fixes the weights_only=True breaking change in PyTorch 2.6+
RUN pip install --no-cache-dir --force-reinstall \
    torch==2.1.0 \
    torchaudio==2.1.0 \
    --index-url https://download.pytorch.org/whl/cu118

# Copy handler
COPY handler.py /app/handler.py

CMD ["python", "-u", "/app/handler.py"]