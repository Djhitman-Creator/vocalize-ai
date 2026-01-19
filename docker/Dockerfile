# Karatrack Studio RunPod Handler v5.0
# AssemblyAI for precise word-level timestamps
# NEW: Video background support with OpenCV

FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

WORKDIR /app

# Install system dependencies (including libGL for OpenCV)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    libsndfile1 \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip install --no-cache-dir \
    runpod \
    boto3 \
    requests \
    Pillow \
    demucs \
    "numpy<2" \
    opencv-python-headless

# Copy handler
COPY handler.py /app/handler.py

CMD ["python", "-u", "/app/handler.py"]