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
INTRO_DURATION = 5
COUNTDOWN_THRESHOLD = 5
INTRO_COUNTDOWN_THRESHOLD = 10
COUNTDOWN_DOTS = 3

# Display mode settings
WORDS_PER_LINE = 7
LINES_PER_PAGE = 4

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
    Map user-provided lyrics to AssemblyAI timestamps.
    
    SIMPLE APPROACH: 
    - If word counts are similar (within 15%), do 1:1 sequential mapping
    - User word 1 gets API timestamp 1, user word 2 gets API timestamp 2, etc.
    - This guarantees timestamps stay in order and are accurate
    
    If word counts differ too much, just use API words directly.
    """
    # Parse user lyrics into words
    user_words = parse_lyrics_text(user_lyrics_text)
    print(f"   User provided {len(user_words)} words")
    print(f"   AssemblyAI detected {len(api_lyrics)} words")
    
    # Check if word counts are similar enough for 1:1 mapping
    if len(api_lyrics) == 0:
        print("   ⚠️ No API words - returning empty")
        return []
    
    word_count_ratio = len(user_words) / len(api_lyrics)
    
    # If counts are within 15%, do 1:1 sequential mapping
    if 0.85 <= word_count_ratio <= 1.15:
        print(f"   ✅ Word counts similar ({word_count_ratio:.2f}) - using 1:1 mapping")
        aligned = []
        
        # Use the shorter list length
        min_len = min(len(user_words), len(api_lyrics))
        
        for i in range(min_len):
            aligned.append({
                'word': user_words[i],  # User's word
                'start': api_lyrics[i]['start'],  # API's timing
                'end': api_lyrics[i]['end']
            })
        
        print(f"✅ Aligned {len(aligned)} user words with AssemblyAI timestamps")
        return aligned
    else:
        # Word counts too different - just use API transcription directly
        print(f"   ⚠️ Word counts too different ({word_count_ratio:.2f}) - using API words directly")
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

def create_frame(width, height, bg_color=COLOR_BG):
    """Create a blank frame"""
    img = Image.new('RGB', (width, height), bg_color)
    return img


def draw_centered_text(draw, text, y, font, color, width, padding=PADDING_LEFT_RIGHT):
    """Draw centered text with padding"""
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    x = (width - text_width) // 2
    x = max(padding, x)
    draw.text((x, y), text, font=font, fill=color)


def create_intro_frame(artist, title, frame_num, total_frames, width, height):
    """Create intro screen frame with fade in/out."""
    img = create_frame(width, height)
    draw = ImageDraw.Draw(img)
    
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
                       font_artist, apply_alpha(COLOR_TEXT, alpha), width)
    
    draw_centered_text(draw, title, height // 2 + int(40 * scale), 
                       font_title, apply_alpha(COLOR_HIGHLIGHT, alpha), width)
    
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


def create_scroll_frame(current_time, lyrics, width, height):
    """Create TELEPROMPTER-STYLE scrolling lyrics frame."""
    img = create_frame(width, height)
    draw = ImageDraw.Draw(img)
    
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
                    color = COLOR_SUNG
                elif line_idx == current_line_idx:
                    if current_time >= word_data['start']:
                        color = COLOR_HIGHLIGHT
                    else:
                        color = COLOR_TEXT
                else:
                    color = COLOR_UPCOMING
                
                if x + word_width <= width - padding:
                    draw.text((x, y), word, font=font, fill=color)
                
                x += word_width
    
    return img


def create_page_frame(current_time, lyrics, width, height):
    """Create frame with page-by-page lyrics display."""
    img = create_frame(width, height)
    draw = ImageDraw.Draw(img)
    
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
                    color = COLOR_SUNG
                elif line_idx_global == current_line_idx:
                    if current_time >= word_data['start']:
                        color = COLOR_HIGHLIGHT
                    else:
                        color = COLOR_TEXT
                else:
                    color = COLOR_TEXT
                
                draw.text((x, y), word, font=font, fill=color)
                x += draw.textbbox((0, 0), word, font=font)[2]
    
    return img


def create_overwrite_frame(current_time, lyrics, width, height):
    """
    Create frame with TRUE overwrite-style lyrics display.
    
    3 fixed positions on screen:
    - Position 0 (top): shows lines 0, 3, 6, 9...
    - Position 1 (middle): shows lines 1, 4, 7, 10...
    - Position 2 (bottom): shows lines 2, 5, 8, 11...
    
    When a line is done being sung, the NEXT line for that position
    appears instantly. Lines don't move - content is replaced in place.
    """
    img = create_frame(width, height)
    draw = ImageDraw.Draw(img)
    
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
                color = COLOR_SUNG
            elif line_idx == current_line_idx:
                # Current line - highlight sung words
                if current_time >= word_data['start']:
                    color = COLOR_HIGHLIGHT
                else:
                    color = COLOR_TEXT
            else:
                # Upcoming lines
                color = COLOR_UPCOMING
            
            draw.text((x, y), word, font=font, fill=color)
            x += draw.textbbox((0, 0), word, font=font)[2]
    
    return img


def create_lyrics_frame(current_time, lyrics, display_mode, width, height):
    """Create frame with lyrics based on selected display mode."""
    if display_mode == 'scroll':
        return create_scroll_frame(current_time, lyrics, width, height)
    elif display_mode == 'page':
        return create_page_frame(current_time, lyrics, width, height)
    else:
        return create_overwrite_frame(current_time, lyrics, width, height)


def generate_video(audio_path, lyrics, gaps, track_info, output_path, video_quality, display_mode):
    """Generate video with lyrics and countdown"""
    print(f"🎬 Generating video (mode: {display_mode})...")
    
    if video_quality == '4k':
        width, height = 3840, 2160
    elif video_quality == '1080p':
        width, height = 1920, 1080
    else:
        width, height = 1280, 720
    
    duration = get_audio_duration(audio_path)
    total_frames = int((duration + INTRO_DURATION) * FPS)
    
    frames_dir = tempfile.mkdtemp()
    
    artist = track_info.get('artist_name', 'Unknown Artist')
    title = track_info.get('song_title', 'Unknown Title')
    
    intro_frames = int(INTRO_DURATION * FPS)
    
    # Debug: Log timing info
    print(f"   📊 Timing debug:")
    print(f"      Audio duration: {duration:.2f}s")
    print(f"      Intro duration: {INTRO_DURATION}s ({intro_frames} frames)")
    print(f"      Total frames: {total_frames}")
    if lyrics:
        print(f"      First lyric '{lyrics[0]['word']}' at {lyrics[0]['start']:.2f}s (frame {int(lyrics[0]['start'] * FPS)})")
    
    first_lyric_logged = False
    
    for frame_num in range(total_frames):
        if frame_num < intro_frames:
            frame = create_intro_frame(artist, title, frame_num, intro_frames, width, height)
        else:
            # Audio plays from frame 0, so current_time = total video time, not time since intro ended
            current_time = frame_num / FPS
            
            # Debug: Log when first lyric should appear
            if not first_lyric_logged and lyrics and current_time >= lyrics[0]['start']:
                print(f"   📊 First lyric should appear now: frame {frame_num}, current_time={current_time:.2f}s")
                first_lyric_logged = True
            
            # Just show lyrics - no countdown dots for now
            frame = create_lyrics_frame(current_time, lyrics, display_mode, width, height)
        
        frame_path = os.path.join(frames_dir, f'frame_{frame_num:06d}.png')
        frame.save(frame_path)
        
        if frame_num % 100 == 0:
            print(f"  Frame {frame_num}/{total_frames}")
    
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
        
        track_info = {
            'track_number': input_data.get('track_number', 'KT-01'),
            'artist_name': input_data.get('artist_name', 'Unknown Artist'),
            'song_title': input_data.get('song_title', 'Unknown Title'),
        }
        
        print(f"🎤 Processing project: {project_id}")
        print(f"   Type: {processing_type}")
        print(f"   Lyrics provided: {'Yes' if user_lyrics_text else 'No (auto-transcribe)'}")
        print(f"   Display mode: {display_mode}")
        print(f"   Clean version: {clean_version}")
        print(f"   Quality: {video_quality}")
        print(f"   🚀 Using AssemblyAI for precise timing!")
        
        work_dir = tempfile.mkdtemp()
        
        audio_path = os.path.join(work_dir, 'input_audio.mp3')
        print(f"📥 Downloading audio from {audio_url}")
        download_file(audio_url, audio_path)
        
        results = {}
        
        print("🎵 Starting vocal separation...")
        instrumental_path, vocals_path = separate_vocals(audio_path, work_dir)
        
        if processing_type in ['remove_vocals', 'both']:
            instrumental_key = f"processed/{project_id}/instrumental.wav"
            results['processed_audio_url'] = upload_to_r2(instrumental_path, instrumental_key)
            
            if processing_type == 'both':
                vocals_key = f"processed/{project_id}/vocals.wav"
                results['vocals_audio_url'] = upload_to_r2(vocals_path, vocals_key)
        
        elif processing_type == 'isolate_backing':
            vocals_key = f"processed/{project_id}/vocals.wav"
            results['vocals_audio_url'] = upload_to_r2(vocals_path, vocals_key)
        
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
        
        # VIDEO GENERATION
        audio_duration = get_audio_duration(audio_path)
        
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
            selected_display_mode
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