"""
Karatrack Studio RunPod Handler
Version 5.0 - Video Background Support

Uses AssemblyAI API for word-level timestamps (~50ms accuracy)
No more dependency hell - simple REST API call

NEW in 4.1: Normalized lyrics comparison ignores punctuation & capitalization
NEW in 5.0: Video background support (presets and custom uploads)

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
import cv2  # For video background processing

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
COUNTDOWN_THRESHOLD = 3  # Show countdown for gaps >= 3 seconds
INTRO_COUNTDOWN_THRESHOLD = 3  # Show countdown for intros >= 3 seconds
COUNTDOWN_DOTS = 6  # 6 dots, one lights up every 0.5 seconds = 3 second countdown
COUNTDOWN_DOT_INTERVAL = 0.5  # Seconds between each dot lighting up
FADEOUT_DURATION = 3  # Seconds to fade out lyrics at end
OUTRO_TEXT_FADE_IN = 1.0  # Seconds to fade in outro text

# Display mode settings
WORDS_PER_LINE = 7
LINES_PER_PAGE = 4

# Watermark settings for free tier
WATERMARK_LOGO_URL = os.environ.get('WATERMARK_LOGO_URL', '')
WATERMARK_TEXT = "Karatrack.com"
WATERMARK_OPACITY = 0.7  # 70% opacity
WATERMARK_LOGO_SIZE = 80  # Width in pixels (height scales proportionally)
WATERMARK_PADDING = 20  # Padding from edges

# Video background settings (NEW in 5.0)
PRESET_VIDEOS_BASE_URL = os.environ.get('PRESET_VIDEOS_BASE_URL', 'https://pub-71dae0f9e45e4d8e8d1eedd472780341.r2.dev/presets')

# ============================================
# VIDEO BACKGROUND FUNCTIONS (NEW in 5.0)
# ============================================

class VideoBackgroundReader:
    """
    Manages reading frames from a video background file.
    Handles looping for videos shorter than audio duration.
    """
    
    def __init__(self, video_path, target_width, target_height, target_fps=30):
        """
        Initialize video reader.
        
        Args:
            video_path: Path to video file
            target_width: Desired output width
            target_height: Desired output height
            target_fps: Target FPS (default 30)
        """
        self.video_path = video_path
        self.target_width = target_width
        self.target_height = target_height
        self.target_fps = target_fps
        
        # Open the video
        self.cap = cv2.VideoCapture(video_path)
        if not self.cap.isOpened():
            raise ValueError(f"Could not open video: {video_path}")
        
        # Get video properties
        self.source_fps = self.cap.get(cv2.CAP_PROP_FPS)
        self.source_width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        self.source_height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        self.total_frames = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT))
        self.duration = self.total_frames / self.source_fps if self.source_fps > 0 else 0
        
        # Cache for frames (optional, for small videos)
        self.frame_cache = {}
        self.cache_enabled = self.total_frames < 300  # Cache videos under 10 sec at 30fps
        
        print(f"   📹 Video background loaded: {self.source_width}x{self.source_height} @ {self.source_fps:.1f}fps, {self.duration:.1f}s")
    
    def get_frame_at_time(self, time_seconds):
        """
        Get a frame at a specific time, handling looping.
        
        Args:
            time_seconds: Time position in seconds
            
        Returns:
            PIL Image of the frame, resized to target dimensions
        """
        # Loop the video if time exceeds duration
        if self.duration > 0:
            time_seconds = time_seconds % self.duration
        
        # Convert time to source frame number
        source_frame_num = int(time_seconds * self.source_fps)
        source_frame_num = max(0, min(source_frame_num, self.total_frames - 1))
        
        # Check cache first
        if self.cache_enabled and source_frame_num in self.frame_cache:
            return self.frame_cache[source_frame_num].copy()
        
        # Seek to frame
        self.cap.set(cv2.CAP_PROP_POS_FRAMES, source_frame_num)
        ret, frame = self.cap.read()
        
        if not ret:
            # Try to loop back to beginning
            self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ret, frame = self.cap.read()
            if not ret:
                # Return black frame as fallback
                return Image.new('RGB', (self.target_width, self.target_height), (0, 0, 0))
        
        # Convert BGR to RGB
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Convert to PIL Image
        pil_frame = Image.fromarray(frame_rgb)
        
        # Resize to target dimensions (cover mode - crop to fit)
        pil_frame = self._resize_cover(pil_frame)
        
        # Cache if enabled
        if self.cache_enabled:
            self.frame_cache[source_frame_num] = pil_frame.copy()
        
        return pil_frame
    
    def _resize_cover(self, img):
        """
        Resize image to cover target dimensions (may crop).
        Similar to CSS background-size: cover
        """
        img_ratio = img.width / img.height
        target_ratio = self.target_width / self.target_height
        
        if img_ratio > target_ratio:
            # Image is wider - fit height, crop width
            new_height = self.target_height
            new_width = int(new_height * img_ratio)
        else:
            # Image is taller - fit width, crop height
            new_width = self.target_width
            new_height = int(new_width / img_ratio)
        
        # Resize
        img_resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # Center crop
        left = (new_width - self.target_width) // 2
        top = (new_height - self.target_height) // 2
        right = left + self.target_width
        bottom = top + self.target_height
        
        return img_resized.crop((left, top, right, bottom))
    
    def close(self):
        """Release video resources."""
        if self.cap:
            self.cap.release()
        self.frame_cache.clear()
    
    def __del__(self):
        self.close()


def download_video_background(bg_type, bg_video_preset, bg_video_url, work_dir):
    """
    Download video background from preset or custom URL.
    
    Args:
        bg_type: 'video', 'image', 'color', or 'gradient'
        bg_video_preset: Preset video filename (e.g., 'bg-abstract-smokecurling.mp4')
        bg_video_url: Custom video URL (for user uploads)
        work_dir: Working directory for downloads
        
    Returns:
        Path to downloaded video file, or None if not a video background
    """
    if bg_type != 'video':
        return None
    
    video_path = os.path.join(work_dir, 'background_video.mp4')
    
    if bg_video_preset:
        # Download preset video
        preset_url = f"{PRESET_VIDEOS_BASE_URL}/{bg_video_preset}"
        print(f"   📥 Downloading preset video background: {bg_video_preset}")
        download_file(preset_url, video_path)
        print(f"   ✅ Preset video downloaded")
        return video_path
    
    elif bg_video_url:
        # Download custom video
        print(f"   📥 Downloading custom video background...")
        download_file(bg_video_url, video_path)
        print(f"   ✅ Custom video downloaded")
        return video_path
    
    return None


def download_image_background(bg_type, bg_image_url, work_dir, target_width, target_height):
    """
    Download and prepare image background.
    
    Args:
        bg_type: Background type
        bg_image_url: URL to background image
        work_dir: Working directory
        target_width: Video width
        target_height: Video height
        
    Returns:
        PIL Image resized to target dimensions, or None
    """
    if bg_type != 'image' or not bg_image_url:
        return None
    
    try:
        print(f"   📥 Downloading image background...")
        image_path = os.path.join(work_dir, 'background_image.jpg')
        download_file(bg_image_url, image_path)
        
        # Load and resize
        img = Image.open(image_path).convert('RGB')
        
        # Cover resize (same as video)
        img_ratio = img.width / img.height
        target_ratio = target_width / target_height
        
        if img_ratio > target_ratio:
            new_height = target_height
            new_width = int(new_height * img_ratio)
        else:
            new_width = target_width
            new_height = int(new_width / img_ratio)
        
        img_resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # Center crop
        left = (new_width - target_width) // 2
        top = (new_height - target_height) // 2
        right = left + target_width
        bottom = top + target_height
        
        final_img = img_resized.crop((left, top, right, bottom))
        print(f"   ✅ Image background prepared: {target_width}x{target_height}")
        return final_img
        
    except Exception as e:
        print(f"   ⚠️ Failed to load image background: {e}")
        return None


# ============================================
# LYRICS NORMALIZATION FUNCTIONS (NEW in 4.1)
# ============================================

def normalize_word_for_comparison(word):
    """
    Normalize a word for comparison purposes.
    Removes punctuation, converts to lowercase.
    
    Examples:
        "That's" -> "thats"
        "name," -> "name"
        "Hello!" -> "hello"
        "don't" -> "dont"
    """
    if not word:
        return ""
    
    # Convert to lowercase
    word = word.lower()
    
    # Remove all punctuation (keep only letters and numbers)
    # This handles: apostrophes, commas, periods, exclamation marks, etc.
    normalized = re.sub(r"[^a-z0-9]", "", word)
    
    return normalized


def words_match_normalized(word1, word2):
    """
    Check if two words match after normalization.
    
    Examples:
        "That's" vs "thats" -> True
        "Name," vs "name" -> True  
        "Hello!" vs "HELLO" -> True
        "don't" vs "dont" -> True
        "cat" vs "dog" -> False
    """
    return normalize_word_for_comparison(word1) == normalize_word_for_comparison(word2)


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
        print(f"Ã¢Å“â€¦ Uploaded to R2: {url}")
        return url
        
    except Exception as e:
        print(f"Ã¢ÂÅ’ R2 upload error: {str(e)}")
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


# Font file mapping - maps font names to file paths
# These fonts need to be installed in the Docker container
FONT_PATHS = {
    'arial': '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',  # Arial-like fallback
    'roboto': '/usr/share/fonts/custom/Roboto-Bold.ttf',
    'poppins': '/usr/share/fonts/custom/Poppins-Bold.ttf',
    'montserrat': '/usr/share/fonts/custom/Montserrat-Bold.ttf',
    'oswald': '/usr/share/fonts/custom/Oswald-Bold.ttf',
    'playfair': '/usr/share/fonts/custom/PlayfairDisplay-Bold.ttf',
    'bebas': '/usr/share/fonts/custom/BebasNeue-Regular.ttf',
    'impact': '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',  # Impact fallback to DejaVu
}

# Google Fonts download URLs
FONT_URLS = {
    'roboto': 'https://github.com/googlefonts/roboto/raw/main/src/hinted/Roboto-Bold.ttf',
    'poppins': 'https://github.com/itfoundry/Poppins/raw/master/products/Poppins-Bold.ttf',
    'montserrat': 'https://github.com/JulietaUla/Montserrat/raw/master/fonts/ttf/Montserrat-Bold.ttf',
    'oswald': 'https://github.com/googlefonts/OswaldFont/raw/main/fonts/ttf/Oswald-Bold.ttf',
    'playfair': 'https://github.com/clauseggers/Playfair-Display/raw/master/fonts/PlayfairDisplay-Bold.ttf',
    'bebas': 'https://github.com/dharmatype/Bebas-Neue/raw/master/fonts/BebasNeue-Regular.ttf',
}

# Default fallback font
DEFAULT_FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

# Cache for loaded fonts
_font_cache = {}
_fonts_initialized = False

def ensure_fonts_directory():
    """Create custom fonts directory if it doesn't exist."""
    font_dir = '/usr/share/fonts/custom'
    if not os.path.exists(font_dir):
        os.makedirs(font_dir, exist_ok=True)
    return font_dir

def download_font(font_name):
    """Download a font if it's not installed."""
    if font_name not in FONT_URLS:
        return None
    
    font_path = FONT_PATHS.get(font_name)
    if font_path and os.path.exists(font_path):
        return font_path
    
    try:
        ensure_fonts_directory()
        url = FONT_URLS[font_name]
        font_path = FONT_PATHS[font_name]
        
        print(f"   Ã°Å¸â€œÂ¥ Downloading font: {font_name}...")
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        
        with open(font_path, 'wb') as f:
            f.write(response.content)
        
        print(f"   Ã¢Å“â€¦ Font downloaded: {font_name}")
        return font_path
    except Exception as e:
        print(f"   Ã¢Å¡Â Ã¯Â¸Â Failed to download font {font_name}: {e}")
        return None

def initialize_fonts():
    """Pre-download all custom fonts."""
    global _fonts_initialized
    if _fonts_initialized:
        return
    
    print("Ã°Å¸â€Â¤ Initializing fonts...")
    ensure_fonts_directory()
    
    for font_name in FONT_URLS.keys():
        font_path = FONT_PATHS.get(font_name)
        if not font_path or not os.path.exists(font_path):
            download_font(font_name)
    
    _fonts_initialized = True
    print("Ã¢Å“â€¦ Fonts initialized")

def get_font(size, font_name='arial', custom_font_path=None):
    """Get font by name with fallback to default. Supports custom font path."""
    
    # If custom font path provided, use it directly
    if custom_font_path and os.path.exists(custom_font_path):
        cache_key = f"custom_{custom_font_path}_{size}"
        if cache_key in _font_cache:
            return _font_cache[cache_key]
        try:
            font = ImageFont.truetype(custom_font_path, size)
            _font_cache[cache_key] = font
            print(f"   Using custom font: {custom_font_path}")
            return font
        except Exception as e:
            print(f"   Custom font failed ({e}), falling back to default...")
    
    cache_key = f"{font_name}_{size}"
    
    if cache_key in _font_cache:
        return _font_cache[cache_key]
    
    # Try the requested font
    font_path = FONT_PATHS.get(font_name, DEFAULT_FONT)
    
    # If font doesn't exist, try to download it
    if not os.path.exists(font_path) and font_name in FONT_URLS:
        downloaded_path = download_font(font_name)
        if downloaded_path:
            font_path = downloaded_path
    
    try:
        font = ImageFont.truetype(font_path, size)
        _font_cache[cache_key] = font
        return font
    except Exception as e:
        print(f"   Font '{font_name}' failed ({e}), using fallback...")
    
    # Fallback to default
    try:
        font = ImageFont.truetype(DEFAULT_FONT, size)
        _font_cache[cache_key] = font
        return font
    except:
        return ImageFont.load_default()


def download_custom_font(custom_font_url, work_dir):
    """Download a custom font from URL to work directory."""
    if not custom_font_url:
        return None
    
    try:
        print(f"   Downloading custom font from {custom_font_url}")
        
        # Determine extension from URL
        if '.otf' in custom_font_url.lower():
            ext = '.otf'
        else:
            ext = '.ttf'
        
        font_path = os.path.join(work_dir, f'custom_font{ext}')
        
        response = requests.get(custom_font_url, timeout=30)
        response.raise_for_status()
        
        with open(font_path, 'wb') as f:
            f.write(response.content)
        
        print(f"   Custom font downloaded: {font_path}")
        return font_path
    except Exception as e:
        print(f"   Failed to download custom font: {e}")
        return None


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
    print(f"   Ã¢Å“â€¦ Audio with silence created: {output_path}")
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
        print("   Ã¢Å¡Â Ã¯Â¸Â No watermark logo URL configured")
        return None
    
    try:
        print(f"   Ã°Å¸â€œÂ¥ Downloading watermark logo from {WATERMARK_LOGO_URL}")
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
        print(f"   Ã¢Å“â€¦ Watermark logo loaded ({new_width}x{new_height})")
        return logo
        
    except Exception as e:
        print(f"   Ã¢Å¡Â Ã¯Â¸Â Failed to load watermark logo: {e}")
        return None


def get_custom_watermark(url):
    """Download and cache a custom watermark logo"""
    global _custom_watermark_cache
    
    if not url:
        return None
    
    if url in _custom_watermark_cache:
        return _custom_watermark_cache[url]
    
    try:
        print(f"   Ã°Å¸â€œÂ¥ Downloading custom watermark from {url}")
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
        print(f"   Ã¢Å“â€¦ Custom watermark loaded ({new_width}x{new_height})")
        return logo
        
    except Exception as e:
        print(f"   Ã¢Å¡Â Ã¯Â¸Â Failed to load custom watermark: {e}")
        return None


def apply_watermark(frame, video_width, video_height):
    """Apply watermark (logo at bottom-left, text at bottom-center) to frame"""
    
    # Get logo
    logo = get_watermark_logo()
    
    # Create a copy of the frame to work with
    watermarked = frame.copy()
    
    # Prepare to draw text
    draw = ImageDraw.Draw(watermarked)
    font = get_font(20, 'arial', None)  # Smaller font for watermark text
    
    # Calculate text size
    text_bbox = draw.textbbox((0, 0), WATERMARK_TEXT, font=font)
    text_width = text_bbox[2] - text_bbox[0]
    text_height = text_bbox[3] - text_bbox[1]
    
    # Bottom margin for both logo and text
    bottom_margin = WATERMARK_PADDING + 15  # Safe margin from bottom edge
    
    if logo:
        # Position logo at bottom-left
        logo_x = WATERMARK_PADDING
        logo_y = video_height - bottom_margin - logo.height
        
        # Create semi-transparent version of logo
        logo_with_opacity = logo.copy()
        alpha = logo_with_opacity.split()[3]
        alpha = alpha.point(lambda p: int(p * WATERMARK_OPACITY))
        logo_with_opacity.putalpha(alpha)
        
        # Paste logo onto frame
        watermarked.paste(logo_with_opacity, (logo_x, logo_y), logo_with_opacity)
    
    # Position text at BOTTOM CENTER
    text_x = (video_width - text_width) // 2  # Center horizontally
    text_y = video_height - bottom_margin - text_height  # Same bottom margin as logo
    
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
    print("Ã°Å¸Å½Âµ Separating vocals with Demucs...")
    
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
    
    print("Ã¢Å“â€¦ Vocal separation complete")
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
    print("Ã°Å¸â€œÂ Transcribing with AssemblyAI (precise alignment)...")
    
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
            print("   Ã¢Å“â€¦ Transcription complete!")
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
                'end': end,
                'confidence': word_info.get('confidence', 1.0)
            })
    
    print(f"Ã¢Å“â€¦ AssemblyAI returned {len(lyrics)} words with precise timestamps")
    
    # Debug: Show first 5 words and their timestamps
    print("   Ã°Å¸â€œÅ  First 5 words timing:")
    for i, w in enumerate(lyrics[:5]):
        print(f"      {i+1}. '{w['word']}' at {w['start']:.2f}s - {w['end']:.2f}s")
    
    # If user provided lyrics, auto-correct low-confidence words first
    if user_lyrics_text and len(user_lyrics_text.strip()) > 50:
        print("ðŸ” Checking for low-confidence words to auto-correct...")
        lyrics, correction_count = auto_correct_low_confidence_words(lyrics, user_lyrics_text)
        
        print("ðŸ“ Mapping user lyrics to AssemblyAI timestamps...")
        lyrics = align_user_lyrics_to_timestamps(user_lyrics_text, lyrics)

        # Debug: Show first 10 aligned words with gap analysis
        print("   ðŸ“Š First 10 aligned words timing:")
        for i, w in enumerate(lyrics[:10]):
            gap_info = ""
            if i > 0:
                gap = w['start'] - lyrics[i-1]['end']
                if gap > 0.5:
                    gap_info = f" âš ï¸ GAP: {gap:.2f}s"
            duration = w['end'] - w['start']
            print(f"      {i+1}. '{w['word']}' at {w['start']:.2f}s - {w['end']:.2f}s (duration: {duration:.2f}s){gap_info}")
        
        # Check for problematic timing patterns
        print("   ðŸ” Checking for timing issues...")
        issues_found = 0
        for i, w in enumerate(lyrics):
            duration = w['end'] - w['start']
            # Flag words with unusually long durations (> 3 seconds)
            if duration > 3.0:
                print(f"      âš ï¸ Long word duration: '{w['word']}' lasts {duration:.2f}s (index {i})")
                issues_found += 1
            # Flag large gaps between words (> 5 seconds)
            if i > 0:
                gap = w['start'] - lyrics[i-1]['end']
                if gap > 5.0:
                    print(f"      âš ï¸ Large gap before '{w['word']}': {gap:.2f}s gap (index {i})")
                    issues_found += 1
            # Flag if end time is before start time (shouldn't happen)
            if w['end'] < w['start']:
                print(f"      âŒ Invalid timing: '{w['word']}' ends before it starts! (index {i})")
                issues_found += 1
        
        if issues_found == 0:
            print("      âœ… No timing issues detected")
        else:
            print(f"      âš ï¸ Found {issues_found} potential timing issues")
    
    return lyrics


def align_user_lyrics_to_timestamps(user_lyrics_text, api_lyrics):
    """
    Align user-provided lyrics with API timestamps.
    
    PRIORITY: Perfect timing over perfect words.
    
    NEW in 4.1: Uses normalized comparison to ignore punctuation and capitalization!
    
    Strategy:
    1. Parse user lyrics into words
    2. Compare word counts
    3. If counts match: Use user words with API timestamps
    4. If counts differ slightly (<15%): Still try to use user words
    5. If too different: Use API transcription for perfect timing
    """
    # Parse user lyrics into words with line break tracking
    user_words, line_break_indices = parse_lyrics_text_with_breaks(user_lyrics_text)
    print(f"   User provided {len(user_words)} words")
    print(f"   AssemblyAI detected {len(api_lyrics)} words")
    print(f"   User line breaks at indices: {sorted(line_break_indices)[:10]}{'...' if len(line_break_indices) > 10 else ''}")
    
    if len(api_lyrics) == 0:
        print("   âš ï¸ No API words - returning empty")
        return []
    
    if len(user_words) == 0:
        print("   âš ï¸ No user words - using API transcription")
        return api_lyrics
    
    # Check if word counts match exactly
    if len(user_words) == len(api_lyrics):
        print(f"   âœ… Word counts match exactly - using user words with API timestamps")
        aligned = []
        matches = 0
        
        for i in range(len(user_words)):
            # Use user's word (preserves their formatting/punctuation)
            aligned.append({
                'word': user_words[i],
                'start': api_lyrics[i]['start'],
                'end': api_lyrics[i]['end'],
                'confidence': api_lyrics[i].get('confidence', 1.0),
                'lineBreak': i in line_break_indices
            })
            
            # Count how many words match after normalization (for logging)
            if words_match_normalized(user_words[i], api_lyrics[i]['word']):
                matches += 1
        
        match_percentage = (matches / len(user_words)) * 100
        print(f"   ðŸ“Š Word similarity: {matches}/{len(user_words)} ({match_percentage:.1f}%) match after normalization")
        print(f"   ðŸ“ Applied {len(line_break_indices)} line breaks from user lyrics")
        print(f"âœ… Aligned {len(aligned)} user words with AssemblyAI timestamps")
        return aligned
    
    # Word counts differ - check how different
    count_diff = abs(len(user_words) - len(api_lyrics))
    diff_percentage = (count_diff / max(len(user_words), len(api_lyrics))) * 100
    
    print(f"   ðŸ“Š Word count difference: {count_diff} words ({diff_percentage:.1f}%)")
    
    # If difference is small (< 15%), try to align anyway using user words
    # This handles cases where API split/merged a few words differently
    if diff_percentage < 15:
        if len(user_words) <= len(api_lyrics):
            # First, check how many words actually match
            matches = 0
            for i in range(len(user_words)):
                if words_match_normalized(user_words[i], api_lyrics[i]['word']):
                    matches += 1
            
            match_percentage = (matches / len(user_words)) * 100
            
            # If less than 50% match, the lyrics are too different - use API transcription
            if match_percentage < 50:
                print(f"   âš ï¸ Word similarity too low ({match_percentage:.1f}%) - using API transcription for accurate timing")
                print(f"âœ… Using {len(api_lyrics)} AssemblyAI words with original timestamps")
                return api_lyrics
            
            # Good match - use user words with API timestamps
            print(f"   ðŸ”„ Small difference - using user words with API timestamps (1:1 mapping)")
            aligned = []
            
            for i in range(len(user_words)):
                aligned.append({
                    'word': user_words[i],
                    'start': api_lyrics[i]['start'],
                    'end': api_lyrics[i]['end'],
                    'confidence': api_lyrics[i].get('confidence', 1.0),
                    'lineBreak': i in line_break_indices
                })
            
            print(f"   ðŸ“Š Word similarity: {matches}/{len(user_words)} ({match_percentage:.1f}%) match after normalization")
            print(f"   ðŸ“ Applied {len(line_break_indices)} line breaks from user lyrics")
            print(f"âœ… Aligned {len(aligned)} user words (API had {len(api_lyrics) - len(user_words)} extra)")
            return aligned
        else:
            # User has MORE words than API - fit user words to available timestamps
            print(f"   ðŸ”„ User has more words - fitting {len(user_words)} user words to {len(api_lyrics)} timestamps")
            aligned = []
            
            # Calculate how to distribute extra words across timestamps
            words_per_slot = len(user_words) / len(api_lyrics)
            
            for api_idx in range(len(api_lyrics)):
                # Calculate how many user words go into this slot
                start_user_idx = int(api_idx * words_per_slot)
                end_user_idx = int((api_idx + 1) * words_per_slot)
                
                # Combine words for this slot
                slot_words = user_words[start_user_idx:end_user_idx]
                combined_word = ' '.join(slot_words) if slot_words else user_words[min(start_user_idx, len(user_words)-1)]
                
                # Check if any word in this slot had a line break
                # Use the LAST line break in the slot (if any word except the last had a break, 
                # that break is now internal to the combined word)
                has_line_break = (end_user_idx - 1) in line_break_indices
                
                aligned.append({
                    'word': combined_word,
                    'start': api_lyrics[api_idx]['start'],
                    'end': api_lyrics[api_idx]['end'],
                    'confidence': api_lyrics[api_idx].get('confidence', 1.0),
                    'lineBreak': has_line_break
                })
            
            extra_words = len(user_words) - len(api_lyrics)
            applied_breaks = sum(1 for w in aligned if w.get('lineBreak', False))
            print(f"   ðŸ“Š Combined {len(user_words)} user words into {len(aligned)} timed slots")
            print(f"   ðŸ“ Applied {applied_breaks} line breaks from user lyrics")
            print(f"âœ… Aligned user lyrics with {extra_words} extra words distributed across timestamps")
            return aligned
    
    # Word counts too different - use API transcription for perfect timing
    print(f"   âš ï¸ Word counts too different - using API transcription for perfect timing")
    print(f"âœ… Using {len(api_lyrics)} AssemblyAI words with original timestamps")
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


def parse_lyrics_text_with_breaks(lyrics_text):
    """
    Parse raw lyrics text into words AND track line break positions.
    
    Returns:
        words: List of words
        line_break_indices: Set of word indices that end a line
    """
    # Remove section headers like [Verse 1], [Chorus], etc.
    text = re.sub(r'\[.*?\]', '', lyrics_text)
    
    words = []
    line_break_indices = set()
    
    lines = text.strip().split('\n')
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        line_words = line.split()
        for word in line_words:
            cleaned = word.strip()
            if cleaned and not cleaned.isspace():
                words.append(cleaned)
        
        # Mark the last word of this line as having a line break
        if words:
            line_break_indices.add(len(words) - 1)
    
    # Remove the very last index (no break needed after final word)
    if words:
        line_break_indices.discard(len(words) - 1)
    
    return words, line_break_indices


def auto_correct_low_confidence_words(api_lyrics, user_lyrics_text):
    """
    Auto-correct low confidence words using user-provided lyrics.
    
    For each low-confidence word in API output, check if user's lyrics
    have a different word at approximately the same position.
    If so, use the user's word (they probably know their lyrics better than AI).
    
    This runs automatically for ALL tiers to ensure quality output.
    """
    if not user_lyrics_text or not api_lyrics:
        return api_lyrics, 0
    
    user_words = parse_lyrics_text(user_lyrics_text)
    if not user_words:
        return api_lyrics, 0
    
    LOW_CONFIDENCE = 0.5
    corrections = 0
    corrected_lyrics = []
    
    # Track which user words we've used to avoid duplicates
    used_user_indices = set()
    
    for api_idx, api_word in enumerate(api_lyrics):
        confidence = api_word.get('confidence', 1.0)
        
        # Calculate expected position in user lyrics (proportional mapping)
        position_ratio = api_idx / len(api_lyrics) if len(api_lyrics) > 0 else 0
        expected_user_idx = int(position_ratio * len(user_words))
        expected_user_idx = max(0, min(expected_user_idx, len(user_words) - 1))
        
        # Search window: look 3 words before and after expected position
        search_start = max(0, expected_user_idx - 3)
        search_end = min(len(user_words), expected_user_idx + 4)
        
        # First, try to find an exact match (normalized) in search window
        exact_match_idx = None
        for i in range(search_start, search_end):
            if i not in used_user_indices and words_match_normalized(api_word['word'], user_words[i]):
                exact_match_idx = i
                break
        
        if exact_match_idx is not None:
            # Found exact match - use user's word (preserves their formatting/punctuation)
            corrected_lyrics.append({
                'word': user_words[exact_match_idx],
                'start': api_word['start'],
                'end': api_word['end'],
                'confidence': confidence
            })
            used_user_indices.add(exact_match_idx)
        elif confidence < LOW_CONFIDENCE:
            # Low confidence, no exact match - trust user's word at this position
            # Find nearest unused user word
            best_idx = None
            for i in range(search_start, search_end):
                if i not in used_user_indices:
                    best_idx = i
                    break
            
            if best_idx is not None:
                user_word = user_words[best_idx]
                corrected_lyrics.append({
                    'word': user_word,
                    'start': api_word['start'],
                    'end': api_word['end'],
                    'confidence': confidence,
                    'auto_corrected': True
                })
                used_user_indices.add(best_idx)
                corrections += 1
                print(f"      ðŸ”§ Auto-corrected: '{api_word['word']}' â†’ '{user_word}' (confidence: {confidence:.0%})")
            else:
                # No user word available, keep API word
                corrected_lyrics.append({
                    'word': api_word['word'],
                    'start': api_word['start'],
                    'end': api_word['end'],
                    'confidence': confidence
                })
        else:
            # High confidence - trust API transcription
            corrected_lyrics.append({
                'word': api_word['word'],
                'start': api_word['start'],
                'end': api_word['end'],
                'confidence': confidence
            })
    
    if corrections > 0:
        print(f"   âœ¨ Auto-corrected {corrections} low-confidence words using uploaded lyrics")
    
    return corrected_lyrics, corrections


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

def create_frame(width, height, colors=None, bg_image=None, video_reader=None, current_time=0):
    """
    Create a frame with background.
    
    Supports multiple background types:
    1. Video background (if video_reader provided) - extracts frame at current_time
    2. Image background (if bg_image provided) - uses static image
    3. Gradient/color background (default) - creates gradient or solid color
    
    Args:
        width: Frame width in pixels
        height: Frame height in pixels
        colors: Dict with bg_1, bg_2, use_gradient, gradient_direction
        bg_image: PIL Image for static background (optional)
        video_reader: VideoBackgroundReader instance (optional)
        current_time: Current time in seconds for video backgrounds
    
    Returns:
        PIL Image of the frame
    """
    # Option 1: Video background
    if video_reader is not None:
        return video_reader.get_frame_at_time(current_time)
    
    # Option 2: Static image background
    if bg_image is not None:
        return bg_image.copy()
    
    # Option 3: Color/gradient background (original behavior)
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


def create_intro_frame(artist, title, frame_num, total_frames, width, height, colors=None, bg_image=None, video_reader=None, current_time=0):
    """Create intro screen frame with fade in/out."""
    img = create_frame(width, height, colors, bg_image, video_reader, current_time)
    draw = ImageDraw.Draw(img)
    
    # Get colors or use defaults
    text_color = colors.get('text', COLOR_TEXT) if colors else COLOR_TEXT
    sung_color = colors.get('sung', COLOR_HIGHLIGHT) if colors else COLOR_HIGHLIGHT
    font_name = colors.get('font', 'arial') if colors else 'arial'
    
    scale = width / 1920
    font_artist = get_font(int(FONT_SIZE_ARTIST * scale), font_name, colors.get('custom_font_path') if colors else None)
    font_title = get_font(int(FONT_SIZE_TITLE * scale), font_name, colors.get('custom_font_path') if colors else None)
    
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


def create_countdown_frame_with_preview(countdown_time, width, height, lyrics, gap_end_time, display_mode, colors=None, total_dots=COUNTDOWN_DOTS, bg_image=None, video_reader=None, current_time=0):
    """
    Create countdown frame with 6 dots ABOVE upcoming lyrics.
    
    - Shows 6 small circles/dots at top
    - One lights up every 0.5 seconds (3 second countdown total)
    - Upcoming lyrics are visible below in the user's chosen display mode style
    """
    # First, create the lyrics frame using the same display mode the user chose
    # This ensures consistency with how lyrics will look when singing starts
    # Use gap_end_time - 0.1 to show lyrics WITHOUT highlighting the first word
    # (the first word highlights when current_time >= word start time)
    preview_time = gap_end_time - 0.1
    if display_mode == 'scroll':
        img = create_scroll_frame(preview_time, lyrics, width, height, colors, bg_image, video_reader, current_time)
    elif display_mode == 'page':
        img = create_page_frame(preview_time, lyrics, width, height, colors, bg_image, video_reader, current_time)
    else:
        img = create_overwrite_frame(preview_time, lyrics, width, height, colors, bg_image, video_reader, current_time)
    
    draw = ImageDraw.Draw(img)
    
    scale = width / 1920
    
    # Calculate how many dots should be lit based on countdown time
    # countdown_time goes from 3.0 down to 0
    # At 3.0s remaining: 0 dots lit
    # At 2.5s remaining: 1 dot lit
    # At 2.0s remaining: 2 dots lit
    # etc.
    elapsed = (COUNTDOWN_DOTS * COUNTDOWN_DOT_INTERVAL) - countdown_time
    dots_lit = int(elapsed / COUNTDOWN_DOT_INTERVAL)
    dots_lit = max(0, min(total_dots, dots_lit))
    
    # Draw the countdown dots - positioned at top of screen, ABOVE the lyrics
    dot_radius = int(12 * scale)
    dot_spacing = int(20 * scale)
    total_dots_width = (total_dots * dot_radius * 2) + ((total_dots - 1) * dot_spacing)
    dots_start_x = (width - total_dots_width) // 2
    dots_y = int(height * 0.12)  # 12% from top - well above the lyrics area
    
    # Get background color for the dot background bar
    bg_color = colors.get('bg_1', COLOR_BG) if colors else COLOR_BG
    
    # Draw a subtle background bar behind the dots for visibility
    bar_padding = int(20 * scale)
    bar_height = dot_radius * 2 + bar_padding * 2
    bar_y = dots_y - bar_padding
    
    # Draw background bar (simple rectangle) - semi-transparent for video backgrounds
    draw.rectangle(
        [(dots_start_x - bar_padding, bar_y), 
         (dots_start_x + total_dots_width + bar_padding, bar_y + bar_height)],
        fill=bg_color
    )
    
    # Draw each dot as a circle (ellipse)
    for i in range(total_dots):
        center_x = dots_start_x + dot_radius + i * (dot_radius * 2 + dot_spacing)
        center_y = dots_y + dot_radius
        
        if i < dots_lit:
            # Lit dot - gold/yellow filled
            fill_color = COLOR_COUNTDOWN
            outline_color = (255, 220, 50)  # Brighter outline
        else:
            # Unlit dot - dim gray
            fill_color = (60, 60, 60)
            outline_color = (80, 80, 80)
        
        # Draw circle (ellipse with equal width/height)
        draw.ellipse(
            [(center_x - dot_radius, center_y - dot_radius),
             (center_x + dot_radius, center_y + dot_radius)],
            fill=fill_color,
            outline=outline_color,
            width=2
        )
    
    return img


def group_lyrics_into_lines(lyrics, words_per_line=WORDS_PER_LINE):
    """
    Group lyrics into display lines.
    
    PRIORITY: Custom line breaks > Auto line breaks
    
    If lyrics have 'lineBreak' property set to True, that marks the END of a line.
    Otherwise, uses automatic grouping based on:
    1. Word count (max words per line), OR
    2. Timing gaps (0.5+ seconds between words)
    
    This creates natural-looking line breaks that match the song's rhythm,
    while allowing users to override with custom breaks.
    """
    lines = []
    current_line = []
    
    # Check if any word has custom lineBreak markers
    has_custom_breaks = any(word.get('lineBreak', False) for word in lyrics)
    
    if has_custom_breaks:
        # Use custom line breaks (print removed - was causing log spam when called per-frame)
        for word in lyrics:
            current_line.append(word)
            
            # Check if this word ends a line
            if word.get('lineBreak', False):
                lines.append(current_line)
                current_line = []
        
        # Don't forget the last line if it doesn't have a lineBreak
        if current_line:
            lines.append(current_line)
    else:
        # Use automatic line breaking (original logic)
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


def create_scroll_frame(current_time, lyrics, width, height, colors=None, bg_image=None, video_reader=None, frame_time=None):
    """Create TELEPROMPTER-STYLE scrolling lyrics frame."""
    # Use frame_time for video background if provided, otherwise use current_time
    bg_time = frame_time if frame_time is not None else current_time
    img = create_frame(width, height, colors, bg_image, video_reader, bg_time)
    draw = ImageDraw.Draw(img)
    
    # Get colors or use defaults
    text_color = colors.get('text', COLOR_TEXT) if colors else COLOR_TEXT
    sung_color = colors.get('sung', COLOR_SUNG) if colors else COLOR_SUNG
    highlight_color = colors.get('sung', COLOR_HIGHLIGHT) if colors else COLOR_HIGHLIGHT
    upcoming_color = colors.get('text', COLOR_UPCOMING) if colors else COLOR_UPCOMING
    # Make upcoming slightly dimmer than main text
    if colors:
        upcoming_color = tuple(int(c * 0.7) for c in text_color)
    
    # Get font settings
    font_size_scale = colors.get('font_size_scale', 1.0) if colors else 1.0
    font_name = colors.get('font', 'arial') if colors else 'arial'
    
    scale = width / 1920
    font = get_font(int(FONT_SIZE_LYRICS * scale * font_size_scale), font_name, colors.get('custom_font_path') if colors else None)
    line_height = int(FONT_SIZE_LYRICS * LINE_HEIGHT_MULTIPLIER * scale * font_size_scale)
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


def create_page_frame(current_time, lyrics, width, height, colors=None, bg_image=None, video_reader=None, frame_time=None):
    """Create frame with page-by-page lyrics display."""
    # Use frame_time for video background if provided, otherwise use current_time
    bg_time = frame_time if frame_time is not None else current_time
    img = create_frame(width, height, colors, bg_image, video_reader, bg_time)
    draw = ImageDraw.Draw(img)
    
    # Get colors or use defaults
    text_color = colors.get('text', COLOR_TEXT) if colors else COLOR_TEXT
    sung_color = colors.get('sung', COLOR_SUNG) if colors else COLOR_SUNG
    highlight_color = colors.get('sung', COLOR_HIGHLIGHT) if colors else COLOR_HIGHLIGHT
    
    # Get font settings
    font_size_scale = colors.get('font_size_scale', 1.0) if colors else 1.0
    font_name = colors.get('font', 'arial') if colors else 'arial'
    
    scale = width / 1920
    font = get_font(int(FONT_SIZE_LYRICS * scale * font_size_scale), font_name, colors.get('custom_font_path') if colors else None)
    line_height = int(FONT_SIZE_LYRICS * LINE_HEIGHT_MULTIPLIER * scale * font_size_scale)
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


def create_overwrite_frame(current_time, lyrics, width, height, colors=None, bg_image=None, video_reader=None, frame_time=None):
    """
    Create frame with TRUE overwrite-style lyrics display.
    
    3 fixed positions on screen:
    - Position 0 (top): shows lines 0, 3, 6, 9...
    - Position 1 (middle): shows lines 1, 4, 7, 10...
    - Position 2 (bottom): shows lines 2, 5, 8, 11...
    
    When a line is done being sung, the NEXT line for that position
    appears instantly. Lines don't move - content is replaced in place.
    """
    # Use frame_time for video background if provided, otherwise use current_time
    bg_time = frame_time if frame_time is not None else current_time
    img = create_frame(width, height, colors, bg_image, video_reader, bg_time)
    draw = ImageDraw.Draw(img)
    
    # Get colors or use defaults
    text_color = colors.get('text', COLOR_TEXT) if colors else COLOR_TEXT
    sung_color = colors.get('sung', COLOR_SUNG) if colors else COLOR_SUNG
    highlight_color = colors.get('sung', COLOR_HIGHLIGHT) if colors else COLOR_HIGHLIGHT
    upcoming_color = colors.get('text', COLOR_UPCOMING) if colors else COLOR_UPCOMING
    # Make upcoming slightly dimmer than main text
    if colors:
        upcoming_color = tuple(int(c * 0.7) for c in text_color)
    
    # Get font settings
    font_size_scale = colors.get('font_size_scale', 1.0) if colors else 1.0
    font_name = colors.get('font', 'arial') if colors else 'arial'
    
    scale = width / 1920
    font = get_font(int(FONT_SIZE_LYRICS * scale * font_size_scale), font_name, colors.get('custom_font_path') if colors else None)
    line_height = int(FONT_SIZE_LYRICS * LINE_HEIGHT_MULTIPLIER * scale * font_size_scale)
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


def create_lyrics_frame(current_time, lyrics, display_mode, width, height, colors=None, bg_image=None, video_reader=None):
    """Create frame with lyrics based on selected display mode."""
    if display_mode == 'scroll':
        return create_scroll_frame(current_time, lyrics, width, height, colors, bg_image, video_reader, current_time)
    elif display_mode == 'page':
        return create_page_frame(current_time, lyrics, width, height, colors, bg_image, video_reader, current_time)
    else:
        return create_overwrite_frame(current_time, lyrics, width, height, colors, bg_image, video_reader, current_time)


def create_lyrics_frame_with_fade(current_time, lyrics, display_mode, width, height, colors=None, fade_opacity=1.0, bg_image=None, video_reader=None):
    """
    Create frame with lyrics that fades out.
    
    fade_opacity: 1.0 = fully visible, 0.0 = fully faded
    """
    # Create the base frame with background
    img = create_frame(width, height, colors, bg_image, video_reader, current_time)
    
    if fade_opacity <= 0:
        return img  # Fully faded, just return background
    
    # Create the lyrics frame
    if display_mode == 'scroll':
        lyrics_frame = create_scroll_frame(current_time, lyrics, width, height, colors, bg_image, video_reader, current_time)
    elif display_mode == 'page':
        lyrics_frame = create_page_frame(current_time, lyrics, width, height, colors, bg_image, video_reader, current_time)
    else:
        lyrics_frame = create_overwrite_frame(current_time, lyrics, width, height, colors, bg_image, video_reader, current_time)
    
    # Blend the lyrics frame with the background based on opacity
    if fade_opacity < 1.0:
        # Convert to RGBA for blending
        bg_rgba = img.convert('RGBA')
        lyrics_rgba = lyrics_frame.convert('RGBA')
        
        # Create a mask with the fade opacity
        mask = Image.new('L', img.size, int(255 * fade_opacity))
        
        # Composite the images
        result = Image.composite(lyrics_rgba, bg_rgba, mask)
        return result.convert('RGB')
    
    return lyrics_frame


def generate_video(audio_path, lyrics, gaps, track_info, output_path, video_quality, display_mode, style_options=None, subscription_tier='free', custom_watermark_url=None, outro_text=None, bg_type='gradient', bg_video_path=None, bg_image=None):
    """Generate video with lyrics and countdown. Supports video/image backgrounds."""
    print(f"🎬 Generating video (mode: {display_mode}, background: {bg_type})...")
    print(f"   ðŸ‘¤ Subscription tier: {subscription_tier}")
    
    # Determine watermark behavior based on tier
    # Free: Karatrack watermark
    # Starter/Pro: No watermark
    # Studio: Custom watermark (if provided)
    apply_watermark_to_video = subscription_tier == 'free'
    apply_custom_watermark = subscription_tier == 'studio' and custom_watermark_url
    
    if apply_watermark_to_video:
        print("   Ã°Å¸ÂÂ·Ã¯Â¸Â Karatrack watermark will be applied (free tier)")
    elif apply_custom_watermark:
        print(f"   Ã°Å¸ÂÂ·Ã¯Â¸Â Custom watermark will be applied (Studio tier)")
    else:
        print("   Ã¢Å“Â¨ No watermark (paid tier)")
    
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
            'font_size': 'normal',
        }
    
    # Parse colors from hex to RGB tuples
    def hex_to_rgb(hex_color):
        hex_color = hex_color.lstrip('#')
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    
    # Font size scale mapping
    font_size_scales = {
        'normal': 1.0,
        'large': 1.15,
        'xlarge': 1.3
    }
    font_size_scale = font_size_scales.get(style_options.get('font_size', 'normal'), 1.0)
    
    colors = {
        'bg_1': hex_to_rgb(style_options.get('bg_color_1', '#1a1a2e')),
        'bg_2': hex_to_rgb(style_options.get('bg_color_2', '#16213e')),
        'text': hex_to_rgb(style_options.get('text_color', '#ffffff')),
        'outline': hex_to_rgb(style_options.get('outline_color', '#000000')),
        'sung': hex_to_rgb(style_options.get('sung_color', '#00d4ff')),
        'use_gradient': style_options.get('use_gradient', True),
        'gradient_direction': style_options.get('gradient_direction', 'to bottom'),
        'font_size_scale': font_size_scale,
        'font': style_options.get('font', 'arial'),
        'custom_font_path': style_options.get('custom_font_path'),
    }
    
    print(f"   Ã°Å¸Å½Â¨ Colors: bg={colors['bg_1']}, text={colors['text']}, sung={colors['sung']}, font={colors['font']}, font_scale={font_size_scale}")
    
    if video_quality == '4k':
        width, height = 3840, 2160
    elif video_quality == '1080p':
        width, height = 1920, 1080
    elif video_quality == '480p':
        width, height = 854, 480
    else:
        width, height = 1280, 720  # Default to 720p
    
    # Initialize video background reader if applicable
    video_reader = None
    if bg_type == 'video' and bg_video_path:
        try:
            video_reader = VideoBackgroundReader(bg_video_path, width, height, FPS)
            print(f"   📹 Video background loaded: {video_reader.duration:.1f}s duration, will loop as needed")
        except Exception as e:
            print(f"   ⚠️ Failed to load video background: {e}")
            print(f"   ⚠️ Falling back to gradient background")
            bg_type = 'gradient'
    
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
    
    print(f"   Ã¢ÂÂ±Ã¯Â¸Â Lyrics offset by {INTRO_DURATION}s for intro")
    
    # Get duration of audio WITH intro silence
    total_duration = get_audio_duration(audio_with_intro)
    total_frames = int(total_duration * FPS)
    
    frames_dir = tempfile.mkdtemp()
    
    artist = track_info.get('artist_name', 'Unknown Artist')
    title = track_info.get('song_title', 'Unknown Title')
    
    intro_frames = int(INTRO_DURATION * FPS)
    
    # Detect gaps for countdown (with offset applied)
    offset_gaps = []
    for gap in gaps:
        offset_gap = gap.copy()
        offset_gap['start'] = gap['start'] + INTRO_DURATION
        offset_gap['end'] = gap['end'] + INTRO_DURATION
        offset_gaps.append(offset_gap)
    
    # Check for long intro before first lyrics (only if not already detected)
    # The detect_silence_gaps function may have already found this gap
    if offset_lyrics:
        first_lyric_time = offset_lyrics[0]['start']
        intro_gap_time = first_lyric_time - INTRO_DURATION  # Time after intro screen before first lyric
        
        # Only add intro gap if:
        # 1. Gap is long enough (>= 3 seconds)
        # 2. We don't already have a gap that covers this period
        has_intro_gap = any(g.get('is_intro', False) for g in offset_gaps)
        
        if intro_gap_time >= COUNTDOWN_THRESHOLD and not has_intro_gap:
            # Add countdown before first lyrics
            countdown_start = first_lyric_time - (COUNTDOWN_DOTS * COUNTDOWN_DOT_INTERVAL)
            offset_gaps.insert(0, {
                'start': INTRO_DURATION,
                'end': first_lyric_time,
                'duration': intro_gap_time,
                'is_intro': True,
                'countdown_start': countdown_start
            })
            print(f"   Ã¢Å¾â€¢ Added intro countdown gap: {INTRO_DURATION}s to {first_lyric_time:.2f}s")
    
    # Calculate countdown start times for each gap
    for gap in offset_gaps:
        if 'countdown_start' not in gap:
            gap['countdown_start'] = gap['end'] - (COUNTDOWN_DOTS * COUNTDOWN_DOT_INTERVAL)
    
    # Get last lyric end time for fadeout
    last_lyric_end = offset_lyrics[-1]['end'] if offset_lyrics else total_duration
    fadeout_start = last_lyric_end
    fadeout_end = min(last_lyric_end + FADEOUT_DURATION, total_duration)

    # Outro text timing (starts after fadeout ends)
    outro_start = fadeout_end if offset_lyrics else INTRO_DURATION + 2
    has_outro_text = outro_text and subscription_tier == 'studio'
    if has_outro_text:
        print(f"   ðŸ“ Outro text enabled: '{outro_text[:50]}...' (starts at {outro_start:.2f}s)")
    
    # Debug: Log timing info
    print(f"   Ã°Å¸â€œÅ  Timing debug:")
    print(f"      Total duration (with intro): {total_duration:.2f}s")
    print(f"      Intro duration: {INTRO_DURATION}s ({intro_frames} frames)")
    print(f"      Total frames: {total_frames}")
    print(f"      Countdown gaps: {len(offset_gaps)}")
    for i, gap in enumerate(offset_gaps):
        print(f"         Gap {i+1}: countdown starts at {gap.get('countdown_start', 0):.2f}s, lyrics resume at {gap['end']:.2f}s")
    print(f"      Fadeout: {fadeout_start:.2f}s - {fadeout_end:.2f}s")
    if offset_lyrics:
        print(f"      First lyric '{offset_lyrics[0]['word']}' at {offset_lyrics[0]['start']:.2f}s (frame {int(offset_lyrics[0]['start'] * FPS)})")
    
    first_lyric_logged = False
    countdown_gaps_logged = set()  # Track which gaps we've logged
    
    for frame_num in range(total_frames):
        current_time = frame_num / FPS
        
        if frame_num < intro_frames:
            # Show intro screen during the silence period
            frame = create_intro_frame(artist, title, frame_num, intro_frames, width, height, colors, bg_image, video_reader, current_time)
        else:
            # Check if we're in a countdown period
            in_countdown = False
            for gap_idx, gap in enumerate(offset_gaps):
                countdown_start = gap.get('countdown_start', gap['end'] - (COUNTDOWN_DOTS * COUNTDOWN_DOT_INTERVAL))
                if countdown_start <= current_time < gap['end']:
                    # We're in a countdown period
                    in_countdown = True
                    countdown_remaining = gap['end'] - current_time
                    
                    # Debug: Log first time we enter this countdown gap
                    if gap_idx not in countdown_gaps_logged:
                        print(f"   Ã°Å¸â€Âµ COUNTDOWN GAP {gap_idx+1}: frame {frame_num}, time={current_time:.2f}s, remaining={countdown_remaining:.2f}s, lyrics resume at {gap['end']:.2f}s")
                        countdown_gaps_logged.add(gap_idx)
                    
                    frame = create_countdown_frame_with_preview(
                        countdown_remaining, 
                        width, 
                        height, 
                        offset_lyrics, 
                        gap['end'],
                        display_mode,
                        colors
                    )
                    break
            
            if not in_countdown:
                # Debug: Log when first lyric should appear
                if not first_lyric_logged and offset_lyrics and current_time >= offset_lyrics[0]['start']:
                    print(f"   Ã°Å¸â€œÅ  First lyric should appear now: frame {frame_num}, current_time={current_time:.2f}s")
                    first_lyric_logged = True
                
                # Check if we're in fadeout period
                if current_time >= fadeout_start:
                    # Calculate fade opacity (1.0 at start, 0.0 at end)
                    fade_progress = (current_time - fadeout_start) / FADEOUT_DURATION
                    fade_progress = min(1.0, fade_progress)
                    fade_opacity = 1.0 - fade_progress
                    
                    # Create lyrics frame with fade
                    frame = create_lyrics_frame_with_fade(
                        current_time, 
                        offset_lyrics, 
                        display_mode, 
                        width, 
                        height, 
                        colors,
                        fade_opacity,
                        bg_image,
                        video_reader
                    )
                else:
                    # Normal lyrics display
                    frame = create_lyrics_frame(current_time, offset_lyrics, display_mode, width, height, colors, bg_image, video_reader)
        
        # Render outro text after lyrics have faded out
            if has_outro_text and current_time >= outro_start:
                # Calculate fade-in alpha for outro text
                outro_elapsed = current_time - outro_start
                outro_alpha = min(1.0, outro_elapsed / OUTRO_TEXT_FADE_IN)
                
                draw = ImageDraw.Draw(frame)
                scale = width / 1920
                outro_font_size = int(48 * scale)
                outro_font = get_font(outro_font_size, colors.get('font', 'arial') if colors else 'arial', colors.get('custom_font_path') if colors else None)
                
                # Split outro text into lines
                outro_lines = outro_text.strip().split('\n')
                line_height = int(outro_font_size * 1.5)
                total_height = len(outro_lines) * line_height
                start_y = (height - total_height) // 2
                
                text_color = colors.get('text', COLOR_TEXT) if colors else COLOR_TEXT
                outro_color = tuple(int(c * outro_alpha) for c in text_color)
                
                for i, line in enumerate(outro_lines):
                    line_y = start_y + i * line_height
                    bbox = draw.textbbox((0, 0), line, font=outro_font)
                    text_width = bbox[2] - bbox[0]
                    text_x = (width - text_width) // 2
                    draw.text((text_x, line_y), line, font=outro_font, fill=outro_color)

        # Apply watermark for free tier, or custom watermark for Studio
        if apply_watermark_to_video:
            frame = apply_watermark(frame, width, height)
        elif apply_custom_watermark:
            frame = apply_studio_watermark(frame, width, height, custom_watermark_url)
        
        frame_path = os.path.join(frames_dir, f'frame_{frame_num:06d}.png')
        frame.save(frame_path)
        
        if frame_num % 100 == 0:
            print(f"  Frame {frame_num}/{total_frames}")
    
    # Close video reader to free resources
    if video_reader:
        video_reader.close()
        print("   📹 Video background reader closed")

    print("Ã°Å¸â€Â§ Encoding video with FFmpeg...")
    
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
    
    print("Ã¢Å“â€¦ Video generation complete")
    return output_path


# ============================================
# MAIN HANDLER
# ============================================

def handler(event):
    """RunPod handler function"""
    callback_url = None
    project_id = None
    
    # Initialize fonts on first run
    initialize_fonts()
    
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
            'font_size': input_data.get('font_size', 'normal'),
            'custom_font_url': input_data.get('custom_font_url'),
            'custom_font_name': input_data.get('custom_font_name'),
        }
        
        # NEW in 5.0: Background type options
        bg_type = input_data.get('bg_type', 'gradient')  # 'color', 'gradient', 'image', 'video'
        bg_video_preset = input_data.get('bg_video_preset')  # Preset filename e.g. 'abstract-smoke.mp4'
        bg_video_url = input_data.get('bg_video_url')  # Custom video URL (user uploads)
        bg_image_url = input_data.get('bg_image_url')  # Custom image URL
        
        print(f"Ã°Å¸Å½Â¤ Processing project: {project_id}")
        print(f"   Type: {processing_type}")
        print(f"   Lyrics provided: {'Yes' if user_lyrics_text else 'No (auto-transcribe)'}")
        print(f"   Display mode: {display_mode}")
        print(f"   Clean version: {clean_version}")
        print(f"   Quality: {video_quality}")
        print(f"   Ã°Å¸â€˜Â¤ Subscription tier: {subscription_tier}")
        print(f"   Ã°Å¸Å½Â¨ Style: bg={style_options['bg_color_1']}, text={style_options['text_color']}, sung={style_options['sung_color']}")
        print(f"   Ã°Å¸Å¡â‚¬ Using AssemblyAI for precise timing!")
        print(f"   [4.1] Lyrics comparison uses NORMALIZED matching (ignores punctuation/case)")
        
        # Check processing mode early
        processing_mode = input_data.get('processing_mode', 'full')
        print(f"   Ã°Å¸â€œâ€¹ Processing mode: {processing_mode}")
        
        work_dir = tempfile.mkdtemp()
        results = {}
        
        # Download custom font if provided
        custom_font_path = None
        if style_options.get('custom_font_url'):
            custom_font_path = download_custom_font(style_options['custom_font_url'], work_dir)
            if custom_font_path:
                style_options['custom_font_path'] = custom_font_path
                print(f"   🔤 Custom font: {style_options.get('custom_font_name', 'Custom')}")
        
        # Download custom font if provided
        custom_font_path = None
        if style_options.get('custom_font_url'):
            custom_font_path = download_custom_font(style_options['custom_font_url'], work_dir)
            if custom_font_path:
                style_options['custom_font_path'] = custom_font_path
                print(f"   Custom font: {style_options.get('custom_font_name', 'Custom')}")
        
        # Download video/image background if needed (NEW in 5.0)
        bg_video_path = None
        bg_image = None
        
        if bg_type == 'video':
            bg_video_path = download_video_background(bg_type, bg_video_preset, bg_video_url, work_dir)
            if not bg_video_path:
                print("   ⚠️ Video background not available, falling back to gradient")
                bg_type = 'gradient'
        
        if bg_type == 'image' and bg_image_url:
            # Determine video dimensions for image sizing
            if video_quality == '4k':
                img_width, img_height = 3840, 2160
            elif video_quality == '1080p':
                img_width, img_height = 1920, 1080
            elif video_quality == '480p':
                img_width, img_height = 854, 480
            else:
                img_width, img_height = 1280, 720
            
            bg_image = download_image_background(bg_type, bg_image_url, work_dir, img_width, img_height)
            if not bg_image:
                print("   ⚠️ Image background not available, falling back to gradient")
                bg_type = 'gradient'
        
        # RENDER_ONLY MODE: Skip vocal separation, use existing processed audio
        if processing_mode == 'render_only':
            print("Ã°Å¸Å½Â¬ Render-only mode - using existing processed audio")
            
            # Get the already-processed audio URL
            processed_audio_url = input_data.get('processed_audio_url')
            if not processed_audio_url:
                raise ValueError("render_only mode requires processed_audio_url")
            
            # Download the processed audio
            instrumental_path = os.path.join(work_dir, 'instrumental.wav')
            print(f"Ã°Å¸â€œÂ¥ Downloading processed audio from {processed_audio_url}")
            download_file(processed_audio_url, instrumental_path)
            
            # Get edited lyrics from input
            lyrics = input_data.get('edited_lyrics', [])
            if not lyrics:
                raise ValueError("render_only mode requires edited_lyrics")
            
            print(f"Ã°Å¸â€œÂ Using {len(lyrics)} edited lyrics from user")
            
            # Keep existing URLs
            results['processed_audio_url'] = processed_audio_url
            if input_data.get('vocals_audio_url'):
                results['vocals_audio_url'] = input_data.get('vocals_audio_url')
            
            gaps = detect_silence_gaps(lyrics)
            print(f"   Found {len(gaps)} gaps for countdown (threshold: {COUNTDOWN_THRESHOLD}s)")
            for i, gap in enumerate(gaps):
                print(f"      Gap {i+1}: {gap['start']:.2f}s - {gap['end']:.2f}s ({gap['duration']:.2f}s) {'[INTRO]' if gap.get('is_intro') else ''}")
            results['lyrics'] = lyrics
            
            # Skip to video generation (handled below)
            vocals_path = None
            audio_path = instrumental_path
            
        else:
            # FULL or TRANSCRIBE_ONLY MODE: Do vocal separation and transcription
            audio_path = os.path.join(work_dir, 'input_audio.mp3')
            print(f"Ã°Å¸â€œÂ¥ Downloading audio from {audio_url}")
            download_file(audio_url, audio_path)
            
            print("Ã°Å¸Å½Âµ Starting vocal separation...")
            instrumental_path, vocals_path = separate_vocals(audio_path, work_dir)
            
            if processing_type in ['remove_vocals']:
                instrumental_key = f"processed/{project_id}/instrumental.wav"
                results['processed_audio_url'] = upload_to_r2(instrumental_path, instrumental_key)
            
            elif processing_type == 'guide_vocals':
                # Guide Vocals mode: Mix instrumental (100%) + vocals (30%) for singers who need guidance
                print("Ã°Å¸Å½Â¤ Creating guide vocals track (instrumental + 30% vocals)...")
                
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
                
                print("Ã¢Å“â€¦ Guide vocals track created")
            
            # LYRICS PROCESSING - NOW USING ASSEMBLYAI
            lyrics = []
            gaps = []
            
            if include_lyrics:
                # Use AssemblyAI for transcription and alignment
                lyrics = transcribe_with_assemblyai(vocals_path, user_lyrics_text)
                
                if clean_version and lyrics:
                    print("Ã°Å¸â€ºÂ¡Ã¯Â¸Â Applying profanity filter...")
                    print(f"   Processing {len(lyrics)} words...")
                    lyrics = apply_profanity_filter(lyrics)
                
                gaps = detect_silence_gaps(lyrics)
                print(f"   Found {len(gaps)} gaps for countdown (threshold: {COUNTDOWN_THRESHOLD}s)")
                for i, gap in enumerate(gaps):
                    print(f"      Gap {i+1}: {gap['start']:.2f}s - {gap['end']:.2f}s ({gap['duration']:.2f}s) {'[INTRO]' if gap.get('is_intro') else ''}")
                
                results['lyrics'] = lyrics
            
            # Check if transcribe_only - stop here
            if processing_mode == 'transcribe_only':
                print("Ã°Å¸â€œâ€¹ Transcribe-only mode - skipping video generation")
                
                if callback_url:
                    print(f"Ã°Å¸â€œÂ¤ Sending callback to {callback_url}")
                    requests.post(callback_url, json={
                        'project_id': project_id,
                        'status': 'transcribed',
                        'results': results
                    })
                
                import shutil
                shutil.rmtree(work_dir)
                
                print("Ã¢Å“â€¦ Transcription complete!")
                return {
                    'status': 'transcribed',
                    'project_id': project_id,
                    'results': results
                }
        
        # VIDEO GENERATION (for 'full' or 'render_only' modes)
        audio_duration = get_audio_duration(instrumental_path if instrumental_path else audio_path)
        
        selected_display_mode = select_display_mode(lyrics, audio_duration, display_mode)
        print(f"Ã°Å¸â€œÂº Selected display mode: {selected_display_mode}")
        
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
              custom_watermark_url,  # Pass custom watermark URL for Studio users
              input_data.get('outro_text'),  # Pass outro text for Studio users
              bg_type,  # NEW: Background type
              bg_video_path,  # NEW: Video background path
              bg_image  # NEW: Image background
          )
        
        video_key = f"processed/{project_id}/video.mp4"
        results['video_url'] = upload_to_r2(video_path, video_key)
        
        if callback_url:
            print(f"Ã°Å¸â€œÂ¤ Sending callback to {callback_url}")
            requests.post(callback_url, json={
                'project_id': project_id,
                'status': 'completed',
                'results': results
            })
        
        import shutil
        shutil.rmtree(work_dir)
        
        print("Ã¢Å“â€¦ Processing complete!")
        return {
            'status': 'completed',
            'project_id': project_id,
            'results': results
        }
        
    except Exception as e:
        print(f"Ã¢ÂÅ’ Error: {str(e)}")
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