# Karatrack Studio RunPod Handler v4.0
# AssemblyAI for precise word-level timestamps
# Much simpler - no WhisperX dependency hell

FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies - much simpler without WhisperX
RUN pip install --no-cache-dir \
    runpod \
    boto3 \
    requests \
    Pillow \
    demucs \
    "numpy<2"

# Copy handler
COPY handler.py /app/handler.py

CMD ["python", "-u", "/app/handler.py"]