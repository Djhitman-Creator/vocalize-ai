"""
Karatrack Studio RunPod Handler
Version 4.0 - AssemblyAI for Precise Timing

Uses AssemblyAI API for word-level timestamps (~50ms accuracy)
No more dependency hell - simple REST API call

Processes audio files: vocal removal, lyrics transcription, video generation
Uploads results to Cloudflare R2
"""

import os
import json
import subprocess
import tempfile
import requests
import re
import time
from pathlib import Path
import runpod
import torch
from demucs.pretrained import get_model
from demucs.apply import apply_model
import torchaudio
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import math
import boto3
from botocore.config import Config
import gc

# ============================================
# CONFIGURATION
# ============================================

SAMPLE_RATE = 44100
DEMUCS_MODEL = "htdemucs"

# AssemblyAI
ASSEMBLYAI_API_KEY = os.environ.get('ASSEMBLYAI_API_KEY')
ASSEMBLYAI_UPLOAD_URL = "https://api.assemblyai.com/v2/upload"
ASSEMBLYAI_TRANSCRIPT_URL = "https://api.assemblyai.com/v2/transcript"

# Video settings
VIDEO_WIDTH = 1920
VIDEO_HEIGHT = 1080
FPS = 30
FONT_SIZE_LYRICS = 64
FONT_SIZE_TITLE = 96
FONT_SIZE_ARTIST = 64
FONT_SIZE_COUNTDOWN = 80

# Layout settings
PADDING_LEFT_RIGHT = 100
LINE_HEIGHT_MULTIPLIER = 1.4

# Colors (RGB)
COLOR_BG = (10, 10, 20)
COLOR_TEXT = (255, 255, 255)
COLOR_HIGHLIGHT = (0, 255, 255)  # Cyan for current word
COLOR_SUNG = (100, 200, 200)  # Dimmed cyan for already sung words
COLOR_UPCOMING = (200, 200, 200)  # Light gray for upcoming lines
COLOR_COUNTDOWN = (255, 200, 0)  # Gold for countdown dots

# Timing
INTRO_DURATION = 4  # Reduced from 5 to 4 seconds
COUNTDOWN_THRESHOLD = 5
INTRO_COUNTDOWN_THRESHOLD = 10
COUNTDOWN_DOTS = 3

# Display mode settings
WORDS_PER_LINE = 7
LINES_PER_PAGE = 4

# Watermark settings for free tier
WATERMARK_LOGO_URL = os.environ.get('WATERMARK_LOGO_URL', '')
WATERMARK_TEXT = "Karatrack.com"
WATERMARK_OPACITY = 0.7  # 70% opacity
WATERMARK_LOGO_SIZE = 80  # Width in pixels (height scales proportionally)
WATERMARK_PADDING = 20  # Padding from edges

# ============================================
# PROFANITY FILTER
# ============================================

PROFANITY_LIST = {
    'fuck', 'fucking', 'fucked', 'fucker', 'fuckers', 'fucks', 'fuckin',
    'shit', 'shitting', 'shitted', 'shitty', 'bullshit', 'shits',
    'ass', 'asses', 'asshole', 'assholes', 'badass',
    'bitch', 'bitches', 'bitching', 'bitchy',
    'damn', 'damned', 'dammit', 'goddamn', 'goddamned', 'goddamnit',
    'hell',
    'crap', 'crappy',
    'dick', 'dicks', 'dickhead', 'dickheads',
    'cock', 'cocks', 'cocksucker',
    'pussy', 'pussies',
    'cunt', 'cunts',
    'bastard', 'bastards',
    'whore', 'whores',
    'slut', 'sluts', 'slutty',
    'piss', 'pissed', 'pissing',
    'suck', 'sucks', 'sucked', 'sucking', 'sucker', 'suckers',
    'balls', 'ballsack',
    'boob', 'boobs', 'boobie', 'boobies',
    'tit', 'tits', 'titty', 'titties',
    'nut', 'nuts', 'nutsack',
    'screw', 'screwed', 'screwing',
    'jackass', 'dumbass', 'fatass', 'smartass',
    'bloody', 'bugger', 'bollocks',
    'wanker', 'wankers', 'tosser',
    'twat', 'twats',
    'arsehole', 'arse',
    'skank', 'skanky',
    'douche', 'douchebag', 'douchy',
    'nigga', 'niggas', 'nigger', 'niggers',
    'fag', 'fags', 'faggot', 'faggots',
    'retard', 'retarded', 'retards',
    'wtf', 'stfu', 'lmfao', 'lmao',
    'mofo', 'motherfucker', 'motherfucking', 'motherfuckers', 'muthafucka',
    'hoe', 'hoes', 'thot', 'thots',
}


def censor_word(word):
    """Replace profanity with # symbols matching the word length."""
    if not word:
        return word
    
    clean_word = re.sub(r'[^a-zA-Z\']', '', word).lower()
    
    if clean_word in PROFANITY_LIST:
        result = ''
        for char in word:
            if char.isalpha():
                result += '#'
            else:
                result += char
        print(f"   Censored: '{word}' -> '{result}'")
        return result
    
    return word


def apply_profanity_filter(lyrics_list):
    """Apply profanity filter to a list of lyric word objects."""
    filtered = []
    censored_count = 0
    
    for item in lyrics_list:
        filtered_item = item.copy()
        original_word = item['word']
        censored_word = censor_word(original_word)
        
        if censored_word != original_word:
            censored_count += 1
            
        filtered_item['word'] = censored_word
        filtered.append(filtered_item)
    
    print(f"   Total words censored: {censored_count}")
    return filtered


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
        
        if file_path.endswith('.mp4'):
            content_type = 'video/mp4'
        elif file_path.endswith('.wav'):
            content_type = 'audio/wav'
        elif file_path.endswith('.mp3'):
            content_type = 'audio/mpeg'
        else:
            content_type = 'application/octet-stream'
        
        with open(file_path, 'rb') as f:
            client.put_object(
                Bucket=bucket,
                Key=key,
                Body=f,
                ContentType=content_type
            )
        
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


def convert_to_wav(input_path, output_path, sample_rate=SAMPLE_RATE):
    """Convert any audio file to WAV using FFmpeg"""
    cmd = [
        'ffmpeg', '-y', '-i', input_path,
        '-ar', str(sample_rate),
        '-ac', '2',
        '-c:a', 'pcm_s16le',
        output_path
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    return output_path


def get_audio_duration(audio_path):
    """Get duration of audio file in seconds"""
    result = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', 
         '-of', 'default=noprint_wrappers=1:nokey=1', audio_path],
        capture_output=True, text=True
    )
    return float(result.stdout.strip())


def add_silence_to_audio(audio_path, silence_duration, output_path):
    """Add silence to the beginning of an audio file"""
    print(f"   Adding {silence_duration}s silence to beginning of audio...")
    
    # Use FFmpeg to add silence at the beginning
    # This creates silence and concatenates it with the original audio
    cmd = [
        'ffmpeg', '-y',
        '-f', 'lavfi', '-i', f'anullsrc=r=44100:cl=stereo:d={silence_duration}',
        '-i', audio_path,
        '-filter_complex', '[0:a][1:a]concat=n=2:v=0:a=1[out]',
        '-map', '[out]',
        '-c:a', 'pcm_s16le',
        output_path
    ]
    
    subprocess.run(cmd, check=True, capture_output=True)
    print(f"   ✅ Audio with silence created: {output_path}")
    return output_path


# Global variable to cache the watermark logo
_watermark_logo_cache = None
_custom_watermark_cache = {}  # Cache custom watermarks by URL

def get_watermark_logo():
    """Download and cache the watermark logo"""
    global _watermark_logo_cache
    
    if _watermark_logo_cache is not None:
        return _watermark_logo_cache
    
    if not WATERMARK_LOGO_URL:
        print("   ⚠️ No watermark logo URL configured")
        return None
    
    try:
        print(f"   📥 Downloading watermark logo from {WATERMARK_LOGO_URL}")
        response = requests.get(WATERMARK_LOGO_URL)
        response.raise_for_status()
        
        from io import BytesIO
        logo = Image.open(BytesIO(response.content)).convert('RGBA')
        
        # Resize logo to standard width, keeping aspect ratio
        aspect_ratio = logo.height / logo.width
        new_width = WATERMARK_LOGO_SIZE
        new_height = int(new_width * aspect_ratio)
        logo = logo.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        _watermark_logo_cache = logo
        print(f"   ✅ Watermark logo loaded ({new_width}x{new_height})")
        return logo
        
    except Exception as e:
        print(f"   ⚠️ Failed to load watermark logo: {e}")
        return None


def get_custom_watermark(url):
    """Download and cache a custom watermark logo"""
    global _custom_watermark_cache
    
    if not url:
        return None
    
    if url in _custom_watermark_cache:
        return _custom_watermark_cache[url]
    
    try:
        print(f"   📥 Downloading custom watermark from {url}")
        response = requests.get(url)
        response.raise_for_status()
        
        from io import BytesIO
        logo = Image.open(BytesIO(response.content)).convert('RGBA')
        
        # Resize custom watermark - medium size for visibility without being intrusive
        max_width = 150
        aspect_ratio = logo.height / logo.width
        new_width = min(logo.width, max_width)
        new_height = int(new_width * aspect_ratio)
        
        # Cap height as well
        max_height = 100
        if new_height > max_height:
            new_height = max_height
            new_width = int(new_height / aspect_ratio)
        
        logo = logo.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        _custom_watermark_cache[url] = logo
        print(f"   ✅ Custom watermark loaded ({new_width}x{new_height})")
        return logo
        
    except Exception as e:
        print(f"   ⚠️ Failed to load custom watermark: {e}")
        return None


def apply_watermark(frame, video_width, video_height):
    """Apply watermark (logo + text) to bottom-left of frame"""
    
    # Get logo
    logo = get_watermark_logo()
    
    # Create a copy of the frame to work with
    watermarked = frame.copy()
    
    # Prepare to draw text
    draw = ImageDraw.Draw(watermarked)
    font = get_font(20)  # Smaller font for watermark text
    
    # Calculate text size
    text_bbox = draw.textbbox((0, 0), WATERMARK_TEXT, font=font)
    text_width = text_bbox[2] - text_bbox[0]
    text_height = text_bbox[3] - text_bbox[1]
    
    # Calculate total height needed (logo + text + spacing)
    total_height = text_height + 8  # Start with text height + spacing
    if logo:
        total_height += logo.height
    
    # Position from bottom-left with enough room for everything
    x_pos = WATERMARK_PADDING
    bottom_margin = WATERMARK_PADDING + 10  # Extra margin from bottom
    
    if logo:
        # Position logo at bottom-left (but with margin)
        logo_x = x_pos
        logo_y = video_height - bottom_margin - logo.height
        
        # Create semi-transparent version of logo
        logo_with_opacity = logo.copy()
        alpha = logo_with_opacity.split()[3]
        alpha = alpha.point(lambda p: int(p * WATERMARK_OPACITY))
        logo_with_opacity.putalpha(alpha)
        
        # Paste logo onto frame
        watermarked.paste(logo_with_opacity, (logo_x, logo_y), logo_with_opacity)
        
        # Position text ABOVE the logo, left-aligned with logo
        # Ensure text doesn't go off the left edge
        text_x = max(WATERMARK_PADDING, logo_x)
        text_y = logo_y - text_height - 5  # 5px gap above logo
    else:
        # No logo, just put text at bottom-left
        text_x = x_pos
        text_y = video_height - bottom_margin - text_height
    
    # Draw text with slight transparency effect (draw outline then text)
    # Semi-transparent white text
    text_color = (255, 255, 255, int(255 * WATERMARK_OPACITY))
    outline_color = (0, 0, 0, int(255 * WATERMARK_OPACITY))
    
    # Draw outline
    for dx in [-1, 0, 1]:
        for dy in [-1, 0, 1]:
            if dx != 0 or dy != 0:
                draw.text((text_x + dx, text_y + dy), WATERMARK_TEXT, font=font, fill=outline_color)
    
    # Draw main text
    draw.text((text_x, text_y), WATERMARK_TEXT, font=font, fill=text_color)
    
    return watermarked


def apply_studio_watermark(frame, video_width, video_height, custom_watermark_url):
    """Apply custom watermark (logo only, no text) to bottom-right of frame"""
    
    logo = get_custom_watermark(custom_watermark_url)
    if not logo:
        return frame  # Return original if no custom watermark loaded
    
    # Create a copy of the frame to work with
    watermarked = frame.copy()
    
    # Position in bottom-right corner with good padding
    padding = 40  # Larger padding for custom watermarks
    logo_x = video_width - padding - logo.width
    logo_y = video_height - padding - logo.height
    
    # Create semi-transparent version
    logo_with_opacity = logo.copy()
    alpha = logo_with_opacity.split()[3]
    alpha = alpha.point(lambda p: int(p * WATERMARK_OPACITY))
    logo_with_opacity.putalpha(alpha)
    
    # Paste logo onto frame
    watermarked.paste(logo_with_opacity, (logo_x, logo_y), logo_with_opacity)
    
    return watermarked


def separate_vocals(audio_path, output_dir):
    """Use Demucs to separate vocals from instrumental"""
    print("🎵 Separating vocals with Demucs...")
    
    wav_input_path = os.path.join(output_dir, 'input_converted.wav')
    convert_to_wav(audio_path, wav_input_path)
    
    model = get_model(DEMUCS_MODEL)
    model.eval()
    
    if torch.cuda.is_available():
        model.cuda()
    
    wav, sr = torchaudio.load(wav_input_path)
    
    if sr != SAMPLE_RATE:
        resampler = torchaudio.transforms.Resample(sr, SAMPLE_RATE)
        wav = resampler(wav)
    
    if wav.shape[0] == 1:
        wav = wav.repeat(2, 1)
    
    wav = wav.unsqueeze(0)
    
    if torch.cuda.is_available():
        wav = wav.cuda()
    
    with torch.no_grad():
        sources = apply_model(model, wav, device=wav.device)[0]
    
    sources = sources.cpu()
    
    vocals_path = os.path.join(output_dir, 'vocals.wav')
    instrumental_path = os.path.join(output_dir, 'instrumental.wav')
    
    vocals = sources[3]
    torchaudio.save(vocals_path, vocals, SAMPLE_RATE)
    
    instrumental = sources[0] + sources[1] + sources[2]
    torchaudio.save(instrumental_path, instrumental, SAMPLE_RATE)
    
    # Free memory
    del model, wav, sources
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    
    print("✅ Vocal separation complete")
    return instrumental_path, vocals_path


# ============================================
# ASSEMBLYAI TRANSCRIPTION - PRECISE TIMING
# ============================================

def transcribe_with_assemblyai(audio_path, user_lyrics_text=None):
    """
    Use AssemblyAI for precise word-level timestamps.
    
    AssemblyAI provides:
    - ~50ms word-level accuracy
    - No dependency conflicts
    - Production-grade reliability
    """
    print("📝 Transcribing with AssemblyAI (precise alignment)...")
    
    if not ASSEMBLYAI_API_KEY:
        raise ValueError("ASSEMBLYAI_API_KEY environment variable not set")
    
    headers = {
        "authorization": ASSEMBLYAI_API_KEY,
        "content-type": "application/json"
    }
    
    # Step 1: Upload audio file to AssemblyAI
    print("   Uploading audio to AssemblyAI...")
    with open(audio_path, 'rb') as f:
        upload_response = requests.post(
            ASSEMBLYAI_UPLOAD_URL,
            headers={"authorization": ASSEMBLYAI_API_KEY},
            data=f
        )
    upload_response.raise_for_status()
    audio_url = upload_response.json()['upload_url']
    print(f"   Audio uploaded: {audio_url[:50]}...")
    
    # Step 2: Request transcription with word-level timestamps
    print("   Requesting transcription...")
    transcript_request = {
        "audio_url": audio_url,
        "word_boost": [],  # Can add expected words for better accuracy
        "boost_param": "default"
    }
    
    transcript_response = requests.post(
        ASSEMBLYAI_TRANSCRIPT_URL,
        headers=headers,
        json=transcript_request
    )
    transcript_response.raise_for_status()
    transcript_id = transcript_response.json()['id']
    print(f"   Transcript ID: {transcript_id}")
    
    # Step 3: Poll for completion
    print("   Waiting for transcription to complete...")
    polling_url = f"{ASSEMBLYAI_TRANSCRIPT_URL}/{transcript_id}"
    
    while True:
        poll_response = requests.get(polling_url, headers=headers)
        poll_response.raise_for_status()
        result = poll_response.json()
        
        status = result['status']
        if status == 'completed':
            print("   ✅ Transcription complete!")
            break
        elif status == 'error':
            raise Exception(f"AssemblyAI transcription failed: {result.get('error', 'Unknown error')}")
        else:
            print(f"   Status: {status}...")
            time.sleep(3)
    
    # Step 4: Extract word-level timestamps
    words = result.get('words', [])
    
    lyrics = []
    for word_info in words:
        word = word_info.get('text', '').strip()
        start = word_info.get('start', 0) / 1000.0  # Convert ms to seconds
        end = word_info.get('end', 0) / 1000.0
        
        if word:
            lyrics.append({
                'word': word,
                'start': start,
                'end': end
            })
    
    print(f"✅ AssemblyAI returned {len(lyrics)} words with precise timestamps")
    
    # Debug: Show first 5 words and their timestamps
    print("   📊 First 5 words timing:")
    for i, w in enumerate(lyrics[:5]):
        print(f"      {i+1}. '{w['word']}' at {w['start']:.2f}s - {w['end']:.2f}s")
    
    # If user provided lyrics, use their words but keep AssemblyAI timestamps
    if user_lyrics_text and len(user_lyrics_text.strip()) > 50:
        print("📝 Mapping user lyrics to AssemblyAI timestamps...")
        lyrics = align_user_lyrics_to_timestamps(user_lyrics_text, lyrics)
        
        # Debug: Show first 5 aligned words
        print("   📊 First 5 aligned words timing:")
        for i, w in enumerate(lyrics[:5]):
            print(f"      {i+1}. '{w['word']}' at {w['start']:.2f}s - {w['end']:.2f}s")
    
    return lyrics


def align_user_lyrics_to_timestamps(user_lyrics_text, api_lyrics):
    """
    Decide whether to use user lyrics or API transcription.
    
    PRIORITY: Perfect timing over perfect words.
    
    - If word counts match exactly: use user words with API timestamps
    - Otherwise: use API transcription directly (timing is perfect)
    
    The API transcription might have minor word errors, but the timing
    will be perfectly synced throughout the entire song.
    """
    # Parse user lyrics into words
    user_words = parse_lyrics_text(user_lyrics_text)
    print(f"   User provided {len(user_words)} words")
    print(f"   AssemblyAI detected {len(api_lyrics)} words")
    
    if len(api_lyrics) == 0:
        print("   ⚠️ No API words - returning empty")
        return []
    
    # Only use user words if counts match EXACTLY
    if len(user_words) == len(api_lyrics):
        print(f"   ✅ Word counts match exactly - using user words with API timestamps")
        aligned = []
        for i in range(len(user_words)):
            aligned.append({
                'word': user_words[i],
                'start': api_lyrics[i]['start'],
                'end': api_lyrics[i]['end']
            })
        print(f"✅ Aligned {len(aligned)} user words with AssemblyAI timestamps")
        return aligned
    else:
        # Word counts differ - use API transcription for perfect timing
        print(f"   ⚠️ Word counts differ ({len(user_words)} vs {len(api_lyrics)}) - using API transcription for perfect timing")
        print(f"✅ Using {len(api_lyrics)} AssemblyAI words with original timestamps")
        return api_lyrics


def parse_lyrics_text(lyrics_text):
    """Parse raw lyrics text into a clean list of words."""
    # Remove section headers like [Verse 1], [Chorus], etc.
    text = re.sub(r'\[.*?\]', '', lyrics_text)
    text = ' '.join(text.split())
    
    words = []
    for word in text.split():
        cleaned = word.strip()
        if cleaned and not cleaned.isspace():
            words.append(cleaned)
    
    return words


def detect_silence_gaps(lyrics, intro_threshold=INTRO_COUNTDOWN_THRESHOLD, mid_threshold=COUNTDOWN_THRESHOLD):
    """Find gaps in lyrics where countdown should appear."""
    gaps = []
    
    if not lyrics:
        return gaps
    
    if lyrics[0]['start'] >= intro_threshold:
        gaps.append({
            'start': 0,
            'end': lyrics[0]['start'],
            'duration': lyrics[0]['start'],
            'is_intro': True
        })
    
    for i in range(len(lyrics) - 1):
        gap_start = lyrics[i]['end']
        gap_end = lyrics[i + 1]['start']
        gap_duration = gap_end - gap_start
        
        if gap_duration >= mid_threshold:
            gaps.append({
                'start': gap_start,
                'end': gap_end,
                'duration': gap_duration,
                'is_intro': False
            })
    
    return gaps


def calculate_lyrics_stats(lyrics, audio_duration):
    """Calculate statistics about the lyrics for auto display mode selection."""
    if not lyrics:
        return {'words_per_minute': 0, 'avg_line_length': 0, 'has_clear_sections': False}
    
    total_words = len(lyrics)
    duration_minutes = audio_duration / 60
    wpm = total_words / duration_minutes if duration_minutes > 0 else 0
    
    lines = []
    current_line = []
    for i, word in enumerate(lyrics):
        current_line.append(word)
        if i < len(lyrics) - 1:
            gap = lyrics[i + 1]['start'] - word['end']
            if gap > 1.0:
                lines.append(current_line)
                current_line = []
    if current_line:
        lines.append(current_line)
    
    avg_line_length = sum(len(line) for line in lines) / len(lines) if lines else WORDS_PER_LINE
    
    long_gaps = [g for g in detect_silence_gaps(lyrics) if g['duration'] > 3]
    has_clear_sections = len(long_gaps) >= 2
    
    return {
        'words_per_minute': wpm,
        'avg_line_length': avg_line_length,
        'has_clear_sections': has_clear_sections
    }


def select_display_mode(lyrics, audio_duration, requested_mode='auto'):
    """Select the best display mode based on song characteristics."""
    if requested_mode != 'auto':
        return requested_mode
    
    stats = calculate_lyrics_stats(lyrics, audio_duration)
    
    print(f"   Lyrics stats: {stats['words_per_minute']:.0f} WPM, "
          f"avg line: {stats['avg_line_length']:.1f} words, "
          f"clear sections: {stats['has_clear_sections']}")
    
    if stats['words_per_minute'] > 150:
        return 'scroll'
    elif stats['avg_line_length'] > 10:
        return 'scroll'
    elif stats['has_clear_sections'] and stats['words_per_minute'] < 100:
        return 'page'
    else:
        return 'overwrite'


# ============================================
# VIDEO GENERATION
# ============================================

def create_frame(width, height, colors=None):
    """Create a blank frame with optional gradient background"""
    if colors is None:
        colors = {'bg_1': COLOR_BG, 'bg_2': COLOR_BG, 'use_gradient': False}
    
    bg_1 = colors.get('bg_1', COLOR_BG)
    bg_2 = colors.get('bg_2', COLOR_BG)
    use_gradient = colors.get('use_gradient', False)
    
    img = Image.new('RGB', (width, height), bg_1)
    
    if use_gradient and bg_1 != bg_2:
        draw = ImageDraw.Draw(img)
        direction = colors.get('gradient_direction', 'to bottom')
        
        # Create gradient
        for i in range(height):
            if direction in ['to bottom', 'to top']:
                ratio = i / height if direction == 'to bottom' else (height - i) / height
            else:
                ratio = i / height  # Default to vertical
            
            r = int(bg_1[0] + (bg_2[0] - bg_1[0]) * ratio)
            g = int(bg_1[1] + (bg_2[1] - bg_1[1]) * ratio)
            b = int(bg_1[2] + (bg_2[2] - bg_1[2]) * ratio)
            draw.line([(0, i), (width, i)], fill=(r, g, b))
    
    return img


def draw_centered_text(draw, text, y, font, color, width, padding=PADDING_LEFT_RIGHT):
    """Draw centered text with padding"""
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    x = (width - text_width) // 2
    x = max(padding, x)
    draw.text((x, y), text, font=font, fill=color)


def create_intro_frame(artist, title, frame_num, total_frames, width, height, colors=None):
    """Create intro screen frame with fade in/out."""
    img = create_frame(width, height, colors)
    draw = ImageDraw.Draw(img)
    
    # Get colors or use defaults
    text_color = colors.get('text', COLOR_TEXT) if colors else COLOR_TEXT
    sung_color = colors.get('sung', COLOR_HIGHLIGHT) if colors else COLOR_HIGHLIGHT
    
    scale = width / 1920
    font_artist = get_font(int(FONT_SIZE_ARTIST * scale))
    font_title = get_font(int(FONT_SIZE_TITLE * scale))
    
    progress = frame_num / total_frames
    if progress < 0.2:
        alpha = progress / 0.2
    elif progress > 0.8:
        alpha = (1 - progress) / 0.2
    else:
        alpha = 1.0
    
    def apply_alpha(color, a):
        return tuple(int(c * a) for c in color)
    
    draw_centered_text(draw, artist, height // 2 - int(60 * scale), 
                       font_artist, apply_alpha(text_color, alpha), width)
    
    draw_centered_text(draw, title, height // 2 + int(40 * scale), 
                       font_title, apply_alpha(sung_color, alpha), width)
    
    return img


def create_countdown_frame_with_preview(dots_remaining, width, height, lyrics, gap_end_time, total_dots=COUNTDOWN_DOTS):
    """Create countdown frame with dots AND preview of upcoming lyrics."""
    img = create_frame(width, height)
    draw = ImageDraw.Draw(img)
    
    scale = width / 1920
    font_countdown = get_font(int(FONT_SIZE_COUNTDOWN * scale))
    font_lyrics = get_font(int(FONT_SIZE_LYRICS * scale))
    line_height = int(FONT_SIZE_LYRICS * LINE_HEIGHT_MULTIPLIER * scale)
    padding = int(PADDING_LEFT_RIGHT * scale)
    
    dots = " ● " * dots_remaining
    dots_gray = " ○ " * (total_dots - dots_remaining)
    full_text = dots_gray + dots
    
    dots_y = height // 4
    draw_centered_text(draw, full_text.strip(), dots_y, font_countdown, COLOR_COUNTDOWN, width)
    
    upcoming_words = [w for w in lyrics if w['start'] >= gap_end_time - 0.5]
    
    if upcoming_words:
        lines = []
        current_line = []
        for word in upcoming_words:
            current_line.append(word)
            if len(current_line) >= WORDS_PER_LINE:
                lines.append(current_line)
                current_line = []
                if len(lines) >= 4:
                    break
        if current_line and len(lines) < 4:
            lines.append(current_line)
        
        preview_start_y = height // 2
        
        for i, line in enumerate(lines[:4]):
            y = preview_start_y + (i * line_height)
            line_text = ' '.join([w['word'] for w in line])
            
            if i == 0:
                color = COLOR_TEXT
            else:
                fade = 1 - (i * 0.2)
                color = tuple(int(c * fade) for c in COLOR_UPCOMING)
            
            draw_centered_text(draw, line_text, y, font_lyrics, color, width, padding)
    
    return img


def group_lyrics_into_lines(lyrics, words_per_line=WORDS_PER_LINE):
    """
    Group lyrics into display lines using both word count AND timing gaps.
    
    Natural line breaks occur when:
    1. We've reached max words per line, OR
    2. There's a significant pause (0.5+ seconds) between words
    
    This creates more natural-looking line breaks that match the song's rhythm.
    """
    lines = []
    current_line = []
    
    for i, word in enumerate(lyrics):
        current_line.append(word)
        
        # Check if we should end this line
        should_break = False
        
        # Reason 1: Reached max words per line
        if len(current_line) >= words_per_line:
            should_break = True
        
        # Reason 2: Natural pause before next word (0.5+ seconds gap)
        elif i < len(lyrics) - 1:
            next_word = lyrics[i + 1]
            gap = next_word['start'] - word['end']
            if gap >= 0.5 and len(current_line) >= 3:  # At least 3 words before breaking on gap
                should_break = True
        
        if should_break:
            lines.append(current_line)
            current_line = []
    
    if current_line:
        lines.append(current_line)
    
    return lines


def create_scroll_frame(current_time, lyrics, width, height, colors=None):
    """Create TELEPROMPTER-STYLE scrolling lyrics frame."""
    img = create_frame(width, height, colors)
    draw = ImageDraw.Draw(img)
    
    # Get colors or use defaults
    text_color = colors.get('text', COLOR_TEXT) if colors else COLOR_TEXT
    sung_color = colors.get('sung', COLOR_SUNG) if colors else COLOR_SUNG
    highlight_color = colors.get('sung', COLOR_HIGHLIGHT) if colors else COLOR_HIGHLIGHT
    upcoming_color = colors.get('text', COLOR_UPCOMING) if colors else COLOR_UPCOMING
    # Make upcoming slightly dimmer than main text
    if colors:
        upcoming_color = tuple(int(c * 0.7) for c in text_color)
    
    scale = width / 1920
    font = get_font(int(FONT_SIZE_LYRICS * scale))
    line_height = int(FONT_SIZE_LYRICS * LINE_HEIGHT_MULTIPLIER * scale)
    padding = int(PADDING_LEFT_RIGHT * scale)
    
    lines = group_lyrics_into_lines(lyrics)
    
    if not lines:
        return img
    
    current_line_idx = 0
    for i, line in enumerate(lines):
        if line and line[-1]['end'] >= current_time:
            current_line_idx = i
            break
        current_line_idx = i
    
    scroll_progress = 0
    if current_line_idx < len(lines):
        line = lines[current_line_idx]
        if line:
            line_start = line[0]['start']
            line_end = line[-1]['end']
            if line_end > line_start:
                scroll_progress = (current_time - line_start) / (line_end - line_start)
                scroll_progress = max(0, min(1, scroll_progress))
    
    visible_lines = 9
    center_y = height // 2
    
    for offset in range(-visible_lines // 2, visible_lines // 2 + 1):
        line_idx = current_line_idx + offset
        
        if 0 <= line_idx < len(lines):
            line = lines[line_idx]
            
            base_y = center_y + (offset * line_height)
            scroll_offset = scroll_progress * line_height
            y = base_y - int(scroll_offset)
            
            if y < -line_height or y > height + line_height:
                continue
            
            total_width = sum(draw.textbbox((0, 0), w['word'] + ' ', font=font)[2] for w in line)
            x = (width - total_width) // 2
            x = max(padding, x)
            
            for word_data in line:
                word = word_data['word'] + ' '
                word_width = draw.textbbox((0, 0), word, font=font)[2]
                
                if line_idx < current_line_idx:
                    color = sung_color
                elif line_idx == current_line_idx:
                    if current_time >= word_data['start']:
                        color = highlight_color
                    else:
                        color = text_color
                else:
                    color = upcoming_color
                
                if x + word_width <= width - padding:
                    draw.text((x, y), word, font=font, fill=color)
                
                x += word_width
    
    return img


def create_page_frame(current_time, lyrics, width, height, colors=None):
    """Create frame with page-by-page lyrics display."""
    img = create_frame(width, height, colors)
    draw = ImageDraw.Draw(img)
    
    # Get colors or use defaults
    text_color = colors.get('text', COLOR_TEXT) if colors else COLOR_TEXT
    sung_color = colors.get('sung', COLOR_SUNG) if colors else COLOR_SUNG
    highlight_color = colors.get('sung', COLOR_HIGHLIGHT) if colors else COLOR_HIGHLIGHT
    
    scale = width / 1920
    font = get_font(int(FONT_SIZE_LYRICS * scale))
    line_height = int(FONT_SIZE_LYRICS * LINE_HEIGHT_MULTIPLIER * scale)
    padding = int(PADDING_LEFT_RIGHT * scale)
    
    lines = group_lyrics_into_lines(lyrics)
    
    pages = []
    for i in range(0, len(lines), LINES_PER_PAGE):
        pages.append(lines[i:i + LINES_PER_PAGE])
    
    current_line_idx = 0
    for i, line in enumerate(lines):
        if line and line[-1]['end'] >= current_time:
            current_line_idx = i
            break
        current_line_idx = i
    
    current_page_idx = current_line_idx // LINES_PER_PAGE
    current_page_idx = min(current_page_idx, len(pages) - 1)
    
    if current_page_idx < len(pages):
        page = pages[current_page_idx]
        
        total_height = len(page) * line_height
        start_y = (height - total_height) // 2
        
        for i, line in enumerate(page):
            y = start_y + (i * line_height)
            line_idx_global = current_page_idx * LINES_PER_PAGE + i
            
            total_width = sum(draw.textbbox((0, 0), w['word'] + ' ', font=font)[2] for w in line)
            x = (width - total_width) // 2
            x = max(padding, x)
            
            for word_data in line:
                word = word_data['word'] + ' '
                
                if line_idx_global < current_line_idx:
                    color = sung_color
                elif line_idx_global == current_line_idx:
                    if current_time >= word_data['start']:
                        color = highlight_color
                    else:
                        color = text_color
                else:
                    color = text_color
                
                draw.text((x, y), word, font=font, fill=color)
                x += draw.textbbox((0, 0), word, font=font)[2]
    
    return img


def create_overwrite_frame(current_time, lyrics, width, height, colors=None):
    """
    Create frame with TRUE overwrite-style lyrics display.
    
    3 fixed positions on screen:
    - Position 0 (top): shows lines 0, 3, 6, 9...
    - Position 1 (middle): shows lines 1, 4, 7, 10...
    - Position 2 (bottom): shows lines 2, 5, 8, 11...
    
    When a line is done being sung, the NEXT line for that position
    appears instantly. Lines don't move - content is replaced in place.
    """
    img = create_frame(width, height, colors)
    draw = ImageDraw.Draw(img)
    
    # Get colors or use defaults
    text_color = colors.get('text', COLOR_TEXT) if colors else COLOR_TEXT
    sung_color = colors.get('sung', COLOR_SUNG) if colors else COLOR_SUNG
    highlight_color = colors.get('sung', COLOR_HIGHLIGHT) if colors else COLOR_HIGHLIGHT
    upcoming_color = colors.get('text', COLOR_UPCOMING) if colors else COLOR_UPCOMING
    # Make upcoming slightly dimmer than main text
    if colors:
        upcoming_color = tuple(int(c * 0.7) for c in text_color)
    
    scale = width / 1920
    font = get_font(int(FONT_SIZE_LYRICS * scale))
    line_height = int(FONT_SIZE_LYRICS * LINE_HEIGHT_MULTIPLIER * scale)
    padding = int(PADDING_LEFT_RIGHT * scale)
    
    # Group lyrics into lines
    lines = group_lyrics_into_lines(lyrics)
    
    if not lines:
        return img
    
    # Find which line is currently being sung
    current_line_idx = 0
    for i, line in enumerate(lines):
        if line and line[-1]['end'] >= current_time:
            current_line_idx = i
            break
        current_line_idx = i
    
    NUM_POSITIONS = 3
    
    # Calculate vertical positions - centered on screen
    total_display_height = NUM_POSITIONS * line_height
    start_y = (height - total_display_height) // 2
    
    # We always show the current line and the next 2 upcoming lines
    # Each line's position is determined by: line_idx % NUM_POSITIONS
    lines_to_show = [current_line_idx, current_line_idx + 1, current_line_idx + 2]
    
    for line_idx in lines_to_show:
        # Skip if line doesn't exist
        if line_idx < 0 or line_idx >= len(lines):
            continue
        
        line = lines[line_idx]
        
        # This line's fixed position (0, 1, or 2)
        position = line_idx % NUM_POSITIONS
        y = start_y + (position * line_height)
        
        # Calculate total width for centering
        total_width = sum(draw.textbbox((0, 0), w['word'] + ' ', font=font)[2] for w in line)
        x = (width - total_width) // 2
        x = max(padding, x)
        
        # Draw each word in the line
        for word_data in line:
            word = word_data['word'] + ' '
            
            if line_idx < current_line_idx:
                # Already sung (shouldn't happen with this logic, but just in case)
                color = sung_color
            elif line_idx == current_line_idx:
                # Current line - highlight sung words
                if current_time >= word_data['start']:
                    color = highlight_color
                else:
                    color = text_color
            else:
                # Upcoming lines
                color = upcoming_color
            
            draw.text((x, y), word, font=font, fill=color)
            x += draw.textbbox((0, 0), word, font=font)[2]
    
    return img


def create_lyrics_frame(current_time, lyrics, display_mode, width, height, colors=None):
    """Create frame with lyrics based on selected display mode."""
    if display_mode == 'scroll':
        return create_scroll_frame(current_time, lyrics, width, height, colors)
    elif display_mode == 'page':
        return create_page_frame(current_time, lyrics, width, height, colors)
    else:
        return create_overwrite_frame(current_time, lyrics, width, height, colors)


def generate_video(audio_path, lyrics, gaps, track_info, output_path, video_quality, display_mode, style_options=None, subscription_tier='free', custom_watermark_url=None):
    """Generate video with lyrics and countdown"""
    print(f"🎬 Generating video (mode: {display_mode})...")
    print(f"   👤 Subscription tier: {subscription_tier}")
    
    # Determine watermark behavior based on tier
    # Free: Karatrack watermark
    # Starter/Pro: No watermark
    # Studio: Custom watermark (if provided)
    apply_watermark_to_video = subscription_tier == 'free'
    apply_custom_watermark = subscription_tier == 'studio' and custom_watermark_url
    
    if apply_watermark_to_video:
        print("   🏷️ Karatrack watermark will be applied (free tier)")
    elif apply_custom_watermark:
        print(f"   🏷️ Custom watermark will be applied (Studio tier)")
    else:
        print("   ✨ No watermark (paid tier)")
    
    # Default style options if not provided
    if style_options is None:
        style_options = {
            'bg_color_1': '#1a1a2e',
            'bg_color_2': '#16213e',
            'use_gradient': True,
            'gradient_direction': 'to bottom',
            'text_color': '#ffffff',
            'outline_color': '#000000',
            'sung_color': '#00d4ff',
            'font': 'arial',
        }
    
    # Parse colors from hex to RGB tuples
    def hex_to_rgb(hex_color):
        hex_color = hex_color.lstrip('#')
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    
    colors = {
        'bg_1': hex_to_rgb(style_options.get('bg_color_1', '#1a1a2e')),
        'bg_2': hex_to_rgb(style_options.get('bg_color_2', '#16213e')),
        'text': hex_to_rgb(style_options.get('text_color', '#ffffff')),
        'outline': hex_to_rgb(style_options.get('outline_color', '#000000')),
        'sung': hex_to_rgb(style_options.get('sung_color', '#00d4ff')),
        'use_gradient': style_options.get('use_gradient', True),
        'gradient_direction': style_options.get('gradient_direction', 'to bottom'),
    }
    
    print(f"   🎨 Colors: bg={colors['bg_1']}, text={colors['text']}, sung={colors['sung']}")
    
    if video_quality == '4k':
        width, height = 3840, 2160
    elif video_quality == '1080p':
        width, height = 1920, 1080
    elif video_quality == '480p':
        width, height = 854, 480
    else:
        width, height = 1280, 720  # Default to 720p
    
    # Add silence to beginning of audio for intro screen
    work_dir = os.path.dirname(audio_path)
    audio_with_intro = os.path.join(work_dir, 'audio_with_intro.wav')
    add_silence_to_audio(audio_path, INTRO_DURATION, audio_with_intro)
    
    # Offset all lyric timestamps by INTRO_DURATION
    # So lyrics sync with audio that now has silence at the start
    offset_lyrics = []
    for word in lyrics:
        offset_word = word.copy()
        offset_word['start'] = word['start'] + INTRO_DURATION
        offset_word['end'] = word['end'] + INTRO_DURATION
        offset_lyrics.append(offset_word)
    
    print(f"   ⏱️ Lyrics offset by {INTRO_DURATION}s for intro")
    
    # Get duration of audio WITH intro silence
    total_duration = get_audio_duration(audio_with_intro)
    total_frames = int(total_duration * FPS)
    
    frames_dir = tempfile.mkdtemp()
    
    artist = track_info.get('artist_name', 'Unknown Artist')
    title = track_info.get('song_title', 'Unknown Title')
    
    intro_frames = int(INTRO_DURATION * FPS)
    
    # Debug: Log timing info
    print(f"   📊 Timing debug:")
    print(f"      Total duration (with intro): {total_duration:.2f}s")
    print(f"      Intro duration: {INTRO_DURATION}s ({intro_frames} frames)")
    print(f"      Total frames: {total_frames}")
    if offset_lyrics:
        print(f"      First lyric '{offset_lyrics[0]['word']}' at {offset_lyrics[0]['start']:.2f}s (frame {int(offset_lyrics[0]['start'] * FPS)})")
    
    first_lyric_logged = False
    
    for frame_num in range(total_frames):
        current_time = frame_num / FPS
        
        if frame_num < intro_frames:
            # Show intro screen during the silence period
            frame = create_intro_frame(artist, title, frame_num, intro_frames, width, height, colors)
        else:
            # Debug: Log when first lyric should appear
            if not first_lyric_logged and offset_lyrics and current_time >= offset_lyrics[0]['start']:
                print(f"   📊 First lyric should appear now: frame {frame_num}, current_time={current_time:.2f}s")
                first_lyric_logged = True
            
            # Show lyrics (using offset timestamps)
            frame = create_lyrics_frame(current_time, offset_lyrics, display_mode, width, height, colors)
        
        # Apply watermark for free tier, or custom watermark for Studio
        if apply_watermark_to_video:
            frame = apply_watermark(frame, width, height)
        elif apply_custom_watermark:
            frame = apply_studio_watermark(frame, width, height, custom_watermark_url)
        
        frame_path = os.path.join(frames_dir, f'frame_{frame_num:06d}.png')
        frame.save(frame_path)
        
        if frame_num % 100 == 0:
            print(f"  Frame {frame_num}/{total_frames}")
    
    print("🔧 Encoding video with FFmpeg...")
    
    # Use audio_with_intro which has silence at the beginning
    ffmpeg_cmd = [
        'ffmpeg', '-y',
        '-framerate', str(FPS),
        '-i', os.path.join(frames_dir, 'frame_%06d.png'),
        '-i', audio_with_intro,
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
        
        user_lyrics_text = input_data.get('lyrics_text')
        display_mode = input_data.get('display_mode', 'auto')
        
        clean_version_raw = input_data.get('clean_version', False)
        clean_version = clean_version_raw in [True, 'true', 'True', '1', 1]
        
        # Get subscription tier for watermark logic
        subscription_tier = input_data.get('subscription_tier', 'free')
        
        # Get custom watermark URL for Studio users
        custom_watermark_url = input_data.get('custom_watermark_url', None)
        
        track_info = {
            'track_number': input_data.get('track_number', 'KT-01'),
            'artist_name': input_data.get('artist_name', 'Unknown Artist'),
            'song_title': input_data.get('song_title', 'Unknown Title'),
        }
        
        # NEW: Extract style customization options
        style_options = {
            'bg_color_1': input_data.get('bg_color_1', '#1a1a2e'),
            'bg_color_2': input_data.get('bg_color_2', '#16213e'),
            'use_gradient': input_data.get('use_gradient', True) in [True, 'true', 'True', '1', 1],
            'gradient_direction': input_data.get('gradient_direction', 'to bottom'),
            'text_color': input_data.get('text_color', '#ffffff'),
            'outline_color': input_data.get('outline_color', '#000000'),
            'sung_color': input_data.get('sung_color', '#00d4ff'),
            'font': input_data.get('font', 'arial'),
        }
        
        print(f"🎤 Processing project: {project_id}")
        print(f"   Type: {processing_type}")
        print(f"   Lyrics provided: {'Yes' if user_lyrics_text else 'No (auto-transcribe)'}")
        print(f"   Display mode: {display_mode}")
        print(f"   Clean version: {clean_version}")
        print(f"   Quality: {video_quality}")
        print(f"   👤 Subscription tier: {subscription_tier}")
        print(f"   🎨 Style: bg={style_options['bg_color_1']}, text={style_options['text_color']}, sung={style_options['sung_color']}")
        print(f"   🚀 Using AssemblyAI for precise timing!")
        
        # Check processing mode early
        processing_mode = input_data.get('processing_mode', 'full')
        print(f"   📋 Processing mode: {processing_mode}")
        
        work_dir = tempfile.mkdtemp()
        results = {}
        
        # RENDER_ONLY MODE: Skip vocal separation, use existing processed audio
        if processing_mode == 'render_only':
            print("🎬 Render-only mode - using existing processed audio")
            
            # Get the already-processed audio URL
            processed_audio_url = input_data.get('processed_audio_url')
            if not processed_audio_url:
                raise ValueError("render_only mode requires processed_audio_url")
            
            # Download the processed audio
            instrumental_path = os.path.join(work_dir, 'instrumental.wav')
            print(f"📥 Downloading processed audio from {processed_audio_url}")
            download_file(processed_audio_url, instrumental_path)
            
            # Get edited lyrics from input
            lyrics = input_data.get('edited_lyrics', [])
            if not lyrics:
                raise ValueError("render_only mode requires edited_lyrics")
            
            print(f"📝 Using {len(lyrics)} edited lyrics from user")
            
            # Keep existing URLs
            results['processed_audio_url'] = processed_audio_url
            if input_data.get('vocals_audio_url'):
                results['vocals_audio_url'] = input_data.get('vocals_audio_url')
            
            gaps = detect_silence_gaps(lyrics)
            results['lyrics'] = lyrics
            
            # Skip to video generation (handled below)
            vocals_path = None
            audio_path = instrumental_path
            
        else:
            # FULL or TRANSCRIBE_ONLY MODE: Do vocal separation and transcription
            audio_path = os.path.join(work_dir, 'input_audio.mp3')
            print(f"📥 Downloading audio from {audio_url}")
            download_file(audio_url, audio_path)
            
            print("🎵 Starting vocal separation...")
            instrumental_path, vocals_path = separate_vocals(audio_path, work_dir)
            
            if processing_type in ['remove_vocals']:
                instrumental_key = f"processed/{project_id}/instrumental.wav"
                results['processed_audio_url'] = upload_to_r2(instrumental_path, instrumental_key)
            
            elif processing_type == 'guide_vocals':
                # Guide Vocals mode: Mix instrumental (100%) + vocals (30%) for singers who need guidance
                print("🎤 Creating guide vocals track (instrumental + 30% vocals)...")
                
                # Load both tracks
                instrumental_wav, sr = torchaudio.load(instrumental_path)
                vocals_wav, _ = torchaudio.load(vocals_path)
                
                # Ensure same length (pad shorter one with silence)
                max_len = max(instrumental_wav.shape[1], vocals_wav.shape[1])
                if instrumental_wav.shape[1] < max_len:
                    padding = torch.zeros(instrumental_wav.shape[0], max_len - instrumental_wav.shape[1])
                    instrumental_wav = torch.cat([instrumental_wav, padding], dim=1)
                if vocals_wav.shape[1] < max_len:
                    padding = torch.zeros(vocals_wav.shape[0], max_len - vocals_wav.shape[1])
                    vocals_wav = torch.cat([vocals_wav, padding], dim=1)
                
                # Mix: instrumental at 100% + vocals at 30%
                guide_mix = instrumental_wav + (vocals_wav * 0.3)
                
                # Normalize to prevent clipping
                max_val = guide_mix.abs().max()
                if max_val > 1.0:
                    guide_mix = guide_mix / max_val
                
                # Save the mixed track
                guide_path = os.path.join(work_dir, 'guide_vocals.wav')
                torchaudio.save(guide_path, guide_mix, sr)
                
                guide_key = f"processed/{project_id}/guide_vocals.wav"
                guide_url = upload_to_r2(guide_path, guide_key)
                results['processed_audio_url'] = guide_url
                
                # Also save the isolated vocals for potential future use
                vocals_key = f"processed/{project_id}/vocals.wav"
                results['vocals_audio_url'] = upload_to_r2(vocals_path, vocals_key)
                
                # IMPORTANT: Use guide vocals mix for video generation
                instrumental_path = guide_path
                
                print("✅ Guide vocals track created")
            
            # LYRICS PROCESSING - NOW USING ASSEMBLYAI
            lyrics = []
            gaps = []
            
            if include_lyrics:
                # Use AssemblyAI for transcription and alignment
                lyrics = transcribe_with_assemblyai(vocals_path, user_lyrics_text)
                
                if clean_version and lyrics:
                    print("🛡️ Applying profanity filter...")
                    print(f"   Processing {len(lyrics)} words...")
                    lyrics = apply_profanity_filter(lyrics)
                
                gaps = detect_silence_gaps(lyrics)
                print(f"   Found {len(gaps)} gaps for countdown")
                
                results['lyrics'] = lyrics
            
            # Check if transcribe_only - stop here
            if processing_mode == 'transcribe_only':
                print("📋 Transcribe-only mode - skipping video generation")
                
                if callback_url:
                    print(f"📤 Sending callback to {callback_url}")
                    requests.post(callback_url, json={
                        'project_id': project_id,
                        'status': 'transcribed',
                        'results': results
                    })
                
                import shutil
                shutil.rmtree(work_dir)
                
                print("✅ Transcription complete!")
                return {
                    'status': 'transcribed',
                    'project_id': project_id,
                    'results': results
                }
        
        # VIDEO GENERATION (for 'full' or 'render_only' modes)
        audio_duration = get_audio_duration(instrumental_path if instrumental_path else audio_path)
        
        selected_display_mode = select_display_mode(lyrics, audio_duration, display_mode)
        print(f"📺 Selected display mode: {selected_display_mode}")
        
        video_path = os.path.join(work_dir, f'{project_id}_output.mp4')
        audio_for_video = instrumental_path if instrumental_path else audio_path
        
        generate_video(
            audio_for_video, 
            lyrics, 
            gaps, 
            track_info, 
            video_path, 
            video_quality,
            selected_display_mode,
            style_options,
            subscription_tier,  # Pass subscription tier for watermark logic
            custom_watermark_url  # Pass custom watermark URL for Studio users
        )
        
        video_key = f"processed/{project_id}/video.mp4"
        results['video_url'] = upload_to_r2(video_path, video_key)
        
        if callback_url:
            print(f"📤 Sending callback to {callback_url}")
            requests.post(callback_url, json={
                'project_id': project_id,
                'status': 'completed',
                'results': results
            })
        
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
        import traceback
        traceback.print_exc()
        
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