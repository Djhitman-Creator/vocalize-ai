FROM nvidia/cuda:11.8-cudnn8-runtime-ubuntu22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-dev \
    ffmpeg \
    git \
    wget \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Set Python aliases
RUN ln -s /usr/bin/python3 /usr/bin/python

# Upgrade pip
RUN pip3 install --upgrade pip

# Install PyTorch with CUDA support
RUN pip3 install torch torchaudio --index-url https://download.pytorch.org/whl/cu118

# Install ML dependencies
RUN pip3 install \
    openai-whisper \
    demucs \
    runpod \
    requests \
    numpy \
    Pillow

# Create working directory
WORKDIR /app

# Copy handler
COPY handler.py /app/handler.py

# Pre-download models (optional but speeds up cold starts)
RUN python3 -c "import whisper; whisper.load_model('medium')" || true
RUN python3 -c "from demucs.pretrained import get_model; get_model('htdemucs')" || true

# Start handler
CMD ["python3", "/app/handler.py"]