# Karatrack Studio RunPod Handler v3.2
# WhisperX for precise word-level timestamps
# PyTorch 2.4 - after API changes, before weights_only breaking change

FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Pin NumPy to 1.x to avoid compatibility issues
RUN pip install --no-cache-dir "numpy<2"

# Install other dependencies
RUN pip install --no-cache-dir \
    runpod \
    boto3 \
    requests \
    Pillow \
    demucs

# Install WhisperX
RUN pip install --no-cache-dir git+https://github.com/m-bain/whisperx.git

# Copy handler
COPY handler.py /app/handler.py

CMD ["python", "-u", "/app/handler.py"]