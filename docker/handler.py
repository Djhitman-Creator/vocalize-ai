"""
Karatrack Studio RunPod Handler
Version 6.4 - 4K Resolution Glow/Outline Fix

Uses AssemblyAI API for word-level timestamps (~50ms accuracy)

NEW in 4.1: Normalized lyrics comparison ignores punctuation & capitalization
NEW in 5.0: Video background support (presets and custom uploads)
NEW in 6.0: Character-by-character sweep highlighting with sweep-in bars
NEW in 6.3: Major performance optimizations:
  - Split word at sweep point (2 draws vs N characters)
  - JPEG frame output (faster than PNG)
  - FFmpeg 'fast' preset
  - Text width caching
  - Reduced outline passes (4 vs 8)
NEW in 6.4: Resolution-aware glow and outline scaling:
  - Glow effect offsets now scale with resolution (4K = 2x offsets)
  - Outline thickness scales with resolution
  - Fixes glow/outline appearing too thin at 4K

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
FADEOUT_DURATION = 3  # Seconds to fade out lyrics at end
OUTRO_TEXT_FADE_IN = 1.0  # Seconds to fade in outro text

# Sweep highlighting constants (NEW in 6.0)
SWEEP_IN_LONG_DURATION = 2.0  # Long sweep-in (2 seconds) for gaps >= 2s
SWEEP_IN_LONG_MIN_GAP = 2.0   # Minimum gap required for long sweep
SWEEP_IN_SHORT_DURATION = 1.0 # Short sweep-in (1 second) for gaps >= 1.25s
SWEEP_IN_SHORT_MIN_GAP = 1.25 # Minimum gap required for short sweep
INSTRUMENTAL_BREAK_THRESHOLD = 5.0  # Seconds to trigger progress bar
SWEEP_IN_BAR_WIDTH = 120      # Max width of sweep-in bar in pixels (at 1920 width)

# Legacy constants (kept for backward compatibility)
COUNTDOWN_THRESHOLD = 3  # Used by detect_silence_gaps
INTRO_COUNTDOWN_THRESHOLD = 3  
COUNTDOWN_DOTS = 6
COUNTDOWN_DOT_INTERVAL = 0.5

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
        
        print(f"    Video background loaded: {self.source_width}x{self.source_height} @ {self.source_fps:.1f}fps, {self.duration:.1f}s")
    
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
        print(f"    Downloading preset video background: {bg_video_preset}")
        download_file(preset_url, video_path)
        print(f"    Preset video downloaded")
        return video_path
    
    elif bg_video_url:
        # Download custom video
        print(f"    Downloading custom video background...")
        download_file(bg_video_url, video_path)
        print(f"    Custom video downloaded")
        return video_path
    
    return None


def download_image_background(bg_type, bg_image_url, work_dir, target_width, target_height, fit_mode='fill', bg_color=(10, 10, 20)):
    """
    Download and prepare image background.
    
    Args:
        bg_type: Background type
        bg_image_url: URL to background image
        work_dir: Working directory
        target_width: Video width
        target_height: Video height
        fit_mode: 'fill' (crop to fill), 'fit' (show all, letterbox), 'stretch' (distort to fill)
        bg_color: RGB tuple for letterbox color when using 'fit' mode
        
    Returns:
        PIL Image resized to target dimensions, or None
    """
    if bg_type != 'image' or not bg_image_url:
        return None
    
    try:
        print(f"    Downloading image background...")
        image_path = os.path.join(work_dir, 'background_image.jpg')
        download_file(bg_image_url, image_path)
        
        # Load image
        img = Image.open(image_path)
        
        # Fix EXIF orientation (handles rotated phone photos)
        try:
            from PIL import ExifTags
            
            orientation_key = None
            for key, val in ExifTags.TAGS.items():
                if val == 'Orientation':
                    orientation_key = key
                    break
            
            if orientation_key and hasattr(img, '_getexif') and img._getexif():
                exif = img._getexif()
                if exif and orientation_key in exif:
                    orientation = exif[orientation_key]
                    
                    if orientation == 2:
                        img = img.transpose(Image.FLIP_LEFT_RIGHT)
                    elif orientation == 3:
                        img = img.rotate(180, expand=True)
                    elif orientation == 4:
                        img = img.transpose(Image.FLIP_TOP_BOTTOM)
                    elif orientation == 5:
                        img = img.transpose(Image.FLIP_LEFT_RIGHT).rotate(90, expand=True)
                    elif orientation == 6:
                        img = img.rotate(270, expand=True)
                    elif orientation == 7:
                        img = img.transpose(Image.FLIP_LEFT_RIGHT).rotate(270, expand=True)
                    elif orientation == 8:
                        img = img.rotate(90, expand=True)
                    
                    print(f"    Applied EXIF orientation fix: {orientation}")
        except Exception as exif_err:
            print(f"    Could not read EXIF data: {exif_err}")
        
        # Convert to RGB after rotation
        img = img.convert('RGB')
        
        img_ratio = img.width / img.height
        target_ratio = target_width / target_height
        
        if fit_mode == 'stretch':
            # STRETCH: Simply resize to target, may distort
            final_img = img.resize((target_width, target_height), Image.Resampling.LANCZOS)
            print(f"    Image background prepared (stretch): {target_width}x{target_height}")
            
        elif fit_mode == 'fit':
            # FIT/CONTAIN: Show entire image, add letterboxing
            if img_ratio > target_ratio:
                # Image is wider - fit to width
                new_width = target_width
                new_height = int(new_width / img_ratio)
            else:
                # Image is taller - fit to height
                new_height = target_height
                new_width = int(new_height * img_ratio)
            
            img_resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            
            # Create canvas with background color for letterboxing
            final_img = Image.new('RGB', (target_width, target_height), bg_color)
            
            # Center the image
            paste_x = (target_width - new_width) // 2
            paste_y = (target_height - new_height) // 2
            final_img.paste(img_resized, (paste_x, paste_y))
            print(f"    Image background prepared (fit): {target_width}x{target_height}, image: {new_width}x{new_height}")
            
        else:  # 'fill' (default) - COVER mode
            # FILL/COVER: Fill frame, crop edges
            if img_ratio > target_ratio:
                # Image is wider - fit to height, crop sides
                new_height = target_height
                new_width = int(new_height * img_ratio)
            else:
                # Image is taller - fit to width, crop top/bottom
                new_width = target_width
                new_height = int(new_width / img_ratio)
            
            img_resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            
            # Center crop
            left = (new_width - target_width) // 2
            top = (new_height - target_height) // 2
            right = left + target_width
            bottom = top + target_height
            
            final_img = img_resized.crop((left, top, right, bottom))
            print(f"    Image background prepared (fill): {target_width}x{target_height}")
        
        return final_img
        
    except Exception as e:
        print(f"    Failed to load image background: {e}")
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
        elif file_path.endswith('.json'):
            content_type = 'application/json'
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
        print(f" Uploaded to R2: {url}")
        return url
        
    except Exception as e:
        print(f" R2 upload error: {str(e)}")
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
        
        print(f"    Downloading font: {font_name}...")
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        
        with open(font_path, 'wb') as f:
            f.write(response.content)
        
        print(f"    Font downloaded: {font_name}")
        return font_path
    except Exception as e:
        print(f"    Failed to download font {font_name}: {e}")
        return None

def initialize_fonts():
    """Pre-download all custom fonts."""
    global _fonts_initialized
    if _fonts_initialized:
        return
    
    print(" Initializing fonts...")
    ensure_fonts_directory()
    
    for font_name in FONT_URLS.keys():
        font_path = FONT_PATHS.get(font_name)
        if not font_path or not os.path.exists(font_path):
            download_font(font_name)
    
    _fonts_initialized = True
    print(" Fonts initialized")

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
    print(f"    Audio with silence created: {output_path}")
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
        print("    No watermark logo URL configured")
        return None
    
    try:
        print(f"    Downloading watermark logo from {WATERMARK_LOGO_URL}")
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
        print(f"    Watermark logo loaded ({new_width}x{new_height})")
        return logo
        
    except Exception as e:
        print(f"    Failed to load watermark logo: {e}")
        return None


def get_custom_watermark(url):
    """Download and cache a custom watermark logo at original size.
    
    NOTE: Do NOT pre-shrink here. The apply_studio_watermark() function
    handles all sizing based on the user's logo_size setting.
    We only cap at 1000px to prevent memory issues with huge images.
    """
    global _custom_watermark_cache
    
    if not url:
        return None
    
    if url in _custom_watermark_cache:
        return _custom_watermark_cache[url]
    
    try:
        print(f"    Downloading custom watermark from {url}")
        response = requests.get(url)
        response.raise_for_status()
        
        from io import BytesIO
        logo = Image.open(BytesIO(response.content)).convert('RGBA')
        
        # Only cap at a large max to prevent memory issues with huge source images
        # The actual user-facing size is controlled by apply_studio_watermark()
        max_dimension = 1000
        if logo.width > max_dimension or logo.height > max_dimension:
            aspect_ratio = logo.height / logo.width
            if logo.width > logo.height:
                new_width = max_dimension
                new_height = int(new_width * aspect_ratio)
            else:
                new_height = max_dimension
                new_width = int(new_height / aspect_ratio)
            logo = logo.resize((new_width, new_height), Image.Resampling.LANCZOS)
            print(f"    Custom watermark capped to ({new_width}x{new_height})")
        
        _custom_watermark_cache[url] = logo
        print(f"    Custom watermark loaded ({logo.width}x{logo.height})")
        return logo
        
    except Exception as e:
        print(f"    Failed to load custom watermark: {e}")
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


def apply_studio_watermark(frame, video_width, video_height, logo_url, logo_position='bottom-right', logo_size=50, logo_opacity=80):
    """
    Apply custom logo watermark to frame with user-defined settings.
    
    Args:
        frame: PIL Image frame
        video_width: Width of video
        video_height: Height of video
        logo_url: URL of the logo image
        logo_position: Position string ('top-left', 'top-center', 'top-right', 
                       'bottom-left', 'bottom-center', 'bottom-right')
        logo_size: Size in pixels (20-150, will be scaled by resolution)
        logo_opacity: Opacity percentage (0-100)
    """
    # Ensure numeric types (values may arrive as strings from JSON)
    try:
        logo_size = int(float(logo_size))
    except (ValueError, TypeError):
        logo_size = 50
    try:
        logo_opacity = int(float(logo_opacity))
    except (ValueError, TypeError):
        logo_opacity = 80
    if not logo_position or not isinstance(logo_position, str):
        logo_position = 'bottom-right'
    
    # Log what we received (only on first frame to avoid spam)
    if not hasattr(apply_studio_watermark, '_logged'):
        print(f"    [LOGO DEBUG] url={logo_url}")
        print(f"    [LOGO DEBUG] position={logo_position}, size={logo_size}px, opacity={logo_opacity}%")
        apply_studio_watermark._logged = True
    
    logo = get_custom_watermark(logo_url)
    if not logo:
        return frame  # Return original if no custom watermark loaded
    
    # Create a copy of the frame to work with
    watermarked = frame.copy()
    
    # Scale logo based on video resolution AND user's size setting
    # Base resolution is 720p (1280x720)
    base_width = 1280
    resolution_scale = video_width / base_width
    
    # User's logo_size is in pixels at 720p, scale it for current resolution
    target_width = int(logo_size * resolution_scale)
    
    # Calculate height maintaining aspect ratio
    aspect_ratio = logo.height / logo.width
    target_height = int(target_width * aspect_ratio)
    
    # Ensure minimum size for visibility
    min_width = int(40 * resolution_scale)
    if target_width < min_width:
        target_width = min_width
        target_height = int(target_width * aspect_ratio)
    
    # Log the computed size (only once)
    if not hasattr(apply_studio_watermark, '_size_logged'):
        print(f"    [LOGO DEBUG] source_img={logo.width}x{logo.height}, target={target_width}x{target_height}, res_scale={resolution_scale:.2f}")
        apply_studio_watermark._size_logged = True
    
    # Resize logo
    scaled_logo = logo.resize((target_width, target_height), Image.Resampling.LANCZOS)
    
    # Calculate position based on logo_position setting
    padding = int(40 * resolution_scale)
    padding = max(20, padding)  # Minimum padding
    
    # Horizontal position
    if 'left' in logo_position:
        logo_x = padding
    elif 'right' in logo_position:
        logo_x = video_width - padding - scaled_logo.width
    else:  # center
        logo_x = (video_width - scaled_logo.width) // 2
    
    # Vertical position
    if 'top' in logo_position:
        logo_y = padding
    else:  # bottom (default)
        logo_y = video_height - padding - scaled_logo.height
    
    # Apply user's opacity setting (0-100 -> 0.0-1.0)
    opacity = logo_opacity / 100.0
    
    # Create version with user's opacity
    logo_with_opacity = scaled_logo.copy()
    alpha = logo_with_opacity.split()[3]
    alpha = alpha.point(lambda p: int(p * opacity))
    logo_with_opacity.putalpha(alpha)
    
    # Paste logo onto frame
    watermarked.paste(logo_with_opacity, (logo_x, logo_y), logo_with_opacity)
    
    return watermarked


def separate_vocals(audio_path, output_dir):
    """Use Demucs to separate vocals from instrumental"""
    print(" Separating vocals with Demucs...")
    
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
    
    print(" Vocal separation complete")
    return instrumental_path, vocals_path


# ============================================
# WAVEFORM GENERATION FOR TIMELINE EDITOR
# ============================================

def generate_waveform_data(audio_path, output_dir, samples_per_second=20):
    """
    Generate waveform amplitude data from an audio file.
    
    This creates a JSON file containing amplitude values at regular intervals,
    which can be used to display a waveform visualization in the frontend.
    
    Args:
        audio_path: Path to the audio file (vocals.wav)
        output_dir: Directory to save the waveform JSON
        samples_per_second: How many amplitude samples per second (default 20 = 50ms intervals)
    
    Returns:
        Path to the generated JSON file
    """
    print(" Generating waveform data...")
    
    try:
        # Load the audio file
        wav, sr = torchaudio.load(audio_path)
        
        # Convert to mono if stereo (average both channels)
        if wav.shape[0] > 1:
            wav = wav.mean(dim=0, keepdim=True)
        
        wav = wav.squeeze().numpy()
        
        # Calculate samples per chunk
        samples_per_chunk = int(sr / samples_per_second)
        
        # Total duration in seconds
        duration = len(wav) / sr
        
        # Number of data points
        num_points = int(duration * samples_per_second)
        
        print(f"   Audio duration: {duration:.2f}s")
        print(f"   Generating {num_points} waveform points ({samples_per_second} per second)")
        
        waveform_data = []
        
        for i in range(num_points):
            start_sample = i * samples_per_chunk
            end_sample = min(start_sample + samples_per_chunk, len(wav))
            
            if start_sample >= len(wav):
                break
            
            # Get the chunk of audio
            chunk = wav[start_sample:end_sample]
            
            # Calculate RMS (Root Mean Square) amplitude - better than peak for visualization
            rms = np.sqrt(np.mean(chunk ** 2))
            
            # Also get peak amplitude for dynamics
            peak = np.abs(chunk).max()
            
            # Use a combination of RMS and peak for a nice visual
            # RMS gives overall energy, peak gives transients
            amplitude = (rms * 0.7 + peak * 0.3)
            
            # Normalize to 0-1 range (will be normalized globally after)
            waveform_data.append(float(amplitude))
        
        # Normalize the entire waveform to 0-1 range
        if waveform_data:
            max_amp = max(waveform_data) if max(waveform_data) > 0 else 1
            waveform_data = [amp / max_amp for amp in waveform_data]
        
        # Create the output JSON structure
        waveform_json = {
            'version': 1,
            'samples_per_second': samples_per_second,
            'duration': duration,
            'sample_count': len(waveform_data),
            'amplitudes': waveform_data
        }
        
        # Save to JSON file
        waveform_path = os.path.join(output_dir, 'waveform.json')
        with open(waveform_path, 'w') as f:
            json.dump(waveform_json, f)
        
        print(f" Waveform data generated: {len(waveform_data)} samples")
        
        return waveform_path
        
    except Exception as e:
        print(f" Warning: Failed to generate waveform data: {e}")
        return None


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
    print(" Transcribing with AssemblyAI (precise alignment)...")
    
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
            print("    Transcription complete!")
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
    
    print(f" AssemblyAI returned {len(lyrics)} words with precise timestamps")
    
    # Debug: Show first 5 words and their timestamps
    print("    First 5 words timing:")
    for i, w in enumerate(lyrics[:5]):
        print(f"      {i+1}. '{w['word']}' at {w['start']:.2f}s - {w['end']:.2f}s")
    
    # If user provided lyrics, auto-correct low-confidence words first
    if user_lyrics_text and len(user_lyrics_text.strip()) > 50:
        print(" Checking for low-confidence words to auto-correct...")
        lyrics, correction_count = auto_correct_low_confidence_words(lyrics, user_lyrics_text)
        
        print(" Mapping user lyrics to AssemblyAI timestamps...")
        lyrics = align_user_lyrics_to_timestamps(user_lyrics_text, lyrics)

        # Debug: Show first 10 aligned words with gap analysis
        print("    First 10 aligned words timing:")
        for i, w in enumerate(lyrics[:10]):
            gap_info = ""
            if i > 0:
                gap = w['start'] - lyrics[i-1]['end']
                if gap > 0.5:
                    gap_info = f" ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ GAP: {gap:.2f}s"
            duration = w['end'] - w['start']
            print(f"      {i+1}. '{w['word']}' at {w['start']:.2f}s - {w['end']:.2f}s (duration: {duration:.2f}s){gap_info}")
        
        # Check for problematic timing patterns
        print("    Checking for timing issues...")
        issues_found = 0
        for i, w in enumerate(lyrics):
            duration = w['end'] - w['start']
            # Flag words with unusually long durations (> 3 seconds)
            if duration > 3.0:
                print(f"       Long word duration: '{w['word']}' lasts {duration:.2f}s (index {i})")
                issues_found += 1
            # Flag large gaps between words (> 5 seconds)
            if i > 0:
                gap = w['start'] - lyrics[i-1]['end']
                if gap > 5.0:
                    print(f"       Large gap before '{w['word']}': {gap:.2f}s gap (index {i})")
                    issues_found += 1
            # Flag if end time is before start time (shouldn't happen)
            if w['end'] < w['start']:
                print(f"       Invalid timing: '{w['word']}' ends before it starts! (index {i})")
                issues_found += 1
        
        if issues_found == 0:
            print("       No timing issues detected")
        else:
            print(f"       Found {issues_found} potential timing issues")
    
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
        print("    No API words - returning empty")
        return []
    
    if len(user_words) == 0:
        print("    No user words - using API transcription")
        return api_lyrics
    
    # Check if word counts match exactly
    if len(user_words) == len(api_lyrics):
        print(f"    Word counts match exactly - using user words with API timestamps")
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
        print(f"    Word similarity: {matches}/{len(user_words)} ({match_percentage:.1f}%) match after normalization")
        print(f"    Applied {len(line_break_indices)} line breaks from user lyrics")
        print(f" Aligned {len(aligned)} user words with AssemblyAI timestamps")
        return aligned
    
    # Word counts differ - check how different
    count_diff = abs(len(user_words) - len(api_lyrics))
    diff_percentage = (count_diff / max(len(user_words), len(api_lyrics))) * 100
    
    print(f"    Word count difference: {count_diff} words ({diff_percentage:.1f}%)")
    
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
                print(f"    Word similarity too low ({match_percentage:.1f}%) - using API transcription for accurate timing")
                print(f" Using {len(api_lyrics)} AssemblyAI words with original timestamps")
                return api_lyrics
            
            # Good match - use user words with API timestamps
            print(f"    Small difference - using user words with API timestamps (1:1 mapping)")
            aligned = []
            
            for i in range(len(user_words)):
                aligned.append({
                    'word': user_words[i],
                    'start': api_lyrics[i]['start'],
                    'end': api_lyrics[i]['end'],
                    'confidence': api_lyrics[i].get('confidence', 1.0),
                    'lineBreak': i in line_break_indices
                })
            
            print(f"    Word similarity: {matches}/{len(user_words)} ({match_percentage:.1f}%) match after normalization")
            print(f"    Applied {len(line_break_indices)} line breaks from user lyrics")
            print(f" Aligned {len(aligned)} user words (API had {len(api_lyrics) - len(user_words)} extra)")
            return aligned
        else:
            # User has MORE words than API - fit user words to available timestamps
            print(f"    User has more words - fitting {len(user_words)} user words to {len(api_lyrics)} timestamps")
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
            print(f"    Combined {len(user_words)} user words into {len(aligned)} timed slots")
            print(f"    Applied {applied_breaks} line breaks from user lyrics")
            print(f" Aligned user lyrics with {extra_words} extra words distributed across timestamps")
            return aligned
    
    # Word counts too different - use API transcription for perfect timing
    print(f"    Word counts too different - using API transcription for perfect timing")
    print(f" Using {len(api_lyrics)} AssemblyAI words with original timestamps")
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
                print(f"       Auto-corrected: '{api_word['word']}'  '{user_word}' (confidence: {confidence:.0%})")
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
        print(f"    Auto-corrected {corrections} low-confidence words using uploaded lyrics")
    
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


def create_intro_frame(artist, title, frame_num, total_frames, width, height, colors=None, bg_image=None, video_reader=None, current_time=0, start_image=None, start_image_fit='fill', start_image_opacity=100, start_image_show_title=True):
    """Create intro screen frame with fade in/out. Supports optional start image overlay."""
    img = create_frame(width, height, colors, bg_image, video_reader, current_time)
    
    # Overlay start image if provided
    if start_image is not None:
        try:
            si = start_image.copy()
            
            # Resize start image based on fit mode
            if start_image_fit == 'stretch':
                # Stretch to fill exactly (may distort)
                si = si.resize((width, height), Image.Resampling.LANCZOS)
            elif start_image_fit == 'contain' or start_image_fit == 'fit':
                # Show entire image, letterbox if needed
                si_ratio = si.width / si.height
                frame_ratio = width / height
                if si_ratio > frame_ratio:
                    new_w = width
                    new_h = int(width / si_ratio)
                else:
                    new_h = height
                    new_w = int(height * si_ratio)
                si = si.resize((new_w, new_h), Image.Resampling.LANCZOS)
                # Center on a blank frame
                centered = Image.new('RGBA', (width, height), (0, 0, 0, 0))
                paste_x = (width - new_w) // 2
                paste_y = (height - new_h) // 2
                centered.paste(si, (paste_x, paste_y))
                si = centered
            else:
                # 'fill' / 'cover' - crop to fill frame
                si_ratio = si.width / si.height
                frame_ratio = width / height
                if si_ratio > frame_ratio:
                    new_h = height
                    new_w = int(height * si_ratio)
                else:
                    new_w = width
                    new_h = int(width / si_ratio)
                si = si.resize((new_w, new_h), Image.Resampling.LANCZOS)
                # Center crop
                crop_x = (new_w - width) // 2
                crop_y = (new_h - height) // 2
                si = si.crop((crop_x, crop_y, crop_x + width, crop_y + height))
            
            # Apply opacity
            opacity = max(0, min(100, int(start_image_opacity)))
            if opacity < 100:
                # Convert to RGBA if not already
                if si.mode != 'RGBA':
                    si = si.convert('RGBA')
                # Create alpha mask
                alpha = si.split()[3] if si.mode == 'RGBA' else Image.new('L', si.size, 255)
                alpha = alpha.point(lambda p: int(p * opacity / 100))
                si.putalpha(alpha)
            
            # Composite onto frame
            if si.mode == 'RGBA':
                img = img.convert('RGBA')
                img = Image.alpha_composite(img, si)
                img = img.convert('RGB')
            else:
                img.paste(si, (0, 0))
        except Exception as e:
            print(f"    Warning: Failed to overlay start image: {e}")
    
    # Only draw title/artist text if show_title is enabled
    if start_image_show_title or start_image is None:
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


def create_instrumental_break_frame(current_time, gap_start, gap_end, width, height, lyrics, display_mode, colors=None, bg_image=None, video_reader=None):
    """
    Create frame for instrumental breaks with a PROGRESS BAR instead of countdown dots.
    
    NEW in 6.0: Replaces the old countdown dots with a smooth progress bar.
    
    Args:
        current_time: Current playback time
        gap_start: When the gap started
        gap_end: When the gap ends (next lyrics start)
        width, height: Frame dimensions
        lyrics: Full lyrics array
        display_mode: scroll/page/overwrite
        colors: Color settings
        bg_image: Optional background image
        video_reader: Optional video background reader
    """
    # Check if we should show sweep-in bar instead of progress bar
    time_until_lyrics = gap_end - current_time
    gap_duration = gap_end - gap_start
    
    sweep_duration = calculate_sweep_in_duration(gap_duration)
    
    # If we're in the sweep-in window, just return the normal lyrics frame
    # (the sweep-in bar is drawn by the lyrics frame functions)
    if sweep_duration > 0 and time_until_lyrics <= sweep_duration:
        # Let the normal lyrics frame handle the sweep-in bar
        if display_mode == 'scroll':
            return create_scroll_frame(current_time, lyrics, width, height, colors, bg_image, video_reader, current_time)
        elif display_mode == 'page':
            return create_page_frame(current_time, lyrics, width, height, colors, bg_image, video_reader, current_time)
        else:
            return create_overwrite_frame(current_time, lyrics, width, height, colors, bg_image, video_reader, current_time)
    
    # Create base frame with background
    img = create_frame(width, height, colors, bg_image, video_reader, current_time)
    draw = ImageDraw.Draw(img)
    
    scale = width / 1920
    
    # Get colors
    highlight_color = colors.get('sung', COLOR_HIGHLIGHT) if colors else COLOR_HIGHLIGHT
    text_color = colors.get('text', COLOR_TEXT) if colors else COLOR_TEXT
    outline_color = colors.get('outline', (0, 0, 0)) if colors else (0, 0, 0)
    
    # Calculate progress (0 at gap_start, 1 at gap_end - sweep_duration)
    progress_bar_end_time = gap_end - sweep_duration if sweep_duration > 0 else gap_end
    progress_bar_duration = progress_bar_end_time - gap_start
    
    if progress_bar_duration > 0:
        progress = (current_time - gap_start) / progress_bar_duration
        progress = max(0, min(1, progress))
    else:
        progress = 1
    
    # Draw progress bar in upper portion of screen
    bar_y = int(height * 0.35)  # 35% from top
    draw_progress_bar(draw, width // 2, bar_y, progress, highlight_color, width, height, scale)
    
    # Draw upcoming lyrics preview below the progress bar
    font_size_scale = colors.get('font_size_scale', 1.0) if colors else 1.0
    font_name = colors.get('font', 'arial') if colors else 'arial'
    font = get_font(int(FONT_SIZE_LYRICS * scale * font_size_scale * 0.7), font_name, colors.get('custom_font_path') if colors else None)
    
    # Find the line that starts at gap_end
    lines = group_lyrics_into_lines(lyrics)
    next_line_words = []
    for line in lines:
        if line and line[0]['start'] >= gap_end - 0.1:
            next_line_words = line
            break
    
    if next_line_words:
        preview_text = ' '.join(w['word'] for w in next_line_words)
        preview_y = int(height * 0.45)  # Below the progress bar
        
        # Calculate centered position
        bbox = draw.textbbox((0, 0), preview_text, font=font)
        text_width = bbox[2] - bbox[0]
        text_x = (width - text_width) // 2
        
        # Draw with reduced opacity
        preview_color = tuple(int(c * 0.6) for c in text_color)
        draw_text_with_outline(draw, preview_text, text_x, preview_y, font, preview_color, outline_color, scale=scale)
    
    return img


def create_countdown_frame_with_preview(countdown_time, width, height, lyrics, gap_end_time, display_mode, colors=None, total_dots=6, bg_image=None, video_reader=None, current_time=0):
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


# ============================================
# SWEEP HIGHLIGHTING FUNCTIONS (NEW in 6.0)
# ============================================

# Cache for text width calculations (cleared per video)
_text_width_cache = {}

def get_text_width(draw, text, font):
    """Get text width with caching for performance."""
    cache_key = (id(font), text)
    if cache_key not in _text_width_cache:
        bbox = draw.textbbox((0, 0), text, font=font)
        _text_width_cache[cache_key] = bbox[2] - bbox[0]
    return _text_width_cache[cache_key]

def clear_text_width_cache():
    """Clear the text width cache (call at start of each video)."""
    global _text_width_cache
    _text_width_cache = {}

def calculate_word_sweep_percent(current_time, word_start, word_end):
    """
    Calculate the sweep percentage for a word.
    Returns 0-100 representing how much of the word should be highlighted.
    """
    if current_time < word_start:
        return 0
    if current_time >= word_end:
        return 100
    
    duration = word_end - word_start
    if duration <= 0:
        return 100
    
    elapsed = current_time - word_start
    return min(100, max(0, (elapsed / duration) * 100))


def calculate_sweep_in_duration(gap_duration):
    """
    Determine the sweep-in duration based on gap length.
    Returns the sweep duration in seconds, or 0 if no sweep.
    """
    if gap_duration >= SWEEP_IN_LONG_MIN_GAP:
        return SWEEP_IN_LONG_DURATION  # 2 second sweep
    elif gap_duration >= SWEEP_IN_SHORT_MIN_GAP:
        return SWEEP_IN_SHORT_DURATION  # 1 second sweep
    return 0  # No sweep


def draw_word_with_sweep(draw, word, x, y, font, sweep_percent, highlight_color, unsung_color, outline_color, img=None, scale=1.0):
    """
    Draw a word with left-to-right sweep highlighting.
    
    OPTIMIZED VERSION (v6.2): Splits word at sweep point, draws only 2 text calls.
    
    Method:
    - Find which character the sweep is at
    - Draw highlighted portion (left side) as one string
    - Draw unsung portion (right side) as one string
    - Only 2 draw_text calls instead of N characters
    
    Args:
        draw: PIL ImageDraw object
        word: Text to draw
        x: X position
        y: Y position  
        font: PIL font object
        sweep_percent: 0-100, how much of the word is highlighted
        highlight_color: RGB tuple for highlighted text
        unsung_color: RGB tuple for unhighlighted text
        outline_color: RGB tuple for text outline
        img: PIL Image (unused, kept for compatibility)
        scale: Resolution scale factor (1.0 for 1080p, 2.0 for 4K)
    """
    if sweep_percent <= 0:
        # Not started - draw entire word in unsung color
        draw_text_with_outline(draw, word, x, y, font, unsung_color, outline_color, scale=scale)
        return
    
    if sweep_percent >= 100:
        # Fully sung - draw in highlight color, NO glow (glow only while actively singing)
        draw_text_with_outline(draw, word, x, y, font, highlight_color, outline_color, scale=scale)
        return
    
    # Find the split point based on sweep_percent
    # We split at character boundaries for clean rendering
    total_chars = len(word)
    split_index = int(total_chars * sweep_percent / 100)
    split_index = max(0, min(total_chars, split_index))
    
    if split_index == 0:
        # No characters highlighted yet
        draw_text_with_outline(draw, word, x, y, font, unsung_color, outline_color, scale=scale)
        return
    
    if split_index >= total_chars:
        # All characters highlighted (still actively singing this word)
        draw_text_with_outline(draw, word, x, y, font, highlight_color, outline_color, glow=True, glow_color=highlight_color, scale=scale)
        return
    
    # Split the word
    highlighted_part = word[:split_index]
    unsung_part = word[split_index:]
    
    # Get width of highlighted part to position unsung part (cached)
    highlighted_width = get_text_width(draw, highlighted_part, font)
    
    # Draw highlighted part (left) - WITH glow since actively singing
    draw_text_with_outline(draw, highlighted_part, x, y, font, highlight_color, outline_color, glow=True, glow_color=highlight_color, scale=scale)
    
    # Draw unsung part (right) - no glow
    draw_text_with_outline(draw, unsung_part, x + highlighted_width, y, font, unsung_color, outline_color, scale=scale)


def draw_text_with_outline(draw, text, x, y, font, color, outline_color, glow=False, glow_color=None, scale=1.0):
    """
    Draw text with an outline for better visibility.
    
    Glow creates a soft feathered halo BEHIND the text.
    The glow uses multiple layers with decreasing opacity for a smooth falloff.
    
    Args:
        draw: PIL ImageDraw object
        text: Text to draw
        x: X position
        y: Y position
        font: PIL font object
        color: RGB tuple for main text color
        outline_color: RGB tuple for outline color
        glow: Whether to draw glow effect
        glow_color: RGB tuple for glow color (defaults to color if None)
        scale: Resolution scale factor (1.0 for 1080p, 2.0 for 4K)
    """
    # Scale all offsets based on resolution
    outline_offset = max(1, int(2 * scale))  # Thicker outline for visibility
    
    # Draw feathered glow FIRST (behind everything) if requested
    if glow and glow_color:
        # For proper glow, we need to draw on a temporary layer with alpha
        # Since PIL doesn't support this easily, we use a different approach:
        # Draw the glow color directly at various offsets with the full color
        # The overlapping creates the glow effect
        
        # Use the actual glow color (not darkened) at multiple offsets
        # The layering creates the soft halo effect
        glow_layers = [
            # (offset, count) - larger offsets with more draws
            (int(8 * scale), 12),   # Outermost ring
            (int(6 * scale), 10),   # Middle ring  
            (int(4 * scale), 8),    # Inner ring
            (int(2 * scale), 6),    # Innermost ring
        ]
        
        import math
        
        for offset, num_points in glow_layers:
            if offset < 1:
                continue
            # Draw at evenly spaced points around a circle
            for i in range(num_points):
                angle = (2 * math.pi * i) / num_points
                ox = int(offset * math.cos(angle))
                oy = int(offset * math.sin(angle))
                # Use a semi-transparent version of the glow color
                # Opacity decreases with distance
                opacity = 0.15 if offset > int(6 * scale) else 0.2 if offset > int(4 * scale) else 0.25
                glow_fill = tuple(int(c * opacity) for c in glow_color)
                draw.text((x + ox, y + oy), text, font=font, fill=glow_fill)
    
    # Draw outline SECOND (behind text, in front of glow)
    # Use 8 offsets for thicker, more visible outline
    outline_offsets = [
        (-outline_offset, -outline_offset),
        (-outline_offset, outline_offset),
        (outline_offset, -outline_offset),
        (outline_offset, outline_offset),
        (-outline_offset, 0),
        (outline_offset, 0),
        (0, -outline_offset),
        (0, outline_offset),
    ]
    
    for ox, oy in outline_offsets:
        draw.text((x + ox, y + oy), text, font=font, fill=outline_color)
    
    # Draw main text LAST (on top of everything)
    draw.text((x, y), text, font=font, fill=color)


def draw_sweep_in_bar(draw, x, y, progress, color, width, height, scale=1.0):
    """
    Draw the sweep-in bar that appears before lyrics start.
    
    The bar is a gradient that fades from transparent to solid color.
    NO black/dark colors - only the highlight color with varying opacity.
    
    Args:
        draw: PIL ImageDraw object
        x: X position (where it meets the first letter - bar extends LEFT from here)
        y: Y position (vertical CENTER of the bar/text line)
        progress: 0-1, where 0 = full bar, 1 = bar disappeared
        color: RGB tuple for the bar color (the highlight/sung color)
        width: Frame width for scaling
        height: Bar height in pixels (line height)
        scale: Scale factor based on resolution
    """
    max_bar_width = int(SWEEP_IN_BAR_WIDTH * scale)
    current_width = int(max_bar_width * (1 - progress))
    
    if current_width < 2:
        return
    
    # Bar height should match the font's cap height (about 70% of line height)
    bar_height = int(height * 0.70)
    
    # Position: bar ends at x (touching the first letter), extends left
    # Add small overlap into first letter for seamless transition
    bar_right = x + int(4 * scale)
    bar_left = bar_right - current_width
    
    # y is the CENTER of the text line, so center the bar vertically
    bar_top = y - bar_height // 2
    
    # Draw gradient segments - ONLY using the highlight color, no black
    num_segments = max(10, min(50, current_width))
    segment_width = current_width / num_segments
    
    for i in range(num_segments):
        seg_x = bar_left + (i * segment_width)
        
        # Gradient: transparent on left, solid on right
        # Use smooth curve for natural fade-in
        t = i / num_segments
        # Ease-in curve: starts slow, accelerates
        blend_factor = t * t * t  # Cubic ease-in for very smooth gradient
        
        # Only draw if there's actual color to show (skip near-zero segments)
        if blend_factor < 0.01:
            continue
            
        # Use the highlight color with varying intensity
        # This creates the gradient WITHOUT any black
        blended_color = tuple(int(c * blend_factor) for c in color)
        
        # Draw this segment
        draw.rectangle(
            [(int(seg_x), bar_top), (int(seg_x + segment_width + 1), bar_top + bar_height)],
            fill=blended_color
        )


def draw_progress_bar(draw, x, y, progress, color, width, height, scale=1.0):
    """
    Draw the progress bar shown during instrumental breaks.
    
    Args:
        draw: PIL ImageDraw object
        x: X position (center)
        y: Y position (center)
        progress: 0-1, where 0 = empty, 1 = full
        color: RGB tuple for the bar color
        width: Frame width
        height: Frame height
        scale: Scale factor
    """
    bar_width = int(200 * scale)
    bar_height = int(12 * scale)
    
    bar_left = x - bar_width // 2
    bar_top = y - bar_height // 2
    
    # Draw background bar (dim)
    bg_color = (60, 60, 60)
    draw.rounded_rectangle(
        [(bar_left, bar_top), (bar_left + bar_width, bar_top + bar_height)],
        radius=bar_height // 2,
        fill=bg_color
    )
    
    # Draw fill bar
    fill_width = int(bar_width * progress)
    if fill_width > 0:
        # Draw gradient fill (approximated with solid + glow)
        draw.rounded_rectangle(
            [(bar_left, bar_top), (bar_left + fill_width, bar_top + bar_height)],
            radius=bar_height // 2,
            fill=color
        )


def create_scroll_frame(current_time, lyrics, width, height, colors=None, bg_image=None, video_reader=None, frame_time=None):
    """
    Create TELEPROMPTER-STYLE scrolling lyrics frame with SWEEP HIGHLIGHTING.
    
    NEW in 6.0: Character-by-character sweep effect instead of instant word highlight.
    """
    # Use frame_time for video background if provided, otherwise use current_time
    bg_time = frame_time if frame_time is not None else current_time
    img = create_frame(width, height, colors, bg_image, video_reader, bg_time)
    draw = ImageDraw.Draw(img)
    
    # Get colors or use defaults
    text_color = colors.get('text', COLOR_TEXT) if colors else COLOR_TEXT
    sung_color = colors.get('sung', COLOR_SUNG) if colors else COLOR_SUNG
    highlight_color = colors.get('sung', COLOR_HIGHLIGHT) if colors else COLOR_HIGHLIGHT
    outline_color = colors.get('outline', (0, 0, 0)) if colors else (0, 0, 0)
    upcoming_color = colors.get('text', COLOR_UPCOMING) if colors else COLOR_UPCOMING
    unsung_color = (200, 200, 200)  # Light gray for words not yet sung
    
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
    
    # V12: For portrait (9:16), boost line spacing so lines spread across the taller frame
    if height > width:
        portrait_line_boost = height / width  # e.g. 1920/1080 = 1.78
        line_height = int(line_height * portrait_line_boost)
    
    # V12: Emphasize current line - create a larger font (1.3x) for the active line
    emphasize = colors.get('emphasize_current_line', False) if colors else False
    if emphasize:
        emphasis_scale = 1.3
        font_emphasized = get_font(int(FONT_SIZE_LYRICS * scale * font_size_scale * emphasis_scale), font_name, colors.get('custom_font_path') if colors else None)
    else:
        font_emphasized = font
    
    lines = group_lyrics_into_lines(lyrics)
    
    if not lines:
        return img
    
    # Find current line index
    current_line_idx = 0
    for i, line in enumerate(lines):
        if line and line[-1]['end'] >= current_time:
            current_line_idx = i
            break
        current_line_idx = i
    
    # Calculate scroll progress within current line
    scroll_progress = 0
    if current_line_idx < len(lines):
        line = lines[current_line_idx]
        if line:
            line_start = line[0]['start']
            line_end = line[-1]['end']
            if line_end > line_start:
                scroll_progress = (current_time - line_start) / (line_end - line_start)
                scroll_progress = max(0, min(1, scroll_progress))
    
    # V12: Use lines_per_scroll from settings - this is the exact number of lines
    # the user wants visible on screen (matching the preview)
    lines_per_scroll = colors.get('lines_per_scroll', 5) if colors else 5
    visible_lines = lines_per_scroll  # Show exactly what the user selected
    center_y = height // 2
    
    for offset in range(-visible_lines // 2, visible_lines // 2 + 1):
        line_idx = current_line_idx + offset
        
        if 0 <= line_idx < len(lines):
            line = lines[line_idx]
            
            # V12: Use emphasized font for current line if enabled
            is_current = (line_idx == current_line_idx)
            line_font = font_emphasized if (emphasize and is_current) else font
            
            base_y = center_y + (offset * line_height)
            scroll_offset = scroll_progress * line_height
            y = base_y - int(scroll_offset)
            
            if y < -line_height or y > height + line_height:
                continue
            
            # Calculate total width for centering (using the appropriate font)
            total_width = sum(draw.textbbox((0, 0), w['word'] + ' ', font=line_font)[2] for w in line)
            x_start = (width - total_width) // 2
            x_start = max(padding, x_start)
            x = x_start
            
            # Check for sweep-in bar (before current line starts)
            if is_current and line:
                first_word_start = line[0]['start']
                
                # Calculate gap from previous line
                if line_idx > 0:
                    prev_line = lines[line_idx - 1]
                    prev_line_end = prev_line[-1]['end'] if prev_line else 0
                else:
                    prev_line_end = 0
                
                gap_duration = first_word_start - prev_line_end
                sweep_duration = calculate_sweep_in_duration(gap_duration)
                
                # Show sweep-in bar if we're in the sweep window
                if sweep_duration > 0:
                    time_until_line = first_word_start - current_time
                    if 0 < time_until_line <= sweep_duration:
                        sweep_progress = 1 - (time_until_line / sweep_duration)
                        # Draw sweep-in bar to the left of the first word
                        draw_sweep_in_bar(draw, x_start, y + line_height // 2, sweep_progress, highlight_color, width, line_height, scale)
            
            # Draw each word with sweep effect
            for word_idx, word_data in enumerate(line):
                word = word_data['word'] + ' '
                word_bbox = draw.textbbox((0, 0), word, font=line_font)
                word_width = word_bbox[2] - word_bbox[0]
                
                if line_idx < current_line_idx:
                    # Past line - fully highlighted
                    draw_text_with_outline(draw, word, x, y, font, sung_color, outline_color, scale=scale)
                elif is_current:
                    # Current line - use sweep highlighting with emphasized font
                    sweep_percent = calculate_word_sweep_percent(current_time, word_data['start'], word_data['end'])
                    
                    if x + word_width <= width - padding:
                        draw_word_with_sweep(draw, word, x, y, line_font, sweep_percent, highlight_color, unsung_color, outline_color, img, scale=scale)
                else:
                    # Upcoming line
                    draw_text_with_outline(draw, word, x, y, font, upcoming_color, outline_color, scale=scale)
                
                x += word_width
    
    return img


def create_page_frame(current_time, lyrics, width, height, colors=None, bg_image=None, video_reader=None, frame_time=None):
    """
    Create frame with page-by-page lyrics display with SWEEP HIGHLIGHTING.
    
    NEW in 6.0: Character-by-character sweep effect.
    """
    # Use frame_time for video background if provided, otherwise use current_time
    bg_time = frame_time if frame_time is not None else current_time
    img = create_frame(width, height, colors, bg_image, video_reader, bg_time)
    draw = ImageDraw.Draw(img)
    
    # Get colors or use defaults
    text_color = colors.get('text', COLOR_TEXT) if colors else COLOR_TEXT
    sung_color = colors.get('sung', COLOR_SUNG) if colors else COLOR_SUNG
    highlight_color = colors.get('sung', COLOR_HIGHLIGHT) if colors else COLOR_HIGHLIGHT
    outline_color = colors.get('outline', (0, 0, 0)) if colors else (0, 0, 0)
    unsung_color = (200, 200, 200)  # Light gray for words not yet sung
    
    # Get font settings
    font_size_scale = colors.get('font_size_scale', 1.0) if colors else 1.0
    font_name = colors.get('font', 'arial') if colors else 'arial'
    
    scale = width / 1920
    font = get_font(int(FONT_SIZE_LYRICS * scale * font_size_scale), font_name, colors.get('custom_font_path') if colors else None)
    line_height = int(FONT_SIZE_LYRICS * LINE_HEIGHT_MULTIPLIER * scale * font_size_scale)
    padding = int(PADDING_LEFT_RIGHT * scale)
    
    # V12: For portrait (9:16), boost line spacing so lines spread across the taller frame
    if height > width:
        portrait_line_boost = height / width
        line_height = int(line_height * portrait_line_boost)
    
    # V12: Emphasize current line - create a larger font (1.3x) for the active line
    emphasize = colors.get('emphasize_current_line', False) if colors else False
    if emphasize:
        emphasis_scale = 1.3
        font_emphasized = get_font(int(FONT_SIZE_LYRICS * scale * font_size_scale * emphasis_scale), font_name, colors.get('custom_font_path') if colors else None)
    else:
        font_emphasized = font
    
    lines = group_lyrics_into_lines(lyrics)
    
    # V12: Use lines_per_page from user settings instead of hardcoded constant
    lines_per_page = colors.get('lines_per_page', 4) if colors else 4
    
    pages = []
    for i in range(0, len(lines), lines_per_page):
        pages.append(lines[i:i + lines_per_page])
    
    current_line_idx = 0
    for i, line in enumerate(lines):
        if line and line[-1]['end'] >= current_time:
            current_line_idx = i
            break
        current_line_idx = i
    
    current_page_idx = current_line_idx // lines_per_page
    current_page_idx = min(current_page_idx, len(pages) - 1)
    
    if current_page_idx < len(pages):
        page = pages[current_page_idx]
        
        total_height = len(page) * line_height
        start_y = (height - total_height) // 2
        
        for i, line in enumerate(page):
            y = start_y + (i * line_height)
            line_idx_global = current_page_idx * lines_per_page + i
            
            # V12: Use emphasized font for current line
            is_current = (line_idx_global == current_line_idx)
            line_font = font_emphasized if (emphasize and is_current) else font
            
            total_width = sum(draw.textbbox((0, 0), w['word'] + ' ', font=line_font)[2] for w in line)
            x_start = (width - total_width) // 2
            x_start = max(padding, x_start)
            x = x_start
            
            # Check for sweep-in bar (before current line starts)
            if is_current and line:
                first_word_start = line[0]['start']
                
                # Calculate gap from previous line
                if line_idx_global > 0 and line_idx_global - 1 < len(lines):
                    prev_line = lines[line_idx_global - 1]
                    prev_line_end = prev_line[-1]['end'] if prev_line else 0
                else:
                    prev_line_end = 0
                
                gap_duration = first_word_start - prev_line_end
                sweep_duration = calculate_sweep_in_duration(gap_duration)
                
                if sweep_duration > 0:
                    time_until_line = first_word_start - current_time
                    if 0 < time_until_line <= sweep_duration:
                        sweep_progress = 1 - (time_until_line / sweep_duration)
                        draw_sweep_in_bar(draw, x_start, y + line_height // 2, sweep_progress, highlight_color, width, line_height, scale)
            
            for word_data in line:
                word = word_data['word'] + ' '
                word_bbox = draw.textbbox((0, 0), word, font=line_font)
                word_width = word_bbox[2] - word_bbox[0]
                
                if line_idx_global < current_line_idx:
                    # Past line - fully sung
                    draw_text_with_outline(draw, word, x, y, font, sung_color, outline_color, scale=scale)
                elif is_current:
                    # Current line - use sweep highlighting with emphasized font
                    sweep_percent = calculate_word_sweep_percent(current_time, word_data['start'], word_data['end'])
                    draw_word_with_sweep(draw, word, x, y, line_font, sweep_percent, highlight_color, unsung_color, outline_color, img, scale=scale)
                else:
                    # Upcoming line
                    draw_text_with_outline(draw, word, x, y, font, text_color, outline_color, scale=scale)
                
                x += word_width
    
    return img


def create_overwrite_frame(current_time, lyrics, width, height, colors=None, bg_image=None, video_reader=None, frame_time=None):
    """
    Create frame with TRUE overwrite-style lyrics display with SWEEP HIGHLIGHTING.
    
    3 fixed positions on screen:
    - Position 0 (top): shows lines 0, 3, 6, 9...
    - Position 1 (middle): shows lines 1, 4, 7, 10...
    - Position 2 (bottom): shows lines 2, 5, 8, 11...
    
    NEW in 6.0: Character-by-character sweep effect.
    """
    # Use frame_time for video background if provided, otherwise use current_time
    bg_time = frame_time if frame_time is not None else current_time
    img = create_frame(width, height, colors, bg_image, video_reader, bg_time)
    draw = ImageDraw.Draw(img)
    
    # Get colors or use defaults
    text_color = colors.get('text', COLOR_TEXT) if colors else COLOR_TEXT
    sung_color = colors.get('sung', COLOR_SUNG) if colors else COLOR_SUNG
    highlight_color = colors.get('sung', COLOR_HIGHLIGHT) if colors else COLOR_HIGHLIGHT
    outline_color = colors.get('outline', (0, 0, 0)) if colors else (0, 0, 0)
    upcoming_color = colors.get('text', COLOR_UPCOMING) if colors else COLOR_UPCOMING
    unsung_color = (200, 200, 200)  # Light gray for words not yet sung
    
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
    
    # V12: For portrait (9:16), boost line spacing so lines spread across the taller frame
    if height > width:
        portrait_line_boost = height / width
        line_height = int(line_height * portrait_line_boost)
    
    # V12: Emphasize current line - create a larger font (1.3x) for the active line
    emphasize = colors.get('emphasize_current_line', False) if colors else False
    if emphasize:
        emphasis_scale = 1.3
        font_emphasized = get_font(int(FONT_SIZE_LYRICS * scale * font_size_scale * emphasis_scale), font_name, colors.get('custom_font_path') if colors else None)
    else:
        font_emphasized = font
    
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
    
    # V12: Use lines_per_overwrite from user settings instead of hardcoded 3
    NUM_POSITIONS = colors.get('lines_per_overwrite', 4) if colors else 4
    
    # Calculate vertical positions - centered on screen
    total_display_height = NUM_POSITIONS * line_height
    start_y = (height - total_display_height) // 2
    
    # Show the current line and the next (NUM_POSITIONS - 1) upcoming lines
    lines_to_show = [current_line_idx + i for i in range(NUM_POSITIONS)]
    
    for line_idx in lines_to_show:
        # Skip if line doesn't exist
        if line_idx < 0 or line_idx >= len(lines):
            continue
        
        line = lines[line_idx]
        
        # V12: Use emphasized font for current line
        is_current = (line_idx == current_line_idx)
        line_font = font_emphasized if (emphasize and is_current) else font
        
        # This line's fixed position
        position = line_idx % NUM_POSITIONS
        y = start_y + (position * line_height)
        
        # Calculate total width for centering (using the appropriate font)
        total_width = sum(draw.textbbox((0, 0), w['word'] + ' ', font=line_font)[2] for w in line)
        x_start = (width - total_width) // 2
        x_start = max(padding, x_start)
        x = x_start
        
        # Check for sweep-in bar (before current line starts)
        if is_current and line:
            first_word_start = line[0]['start']
            
            # Calculate gap from previous line
            if line_idx > 0:
                prev_line = lines[line_idx - 1]
                prev_line_end = prev_line[-1]['end'] if prev_line else 0
            else:
                prev_line_end = 0
            
            gap_duration = first_word_start - prev_line_end
            sweep_duration = calculate_sweep_in_duration(gap_duration)
            
            if sweep_duration > 0:
                time_until_line = first_word_start - current_time
                if 0 < time_until_line <= sweep_duration:
                    sweep_progress = 1 - (time_until_line / sweep_duration)
                    draw_sweep_in_bar(draw, x_start, y + line_height // 2, sweep_progress, highlight_color, width, line_height, scale)
        
        # Draw each word in the line
        for word_data in line:
            word = word_data['word'] + ' '
            word_bbox = draw.textbbox((0, 0), word, font=line_font)
            word_width = word_bbox[2] - word_bbox[0]
            
            if line_idx < current_line_idx:
                # Already sung
                draw_text_with_outline(draw, word, x, y, font, sung_color, outline_color, scale=scale)
            elif is_current:
                # Current line - use sweep highlighting with emphasized font
                sweep_percent = calculate_word_sweep_percent(current_time, word_data['start'], word_data['end'])
                draw_word_with_sweep(draw, word, x, y, line_font, sweep_percent, highlight_color, unsung_color, outline_color, img, scale=scale)
            else:
                # Upcoming lines
                draw_text_with_outline(draw, word, x, y, font, upcoming_color, outline_color, scale=scale)
            
            x += word_width
    
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


def generate_video(audio_path, lyrics, gaps, track_info, output_path, video_quality, display_mode, style_options=None, subscription_tier='free', custom_watermark_url=None, outro_text=None, bg_type='gradient', bg_video_path=None, bg_image=None, logo_url=None, logo_position='bottom-right', logo_size=50, logo_opacity=80, start_image_url=None, start_image_fit='fill', start_image_opacity=100, start_image_show_title=True):
    """Generate video with lyrics and countdown. Supports video/image backgrounds."""
    print(f"Generating video (mode: {display_mode}, background: {bg_type})...")
    print(f"   Subscription tier: {subscription_tier}")
    
    # Reset one-time debug log flags for apply_studio_watermark
    if hasattr(apply_studio_watermark, '_logged'):
        del apply_studio_watermark._logged
    if hasattr(apply_studio_watermark, '_size_logged'):
        del apply_studio_watermark._size_logged
    
    # Log logo settings received by generate_video
    print(f"    [LOGO GENERATE] logo_url={logo_url}")
    print(f"    [LOGO GENERATE] logo_position={logo_position}, logo_size={logo_size}, logo_opacity={logo_opacity}")
    print(f"    [LOGO GENERATE] custom_watermark_url={custom_watermark_url}")
    
    # Clear caches for fresh video generation
    clear_text_width_cache()
    
    # Determine watermark behavior based on tier
    # Free: Karatrack watermark
    # Starter/Pro: No watermark
    # Studio: Custom watermark (if provided)
    apply_watermark_to_video = subscription_tier == 'free'
    apply_custom_watermark = subscription_tier == 'studio' and custom_watermark_url
    
    if apply_watermark_to_video:
        print("    Karatrack watermark will be applied (free tier)")
    elif apply_custom_watermark:
        print(f"    Custom watermark will be applied (Studio tier)")
    else:
        print("    No watermark (paid tier)")
    
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
        # V12: Layout settings for scroll/page modes
        'lines_per_scroll': style_options.get('lines_per_scroll', 5),
        'lines_per_page': style_options.get('lines_per_page', 4),
        'lines_per_overwrite': style_options.get('lines_per_overwrite', 4),
        'emphasize_current_line': style_options.get('emphasize_current_line', False),
    }
    
    print(f"    Colors: bg={colors['bg_1']}, text={colors['text']}, sung={colors['sung']}, font={colors['font']}, font_scale={font_size_scale}")
    print(f"    Layout: lines_per_scroll={colors['lines_per_scroll']}, emphasize={colors['emphasize_current_line']}")
    
    # Get aspect ratio from style_options (default to 16:9)
    aspect_ratio = style_options.get('aspect_ratio', '16:9')
    
    # Determine dimensions based on quality AND aspect ratio
    if video_quality == '4k':
        if aspect_ratio == '4:3':
            width, height = 2880, 2160  # 4K at 4:3
        elif aspect_ratio == '9:16':
            width, height = 2160, 3840  # 4K portrait
        else:  # 16:9 default
            width, height = 3840, 2160
        print(f"    Resolution: 4K ({width}x{height}), aspect={aspect_ratio}, scale=2.0")
        if colors.get('custom_font_path'):
            print(f"    Custom font at 4K: {colors['custom_font_path']}")
    elif video_quality == '1080p':
        if aspect_ratio == '4:3':
            width, height = 1440, 1080  # 1080p at 4:3
        elif aspect_ratio == '9:16':
            width, height = 1080, 1920  # 1080p portrait
        else:  # 16:9 default
            width, height = 1920, 1080
        print(f"    Resolution: 1080p ({width}x{height}), aspect={aspect_ratio}")
    elif video_quality == '480p':
        if aspect_ratio == '4:3':
            width, height = 640, 480  # 480p at 4:3
        elif aspect_ratio == '9:16':
            width, height = 480, 854  # 480p portrait
        else:  # 16:9 default
            width, height = 854, 480
        print(f"    Resolution: 480p ({width}x{height}), aspect={aspect_ratio}")
    elif video_quality == '540p':
        if aspect_ratio == '4:3':
            width, height = 720, 540  # 540p at 4:3
        elif aspect_ratio == '9:16':
            width, height = 540, 960  # 540p portrait
        else:  # 16:9 default
            width, height = 960, 540
        print(f"    Resolution: 540p ({width}x{height}), aspect={aspect_ratio}")
    else:  # 720p default
        if aspect_ratio == '4:3':
            width, height = 960, 720  # 720p at 4:3
        elif aspect_ratio == '9:16':
            width, height = 720, 1280  # 720p portrait
        else:  # 16:9 default
            width, height = 1280, 720
        print(f"    Resolution: 720p ({width}x{height}), aspect={aspect_ratio}")
    
    # Initialize video background reader if applicable
    video_reader = None
    if bg_type == 'video' and bg_video_path:
        try:
            video_reader = VideoBackgroundReader(bg_video_path, width, height, FPS)
            print(f"    Video background loaded: {video_reader.duration:.1f}s duration, will loop as needed")
        except Exception as e:
            print(f"    Failed to load video background: {e}")
            print(f"    Falling back to gradient background")
            bg_type = 'gradient'
    
    # Download and prepare start/intro image if provided
    loaded_start_image = None
    if start_image_url:
        try:
            print(f"    Downloading start image: {start_image_url[:80]}...")
            work_dir_temp = os.path.dirname(audio_path)
            start_img_path = os.path.join(work_dir_temp, 'start_image.jpg')
            download_file(start_image_url, start_img_path)
            loaded_start_image = Image.open(start_img_path).convert('RGBA')
            print(f"    Start image loaded: {loaded_start_image.width}x{loaded_start_image.height}, fit={start_image_fit}, opacity={start_image_opacity}%, show_title={start_image_show_title}")
        except Exception as e:
            print(f"    Warning: Failed to load start image: {e}")
            loaded_start_image = None
    
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
    
    print(f"    Lyrics offset by {INTRO_DURATION}s for intro")
    
    # Get duration of audio WITH intro silence
    total_duration = get_audio_duration(audio_with_intro)
    total_frames = int(total_duration * FPS)
    
    frames_dir = tempfile.mkdtemp()
    
    artist = track_info.get('artist_name', 'Unknown Artist')
    title = track_info.get('song_title', 'Unknown Title')
    
    intro_frames = int(INTRO_DURATION * FPS)
    
    # Detect gaps for instrumental breaks (with offset applied)
    # NEW in 6.0: Only show progress bar for gaps > 5 seconds (INSTRUMENTAL_BREAK_THRESHOLD)
    offset_gaps = []
    for gap in gaps:
        # Only include gaps that are long enough for progress bar
        if gap.get('duration', gap['end'] - gap['start']) >= INSTRUMENTAL_BREAK_THRESHOLD:
            offset_gap = gap.copy()
            offset_gap['start'] = gap['start'] + INTRO_DURATION
            offset_gap['end'] = gap['end'] + INTRO_DURATION
            offset_gaps.append(offset_gap)
    
    # Check for long intro before first lyrics (only if not already detected)
    if offset_lyrics:
        first_lyric_time = offset_lyrics[0]['start']
        intro_gap_time = first_lyric_time - INTRO_DURATION  # Time after intro screen before first lyric
        
        # Only add intro gap if gap is long enough for progress bar (> 5 seconds)
        has_intro_gap = any(g.get('is_intro', False) for g in offset_gaps)
        
        if intro_gap_time >= INSTRUMENTAL_BREAK_THRESHOLD and not has_intro_gap:
            offset_gaps.insert(0, {
                'start': INTRO_DURATION,
                'end': first_lyric_time,
                'duration': intro_gap_time,
                'is_intro': True
            })
            print(f"    Added intro instrumental break: {INTRO_DURATION}s to {first_lyric_time:.2f}s")
    
    # Get last lyric end time for fadeout
    last_lyric_end = offset_lyrics[-1]['end'] if offset_lyrics else total_duration
    fadeout_start = last_lyric_end
    fadeout_end = min(last_lyric_end + FADEOUT_DURATION, total_duration)

    # Outro text timing (starts after fadeout ends)
    outro_start = fadeout_end if offset_lyrics else INTRO_DURATION + 2
    has_outro_text = outro_text and subscription_tier == 'studio'
    if has_outro_text:
        print(f"    Outro text enabled: '{outro_text[:50]}...' (starts at {outro_start:.2f}s)")
    
    # Debug: Log timing info
    print(f"    Timing debug:")
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
    breaks_logged = set()  # Track which gaps we've logged
    
    for frame_num in range(total_frames):
        current_time = frame_num / FPS
        
        if frame_num < intro_frames:
            # Show intro screen during the silence period
            frame = create_intro_frame(artist, title, frame_num, intro_frames, width, height, colors, bg_image, video_reader, current_time, loaded_start_image, start_image_fit, start_image_opacity, start_image_show_title)
        else:
            # Check if we're in a countdown period
            in_break = False
            for gap_idx, gap in enumerate(offset_gaps):
                if gap['start'] <= current_time < gap['end']:
                    # We're in an instrumental break
                    in_break = True
                    
                    # Debug: Log first time we enter this countdown gap
                    if gap_idx not in breaks_logged:
                        print(f"   INSTRUMENTAL BREAK {gap_idx+1}: time={current_time:.2f}s, lyrics resume at {gap['end']:.2f}s")
                        breaks_logged.add(gap_idx)
                    
                    frame = create_instrumental_break_frame(
                        current_time,
                        gap['start'],
                        gap['end'],
                        width, 
                        height, 
                        offset_lyrics, 
                        display_mode,
                        colors,
                        bg_image,
                        video_reader
                    )
                    break
            
            if not in_break:
                # Debug: Log when first lyric should appear
                if not first_lyric_logged and offset_lyrics and current_time >= offset_lyrics[0]['start']:
                    print(f"    First lyric should appear now: frame {frame_num}, current_time={current_time:.2f}s")
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
            # Use logo_url if available, fall back to custom_watermark_url
            watermark_url = logo_url or custom_watermark_url
            frame = apply_studio_watermark(frame, width, height, watermark_url, logo_position, logo_size, logo_opacity)
        
        frame_path = os.path.join(frames_dir, f'frame_{frame_num:06d}.jpg')
        frame.save(frame_path, 'JPEG', quality=92)
        
        if frame_num % 100 == 0:
            print(f"  Frame {frame_num}/{total_frames}")
    
    # Close video reader to free resources
    if video_reader:
        video_reader.close()
        print("    Video background reader closed")

    print(" Encoding video with FFmpeg...")
    
    # Use audio_with_intro which has silence at the beginning
    ffmpeg_cmd = [
        'ffmpeg', '-y',
        '-framerate', str(FPS),
        '-i', os.path.join(frames_dir, 'frame_%06d.jpg'),
        '-i', audio_with_intro,
        '-c:v', 'libx264',
        '-preset', 'fast',
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
    
    print(" Video generation complete")
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
        
        # Logo settings (Studio tier branding)
        logo_url = input_data.get('logo_url', None)
        logo_position = input_data.get('logo_position', 'bottom-right')
        logo_size = input_data.get('logo_size', 50)
        logo_opacity = input_data.get('logo_opacity', 80)
        
        print(f"    [LOGO INPUT] url={logo_url}")
        print(f"    [LOGO INPUT] position={logo_position}, size={logo_size} (type={type(logo_size).__name__}), opacity={logo_opacity} (type={type(logo_opacity).__name__})")
        print(f"    [LOGO INPUT] custom_watermark_url={custom_watermark_url}")
        print(f"    [LOGO INPUT] subscription_tier={subscription_tier}")
        
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
            # Layout
            'aspect_ratio': input_data.get('aspect_ratio', '16:9'),
            # V12: Layout settings for lines and emphasis
            'lines_per_scroll': input_data.get('lines_per_scroll', 5),
            'lines_per_page': input_data.get('lines_per_page', 4),
            'lines_per_overwrite': input_data.get('lines_per_overwrite', 4),
            'emphasize_current_line': input_data.get('emphasize_current_line', False),
            'show_progress_bar': input_data.get('show_progress_bar', True),
            'show_countdown': input_data.get('show_countdown', True),
            'show_lead_in_bars': input_data.get('show_lead_in_bars', True),
        }
        
        # V12: Start/Intro image settings
        start_image_url = input_data.get('start_image_url')
        start_image_fit = input_data.get('start_image_fit', 'fill')
        start_image_opacity = input_data.get('start_image_opacity', 100)
        start_image_show_title = input_data.get('start_image_show_title', True)
        
        # NEW in 5.0: Background type options
        bg_type = input_data.get('bg_type', 'gradient')  # 'color', 'gradient', 'image', 'video'
        bg_video_preset = input_data.get('bg_video_preset')  # Preset filename e.g. 'abstract-smoke.mp4'
        bg_video_url = input_data.get('bg_video_url')  # Custom video URL (user uploads)
        bg_image_url = input_data.get('bg_image_url')  # Custom image URL
        bg_image_fit = input_data.get('bg_image_fit', 'fill')  # 'fill', 'fit', 'stretch'
        
        print(f" Processing project: {project_id}")
        print(f"   Type: {processing_type}")
        print(f"   Lyrics provided: {'Yes' if user_lyrics_text else 'No (auto-transcribe)'}")
        print(f"   Display mode: {display_mode}")
        print(f"   Clean version: {clean_version}")
        print(f"   Quality: {video_quality}")
        print(f"    Subscription tier: {subscription_tier}")
        print(f"    Style: bg={style_options['bg_color_1']}, text={style_options['text_color']}, sung={style_options['sung_color']}")
        print(f"    Layout: lines_per_scroll={style_options['lines_per_scroll']}, emphasize={style_options['emphasize_current_line']}")
        print(f"    Start image: {start_image_url if start_image_url else 'None'}")
        print(f"    Using AssemblyAI for precise timing!")
        print(f"   [4.1] Lyrics comparison uses NORMALIZED matching (ignores punctuation/case)")
        
        # Check processing mode early
        processing_mode = input_data.get('processing_mode', 'full')
        print(f"    Processing mode: {processing_mode}")
        
        work_dir = tempfile.mkdtemp()
        results = {}
        
        # Download custom font if provided
        custom_font_path = None
        if style_options.get('custom_font_url'):
            custom_font_path = download_custom_font(style_options['custom_font_url'], work_dir)
            if custom_font_path:
                style_options['custom_font_path'] = custom_font_path
                print(f"    Custom font: {style_options.get('custom_font_name', 'Custom')}")
        
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
                print("    Video background not available, falling back to gradient")
                bg_type = 'gradient'
        
        if bg_type == 'image' and bg_image_url:
            # Determine video dimensions for image sizing
            if video_quality == '4k':
                img_width, img_height = 3840, 2160
            elif video_quality == '1080p':
                img_width, img_height = 1920, 1080
            elif video_quality == '540p':
                img_width, img_height = 960, 540
            elif video_quality == '480p':
                img_width, img_height = 854, 480
            else:
                img_width, img_height = 1280, 720
            
            # Get background color for letterboxing (when using 'fit' mode)
            bg_color_hex = style_options.get('bg_color_1', '#1a1a2e')
            try:
                bg_color_rgb = tuple(int(bg_color_hex.lstrip('#')[i:i+2], 16) for i in (0, 2, 4))
            except:
                bg_color_rgb = (26, 26, 46)  # Default dark color
            
            bg_image = download_image_background(bg_type, bg_image_url, work_dir, img_width, img_height, bg_image_fit, bg_color_rgb)
            if not bg_image:
                print("    Image background not available, falling back to gradient")
                bg_type = 'gradient'
        
        # RENDER_ONLY MODE: Skip vocal separation, use existing processed audio
        if processing_mode == 'render_only':
            print(" Render-only mode - using existing processed audio")
            
            # Get the already-processed audio URL
            processed_audio_url = input_data.get('processed_audio_url')
            if not processed_audio_url:
                raise ValueError("render_only mode requires processed_audio_url")
            
            # Download the processed audio
            instrumental_path = os.path.join(work_dir, 'instrumental.wav')
            print(f" Downloading processed audio from {processed_audio_url}")
            download_file(processed_audio_url, instrumental_path)
            
            # Get edited lyrics from input
            lyrics = input_data.get('edited_lyrics', [])
            if not lyrics:
                raise ValueError("render_only mode requires edited_lyrics")
            
            print(f" Using {len(lyrics)} edited lyrics from user")
            
            # Keep existing URLs
            results['processed_audio_url'] = processed_audio_url
            if input_data.get('vocals_audio_url'):
                results['vocals_audio_url'] = input_data.get('vocals_audio_url')
            
            gaps = detect_silence_gaps(lyrics)
            print(f"   Found {len(gaps)} gaps for instrumental breaks")
            for i, gap in enumerate(gaps):
                print(f"      Gap {i+1}: {gap['start']:.2f}s - {gap['end']:.2f}s ({gap['duration']:.2f}s) {'[INTRO]' if gap.get('is_intro') else ''}")
            results['lyrics'] = lyrics
            
            # Skip to video generation (handled below)
            vocals_path = None
            audio_path = instrumental_path
            
        else:
            # FULL or TRANSCRIBE_ONLY MODE: Do vocal separation and transcription
            audio_path = os.path.join(work_dir, 'input_audio.mp3')
            print(f" Downloading audio from {audio_url}")
            download_file(audio_url, audio_path)
            
            print(" Starting vocal separation...")
            instrumental_path, vocals_path = separate_vocals(audio_path, work_dir)
            
            if processing_type in ['remove_vocals']:
                instrumental_key = f"processed/{project_id}/instrumental.wav"
                results['processed_audio_url'] = upload_to_r2(instrumental_path, instrumental_key)
                
                # Save isolated vocals for editor reference
                vocals_key = f"processed/{project_id}/vocals.wav"
                results['vocals_audio_url'] = upload_to_r2(vocals_path, vocals_key)
                
                # Generate and upload waveform data for timeline editor
                waveform_path = generate_waveform_data(vocals_path, work_dir)
                if waveform_path:
                    waveform_key = f"processed/{project_id}/waveform.json"
                    results['waveform_url'] = upload_to_r2(waveform_path, waveform_key)
            
            elif processing_type == 'guide_vocals':
                # Guide Vocals mode: Mix instrumental (100%) + vocals (30%) for singers who need guidance
                print(" Creating guide vocals track (instrumental + 30% vocals)...")
                
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
                
                # Generate and upload waveform data for timeline editor
                waveform_path = generate_waveform_data(vocals_path, work_dir)
                if waveform_path:
                    waveform_key = f"processed/{project_id}/waveform.json"
                    results['waveform_url'] = upload_to_r2(waveform_path, waveform_key)
                
                # IMPORTANT: Use guide vocals mix for video generation
                instrumental_path = guide_path
                
                print(" Guide vocals track created")
            
            # LYRICS PROCESSING - NOW USING ASSEMBLYAI
            lyrics = []
            gaps = []
            
            if include_lyrics:
                # Use AssemblyAI for transcription and alignment
                lyrics = transcribe_with_assemblyai(vocals_path, user_lyrics_text)
                
                if clean_version and lyrics:
                    print(" Applying profanity filter...")
                    print(f"   Processing {len(lyrics)} words...")
                    lyrics = apply_profanity_filter(lyrics)
                
                gaps = detect_silence_gaps(lyrics)
                print(f"   Found {len(gaps)} gaps for instrumental breaks")
                for i, gap in enumerate(gaps):
                    print(f"      Gap {i+1}: {gap['start']:.2f}s - {gap['end']:.2f}s ({gap['duration']:.2f}s) {'[INTRO]' if gap.get('is_intro') else ''}")
                
                results['lyrics'] = lyrics
            
            # Check if transcribe_only - stop here
            if processing_mode == 'transcribe_only':
                print(" Transcribe-only mode - skipping video generation")
                
                if callback_url:
                    print(f" Sending callback to {callback_url}")
                    requests.post(callback_url, json={
                        'project_id': project_id,
                        'status': 'transcribed',
                        'results': results
                    })
                
                import shutil
                shutil.rmtree(work_dir)
                
                print(" Transcription complete!")
                return {
                    'status': 'transcribed',
                    'project_id': project_id,
                    'results': results
                }
        
        # VIDEO GENERATION (for 'full' or 'render_only' modes)
        audio_duration = get_audio_duration(instrumental_path if instrumental_path else audio_path)
        
        selected_display_mode = select_display_mode(lyrics, audio_duration, display_mode)
        print(f" Selected display mode: {selected_display_mode}")
        
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
              bg_type,  # Background type
              bg_video_path,  # Video background path
              bg_image,  # Image background
              # Logo settings (Studio branding)
              logo_url,
              logo_position,
              logo_size,
              logo_opacity,
              # Start/Intro image settings
              start_image_url,
              start_image_fit,
              start_image_opacity,
              start_image_show_title
          )
        
        # Use timestamped key so each render is preserved in R2 (for render history)
        from datetime import datetime
        render_timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        video_key = f"processed/{project_id}/video_{render_timestamp}.mp4"
        results['video_url'] = upload_to_r2(video_path, video_key)
        print(f" Video uploaded to R2: {video_key}")
        
        if callback_url:
            print(f" Sending callback to {callback_url}")
            requests.post(callback_url, json={
                'project_id': project_id,
                'status': 'completed',
                'results': results
            })
        
        import shutil
        shutil.rmtree(work_dir)
        
        print(" Processing complete!")
        return {
            'status': 'completed',
            'project_id': project_id,
            'results': results
        }
        
    except Exception as e:
        print(f" Error: {str(e)}")
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