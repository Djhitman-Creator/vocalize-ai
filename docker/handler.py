"""
Karatrack Studio RunPod Handler
Processes audio files: vocal removal, lyrics transcription, video generation
Uploads results to Cloudflare R2
"""

import os
import json
import subprocess
import tempfile
import requests
from pathlib import Path
import runpod
import torch
import whisper
from demucs.pretrained import get_model
from demucs.apply import apply_model
import torchaudio
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import math
import boto3
from botocore.config import Config

# ============================================
# CONFIGURATION
# ============================================

SAMPLE_RATE = 44100
WHISPER_MODEL = "medium"
DEMUCS_MODEL = "htdemucs"

# Video settings
VIDEO_WIDTH = 1920
VIDEO_HEIGHT = 1080
FPS = 30
FONT_SIZE_LYRICS = 72
FONT_SIZE_TITLE = 96
FONT_SIZE_ARTIST = 64
FONT_SIZE_TRACK = 48

# Colors (RGB)
COLOR_BG = (10, 10, 20)
COLOR_TEXT = (255, 255, 255)
COLOR_HIGHLIGHT = (0, 255, 255)  # Cyan
COLOR_UPCOMING = (150, 150, 150)  # Gray
COLOR_COUNTDOWN = (255, 200, 0)  # Gold

# Timing
INTRO_DURATION = 5  # seconds for title screen
COUNTDOWN_THRESHOLD = 3  # seconds of silence before showing countdown
COUNTDOWN_DOTS = 3

# ============================================
# R2 UPLOAD FUNCTIONS
# ============================================

def get_r2_client():
    """Create R2 client using environment variables"""
    return boto3.client(
        's3',
        endpoint_url=os.environ.get('CLOUDFLARE_R2_ENDPOINT'),
        aws_access_key_id=os.environ.get('CLOUDFLARE_R2_ACCESS_KEY'),
        aws_secret_access_key=os.environ.get('CLOUDFLARE_R2_SECRET_KEY'),
        config=Config(signature_version='s3v4'),
        region_name='auto'
    )

def upload_to_r2(file_path, key):
    """Upload a file to R2 and return the public URL"""
    try:
        client = get_r2_client()
        bucket = os.environ.get('CLOUDFLARE_R2_BUCKET', 'vocalize-files')
        public_url = os.environ.get('CLOUDFLARE_R2_PUBLIC_URL', '')
        
        # Determine content type
        if file_path.endswith('.mp4'):
            content_type = 'video/mp4'
        elif file_path.endswith('.wav'):
            content_type = 'audio/wav'
        elif file_path.endswith('.mp3'):
            content_type = 'audio/mpeg'
        else:
            content_type = 'application/octet-stream'
        
        # Upload file
        with open(file_path, 'rb') as f:
            client.put_object(
                Bucket=bucket,
                Key=key,
                Body=f,
                ContentType=content_type
            )
        
        # Return public URL
        url = f"{public_url}/{key}"
        print(f"✅ Uploaded to R2: {url}")
        return url
        
    except Exception as e:
        print(f"❌ R2 upload error: {str(e)}")
        raise e

# ============================================
# HELPER FUNCTIONS
# ============================================

def download_file(url, destination):
    """Download file from URL"""
    response = requests.get(url, stream=True)
    response.raise_for_status()
    with open(destination, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    return destination


def get_font(size):
    """Get font, fallback to default if custom not available"""
    try:
        return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", size)
    except:
        return ImageFont.load_default()


def separate_vocals(audio_path, output_dir):
    """Use Demucs to separate vocals from instrumental"""
    print("🎵 Separating vocals with Demucs...")
    
    model = get_model(DEMUCS_MODEL)
    model.eval()
    
    if torch.cuda.is_available():
        model.cuda()
    
    wav, sr = torchaudio.load(audio_path)
    
    if sr != SAMPLE_RATE:
        resampler = torchaudio.transforms.Resample(sr, SAMPLE_RATE)
        wav = resampler(wav)
    
    # Ensure stereo
    if wav.shape[0] == 1:
        wav = wav.repeat(2, 1)
    
    wav = wav.unsqueeze(0)  # Add batch dimension
    
    if torch.cuda.is_available():
        wav = wav.cuda()
    
    with torch.no_grad():
        sources = apply_model(model, wav, device=wav.device)[0]
    
    sources = sources.cpu()
    
    # Demucs outputs: drums, bass, other, vocals
    source_names = ['drums', 'bass', 'other', 'vocals']
    
    vocals_path = os.path.join(output_dir, 'vocals.wav')
    instrumental_path = os.path.join(output_dir, 'instrumental.wav')
    
    # Save vocals
    vocals = sources[3]  # vocals index
    torchaudio.save(vocals_path, vocals, SAMPLE_RATE)
    
    # Save instrumental (drums + bass + other)
    instrumental = sources[0] + sources[1] + sources[2]
    torchaudio.save(instrumental_path, instrumental, SAMPLE_RATE)
    
    print("✅ Vocal separation complete")
    return instrumental_path, vocals_path


def transcribe_lyrics(audio_path, work_dir):
    """Use Whisper to transcribe lyrics with word-level timestamps"""
    print("📝 Transcribing lyrics with Whisper...")
    
    model = whisper.load_model(WHISPER_MODEL)
    
    # Use file path directly - compatible with pinned Whisper version
    result = model.transcribe(
        audio_path,
        word_timestamps=True,
        language="en"
    )
    
    lyrics = []
    for segment in result['segments']:
        if 'words' in segment:
            for word in segment['words']:
                lyrics.append({
                    'word': word['word'].strip(),
                    'start': word['start'],
                    'end': word['end']
                })
        else:
            # Fallback if no word-level timestamps
            lyrics.append({
                'word': segment['text'].strip(),
                'start': segment['start'],
                'end': segment['end']
            })
    
    print(f"✅ Transcribed {len(lyrics)} words")
    return lyrics


def detect_silence_gaps(lyrics, threshold=COUNTDOWN_THRESHOLD):
    """Find gaps in lyrics where countdown should appear"""
    gaps = []
    
    if not lyrics:
        return gaps
    
    # Check gap at start
    if lyrics[0]['start'] > threshold:
        gaps.append({
            'start': 0,
            'end': lyrics[0]['start'],
            'duration': lyrics[0]['start']
        })
    
    # Check gaps between words
    for i in range(len(lyrics) - 1):
        gap_start = lyrics[i]['end']
        gap_end = lyrics[i + 1]['start']
        gap_duration = gap_end - gap_start
        
        if gap_duration >= threshold:
            gaps.append({
                'start': gap_start,
                'end': gap_end,
                'duration': gap_duration
            })
    
    return gaps


def create_frame(width, height, bg_color=COLOR_BG):
    """Create a blank frame"""
    img = Image.new('RGB', (width, height), bg_color)
    return img


def draw_centered_text(draw, text, y, font, color, width):
    """Draw centered text"""
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    x = (width - text_width) // 2
    draw.text((x, y), text, font=font, fill=color)


def create_intro_frame(track_number, artist, title, frame_num, total_frames):
    """Create intro screen frame with fade in/out"""
    img = create_frame(VIDEO_WIDTH, VIDEO_HEIGHT)
    draw = ImageDraw.Draw(img)
    
    # Fonts
    font_track = get_font(FONT_SIZE_TRACK)
    font_artist = get_font(FONT_SIZE_ARTIST)
    font_title = get_font(FONT_SIZE_TITLE)
    
    # Fade effect
    progress = frame_num / total_frames
    if progress < 0.2:
        alpha = progress / 0.2
    elif progress > 0.8:
        alpha = (1 - progress) / 0.2
    else:
        alpha = 1.0
    
    # Apply alpha to colors
    def apply_alpha(color, a):
        return tuple(int(c * a) for c in color)
    
    # Draw track number
    draw_centered_text(draw, track_number, VIDEO_HEIGHT // 2 - 150, 
                       font_track, apply_alpha(COLOR_COUNTDOWN, alpha), VIDEO_WIDTH)
    
    # Draw artist
    draw_centered_text(draw, artist, VIDEO_HEIGHT // 2 - 50, 
                       font_artist, apply_alpha(COLOR_TEXT, alpha), VIDEO_WIDTH)
    
    # Draw title
    draw_centered_text(draw, title, VIDEO_HEIGHT // 2 + 50, 
                       font_title, apply_alpha(COLOR_HIGHLIGHT, alpha), VIDEO_WIDTH)
    
    return img


def create_countdown_frame(dots_remaining, total_dots=COUNTDOWN_DOTS):
    """Create countdown frame with dots"""
    img = create_frame(VIDEO_WIDTH, VIDEO_HEIGHT)
    draw = ImageDraw.Draw(img)
    
    font = get_font(FONT_SIZE_LYRICS)
    
    # Create dots string: ● ● ● or ● ● or ●
    dots = " ● " * dots_remaining
    dots_gray = " ○ " * (total_dots - dots_remaining)
    
    full_text = dots_gray + dots
    
    draw_centered_text(draw, full_text.strip(), VIDEO_HEIGHT // 2, 
                       font, COLOR_COUNTDOWN, VIDEO_WIDTH)
    
    return img


def create_lyrics_frame(current_time, lyrics, current_line_words):
    """Create frame with scrolling lyrics"""
    img = create_frame(VIDEO_WIDTH, VIDEO_HEIGHT)
    draw = ImageDraw.Draw(img)
    
    font = get_font(FONT_SIZE_LYRICS)
    font_small = get_font(FONT_SIZE_LYRICS - 20)
    
    # Find current word index
    current_word_idx = -1
    for i, word in enumerate(lyrics):
        if word['start'] <= current_time <= word['end']:
            current_word_idx = i
            break
        elif word['start'] > current_time:
            current_word_idx = i - 1
            break
    
    if current_word_idx == -1 and lyrics and current_time > lyrics[-1]['end']:
        current_word_idx = len(lyrics) - 1
    
    # Group words into lines (roughly 6-8 words per line)
    words_per_line = 7
    lines = []
    for i in range(0, len(lyrics), words_per_line):
        line_words = lyrics[i:i + words_per_line]
        lines.append({
            'words': line_words,
            'start_idx': i,
            'text': ' '.join([w['word'] for w in line_words])
        })
    
    # Find current line
    current_line_idx = current_word_idx // words_per_line if current_word_idx >= 0 else 0
    
    # Draw 3 lines: previous, current, next
    y_positions = [VIDEO_HEIGHT // 2 - 100, VIDEO_HEIGHT // 2, VIDEO_HEIGHT // 2 + 100]
    line_indices = [current_line_idx - 1, current_line_idx, current_line_idx + 1]
    
    for y, line_idx in zip(y_positions, line_indices):
        if 0 <= line_idx < len(lines):
            line = lines[line_idx]
            
            if line_idx == current_line_idx:
                # Current line - highlight current word
                x = VIDEO_WIDTH // 2
                total_width = sum(draw.textbbox((0, 0), w['word'] + ' ', font=font)[2] for w in line['words'])
                x = (VIDEO_WIDTH - total_width) // 2
                
                for word_data in line['words']:
                    word_idx = lyrics.index(word_data)
                    word = word_data['word'] + ' '
                    
                    if word_idx <= current_word_idx and current_time >= word_data['start']:
                        color = COLOR_HIGHLIGHT
                    else:
                        color = COLOR_TEXT
                    
                    draw.text((x, y), word, font=font, fill=color)
                    x += draw.textbbox((0, 0), word, font=font)[2]
            else:
                # Other lines - gray
                draw_centered_text(draw, line['text'], y, font_small, COLOR_UPCOMING, VIDEO_WIDTH)
    
    return img


def generate_video(audio_path, lyrics, gaps, track_info, output_path, video_quality):
    """Generate video with lyrics and countdown"""
    print("🎬 Generating video...")
    
    # Video dimensions based on quality
    if video_quality == '4k':
        width, height = 3840, 2160
    elif video_quality == '1080p':
        width, height = 1920, 1080
    else:
        width, height = 1280, 720
    
    # Get audio duration
    result = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', audio_path],
        capture_output=True, text=True
    )
    duration = float(result.stdout.strip())
    
    total_frames = int((duration + INTRO_DURATION) * FPS)
    
    # Create temp directory for frames
    frames_dir = tempfile.mkdtemp()
    
    track_number = track_info.get('track_number', 'KT-01')
    artist = track_info.get('artist_name', 'Unknown Artist')
    title = track_info.get('song_title', 'Unknown Title')
    
    intro_frames = int(INTRO_DURATION * FPS)
    
    for frame_num in range(total_frames):
        if frame_num < intro_frames:
            # Intro screen
            frame = create_intro_frame(track_number, artist, title, frame_num, intro_frames)
        else:
            # Main content
            current_time = (frame_num - intro_frames) / FPS
            
            # Check if we're in a countdown gap
            in_gap = False
            for gap in gaps:
                if gap['start'] <= current_time < gap['end']:
                    in_gap = True
                    time_until_lyrics = gap['end'] - current_time
                    dots_remaining = min(COUNTDOWN_DOTS, int(time_until_lyrics) + 1)
                    frame = create_countdown_frame(dots_remaining)
                    break
            
            if not in_gap:
                # Lyrics frame
                frame = create_lyrics_frame(current_time, lyrics, [])
        
        # Resize if needed
        if frame.size != (width, height):
            frame = frame.resize((width, height), Image.LANCZOS)
        
        frame_path = os.path.join(frames_dir, f'frame_{frame_num:06d}.png')
        frame.save(frame_path)
        
        if frame_num % 100 == 0:
            print(f"  Frame {frame_num}/{total_frames}")
    
    # Combine frames with audio using FFmpeg
    print("🔧 Encoding video with FFmpeg...")
    
    ffmpeg_cmd = [
        'ffmpeg', '-y',
        '-framerate', str(FPS),
        '-i', os.path.join(frames_dir, 'frame_%06d.png'),
        '-i', audio_path,
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-pix_fmt', 'yuv420p',
        '-shortest',
        output_path
    ]
    
    subprocess.run(ffmpeg_cmd, check=True)
    
    # Cleanup frames
    import shutil
    shutil.rmtree(frames_dir)
    
    print("✅ Video generation complete")
    return output_path


# ============================================
# MAIN HANDLER
# ============================================

def handler(event):
    """RunPod handler function"""
    callback_url = None
    project_id = None
    
    try:
        input_data = event['input']
        
        project_id = input_data['project_id']
        audio_url = input_data['audio_url']
        processing_type = input_data.get('processing_type', 'remove_vocals')
        include_lyrics = input_data.get('include_lyrics', True)
        video_quality = input_data.get('video_quality', '1080p')
        thumbnail_url = input_data.get('thumbnail_url')
        callback_url = input_data.get('callback_url')
        
        track_info = {
            'track_number': input_data.get('track_number', 'KT-01'),
            'artist_name': input_data.get('artist_name', 'Unknown Artist'),
            'song_title': input_data.get('song_title', 'Unknown Title'),
        }
        
        print(f"🎤 Processing project: {project_id}")
        print(f"   Type: {processing_type}")
        print(f"   Lyrics: {include_lyrics}")
        print(f"   Quality: {video_quality}")
        
        # Create temp working directory
        work_dir = tempfile.mkdtemp()
        
        # Download audio
        audio_path = os.path.join(work_dir, 'input_audio.mp3')
        print(f"📥 Downloading audio from {audio_url}")
        download_file(audio_url, audio_path)
        
        results = {}
        
        # Separate vocals
        instrumental_path = None
        vocals_path = None
        
        if processing_type in ['remove_vocals', 'both']:
            instrumental_path, vocals_path = separate_vocals(audio_path, work_dir)
            
            # Upload instrumental to R2
            instrumental_key = f"processed/{project_id}/instrumental.wav"
            results['processed_audio_url'] = upload_to_r2(instrumental_path, instrumental_key)
            
            if processing_type == 'both':
                vocals_key = f"processed/{project_id}/vocals.wav"
                results['vocals_audio_url'] = upload_to_r2(vocals_path, vocals_key)
        
        elif processing_type == 'isolate_backing':
            instrumental_path, vocals_path = separate_vocals(audio_path, work_dir)
            vocals_key = f"processed/{project_id}/vocals.wav"
            results['vocals_audio_url'] = upload_to_r2(vocals_path, vocals_key)
        
        # Transcribe lyrics
        lyrics = []
        gaps = []
        if include_lyrics:
            lyrics = transcribe_lyrics(audio_path, work_dir)
            gaps = detect_silence_gaps(lyrics)
            results['lyrics'] = lyrics
        
        # Generate video
        video_path = os.path.join(work_dir, f'{project_id}_output.mp4')
        audio_for_video = instrumental_path if instrumental_path else audio_path
        generate_video(audio_for_video, lyrics, gaps, track_info, video_path, video_quality)
        
        # Upload video to R2
        video_key = f"processed/{project_id}/video.mp4"
        results['video_url'] = upload_to_r2(video_path, video_key)
        
        # Send callback
        if callback_url:
            print(f"📤 Sending callback to {callback_url}")
            requests.post(callback_url, json={
                'project_id': project_id,
                'status': 'completed',
                'results': results
            })
        
        # Cleanup
        import shutil
        shutil.rmtree(work_dir)
        
        print("✅ Processing complete!")
        return {
            'status': 'completed',
            'project_id': project_id,
            'results': results
        }
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        
        if callback_url:
            requests.post(callback_url, json={
                'project_id': project_id,
                'status': 'failed',
                'error': str(e)
            })
        
        return {
            'status': 'failed',
            'error': str(e)
        }


# RunPod serverless handler
runpod.serverless.start({"handler": handler})