"""
VocalizeAI - RunPod Serverless Handler
"""

import os
import tempfile
import subprocess
import requests
import boto3
import torch
import whisper
from demucs.pretrained import get_model
from demucs.apply import apply_model
import torchaudio
import runpod

# Configuration
R2_ENDPOINT = os.environ.get('R2_ENDPOINT')
R2_ACCESS_KEY = os.environ.get('R2_ACCESS_KEY')
R2_SECRET_KEY = os.environ.get('R2_SECRET_KEY')
R2_BUCKET = os.environ.get('R2_BUCKET')
R2_PUBLIC_URL = os.environ.get('R2_PUBLIC_URL')

s3_client = boto3.client(
    's3',
    endpoint_url=R2_ENDPOINT,
    aws_access_key_id=R2_ACCESS_KEY,
    aws_secret_access_key=R2_SECRET_KEY,
)

# Load models globally
print("Loading Demucs model...")
demucs_model = get_model('htdemucs')
demucs_model.to('cuda' if torch.cuda.is_available() else 'cpu')
demucs_model.eval()

print("Loading Whisper model...")
whisper_model = whisper.load_model('medium')

print("Models loaded successfully!")


def download_file(url, local_path):
    response = requests.get(url, stream=True)
    response.raise_for_status()
    with open(local_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    return local_path


def upload_to_r2(local_path, key, content_type='audio/mpeg'):
    s3_client.upload_file(local_path, R2_BUCKET, key, ExtraArgs={'ContentType': content_type})
    return f"{R2_PUBLIC_URL}/{key}"


def separate_vocals(audio_path, output_dir):
    print(f"Separating vocals from: {audio_path}")
    
    waveform, sample_rate = torchaudio.load(audio_path)
    
    if waveform.shape[0] == 1:
        waveform = waveform.repeat(2, 1)
    
    waveform = waveform.unsqueeze(0)
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    waveform = waveform.to(device)
    
    with torch.no_grad():
        sources = apply_model(demucs_model, waveform, device=device)
    
    instrumental = sources[0, :3].sum(dim=0)
    vocals = sources[0, 3]
    
    instrumental_path = os.path.join(output_dir, 'instrumental.wav')
    vocals_path = os.path.join(output_dir, 'vocals.wav')
    
    torchaudio.save(instrumental_path, instrumental.cpu(), sample_rate)
    torchaudio.save(vocals_path, vocals.cpu(), sample_rate)
    
    print("Vocal separation complete!")
    return instrumental_path, vocals_path


def transcribe_lyrics(audio_path):
    print(f"Transcribing lyrics from: {audio_path}")
    
    result = whisper_model.transcribe(audio_path, word_timestamps=True, language='en')
    
    lyrics = []
    for segment in result['segments']:
        lyrics.append({
            'start': segment['start'],
            'end': segment['end'],
            'text': segment['text'].strip(),
            'words': segment.get('words', [])
        })
    
    print(f"Transcription complete! Found {len(lyrics)} segments.")
    return lyrics


def generate_lyrics_video(audio_path, lyrics, thumbnail_path, output_path, quality='720p'):
    print("Generating video with lyrics...")
    
    resolutions = {'720p': (1280, 720), '1080p': (1920, 1080), '4k': (3840, 2160)}
    width, height = resolutions.get(quality, (1280, 720))
    
    ass_path = output_path.replace('.mp4', '.ass')
    create_ass_subtitles(lyrics, ass_path, width, height)
    
    if thumbnail_path and os.path.exists(thumbnail_path):
        cmd = [
            'ffmpeg', '-y',
            '-loop', '1', '-i', thumbnail_path,
            '-i', audio_path,
            '-vf', f'scale={width}:{height},ass={ass_path}',
            '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
            '-c:a', 'aac', '-b:a', '192k',
            '-shortest', '-movflags', '+faststart',
            output_path
        ]
    else:
        cmd = [
            'ffmpeg', '-y',
            '-f', 'lavfi', '-i', f'color=c=black:s={width}x{height}:r=30',
            '-i', audio_path,
            '-vf', f'ass={ass_path}',
            '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
            '-c:a', 'aac', '-b:a', '192k',
            '-shortest', '-movflags', '+faststart',
            output_path
        ]
    
    subprocess.run(cmd, check=True, capture_output=True)
    
    if os.path.exists(ass_path):
        os.remove(ass_path)
    
    print(f"Video generated: {output_path}")
    return output_path


def create_ass_subtitles(lyrics, output_path, width, height):
    ass_content = f"""[Script Info]
Title: VocalizeAI Lyrics
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,{int(height/12)},&H00FFFFFF,&H000088EF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,3,2,2,50,50,{int(height/6)},1
Style: Highlight,Arial,{int(height/10)},&H0000F5FF,&H000088EF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,4,2,2,50,50,{int(height/6)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    
    for segment in lyrics:
        start_time = format_ass_time(segment['start'])
        end_time = format_ass_time(segment['end'])
        text = segment['text'].replace('\n', '\\N')
        ass_content += f"Dialogue: 0,{start_time},{end_time},Highlight,,0,0,0,,{{\\fad(200,200)}}{text}\n"
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(ass_content)


def format_ass_time(seconds):
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    centiseconds = int((seconds % 1) * 100)
    return f"{hours}:{minutes:02d}:{secs:02d}.{centiseconds:02d}"


def send_callback(callback_url, project_id, status, results=None, error=None):
    payload = {'project_id': project_id, 'status': status, 'results': results, 'error': error}
    try:
        requests.post(callback_url, json=payload, timeout=30)
    except Exception as e:
        print(f"Callback failed: {e}")


def handler(event):
    try:
        input_data = event['input']
        
        project_id = input_data['project_id']
        audio_url = input_data['audio_url']
        processing_type = input_data.get('processing_type', 'remove_vocals')
        include_lyrics = input_data.get('include_lyrics', True)
        video_quality = input_data.get('video_quality', '720p')
        thumbnail_url = input_data.get('thumbnail_url')
        callback_url = input_data.get('callback_url')
        
        with tempfile.TemporaryDirectory() as temp_dir:
            print(f"Processing project: {project_id}")
            
            audio_path = os.path.join(temp_dir, 'input_audio.mp3')
            download_file(audio_url, audio_path)
            print(f"Downloaded audio: {audio_path}")
            
            thumbnail_path = None
            if thumbnail_url:
                thumbnail_path = os.path.join(temp_dir, 'thumbnail.jpg')
                try:
                    download_file(thumbnail_url, thumbnail_path)
                except:
                    thumbnail_path = None
            
            instrumental_path, vocals_path = separate_vocals(audio_path, temp_dir)
            
            lyrics = []
            if include_lyrics:
                lyrics = transcribe_lyrics(audio_path)
            
            video_path = os.path.join(temp_dir, 'output_video.mp4')
            video_audio = instrumental_path if processing_type != 'isolate_backing' else audio_path
            generate_lyrics_video(video_audio, lyrics, thumbnail_path, video_path, video_quality)
            
            results = {}
            
            processed_key = f"processed/{project_id}/instrumental.wav"
            results['processed_audio_url'] = upload_to_r2(instrumental_path, processed_key, 'audio/wav')
            
            if processing_type in ['isolate_backing', 'both']:
                vocals_key = f"processed/{project_id}/vocals.wav"
                results['vocals_audio_url'] = upload_to_r2(vocals_path, vocals_key, 'audio/wav')
            
            video_key = f"processed/{project_id}/video.mp4"
            results['video_url'] = upload_to_r2(video_path, video_key, 'video/mp4')
            
            results['lyrics'] = lyrics
            
            print(f"Processing complete for project: {project_id}")
            
            if callback_url:
                send_callback(callback_url, project_id, 'completed', results)
            
            return {'status': 'completed', 'project_id': project_id, 'results': results}
            
    except Exception as e:
        error_msg = str(e)
        print(f"Processing failed: {error_msg}")
        
        if 'callback_url' in input_data:
            send_callback(input_data['callback_url'], input_data['project_id'], 'failed', error=error_msg)
        
        return {'status': 'failed', 'project_id': input_data.get('project_id'), 'error': error_msg}


runpod.serverless.start({'handler': handler})
```

---

## ✅ Complete File Checklist
```
vocalize-ai/
├── database/
│   └── schema.sql              ✅ (#1)
├── frontend/
│   ├── package.json            ✅ (#2)
│   ├── tailwind.config.js      ✅ (#3)
│   ├── postcss.config.js       ✅ (#4)
│   ├── next.config.js          ✅ (#5)
│   ├── .env.example            ✅ (#6)
│   └── src/
│       ├── pages/
│       │   ├── _app.jsx        ✅ (#7)
│       │   └── index.jsx       ✅ (#9)
│       └── styles/
│           └── globals.css     ✅ (#8)
├── backend/
│   ├── package.json            ✅ (#10)
│   ├── .env.example            ✅ (#11)
│   └── src/
│       └── index.js            ✅ (#12)
└── docker/
    ├── Dockerfile              ✅ (#13)
    └── handler.py              ✅ (#14)