"""
Karatrack Studio RunPod Handler
Version 2.2 - Teleprompter Style Updates

CHANGES IN v2.2:
- Added more profanity words (suck, balls, etc.)
- Teleprompter-style scroll: all text same size, smooth uniform scroll
- Added left/right padding so lyrics don't go edge to edge
- Countdown dots now show ABOVE the upcoming lyrics (preview)

PREVIOUS FIXES (v2.1):
- Removed track number from intro screen (only shows Artist and Title)
- Changed countdown threshold from 3 to 5 seconds
- Only show countdown dots for intros 10+ seconds
- Fixed profanity filter not detecting words

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
FONT_SIZE_LYRICS = 64  # Slightly smaller for teleprompter style
FONT_SIZE_TITLE = 96
FONT_SIZE_ARTIST = 64
FONT_SIZE_COUNTDOWN = 80

# Layout settings - NEW
PADDING_LEFT_RIGHT = 100  # Pixels of padding on each side
LINE_HEIGHT_MULTIPLIER = 1.4  # Space between lines

# Colors (RGB)
COLOR_BG = (10, 10, 20)
COLOR_TEXT = (255, 255, 255)
COLOR_HIGHLIGHT = (0, 255, 255)  # Cyan for current word
COLOR_SUNG = (100, 200, 200)  # Dimmed cyan for already sung words
COLOR_UPCOMING = (200, 200, 200)  # Light gray for upcoming lines
COLOR_COUNTDOWN = (255, 200, 0)  # Gold for countdown dots

# Timing
INTRO_DURATION = 5  # seconds for title screen
COUNTDOWN_THRESHOLD = 5  # seconds - gaps longer than this get countdown
INTRO_COUNTDOWN_THRESHOLD = 10  # Only show countdown for intros 10+ seconds
COUNTDOWN_DOTS = 3

# Display mode settings
WORDS_PER_LINE = 7
LINES_PER_PAGE = 4

# ============================================
# PROFANITY FILTER - EXPANDED
# ============================================

# Comprehensive profanity list - words will be replaced with # symbols
PROFANITY_LIST = {
    # Common profanity - all lowercase for matching
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
    
    # NEW - Added words
    'suck', 'sucks', 'sucked', 'sucking', 'sucker', 'suckers',
    'balls', 'ballsack',
    'boob', 'boobs', 'boobie', 'boobies',
    'tit', 'tits', 'titty', 'titties',
    'nut', 'nuts', 'nutsack',
    'screw', 'screwed', 'screwing',
    'cocked',
    'jackass', 'dumbass', 'fatass', 'smartass',
    'bloody',
    'bugger',
    'bollocks',
    'wanker', 'wankers',
    'tosser',
    'twat', 'twats',
    'arsehole', 'arse',
    'skank', 'skanky',
    'douche', 'douchebag', 'douchy',
    'fap', 'fapping',
    'jizz',
    'spunk',
    'dildo',
    'butthole',
    'blowjob',
    'handjob',
    'rimjob',
    
    # Racial slurs and hate speech
    'nigga', 'niggas', 'nigger', 'niggers',
    'spic', 'spics',
    'chink', 'chinks',
    'wetback', 'wetbacks',
    'kike', 'kikes',
    'fag', 'fags', 'faggot', 'faggots',
    'dyke', 'dykes',
    'tranny', 'trannies',
    'retard', 'retarded', 'retards',
    
    # Additional variations
    'wtf', 'stfu', 'lmfao', 'lmao',
    'mofo', 'motherfucker', 'motherfucking', 'motherfuckers', 'muthafucka', 'muthafuckin',
    'sob',
    'hoe', 'hoes',
    'thot', 'thots',
    'biatch',
    'beotch',
    'effing',
    'frigging', 'freakin', 'freaking',
}

def censor_word(word):
    """
    Replace profanity with # symbols matching the word length.
    
    Example: "damn" -> "####"
    """
    if not word:
        return word
    
    # Extract just letters for comparison
    clean_word = re.sub(r'[^a-zA-Z\']', '', word).lower()
    
    # Check if the clean word is in our profanity list
    if clean_word in PROFANITY_LIST:
        # Replace letters with #, keep punctuation in place
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
    """
    Apply profanity filter to a list of lyric word objects.
    
    Args:
        lyrics_list: List of dicts with 'word', 'start', 'end' keys
    
    Returns:
        New list with censored words
    """
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
        cleaned = word.strip()
        if cleaned and not cleaned.isspace():
            words.append(cleaned)
    
    return words


def align_word_sequences(user_words, whisper_words):
    """
    Align user-provided words with Whisper-detected timestamps.
    Uses a simple sequential matching approach.
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
            aligned.append({
                'word': user_word,
                'start': whisper_words[best_match_idx]['start'],
                'end': whisper_words[best_match_idx]['end']
            })
            whisper_idx = best_match_idx + 1
        else:
            if aligned:
                prev_end = aligned[-1]['end']
                estimated_duration = 0.3
                aligned.append({
                    'word': user_word,
                    'start': prev_end,
                    'end': prev_end + estimated_duration
                })
            else:
                aligned.append({
                    'word': user_word,
                    'start': 0.0,
                    'end': 0.3
                })
    
    return aligned


def detect_silence_gaps(lyrics, intro_threshold=INTRO_COUNTDOWN_THRESHOLD, mid_threshold=COUNTDOWN_THRESHOLD):
    """
    Find gaps in lyrics where countdown should appear.
    """
    gaps = []
    
    if not lyrics:
        return gaps
    
    # Check gap at start - only show countdown if >= 10 seconds
    if lyrics[0]['start'] >= intro_threshold:
        gaps.append({
            'start': 0,
            'end': lyrics[0]['start'],
            'duration': lyrics[0]['start'],
            'is_intro': True
        })
    
    # Check gaps between words - use 5 seconds threshold
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
# VIDEO GENERATION - UPDATED FOR TELEPROMPTER
# ============================================

def create_frame(width, height, bg_color=COLOR_BG):
    """Create a blank frame"""
    img = Image.new('RGB', (width, height), bg_color)
    return img


def draw_centered_text(draw, text, y, font, color, width, padding=PADDING_LEFT_RIGHT):
    """Draw centered text with padding"""
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    
    # Ensure text fits within padding
    max_width = width - (2 * padding)
    x = (width - text_width) // 2
    
    # Clamp x to respect padding
    x = max(padding, x)
    
    draw.text((x, y), text, font=font, fill=color)


def get_font(size):
    """Get font, fallback to default if custom not available"""
    try:
        return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", size)
    except:
        return ImageFont.load_default()


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
    """
    Create countdown frame with dots AND preview of upcoming lyrics below.
    
    NEW: Shows countdown dots at top, then the first few lines of upcoming lyrics
    so the singer can prepare.
    """
    img = create_frame(width, height)
    draw = ImageDraw.Draw(img)
    
    scale = width / 1920
    font_countdown = get_font(int(FONT_SIZE_COUNTDOWN * scale))
    font_lyrics = get_font(int(FONT_SIZE_LYRICS * scale))
    line_height = int(FONT_SIZE_LYRICS * LINE_HEIGHT_MULTIPLIER * scale)
    padding = int(PADDING_LEFT_RIGHT * scale)
    
    # Draw countdown dots at top area
    dots = " ● " * dots_remaining
    dots_gray = " ○ " * (total_dots - dots_remaining)
    full_text = dots_gray + dots
    
    # Position dots in upper third of screen
    dots_y = height // 4
    draw_centered_text(draw, full_text.strip(), dots_y, font_countdown, COLOR_COUNTDOWN, width)
    
    # Now show preview of upcoming lyrics below the dots
    # Find the lyrics that start at or after gap_end_time
    upcoming_words = [w for w in lyrics if w['start'] >= gap_end_time - 0.5]
    
    if upcoming_words:
        # Group into lines
        lines = []
        current_line = []
        for word in upcoming_words:
            current_line.append(word)
            if len(current_line) >= WORDS_PER_LINE:
                lines.append(current_line)
                current_line = []
                if len(lines) >= 4:  # Show max 4 preview lines
                    break
        if current_line and len(lines) < 4:
            lines.append(current_line)
        
        # Draw preview lines starting below the dots
        preview_start_y = height // 2  # Start at middle
        
        for i, line in enumerate(lines[:4]):  # Max 4 lines
            y = preview_start_y + (i * line_height)
            line_text = ' '.join([w['word'] for w in line])
            
            # First line brighter (what's coming next), others dimmer
            if i == 0:
                color = COLOR_TEXT
            else:
                fade = 1 - (i * 0.2)
                color = tuple(int(c * fade) for c in COLOR_UPCOMING)
            
            draw_centered_text(draw, line_text, y, font_lyrics, color, width, padding)
    
    return img


def group_lyrics_into_lines(lyrics, words_per_line=WORDS_PER_LINE):
    """Helper function to group lyrics into display lines"""
    lines = []
    current_line = []
    
    for word in lyrics:
        current_line.append(word)
        if len(current_line) >= words_per_line:
            lines.append(current_line)
            current_line = []
    
    if current_line:
        lines.append(current_line)
    
    return lines


def create_scroll_frame(current_time, lyrics, width, height):
    """
    Create TELEPROMPTER-STYLE scrolling lyrics frame.
    
    UPDATED v2.2:
    - All text same font size (no smaller font for other lines)
    - Left/right padding so text doesn't go edge to edge
    - Smooth continuous scroll
    - Current word highlighted, sung words slightly dimmed
    - All visible lines are readable
    """
    img = create_frame(width, height)
    draw = ImageDraw.Draw(img)
    
    scale = width / 1920
    font = get_font(int(FONT_SIZE_LYRICS * scale))
    line_height = int(FONT_SIZE_LYRICS * LINE_HEIGHT_MULTIPLIER * scale)
    padding = int(PADDING_LEFT_RIGHT * scale)
    
    # Available width for text
    text_area_width = width - (2 * padding)
    
    # Group words into lines
    lines = group_lyrics_into_lines(lyrics)
    
    if not lines:
        return img
    
    # Find current line index based on time
    current_line_idx = 0
    for i, line in enumerate(lines):
        if line and line[-1]['end'] >= current_time:
            current_line_idx = i
            break
        current_line_idx = i
    
    # Calculate smooth scroll offset
    scroll_progress = 0
    if current_line_idx < len(lines):
        line = lines[current_line_idx]
        if line:
            line_start = line[0]['start']
            line_end = line[-1]['end']
            if line_end > line_start:
                scroll_progress = (current_time - line_start) / (line_end - line_start)
                scroll_progress = max(0, min(1, scroll_progress))
    
    # Number of visible lines
    visible_lines = 9  # Show more lines for teleprompter feel
    
    # Center point for current line
    center_y = height // 2
    
    # Draw all visible lines with SAME font size
    for offset in range(-visible_lines // 2, visible_lines // 2 + 1):
        line_idx = current_line_idx + offset
        
        if 0 <= line_idx < len(lines):
            line = lines[line_idx]
            
            # Calculate y position with smooth scroll
            base_y = center_y + (offset * line_height)
            scroll_offset = scroll_progress * line_height
            y = base_y - int(scroll_offset)
            
            # Skip if outside visible area
            if y < -line_height or y > height + line_height:
                continue
            
            # Calculate total line width to center it
            total_width = sum(draw.textbbox((0, 0), w['word'] + ' ', font=font)[2] for w in line)
            x = (width - total_width) // 2
            x = max(padding, x)  # Respect left padding
            
            # Draw each word
            for word_data in line:
                word = word_data['word'] + ' '
                word_width = draw.textbbox((0, 0), word, font=font)[2]
                
                # Determine color based on timing
                if line_idx < current_line_idx:
                    # Past line - dimmed
                    color = COLOR_SUNG
                elif line_idx == current_line_idx:
                    # Current line - highlight current/past words
                    if current_time >= word_data['start']:
                        color = COLOR_HIGHLIGHT  # Current or sung word
                    else:
                        color = COLOR_TEXT  # Upcoming word in current line
                else:
                    # Future line - normal white
                    color = COLOR_UPCOMING
                
                # Check if word fits within right padding
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
    """Create frame with overwrite-style lyrics display."""
    img = create_frame(width, height)
    draw = ImageDraw.Draw(img)
    
    scale = width / 1920
    font = get_font(int(FONT_SIZE_LYRICS * scale))
    font_preview = get_font(int((FONT_SIZE_LYRICS - 10) * scale))
    padding = int(PADDING_LEFT_RIGHT * scale)
    
    lines = group_lyrics_into_lines(lyrics)
    
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
        x = max(padding, x)
        
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
        draw_centered_text(draw, next_text, y, font_preview, COLOR_UPCOMING, width, padding)
    
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
    
    for frame_num in range(total_frames):
        if frame_num < intro_frames:
            frame = create_intro_frame(artist, title, frame_num, intro_frames, width, height)
        else:
            current_time = (frame_num - intro_frames) / FPS
            
            # Check if we're in a countdown gap
            in_gap = False
            for gap in gaps:
                if gap['start'] <= current_time < gap['end']:
                    in_gap = True
                    time_until_lyrics = gap['end'] - current_time
                    dots_remaining = min(COUNTDOWN_DOTS, int(time_until_lyrics) + 1)
                    
                    # NEW: Use countdown with preview instead of plain countdown
                    frame = create_countdown_frame_with_preview(
                        dots_remaining, width, height, lyrics, gap['end']
                    )
                    break
            
            if not in_gap:
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
        
        # LYRICS PROCESSING
        lyrics = []
        gaps = []
        
        if include_lyrics:
            if user_lyrics_text and len(user_lyrics_text.strip()) > 50:
                print("📝 Using user-provided lyrics with forced alignment...")
                lyrics = align_user_lyrics(vocals_path, user_lyrics_text, work_dir)
            else:
                print("📝 Auto-transcribing from isolated vocals...")
                lyrics = transcribe_lyrics_auto(vocals_path, work_dir)
            
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