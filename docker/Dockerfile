# Karatrack Studio - RunPod Serverless Dockerfile
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

# Install Python packages
RUN pip3 install --no-cache-dir \
    torch \
    torchaudio \
    --index-url https://download.pytorch.org/whl/cu118

RUN pip3 install --no-cache-dir \
    runpod \
    openai-whisper \
    demucs \
    numpy \
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