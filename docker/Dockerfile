# Karatrack Studio RunPod Handler v3.0
# WhisperX for precise word-level timestamps

FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip install --no-cache-dir \
    runpod \
    boto3 \
    requests \
    numpy \
    Pillow \
    torchaudio \
    demucs

# Install WhisperX (includes whisper + forced alignment)
RUN pip install --no-cache-dir git+https://github.com/m-bain/whisperx.git

# Copy handler
COPY handler.py /app/handler.py

# Pre-download models (optional but speeds up first run)
# Uncomment these lines to bake models into the image:
# RUN python -c "import whisperx; whisperx.load_model('medium', device='cpu', compute_type='int8')"
# RUN python -c "import whisperx; whisperx.load_align_model(language_code='en', device='cpu')"

CMD ["python", "-u", "/app/handler.py"]