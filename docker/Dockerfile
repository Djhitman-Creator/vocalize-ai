# Karatrack Studio - RunPod Serverless Dockerfile
# Version 4 - Fixed NumPy compatibility
FROM nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04

# Prevent interactive prompts during install
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    git \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install NumPy 1.x FIRST (required for torch 2.0.1 compatibility)
RUN pip3 install --no-cache-dir "numpy<2"

# Install specific PyTorch version known to work with Whisper
RUN pip3 install --no-cache-dir \
    torch==2.0.1 \
    torchaudio==2.0.2 \
    --index-url https://download.pytorch.org/whl/cu118

# Install specific Whisper version
RUN pip3 install --no-cache-dir openai-whisper==20231117

# Install other dependencies (excluding numpy since it's already installed)
RUN pip3 install --no-cache-dir \
    runpod \
    demucs \
    Pillow \
    requests \
    boto3

# Pre-download models to avoid cold start delays
RUN python3 -c "import whisper; whisper.load_model('medium')"
RUN python3 -c "from demucs.pretrained import get_model; get_model('htdemucs')"

# Copy handler
COPY handler.py /app/handler.py

# Set entrypoint
CMD ["python3", "-u", "/app/handler.py"]