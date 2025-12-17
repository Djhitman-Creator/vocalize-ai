# VocalizeAI - RunPod Serverless Worker
FROM nvidia/cuda:11.8-cudnn8-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive

WORKDIR /app

RUN apt-get update && apt-get install -y \
    python3.10 \
    python3-pip \
    ffmpeg \
    git \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --upgrade pip

RUN pip3 install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118

RUN pip3 install \
    demucs \
    openai-whisper \
    runpod \
    boto3 \
    requests \
    numpy \
    pydub

RUN python3 -c "from demucs.pretrained import get_model; get_model('htdemucs')"
RUN python3 -c "import whisper; whisper.load_model('medium')"

COPY handler.py /app/handler.py

CMD ["python3", "-u", "/app/handler.py"]