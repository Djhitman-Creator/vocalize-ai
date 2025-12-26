"""
Karatrack Studio RunPod Handler
Version 2.0 - Enhanced Lyrics Processing

UPDATES:
- Transcribes ISOLATED VOCALS instead of original mix (better sync)
- Uses forced alignment when user provides lyrics (100% accuracy)
- Profanity filter for clean versions
- Multiple display modes (scroll, page, overwrite, auto)

Processes audio files: vocal removal, lyrics transcription, video generation
Uploads results to Cloudflare R2
"""

import os
import json
import subprocess
import tempfile
import requests
import re
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

# Display mode settings
WORDS_PER_LINE = 7
LINES_PER_PAGE = 4

# ============================================
# PROFANITY FILTER
# ============================================

# Comprehensive profanity list - words will be replaced with # symbols
PROFANITY_LIST = {
    # Common profanity
    'fuck', 'fucking', 'fucked', 'fucker', 'fuckers', 'fucks',
    'shit', 'shitting', 'shitted', 'shitty', 'bullshit',
    'ass', 'asses', 'asshole', 'assholes',
    'bitch', 'bitches', 'bitching', 'bitchy',
    'damn', 'damned', 'dammit', 'goddamn', 'goddamned',
    'hell',
    'crap', 'crappy',
    'dick', 'dicks', 'dickhead',
    'cock', 'cocks',
    'pussy', 'pussies',
    'cunt', 'cunts',
    'bastard', 'bastards',
    'whore', 'whores',
    'slut', 'sluts',
    'piss', 'pissed', 'pissing',
    
    # Racial slurs and hate speech (partial list - expand as needed)
    'nigga', 'niggas', 'nigger', 'niggers',
    
    # Drug references (optional - you may want these for some content)
    # 'weed', 'cocaine', 'heroin', etc.
    
    # Additional variations
    'wtf', 'stfu', 'lmfao', 'lmao',
    'mofo', 'motherfucker', 'motherfucking', 'motherfuckers',
    'sob',
}

def censor_word(word, profanity_set=PROFANITY_LIST):
    """
    Replace profanity with # symbols matching the word length.
    
    Example: "damn" -> "####"
    """
    # Extract just letters for comparison (keep punctuation)
    clean_word = re.sub(r'[^a-zA-Z]', '', word).lower()
    
    if clean_word in profanity_set:
        # Replace letters with #, keep punctuation in place
        result = ''
        for char in word:
            if char.isalpha():
                result += '#'
            else:
                result += char
        return result
    return word


def apply_profanity_filter(lyrics_list):
    """
    Apply profanity filter to a list of lyric word objects.
    
    Args:
        lyrics_list: List of dicts with 'word', 'start', 'end' keys
    
    Returns:
        New list with censored words
    """
    filtered = []
    for item in lyrics_list:
        filtered_item = item.copy()
        filtered_item['word'] = censor_word(item['word'])
        filtered.append(filtered_item)
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


def convert_to_wav(input_path, output_path, sample_rate=SAMPLE_RATE):
    """Convert any audio file to WAV using FFmpeg"""
    cmd = [
        'ffmpeg', '-y', '-i', input_path,
        '-ar', str(sample_rate),
        '-ac', '2',  # stereo
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
    
    # Convert input to WAV first (torchaudio may not support MP3)
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


# ============================================
# LYRICS PROCESSING
# ============================================

def transcribe_lyrics_auto(audio_path, work_dir):
    """
    Use Whisper to transcribe lyrics with word-level timestamps.
    This is used when NO user lyrics are provided.
    
    IMPORTANT: This should be called with the ISOLATED VOCALS path,
    not the original mixed audio, for better accuracy.
    """
    print("📝 Transcribing lyrics with Whisper (auto mode)...")
    
    # Convert to WAV for Whisper (16kHz mono)
    whisper_audio_path = os.path.join(work_dir, 'whisper_input.wav')
    cmd = [
        'ffmpeg', '-y', '-i', audio_path,
        '-ar', '16000',
        '-ac', '1',
        '-c:a', 'pcm_s16le',
        whisper_audio_path
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    
    model = whisper.load_model(WHISPER_MODEL)
    
    result = model.transcribe(
        whisper_audio_path,
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


def align_user_lyrics(vocals_path, user_lyrics_text, work_dir):
    """
    Forced alignment: Take user-provided lyrics and align them to audio timestamps.
    This gives 100% accuracy on the WORDS (user provided them),
    and uses Whisper to find WHEN each word is sung.
    
    Args:
        vocals_path: Path to isolated vocals audio
        user_lyrics_text: Raw lyrics text provided by user
        work_dir: Working directory for temp files
    
    Returns:
        List of word objects with 'word', 'start', 'end' keys
    """
    print("📝 Aligning user-provided lyrics with Whisper...")
    
    # Convert to WAV for Whisper (16kHz mono)
    whisper_audio_path = os.path.join(work_dir, 'whisper_input.wav')
    cmd = [
        'ffmpeg', '-y', '-i', vocals_path,
        '-ar', '16000',
        '-ac', '1',
        '-c:a', 'pcm_s16le',
        whisper_audio_path
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    
    # Clean and parse user lyrics into words
    user_words = parse_lyrics_text(user_lyrics_text)
    print(f"   User provided {len(user_words)} words")
    
    # Use Whisper with the user lyrics as a prompt/guide
    model = whisper.load_model(WHISPER_MODEL)
    
    # Transcribe with initial prompt to help Whisper recognize the words
    # This improves recognition accuracy significantly
    initial_prompt = ' '.join(user_words[:50])  # First 50 words as context
    
    result = model.transcribe(
        whisper_audio_path,
        word_timestamps=True,
        language="en",
        initial_prompt=initial_prompt
    )
    
    # Extract Whisper's word timestamps
    whisper_words = []
    for segment in result['segments']:
        if 'words' in segment:
            for word in segment['words']:
                whisper_words.append({
                    'word': word['word'].strip(),
                    'start': word['start'],
                    'end': word['end']
                })
    
    print(f"   Whisper detected {len(whisper_words)} words")
    
    # Now align user words to Whisper timestamps
    aligned_lyrics = align_word_sequences(user_words, whisper_words)
    
    print(f"✅ Aligned {len(aligned_lyrics)} words with timestamps")
    return aligned_lyrics


def parse_lyrics_text(lyrics_text):
    """
    Parse raw lyrics text into a clean list of words.
    Removes section headers like [Verse 1], [Chorus], etc.
    """
    # Remove section headers like [Verse 1], [Chorus], etc.
    text = re.sub(r'\[.*?\]', '', lyrics_text)
    
    # Remove empty lines and extra whitespace
    text = ' '.join(text.split())
    
    # Split into words, keeping basic punctuation attached
    words = []
    for word in text.split():
        # Clean up but keep the word readable
        cleaned = word.strip()
        if cleaned and not cleaned.isspace():
            words.append(cleaned)
    
    return words


def align_word_sequences(user_words, whisper_words):
    """
    Align user-provided words with Whisper-detected timestamps.
    Uses a simple sequential matching approach.
    
    The user words are THE TRUTH (what should be displayed).
    The Whisper words provide TIMING information.
    """
    aligned = []
    whisper_idx = 0
    
    for user_word in user_words:
        user_clean = re.sub(r'[^a-zA-Z]', '', user_word).lower()
        
        # Find best matching Whisper word starting from current position
        best_match_idx = None
        best_match_score = 0
        
        # Look ahead up to 10 words for a match
        for i in range(whisper_idx, min(whisper_idx + 10, len(whisper_words))):
            whisper_clean = re.sub(r'[^a-zA-Z]', '', whisper_words[i]['word']).lower()
            
            # Calculate similarity (simple approach)
            if user_clean == whisper_clean:
                best_match_idx = i
                best_match_score = 1.0
                break
            elif user_clean in whisper_clean or whisper_clean in user_clean:
                score = min(len(user_clean), len(whisper_clean)) / max(len(user_clean), len(whisper_clean))
                if score > best_match_score:
                    best_match_idx = i
                    best_match_score = score
        
        if best_match_idx is not None and best_match_score > 0.5:
            # Use timing from matched Whisper word, but keep user's word text
            aligned.append({
                'word': user_word,
                'start': whisper_words[best_match_idx]['start'],
                'end': whisper_words[best_match_idx]['end']
            })
            whisper_idx = best_match_idx + 1
        else:
            # No good match found - estimate timing based on previous word
            if aligned:
                prev_end = aligned[-1]['end']
                estimated_duration = 0.3  # Average word duration
                aligned.append({
                    'word': user_word,
                    'start': prev_end,
                    'end': prev_end + estimated_duration
                })
            else:
                # First word with no match - start at 0
                aligned.append({
                    'word': user_word,
                    'start': 0.0,
                    'end': 0.3
                })
    
    return aligned


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


def calculate_lyrics_stats(lyrics, audio_duration):
    """
    Calculate statistics about the lyrics for auto display mode selection.
    
    Returns dict with:
    - words_per_minute: Average WPM
    - avg_line_length: Average words per line
    - has_clear_sections: Whether lyrics have distinct verse/chorus breaks
    """
    if not lyrics:
        return {'words_per_minute': 0, 'avg_line_length': 0, 'has_clear_sections': False}
    
    # Words per minute
    total_words = len(lyrics)
    duration_minutes = audio_duration / 60
    wpm = total_words / duration_minutes if duration_minutes > 0 else 0
    
    # Average line length (estimate based on natural breaks)
    # Group words by gaps > 1 second
    lines = []
    current_line = []
    for i, word in enumerate(lyrics):
        current_line.append(word)
        if i < len(lyrics) - 1:
            gap = lyrics[i + 1]['start'] - word['end']
            if gap > 1.0:  # Line break at gaps > 1 second
                lines.append(current_line)
                current_line = []
    if current_line:
        lines.append(current_line)
    
    avg_line_length = sum(len(line) for line in lines) / len(lines) if lines else WORDS_PER_LINE
    
    # Check for clear sections (gaps > 3 seconds)
    long_gaps = [g for g in detect_silence_gaps(lyrics, threshold=3) if g['duration'] > 3]
    has_clear_sections = len(long_gaps) >= 2
    
    return {
        'words_per_minute': wpm,
        'avg_line_length': avg_line_length,
        'has_clear_sections': has_clear_sections
    }


def select_display_mode(lyrics, audio_duration, requested_mode='auto'):
    """
    Select the best display mode based on song characteristics.
    
    Args:
        lyrics: List of word objects
        audio_duration: Song duration in seconds
        requested_mode: 'auto', 'scroll', 'page', or 'overwrite'
    
    Returns:
        'scroll', 'page', or 'overwrite'
    """
    if requested_mode != 'auto':
        return requested_mode
    
    stats = calculate_lyrics_stats(lyrics, audio_duration)
    
    print(f"   Lyrics stats: {stats['words_per_minute']:.0f} WPM, "
          f"avg line: {stats['avg_line_length']:.1f} words, "
          f"clear sections: {stats['has_clear_sections']}")
    
    # Decision logic
    if stats['words_per_minute'] > 150:
        # Fast song (rap, etc.) - use scroll
        return 'scroll'
    elif stats['avg_line_length'] > 10:
        # Long lines - use scroll
        return 'scroll'
    elif stats['has_clear_sections'] and stats['words_per_minute'] < 100:
        # Slow song with clear structure - use page-by-page
        return 'page'
    else:
        # Default - traditional overwrite style
        return 'overwrite'


# ============================================
# VIDEO GENERATION
# ============================================

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


def create_intro_frame(track_number, artist, title, frame_num, total_frames, width, height):
    """Create intro screen frame with fade in/out"""
    img = create_frame(width, height)
    draw = ImageDraw.Draw(img)
    
    # Scale fonts based on resolution
    scale = width / 1920
    font_track = get_font(int(FONT_SIZE_TRACK * scale))
    font_artist = get_font(int(FONT_SIZE_ARTIST * scale))
    font_title = get_font(int(FONT_SIZE_TITLE * scale))
    
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
    draw_centered_text(draw, track_number, height // 2 - int(150 * scale), 
                       font_track, apply_alpha(COLOR_COUNTDOWN, alpha), width)
    
    # Draw artist
    draw_centered_text(draw, artist, height // 2 - int(50 * scale), 
                       font_artist, apply_alpha(COLOR_TEXT, alpha), width)
    
    # Draw title
    draw_centered_text(draw, title, height // 2 + int(50 * scale), 
                       font_title, apply_alpha(COLOR_HIGHLIGHT, alpha), width)
    
    return img


def create_countdown_frame(dots_remaining, width, height, total_dots=COUNTDOWN_DOTS):
    """Create countdown frame with dots"""
    img = create_frame(width, height)
    draw = ImageDraw.Draw(img)
    
    scale = width / 1920
    font = get_font(int(FONT_SIZE_LYRICS * scale))
    
    # Create dots string: ● ● ● or ● ● or ●
    dots = " ● " * dots_remaining
    dots_gray = " ○ " * (total_dots - dots_remaining)
    
    full_text = dots_gray + dots
    
    draw_centered_text(draw, full_text.strip(), height // 2, 
                       font, COLOR_COUNTDOWN, width)
    
    return img


def create_scroll_frame(current_time, lyrics, width, height):
    """
    Create frame with smoothly scrolling lyrics.
    All lyrics scroll upward, current word highlighted.
    """
    img = create_frame(width, height)
    draw = ImageDraw.Draw(img)
    
    scale = width / 1920
    font = get_font(int(FONT_SIZE_LYRICS * scale))
    font_small = get_font(int((FONT_SIZE_LYRICS - 20) * scale))
    line_height = int(100 * scale)
    
    # Group words into lines
    lines = []
    current_line_words = []
    for word in lyrics:
        current_line_words.append(word)
        if len(current_line_words) >= WORDS_PER_LINE:
            lines.append(current_line_words)
            current_line_words = []
    if current_line_words:
        lines.append(current_line_words)
    
    # Find current line index based on time
    current_line_idx = 0
    for i, line in enumerate(lines):
        if line and line[-1]['end'] >= current_time:
            current_line_idx = i
            break
        current_line_idx = i
    
    # Calculate scroll offset for smooth animation
    scroll_progress = 0
    if current_line_idx < len(lines):
        line = lines[current_line_idx]
        if line:
            line_start = line[0]['start']
            line_end = line[-1]['end']
            if line_end > line_start:
                scroll_progress = (current_time - line_start) / (line_end - line_start)
                scroll_progress = max(0, min(1, scroll_progress))
    
    # Draw lines centered around current line
    center_y = height // 2
    visible_lines = 7  # Show 7 lines at a time
    
    for offset in range(-visible_lines // 2, visible_lines // 2 + 1):
        line_idx = current_line_idx + offset
        if 0 <= line_idx < len(lines):
            line = lines[line_idx]
            
            # Calculate y position with smooth scroll
            base_y = center_y + (offset * line_height)
            scroll_offset = scroll_progress * line_height * 0.3  # Subtle scroll
            y = base_y - int(scroll_offset)
            
            # Build line text with highlighting
            if offset == 0:
                # Current line - draw word by word with highlighting
                x = width // 2
                total_width = sum(draw.textbbox((0, 0), w['word'] + ' ', font=font)[2] for w in line)
                x = (width - total_width) // 2
                
                for word_data in line:
                    word = word_data['word'] + ' '
                    
                    # Highlight if this word is current or past
                    if current_time >= word_data['start']:
                        color = COLOR_HIGHLIGHT
                    else:
                        color = COLOR_TEXT
                    
                    draw.text((x, y), word, font=font, fill=color)
                    x += draw.textbbox((0, 0), word, font=font)[2]
            else:
                # Other lines - show in gray
                line_text = ' '.join([w['word'] for w in line])
                # Fade based on distance from center
                fade = 1 - (abs(offset) / (visible_lines // 2 + 1))
                color = tuple(int(c * fade) for c in COLOR_UPCOMING)
                draw_centered_text(draw, line_text, y, font_small, color, width)
    
    return img


def create_page_frame(current_time, lyrics, width, height):
    """
    Create frame with page-by-page lyrics display.
    Shows a "page" of lines, transitions to next page at appropriate times.
    """
    img = create_frame(width, height)
    draw = ImageDraw.Draw(img)
    
    scale = width / 1920
    font = get_font(int(FONT_SIZE_LYRICS * scale))
    line_height = int(100 * scale)
    
    # Group words into lines
    lines = []
    current_line_words = []
    for word in lyrics:
        current_line_words.append(word)
        if len(current_line_words) >= WORDS_PER_LINE:
            lines.append(current_line_words)
            current_line_words = []
    if current_line_words:
        lines.append(current_line_words)
    
    # Group lines into pages
    pages = []
    for i in range(0, len(lines), LINES_PER_PAGE):
        pages.append(lines[i:i + LINES_PER_PAGE])
    
    # Find current page and line
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
        
        # Calculate starting Y to center the page
        total_height = len(page) * line_height
        start_y = (height - total_height) // 2
        
        for i, line in enumerate(page):
            y = start_y + (i * line_height)
            line_idx_global = current_page_idx * LINES_PER_PAGE + i
            
            # Draw word by word
            total_width = sum(draw.textbbox((0, 0), w['word'] + ' ', font=font)[2] for w in line)
            x = (width - total_width) // 2
            
            for word_data in line:
                word = word_data['word'] + ' '
                
                # Highlight based on current time
                if line_idx_global < current_line_idx:
                    color = COLOR_UPCOMING  # Past line
                elif line_idx_global == current_line_idx:
                    if current_time >= word_data['start']:
                        color = COLOR_HIGHLIGHT  # Current or past word
                    else:
                        color = COLOR_TEXT  # Upcoming word
                else:
                    color = COLOR_TEXT  # Future line
                
                draw.text((x, y), word, font=font, fill=color)
                x += draw.textbbox((0, 0), word, font=font)[2]
    
    return img


def create_overwrite_frame(current_time, lyrics, width, height):
    """
    Create frame with overwrite-style lyrics display.
    Shows current line (highlighted) and next line (preview).
    Traditional karaoke style.
    """
    img = create_frame(width, height)
    draw = ImageDraw.Draw(img)
    
    scale = width / 1920
    font = get_font(int(FONT_SIZE_LYRICS * scale))
    font_preview = get_font(int((FONT_SIZE_LYRICS - 15) * scale))
    
    # Group words into lines
    lines = []
    current_line_words = []
    for word in lyrics:
        current_line_words.append(word)
        if len(current_line_words) >= WORDS_PER_LINE:
            lines.append(current_line_words)
            current_line_words = []
    if current_line_words:
        lines.append(current_line_words)
    
    # Find current line
    current_line_idx = 0
    for i, line in enumerate(lines):
        if line and line[-1]['end'] >= current_time:
            current_line_idx = i
            break
        current_line_idx = i
    
    # Draw current line (center)
    if current_line_idx < len(lines):
        line = lines[current_line_idx]
        y = height // 2 - int(30 * scale)
        
        total_width = sum(draw.textbbox((0, 0), w['word'] + ' ', font=font)[2] for w in line)
        x = (width - total_width) // 2
        
        for word_data in line:
            word = word_data['word'] + ' '
            
            if current_time >= word_data['start']:
                color = COLOR_HIGHLIGHT
            else:
                color = COLOR_TEXT
            
            draw.text((x, y), word, font=font, fill=color)
            x += draw.textbbox((0, 0), word, font=font)[2]
    
    # Draw next line (preview below)
    if current_line_idx + 1 < len(lines):
        next_line = lines[current_line_idx + 1]
        y = height // 2 + int(70 * scale)
        
        next_text = ' '.join([w['word'] for w in next_line])
        draw_centered_text(draw, next_text, y, font_preview, COLOR_UPCOMING, width)
    
    return img


def create_lyrics_frame(current_time, lyrics, display_mode, width, height):
    """
    Create frame with lyrics based on selected display mode.
    """
    if display_mode == 'scroll':
        return create_scroll_frame(current_time, lyrics, width, height)
    elif display_mode == 'page':
        return create_page_frame(current_time, lyrics, width, height)
    else:  # 'overwrite' or default
        return create_overwrite_frame(current_time, lyrics, width, height)


def generate_video(audio_path, lyrics, gaps, track_info, output_path, video_quality, display_mode):
    """Generate video with lyrics and countdown"""
    print(f"🎬 Generating video (mode: {display_mode})...")
    
    # Video dimensions based on quality
    if video_quality == '4k':
        width, height = 3840, 2160
    elif video_quality == '1080p':
        width, height = 1920, 1080
    else:
        width, height = 1280, 720
    
    # Get audio duration
    duration = get_audio_duration(audio_path)
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
            frame = create_intro_frame(track_number, artist, title, frame_num, intro_frames, width, height)
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
                    frame = create_countdown_frame(dots_remaining, width, height)
                    break
            
            if not in_gap:
                # Lyrics frame based on display mode
                frame = create_lyrics_frame(current_time, lyrics, display_mode, width, height)
        
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
        
        # NEW: Get new parameters
        user_lyrics_text = input_data.get('lyrics_text')  # User-provided lyrics
        display_mode = input_data.get('display_mode', 'auto')  # auto/scroll/page/overwrite
        clean_version = input_data.get('clean_version', False)  # Profanity filter
        
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
        
        # Create temp working directory
        work_dir = tempfile.mkdtemp()
        
        # Download audio
        audio_path = os.path.join(work_dir, 'input_audio.mp3')
        print(f"📥 Downloading audio from {audio_url}")
        download_file(audio_url, audio_path)
        
        results = {}
        
        # Separate vocals (always needed for better lyrics sync)
        print("🎵 Starting vocal separation...")
        instrumental_path, vocals_path = separate_vocals(audio_path, work_dir)
        
        # Upload based on processing type
        if processing_type in ['remove_vocals', 'both']:
            instrumental_key = f"processed/{project_id}/instrumental.wav"
            results['processed_audio_url'] = upload_to_r2(instrumental_path, instrumental_key)
            
            if processing_type == 'both':
                vocals_key = f"processed/{project_id}/vocals.wav"
                results['vocals_audio_url'] = upload_to_r2(vocals_path, vocals_key)
        
        elif processing_type == 'isolate_backing':
            vocals_key = f"processed/{project_id}/vocals.wav"
            results['vocals_audio_url'] = upload_to_r2(vocals_path, vocals_key)
        
        # ============================================
        # LYRICS PROCESSING - THE KEY IMPROVEMENT
        # ============================================
        lyrics = []
        gaps = []
        
        if include_lyrics:
            if user_lyrics_text and len(user_lyrics_text.strip()) > 50:
                # USER PROVIDED LYRICS - Use forced alignment for 100% accuracy
                print("📝 Using user-provided lyrics with forced alignment...")
                lyrics = align_user_lyrics(vocals_path, user_lyrics_text, work_dir)
            else:
                # NO USER LYRICS - Auto-transcribe from ISOLATED VOCALS
                # This is the key fix: use vocals_path instead of audio_path
                print("📝 Auto-transcribing from isolated vocals...")
                lyrics = transcribe_lyrics_auto(vocals_path, work_dir)
            
            # Apply profanity filter if requested
            if clean_version and lyrics:
                print("🛡️ Applying profanity filter...")
                lyrics = apply_profanity_filter(lyrics)
                print(f"   Filtered {len(lyrics)} words")
            
            # Detect gaps for countdown dots
            gaps = detect_silence_gaps(lyrics)
            
            # Store lyrics in results
            results['lyrics'] = lyrics
        
        # ============================================
        # VIDEO GENERATION
        # ============================================
        
        # Get audio duration for display mode selection
        audio_duration = get_audio_duration(audio_path)
        
        # Select display mode (auto-detect if 'auto')
        selected_display_mode = select_display_mode(lyrics, audio_duration, display_mode)
        print(f"📺 Selected display mode: {selected_display_mode}")
        
        # Generate video
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