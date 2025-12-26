# Karatrack Studio RunPod Handler v2.2 Serverless Dockerfile
# Version 6 - Fix FFmpeg with libx264 support
FROM pytorch/pytorch:2.0.1-cuda11.7-cudnn8-runtime

# Prevent interactive prompts during install
ENV DEBIAN_FRONTEND=noninteractive

# Remove conda's FFmpeg and install proper one with libx264
RUN conda remove -y ffmpeg || true
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install torchaudio matching the base PyTorch version
RUN pip install --no-cache-dir torchaudio==2.0.2

# Install Whisper and other dependencies
RUN pip install --no-cache-dir \
    openai-whisper \
    runpod \
    demucs \
    Pillow \
    requests \
    boto3

# Pre-download models to avoid cold start delays
RUN python -c "import whisper; whisper.load_model('medium')"
RUN python -c "from demucs.pretrained import get_model; get_model('htdemucs')"

# Copy handler
COPY handler.py /app/handler.py

# Set entrypoint
CMD ["python", "-u", "/app/handler.py"]