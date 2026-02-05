'use client';

/**
 * Preview/Edit Page - Karatrack Studio (V11.0)
 * 
 * Place this at: frontend/src/pages/preview/[id].jsx
 * 
 * V11.0 TABBED INTERFACE:
 * - New 5-tab layout: Timing, Style, Background, Layout, Export
 * - All settings will be moved from Upload page to Preview page
 * - Users can experiment with different settings before rendering
 * 
 * TABS:
 * 1. TIMING - Timeline editor, word/line editing, duet mode (implemented)
 * 2. STYLE - Font, colors, text effects (placeholder - Stage 2)
 * 3. BACKGROUND - Color/gradient, image, video presets (placeholder - Stage 3)
 * 4. LAYOUT - Display mode, aspect ratio (placeholder - Stage 4)
 * 5. EXPORT - Audio track, quality, watermark (placeholder - Stage 5)
 * 
 * V10.10 WORD DURATION CONTEXT MENU (preserved):
 * - Right-click on any word in timeline to access duration controls
 * 
 * V10.9 MULTI-SELECT (preserved):
 * - Shift+Click to select range of words
 * - Ctrl/Cmd+Click to toggle individual words
 * 
 * V10.8 FEATURES (preserved):
 * - Volume sliders for backing track and vocals
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Play, Pause, SkipBack, SkipForward, Music2, Save, RotateCcw,
  ZoomIn, ZoomOut, Users, Check, X, Loader2, AlertCircle,
  CheckCircle, Plus, Trash2, Paintbrush,
  ArrowDown, ArrowUp, Type, SplitSquareHorizontal,
  AlertTriangle, ChevronDown, ChevronRight, GripHorizontal,
  Volume2, VolumeX, Mic, Music, FileVideo,
  Clock, Timer, Minus, MoreHorizontal,
  // V11: Tab icons
  Image, Download, Grid3X3, Palette, Sparkles, Video,
  Monitor, Smartphone, Square, Upload, Lock, Undo2, Redo2,
  ExternalLink, ScrollText, FileText, Edit3,
  // V12: Preset icons
  Bookmark, Star, FolderOpen,
  // Fullscreen
  Maximize2, Minimize2,
  // V13: QR Sharing
  QrCode
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import AppNavigation from '../../components/AppNavigation';
import ShareModal from '../../components/ShareModal';
import ReadinessChecklist from '../../components/ReadinessChecklist';
import { createClient } from '@supabase/supabase-js';
import SEO from '../../components/SEO';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const SINGER = { BOTH: 0, SINGER_1: 1, SINGER_2: 2 };
const DEFAULT_DUET_COLORS = { singer1: '#00FFFF', singer2: '#FF69B4', both: '#FFD700' };
const PIXELS_PER_SECOND_DEFAULT = 100;
const TIMELINE_HEIGHT = 160;
const TIMELINE_HEIGHT_DUET = 200; // Taller timeline for 3-row duet mode

// Preset video backgrounds base URL
const PRESET_BASE_URL = process.env.NEXT_PUBLIC_PRESET_VIDEOS_URL || 'https://pub-71dae0f9e45e4d8e8d1eedd472780341.r2.dev/presets';

// Line length settings
const MAX_WORDS_PER_LINE = 10;

// Dynamic character limits per line based on aspect ratio and font size
// These values were measured from the preview at each setting
const MAX_CHARS_PER_LINE = {
  '16:9': {
    'small': 50,
    'normal': 50,
    'large': 48,
    'xlarge': 44
  },
  '4:3': {
    'small': 40,
    'normal': 35,
    'large': 31,
    'xlarge': 29
  },
  '9:16': {
    'small': 18,
    'normal': 16,
    'large': 14,
    'xlarge': 12
  }
};

// When "Emphasize Current Line" is ON, the current line renders 1.3x larger.
// Reduce max character limits proportionally so warnings account for the bigger text.
const EMPHASIZE_CHAR_REDUCTION = 0.77; // 1 / 1.3 = ~0.77

// Sweep highlighting constants - TIERED SYSTEM
const SWEEP_IN_LONG_DURATION = 2.0;    // 2 seconds for gaps >= 2s
const SWEEP_IN_LONG_MIN_GAP = 2.0;     // Minimum gap for long sweep
const SWEEP_IN_SHORT_DURATION = 1.0;   // 1 second for gaps >= 1.25s
const SWEEP_IN_SHORT_MIN_GAP = 1.25;   // Minimum gap for short sweep
const INSTRUMENTAL_BREAK_THRESHOLD = 5.0;  // Seconds to trigger progress bar

// Preview size settings - height controls the 16:9 container size
const MIN_PREVIEW_HEIGHT = 200;
const MAX_PREVIEW_HEIGHT = 500;
const DEFAULT_PREVIEW_HEIGHT = 300;

// ============================================================
// V11: TAB DEFINITIONS
// ============================================================
const TABS = [
  { id: 'timing', label: 'Timing', icon: Clock },
  { id: 'style', label: 'Style', icon: Type },
  { id: 'background', label: 'Background', icon: Image },
  { id: 'layout', label: 'Layout', icon: Grid3X3 },
  { id: 'export', label: 'Export', icon: Download },
];

// V11: Font options for Style tab - Custom Font at TOP, then alphabetical Google Fonts
const FONT_OPTIONS = [
  // Custom Font (Studio tier only) - AT THE TOP
  { value: 'custom', label: 'Custom Font', family: 'CustomKaraokeFont, sans-serif', requiresStudio: true, isCustom: true },
  
  // Google Fonts - Alphabetical order
  { value: 'abril-fatface', label: 'Abril Fatface', family: '"Abril Fatface", serif' },
  { value: 'alegreya', label: 'Alegreya', family: '"Alegreya", serif' },
  { value: 'anton', label: 'Anton', family: '"Anton", sans-serif' },
  { value: 'archivo-black', label: 'Archivo Black', family: '"Archivo Black", sans-serif' },
  { value: 'arial', label: 'Arial', family: 'Arial, sans-serif' },
  { value: 'bangers', label: 'Bangers', family: '"Bangers", cursive' },
  { value: 'bebas', label: 'Bebas Neue', family: '"Bebas Neue", sans-serif' },
  { value: 'bitter', label: 'Bitter', family: '"Bitter", serif' },
  { value: 'black-ops-one', label: 'Black Ops One', family: '"Black Ops One", cursive' },
  { value: 'cabin', label: 'Cabin', family: '"Cabin", sans-serif' },
  { value: 'cinzel', label: 'Cinzel', family: '"Cinzel", serif' },
  { value: 'comfortaa', label: 'Comfortaa', family: '"Comfortaa", cursive' },
  { value: 'concert-one', label: 'Concert One', family: '"Concert One", cursive' },
  { value: 'dancing-script', label: 'Dancing Script', family: '"Dancing Script", cursive' },
  { value: 'dosis', label: 'Dosis', family: '"Dosis", sans-serif' },
  { value: 'exo-2', label: 'Exo 2', family: '"Exo 2", sans-serif' },
  { value: 'fjalla-one', label: 'Fjalla One', family: '"Fjalla One", sans-serif' },
  { value: 'fredoka-one', label: 'Fredoka One', family: '"Fredoka One", cursive' },
  { value: 'graduate', label: 'Graduate', family: '"Graduate", serif' },
  { value: 'impact', label: 'Impact', family: 'Impact, sans-serif' },
  { value: 'inter', label: 'Inter', family: '"Inter", sans-serif' },
  { value: 'josefin-sans', label: 'Josefin Sans', family: '"Josefin Sans", sans-serif' },
  { value: 'kanit', label: 'Kanit', family: '"Kanit", sans-serif' },
  { value: 'lato', label: 'Lato', family: '"Lato", sans-serif' },
  { value: 'lexend', label: 'Lexend', family: '"Lexend", sans-serif' },
  { value: 'libre-baskerville', label: 'Libre Baskerville', family: '"Libre Baskerville", serif' },
  { value: 'lobster', label: 'Lobster', family: '"Lobster", cursive' },
  { value: 'merriweather', label: 'Merriweather', family: '"Merriweather", serif' },
  { value: 'montserrat', label: 'Montserrat', family: '"Montserrat", sans-serif' },
  { value: 'nunito', label: 'Nunito', family: '"Nunito", sans-serif' },
  { value: 'open-sans', label: 'Open Sans', family: '"Open Sans", sans-serif' },
  { value: 'orbitron', label: 'Orbitron', family: '"Orbitron", sans-serif' },
  { value: 'oswald', label: 'Oswald', family: '"Oswald", sans-serif' },
  { value: 'pacifico', label: 'Pacifico', family: '"Pacifico", cursive' },
  { value: 'permanent-marker', label: 'Permanent Marker', family: '"Permanent Marker", cursive' },
  { value: 'playfair', label: 'Playfair Display', family: '"Playfair Display", serif' },
  { value: 'poppins', label: 'Poppins', family: '"Poppins", sans-serif' },
  { value: 'press-start', label: 'Press Start 2P', family: '"Press Start 2P", cursive' },
  { value: 'quicksand', label: 'Quicksand', family: '"Quicksand", sans-serif' },
  { value: 'rajdhani', label: 'Rajdhani', family: '"Rajdhani", sans-serif' },
  { value: 'raleway', label: 'Raleway', family: '"Raleway", sans-serif' },
  { value: 'righteous', label: 'Righteous', family: '"Righteous", cursive' },
  { value: 'roboto', label: 'Roboto', family: '"Roboto", sans-serif' },
  { value: 'roboto-condensed', label: 'Roboto Condensed', family: '"Roboto Condensed", sans-serif' },
  { value: 'roboto-mono', label: 'Roboto Mono', family: '"Roboto Mono", monospace' },
  { value: 'roboto-slab', label: 'Roboto Slab', family: '"Roboto Slab", serif' },
  { value: 'rubik', label: 'Rubik', family: '"Rubik", sans-serif' },
  { value: 'russo-one', label: 'Russo One', family: '"Russo One", sans-serif' },
  { value: 'satisfy', label: 'Satisfy', family: '"Satisfy", cursive' },
  { value: 'shadows-into-light', label: 'Shadows Into Light', family: '"Shadows Into Light", cursive' },
  { value: 'source-sans-pro', label: 'Source Sans Pro', family: '"Source Sans Pro", sans-serif' },
  { value: 'special-elite', label: 'Special Elite', family: '"Special Elite", cursive' },
  { value: 'teko', label: 'Teko', family: '"Teko", sans-serif' },
  { value: 'titillium-web', label: 'Titillium Web', family: '"Titillium Web", sans-serif' },
  { value: 'ubuntu', label: 'Ubuntu', family: '"Ubuntu", sans-serif' },
  { value: 'vollkorn', label: 'Vollkorn', family: '"Vollkorn", serif' },
  { value: 'work-sans', label: 'Work Sans', family: '"Work Sans", sans-serif' },
];

const FONT_SIZE_OPTIONS = [
  { value: 'small', label: 'Small', scale: 0.85 },
  { value: 'normal', label: 'Normal', scale: 1.0 },
  { value: 'large', label: 'Large', scale: 1.15 },
  { value: 'xlarge', label: 'X-Large', scale: 1.3 },
];

// V11: Video background categories
const VIDEO_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'abstract', label: 'Abstract' },
  { id: 'elegant', label: 'Elegant' },
  { id: 'nature', label: 'Nature' },
  { id: 'space', label: 'Space' },
  { id: '80s', label: '80s/Retro' },
  { id: 'western', label: 'Western' },
];

// V11: Preset video backgrounds
const PRESET_VIDEO_BACKGROUNDS = [
  // Abstract
  { id: 'abstract-smokecurling', name: 'Smoke Curling', filename: 'bg-abstract-smokecurling.mp4', category: 'abstract' },
  { id: 'abstract-gradientpinklavenderblue', name: 'Pink Lavender Blue', filename: 'bg-abstract-gradientpinklavenderblue.mp4', category: 'abstract' },
  { id: 'abstract-flowinggradient', name: 'Flowing Gradient', filename: 'bg-abstract-flowinggradient.mp4', category: 'abstract' },
  { id: 'abstract-iridescencesoapbubble', name: 'Soap Bubble', filename: 'bg-abstract-iridescencesoapbubble.mp4', category: 'abstract' },
  { id: 'abstract-fiberoptics', name: 'Fiber Optics', filename: 'bg-abstract-fiberoptics.mp4', category: 'abstract' },
  { id: 'abstract-geometricshapes', name: 'Geometric Shapes', filename: 'bg-abstract-geometricshapes.mp4', category: 'abstract' },
  { id: 'abstract-inkinwater', name: 'Ink in Water', filename: 'bg-abstract-inkinwater.mp4', category: 'abstract' },
  { id: 'abstract-liquidchrome', name: 'Liquid Chrome', filename: 'bg-abstract-liquidchrome.mp4', category: 'abstract' },
  { id: 'abstract-liquidglass', name: 'Liquid Glass', filename: 'bg-abstract-liquidglass.mp4', category: 'abstract' },
  { id: 'abstract-matrix', name: 'Matrix', filename: 'bg-abstract-matrix.mp4', category: 'abstract' },
  { id: 'abstract-neonlightwaves', name: 'Neon Light Waves', filename: 'bg-abstract-neonlightwaves.mp4', category: 'abstract' },
  { id: 'abstract-neonrings', name: 'Neon Rings', filename: 'bg-abstract-neonrings.mp4', category: 'abstract' },
  { id: 'abstract-neontriangletunnel', name: 'Neon Triangle Tunnel', filename: 'bg-abstract-neontriangletunnel.mp4', category: 'abstract' },
  { id: 'abstract-prismlight', name: 'Prism Light', filename: 'bg-abstract-prismlight.mp4', category: 'abstract' },
  { id: 'abstract-smoketwist', name: 'Smoke Twist', filename: 'bg-abstract-smoketwist.mp4', category: 'abstract' },
  // Elegant
  { id: 'elegant-bokehlights', name: 'Bokeh Lights', filename: 'bg-elegant-bokehlights.mp4', category: 'elegant' },
  { id: 'elegant-goldendust', name: 'Golden Dust', filename: 'bg-elegant-goldendust.mp4', category: 'elegant' },
  { id: 'elegant-orbs', name: 'Floating Orbs', filename: 'bg-elegant-orbs.mp4', category: 'elegant' },
  { id: 'elegant-redsilkflowing', name: 'Red Silk Flowing', filename: 'bg-elegant-redsilkflowing.mp4', category: 'elegant' },
  // Nature
  { id: 'nature-nightsnow', name: 'Night Snow', filename: 'bg-nature-nightsnow.mp4', category: 'nature' },
  { id: 'nature-watercolorclouds', name: 'Watercolor Clouds', filename: 'bg-nature-watercolorclouds.mp4', category: 'nature' },
  { id: 'nature-pool', name: 'Pool Water', filename: 'bg-nature-pool.mp4', category: 'nature' },
  { id: 'nature-oceandepths', name: 'Ocean Depths', filename: 'bg-nature-oceandepths.mp4', category: 'nature' },
  { id: 'nature-aurora1', name: 'Northern Lights', filename: 'bg-nature-aurora1.mp4', category: 'nature' },
  { id: 'nature-cherryblossum', name: 'Cherry Blossom', filename: 'bg-nature-cherryblossum.mp4', category: 'nature' },
  { id: 'nature-fireflies', name: 'Fireflies', filename: 'bg-nature-fireflies.mp4', category: 'nature' },
  { id: 'nature-jellyfish', name: 'Jellyfish', filename: 'bg-nature-jellyfish.mp4', category: 'nature' },
  { id: 'nature-lightning', name: 'Lightning', filename: 'bg-nature-lightning.mp4', category: 'nature' },
  { id: 'nature-rainonwater', name: 'Rain on Water', filename: 'bg-nature-rainonwater.mp4', category: 'nature' },
  // Space
  { id: 'space-milkyway', name: 'Milky Way', filename: 'bg-space-milkyway.mp4', category: 'space' },
  { id: 'space-nebula1', name: 'Nebula 1', filename: 'bg-space-nebula1.mp4', category: 'space' },
  { id: 'space-nebula2', name: 'Nebula 2', filename: 'bg-space-nebula2.mp4', category: 'space' },
  { id: 'space-nebulaclouds1', name: 'Nebula Clouds', filename: 'bg-space-nebulaclouds1.mp4', category: 'space' },
  { id: 'space-saturn', name: 'Saturn', filename: 'bg-space-saturn.mp4', category: 'space' },
  { id: 'space-asteroidfield', name: 'Asteroid Field', filename: 'bg-space-asteroidfield.mp4', category: 'space' },
  { id: 'space-blackhole', name: 'Black Hole', filename: 'bg-space-blackhole.mp4', category: 'space' },
  // 80s/Retro
  { id: '80s-dancingkids', name: 'Dancing Kids', filename: 'bg-80s-dancingkids.mp4', category: '80s' },
  { id: '80s-neongrid', name: 'Neon Grid', filename: 'bg-80s-neongrid.mp4', category: '80s' },
  { id: '80s-neonpalms', name: 'Neon Palms', filename: 'bg-80s-nonpalms.mp4', category: '80s' },
  { id: '80s-watersunset', name: 'Water Sunset', filename: 'bg-80s-watersunset.mp4', category: '80s' },
  // Western
  { id: 'western-horse', name: 'Horse', filename: 'bg-western-horse.mp4', category: 'western' },
  { id: 'western-stampede', name: 'Stampede', filename: 'bg-western-stampede.mp4', category: 'western' },
];

// V11: Display mode options
const DISPLAY_MODE_OPTIONS = [
  { value: 'scroll', label: 'Scroll', description: 'Teleprompter style - lyrics scroll up as you sing', Icon: ScrollText },
  { value: 'page', label: 'Page', description: 'Show multiple lines at once, highlight current line', Icon: FileText },
  { value: 'overwrite', label: 'Overwrite', description: 'Single line display, each line replaces the previous', Icon: Edit3 },
];

// V11: Aspect ratio options
const ASPECT_RATIO_OPTIONS = [
  { value: '16:9', label: '16:9', description: 'Widescreen (YouTube, TV)', icon: Monitor },
  { value: '4:3', label: '4:3', description: 'Standard (Classic TV)', icon: Square },
  { value: '9:16', label: '9:16', description: 'Portrait (TikTok, Reels)', icon: Smartphone },
];

// V11: Lines per page options (for page mode)
const LINES_PER_PAGE_OPTIONS = [2, 3, 4, 5, 6];

// V11: Audio track options for export
const AUDIO_TRACK_OPTIONS = [
  { value: 'instrumental', label: 'Remove All Vocals', description: 'Karaoke mode - sing along to the music', icon: String.fromCodePoint(0x1F3A4) },
  { value: 'guide', label: 'Guide Vocals', description: 'Vocals reduced by 70% to help you learn the song', icon: String.fromCodePoint(0x1F3B5) },
  { value: 'original', label: 'Keep Original', description: 'Full original audio with all vocals', icon: String.fromCodePoint(0x1F3A7) },
];

// V12: Video quality options with credit costs per minute
const VIDEO_QUALITY_OPTIONS = [
  { value: '540p', label: '540p', description: 'SD - Fast render', resolution: '960' + String.fromCharCode(215) + '540', creditsPerMin: 1, instantCreditsPerMin: 2 },
  { value: '720p', label: '720p', description: 'HD - Great quality', resolution: '1280' + String.fromCharCode(215) + '720', creditsPerMin: 2, instantCreditsPerMin: 4 },
  { value: '1080p', label: '1080p', description: 'Full HD - YouTube ready', resolution: '1920' + String.fromCharCode(215) + '1080', creditsPerMin: 3, instantCreditsPerMin: 6 },
  { value: '4k', label: '4K', description: 'Ultra HD - Maximum quality', resolution: '3840' + String.fromCharCode(215) + '2160', creditsPerMin: 5, instantCreditsPerMin: 10 },
];

// V12: Export mode options
const EXPORT_MODE_OPTIONS = [
  { value: 'queue', label: 'Queue', description: 'Processed in order. May take longer during high demand.', icon: Clock, multiplier: 1 },
  { value: 'instant', label: 'Instant', description: 'Skip the queue and start rendering immediately.', icon: Sparkles, multiplier: 2 },
];

// V11: Branding - Logo position options
const LOGO_POSITION_OPTIONS = [
  { value: 'top-left', label: 'TL', gridArea: '1 / 1' },
  { value: 'top-center', label: 'TC', gridArea: '1 / 2' },
  { value: 'top-right', label: 'TR', gridArea: '1 / 3' },
  { value: 'bottom-left', label: 'BL', gridArea: '2 / 1' },
  { value: 'bottom-center', label: 'BC', gridArea: '2 / 2' },
  { value: 'bottom-right', label: 'BR', gridArea: '2 / 3' },
];

// ============================================================
// SWEEP WORD COMPONENT - V3
// 
// Glow ONLY shows on the currently active word being sung
// Past (already sung) words have NO glow
// 
// Replace the existing SweepWord component in preview/[id].jsx
// (around line 304)
// ============================================================

const SweepWord = ({ word, sweepPercent, color, unsungColor, outlineColor, isActive, isPast, showGlow, fadeInProgress = 1 }) => {
  // Base outline shadow - 8 offsets for crisp outline
  const baseTextShadow = `
    1px 1px 0 ${outlineColor}, 
    -1px -1px 0 ${outlineColor}, 
    1px -1px 0 ${outlineColor}, 
    -1px 1px 0 ${outlineColor},
    2px 2px 0 ${outlineColor},
    -2px -2px 0 ${outlineColor},
    2px -2px 0 ${outlineColor},
    -2px 2px 0 ${outlineColor}
  `;

  // Past words (already sung) - NO glow, just colored text
  if (isPast || sweepPercent >= 1) {
    return (
      <span className="mx-1" style={{ 
        color: color, 
        textShadow: baseTextShadow, 
        position: 'relative', 
        zIndex: 1 
      }}>{word}</span>
    );
  }

  // Unsung words (not active yet) - dimmed color, no glow
  if (sweepPercent <= 0 && !isActive) {
    return (
      <span className="mx-1" style={{ 
        color: unsungColor, 
        textShadow: baseTextShadow, 
        position: 'relative', 
        zIndex: 1 
      }}>{word}</span>
    );
  }

  // Active word being sung - WITH GLOW
  const clipPercent = Math.max(0, Math.min(100, sweepPercent * 100));

  return (
    <span className="mx-1" style={{ position: 'relative', display: 'inline-block' }}>
      {/* Outer glow layer - larger blur */}
      <span 
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          color: color,
          filter: 'blur(16px)',
          opacity: 0.5,
          clipPath: `inset(0 ${100 - clipPercent}% 0 0)`,
          WebkitClipPath: `inset(0 ${100 - clipPercent}% 0 0)`,
          zIndex: 0,
          pointerEvents: 'none',
        }}
      >{word}</span>
      
      {/* Inner glow layer - tighter blur */}
      <span 
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          color: color,
          filter: 'blur(8px)',
          opacity: 0.7,
          clipPath: `inset(0 ${100 - clipPercent}% 0 0)`,
          WebkitClipPath: `inset(0 ${100 - clipPercent}% 0 0)`,
          zIndex: 0,
          pointerEvents: 'none',
        }}
      >{word}</span>
      
      {/* Base unsung text layer */}
      <span style={{ 
        color: unsungColor, 
        textShadow: baseTextShadow, 
        position: 'relative', 
        zIndex: 1 
      }}>{word}</span>
      
      {/* Sung overlay - clipped to sweep progress */}
      <span style={{
        position: 'absolute', 
        top: 0, 
        left: 0,
        color: color,
        textShadow: baseTextShadow,
        clipPath: `inset(0 ${100 - clipPercent}% 0 0)`,
        WebkitClipPath: `inset(0 ${100 - clipPercent}% 0 0)`,
        zIndex: 2,
      }}>{word}</span>
    </span>
  );
};

// ============================================================
// SWEEP-IN BAR COMPONENT
// ============================================================
const SweepInBar = ({ progress, color }) => {
  // Progress: 0 = bar at full width, 1 = bar gone
  const maxWidth = 50;
  const width = Math.max(0, (1 - progress) * maxWidth);
  
  if (width < 1) return null;

  // Absolutely positioned - doesn't affect layout
  // Parent must have position: relative
  return (
    <span
      style={{
        position: 'absolute',
        right: '100%', // Position to the left of the parent
        top: '50%', // Center vertically
        transform: 'translateY(-50%)', // Perfect center alignment
        height: '0.75em', // Match capital letter height (cap height)
        width: `${width}px`,
        // Simple gradient, no box-shadow glow
        background: `linear-gradient(to right, transparent, ${color})`,
        marginRight: '-4px', // Overlap into the first letter edge
        pointerEvents: 'none',
      }}
    />
  );
};

// ============================================================
// INSTRUMENTAL PROGRESS BAR COMPONENT
// ============================================================
const InstrumentalProgressBar = ({ progress, nextLyrics, color, textColor, outlineColor, isPortrait }) => {
  return (
    <div className="flex flex-col items-center gap-2">
      <div 
        className="h-2 bg-white/20 rounded-full overflow-hidden"
        style={{ width: isPortrait ? '80%' : '16rem' }}
      >
        <div
          className="h-full rounded-full transition-all duration-100"
          style={{
            width: `${progress * 100}%`,
            background: `linear-gradient(to right, ${color}, ${color}cc)`,
            boxShadow: `0 0 10px ${color}60`,
          }}
        />
      </div>
      {nextLyrics && (
        <p
          className={`opacity-40 text-center ${isPortrait ? 'text-sm max-w-[90%]' : 'text-lg max-w-md'}`}
          style={{
            color: textColor,
            textShadow: `1px 1px 2px ${outlineColor}`,
          }}
        >
          {nextLyrics}
        </p>
      )}
    </div>
  );
};

// ============================================================
// VOLUME SLIDER COMPONENT - NEW in V10.8
// ============================================================
const VolumeSlider = ({ value, onChange, label, icon: Icon, color, muted, onMuteToggle, isDark }) => {
  const sliderRef = useRef(null);
  const [isTouching, setIsTouching] = useState(false);

  // Calculate volume from touch/mouse position on the track
  const getValueFromEvent = useCallback((clientX) => {
    if (!sliderRef.current) return value;
    const rect = sliderRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.round(Math.max(0, Math.min(100, (x / rect.width) * 100)));
    return pct;
  }, [value]);

  // Touch handlers for the custom slider track (fixes mobile)
  const handleTouchStart = useCallback((e) => {
    e.stopPropagation();
    setIsTouching(true);
    const val = getValueFromEvent(e.touches[0].clientX);
    onChange(val);
    if (muted && val > 0) onMuteToggle();
  }, [getValueFromEvent, onChange, muted, onMuteToggle]);

  const handleTouchMove = useCallback((e) => {
    if (!isTouching) return;
    e.preventDefault();
    const val = getValueFromEvent(e.touches[0].clientX);
    onChange(val);
  }, [isTouching, getValueFromEvent, onChange]);

  const handleTouchEnd = useCallback(() => {
    setIsTouching(false);
  }, []);

  const displayValue = muted ? 0 : value;

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={onMuteToggle}
        className={`p-1.5 rounded transition-colors flex-shrink-0 ${muted
            ? 'text-red-400 hover:text-red-300'
            : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'
          }`}
        title={muted ? `Unmute ${label}` : `Mute ${label}`}
      >
        {muted ? <VolumeX className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
      </button>
      <span className={`text-xs flex-shrink-0 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{label}</span>
      {/* Custom touch-friendly slider track */}
      <div
        ref={sliderRef}
        className={`relative h-6 flex-1 min-w-[60px] max-w-[100px] flex items-center cursor-pointer select-none ${isTouching ? 'scale-y-150' : ''} transition-transform duration-150`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={(e) => {
          const val = getValueFromEvent(e.clientX);
          onChange(val);
          if (muted && val > 0) onMuteToggle();
        }}
      >
        {/* Track background */}
        <div className={`absolute left-0 right-0 h-1.5 rounded-full ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}>
          {/* Filled portion */}
          <div
            className="absolute left-0 top-0 h-full rounded-full transition-all duration-75"
            style={{ width: `${displayValue}%`, backgroundColor: color }}
          />
        </div>
        {/* Thumb */}
        <div
          className={`absolute w-4 h-4 rounded-full shadow-md border-2 transition-all duration-75 -translate-x-1/2 ${
            isTouching 
              ? 'scale-125 shadow-lg' 
              : ''
          }`}
          style={{ 
            left: `${displayValue}%`, 
            backgroundColor: isDark ? '#fff' : '#fff',
            borderColor: color 
          }}
        />
      </div>
      <span className={`text-xs w-7 text-right flex-shrink-0 tabular-nums ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{value}%</span>
    </div>
  );
};

// ============================================================
// LINE LENGTH WARNING COMPONENT
// ============================================================
const LineLengthWarning = ({ lineIndex, charCount, maxChars }) => (
  <div 
    className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded" 
    title={`Line ${lineIndex + 1} has ${charCount} characters (max ${maxChars}). Consider splitting it.`}
  >
    <AlertTriangle className="w-3 h-3" />
    <span>Too long ({charCount}/{maxChars}) - split this line</span>
  </div>
);

// Header warning component - shows count of lines that are too long
const TooLongLinesWarning = ({ lyricsLines, aspectRatio, fontSize, emphasizeCurrentLine }) => {
  let maxChars = MAX_CHARS_PER_LINE[aspectRatio || '16:9']?.[fontSize || 'normal'] || 50;
  if (emphasizeCurrentLine) maxChars = Math.floor(maxChars * EMPHASIZE_CHAR_REDUCTION);
  
  const tooLongCount = lyricsLines.filter(line => {
    if (!line || line.length === 0) return false;
    const charCount = line.reduce((sum, w) => sum + w.word.length + 1, 0) - 1;
    return charCount > maxChars;
  }).length;
  
  if (tooLongCount === 0) return null;
  
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded">
      <AlertTriangle className="w-3 h-3" />
      {tooLongCount} {tooLongCount === 1 ? 'line' : 'lines'} too long
    </span>
  );
};

// ============================================================
// FONT DROPDOWN COMPONENT - Shows each font in its own typeface
// ============================================================
const FontDropdown = ({ value, onChange, isDark, isStudioUser }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  // Get current selected font
  const selectedFont = FONT_OPTIONS.find(f => f.value === value) || FONT_OPTIONS[1];
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleSelect = (fontValue) => {
    // Don't allow selecting custom font if not Studio user
    const font = FONT_OPTIONS.find(f => f.value === fontValue);
    if (font?.isCustom && !isStudioUser) return;
    
    onChange(fontValue);
    setIsOpen(false);
  };
  
  return (
    <div ref={dropdownRef} className="relative">
      {/* Selected Value Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 rounded-lg text-sm text-left flex items-center justify-between ${
          isDark 
            ? 'bg-white/10 border-white/10 text-white hover:bg-white/15' 
            : 'bg-gray-50 border-gray-200 text-gray-900 hover:bg-gray-100'
        } border transition-colors`}
      >
        <span style={{ fontFamily: selectedFont.isCustom ? 'inherit' : selectedFont.family }}>
          {selectedFont.label}
          {selectedFont.isCustom && !isStudioUser && ' (Studio)'}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          className={`absolute z-50 w-full mt-1 rounded-lg shadow-xl max-h-64 overflow-y-auto ${
            isDark 
              ? 'bg-gray-800 border border-white/10' 
              : 'bg-white border border-gray-200'
          }`}
        >
          {FONT_OPTIONS.map((font, index) => {
            const isDisabled = font.isCustom && !isStudioUser;
            const isSelected = font.value === value;
            
            return (
              <div key={font.value}>
                {/* Add separator after Custom Font */}
                {index === 1 && (
                  <div className={`border-t ${isDark ? 'border-white/10' : 'border-gray-200'} my-1`} />
                )}
                
                <button
                  type="button"
                  onClick={() => handleSelect(font.value)}
                  disabled={isDisabled}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between transition-colors ${
                    isDisabled
                      ? isDark 
                        ? 'text-gray-500 cursor-not-allowed' 
                        : 'text-gray-400 cursor-not-allowed'
                      : isSelected
                        ? isDark
                          ? 'bg-cyan-500/20 text-cyan-400'
                          : 'bg-cyan-50 text-cyan-700'
                        : isDark
                          ? 'text-white hover:bg-white/10'
                          : 'text-gray-900 hover:bg-gray-50'
                  }`}
                  style={{ fontFamily: font.isCustom ? 'inherit' : font.family }}
                >
                  <span className="flex items-center gap-2">
                    {font.label}
                    {font.isCustom && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'
                      }`}>
                        Studio
                      </span>
                    )}
                  </span>
                  {isSelected && <Check className="w-4 h-4" />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ============================================================
// WORD DURATION CONTEXT MENU COMPONENT - NEW in V10.10
// ============================================================
const WordContextMenu = ({ 
  isOpen, 
  position, 
  word, 
  wordIndex, 
  onClose, 
  onRename,
  onAddWordBefore,
  onAddWordAfter,
  onDeleteWord,
  isDark 
}) => {
  const menuRef = useRef(null);

  // Close on click/tap outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen || !word) return null;

  const currentDuration = (word.end - word.start).toFixed(3);

  const MenuItem = ({ icon: Icon, label, onClick, danger = false, disabled = false }) => (
    <button
      onClick={() => { onClick(); onClose(); }}
      onTouchEnd={(e) => { e.preventDefault(); onClick(); onClose(); }}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors rounded-lg
        ${disabled 
          ? 'opacity-50 cursor-not-allowed' 
          : danger 
            ? 'hover:bg-red-500/20 text-red-400 active:bg-red-500/30' 
            : isDark 
              ? 'hover:bg-white/10 text-white active:bg-white/20' 
              : 'hover:bg-gray-100 text-gray-700 active:bg-gray-200'
        }`}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span>{label}</span>
    </button>
  );

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.1 }}
        className={`fixed z-50 min-w-[200px] rounded-xl shadow-xl border overflow-hidden
          ${isDark 
            ? 'bg-gray-900/95 border-white/10 backdrop-blur-xl' 
            : 'bg-white/95 border-gray-200 backdrop-blur-xl'
          }`}
        style={{ 
          left: position.x, 
          top: position.y,
          maxHeight: '80vh'
        }}
      >
        {/* Header with word info */}
        <div className={`px-3 py-2 border-b ${isDark ? 'border-white/10 bg-white/5' : 'border-gray-100 bg-gray-50'}`}>
          <div className="flex items-center justify-between">
            <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>"{word.word}"</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-100 text-cyan-700'}`}>
              {currentDuration}s
            </span>
          </div>
          <div className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {word.start.toFixed(2)}s - {word.end.toFixed(2)}s
          </div>
        </div>

        {/* Menu items */}
        <div className="p-1">
          {/* Edit Section */}
          <MenuItem icon={Edit3} label="Rename Word" onClick={() => onRename(wordIndex)} />
          
          <div className={`my-1 border-t ${isDark ? 'border-white/5' : 'border-gray-100'}`} />

          {/* Add Words Section */}
          <MenuItem icon={Plus} label="Add Word Before" onClick={() => onAddWordBefore(wordIndex)} />
          <MenuItem icon={Plus} label="Add Word After" onClick={() => onAddWordAfter(wordIndex)} />
          
          <div className={`my-1 border-t ${isDark ? 'border-white/5' : 'border-gray-100'}`} />

          {/* Delete Section */}
          <MenuItem icon={Trash2} label="Delete Word" onClick={() => onDeleteWord(wordIndex)} danger />
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function PreviewEditPage() {
  const router = useRouter();
  const { id } = router.query;
  const { isDark } = useTheme();

  // Core state
  const [project, setProject] = useState(null);
  const [words, setWords] = useState([]);
  const [originalWords, setOriginalWords] = useState([]);
  const [originalLyricsText, setOriginalLyricsText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Track info state (editable artist, title, disc ID)
  const [trackInfo, setTrackInfo] = useState({
    artistName: '',
    songTitle: '',
    discId: 'KT-01'
  });
  const [editingTrackInfo, setEditingTrackInfo] = useState(false);
  
  // Fullscreen preview state
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);

  // V13: QR Sharing state
  const [showShareModal, setShowShareModal] = useState(false);
  const [isTokenAccess, setIsTokenAccess] = useState(false);

  // V11: Active tab state
  const [activeTab, setActiveTab] = useState('timing');
  const [checklistHighlight, setChecklistHighlight] = useState(null);

  // V11: Style settings state (will be initialized from project data)
  const [styleSettings, setStyleSettings] = useState({
    selectedFont: 'arial',
    fontSize: 'normal',
    textColor: '#ffffff',
    sungColor: '#00d4ff',
    outlineColor: '#000000',
  });

  // V11: Custom font upload state
  const [customFontUploading, setCustomFontUploading] = useState(false);
  const [customFontError, setCustomFontError] = useState(null);

  // V11: Branding settings state (Studio tier)
  const [brandingSettings, setBrandingSettings] = useState({
    // Logo/Watermark
    logoUrl: null,
    logoPosition: 'bottom-right', // top-left, top-center, top-right, bottom-left, bottom-center, bottom-right
    logoSize: 50, // 20-150 percentage (50 = 50px base size)
    logoOpacity: 80, // 0-100
    // Start Image
    startImageUrl: null,
    startImageFit: 'contain', // 'contain', 'cover', 'fill'
    startImageOpacity: 100, // 0-100
    startImageShowTitle: true, // Show artist/title over the image
    // Outro
    outroText: '',
    outroDuration: 3, // 2-5 seconds
    outroFontSize: 'medium', // small, medium, large
  });

  // V11: Branding upload states
  const [logoUploading, setLogoUploading] = useState(false);
  const [startImageUploading, setStartImageUploading] = useState(false);
  const [brandingError, setBrandingError] = useState(null);

  // V11: Update branding settings helper
  const updateBrandingSettings = useCallback((updates) => {
    setBrandingSettings(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  }, []);

  // V11: Handle logo upload
  const handleLogoUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setBrandingError('Please upload an image file (PNG recommended for transparency)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setBrandingError('Logo must be less than 5MB');
      return;
    }

    setLogoUploading(true);
    setBrandingError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const formData = new FormData();
      formData.append('logo', file);
      formData.append('projectId', id);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload-logo`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to upload logo');
      }

      const result = await response.json();
      updateBrandingSettings({ logoUrl: result.logoUrl });
      setProject(prev => ({ ...prev, logo_url: result.logoUrl }));
    } catch (err) {
      console.error('Logo upload error:', err);
      setBrandingError(err.message || 'Failed to upload logo');
    } finally {
      setLogoUploading(false);
    }
  }, [id, router, updateBrandingSettings]);

  // V11: Handle start image upload
  const handleStartImageUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setBrandingError('Please upload an image file (PNG recommended for transparency)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setBrandingError('Start image must be less than 10MB');
      return;
    }

    setStartImageUploading(true);
    setBrandingError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const formData = new FormData();
      formData.append('startImage', file);
      formData.append('projectId', id);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload-start-image`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to upload start image');
      }

      const result = await response.json();
      updateBrandingSettings({ startImageUrl: result.startImageUrl });
      setProject(prev => ({ ...prev, start_image_url: result.startImageUrl }));
    } catch (err) {
      console.error('Start image upload error:', err);
      setBrandingError(err.message || 'Failed to upload start image');
    } finally {
      setStartImageUploading(false);
    }
  }, [id, router, updateBrandingSettings]);

  // V11: Update style settings helper
  const updateStyleSettings = useCallback((updates) => {
    setStyleSettings(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  }, []);

  // V11: Handle custom font upload
  const handleCustomFontUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['.ttf', '.otf', '.woff', '.woff2'];
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!validTypes.includes(ext)) {
      setCustomFontError('Please upload a .ttf, .otf, .woff, or .woff2 font file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setCustomFontError('Font file must be less than 5MB');
      return;
    }

    setCustomFontUploading(true);
    setCustomFontError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // Upload to R2 via API
      const formData = new FormData();
      formData.append('font', file);
      formData.append('projectId', id);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload-font`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to upload font');
      }

      const result = await response.json();
      
      // Update project state with new font URL
      setProject(prev => ({
        ...prev,
        custom_font_url: result.fontUrl,
        custom_font_name: file.name.replace(/\.[^/.]+$/, ''),
      }));

      // Auto-select custom font
      updateStyleSettings({ selectedFont: 'custom' });
      
    } catch (err) {
      console.error('Font upload error:', err);
      setCustomFontError(err.message || 'Failed to upload font');
    } finally {
      setCustomFontUploading(false);
    }
  }, [id, router, updateStyleSettings]);

  // V11: Background settings state
  const [bgSettings, setBgSettings] = useState({
    bgType: 'gradient', // 'color', 'gradient', 'image', 'video', 'custom-video'
    bgColor1: '#1a1a2e',
    bgColor2: '#16213e',
    gradientDirection: 'to bottom',
    bgImageUrl: null,
    bgImagePreview: null,
    bgImageFit: 'fill', // 'fill', 'fit', 'stretch'
    bgVideoPreset: null,
    bgVideoPresetFilename: null,
    bgCustomVideoUrl: null,
    bgCustomVideoPreview: null,
  });

  // V11: Layout settings state
  const [layoutSettings, setLayoutSettings] = useState({
    displayMode: 'scroll', // 'scroll', 'page', 'overwrite'
    aspectRatio: '16:9', // '16:9', '4:3', '9:16'
    linesPerPage: 4, // For page mode: 4-8
    linesPerScroll: 4, // For scroll mode: 3-6
    linesPerOverwrite: 4, // For overwrite mode: 4-8
    emphasizeCurrentLine: false, // Make current line larger
    showProgressBar: true, // Show progress bar during instrumental breaks
    showLeadInBars: true, // Show lead-in sweep bars before each line
    cleanVersion: false, // Replace profanity with ###
  });

  // V11: Update layout settings helper
  const updateLayoutSettings = useCallback((updates) => {
    setLayoutSettings(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  }, []);

  // V12: Export settings state
  const [exportSettings, setExportSettings] = useState({
    audioTrack: 'instrumental', // 'instrumental', 'guide', 'original'
    videoQuality: '720p', // '540p', '720p', '1080p', '4k'
    exportMode: 'queue', // 'queue', 'instant'
  });

  // V11: Update export settings helper
  const updateExportSettings = useCallback((updates) => {
    setExportSettings(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  }, []);

  // V12: Preset system state
  const [presets, setPresets] = useState([]);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [savingPreset, setSavingPreset] = useState(false);
  const [presetError, setPresetError] = useState(null);
  const [loadingPresetId, setLoadingPresetId] = useState(null);

  // V12: Load user's presets
  const loadPresets = useCallback(async () => {
    setPresetsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('user_presets')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPresets(data || []);
    } catch (err) {
      console.error('Failed to load presets:', err);
    } finally {
      setPresetsLoading(false);
    }
  }, []);

  // V12: Save current settings as preset
  const savePreset = useCallback(async () => {
    if (!presetName.trim()) {
      setPresetError('Please enter a preset name');
      return;
    }

    setSavingPreset(true);
    setPresetError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const presetData = {
        user_id: session.user.id,
        name: presetName.trim(),
        // Style settings
        font: styleSettings.selectedFont,
        font_size: styleSettings.fontSize,
        text_color: styleSettings.textColor,
        sung_color: styleSettings.sungColor,
        outline_color: styleSettings.outlineColor,
        // Background settings
        bg_type: bgSettings.bgType,
        bg_color_1: bgSettings.bgColor1,
        bg_color_2: bgSettings.bgColor2,
        gradient_direction: bgSettings.gradientDirection,
        bg_image_url: bgSettings.bgImageUrl,
          bg_image_fit: bgSettings.bgImageFit || 'fill',
        bg_image_fit: bgSettings.bgImageFit || 'fill',
        bg_video_preset_filename: bgSettings.bgVideoPresetFilename,
        // Layout settings
        display_mode: layoutSettings.displayMode,
        aspect_ratio: layoutSettings.aspectRatio,
        lines_per_page: layoutSettings.linesPerPage,
        lines_per_scroll: layoutSettings.linesPerScroll,
        lines_per_overwrite: layoutSettings.linesPerOverwrite,
        emphasize_current_line: layoutSettings.emphasizeCurrentLine,
        show_progress_bar: layoutSettings.showProgressBar,
        show_lead_in_bars: layoutSettings.showLeadInBars,
        clean_version: layoutSettings.cleanVersion,
        // Export settings
        audio_track: exportSettings.audioTrack,
        video_quality: exportSettings.videoQuality,
        // Branding settings
        logo_url: brandingSettings.logoUrl,
        logo_position: brandingSettings.logoPosition,
        logo_size: brandingSettings.logoSize,
        logo_opacity: brandingSettings.logoOpacity,
        start_image_url: brandingSettings.startImageUrl,
        start_image_fit: brandingSettings.startImageFit,
        start_image_opacity: brandingSettings.startImageOpacity,
        start_image_show_title: brandingSettings.startImageShowTitle,
      };

      const { data, error } = await supabase
        .from('user_presets')
        .insert(presetData)
        .select()
        .single();

      if (error) throw error;

      setPresets(prev => [data, ...prev]);
      setPresetModalOpen(false);
      setPresetName('');
    } catch (err) {
      console.error('Failed to save preset:', err);
      setPresetError(err.message || 'Failed to save preset');
    } finally {
      setSavingPreset(false);
    }
  }, [presetName, styleSettings, bgSettings, layoutSettings, exportSettings, brandingSettings, router]);

  // V12: Load a preset and apply settings
  const loadPreset = useCallback((preset) => {
    setLoadingPresetId(preset.id);
    
    // Apply style settings
    setStyleSettings({
      selectedFont: preset.font || 'arial',
      fontSize: preset.font_size || 'normal',
      textColor: preset.text_color || '#ffffff',
      sungColor: preset.sung_color || '#00d4ff',
      outlineColor: preset.outline_color || '#000000',
    });

    // Apply background settings
    setBgSettings(prev => ({
      ...prev,
      bgType: preset.bg_type || 'gradient',
      bgColor1: preset.bg_color_1 || '#1a1a2e',
      bgColor2: preset.bg_color_2 || '#16213e',
      gradientDirection: preset.gradient_direction || 'to bottom',
      bgImageUrl: preset.bg_image_url || null,
      bgImagePreview: preset.bg_image_url || null,
      bgImageFit: preset.bg_image_fit || 'fill',
      bgVideoPresetFilename: preset.bg_video_preset_filename || null,
      bgVideoPreset: preset.bg_video_preset_filename ? 
        PRESET_VIDEO_BACKGROUNDS.find(v => v.filename === preset.bg_video_preset_filename)?.url || null : null,
    }));

    // Apply layout settings
    setLayoutSettings({
      displayMode: preset.display_mode || 'scroll',
      aspectRatio: preset.aspect_ratio || '16:9',
      linesPerPage: preset.lines_per_page || 4,
      linesPerScroll: preset.lines_per_scroll || 4,
      linesPerOverwrite: preset.lines_per_overwrite || 4,
      emphasizeCurrentLine: preset.emphasize_current_line || false,
      showProgressBar: preset.show_progress_bar !== false,
      showLeadInBars: preset.show_lead_in_bars !== false,
      cleanVersion: preset.clean_version || false,
    });

    // Apply export settings
    setExportSettings({
      audioTrack: preset.audio_track || 'instrumental',
      videoQuality: preset.video_quality || '720p',
    });

    // Apply branding settings
    setBrandingSettings(prev => ({
      ...prev,
      logoUrl: preset.logo_url || null,
      logoPosition: preset.logo_position || 'bottom-right',
      logoSize: preset.logo_size || 50,
      logoOpacity: preset.logo_opacity || 80,
      startImageUrl: preset.start_image_url || null,
      startImageFit: preset.start_image_fit || 'contain',
      startImageOpacity: preset.start_image_opacity || 100,
      startImageShowTitle: preset.start_image_show_title !== false,
    }));

    setHasChanges(true);
    
    setTimeout(() => setLoadingPresetId(null), 500);
  }, []);

  // V12: Delete a preset
  const deletePreset = useCallback(async (presetId) => {
    if (!window.confirm('Are you sure you want to delete this preset?')) return;

    try {
      const { error } = await supabase
        .from('user_presets')
        .delete()
        .eq('id', presetId);

      if (error) throw error;

      setPresets(prev => prev.filter(p => p.id !== presetId));
    } catch (err) {
      console.error('Failed to delete preset:', err);
    }
  }, []);

  // V12: Load presets on mount
  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  // V11: Background category filter state
  const [selectedVideoCategory, setSelectedVideoCategory] = useState('all');

  // V11: Background upload states
  const [bgImageUploading, setBgImageUploading] = useState(false);
  const [bgVideoUploading, setBgVideoUploading] = useState(false);
  const [bgUploadError, setBgUploadError] = useState(null);

  // V11: Update background settings helper
  const updateBgSettings = useCallback((updates) => {
    setBgSettings(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  }, []);

  // V11: Filter video presets by category
  const filteredVideoPresets = useMemo(() => {
    if (selectedVideoCategory === 'all') return PRESET_VIDEO_BACKGROUNDS;
    return PRESET_VIDEO_BACKGROUNDS.filter(p => p.category === selectedVideoCategory);
  }, [selectedVideoCategory]);

  // V11: Handle background image upload
  const handleBgImageUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setBgUploadError('Please upload an image file (JPG, PNG, etc.)');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setBgUploadError('Image must be less than 10MB');
      return;
    }

    setBgImageUploading(true);
    setBgUploadError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const formData = new FormData();
      formData.append('image', file);
      formData.append('projectId', id);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload-background-image`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to upload image');
      }

      const result = await response.json();
      updateBgSettings({ 
        bgType: 'image',
        bgImageUrl: result.imageUrl,
        bgImagePreview: result.imageUrl,
      });
      
      // Update project state
      setProject(prev => ({ ...prev, bg_image_url: result.imageUrl }));
    } catch (err) {
      console.error('Image upload error:', err);
      setBgUploadError(err.message || 'Failed to upload image');
    } finally {
      setBgImageUploading(false);
    }
  }, [id, router, updateBgSettings]);

  // V11: Handle custom video upload
  const handleBgVideoUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('video/')) {
      setBgUploadError('Please upload a video file (MP4 recommended)');
      return;
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      setBgUploadError('Video must be less than 50MB');
      return;
    }

    setBgVideoUploading(true);
    setBgUploadError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const formData = new FormData();
      formData.append('video', file);
      formData.append('projectId', id);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload-background-video`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to upload video');
      }

      const result = await response.json();
      updateBgSettings({ 
        bgType: 'custom-video',
        bgCustomVideoUrl: result.videoUrl,
        bgCustomVideoPreview: result.videoUrl,
        bgVideoPreset: null,
        bgVideoPresetFilename: null,
      });
      
      // Update project state
      setProject(prev => ({ ...prev, bg_video_url: result.videoUrl }));
    } catch (err) {
      console.error('Video upload error:', err);
      setBgUploadError(err.message || 'Failed to upload video');
    } finally {
      setBgVideoUploading(false);
    }
  }, [id, router, updateBgSettings]);

  // Section collapse state
  const [lineEditorExpanded, setLineEditorExpanded] = useState(false);
  const [timelineEditorExpanded, setTimelineEditorExpanded] = useState(false);
  const [originalLyricsExpanded, setOriginalLyricsExpanded] = useState(false); // collapsed on mobile by default

  // On mount: expand Line Editor on desktop only (mobile stays collapsed)
  useEffect(() => {
    if (window.innerWidth >= 640) {
      setLineEditorExpanded(true);
    }
  }, []);

  // Preview resize state
  const [previewHeight, setPreviewHeight] = useState(DEFAULT_PREVIEW_HEIGHT);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartY = useRef(0);
  const resizeStartHeight = useRef(0);

  // Editor resize state
  const [editorHeight, setEditorHeight] = useState(200);
  const [isResizingEditor, setIsResizingEditor] = useState(false);
  const editorResizeStartY = useRef(0);
  const editorResizeStartHeight = useRef(0);

  // Audio state
  const instrumentalRef = useRef(null);
  const vocalsRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Volume state - NEW in V10.8
  const [instrumentalVolume, setInstrumentalVolume] = useState(100);
  const [vocalsVolume, setVocalsVolume] = useState(0);  // Start at 0 - vocals are for reference only
  const [instrumentalMuted, setInstrumentalMuted] = useState(false);
  const [vocalsMuted, setVocalsMuted] = useState(true);  // Start muted
  
  // Waveform state for timeline visualization
  const [waveformData, setWaveformData] = useState(null);
  const [waveformLoading, setWaveformLoading] = useState(false);
  const [waveformThreshold, setWaveformThreshold] = useState(0); // 0-100, hides amplitudes below this %
  const [timelineHover, setTimelineHover] = useState({ show: false, x: 0, time: 0 });

  // Timeline state
  const timelineContainerRef = useRef(null);
  const [zoom, setZoom] = useState(PIXELS_PER_SECOND_DEFAULT);
  // V10.9: Multi-selection - Set of selected word indices
  const [selectedWordIndices, setSelectedWordIndices] = useState(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTimes, setDragStartTimes] = useState({});
  
  // Word resize state - drag handles on word edges
  const [hoveredWordIndex, setHoveredWordIndex] = useState(null);
  const [isWordResizing, setIsWordResizing] = useState(false);
  const [wordResizeEdge, setWordResizeEdge] = useState(null); // 'left' or 'right'
  const [wordResizeIndex, setWordResizeIndex] = useState(null);
  const [wordResizeStartX, setWordResizeStartX] = useState(0);
  const [wordResizeStartTime, setWordResizeStartTime] = useState(0);

  // Word editing state - INLINE EDITING
  const [editingWordIndex, setEditingWordIndex] = useState(null);
  const [editingText, setEditingText] = useState('');
  const editInputRef = useRef(null);

  // Add word modal state
  const [showAddWordModal, setShowAddWordModal] = useState(false);
  const [newWordText, setNewWordText] = useState('');
  const [addWordPosition, setAddWordPosition] = useState('after');

  // Duet mode state
  const [isDuetMode, setIsDuetMode] = useState(false);
  const [duetColors, setDuetColors] = useState(DEFAULT_DUET_COLORS);
  const [paintMode, setPaintMode] = useState(null);
  const [isPainting, setIsPainting] = useState(false);
  const [paintedIndices, setPaintedIndices] = useState(new Set());
  
  // Undo/Redo state for words
  const [wordsHistory, setWordsHistory] = useState([]);
  const [wordsHistoryIndex, setWordsHistoryIndex] = useState(-1);
  const [isUndoRedo, setIsUndoRedo] = useState(false);
  
  // V10.10: Context menu state for word duration adjustment
  const [contextMenu, setContextMenu] = useState({
    isOpen: false,
    position: { x: 0, y: 0 },
    wordIndex: null
  });

  // Long-press context menu for mobile (500ms hold = context menu)
  const wordLongPressTimer = useRef(null);
  const wordLongPressTriggered = useRef(false);
  const wordTouchStartPos = useRef({ x: 0, y: 0 });
  
  // For backwards compatibility - compute single selected index (must be after all useState)
  const selectedWordIndex = selectedWordIndices.size === 1 ? [...selectedWordIndices][0] : null;

  // ============================================================
  // GLOW & GROW RESIZE HANDLES (touch-friendly)
  // ============================================================
  // State for which handle is "glowing" (long-pressed / active drag)
  const [glowingHandle, setGlowingHandle] = useState(null); // 'preview' | 'editor' | null
  const longPressTimer = useRef(null);

  // ============================================================
  // PREVIEW RESIZE HANDLERS (mouse + touch with Glow & Grow)
  // ============================================================
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    setGlowingHandle('preview');
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    resizeStartY.current = clientY;
    resizeStartHeight.current = previewHeight;
  }, [previewHeight]);

  // Long press to activate glow before dragging
  const handleResizeTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    resizeStartY.current = touch.clientY;
    resizeStartHeight.current = previewHeight;
    // Start glow immediately on touch
    setGlowingHandle('preview');
    // Start actual resize after a brief moment (150ms) so the glow is visible
    longPressTimer.current = setTimeout(() => {
      setIsResizing(true);
    }, 150);
  }, [previewHeight]);

  const handleResizeTouchEnd = useCallback(() => {
    clearTimeout(longPressTimer.current);
    setIsResizing(false);
    setGlowingHandle(null);
  }, []);

  useEffect(() => {
    const handleResizeMove = (e) => {
      if (!isResizing) return;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const deltaY = clientY - resizeStartY.current;
      const newHeight = Math.min(MAX_PREVIEW_HEIGHT, Math.max(MIN_PREVIEW_HEIGHT, resizeStartHeight.current + deltaY));
      setPreviewHeight(newHeight);
    };

    const handleResizeEnd = () => {
      setIsResizing(false);
      setGlowingHandle(null);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
      window.addEventListener('touchmove', handleResizeMove, { passive: false });
      window.addEventListener('touchend', handleResizeEnd);
      window.addEventListener('touchcancel', handleResizeEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
      window.removeEventListener('touchmove', handleResizeMove);
      window.removeEventListener('touchend', handleResizeEnd);
      window.removeEventListener('touchcancel', handleResizeEnd);
    };
  }, [isResizing]);

  // ============================================================
  // EDITOR RESIZE HANDLERS (mouse + touch with Glow & Grow)
  // ============================================================
  const handleEditorResizeStart = useCallback((e) => {
    e.preventDefault();
    setIsResizingEditor(true);
    setGlowingHandle('editor');
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    editorResizeStartY.current = clientY;
    editorResizeStartHeight.current = editorHeight;
  }, [editorHeight]);

  const handleEditorResizeTouchStart = useCallback((e) => {
    const touch = e.touches[0];
    editorResizeStartY.current = touch.clientY;
    editorResizeStartHeight.current = editorHeight;
    setGlowingHandle('editor');
    longPressTimer.current = setTimeout(() => {
      setIsResizingEditor(true);
    }, 150);
  }, [editorHeight]);

  const handleEditorResizeTouchEnd = useCallback(() => {
    clearTimeout(longPressTimer.current);
    setIsResizingEditor(false);
    setGlowingHandle(null);
  }, []);

  useEffect(() => {
    const handleEditorResizeMove = (e) => {
      if (!isResizingEditor) return;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const deltaY = clientY - editorResizeStartY.current;
      const newHeight = Math.min(500, Math.max(150, editorResizeStartHeight.current + deltaY));
      setEditorHeight(newHeight);
    };

    const handleEditorResizeEnd = () => {
      setIsResizingEditor(false);
      setGlowingHandle(null);
    };

    if (isResizingEditor) {
      window.addEventListener('mousemove', handleEditorResizeMove);
      window.addEventListener('mouseup', handleEditorResizeEnd);
      window.addEventListener('touchmove', handleEditorResizeMove, { passive: false });
      window.addEventListener('touchend', handleEditorResizeEnd);
      window.addEventListener('touchcancel', handleEditorResizeEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleEditorResizeMove);
      window.removeEventListener('mouseup', handleEditorResizeEnd);
      window.removeEventListener('touchmove', handleEditorResizeMove);
      window.removeEventListener('touchend', handleEditorResizeEnd);
      window.removeEventListener('touchcancel', handleEditorResizeEnd);
    };
  }, [isResizingEditor]);

  // ============================================================
  // VOLUME HANDLERS
  // ============================================================
  // iOS ignores audio.volume (always 1.0, read-only).
  // Use .muted as the actual control â€” it's the only thing iOS respects.
  // .volume is set as a bonus for desktop/Android.
  // ============================================================
  useEffect(() => {
    if (instrumentalRef.current) {
      const shouldMute = instrumentalMuted || instrumentalVolume === 0;
      instrumentalRef.current.muted = shouldMute;
      instrumentalRef.current.volume = instrumentalVolume / 100;
    }
  }, [instrumentalVolume, instrumentalMuted]);

  useEffect(() => {
    if (vocalsRef.current) {
      const shouldMute = vocalsMuted || vocalsVolume === 0;
      vocalsRef.current.muted = shouldMute;
      vocalsRef.current.volume = vocalsVolume / 100;
    }
  }, [vocalsVolume, vocalsMuted]);

  const handleInstrumentalVolumeChange = useCallback((value) => {
    setInstrumentalVolume(value);
    if (value > 0 && instrumentalMuted) setInstrumentalMuted(false);
    if (instrumentalRef.current) {
      instrumentalRef.current.muted = value === 0;
      instrumentalRef.current.volume = value / 100;
    }
  }, [instrumentalMuted]);

  const handleVocalsVolumeChange = useCallback((value) => {
    setVocalsVolume(value);
    if (value > 0 && vocalsMuted) setVocalsMuted(false);
    if (vocalsRef.current) {
      vocalsRef.current.muted = value === 0;
      vocalsRef.current.volume = value / 100;
    }
  }, [vocalsMuted]);

  const toggleInstrumentalMute = useCallback(() => {
    const newMuted = !instrumentalMuted;
    setInstrumentalMuted(newMuted);
    if (instrumentalRef.current) {
      instrumentalRef.current.muted = newMuted || instrumentalVolume === 0;
      instrumentalRef.current.volume = instrumentalVolume / 100;
    }
  }, [instrumentalMuted, instrumentalVolume]);

  const toggleVocalsMute = useCallback(() => {
    const newMuted = !vocalsMuted;
    setVocalsMuted(newMuted);
    if (newMuted === false && vocalsVolume === 0) {
      setVocalsVolume(50);
      if (vocalsRef.current) {
        vocalsRef.current.muted = false;
        vocalsRef.current.volume = 0.5;
      }
    } else if (vocalsRef.current) {
      vocalsRef.current.muted = newMuted || vocalsVolume === 0;
      vocalsRef.current.volume = vocalsVolume / 100;
    }
  }, [vocalsMuted, vocalsVolume]);

  // ============================================================
  // GROUP LYRICS INTO LINES (using lineBreak property)
  // ============================================================
  const lyricsLines = useMemo(() => {
    const lines = [];
    let currentLine = [];

    words.forEach((word, idx) => {
      currentLine.push({ ...word, globalIndex: idx });

      if (word.lineBreak || idx === words.length - 1) {
        lines.push(currentLine);
        currentLine = [];
      }
    });

    return lines;
  }, [words]);

  // ============================================================
  // AUTO-ADD LINE BREAKS ON INITIAL LOAD
  // ============================================================
  const addAutoLineBreaks = useCallback((wordsArray) => {
    if (!wordsArray.length) return wordsArray;

    const result = [...wordsArray];
    let wordsSinceBreak = 0;

    for (let i = 0; i < result.length; i++) {
      if (result[i].lineBreak === true) {
        wordsSinceBreak = 0;
        continue;
      }

      wordsSinceBreak++;
      let shouldBreak = false;

      if (wordsSinceBreak >= MAX_WORDS_PER_LINE) {
        shouldBreak = true;
      } else if (i < result.length - 1 && wordsSinceBreak >= 3) {
        const gap = result[i + 1].start - result[i].end;
        if (gap >= 0.5) shouldBreak = true;
      }

      if (shouldBreak && i < result.length - 1) {
        result[i] = { ...result[i], lineBreak: true };
        wordsSinceBreak = 0;
      }
    }

    return result;
  }, []);

  // ============================================================
  // CHECK IF LINE IS TOO LONG
  // ============================================================
  const isLineTooLong = useCallback((line) => {
    if (!line || line.length === 0) return false;
    
    // Get dynamic character limit based on aspect ratio and font size
    const aspectRatio = layoutSettings.aspectRatio || '16:9';
    const fontSize = styleSettings.fontSize || 'normal';
    let maxChars = MAX_CHARS_PER_LINE[aspectRatio]?.[fontSize] || 50;
    
    // Reduce limit when emphasize is on (current line renders 1.3x larger)
    if (layoutSettings.emphasizeCurrentLine) {
      maxChars = Math.floor(maxChars * EMPHASIZE_CHAR_REDUCTION);
    }
    
    // Check character count
    const charCount = line.reduce((sum, w) => sum + w.word.length + 1, 0) - 1; // -1 to not count trailing space
    return charCount > maxChars;
  }, [layoutSettings.aspectRatio, layoutSettings.emphasizeCurrentLine, styleSettings.fontSize]);

  // ============================================================
  // LINE BREAK FUNCTIONS - ORIGINAL WORKING LOGIC
  // ============================================================

  // Move word down (add line break before this word)
  // This moves the selected word to the NEXT line by:
  // 1. Adding a line break BEFORE the word (on previous word)
  // 2. Removing the next line break to redistribute lines
  const moveWordDown = useCallback((globalIndex) => {
    if (globalIndex === 0) return; // Can't move first word down

    setWords(prev => {
      const newWords = [...prev];

      // Add line break BEFORE this word (on the previous word)
      newWords[globalIndex - 1] = { ...newWords[globalIndex - 1], lineBreak: true };

      // Find the next line break after this word and remove it (redistribute)
      for (let i = globalIndex; i < newWords.length; i++) {
        if (newWords[i].lineBreak) {
          newWords[i] = { ...newWords[i], lineBreak: false };
          break;
        }
      }

      return newWords;
    });
    setHasChanges(true);
  }, []);

  // Merge line up (remove line break before this line)
  // This merges the current line with the previous line by:
  // Removing the line break from the last word of the previous line
  const mergeLineUp = useCallback((lineIndex) => {
    if (lineIndex === 0) return; // Can't merge first line up

    const prevLine = lyricsLines[lineIndex - 1];
    if (!prevLine || prevLine.length === 0) return;

    const prevLineLastWordIndex = prevLine[prevLine.length - 1].globalIndex;

    setWords(prev => {
      const newWords = [...prev];
      newWords[prevLineLastWordIndex] = { ...newWords[prevLineLastWordIndex], lineBreak: false };
      return newWords;
    });
    setHasChanges(true);
  }, [lyricsLines]);

  // Merge line down - Move the SELECTED word (and all after it on this line) to the NEXT line
  // If no word selected, moves the last word
  // Example: Select "my" in "making my rounds all" -> "making" + "my rounds all over town"
  const mergeLineDown = useCallback((lineIndex) => {
    const currentLine = lyricsLines[lineIndex];
    if (!currentLine || currentLine.length <= 1) return; // Need at least 2 words to split

    // Find if selected word is in this line
    let splitIndex = -1;
    for (let i = 0; i < currentLine.length; i++) {
      if (currentLine[i].globalIndex === selectedWordIndex) {
        splitIndex = i;
        break;
      }
    }

    // If no word selected in this line, or first word selected, move the last word
    if (splitIndex <= 0) {
      splitIndex = currentLine.length - 1;
    }

    // Get the word BEFORE the split point (this is where we add the line break)
    const wordBeforeSplitIndex = currentLine[splitIndex - 1].globalIndex;

    setWords(prev => {
      const newWords = [...prev];

      // Add line break after the word BEFORE the selected word
      newWords[wordBeforeSplitIndex] = { ...newWords[wordBeforeSplitIndex], lineBreak: true };

      // Remove the line break from the last word of the original line 
      // (so it connects to the next line)
      const lastWordIndex = currentLine[currentLine.length - 1].globalIndex;
      if (newWords[lastWordIndex].lineBreak) {
        newWords[lastWordIndex] = { ...newWords[lastWordIndex], lineBreak: false };
      }

      return newWords;
    });
    setHasChanges(true);
  }, [lyricsLines, selectedWordIndex]);

  // Merge Down to New Line - Creates a NEW separate line with selected words
  // Unlike mergeLineDown which merges INTO the next line, this creates a standalone line
  // Example: Select "my" in "making my rounds all" (line 1) with "over town" (line 2)
  // Result: "making" (line 1) + "my rounds all" (NEW line 2) + "over town" (line 3)
  const mergeDownToNewLine = useCallback((lineIndex) => {
    const currentLine = lyricsLines[lineIndex];
    if (!currentLine || currentLine.length <= 1) return;

    // Find if selected word is in this line
    let splitIndex = -1;
    for (let i = 0; i < currentLine.length; i++) {
      if (currentLine[i].globalIndex === selectedWordIndex) {
        splitIndex = i;
        break;
      }
    }

    // If no word selected or first word selected, use last word
    if (splitIndex <= 0) {
      splitIndex = currentLine.length - 1;
    }

    const wordBeforeSplitIndex = currentLine[splitIndex - 1].globalIndex;
    const lastWordIndex = currentLine[currentLine.length - 1].globalIndex;

    setWords(prev => {
      const newWords = [...prev];
      // Add line break before the selected word (creates new line)
      newWords[wordBeforeSplitIndex] = { ...newWords[wordBeforeSplitIndex], lineBreak: true };
      // KEEP the line break on last word (so it stays as separate line)
      // If there wasn't one, add it
      if (!newWords[lastWordIndex].lineBreak && lineIndex < lyricsLines.length - 1) {
        newWords[lastWordIndex] = { ...newWords[lastWordIndex], lineBreak: true };
      }
      return newWords;
    });
    setHasChanges(true);
  }, [lyricsLines, selectedWordIndex]);

  // Merge Up to New Line - Creates a NEW separate line ABOVE with words UP TO selected word
  // Example: Select "rounds" in "making my rounds all" (line 1)
  // Result: "making my rounds" (NEW line 1) + "all" (line 2 - what remains)
  const mergeUpToNewLine = useCallback((lineIndex) => {
    const currentLine = lyricsLines[lineIndex];
    if (!currentLine || currentLine.length <= 1) return;

    // Find if selected word is in this line
    let splitIndex = -1;
    for (let i = 0; i < currentLine.length; i++) {
      if (currentLine[i].globalIndex === selectedWordIndex) {
        splitIndex = i;
        break;
      }
    }

    // If no word selected, or last word selected, use first word (split after first)
    if (splitIndex < 0 || splitIndex >= currentLine.length - 1) {
      splitIndex = 0;
    }

    // Add line break AFTER the selected word (words up to and including selected become new line)
    const selectedWordGlobalIndex = currentLine[splitIndex].globalIndex;

    setWords(prev => {
      const newWords = [...prev];
      // Add line break after the selected word
      newWords[selectedWordGlobalIndex] = { ...newWords[selectedWordGlobalIndex], lineBreak: true };
      return newWords;
    });
    setHasChanges(true);
  }, [lyricsLines, selectedWordIndex]);

  // ============================================================
  // LOAD PROJECT (V13: Now supports token-based access for QR sharing)
  // ============================================================
  useEffect(() => {
    if (!id) return;
    const loadProject = async () => {
      try {
        setLoading(true);
        
        // V13: Check for edit token in URL (for accessing from another device via QR code)
        const urlParams = new URLSearchParams(window.location.search);
        const editToken = urlParams.get('token');
        
        let projectData = null;
        
        if (editToken) {
          // Token-based access (no login required, but must have valid token)
          const { data, error: tokenError } = await supabase
            .from('projects')
            .select('*')
            .eq('id', id)
            .eq('edit_token', editToken)
            .single();
          
          if (tokenError || !data) {
            setError('Invalid or expired edit link. Please request a new one from the project owner.');
            setLoading(false);
            return;
          }
          
          projectData = data;
          setIsTokenAccess(true);
        } else {
          // Normal authenticated access
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) { router.push('/login'); return; }
          
          const { data, error: projectError } = await supabase
            .from('projects')
            .select('*')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();
          
          if (projectError || !data) { 
            setError('Project not found'); 
            setLoading(false);
            return; 
          }
          
          projectData = data;
        }

        // Debug: Log custom font info
        console.log('Custom font URL:', projectData.custom_font_url);
        console.log('Custom font name:', projectData.custom_font_name);
        console.log('Font setting:', projectData.font);

        setProject(projectData);
        
        // Initialize track info from project data
        setTrackInfo({
          artistName: projectData.artist_name || '',
          songTitle: projectData.song_title || '',
          discId: projectData.disc_id || 'KT-01'
        });
        
        let lyricsData = projectData.lyrics_json || [];

        // Auto-add line breaks if none exist
        const hasAnyLineBreaks = lyricsData.some(w => w.lineBreak === true);
        if (!hasAnyLineBreaks && lyricsData.length > 0) {
          lyricsData = addAutoLineBreaks(lyricsData);
        }

        setWords(lyricsData);
        setOriginalWords(JSON.parse(JSON.stringify(lyricsData)));
        setOriginalLyricsText(projectData.lyrics_text || '');
        setIsDuetMode(projectData.is_duet_mode || false);
        if (projectData.duet_singer1_color) {
          setDuetColors({
            singer1: projectData.duet_singer1_color,
            singer2: projectData.duet_singer2_color || DEFAULT_DUET_COLORS.singer2,
            both: projectData.duet_both_color || DEFAULT_DUET_COLORS.both
          });
        }
        
        // V11: Initialize style settings from project data
        setStyleSettings({
          selectedFont: projectData.font || 'arial',
          fontSize: projectData.font_size || 'normal',
          textColor: projectData.text_color || '#ffffff',
          sungColor: projectData.sung_color || '#00d4ff',
          outlineColor: projectData.outline_color || '#000000',
        });
        
        // V11: Initialize background settings from project data
        const bgPreset = projectData.bg_video_preset_filename 
          ? PRESET_VIDEO_BACKGROUNDS.find(p => p.filename === projectData.bg_video_preset_filename)
          : null;
        
        setBgSettings({
          bgType: projectData.bg_type || 'gradient',
          bgColor1: projectData.bg_color_1 || '#1a1a2e',
          bgColor2: projectData.bg_color_2 || '#16213e',
          gradientDirection: projectData.gradient_direction || 'to bottom',
          bgImageUrl: projectData.bg_image_url || null,
          bgImagePreview: projectData.bg_image_url || null,
          bgImageFit: projectData.bg_image_fit || 'fill',
          bgVideoPreset: bgPreset || null,
          bgVideoPresetFilename: projectData.bg_video_preset_filename || null,
          bgCustomVideoUrl: projectData.bg_video_url || null,
          bgCustomVideoPreview: projectData.bg_video_url || null,
        });
        
        // V11: Initialize layout settings from project data
        setLayoutSettings({
          displayMode: projectData.display_mode || 'scroll',
          aspectRatio: projectData.aspect_ratio || '16:9',
          linesPerPage: projectData.lines_per_page || 4,
          linesPerScroll: projectData.lines_per_scroll || 4,
          linesPerOverwrite: projectData.lines_per_overwrite || 4,
          emphasizeCurrentLine: projectData.emphasize_current_line || false,
          showProgressBar: projectData.show_progress_bar !== false, // default true
          showLeadInBars: projectData.show_lead_in_bars !== false, // default true
          cleanVersion: projectData.clean_version || false,
        });
        
        // V11: Initialize export settings from project data
        setExportSettings({
          audioTrack: projectData.audio_track || 'instrumental',
          videoQuality: projectData.video_quality || '720p',
        });
        
        // V11: Initialize branding settings from project data
        setBrandingSettings({
          logoUrl: projectData.logo_url || null,
          logoPosition: projectData.logo_position || 'bottom-right',
          logoSize: projectData.logo_size ?? 50, // Default 50px
          logoOpacity: projectData.logo_opacity ?? 80,
          startImageUrl: projectData.start_image_url || null,
          startImageFit: projectData.start_image_fit || 'contain',
          startImageOpacity: projectData.start_image_opacity ?? 100,
          startImageShowTitle: projectData.start_image_show_title ?? true,
          outroText: projectData.outro_text || '',
          outroDuration: projectData.outro_duration || 3,
          outroFontSize: projectData.outro_font_size || 'medium',
        });
        
        // Fetch waveform data if available
        if (projectData.waveform_url) {
          setWaveformLoading(true);
          try {
            const waveformResponse = await fetch(projectData.waveform_url);
            if (waveformResponse.ok) {
              const waveformJson = await waveformResponse.json();
              setWaveformData(waveformJson);
              console.log('Waveform loaded:', waveformJson.sample_count, 'samples');
            }
          } catch (waveformErr) {
            console.warn('Failed to load waveform data:', waveformErr);
          } finally {
            setWaveformLoading(false);
          }
        }
      } catch (err) { console.error('Load error:', err); setError('Failed to load project'); }
      finally { setLoading(false); }
    };
    loadProject();
  }, [id, router, addAutoLineBreaks]);

  // ============================================================
  // AUDIO PLAYBACK - SMOOTH ANIMATION WITH RAF
  // ============================================================
  // INTRO HANDLING: First 4 seconds are visual-only countdown, audio starts after
  // currentTime 0-4 = intro (displays as -4 to 0), currentTime 4+ = audio playing
  
  const INTRO_DURATION = 4; // 4 second intro before audio starts
  const lastVocalSyncRef = useRef(0); // Throttle vocal sync to prevent choppy playback
  const introStartTimeRef = useRef(null); // Track when intro playback started

  useEffect(() => {
    let rafId = null;

    const updateTime = () => {
      if (!isPlaying) return;
      
      const now = performance.now();
      
      // During intro period, use introStartTimeRef to calculate elapsed time
      if (introStartTimeRef.current !== null) {
        const elapsedSec = (now - introStartTimeRef.current) / 1000;
        
        if (elapsedSec >= INTRO_DURATION) {
          // Intro finished - start audio from beginning
          introStartTimeRef.current = null;
          flushSync(() => {
            setCurrentTime(INTRO_DURATION);
          });
          if (instrumentalRef.current) {
            instrumentalRef.current.currentTime = 0;
            instrumentalRef.current.play().catch(e => console.log('Play error:', e));
          }
          if (vocalsRef.current) {
            vocalsRef.current.currentTime = 0;
            vocalsRef.current.play().catch(e => console.log('Vocals play error:', e));
          }
        } else {
          flushSync(() => {
            setCurrentTime(elapsedSec);
          });
        }
        
        rafId = requestAnimationFrame(updateTime);
      } else if (instrumentalRef.current) {
        // After intro - sync with actual audio time + offset
        const audioTime = instrumentalRef.current.currentTime;

        // flushSync forces React to update synchronously, bypassing batching
        flushSync(() => {
          setCurrentTime(audioTime + INTRO_DURATION); // Add intro offset
        });

        // Keep vocals in sync -- but throttled to avoid choppy playback on mobile
        if (vocalsRef.current) {
          if (now - lastVocalSyncRef.current > 2000) {
            lastVocalSyncRef.current = now;
            const diff = Math.abs(vocalsRef.current.currentTime - audioTime);
            if (diff > 0.3) {
              vocalsRef.current.currentTime = audioTime;
            }
          }
        }
        
        rafId = requestAnimationFrame(updateTime);
      }
    };

    if (isPlaying) {
      rafId = requestAnimationFrame(updateTime);
    }

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [isPlaying]);

  const handleAudioLoaded = useCallback(() => {
    if (instrumentalRef.current) {
      setDuration(instrumentalRef.current.duration);
      instrumentalRef.current.muted = instrumentalMuted || instrumentalVolume === 0;
      instrumentalRef.current.volume = instrumentalVolume / 100;
    }
  }, [instrumentalVolume, instrumentalMuted]);

  const handleVocalsLoaded = useCallback(() => {
    if (vocalsRef.current) {
      vocalsRef.current.muted = vocalsMuted || vocalsVolume === 0;
      vocalsRef.current.volume = vocalsVolume / 100;
    }
  }, [vocalsVolume, vocalsMuted]);

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      // Pause everything
      introStartTimeRef.current = null;
      if (instrumentalRef.current) instrumentalRef.current.pause();
      if (vocalsRef.current) vocalsRef.current.pause();
      setIsPlaying(false);
    } else {
      // Apply muted state before playing (iOS only respects .muted, not .volume)
      if (instrumentalRef.current) {
        instrumentalRef.current.muted = instrumentalMuted || instrumentalVolume === 0;
        instrumentalRef.current.volume = instrumentalVolume / 100;
      }
      if (vocalsRef.current) {
        vocalsRef.current.muted = vocalsMuted || vocalsVolume === 0;
        vocalsRef.current.volume = vocalsVolume / 100;
      }
      
      // IMPORTANT: Set up the correct mode BEFORE setting isPlaying to true
      // This prevents race conditions with the RAF loop
      if (currentTime < INTRO_DURATION) {
        // INTRO MODE: Make sure audio is paused and at position 0
        if (instrumentalRef.current) {
          instrumentalRef.current.pause();
          instrumentalRef.current.currentTime = 0;
        }
        if (vocalsRef.current) {
          vocalsRef.current.pause();
          vocalsRef.current.currentTime = 0;
        }
        // Start intro countdown - calculate start time based on current position
        introStartTimeRef.current = performance.now() - (currentTime * 1000);
        // RAF loop will handle starting audio when intro finishes
      } else {
        // PLAYBACK MODE: Past intro - start audio from correct position
        introStartTimeRef.current = null;
        const audioTime = currentTime - INTRO_DURATION;
        if (instrumentalRef.current) {
          instrumentalRef.current.currentTime = audioTime;
          instrumentalRef.current.play().catch(e => console.log('Play error:', e));
        }
        if (vocalsRef.current) {
          vocalsRef.current.currentTime = audioTime;
          vocalsRef.current.play().catch(e => console.log('Vocals play error:', e));
        }
      }
      
      // Now set isPlaying - RAF loop will start and see the correct introStartTimeRef value
      setIsPlaying(true);
    }
  }, [isPlaying, instrumentalVolume, instrumentalMuted, vocalsVolume, vocalsMuted, currentTime]);

  const seekTo = useCallback((time) => {
    // time is visual time (0 = start of intro, INTRO_DURATION = start of audio)
    const maxTime = (duration || 0) + INTRO_DURATION;
    const clampedTime = Math.max(0, Math.min(time, maxTime));
    
    // Convert to audio time
    const audioTime = clampedTime - INTRO_DURATION;
    
    if (audioTime >= 0) {
      // Past intro - clear intro timer and set audio position
      introStartTimeRef.current = null;
      if (instrumentalRef.current) instrumentalRef.current.currentTime = audioTime;
      if (vocalsRef.current) vocalsRef.current.currentTime = audioTime;
    } else {
      // During intro - reset audio to start and update intro timer if playing
      if (instrumentalRef.current) {
        instrumentalRef.current.pause();
        instrumentalRef.current.currentTime = 0;
      }
      if (vocalsRef.current) {
        vocalsRef.current.pause();
        vocalsRef.current.currentTime = 0;
      }
      // If currently playing, adjust intro start time to match new position
      if (isPlaying) {
        introStartTimeRef.current = performance.now() - (clampedTime * 1000);
      }
    }
    
    setCurrentTime(clampedTime);
  }, [duration, isPlaying]);

  const restart = useCallback(() => {
    introStartTimeRef.current = null;
    seekTo(0);
  }, [seekTo]);

  // Timeline wheel scroll - needs passive: false to prevent page scrolling
  useEffect(() => {
    const timeline = timelineContainerRef.current;
    if (!timeline) return;
    
    const handleWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const scrollAmount = e.deltaY > 0 ? 2 : -2;
      seekTo(currentTime + scrollAmount);
    };
    
    timeline.addEventListener('wheel', handleWheel, { passive: false });
    return () => timeline.removeEventListener('wheel', handleWheel);
  }, [currentTime, seekTo]);

  // ============================================================
  // TIMELINE TOUCH-DRAG TO SCRUB (mobile finger scrubbing)
  // ============================================================
  const [isTimelineScrubbing, setIsTimelineScrubbing] = useState(false);
  const timelineScrubStartX = useRef(0);
  const timelineScrubStartTime = useRef(0);

  const handleTimelineTouchStart = useCallback((e) => {
    // Only start scrub if touching the background, not a word element
    if (e.target.closest('.timeline-word')) return;
    const touch = e.touches[0];
    timelineScrubStartX.current = touch.clientX;
    timelineScrubStartTime.current = currentTime;
    setIsTimelineScrubbing(true);
  }, [currentTime]);

  useEffect(() => {
    if (!isTimelineScrubbing) return;

    const handleScrubMove = (e) => {
      if (!e.touches || e.touches.length === 0) return;
      e.preventDefault(); // Prevent page scroll while scrubbing
      const touch = e.touches[0];
      const deltaX = touch.clientX - timelineScrubStartX.current;
      // Dragging left = forward in time, dragging right = backward
      // (because the timeline moves left as time advances)
      const timeShift = -deltaX / zoom;
      const newTime = Math.max(0, Math.min(duration, timelineScrubStartTime.current + timeShift));
      setCurrentTime(newTime);
      if (instrumentalRef.current) instrumentalRef.current.currentTime = newTime;
      if (vocalsRef.current) vocalsRef.current.currentTime = newTime;
    };

    const handleScrubEnd = () => {
      setIsTimelineScrubbing(false);
    };

    window.addEventListener('touchmove', handleScrubMove, { passive: false });
    window.addEventListener('touchend', handleScrubEnd);
    window.addEventListener('touchcancel', handleScrubEnd);
    return () => {
      window.removeEventListener('touchmove', handleScrubMove);
      window.removeEventListener('touchend', handleScrubEnd);
      window.removeEventListener('touchcancel', handleScrubEnd);
    };
  }, [isTimelineScrubbing, zoom, duration]);

  // ============================================================
  // WORD EDITING - SAVE/CANCEL (must be defined before handleWordClick)
  // ============================================================
  const saveWordEdit = useCallback(() => {
    if (editingWordIndex === null) return;
    if (editingText.trim()) {
      setWords(prev => {
        const updated = [...prev];
        updated[editingWordIndex] = { ...updated[editingWordIndex], word: editingText.trim() };
        return updated;
      });
      setHasChanges(true);
    }
    setEditingWordIndex(null);
    setEditingText('');
  }, [editingWordIndex, editingText]);

  const cancelWordEdit = useCallback(() => {
    setEditingWordIndex(null);
    setEditingText('');
  }, []);

  // ============================================================
  // WORD CLICK & INLINE EDITING
  // ============================================================
  const handleWordClick = useCallback((index, e) => {
    if (paintMode !== null) return;
    if (editingWordIndex !== null && editingWordIndex !== index) {
      saveWordEdit();
    }

    if (e?.shiftKey && selectedWordIndices.size > 0) {
      // Shift+Click: Select range from first/last selected to this one
      const existing = [...selectedWordIndices].sort((a, b) => a - b);
      const minIdx = Math.min(existing[0], index);
      const maxIdx = Math.max(existing[existing.length - 1], index);
      const newSelection = new Set();
      for (let i = minIdx; i <= maxIdx; i++) newSelection.add(i);
      setSelectedWordIndices(newSelection);
    } else if (e?.ctrlKey || e?.metaKey) {
      // Ctrl/Cmd+Click: Toggle individual word
      setSelectedWordIndices(prev => {
        const newSet = new Set(prev);
        if (newSet.has(index)) newSet.delete(index);
        else newSet.add(index);
        return newSet;
      });
    } else {
      // Regular click: Select only this word
      setSelectedWordIndices(new Set([index]));
    }
  }, [paintMode, editingWordIndex, selectedWordIndices, saveWordEdit]);

  const handleWordDoubleClick = useCallback((index, e) => {
    e?.stopPropagation();
    if (paintMode !== null) return;
    setEditingWordIndex(index);
    setEditingText(words[index].word);
    setSelectedWordIndices(new Set([index]));
  }, [words, paintMode]);

  useEffect(() => {
    if (editingWordIndex !== null && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingWordIndex]);

  const nudgeSelectedWords = useCallback((delta) => {
    if (selectedWordIndices.size === 0) return;
    setWords(prev => {
      const updated = [...prev];
      selectedWordIndices.forEach(index => {
        const word = updated[index];
        const newStart = Math.max(0, word.start + delta);
        const wordDuration = word.end - word.start;
        updated[index] = { ...word, start: newStart, end: newStart + wordDuration };
      });
      return updated;
    });
    setHasChanges(true);
  }, [selectedWordIndices]);

  const deleteSelectedWords = useCallback(() => {
    if (selectedWordIndices.size === 0) return;
    const count = selectedWordIndices.size;
    const msg = count === 1
      ? `Delete "${words[[...selectedWordIndices][0]].word}"?`
      : `Delete ${count} selected words?`;
    if (window.confirm(msg)) {
      setWords(prev => {
        // Sort indices descending so we delete from end first (preserves indices)
        const sorted = [...selectedWordIndices].sort((a, b) => b - a);
        const updated = [...prev];
        sorted.forEach(i => updated.splice(i, 1));
        return updated;
      });
      setSelectedWordIndices(new Set());
      setHasChanges(true);
    }
  }, [selectedWordIndices, words]);

  const addNewWord = useCallback(() => {
    if (!newWordText.trim() || selectedWordIndex === null) return;
    const selectedWord = words[selectedWordIndex];

    if (addWordPosition === 'before') {
      const midPoint = selectedWord.start + (selectedWord.end - selectedWord.start) / 2;
      const newWord = { word: newWordText.trim(), start: selectedWord.start, end: midPoint, confidence: 1.0 };
      setWords(prev => {
        const updated = [...prev];
        updated[selectedWordIndex] = { ...updated[selectedWordIndex], start: midPoint };
        updated.splice(selectedWordIndex, 0, newWord);
        return updated;
      });
    } else {
      const midPoint = selectedWord.start + (selectedWord.end - selectedWord.start) / 2;
      const newWord = { word: newWordText.trim(), start: midPoint, end: selectedWord.end, confidence: 1.0 };
      setWords(prev => {
        const updated = [...prev];
        updated[selectedWordIndex] = { ...updated[selectedWordIndex], end: midPoint };
        updated.splice(selectedWordIndex + 1, 0, newWord);
        return updated;
      });
    }

    setShowAddWordModal(false);
    setNewWordText('');
    setSelectedWordIndices(new Set());
    setHasChanges(true);
  }, [newWordText, selectedWordIndex, words, addWordPosition]);

  // ============================================================
  // KEYBOARD SHORTCUTS (moved after function definitions)
  // ============================================================
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space' && editingWordIndex === null) { e.preventDefault(); togglePlayback(); }
      if (e.code === 'Escape') {
        if (isFullscreenPreview) { setIsFullscreenPreview(false); }
        else if (contextMenu.isOpen) { setContextMenu(prev => ({ ...prev, isOpen: false })); }
        else if (paintMode !== null) setPaintMode(null);
        else if (showAddWordModal) { setShowAddWordModal(false); setNewWordText(''); }
        else if (editingWordIndex !== null) { setEditingWordIndex(null); setEditingText(''); }
        else setSelectedWordIndices(new Set());
      }
      if ((e.code === 'Delete' || e.code === 'Backspace') && selectedWordIndices.size > 0 && editingWordIndex === null) {
        e.preventDefault();
        deleteSelectedWords();
      }
      if (selectedWordIndices.size > 0 && editingWordIndex === null) {
        if (e.code === 'ArrowLeft') { e.preventDefault(); nudgeSelectedWords(e.shiftKey ? -0.1 : -0.05); }
        if (e.code === 'ArrowRight') { e.preventDefault(); nudgeSelectedWords(e.shiftKey ? 0.1 : 0.05); }
      }
      // Ctrl+A to select all words
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyA' && editingWordIndex === null) {
        e.preventDefault();
        setSelectedWordIndices(new Set(words.map((_, i) => i)));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedWordIndices, selectedWordIndex, editingWordIndex, showAddWordModal, paintMode, words, deleteSelectedWords, nudgeSelectedWords, togglePlayback, contextMenu.isOpen, isFullscreenPreview]);
  // ============================================================
  // DUET MODE FUNCTIONS
  // ============================================================
  const paintWord = useCallback((index) => {
    if (paintMode === null) return;
    setWords(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], singer: paintMode };
      return updated;
    });
    setHasChanges(true);
  }, [paintMode]);

  // Assign entire line to a singer (for line-level duet assignment)
  const assignLineToSinger = useCallback((lineIndex, singerValue) => {
    const line = lyricsLines[lineIndex];
    if (!line) return;
    
    setWords(prev => {
      const updated = [...prev];
      line.forEach(wordData => {
        updated[wordData.globalIndex] = { ...updated[wordData.globalIndex], singer: singerValue };
      });
      return updated;
    });
    setHasChanges(true);
  }, [lyricsLines]);

  // Get the current singer assignment for a line (returns the singer if all words match, or 'mixed' if different)
  const getLineSingerAssignment = useCallback((lineIndex) => {
    const line = lyricsLines[lineIndex];
    if (!line || line.length === 0) return SINGER.BOTH;
    
    const firstSinger = words[line[0].globalIndex]?.singer ?? SINGER.BOTH;
    const allSame = line.every(wordData => (words[wordData.globalIndex]?.singer ?? SINGER.BOTH) === firstSinger);
    
    return allSame ? firstSinger : 'mixed';
  }, [lyricsLines, words]);

  const handleTimelineWordMouseDown = useCallback((index, e, clientX = null) => {
    e.stopPropagation();
    if (paintMode !== null) {
      setIsPainting(true);
      setPaintedIndices(new Set([index]));
      paintWord(index);
      return;
    }

    // Use provided clientX (for touch) or get from mouse event
    const startX = clientX !== null ? clientX : e.clientX;

    // V10.9: Determine which words to drag based on selection
    let indicesToDrag;

    if (e.shiftKey && selectedWordIndices.size > 0) {
      // Shift+Click: Extend range and drag all
      const existing = [...selectedWordIndices].sort((a, b) => a - b);
      const minIdx = Math.min(existing[0], index);
      const maxIdx = Math.max(existing[existing.length - 1], index);
      indicesToDrag = new Set();
      for (let i = minIdx; i <= maxIdx; i++) indicesToDrag.add(i);
      setSelectedWordIndices(indicesToDrag);
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd+Click: Toggle in selection
      indicesToDrag = new Set(selectedWordIndices);
      if (indicesToDrag.has(index)) indicesToDrag.delete(index);
      else indicesToDrag.add(index);
      setSelectedWordIndices(indicesToDrag);
    } else if (selectedWordIndices.has(index)) {
      // Clicking on already-selected word: drag all selected
      indicesToDrag = selectedWordIndices;
    } else {
      // Regular click on unselected: select only this word
      indicesToDrag = new Set([index]);
      setSelectedWordIndices(indicesToDrag);
    }

    // Set up drag for all selected words
    setIsDragging(true);
    setDragStartX(startX);
    const startTimes = {};
    indicesToDrag.forEach(idx => {
      startTimes[idx] = { start: words[idx].start, end: words[idx].end };
    });
    setDragStartTimes(startTimes);
  }, [words, paintMode, paintWord, selectedWordIndices]);

  const handleTimelineWordMouseEnter = useCallback((index) => {
    if (isPainting && paintMode !== null && !paintedIndices.has(index)) {
      setPaintedIndices(prev => new Set([...prev, index]));
      paintWord(index);
    }
  }, [isPainting, paintMode, paintedIndices, paintWord]);

  // ============================================================
  // UNDO/REDO FUNCTIONALITY
  // ============================================================
  
  // Save current state to history when words change (but not during undo/redo)
  useEffect(() => {
    if (isUndoRedo) {
      setIsUndoRedo(false);
      return;
    }
    
    // Only save if we have words and they're different from the last history entry
    if (words.length > 0) {
      const currentState = JSON.stringify(words);
      const lastState = wordsHistory[wordsHistoryIndex] ? JSON.stringify(wordsHistory[wordsHistoryIndex]) : null;
      
      if (currentState !== lastState) {
        // Remove any future history (if we made changes after undoing)
        const newHistory = wordsHistory.slice(0, wordsHistoryIndex + 1);
        // Add current state
        newHistory.push(JSON.parse(JSON.stringify(words)));
        // Keep only last 50 states to prevent memory issues
        if (newHistory.length > 50) {
          newHistory.shift();
        }
        setWordsHistory(newHistory);
        setWordsHistoryIndex(newHistory.length - 1);
      }
    }
  }, [words]);
  
  // Undo function
  const handleUndo = useCallback(() => {
    if (wordsHistoryIndex > 0) {
      setIsUndoRedo(true);
      const newIndex = wordsHistoryIndex - 1;
      setWordsHistoryIndex(newIndex);
      setWords(JSON.parse(JSON.stringify(wordsHistory[newIndex])));
      setHasChanges(true);
    }
  }, [wordsHistoryIndex, wordsHistory]);
  
  // Redo function
  const handleRedo = useCallback(() => {
    if (wordsHistoryIndex < wordsHistory.length - 1) {
      setIsUndoRedo(true);
      const newIndex = wordsHistoryIndex + 1;
      setWordsHistoryIndex(newIndex);
      setWords(JSON.parse(JSON.stringify(wordsHistory[newIndex])));
      setHasChanges(true);
    }
  }, [wordsHistoryIndex, wordsHistory]);
  
  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check if we're in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }
      
      // Ctrl/Cmd + Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      
      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y for redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // ============================================================
  // V10.10: CONTEXT MENU FOR WORD DURATION ADJUSTMENT
  // ============================================================
  const handleWordContextMenu = useCallback((index, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Close any editing modes
    if (editingWordIndex !== null) {
      setEditingWordIndex(null);
      setEditingText('');
    }
    
    // Select the word
    setSelectedWordIndices(new Set([index]));
    
    // Calculate position - ensure menu stays on screen
    const menuWidth = 240;
    const menuHeight = 400;
    const padding = 10;
    
    let x = e.clientX;
    let y = e.clientY;
    
    // Adjust if menu would go off-screen
    if (x + menuWidth > window.innerWidth - padding) {
      x = window.innerWidth - menuWidth - padding;
    }
    if (y + menuHeight > window.innerHeight - padding) {
      y = window.innerHeight - menuHeight - padding;
    }
    
    setContextMenu({
      isOpen: true,
      position: { x, y },
      wordIndex: index
    });
  }, [editingWordIndex]);

  const closeContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, []);

  // Long-press handlers for mobile context menu on timeline words
  const handleWordTouchStart = useCallback((index, e) => {
    const touch = e.touches[0];
    wordTouchStartPos.current = { x: touch.clientX, y: touch.clientY };
    wordLongPressTriggered.current = false;

    // Start a 500ms timer â€” if finger doesn't move much, open context menu
    wordLongPressTimer.current = setTimeout(() => {
      wordLongPressTriggered.current = true;

      // Cancel any active drag so the word doesn't move
      setIsDragging(false);

      // Vibrate for haptic feedback if supported
      if (navigator.vibrate) navigator.vibrate(30);

      // Close any editing modes
      if (editingWordIndex !== null) {
        setEditingWordIndex(null);
        setEditingText('');
      }

      // Select the word
      setSelectedWordIndices(new Set([index]));

      // Position menu near the touch point but above the finger
      const menuWidth = 240;
      const menuHeight = 300;
      const padding = 10;
      let x = touch.clientX - menuWidth / 2; // Center on finger
      let y = touch.clientY - menuHeight - 20; // Above finger

      // If not enough room above, put it below
      if (y < padding) {
        y = touch.clientY + 30;
      }
      // Keep within screen horizontally
      if (x + menuWidth > window.innerWidth - padding) {
        x = window.innerWidth - menuWidth - padding;
      }
      if (x < padding) x = padding;
      // Keep within screen vertically
      if (y + menuHeight > window.innerHeight - padding) {
        y = window.innerHeight - menuHeight - padding;
      }

      setContextMenu({
        isOpen: true,
        position: { x, y },
        wordIndex: index
      });
    }, 500);
  }, [editingWordIndex]);

  const handleWordTouchMove = useCallback((e) => {
    // If finger moves more than 10px, cancel the long press (user is dragging)
    if (wordLongPressTimer.current) {
      const touch = e.touches[0];
      const dx = touch.clientX - wordTouchStartPos.current.x;
      const dy = touch.clientY - wordTouchStartPos.current.y;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        clearTimeout(wordLongPressTimer.current);
        wordLongPressTimer.current = null;
      }
    }
  }, []);

  const handleWordTouchEnd = useCallback(() => {
    clearTimeout(wordLongPressTimer.current);
    wordLongPressTimer.current = null;
  }, []);

  // Extend word end time (makes the word last longer)
  // ============================================================
  // CONTEXT MENU HANDLERS - Rename, Add Before/After, Delete
  // ============================================================
  
  // State for rename modal
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameWordIndex, setRenameWordIndex] = useState(null);
  const [renameText, setRenameText] = useState('');

  // Rename word - opens a modal
  const handleContextMenuRename = useCallback((index) => {
    setRenameWordIndex(index);
    setRenameText(words[index].word);
    setShowRenameModal(true);
  }, [words]);

  // Submit rename
  const submitRename = useCallback(() => {
    if (renameWordIndex === null || !renameText.trim()) return;
    setWords(prev => {
      const updated = [...prev];
      updated[renameWordIndex] = { ...updated[renameWordIndex], word: renameText.trim() };
      return updated;
    });
    setHasChanges(true);
    setShowRenameModal(false);
    setRenameWordIndex(null);
    setRenameText('');
  }, [renameWordIndex, renameText]);

  // Add word before - opens the existing add word modal
  const handleContextMenuAddBefore = useCallback((index) => {
    setSelectedWordIndices(new Set([index])); // This sets selectedWordIndex via computed value
    setAddWordPosition('before');
    setNewWordText('');
    setShowAddWordModal(true);
  }, []);

  // Add word after - opens the existing add word modal
  const handleContextMenuAddAfter = useCallback((index) => {
    setSelectedWordIndices(new Set([index])); // This sets selectedWordIndex via computed value
    setAddWordPosition('after');
    setNewWordText('');
    setShowAddWordModal(true);
  }, []);

  // Delete a single word from context menu
  const handleContextMenuDelete = useCallback((index) => {
    if (words.length <= 1) {
      alert('Cannot delete the last word');
      return;
    }
    setWords(prev => prev.filter((_, i) => i !== index));
    setHasChanges(true);
    setSelectedWordIndices(new Set());
  }, [words.length]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isPainting) {
        setIsPainting(false);
        setPaintedIndices(new Set());
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isPainting]);

  // ============================================================
  // TIMELINE DRAGGING (Mouse + Touch support)
  // ============================================================
  useEffect(() => {
    // Only add listeners when actively dragging
    if (!isDragging) return;
    
    const handleMove = (clientX) => {
      if (paintMode !== null) return;
      const deltaX = clientX - dragStartX;
      const deltaTime = deltaX / zoom;
      setWords(prev => {
        const updated = [...prev];
        Object.keys(dragStartTimes).forEach(idx => {
          const index = parseInt(idx);
          const original = dragStartTimes[index];
          updated[index] = {
            ...updated[index],
            start: Math.max(0, original.start + deltaTime),
            end: Math.max(0.1, original.end + deltaTime)
          };
        });
        return updated;
      });
      setHasChanges(true);
    };

    const handleMouseMove = (e) => handleMove(e.clientX);
    const handleTouchMove = (e) => {
      if (e.touches.length === 1) {
        e.preventDefault(); // Prevent scrolling while dragging
        handleMove(e.touches[0].clientX);
      }
    };

    const handleEnd = () => {
      setIsDragging(false);
      setDragStartTimes({});
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
    window.addEventListener('touchcancel', handleEnd);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
      window.removeEventListener('touchcancel', handleEnd);
    };
  }, [isDragging, dragStartX, dragStartTimes, zoom, paintMode]);

  // ============================================================
  // WORD EDGE RESIZE - Drag handles to adjust word start/end times
  // ============================================================
  const handleWordResizeStart = useCallback((index, edge, e, clientX = null) => {
    e.stopPropagation();
    e.preventDefault();
    setIsWordResizing(true);
    setWordResizeEdge(edge);
    setWordResizeIndex(index);
    setWordResizeStartX(clientX !== null ? clientX : e.clientX);
    setWordResizeStartTime(edge === 'left' ? words[index].start : words[index].end);
  }, [words]);

  useEffect(() => {
    if (!isWordResizing) return;

    const handleMove = (clientX) => {
      const deltaX = clientX - wordResizeStartX;
      const deltaTime = deltaX / zoom;
      
      setWords(prev => {
        const updated = [...prev];
        const word = updated[wordResizeIndex];
        
        if (wordResizeEdge === 'left') {
          // Moving start time - ensure it doesn't go past end or below 0
          const newStart = Math.max(0, Math.min(word.end - 0.05, wordResizeStartTime + deltaTime));
          updated[wordResizeIndex] = { ...word, start: newStart };
        } else {
          // Moving end time - ensure it doesn't go before start
          const newEnd = Math.max(word.start + 0.05, wordResizeStartTime + deltaTime);
          updated[wordResizeIndex] = { ...word, end: newEnd };
        }
        
        return updated;
      });
      setHasChanges(true);
    };

    const handleWordResizeMove = (e) => handleMove(e.clientX);
    const handleWordResizeTouchMove = (e) => {
      if (e.touches.length === 1) {
        e.preventDefault();
        handleMove(e.touches[0].clientX);
      }
    };

    const handleWordResizeEnd = () => {
      setIsWordResizing(false);
      setWordResizeEdge(null);
      setWordResizeIndex(null);
    };

    window.addEventListener('mousemove', handleWordResizeMove);
    window.addEventListener('mouseup', handleWordResizeEnd);
    window.addEventListener('touchmove', handleWordResizeTouchMove, { passive: false });
    window.addEventListener('touchend', handleWordResizeEnd);
    window.addEventListener('touchcancel', handleWordResizeEnd);
    
    return () => {
      window.removeEventListener('mousemove', handleWordResizeMove);
      window.removeEventListener('mouseup', handleWordResizeEnd);
      window.removeEventListener('touchmove', handleWordResizeTouchMove);
      window.removeEventListener('touchend', handleWordResizeEnd);
      window.removeEventListener('touchcancel', handleWordResizeEnd);
    };
  }, [isWordResizing, wordResizeStartX, wordResizeStartTime, wordResizeEdge, wordResizeIndex, zoom]);

  // ============================================================
  // SAVE & RENDER FUNCTIONS
  // ============================================================
  const resetToOriginal = useCallback(() => {
    if (!hasChanges) return;
    if (window.confirm('Reset all changes to original?')) {
      setWords(JSON.parse(JSON.stringify(originalWords)));
      setHasChanges(false);
      setSelectedWordIndices(new Set());
      setEditingWordIndex(null);
      setIsDuetMode(project?.is_duet_mode || false);
    }
  }, [hasChanges, originalWords, project]);

  const saveChanges = useCallback(async () => {
    if (!hasChanges) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const { error } = await supabase
        .from('projects')
        .update({
          // Track info
          artist_name: trackInfo.artistName,
          song_title: trackInfo.songTitle,
          disc_id: trackInfo.discId,
          // Lyrics
          lyrics_json: words,
          is_duet_mode: isDuetMode,
          duet_singer1_color: duetColors.singer1,
          duet_singer2_color: duetColors.singer2,
          duet_both_color: duetColors.both,
          // V11: Style settings
          font: styleSettings.selectedFont,
          font_size: styleSettings.fontSize,
          text_color: styleSettings.textColor,
          sung_color: styleSettings.sungColor,
          outline_color: styleSettings.outlineColor,
          // V11: Background settings
          bg_type: bgSettings.bgType,
          bg_color_1: bgSettings.bgColor1,
          bg_color_2: bgSettings.bgColor2,
          gradient_direction: bgSettings.gradientDirection,
          bg_image_url: bgSettings.bgImageUrl,
          bg_image_fit: bgSettings.bgImageFit || 'fill',
        bg_image_fit: bgSettings.bgImageFit || 'fill',
          bg_video_preset_filename: bgSettings.bgVideoPresetFilename,
          bg_video_url: bgSettings.bgCustomVideoUrl,
          // V11: Layout settings
          display_mode: layoutSettings.displayMode,
          aspect_ratio: layoutSettings.aspectRatio,
          lines_per_page: layoutSettings.linesPerPage,
          lines_per_scroll: layoutSettings.linesPerScroll,
          lines_per_overwrite: layoutSettings.linesPerOverwrite,
          emphasize_current_line: layoutSettings.emphasizeCurrentLine,
          show_progress_bar: layoutSettings.showProgressBar,
          show_lead_in_bars: layoutSettings.showLeadInBars,
          clean_version: layoutSettings.cleanVersion,
          // V11: Export settings
          audio_track: exportSettings.audioTrack,
          video_quality: exportSettings.videoQuality,
          // V11: Branding settings
          logo_url: brandingSettings.logoUrl,
          logo_position: brandingSettings.logoPosition,
          logo_size: brandingSettings.logoSize,
          logo_opacity: brandingSettings.logoOpacity,
          start_image_url: brandingSettings.startImageUrl,
          start_image_fit: brandingSettings.startImageFit,
          start_image_opacity: brandingSettings.startImageOpacity,
          start_image_show_title: brandingSettings.startImageShowTitle,
          outro_text: brandingSettings.outroText,
          outro_duration: brandingSettings.outroDuration,
          outro_font_size: brandingSettings.outroFontSize,
        })
        .eq('id', id);

      if (error) throw error;
      
      // Update local project state with new track info
      setProject(prev => ({
        ...prev,
        artist_name: trackInfo.artistName,
        song_title: trackInfo.songTitle,
        disc_id: trackInfo.discId
      }));
      
      setHasChanges(false);
      setOriginalWords(JSON.parse(JSON.stringify(words)));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error('Save error:', err);
      console.error('Error details:', JSON.stringify(err, null, 2));
      setError(`Failed to save: ${err.message || err.code || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  }, [hasChanges, words, isDuetMode, duetColors, styleSettings, bgSettings, layoutSettings, exportSettings, brandingSettings, trackInfo, id, router]);

  const handleApproveAndRender = useCallback(async () => {
    if (hasChanges) await saveChanges();

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/projects/${id}/render`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ edited_lyrics: words })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to start render');
      }

      router.push('/dashboard');
    } catch (err) {
      console.error('Render error:', err);
      setError(err.message || 'Failed to start render');
    } finally {
      setSaving(false);
    }
  }, [hasChanges, saveChanges, words, router, id]);

  // ============================================================
  // UTILITY FUNCTIONS
  // ============================================================
  // Note: INTRO_DURATION is declared above in the playback section

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format time relative to track start (intro shows as negative countdown)
  const formatTrackTime = (seconds) => {
    if (isNaN(seconds)) return '-0:04';
    const trackTime = seconds - INTRO_DURATION; // Offset by intro duration
    const isNegative = trackTime < 0;
    const absTime = Math.abs(trackTime);
    const mins = Math.floor(absTime / 60);
    const secs = Math.floor(absTime % 60);
    const prefix = isNegative ? '-' : '';
    return `${prefix}${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format time with decimals relative to track start
  const formatTrackTimeDetailed = (seconds) => {
    if (isNaN(seconds)) return '-0:04.00';
    const trackTime = seconds - INTRO_DURATION;
    const isNegative = trackTime < 0;
    const absTime = Math.abs(trackTime);
    const mins = Math.floor(absTime / 60);
    const secs = (absTime % 60).toFixed(2).padStart(5, '0');
    const prefix = isNegative ? '-' : '';
    return `${prefix}${mins}:${secs}`;
  };

  const formatTimeShort = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins > 0) return `${mins}:${secs.toString().padStart(2, '0')}`;
    return `${secs}s`;
  };

  const getWordColor = useCallback((word, isSelected, isCurrent) => {
    if (isSelected) return '#00d4ff';
    if (isDuetMode) {
      const singer = word.singer || SINGER.BOTH;
      if (singer === SINGER.SINGER_1) return duetColors.singer1;
      if (singer === SINGER.SINGER_2) return duetColors.singer2;
      return duetColors.both;
    }
    // V11: Use styleSettings for live preview
    return isCurrent ? (styleSettings.sungColor || '#00d4ff') : (styleSettings.textColor || '#ffffff');
  }, [isDuetMode, duetColors, styleSettings]);

  const isWordCurrent = useCallback((word) => currentTime >= word.start && currentTime <= word.end, [currentTime]);

  const getHighlightColor = useCallback((wordIndex) => {
    if (isDuetMode && words[wordIndex]?.singer !== undefined) {
      const singer = words[wordIndex].singer;
      if (singer === SINGER.SINGER_1) return duetColors.singer1;
      if (singer === SINGER.SINGER_2) return duetColors.singer2;
      return duetColors.both;
    }
    // V11: Use styleSettings for live preview
    return styleSettings.sungColor || '#00d4ff';
  }, [isDuetMode, words, duetColors, styleSettings]);

  // ============================================================
  // GET CURRENT LYRICS FOR PREVIEW
  // ============================================================
  // Calculate directly during render (not useMemo) to ensure smooth animations
  // useMemo was causing stale values during rapid currentTime updates
  const LINES_PER_PAGE = layoutSettings.linesPerPage || 4; // Use setting from Layout tab

  const getCurrentLyricsData = () => {
    if (!lyricsLines.length) return {
      prevLine: '',
      currentLine: null,
      next: '',
      pageLines: [], // For page mode - array of {words, isCurrentLine, isPastLine}
      currentLineIdx: -1,
      showSweepIn: false,
      sweepInProgress: 0,
      showProgressBar: false,
      progressBarPercent: 0,
      nextLyricsForProgressBar: ''
    };

    let currentLineIdx = -1;

    // Find current line
    for (let i = 0; i < lyricsLines.length; i++) {
      const line = lyricsLines[i];
      for (let j = 0; j < line.length; j++) {
        const word = line[j];
        if (currentTime >= word.start && currentTime <= word.end) {
          currentLineIdx = i;
          break;
        }
      }
      if (currentLineIdx !== -1) break;
    }

    // Handle gaps between lines
    if (currentLineIdx === -1) {
      for (let i = 0; i < lyricsLines.length; i++) {
        const line = lyricsLines[i];
        if (line.length > 0 && line[0].start > currentTime) {
          const firstWordStart = line[0].start;
          const timeUntilLine = firstWordStart - currentTime;
          const prevLineEnd = i === 0 ? 0 : lyricsLines[i - 1][lyricsLines[i - 1].length - 1].end;
          const gapDuration = firstWordStart - prevLineEnd;

          // Determine sweep-in duration based on gap
          let sweepDuration = 0;
          if (gapDuration >= SWEEP_IN_LONG_MIN_GAP) {
            sweepDuration = SWEEP_IN_LONG_DURATION;
          } else if (gapDuration >= SWEEP_IN_SHORT_MIN_GAP) {
            sweepDuration = SWEEP_IN_SHORT_DURATION;
          }

          // Show sweep-in bar if within sweep duration
          if (sweepDuration > 0 && timeUntilLine <= sweepDuration) {
            const sweepProgress = 1 - (timeUntilLine / sweepDuration);
            const currentLineText = line.map(w => ({
              word: w.word, index: w.globalIndex, start: w.start, end: w.end,
              isActive: false, isPast: false, sweepPercent: 0
            }));
            const prevLineText = i > 0 ? lyricsLines[i - 1].map(w => w.word).join(' ') : '';
            
            // Build upcomingLines
            const upcomingLines = [];
            for (let j = i + 1; j < Math.min(i + 7, lyricsLines.length); j++) {
              upcomingLines.push(lyricsLines[j].map(w => w.word).join(' '));
            }
            
            // Build pageLines for page/overwrite mode
            const currentPageIdx = Math.floor(i / LINES_PER_PAGE);
            const pageStartIdx = currentPageIdx * LINES_PER_PAGE;
            const pageEndIdx = Math.min(pageStartIdx + LINES_PER_PAGE, lyricsLines.length);
            const pageLines = [];
            for (let pi = pageStartIdx; pi < pageEndIdx; pi++) {
              const pageLine = lyricsLines[pi];
              pageLines.push({
                words: pageLine.map(w => ({
                  word: w.word, index: w.globalIndex, start: w.start, end: w.end,
                  isActive: false, isPast: pi < i, sweepPercent: pi < i ? 1 : 0, fadeInProgress: pi < i ? 1 : 0
                })),
                isCurrentLine: pi === i,
                isPastLine: pi < i,
                lineText: pageLine.map(w => w.word).join(' ')
              });
            }

            return {
              prevLine: prevLineText,
              currentLine: currentLineText,
              next: lyricsLines[i + 1] ? lyricsLines[i + 1].map(w => w.word).join(' ') : '',
              upcomingLines,
              pageLines,
              currentLineIdx: i,
              showSweepIn: true,
              sweepInProgress: sweepProgress,
              showProgressBar: false,
              progressBarPercent: 0,
              nextLyricsForProgressBar: ''
            };
          }

          // Show progress bar for long instrumental breaks (>5 seconds)
          const progressBarEndTime = sweepDuration > 0 ? sweepDuration : 0;
          if (i > 0 && gapDuration > INSTRUMENTAL_BREAK_THRESHOLD && timeUntilLine > progressBarEndTime) {
            const progressBarDuration = gapDuration - progressBarEndTime;
            const timeIntoProgressBar = gapDuration - timeUntilLine;
            const progressPercent = Math.min(1, Math.max(0, timeIntoProgressBar / progressBarDuration));
            const prevLineText = i > 0 ? lyricsLines[i - 1].map(w => w.word).join(' ') : '';
            
            // Build upcomingLines starting from current line
            const upcomingLines = [];
            for (let j = i; j < Math.min(i + 6, lyricsLines.length); j++) {
              upcomingLines.push(lyricsLines[j].map(w => w.word).join(' '));
            }

            return {
              prevLine: prevLineText,
              currentLine: null, next: '',
              upcomingLines,
              pageLines: [], // Empty during progress bar
              currentLineIdx: i, // So overwrite mode knows which line is next
              showSweepIn: false, sweepInProgress: 0,
              showProgressBar: true,
              progressBarPercent: progressPercent,
              nextLyricsForProgressBar: line.map(w => w.word).join(' ')
            };
          }

          // Show previous line if within 2 seconds after it ended
          if (i > 0) {
            const prevLineData = lyricsLines[i - 1];
            const lastWordEnd = prevLineData[prevLineData.length - 1].end;
            if (currentTime - lastWordEnd <= 2) {
              const currentLineText = prevLineData.map(w => ({
                word: w.word, index: w.globalIndex, start: w.start, end: w.end,
                isActive: false, isPast: true, sweepPercent: 1
              }));
              const prevPrevLineText = i > 1 ? lyricsLines[i - 2].map(w => w.word).join(' ') : '';
              
              // Build upcomingLines
              const upcomingLines = [];
              for (let j = i; j < Math.min(i + 6, lyricsLines.length); j++) {
                upcomingLines.push(lyricsLines[j].map(w => w.word).join(' '));
              }
              
              // Build pageLines - use previous line's page
              const prevLineIdx = i - 1;
              const currentPageIdx = Math.floor(prevLineIdx / LINES_PER_PAGE);
              const pageStartIdx = currentPageIdx * LINES_PER_PAGE;
              const pageEndIdx = Math.min(pageStartIdx + LINES_PER_PAGE, lyricsLines.length);
              const pageLines = [];
              for (let pi = pageStartIdx; pi < pageEndIdx; pi++) {
                const pageLine = lyricsLines[pi];
                pageLines.push({
                  words: pageLine.map(w => ({
                    word: w.word, index: w.globalIndex, start: w.start, end: w.end,
                    isActive: false, isPast: pi <= prevLineIdx, sweepPercent: pi <= prevLineIdx ? 1 : 0, fadeInProgress: pi <= prevLineIdx ? 1 : 0
                  })),
                  isCurrentLine: pi === prevLineIdx,
                  isPastLine: pi < prevLineIdx,
                  lineText: pageLine.map(w => w.word).join(' ')
                });
              }
              
              return {
                prevLine: prevPrevLineText,
                currentLine: currentLineText,
                next: line.map(w => w.word).join(' '),
                upcomingLines,
                pageLines,
                currentLineIdx: prevLineIdx,
                showSweepIn: false, sweepInProgress: 0,
                showProgressBar: false, progressBarPercent: 0, nextLyricsForProgressBar: ''
              };
            }
          }

          // Only show upcoming lyrics if within 2 seconds of first word
          // This prevents showing lyrics too early during long intro gaps
          if (timeUntilLine > 2) {
            return {
              prevLine: '',
              currentLine: null, next: '',
              upcomingLines: [],
              pageLines: [],
              currentLineIdx: -1,
              showSweepIn: false, sweepInProgress: 0,
              showProgressBar: false, progressBarPercent: 0, nextLyricsForProgressBar: ''
            };
          }
          
          // Build upcomingLines for gap before first visible lyrics
          const upcomingLines = [];
          for (let j = i; j < Math.min(i + 6, lyricsLines.length); j++) {
            upcomingLines.push(lyricsLines[j].map(w => w.word).join(' '));
          }

          return {
            prevLine: i > 0 ? lyricsLines[i - 1].map(w => w.word).join(' ') : '',
            currentLine: null, next: line.map(w => w.word).join(' '),
            upcomingLines,
            pageLines: [],
            currentLineIdx: -1,
            showSweepIn: false, sweepInProgress: 0,
            showProgressBar: false, progressBarPercent: 0, nextLyricsForProgressBar: ''
          };
        }

        if (line.length > 0 && line[line.length - 1].end >= currentTime) {
          currentLineIdx = i;
          break;
        }
      }

      // After all lyrics
      if (currentLineIdx === -1) {
        if (lyricsLines.length > 0) {
          const lastLine = lyricsLines[lyricsLines.length - 1];
          const lastWordEnd = lastLine[lastLine.length - 1].end;
          if (currentTime - lastWordEnd <= 2) {
            const lastLineIdx = lyricsLines.length - 1;
            const currentLineText = lastLine.map(w => ({
              word: w.word, index: w.globalIndex, start: w.start, end: w.end,
              isActive: false, isPast: true, sweepPercent: 1
            }));
            const prevLineText = lyricsLines.length > 1 ? lyricsLines[lyricsLines.length - 2].map(w => w.word).join(' ') : '';
            
            // Build pageLines for last page
            const currentPageIdx = Math.floor(lastLineIdx / LINES_PER_PAGE);
            const pageStartIdx = currentPageIdx * LINES_PER_PAGE;
            const pageEndIdx = Math.min(pageStartIdx + LINES_PER_PAGE, lyricsLines.length);
            const pageLines = [];
            for (let pi = pageStartIdx; pi < pageEndIdx; pi++) {
              const pageLine = lyricsLines[pi];
              pageLines.push({
                words: pageLine.map(w => ({
                  word: w.word, index: w.globalIndex, start: w.start, end: w.end,
                  isActive: false, isPast: true, sweepPercent: 1, fadeInProgress: 1
                })),
                isCurrentLine: pi === lastLineIdx,
                isPastLine: pi < lastLineIdx,
                lineText: pageLine.map(w => w.word).join(' ')
              });
            }
            
            return {
              prevLine: prevLineText,
              currentLine: currentLineText, next: '',
              upcomingLines: [],
              pageLines,
              currentLineIdx: lastLineIdx,
              showSweepIn: false, sweepInProgress: 0,
              showProgressBar: false, progressBarPercent: 0, nextLyricsForProgressBar: ''
            };
          }
        }
        return {
          prevLine: '',
          currentLine: null, next: '',
          upcomingLines: [],
          pageLines: [],
          currentLineIdx: -1,
          showSweepIn: false, sweepInProgress: 0,
          showProgressBar: false, progressBarPercent: 0, nextLyricsForProgressBar: ''
        };
      }
    }

    // Build current line with sweep percentages
    const line = lyricsLines[currentLineIdx];
    const currentLineText = line.map(w => {
      let sweepPercent = 0;
      let fadeInProgress = 0; // 0-1, used for glow fade-in animation
      const isActive = currentTime >= w.start && currentTime <= w.end;
      const isPast = currentTime > w.end;

      if (isPast) {
        sweepPercent = 1;
        fadeInProgress = 1;
      } else if (isActive) {
        const wordDuration = w.end - w.start;
        if (wordDuration > 0) {
          sweepPercent = (currentTime - w.start) / wordDuration;
          // Fade in glow quickly at start of word (first 20% of duration)
          fadeInProgress = Math.min(1, sweepPercent * 5);
        }
      }

      return { word: w.word, index: w.globalIndex, start: w.start, end: w.end, isActive, isPast, sweepPercent, fadeInProgress };
    });

    const prevLine = currentLineIdx > 0 ? lyricsLines[currentLineIdx - 1] : null;
    const prevText = prevLine ? prevLine.map(w => w.word).join(' ') : '';
    const nextLine = lyricsLines[currentLineIdx + 1];
    const nextText = nextLine ? nextLine.map(w => w.word).join(' ') : '';

    // Build upcomingLines array for scroll mode (multiple upcoming lines)
    const upcomingLines = [];
    for (let i = currentLineIdx + 1; i < Math.min(currentLineIdx + 6, lyricsLines.length); i++) {
      upcomingLines.push(lyricsLines[i].map(w => w.word).join(' '));
    }

    // Build pageLines for page mode (4 lines per page)
    const currentPageIdx = Math.floor(currentLineIdx / LINES_PER_PAGE);
    const pageStartIdx = currentPageIdx * LINES_PER_PAGE;
    const pageEndIdx = Math.min(pageStartIdx + LINES_PER_PAGE, lyricsLines.length);
    
    const pageLines = [];
    for (let i = pageStartIdx; i < pageEndIdx; i++) {
      const pageLine = lyricsLines[i];
      const isCurrentLine = i === currentLineIdx;
      const isPastLine = i < currentLineIdx;
      
      const lineWords = pageLine.map(w => {
        let sweepPct = 0;
        let fadeInPct = 0;
        const isWordActive = currentTime >= w.start && currentTime <= w.end;
        const isWordPast = currentTime > w.end;
        
        if (isPastLine || isWordPast) {
          sweepPct = 1;
          fadeInPct = 1;
        } else if (isCurrentLine && isWordActive) {
          const dur = w.end - w.start;
          if (dur > 0) {
            sweepPct = (currentTime - w.start) / dur;
            fadeInPct = Math.min(1, sweepPct * 5);
          }
        }
        
        return { word: w.word, index: w.globalIndex, start: w.start, end: w.end, isActive: isWordActive, isPast: isWordPast || isPastLine, sweepPercent: sweepPct, fadeInProgress: fadeInPct };
      });
      
      pageLines.push({
        words: lineWords,
        isCurrentLine,
        isPastLine,
        lineText: pageLine.map(w => w.word).join(' ')
      });
    }

    return {
      prevLine: prevText,
      currentLine: currentLineText, 
      next: nextText,
      upcomingLines,
      pageLines,
      currentLineIdx,
      showSweepIn: false, sweepInProgress: 0,
      showProgressBar: false, progressBarPercent: 0, nextLyricsForProgressBar: ''
    };
  };

  // Call during render to get fresh values every frame
  const currentLyrics = getCurrentLyricsData();

  const handleTimelineClick = useCallback((e) => {
    if (!timelineContainerRef.current || isDragging || isTimelineScrubbing) return;
    const rect = timelineContainerRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const clickX = e.clientX - rect.left;
    const offsetFromCenter = clickX - centerX;
    const timeOffset = offsetFromCenter / zoom;
    seekTo(currentTime + timeOffset);
  }, [zoom, currentTime, seekTo, isDragging, isTimelineScrubbing]);

  const handleProgressClick = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    seekTo(percent * duration);
  }, [duration, seekTo]);

  const zoomIn = () => setZoom(prev => Math.min(prev * 1.25, 300));
  const zoomOut = () => setZoom(prev => Math.max(prev / 1.25, 30));

  // ============================================================
  // GENERATE TIME MARKERS FOR TIMELINE
  // ============================================================
  const timeMarkers = useMemo(() => {
    if (!duration || !timelineContainerRef.current) return [];

    const markers = [];
    const visibleRange = 20; // seconds visible on each side of center
    const startTime = Math.max(0, currentTime - visibleRange);
    const endTime = Math.min(duration, currentTime + visibleRange);

    // Generate markers for every second in visible range
    for (let t = Math.floor(startTime); t <= Math.ceil(endTime); t++) {
      const isMajor = t % 5 === 0;
      markers.push({ time: t, isMajor });
    }

    return markers;
  }, [currentTime, duration]);

  // ============================================================
  // LOADING / ERROR STATES
  // ============================================================
  if (loading) return (
    <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-animated-dark' : 'bg-animated-light'}`}>
      <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
    </div>
  );

  if (error || !project) return (
    <div className={`min-h-screen flex flex-col items-center justify-center gap-4 ${isDark ? 'bg-animated-dark' : 'bg-animated-light'}`}>
      <AlertCircle className="w-12 h-12 text-red-400" />
      <p className="text-red-400">{error || 'Project not found'}</p>
      <Link href="/dashboard" className="text-cyan-400 hover:underline">Return to Dashboard</Link>
    </div>
  );

  // V11: Use bgSettings for live preview background
  const getPreviewBackground = () => {
    // Use bgSettings for live preview, fallback to project data
    const bgType = bgSettings.bgType || project.bg_type;
    const bgColor1 = bgSettings.bgColor1 || project.bg_color_1 || '#1a1a2e';
    const bgColor2 = bgSettings.bgColor2 || project.bg_color_2 || '#16213e';
    const direction = bgSettings.gradientDirection || project.gradient_direction || 'to bottom';
    
    // For video and image backgrounds, use dark background (video/image will overlay)
    if (bgType === 'video' || bgType === 'custom-video' || bgType === 'image') {
      return { backgroundColor: '#000000' };
    }
    
    if (bgType === 'gradient') {
      return { background: `linear-gradient(${direction}, ${bgColor1}, ${bgColor2})` };
    }
    return { backgroundColor: bgColor1 };
  };

  // V11: Get video URL using bgSettings for live preview
  const getVideoBackgroundUrl = () => {
    const bgType = bgSettings.bgType || project.bg_type;
    
    // Only show video for video-type backgrounds
    if (bgType !== 'video' && bgType !== 'custom-video') {
      return null;
    }
    
    // Custom uploaded video
    if (bgSettings.bgCustomVideoUrl) {
      return bgSettings.bgCustomVideoUrl;
    }
    if (bgType === 'custom-video' && project.bg_video_url) {
      return project.bg_video_url;
    }
    
    // Preset video
    if (bgSettings.bgVideoPresetFilename) {
      return `${PRESET_BASE_URL}/${bgSettings.bgVideoPresetFilename}`;
    }
    if (project.bg_video_preset_filename) {
      return `${PRESET_BASE_URL}/${project.bg_video_preset_filename}`;
    }
    
    return null;
  };

  // V11: Check if we should show background image
  const getBackgroundImageUrl = () => {
    const bgType = bgSettings.bgType || project.bg_type;
    if (bgType !== 'image') return null;
    return bgSettings.bgImageUrl || project.bg_image_url || null;
  };

  const videoBackgroundUrl = getVideoBackgroundUrl();
  const backgroundImageUrl = getBackgroundImageUrl();

  // V11: Use styleSettings for live preview (falls back to project values if not set)
  const textColor = styleSettings.textColor || project?.text_color || '#ffffff';
  const outlineColor = styleSettings.outlineColor || project?.outline_color || '#000000';
  const sungColor = styleSettings.sungColor || project?.sung_color || '#00d4ff';
  const unsungColor = '#cccccc';

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <>
      {/* V13: Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        project={project}
        isDark={isDark}
        onTokensUpdated={(updatedProject) => setProject(updatedProject)}
      />

      <SEO title={`Edit: ${project.title} | Karatrack Studio`} description="Edit lyrics timing and line breaks" />

      {/* Audio Elements */}
      <audio
        ref={instrumentalRef}
        src={project.processed_audio_url}
        onLoadedMetadata={handleAudioLoaded}
        onEnded={() => setIsPlaying(false)}
        preload="auto"
      />
      {project.vocals_audio_url && (
        <audio
          ref={vocalsRef}
          src={project.vocals_audio_url}
          onLoadedMetadata={handleVocalsLoaded}
          preload="auto"
        />
      )}

      {/* FULLSCREEN PREVIEW MODAL */}
      <AnimatePresence>
        {isFullscreenPreview && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-50 bg-black flex items-center justify-center"
            onClick={() => setIsFullscreenPreview(false)}
          >
            {/* Close button */}
            <button
              onClick={() => setIsFullscreenPreview(false)}
              className="absolute top-4 right-4 z-50 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Exit Fullscreen (Esc)"
            >
              <Minimize2 className="w-6 h-6" />
            </button>
            
            {/* Fullscreen video preview */}
            <div 
              className="relative w-full h-full flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                // Calculate dimensions to fit screen while maintaining aspect ratio
                const getAspectRatio = () => {
                  switch (layoutSettings.aspectRatio) {
                    case '4:3': return 4/3;
                    case '9:16': return 9/16;
                    default: return 16/9;
                  }
                };
                const ratio = getAspectRatio();
                
                // Get viewport dimensions (with padding)
                const maxWidth = typeof window !== 'undefined' ? window.innerWidth - 32 : 1200;
                const maxHeight = typeof window !== 'undefined' ? window.innerHeight - 32 : 800;
                
                // Calculate dimensions that fit within viewport
                let width, height;
                if (ratio >= 1) {
                  // Landscape or square
                  width = Math.min(maxWidth, maxHeight * ratio);
                  height = width / ratio;
                } else {
                  // Portrait
                  height = Math.min(maxHeight, maxWidth / ratio);
                  width = height * ratio;
                }
                
                // Font scaling for fullscreen
                const scaleFactor = height / 270;
                const fontSizeMultiplier = FONT_SIZE_OPTIONS.find(opt => opt.value === styleSettings.fontSize)?.scale || 1.0;
                const isPortrait = layoutSettings.aspectRatio === '9:16';
                const portraitScale = isPortrait ? 0.7 : 1.0;
                
                const baseFontSize = Math.max(16, Math.min(48, 20 * scaleFactor * fontSizeMultiplier * portraitScale));
                const currentLineFontSize = Math.max(20, Math.min(64, 26 * scaleFactor * fontSizeMultiplier * portraitScale));
                const lineGap = Math.max(4, Math.min(20, 8 * scaleFactor * (isPortrait ? 0.8 : 1)));
                const textShadowSize = Math.max(2, Math.min(5, 2.5 * scaleFactor * portraitScale));
                const wordSpacing = Math.max(4, Math.min(12, 6 * scaleFactor * portraitScale));
                const contentPadding = isPortrait ? Math.max(8, 16 * scaleFactor) : Math.max(16, 32 * scaleFactor);
                
                const previewFontFamily = project?.custom_font_url && styleSettings.selectedFont === 'custom'
                  ? 'CustomKaraokeFont' 
                  : FONT_OPTIONS.find(f => f.value === styleSettings.selectedFont)?.family || 'Arial, sans-serif';
                
                // Colors
                const textColor = styleSettings.textColor || '#ffffff';
                const sungColor = styleSettings.sungColor || '#00d4ff';
                const outlineColor = styleSettings.outlineColor || '#000000';
                const unsungColor = textColor;
                
                // Background
                const getFullscreenBackground = () => {
                  switch (bgSettings.bgType) {
                    case 'color':
                      return { backgroundColor: bgSettings.bgColor1 };
                    case 'gradient':
                      return { background: `linear-gradient(${bgSettings.gradientDirection}, ${bgSettings.bgColor1}, ${bgSettings.bgColor2})` };
                    default:
                      return { backgroundColor: '#1a1a2e' };
                  }
                };
                
                return (
                  <div 
                    className="relative overflow-hidden rounded-lg shadow-2xl"
                    style={{ width, height, ...getFullscreenBackground() }}
                  >
                    {/* Background Image */}
                    {bgSettings.bgImageUrl && (
                      <img className="absolute inset-0 w-full h-full object-cover opacity-60" src={bgSettings.bgImageUrl} alt="" />
                    )}
                    
                    {/* Background Video */}
                    {(bgSettings.bgVideoPreset || bgSettings.bgCustomVideoUrl) && (
                      <video 
                        className="absolute inset-0 w-full h-full object-cover opacity-60" 
                        src={bgSettings.bgCustomVideoUrl || (bgSettings.bgVideoPreset ? `${PRESET_BASE_URL}/${bgSettings.bgVideoPreset.filename}` : '')}
                        autoPlay loop muted playsInline 
                      />
                    )}
                    
                    {/* Lyrics Overlay */}
                    <div 
                      className="absolute inset-0 flex flex-col items-center justify-center" 
                      style={{ padding: contentPadding, opacity: currentTime < INTRO_DURATION ? 0 : 1 }}
                    >
                      {/* Progress bar during instrumental breaks */}
                      {currentLyrics.showProgressBar && layoutSettings.showProgressBar && (
                        <div className="w-full mb-4">
                          <InstrumentalProgressBar
                            progress={currentLyrics.progressBarPercent}
                            nextLyrics=""
                            color={sungColor}
                            textColor={textColor}
                            outlineColor={outlineColor}
                            isPortrait={isPortrait}
                          />
                        </div>
                      )}
                      
                      {/* Current lyrics - simplified display */}
                      <div className="flex flex-col items-center justify-center w-full" style={{ gap: lineGap }}>
                        {currentLyrics.currentLine && (
                          <p 
                            className="font-bold text-center"
                            style={{ 
                              fontFamily: previewFontFamily,
                              fontSize: currentLineFontSize,
                              color: sungColor,
                              textShadow: `${textShadowSize}px ${textShadowSize}px ${textShadowSize * 1.5}px ${outlineColor}, -${textShadowSize}px -${textShadowSize}px ${textShadowSize * 1.5}px ${outlineColor}`
                            }}
                          >
                            {currentLyrics.currentLine.map(w => w.word).join(' ')}
                          </p>
                        )}
                        {currentLyrics.upcomingLines?.slice(0, 3).map((line, idx) => (
                          <p 
                            key={idx}
                            className="font-bold text-center"
                            style={{ 
                              fontFamily: previewFontFamily,
                              fontSize: baseFontSize,
                              color: textColor,
                              textShadow: `${textShadowSize}px ${textShadowSize}px ${textShadowSize * 1.5}px ${outlineColor}`,
                              opacity: 0.6 - (idx * 0.15)
                            }}
                          >
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                    
                    {/* Intro Overlay */}
                    {currentTime < INTRO_DURATION && brandingSettings.startImageShowTitle !== false && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                        {brandingSettings.startImageUrl && (
                          <img 
                            src={brandingSettings.startImageUrl} 
                            alt="Intro" 
                            className="absolute inset-0 w-full h-full"
                            style={{ objectFit: brandingSettings.startImageFit || 'contain', opacity: (brandingSettings.startImageOpacity || 100) / 100 }}
                          />
                        )}
                        <div className="relative z-10 text-center px-4">
                          <h2 style={{ fontFamily: previewFontFamily, fontSize: currentLineFontSize * 1.5, color: textColor, textShadow: `2px 2px 4px ${outlineColor}` }}>
                            {trackInfo.songTitle || project?.song_title || 'Song Title'}
                          </h2>
                          <p style={{ fontFamily: previewFontFamily, fontSize: currentLineFontSize, color: textColor, textShadow: `1px 1px 3px ${outlineColor}`, opacity: 0.9 }}>
                            {trackInfo.artistName || project?.artist_name || 'Artist'}
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {/* Logo Watermark */}
                    {brandingSettings.logoUrl && (() => {
                      // Scale logo to match handler.py proportions (1280px base)
                      const fsLogoScale = width / 1280;
                      const fsScaledLogoSize = (brandingSettings.logoSize || 50) * fsLogoScale;
                      const fsScaledPadding = Math.max(6, 40 * fsLogoScale);
                      return (
                      <div 
                        className="absolute z-30"
                        style={{
                          ...(brandingSettings.logoPosition?.includes('top') ? { top: fsScaledPadding } : { bottom: fsScaledPadding }),
                          ...(brandingSettings.logoPosition?.includes('left') ? { left: fsScaledPadding } : brandingSettings.logoPosition?.includes('right') ? { right: fsScaledPadding } : { left: '50%', transform: 'translateX(-50%)' }),
                          opacity: (brandingSettings.logoOpacity || 80) / 100,
                          width: fsScaledLogoSize,
                          height: fsScaledLogoSize,
                        }}
                      >
                        <img src={brandingSettings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                      </div>
                      );
                    })()}
                    
                    {/* Time display */}
                    <div className={`absolute bottom-2 right-2 px-2 py-1 bg-black/60 rounded text-sm font-mono ${currentTime < INTRO_DURATION ? 'text-yellow-400' : 'text-white/80'}`}>
                      {formatTrackTime(currentTime)}
                    </div>
                  </div>
                );
              })()}
            </div>
            
            {/* Playback controls */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-3 px-4 py-2 bg-black/60 rounded-full backdrop-blur-sm">
              <button onClick={restart} className="p-2 rounded-full hover:bg-white/20 transition-colors">
                <RotateCcw className="w-5 h-5 text-white" />
              </button>
              <button onClick={() => seekTo(currentTime - 10)} className="p-2 rounded-full hover:bg-white/20 transition-colors">
                <SkipBack className="w-5 h-5 text-white" />
              </button>
              <button onClick={togglePlayback} className="p-3 rounded-full bg-cyan-500 hover:bg-cyan-400 transition-colors">
                {isPlaying ? <Pause className="w-6 h-6 text-white" /> : <Play className="w-6 h-6 text-white ml-0.5" />}
              </button>
              <button onClick={() => seekTo(currentTime + 10)} className="p-2 rounded-full hover:bg-white/20 transition-colors">
                <SkipForward className="w-5 h-5 text-white" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ADD WORD MODAL */}
      <AnimatePresence>
        {showAddWordModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className={`p-6 rounded-2xl max-w-md w-full mx-4 ${isDark ? 'bg-gray-900 border border-white/10' : 'bg-white border border-gray-200'}`}>
              <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Add New Word</h3>

              <div className="mb-4">
                <label className="block text-sm text-gray-500 mb-2">Position</label>
                <div className="flex gap-2">
                  <button onClick={() => setAddWordPosition('before')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${addWordPosition === 'before' ? 'bg-cyan-500 text-white' : isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                    Before "{words[selectedWordIndex]?.word}"
                  </button>
                  <button onClick={() => setAddWordPosition('after')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${addWordPosition === 'after' ? 'bg-cyan-500 text-white' : isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                    After "{words[selectedWordIndex]?.word}"
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm text-gray-500 mb-2">New Word</label>
                <input
                  type="text" value={newWordText} onChange={(e) => setNewWordText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addNewWord(); if (e.key === 'Escape') { setShowAddWordModal(false); setNewWordText(''); } }}
                  placeholder="Enter word..." autoFocus
                  className={`w-full px-4 py-2 rounded-lg text-sm ${isDark ? 'bg-white/5 border border-white/10 text-white' : 'bg-gray-50 border border-gray-200 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-cyan-500`}
                />
              </div>

              <div className="flex gap-2">
                <button onClick={() => { setShowAddWordModal(false); setNewWordText(''); }} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'}`}>Cancel</button>
                <button onClick={addNewWord} disabled={!newWordText.trim()} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${newWordText.trim() ? 'bg-cyan-500 text-white hover:bg-cyan-600' : 'bg-gray-500 text-gray-300 cursor-not-allowed'}`}>Add Word</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Rename Word Modal */}
        {showRenameModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className={`p-6 rounded-2xl max-w-md w-full mx-4 ${isDark ? 'bg-gray-900 border border-white/10' : 'bg-white border border-gray-200'}`}>
              <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Rename Word</h3>

              <div className="mb-4">
                <label className="block text-sm text-gray-500 mb-2">New Text</label>
                <input
                  type="text" 
                  value={renameText} 
                  onChange={(e) => setRenameText(e.target.value)}
                  onKeyDown={(e) => { 
                    if (e.key === 'Enter') submitRename(); 
                    if (e.key === 'Escape') { setShowRenameModal(false); setRenameText(''); setRenameWordIndex(null); } 
                  }}
                  placeholder="Enter new word text..." 
                  autoFocus
                  className={`w-full px-4 py-2 rounded-lg text-sm ${isDark ? 'bg-white/5 border border-white/10 text-white' : 'bg-gray-50 border border-gray-200 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-cyan-500`}
                />
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => { setShowRenameModal(false); setRenameText(''); setRenameWordIndex(null); }} 
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'}`}
                >
                  Cancel
                </button>
                <button 
                  onClick={submitRename} 
                  disabled={!renameText.trim()} 
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${renameText.trim() ? 'bg-cyan-500 text-white hover:bg-cyan-600' : 'bg-gray-500 text-gray-300 cursor-not-allowed'}`}
                >
                  Rename
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`min-h-screen ${isDark ? 'bg-animated-dark' : 'bg-animated-light'}`}>
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className={`absolute -top-1/2 -left-1/2 w-full h-full ${isDark ? 'bg-gradient-to-br from-cyan-900/20 via-transparent to-purple-900/20' : 'bg-gradient-to-br from-cyan-100/50 via-transparent to-purple-100/50'} rounded-full blur-3xl`} />
        </div>

        <AppNavigation />

        <main className="relative z-10 px-4 py-4 max-w-[1800px] mx-auto">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              {/* V13: Back button - different behavior for token access */}
              {!isTokenAccess ? (
                <Link href="/dashboard" className={`p-2 rounded-xl ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'}`}>
                  <ArrowLeft className="w-5 h-5" />
                </Link>
              ) : (
                <a href="https://studio.karatrack.com" className={`p-2 rounded-xl ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'}`} title="Back to Karatrack Studio">
                  <ArrowLeft className="w-5 h-5" />
                </a>
              )}
              
              {/* Editable Track Info */}
              {editingTrackInfo ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={trackInfo.songTitle}
                      onChange={(e) => {
                        setTrackInfo(prev => ({ ...prev, songTitle: e.target.value }));
                        setHasChanges(true);
                      }}
                      placeholder="Song Title"
                      className={`px-2 py-1 text-lg font-bold rounded-lg border ${isDark ? 'bg-white/5 border-white/20 text-white' : 'bg-white border-gray-300 text-gray-900'} focus:outline-none focus:border-cyan-500`}
                    />
                    <button
                      onClick={() => setEditingTrackInfo(false)}
                      className="p-1 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white"
                      title="Done editing"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={trackInfo.artistName}
                      onChange={(e) => {
                        setTrackInfo(prev => ({ ...prev, artistName: e.target.value }));
                        setHasChanges(true);
                      }}
                      placeholder="Artist Name"
                      className={`px-2 py-0.5 text-sm rounded-lg border ${isDark ? 'bg-white/5 border-white/20 text-gray-300' : 'bg-white border-gray-300 text-gray-600'} focus:outline-none focus:border-cyan-500`}
                    />
                    <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{String.fromCharCode(8226)}</span>
                    <input
                      type="text"
                      value={trackInfo.discId}
                      onChange={(e) => {
                        setTrackInfo(prev => ({ ...prev, discId: e.target.value }));
                        setHasChanges(true);
                      }}
                      placeholder="Disc ID"
                      className={`px-2 py-0.5 text-sm rounded-lg border w-24 ${isDark ? 'bg-white/5 border-white/20 text-gray-300' : 'bg-white border-gray-300 text-gray-600'} focus:outline-none focus:border-cyan-500`}
                    />
                  </div>
                </div>
              ) : (
                <div 
                  className="cursor-pointer group"
                  onClick={() => setEditingTrackInfo(true)}
                  title="Click to edit track info"
                >
                  <div className="flex items-center gap-2">
                    <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {trackInfo.songTitle || project?.title || 'Untitled'}
                    </h1>
                    <Edit3 className={`w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                  </div>
                  <p className="text-sm text-gray-500">
                    {trackInfo.artistName || 'Unknown Artist'} {String.fromCharCode(8226)} {trackInfo.discId || 'KT-01'}
                  </p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* V13: Share Button */}
              <button
                onClick={() => setShowShareModal(true)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isDark 
                    ? 'bg-white/10 hover:bg-white/20 text-white' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
                title="Share Project"
              >
                <QrCode className="w-4 h-4" />
                <span className="hidden sm:inline">Share</span>
              </button>

              {project.custom_font_url && (
                <span className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/20 text-cyan-400 text-xs rounded-lg">
                  <Type className="w-3 h-3" />{project.custom_font_name || 'Custom Font'}
                </span>
              )}
              {paintMode !== null && (
                <span className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 text-purple-400 text-xs rounded-lg animate-pulse">
                  <Paintbrush className="w-3 h-3" />Paint Mode
                </span>
              )}
              {hasChanges && <span className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-lg"><AlertCircle className="w-3 h-3" />Unsaved</span>}
              <AnimatePresence>
                {saveSuccess && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 text-green-400 text-xs rounded-lg"><CheckCircle className="w-3 h-3" />Saved!</motion.span>}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* READINESS CHECKLIST */}
          <ReadinessChecklist
            isDark={isDark}
            trackInfo={trackInfo}
            words={words}
            styleSettings={styleSettings}
            bgSettings={bgSettings}
            layoutSettings={layoutSettings}
            exportSettings={exportSettings}
            brandingSettings={brandingSettings}
            lyricsLines={lyricsLines}
            setActiveTab={setActiveTab}
            checklistHighlight={checklistHighlight}
            setChecklistHighlight={setChecklistHighlight}
          />

          {/* Custom Font Loading - placed outside preview for better loading */}
          {project.custom_font_url && (
            <style>{`
              @font-face {
                font-family: 'CustomKaraokeFont';
                src: url('${project.custom_font_url}');
                font-display: swap;
              }
            `}</style>
          )}

          {/* VIDEO PREVIEW - Dynamic Aspect Ratio Container */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl overflow-hidden mb-4 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}>
            {/* Preview Label */}
            <div className={`px-4 py-2 flex items-center justify-between ${isDark ? 'border-b border-white/10' : 'border-b border-gray-200'}`}>
              <div className="flex items-center gap-2">
                <FileVideo className="w-4 h-4 text-cyan-400" />
                <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Video Preview ({layoutSettings.aspectRatio})</span>
                <span className={`px-2 py-0.5 text-[10px] rounded ${layoutSettings.displayMode === 'overwrite' ? 'bg-purple-500/20 text-purple-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
                  {layoutSettings.displayMode === 'overwrite' ? 'Overwrite' : layoutSettings.displayMode === 'page' ? 'Page' : 'Scroll'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 hidden sm:inline">Drag bottom edge to resize</span>
                <button
                  onClick={() => setIsFullscreenPreview(true)}
                  className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}`}
                  title="Fullscreen Preview"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {/* Dynamic Aspect Ratio Container - Centered */}
            <div 
              className={`flex items-center justify-center p-4 ${isDark ? 'bg-black/30' : 'bg-gray-100'}`}
              style={{ minHeight: previewHeight }}
            >
              {/* Actual Preview Box with Dynamic Aspect Ratio */}
              {(() => {
                // V11: Calculate aspect ratio dimensions
                const getAspectRatioDimensions = () => {
                  switch (layoutSettings.aspectRatio) {
                    case '4:3': return { ratio: 4/3, cssRatio: '4 / 3' };
                    case '9:16': return { ratio: 9/16, cssRatio: '9 / 16' };
                    default: return { ratio: 16/9, cssRatio: '16 / 9' }; // 16:9
                  }
                };
                const { ratio, cssRatio } = getAspectRatioDimensions();
                
                // Calculate dynamic font sizes based on preview height
                // Base reference: 1080p video height = 1080px, typical font size ~48px
                // Scale proportionally to preview height
                const boxHeight = previewHeight - 32;
                const boxWidth = layoutSettings.aspectRatio === '9:16' 
                  ? boxHeight * ratio  // Portrait: narrower
                  : boxHeight * ratio; // Landscape: wider
                
                const scaleFactor = boxHeight / 270; // 270px as baseline (small preview)
                
                // V11: Get font size multiplier from styleSettings
                const fontSizeMultiplier = FONT_SIZE_OPTIONS.find(opt => opt.value === styleSettings.fontSize)?.scale || 1.0;
                
                // V11: Get font family from styleSettings
                const previewFontFamily = project?.custom_font_url && styleSettings.selectedFont === 'custom'
                  ? 'CustomKaraokeFont' 
                  : FONT_OPTIONS.find(f => f.value === styleSettings.selectedFont)?.family || 'Arial, sans-serif';
                
                // 9:16 Portrait mode adjustments - narrower width needs smaller fonts
                const isPortrait = layoutSettings.aspectRatio === '9:16';
                const portraitScale = isPortrait ? 0.7 : 1.0; // 30% smaller for portrait
                
                const baseFontSize = Math.max(10, Math.min(32, 14 * scaleFactor * fontSizeMultiplier * portraitScale));
                const currentLineFontSize = Math.max(12, Math.min(40, 18 * scaleFactor * fontSizeMultiplier * portraitScale));
                const lineGap = Math.max(2, Math.min(12, 4 * scaleFactor * (isPortrait ? 0.8 : 1)));
                const textShadowSize = Math.max(1, Math.min(3, 1.5 * scaleFactor * portraitScale));
                const wordSpacing = Math.max(1, Math.min(6, 3 * scaleFactor * portraitScale));
                
                // Padding adjustments for portrait mode
                const contentPadding = isPortrait 
                  ? Math.max(4, 8 * scaleFactor)  // Smaller padding for portrait
                  : Math.max(8, 16 * scaleFactor); // Normal padding for landscape
                
                return (
                  <div 
                    className="relative overflow-hidden rounded-lg shadow-2xl"
                    style={{ 
                      width: `${boxWidth}px`,
                      height: `${boxHeight}px`,
                      maxWidth: '100%',
                      aspectRatio: cssRatio,
                      ...getPreviewBackground()
                    }}
                  >
                    {/* Background Image */}
                    {backgroundImageUrl && (
                      <img 
                        className="absolute inset-0 w-full h-full opacity-60" 
                        style={{
                          objectFit: bgSettings.bgImageFit === 'stretch' ? 'fill' : 
                                     bgSettings.bgImageFit === 'fit' ? 'contain' : 'cover',
                          backgroundColor: bgSettings.bgImageFit === 'fit' ? bgSettings.bgColor1 : 'transparent'
                        }}
                        src={backgroundImageUrl} 
                        alt="" 
                      />
                    )}
                    
                    {/* Background Video */}
                    {videoBackgroundUrl && (
                      <video 
                        className="absolute inset-0 w-full h-full object-cover opacity-60" 
                        src={videoBackgroundUrl} 
                        autoPlay 
                        loop 
                        muted 
                        playsInline 
                      />
                    )}
                    
                    {/* Lyrics Overlay - with dynamic font scaling */}
                    {/* Hide lyrics during intro period (first 4 seconds) */}
                    <div 
                      className="absolute inset-0 flex flex-col items-center justify-center" 
                      style={{ 
                        padding: `${contentPadding}px`,
                        opacity: currentTime < INTRO_DURATION ? 0 : 1,
                        pointerEvents: currentTime < INTRO_DURATION ? 'none' : 'auto'
                      }}
                    >
                      {/* Progress bar shown ABOVE lyrics during instrumental breaks */}
                      {currentLyrics.showProgressBar && layoutSettings.showProgressBar && (
                        <div className="w-full mb-2">
                          <InstrumentalProgressBar
                            progress={currentLyrics.progressBarPercent}
                            nextLyrics=""
                            color={sungColor}
                            textColor={textColor}
                            outlineColor={outlineColor}
                            isPortrait={isPortrait}
                          />
                        </div>
                      )}
                      
                      {layoutSettings.displayMode === 'overwrite' ? (
                        /* OVERWRITE MODE - Current line cycles through positions 1->2->3->4->1... */
                        (() => {
                          const numLines = layoutSettings.linesPerOverwrite || 4;
                          const currentIdx = currentLyrics.currentLineIdx ?? -1;
                          
                          // Overwrite mode behavior:
                          // - Current line position cycles: 0 -> 1 -> 2 -> 3 -> 0 -> 1 -> ...
                          // - Each slot shows: current line at its cycling position, 
                          //   remaining slots show next unsung lines
                          // - When a line finishes, it's instantly replaced with the next unsung line
                          
                          if (currentIdx >= 0 && lyricsLines.length > 0) {
                            // Calculate which position (0 to numLines-1) the current line is in
                            const currentPosition = currentIdx % numLines;
                            
                            // Build slots array: current line + next unsung lines
                            // Then reorder so current appears at currentPosition
                            const lines = [];
                            
                            for (let i = 0; i < numLines; i++) {
                              const lineIdx = currentIdx + i;
                              if (lineIdx < lyricsLines.length) {
                                const lineWords = lyricsLines[lineIdx];
                                lines.push({
                                  lineIdx,
                                  isCurrentLine: i === 0, // First one is current
                                  text: lineWords.map(w => w.word).join(' ')
                                });
                              }
                            }
                            
                            // Reorder: current line goes to currentPosition, others wrap around
                            const displaySlots = new Array(numLines).fill(null);
                            
                            for (let i = 0; i < lines.length; i++) {
                              const targetPosition = (currentPosition + i) % numLines;
                              displaySlots[targetPosition] = lines[i];
                            }
                            
                            // Filter nulls and render
                            const finalSlots = displaySlots.filter(s => s !== null);
                            
                            return (
                              <div className="flex flex-col items-center justify-center w-full" style={{ gap: `${lineGap}px` }}>
                                {finalSlots.map((lineData) => (
                                  <div key={`ow-${lineData.lineIdx}`} className="text-center w-full">
                                    {lineData.isCurrentLine && currentLyrics.currentLine ? (
                                      <p 
                                        className="font-bold relative inline-flex flex-wrap justify-center items-baseline"
                                        style={{ 
                                          fontFamily: previewFontFamily,
                                          fontSize: layoutSettings.emphasizeCurrentLine ? `${currentLineFontSize}px` : `${baseFontSize}px`,
                                          gap: `${wordSpacing}px`
                                        }}
                                      >
                                        {currentLyrics.currentLine.map((wordData, wordIdx) => {
                                          const highlightColor = getHighlightColor(wordData.index);
                                          if (wordIdx === 0 && currentLyrics.showSweepIn) {
                                            return (
                                              <span key={wordIdx} style={{ position: 'relative' }}>
                                                <SweepInBar progress={currentLyrics.sweepInProgress} color={sungColor} />
                                                <SweepWord word={wordData.word} sweepPercent={wordData.sweepPercent} color={highlightColor} unsungColor={unsungColor} outlineColor={outlineColor} isActive={wordData.isActive} isPast={wordData.isPast} showGlow={wordData.isActive} fadeInProgress={wordData.fadeInProgress || 1} />
                                              </span>
                                            );
                                          }
                                          return <SweepWord key={wordIdx} word={wordData.word} sweepPercent={wordData.sweepPercent} color={highlightColor} unsungColor={unsungColor} outlineColor={outlineColor} isActive={wordData.isActive} isPast={wordData.isPast} showGlow={wordData.isActive} fadeInProgress={wordData.fadeInProgress || 1} />;
                                        })}
                                      </p>
                                    ) : (
                                      <p 
                                        className="font-bold"
                                        style={{ 
                                          fontFamily: previewFontFamily,
                                          fontSize: `${baseFontSize}px`,
                                          color: textColor,
                                          textShadow: `${textShadowSize}px ${textShadowSize}px ${textShadowSize * 1.5}px ${outlineColor}, -${textShadowSize}px -${textShadowSize}px ${textShadowSize * 1.5}px ${outlineColor}`,
                                          opacity: 0.6
                                        }}
                                      >
                                        {lineData.text}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            );
                          } else if (currentLyrics.upcomingLines && currentLyrics.upcomingLines.length > 0) {
                            // No current line yet, show upcoming lines
                            return (
                              <div className="flex flex-col items-center justify-center w-full" style={{ gap: `${lineGap}px` }}>
                                {currentLyrics.upcomingLines.slice(0, numLines).map((text, idx) => (
                                  <div key={`ow-upcoming-${idx}`} className="text-center w-full">
                                    <p 
                                      className="font-bold"
                                      style={{ 
                                        fontFamily: previewFontFamily,
                                        fontSize: `${baseFontSize}px`,
                                        color: textColor,
                                        textShadow: `${textShadowSize}px ${textShadowSize}px ${textShadowSize * 1.5}px ${outlineColor}, -${textShadowSize}px -${textShadowSize}px ${textShadowSize * 1.5}px ${outlineColor}`,
                                        opacity: 0.6
                                      }}
                                    >
                                      {text}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            );
                          }
                          
                          return null;
                        })()
                      ) : layoutSettings.displayMode === 'page' ? (
                        /* PAGE MODE - Show all lines on page, highlight from top to bottom */
                        <div className="flex flex-col items-center justify-center w-full" style={{ gap: `${lineGap}px` }}>
                          {currentLyrics.pageLines && currentLyrics.pageLines.slice(0, layoutSettings.linesPerPage || 4).map((lineData, lineIdx) => (
                            <div key={lineIdx} className="text-center w-full">
                              <p 
                                className="font-bold relative inline-flex flex-wrap justify-center items-baseline"
                                style={{ 
                                  fontFamily: previewFontFamily,
                                  fontSize: lineData.isCurrentLine && layoutSettings.emphasizeCurrentLine ? `${currentLineFontSize}px` : `${baseFontSize}px`,
                                  gap: `${wordSpacing}px`,
                                  opacity: lineData.isCurrentLine ? 1 : lineData.isPastLine ? 0.8 : 0.6
                                }}
                              >
                                {lineData.words.map((wordData, wordIdx) => {
                                  const highlightColor = getHighlightColor(wordData.index);
                                  const shadowStyle = `${textShadowSize}px ${textShadowSize}px ${textShadowSize * 1.5}px ${outlineColor}, -${textShadowSize}px -${textShadowSize}px ${textShadowSize * 1.5}px ${outlineColor}`;
                                  
                                  if (lineData.isPastLine) {
                                    return <span key={wordIdx} style={{ color: sungColor, textShadow: shadowStyle }}>{wordData.word}</span>;
                                  }
                                  if (lineData.isCurrentLine) {
                                    if (wordIdx === 0 && currentLyrics.showSweepIn) {
                                      return (
                                        <span key={wordIdx} style={{ position: 'relative' }}>
                                          <SweepInBar progress={currentLyrics.sweepInProgress} color={sungColor} />
                                          <SweepWord word={wordData.word} sweepPercent={wordData.sweepPercent} color={highlightColor} unsungColor={unsungColor} outlineColor={outlineColor} isActive={wordData.isActive} isPast={wordData.isPast} showGlow={wordData.isActive} fadeInProgress={wordData.fadeInProgress || 1} />
                                        </span>
                                      );
                                    }
                                    return <SweepWord key={wordIdx} word={wordData.word} sweepPercent={wordData.sweepPercent} color={highlightColor} unsungColor={unsungColor} outlineColor={outlineColor} isActive={wordData.isActive} isPast={wordData.isPast} showGlow={wordData.isActive} fadeInProgress={wordData.fadeInProgress || 1} />;
                                  }
                                  return <span key={wordIdx} style={{ color: textColor, textShadow: shadowStyle }}>{wordData.word}</span>;
                                })}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        /* SCROLL MODE (default) - Smooth scrolling with framer-motion */
                        (() => {
                          const numLines = layoutSettings.linesPerScroll || 4;
                          const lineHeight = layoutSettings.emphasizeCurrentLine ? currentLineFontSize * 2.2 : baseFontSize * 2.2;
                          const totalHeight = numLines * lineHeight;
                          const currentIdx = currentLyrics.currentLineIdx ?? -1;
                          
                          // Build array of lines to show
                          const linesToShow = [];
                          
                          // Use currentLineIdx to determine which lines to show
                          if (currentIdx >= 0 && lyricsLines[currentIdx]) {
                            // Show lines starting from currentIdx
                            for (let i = 0; i < numLines; i++) {
                              const lineIdx = currentIdx + i;
                              if (lineIdx < lyricsLines.length) {
                                // First line is "current" only if we have word-level data
                                const hasWordData = i === 0 && currentLyrics.currentLine && currentLyrics.currentLine.length > 0;
                                linesToShow.push({
                                  lineIdx: lineIdx,
                                  position: i,
                                  isCurrent: hasWordData,
                                  words: hasWordData ? currentLyrics.currentLine : null,
                                  text: lyricsLines[lineIdx].map(w => w.word).join(' '),
                                });
                              }
                            }
                          } else if (currentLyrics.upcomingLines && currentLyrics.upcomingLines.length > 0) {
                            // Fallback: No current line index, show upcoming
                            currentLyrics.upcomingLines.slice(0, numLines).forEach((text, i) => {
                              linesToShow.push({
                                lineIdx: `upcoming-${i}`,
                                position: i,
                                isCurrent: false,
                                words: null,
                                text: text,
                              });
                            });
                          }
                          
                          return (
                            <div className="flex flex-col items-center w-full" style={{ gap: `${lineGap}px` }}>
                              {/* Scroll lines container */}
                              <div 
                                className="relative w-full overflow-hidden"
                                style={{ height: `${totalHeight}px` }}
                              >
                                <AnimatePresence mode="popLayout">
                                {linesToShow.map((lineData) => {
                                  const isCurrent = lineData.isCurrent;
                                  const yPosition = lineData.position * lineHeight;
                                  // First line (position 0) should be full opacity even during progress bar
                                  const opacityValue = lineData.position === 0 ? 1 : Math.max(0.35, 0.7 - (lineData.position * 0.12));
                                  
                                  return (
                                    <motion.div
                                      key={`line-${lineData.lineIdx}`}
                                      className="absolute left-0 right-0 text-center"
                                      initial={{ y: yPosition + lineHeight, opacity: 0 }}
                                      animate={{ 
                                        y: yPosition, 
                                        opacity: opacityValue,
                                      }}
                                      exit={{ y: yPosition - lineHeight, opacity: 0 }}
                                      transition={{ 
                                        type: "tween",
                                        duration: 0.35,
                                        ease: "easeOut"
                                      }}
                                    >
                                      {isCurrent && lineData.words ? (
                                        <p 
                                          className="font-bold relative inline-flex flex-wrap justify-center items-baseline" 
                                          style={{ 
                                            fontFamily: previewFontFamily,
                                            fontSize: layoutSettings.emphasizeCurrentLine ? `${currentLineFontSize}px` : `${baseFontSize}px`,
                                            gap: `${wordSpacing}px`
                                          }}
                                        >
                                          {lineData.words.map((wordData, i) => {
                                            const highlightColor = getHighlightColor(wordData.index);
                                            if (i === 0 && currentLyrics.showSweepIn) {
                                              return (
                                                <span key={i} style={{ position: 'relative' }}>
                                                  <SweepInBar progress={currentLyrics.sweepInProgress} color={sungColor} />
                                                  <SweepWord word={wordData.word} sweepPercent={wordData.sweepPercent} color={highlightColor} unsungColor={unsungColor} outlineColor={outlineColor} isActive={wordData.isActive} isPast={wordData.isPast} showGlow={wordData.isActive} fadeInProgress={wordData.fadeInProgress || 1} />
                                                </span>
                                              );
                                            }
                                            return <SweepWord key={i} word={wordData.word} sweepPercent={wordData.sweepPercent} color={highlightColor} unsungColor={unsungColor} outlineColor={outlineColor} isActive={wordData.isActive} isPast={wordData.isPast} showGlow={wordData.isActive} fadeInProgress={wordData.fadeInProgress || 1} />;
                                          })}
                                        </p>
                                      ) : (
                                        <p 
                                          className="font-bold"
                                          style={{ 
                                            fontFamily: previewFontFamily,
                                            fontSize: `${baseFontSize}px`,
                                            color: textColor,
                                            textShadow: `${textShadowSize}px ${textShadowSize}px ${textShadowSize * 1.5}px ${outlineColor}, -${textShadowSize}px -${textShadowSize}px ${textShadowSize * 1.5}px ${outlineColor}`,
                                          }}
                                        >
                                          {lineData.text}
                                        </p>
                                      )}
                                    </motion.div>
                                  );
                                })}
                              </AnimatePresence>
                              </div>
                            </div>
                          );
                        })()
                      )}
                    </div>
                    
                    {/* INTRO OVERLAY - Shows for first 4 seconds (matches video render intro duration) */}
                    {(() => {
                      // Calculate fade: full opacity until 3.5s, then fade to 0 by 4s
                      const introFadeStart = INTRO_DURATION - 0.5;
                      let introOpacity = 1;
                      if (currentTime >= INTRO_DURATION) {
                        introOpacity = 0;
                      } else if (currentTime >= introFadeStart) {
                        // Linear fade from 1 to 0 over 0.5 seconds
                        introOpacity = (INTRO_DURATION - currentTime) / 0.5;
                      }
                      
                      // Always render but use opacity and pointer-events to hide
                      return (
                        <div 
                          className="absolute inset-0 z-20 flex flex-col items-center justify-center"
                          style={{ 
                            opacity: introOpacity,
                            pointerEvents: introOpacity === 0 ? 'none' : 'auto',
                            willChange: 'opacity' // Hint to browser for GPU acceleration
                          }}
                        >
                          {/* Start Image Background (if uploaded) */}
                          {brandingSettings.startImageUrl && (
                            <img 
                              src={brandingSettings.startImageUrl} 
                              alt="Intro" 
                              className="absolute inset-0 w-full h-full"
                              style={{
                                objectFit: brandingSettings.startImageFit || 'contain',
                                opacity: (brandingSettings.startImageOpacity || 100) / 100,
                              }}
                            />
                          )}
                          
                          {/* Artist & Title Overlay (shown by default, or if checkbox enabled) */}
                          {(brandingSettings.startImageShowTitle ?? true) && (
                            <div className="relative z-10 text-center px-4">
                              <h2 
                                style={{
                                  fontFamily: previewFontFamily,
                                  fontSize: `${currentLineFontSize * 1.5}px`,
                                  color: textColor,
                                  textShadow: `2px 2px 4px ${outlineColor}, -2px -2px 4px ${outlineColor}, 2px -2px 4px ${outlineColor}, -2px 2px 4px ${outlineColor}`,
                                  marginBottom: '8px'
                                }}
                              >
                                {trackInfo.songTitle || project?.song_title || 'Song Title'}
                              </h2>
                              <p 
                                style={{
                                  fontFamily: previewFontFamily,
                                  fontSize: `${currentLineFontSize}px`,
                                  color: textColor,
                                  textShadow: `1px 1px 3px ${outlineColor}`,
                                  opacity: 0.9
                                }}
                              >
                                {trackInfo.artistName || project?.artist_name || 'Artist'}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    
                    {/* OUTRO TEXT OVERLAY - Shows after lyrics end */}
                    {brandingSettings.outroText && duration > 0 && currentTime > (duration - (brandingSettings.outroDuration || 3)) && (
                      <div 
                        className="absolute inset-0 flex items-center justify-center z-20 transition-opacity duration-500"
                        style={{ 
                          backgroundColor: 'rgba(0,0,0,0.7)',
                          opacity: Math.min(1, (currentTime - (duration - (brandingSettings.outroDuration || 3))) * 2)
                        }}
                      >
                        <p 
                          className="text-center px-4"
                          style={{
                            color: textColor,
                            fontSize: brandingSettings.outroFontSize === 'small' ? `${baseFontSize * 0.8}px` : brandingSettings.outroFontSize === 'large' ? `${baseFontSize * 1.5}px` : `${baseFontSize * 1.2}px`,
                            textShadow: `2px 2px 4px ${outlineColor}`,
                            whiteSpace: 'pre-wrap'
                          }}
                        >
                          {brandingSettings.outroText}
                        </p>
                      </div>
                    )}
                    
                    {/* LOGO WATERMARK OVERLAY */}
                    {brandingSettings.logoUrl && (() => {
                      // Scale logo size to match handler.py proportions
                      // Handler uses 1280px (720p) as base width: target_width = logo_size * (video_width / 1280)
                      // Preview needs the same ratio: preview_logo = logo_size * (boxWidth / 1280)
                      const logoScale = boxWidth / 1280;
                      const scaledLogoSize = (brandingSettings.logoSize || 50) * logoScale;
                      const scaledPadding = Math.max(3, 40 * logoScale); // Handler uses 40px padding at 720p
                      return (
                      <div 
                        className="absolute z-10 pointer-events-none"
                        style={{
                          // Position based on logoPosition setting - use scaled padding to match handler
                          ...(brandingSettings.logoPosition === 'top-left' && { top: `${scaledPadding}px`, left: `${scaledPadding}px` }),
                          ...(brandingSettings.logoPosition === 'top-right' && { top: `${scaledPadding}px`, right: `${scaledPadding}px` }),
                          ...(brandingSettings.logoPosition === 'bottom-left' && { bottom: `${scaledPadding}px`, left: `${scaledPadding}px` }),
                          ...(brandingSettings.logoPosition === 'bottom-right' && { bottom: `${scaledPadding}px`, right: `${scaledPadding}px` }),
                          ...(brandingSettings.logoPosition === 'top-center' && { top: `${scaledPadding}px`, left: '50%', transform: 'translateX(-50%)' }),
                          ...(brandingSettings.logoPosition === 'bottom-center' && { bottom: `${scaledPadding}px`, left: '50%', transform: 'translateX(-50%)' }),
                          // Size scaled to match handler output proportions
                          width: `${scaledLogoSize}px`,
                          height: `${scaledLogoSize}px`,
                          opacity: (brandingSettings.logoOpacity || 80) / 100,
                        }}
                      >
                        <img 
                          src={brandingSettings.logoUrl} 
                          alt="" 
                          className="w-full h-full object-contain"
                          style={{
                            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'
                          }}
                        />
                      </div>
                      );
                    })()}
                    
                    {/* Timestamp overlay - shows countdown during intro */}
                    <div className={`absolute bottom-1 right-1 sm:bottom-2 sm:right-2 px-1.5 py-0.5 bg-black/60 rounded text-[10px] sm:text-xs font-mono z-30 ${currentTime < INTRO_DURATION ? 'text-yellow-400' : 'text-white/80'}`}>
                      {formatTrackTime(currentTime)}
                    </div>
                    
                    {/* Resolution indicator - shows current aspect ratio */}
                    <div className="absolute top-1 left-1 sm:top-2 sm:left-2 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white/60 font-mono z-30">
                      {layoutSettings.aspectRatio}
                    </div>
                    
                    {/* Playback Controls Overlay - appears on hover */}
                    <div className="absolute inset-x-0 bottom-0 opacity-0 hover:opacity-100 transition-opacity duration-200 z-40">
                      {/* Gradient fade for better visibility */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
                      
                      {/* Mini progress bar */}
                      <div 
                        className={`absolute ${isPortrait ? 'bottom-8 left-1 right-1' : 'bottom-10 left-2 right-2'} h-1 bg-white/20 rounded-full cursor-pointer`}
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const percent = (e.clientX - rect.left) / rect.width;
                          const newTime = percent * duration;
                          seekTo(newTime);
                        }}
                      >
                        <div 
                          className="h-full bg-cyan-400 rounded-full"
                          style={{ width: `${(currentTime / duration) * 100}%` }}
                        />
                      </div>
                      
                      {/* Control buttons - smaller for portrait */}
                      <div className={`relative flex items-center justify-center ${isPortrait ? 'gap-1 py-1' : 'gap-2 py-2'}`}>
                        {/* Start Over */}
                        <button
                          onClick={restart}
                          className={`${isPortrait ? 'p-1' : 'p-1.5'} rounded-full bg-white/10 hover:bg-white/20 transition-colors`}
                          title="Start Over"
                        >
                          <RotateCcw className={`${isPortrait ? 'w-3 h-3' : 'w-4 h-4'} text-white`} />
                        </button>
                        
                        {/* Skip Back 10s */}
                        <button
                          onClick={() => seekTo(currentTime - 10)}
                          className={`${isPortrait ? 'p-1' : 'p-1.5'} rounded-full bg-white/10 hover:bg-white/20 transition-colors`}
                          title="Back 10 seconds"
                        >
                          <SkipBack className={`${isPortrait ? 'w-3 h-3' : 'w-4 h-4'} text-white`} />
                        </button>
                        
                        {/* Play/Pause */}
                        <button
                          onClick={togglePlayback}
                          className={`${isPortrait ? 'p-1.5' : 'p-2'} rounded-full bg-cyan-500 hover:bg-cyan-400 transition-colors`}
                          title={isPlaying ? "Pause" : "Play"}
                        >
                          {isPlaying ? (
                            <Pause className={`${isPortrait ? 'w-4 h-4' : 'w-5 h-5'} text-white`} />
                          ) : (
                            <Play className={`${isPortrait ? 'w-4 h-4' : 'w-5 h-5'} text-white ml-0.5`} />
                          )}
                        </button>
                        
                        {/* Skip Forward 10s */}
                        <button
                          onClick={() => seekTo(currentTime + 10)}
                          className={`${isPortrait ? 'p-1' : 'p-1.5'} rounded-full bg-white/10 hover:bg-white/20 transition-colors`}
                          title="Forward 10 seconds"
                        >
                          <SkipForward className={`${isPortrait ? 'w-3 h-3' : 'w-4 h-4'} text-white`} />
                        </button>
                        
                        {/* Mute Toggle */}
                        <button
                          onClick={() => {
                            const newMuted = !instrumentalMuted;
                            setInstrumentalMuted(newMuted);
                            if (instrumentalRef.current) instrumentalRef.current.muted = newMuted;
                            if (vocalsRef.current) {
                              setVocalsMuted(newMuted);
                              vocalsRef.current.muted = newMuted;
                            }
                          }}
                          className={`${isPortrait ? 'p-1' : 'p-1.5'} rounded-full bg-white/10 hover:bg-white/20 transition-colors`}
                          title="Toggle Mute"
                        >
                          {instrumentalMuted ? (
                            <VolumeX className={`${isPortrait ? 'w-3 h-3' : 'w-4 h-4'} text-white`} />
                          ) : (
                            <Volume2 className={`${isPortrait ? 'w-3 h-3' : 'w-4 h-4'} text-white`} />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            
            {/* Resize Handle - Glow & Grow on touch */}
            <div 
              onMouseDown={handleResizeStart}
              onTouchStart={handleResizeTouchStart}
              onTouchEnd={handleResizeTouchEnd}
              onTouchCancel={handleResizeTouchEnd}
              className={`cursor-ns-resize flex items-center justify-center select-none transition-all duration-200 ${
                glowingHandle === 'preview'
                  ? isDark
                    ? 'h-8 bg-cyan-500/20 border-t border-b border-cyan-400/50 shadow-[0_0_15px_rgba(0,212,228,0.3)]'
                    : 'h-8 bg-cyan-100 border-t border-b border-cyan-400/50 shadow-[0_0_15px_rgba(0,180,200,0.25)]'
                  : isDark
                    ? 'h-3 bg-white/5 hover:bg-white/10 sm:hover:h-5'
                    : 'h-3 bg-gray-100 hover:bg-gray-200 sm:hover:h-5'
              }`}
            >
              <div className={`flex items-center gap-1 transition-all duration-200 ${glowingHandle === 'preview' ? 'scale-125' : ''}`}>
                <GripHorizontal className={`w-4 h-4 transition-colors duration-200 ${glowingHandle === 'preview' ? 'text-cyan-400' : 'text-gray-400'}`} />
              </div>
            </div>
          </motion.div>

          {/* V11: TAB BAR */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.03 }}
            className={`rounded-2xl overflow-hidden mb-4 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}
          >
            {/* Tab Navigation */}
            <div className={`flex border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
              {/* Tabs - scrollable on mobile */}
              <div className="flex overflow-x-auto scrollbar-hide flex-1">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center justify-center gap-1.5 px-3 sm:px-4 py-3 text-sm font-medium transition-all whitespace-nowrap min-w-0
                      ${activeTab === tab.id 
                        ? `border-b-2 border-cyan-500 ${isDark ? 'text-cyan-400 bg-white/5' : 'text-cyan-600 bg-cyan-50'}` 
                        : isDark 
                          ? 'text-gray-400 hover:text-white hover:bg-white/5' 
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                  >
                    <tab.icon className="w-4 h-4 flex-shrink-0" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>
              
              {/* Undo/Redo Buttons - more compact on mobile */}
              <div className={`flex items-center gap-0.5 sm:gap-1 px-1 sm:px-2 border-l ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                {/* V12: Presets Button */}
                <button
                  onClick={() => setPresetModalOpen(true)}
                  className={`p-1.5 sm:p-2 rounded-lg transition-all ${
                    isDark 
                      ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10' 
                      : 'text-amber-600 hover:text-amber-700 hover:bg-amber-50'
                  }`}
                  title="Save & Load Presets"
                >
                  <Bookmark className="w-4 h-4" />
                </button>
                <div className={`hidden sm:block w-px h-4 ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />
                <button
                  onClick={handleUndo}
                  disabled={wordsHistoryIndex <= 0}
                  className={`p-1.5 sm:p-2 rounded-lg transition-all ${
                    wordsHistoryIndex > 0
                      ? isDark 
                        ? 'text-gray-300 hover:text-white hover:bg-white/10' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                      : 'text-gray-500 opacity-40 cursor-not-allowed'
                  }`}
                  title={`Undo (Ctrl+Z)${wordsHistoryIndex > 0 ? ` - ${wordsHistoryIndex} step${wordsHistoryIndex > 1 ? 's' : ''} available` : ''}`}
                >
                  <Undo2 className="w-4 h-4" />
                </button>
                <button
                  onClick={handleRedo}
                  disabled={wordsHistoryIndex >= wordsHistory.length - 1}
                  className={`p-1.5 sm:p-2 rounded-lg transition-all ${
                    wordsHistoryIndex < wordsHistory.length - 1
                      ? isDark 
                        ? 'text-gray-300 hover:text-white hover:bg-white/10' 
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                      : 'text-gray-500 opacity-40 cursor-not-allowed'
                  }`}
                  title={`Redo (Ctrl+Shift+Z)${wordsHistoryIndex < wordsHistory.length - 1 ? ` - ${wordsHistory.length - 1 - wordsHistoryIndex} step${wordsHistory.length - 1 - wordsHistoryIndex > 1 ? 's' : ''} available` : ''}`}
                >
                  <Redo2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tab Content Area */}
            <div>
              {/* TIMING TAB */}
              {activeTab === 'timing' && (
                <>
                  {/* LINE & WORD EDITOR - Collapsible */}
                  <div className={`${isDark ? 'border-b border-white/10' : 'border-b border-gray-200'}`}>
                    <div 
                      onClick={() => setLineEditorExpanded(!lineEditorExpanded)} 
                      className={`flex items-center justify-between px-4 py-3 cursor-pointer select-none ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {lineEditorExpanded ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                        <SplitSquareHorizontal className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                        <span className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          <span className="hidden sm:inline">Line & Word Editor (Rhyme Sync)</span>
                          <span className="sm:hidden">Line Editor</span>
                        </span>
                        {!lineEditorExpanded && (
                          <span className="sm:hidden text-[10px] text-cyan-400/70 ml-1">tap to expand</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Warning count for lines that are too long */}
                        <TooLongLinesWarning lyricsLines={lyricsLines} aspectRatio={layoutSettings.aspectRatio} fontSize={styleSettings.fontSize} emphasizeCurrentLine={layoutSettings.emphasizeCurrentLine} />
                        <span className="text-xs text-gray-500">{lyricsLines.length} lines | {words.length} words</span>
                      </div>
                    </div>

            {lineEditorExpanded && (
                <div className="overflow-hidden">
                  {/* Selected Word Actions */}
                  {selectedWordIndex !== null && editingWordIndex === null && (
                    <div className={`px-4 py-2 border-t ${isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-gray-500">Selected: "{words[selectedWordIndex]?.word}"</span>
                        <div className="flex gap-1">
                          <button onClick={() => setShowAddWordModal(true)} className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded hover:bg-purple-500/30 flex items-center gap-1">
                            <Plus className="w-3 h-3" />Add Word
                          </button>
                          <button onClick={deleteSelectedWords} className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 flex items-center gap-1">
                            <Trash2 className="w-3 h-3" />Delete Word
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                    {/* Left: Line Editor */}
                    <div className={`p-4 overflow-y-auto ${isDark ? 'border-r border-white/10' : 'border-r border-gray-200'}`} style={{ maxHeight: editorHeight }}>
                      <div className={`text-sm font-medium mb-3 px-3 py-2 rounded-lg ${isDark ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30' : 'bg-cyan-50 text-cyan-700 border border-cyan-200'}`}>
                        Double-click any word to edit its text. Click to select.
                      </div>
                      <div className="space-y-2">
                        {lyricsLines.map((line, lineIndex) => {
                          // Calculate if line is too long inline (not using useCallback)
                          const charCount = line.reduce((sum, w) => sum + w.word.length + 1, 0);
                          let maxCharsForLine = MAX_CHARS_PER_LINE[layoutSettings.aspectRatio || '16:9']?.[styleSettings.fontSize || 'normal'] || 50;
                          if (layoutSettings.emphasizeCurrentLine) maxCharsForLine = Math.floor(maxCharsForLine * EMPHASIZE_CHAR_REDUCTION);
                          const lineTooLong = (charCount - 1) > maxCharsForLine;
                          
                          // Check if any word in THIS line is selected
                          const lineHasSelectedWord = line.some(w => selectedWordIndices.has(w.globalIndex));
                          
                          // Find position of selected word within this line (for smart button visibility)
                          const selectedWordPositionInLine = line.findIndex(w => selectedWordIndices.has(w.globalIndex));
                          const isFirstWordSelected = selectedWordPositionInLine === 0;
                          const isLastWordSelected = selectedWordPositionInLine === line.length - 1;
                          const hasMultipleWordsInLine = line.length > 1;

                          return (
                            <div key={lineIndex}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs text-gray-500 w-6">{lineIndex + 1}</span>
                                {/* Merge Up - show if line has selection AND not first line */}
                                {lineHasSelectedWord && lineIndex > 0 && (
                                  <button onClick={() => mergeLineUp(lineIndex)} className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded hover:bg-purple-500/30 transition-all flex items-center gap-1" title="Merge this entire line with the line above">
                                    <ArrowUp className="w-3 h-3" />Merge Up
                                  </button>
                                )}
                                {/* Merge Down - show if line has selection AND multiple words AND not last line */}
                                {lineHasSelectedWord && hasMultipleWordsInLine && lineIndex < lyricsLines.length - 1 && (
                                  <button onClick={() => mergeLineDown(lineIndex)} className="px-2 py-0.5 text-xs bg-orange-500/20 text-orange-400 rounded hover:bg-orange-500/30 transition-all flex items-center gap-1" title="Merge this entire line with the line below">
                                    <ArrowDown className="w-3 h-3" />Merge Down
                                  </button>
                                )}
                                {/* Split Down - show if selected word is NOT the last word (words after it will move down) */}
                                {lineHasSelectedWord && hasMultipleWordsInLine && !isLastWordSelected && (
                                  <button onClick={() => mergeDownToNewLine(lineIndex)} className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-all flex items-center gap-1" title="Split: selected word and all words AFTER it move to a new line below">
                                    <ArrowDown className="w-3 h-3" />Split Down
                                  </button>
                                )}
                                {/* Split Up - show if selected word is NOT the first word (words before it will move up) */}
                                {lineHasSelectedWord && hasMultipleWordsInLine && !isFirstWordSelected && (
                                  <button onClick={() => mergeUpToNewLine(lineIndex)} className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-all flex items-center gap-1" title="Split: selected word and all words BEFORE it become a new line above">
                                    <ArrowUp className="w-3 h-3" />Split Up
                                  </button>
                                )}
                                {lineTooLong && (
                                  <LineLengthWarning 
                                    lineIndex={lineIndex} 
                                    charCount={charCount - 1} 
                                    maxChars={maxCharsForLine} 
                                  />
                                )}
                                
                                {/* Duet Mode Line Assignment - only show when duet mode is enabled */}
                                {isDuetMode && (
                                  <div className="flex items-center gap-1 ml-auto">
                                    <span className="text-xs text-gray-500 mr-1">Singer:</span>
                                    <button
                                      onClick={() => assignLineToSinger(lineIndex, SINGER.SINGER_1)}
                                      className={`px-2 py-0.5 text-xs rounded transition-all ${
                                        getLineSingerAssignment(lineIndex) === SINGER.SINGER_1
                                          ? 'ring-2 ring-offset-1 ring-offset-transparent'
                                          : 'opacity-70 hover:opacity-100'
                                      }`}
                                      style={{ 
                                        backgroundColor: `${duetColors.singer1}30`,
                                        color: duetColors.singer1,
                                        ringColor: duetColors.singer1
                                      }}
                                      title="Assign entire line to Singer 1"
                                    >
                                      S1
                                    </button>
                                    <button
                                      onClick={() => assignLineToSinger(lineIndex, SINGER.SINGER_2)}
                                      className={`px-2 py-0.5 text-xs rounded transition-all ${
                                        getLineSingerAssignment(lineIndex) === SINGER.SINGER_2
                                          ? 'ring-2 ring-offset-1 ring-offset-transparent'
                                          : 'opacity-70 hover:opacity-100'
                                      }`}
                                      style={{ 
                                        backgroundColor: `${duetColors.singer2}30`,
                                        color: duetColors.singer2,
                                        ringColor: duetColors.singer2
                                      }}
                                      title="Assign entire line to Singer 2"
                                    >
                                      S2
                                    </button>
                                    <button
                                      onClick={() => assignLineToSinger(lineIndex, SINGER.BOTH)}
                                      className={`px-2 py-0.5 text-xs rounded transition-all ${
                                        getLineSingerAssignment(lineIndex) === SINGER.BOTH
                                          ? 'ring-2 ring-offset-1 ring-offset-transparent'
                                          : 'opacity-70 hover:opacity-100'
                                      }`}
                                      style={{ 
                                        backgroundColor: `${duetColors.both}30`,
                                        color: duetColors.both,
                                        ringColor: duetColors.both
                                      }}
                                      title="Assign entire line to Both singers"
                                    >
                                      Both
                                    </button>
                                    {getLineSingerAssignment(lineIndex) === 'mixed' && (
                                      <span className="text-xs text-gray-400 italic ml-1">(mixed)</span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div 
                                className={`flex flex-wrap items-center gap-1 p-2 rounded-lg ${lineTooLong ? 'bg-yellow-500/10 border border-yellow-500/30' : isDark ? 'bg-white/5' : 'bg-gray-100'}`}
                                style={isDuetMode ? {
                                  borderLeft: `4px solid ${
                                    getLineSingerAssignment(lineIndex) === SINGER.SINGER_1 ? duetColors.singer1 :
                                    getLineSingerAssignment(lineIndex) === SINGER.SINGER_2 ? duetColors.singer2 :
                                    getLineSingerAssignment(lineIndex) === SINGER.BOTH ? duetColors.both :
                                    'transparent'
                                  }`
                                } : {}}
                              >
                                {line.map((wordData, wordIndex) => {
                                  const isSelected = selectedWordIndices.has(wordData.globalIndex);
                                  const isEditing = editingWordIndex === wordData.globalIndex;
                                  const isLastInLine = wordIndex === line.length - 1;
                                  const isCurrent = isWordCurrent(wordData);

                                  return (
                                    <span key={wordData.globalIndex} className="inline-flex items-center">
                                      {isEditing ? (
                                        <input
                                          ref={editInputRef}
                                          type="text"
                                          value={editingText}
                                          onChange={(e) => setEditingText(e.target.value)}
                                          onBlur={saveWordEdit}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') { e.preventDefault(); saveWordEdit(); }
                                            if (e.key === 'Escape') { e.preventDefault(); cancelWordEdit(); }
                                          }}
                                          className="px-2 py-1 rounded text-sm bg-cyan-500/30 text-white border-2 border-cyan-500 focus:outline-none min-w-[60px]"
                                          style={{ width: `${Math.max(60, editingText.length * 10)}px` }}
                                        />
                                      ) : (
                                        <button
                                          onClick={(e) => handleWordClick(wordData.globalIndex, e)}
                                          onDoubleClick={(e) => handleWordDoubleClick(wordData.globalIndex, e)}
                                          className={`px-2 py-1 rounded text-sm transition-all ${isSelected ? 'bg-cyan-500/30 text-cyan-300 ring-2 ring-cyan-500' :
                                              isCurrent ? 'bg-green-500/30 text-green-300' :
                                                wordData.confidence !== undefined && wordData.confidence < 0.5
                                                  ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                                                  : isDark ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-gray-200 text-gray-700'
                                            }`}
                                          title={`"${wordData.word}"\nStart: ${Math.floor(wordData.start / 60)}:${(wordData.start % 60).toFixed(3).padStart(6, '0')}\nEnd: ${Math.floor(wordData.end / 60)}:${(wordData.end % 60).toFixed(3).padStart(6, '0')}\nDuration: ${(wordData.end - wordData.start).toFixed(3)}s${wordData.confidence ? `\nConfidence: ${(wordData.confidence * 100).toFixed(0)}%` : ''}\n\nDouble-click to edit`}
                                        >
                                          {wordData.word}
                                        </button>
                                      )}
                                      {isLastInLine && lineIndex < lyricsLines.length - 1 && (
                                        <span className="ml-1 w-1 h-4 bg-cyan-500 rounded-full" title="Line break" />
                                      )}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Right: Original Lyrics - collapsible on mobile */}
                    <div className="p-4 overflow-y-auto" style={{ maxHeight: editorHeight }}>
                      <div 
                        className={`flex items-center gap-2 mb-2 sm:cursor-default cursor-pointer select-none ${
                          !originalLyricsExpanded ? 'sm:mb-2 mb-0' : ''
                        }`}
                        onClick={() => {
                          if (window.innerWidth < 640) setOriginalLyricsExpanded(prev => !prev);
                        }}
                      >
                        {/* Chevron only on mobile */}
                        <span className="sm:hidden">
                          {originalLyricsExpanded 
                            ? <ChevronDown className="w-3 h-3 text-gray-400" /> 
                            : <ChevronRight className="w-3 h-3 text-gray-400" />
                          }
                        </span>
                        <Type className="w-4 h-4 text-gray-400" />
                        <span className="text-xs font-medium text-gray-400">Original Lyrics (Reference)</span>
                        {!originalLyricsExpanded && (
                          <span className="sm:hidden text-[10px] text-gray-500 ml-auto">tap to show</span>
                        )}
                      </div>
                      {/* Always visible on desktop, collapsible on mobile */}
                      <div className={`sm:block ${originalLyricsExpanded ? 'block' : 'hidden'}`}>
                        <div className={`p-3 rounded-lg text-sm ${isDark ? 'bg-white/5 text-gray-300' : 'bg-gray-50 text-gray-700'}`}>
                          {originalLyricsText ? (
                            <pre className="whitespace-pre-wrap font-sans">{originalLyricsText}</pre>
                          ) : (
                            <p className="text-gray-500 italic">No original lyrics available</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Editor Resize Handle - Glow & Grow on touch */}
                  <div
                    onMouseDown={handleEditorResizeStart}
                    onTouchStart={handleEditorResizeTouchStart}
                    onTouchEnd={handleEditorResizeTouchEnd}
                    onTouchCancel={handleEditorResizeTouchEnd}
                    className={`cursor-ns-resize flex items-center justify-center select-none transition-all duration-200 ${
                      glowingHandle === 'editor'
                        ? isDark
                          ? 'h-8 bg-cyan-500/20 border-t border-b border-cyan-400/50 shadow-[0_0_15px_rgba(0,212,228,0.3)]'
                          : 'h-8 bg-cyan-100 border-t border-b border-cyan-400/50 shadow-[0_0_15px_rgba(0,180,200,0.25)]'
                        : isDark
                          ? 'h-3 bg-white/5 hover:bg-white/10 sm:hover:h-5'
                          : 'h-3 bg-gray-100 hover:bg-gray-200 sm:hover:h-5'
                    }`}
                  >
                    <div className={`flex items-center gap-1 transition-all duration-200 ${glowingHandle === 'editor' ? 'scale-125' : ''}`}>
                      <GripHorizontal className={`w-4 h-4 transition-colors duration-200 ${glowingHandle === 'editor' ? 'text-cyan-400' : 'text-gray-400'}`} />
                    </div>
                  </div>
                </div>
              )}
          </div>

          {/* TIMELINE EDITOR - Collapsible with Duet Mode Toggle */}
          <div className={`${isDark ? 'border-t border-white/10' : 'border-t border-gray-200'}`}>
            <div
              onClick={() => setTimelineEditorExpanded(!timelineEditorExpanded)}
              className={`flex items-center justify-between px-4 py-3 cursor-pointer select-none ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {timelineEditorExpanded ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                <Music2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <span className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  <span className="hidden sm:inline">Timeline Editor</span>
                  <span className="sm:hidden">Timeline</span>
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDuetMode(!isDuetMode);
                  setHasChanges(true);
                  if (!isDuetMode && !timelineEditorExpanded) setTimelineEditorExpanded(true);
                }}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0 ${isDuetMode ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-red-500/20 text-red-400 border border-red-500/50'}`}
              >
                <span className="hidden sm:inline">{isDuetMode ? 'Duet Mode On' : 'Duet Mode Off'}</span>
                <span className="sm:hidden">{isDuetMode ? 'Duet On' : 'Duet Off'}</span>
              </button>
            </div>

            {timelineEditorExpanded && (
                <div className="overflow-hidden">

                  {/* Duet Color Settings */}
                  {isDuetMode && (
                    <div className={`px-4 py-3 border-t ${isDark ? 'border-white/10 bg-gradient-to-r from-cyan-500/10 to-pink-500/10' : 'border-gray-200 bg-gradient-to-r from-cyan-50 to-pink-50'}`}>
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Singer 1:</span>
                          <input type="color" value={duetColors.singer1} onChange={(e) => { setDuetColors(prev => ({ ...prev, singer1: e.target.value })); setHasChanges(true); }} className="w-8 h-8 rounded cursor-pointer" />
                          <button onClick={() => setPaintMode(paintMode === SINGER.SINGER_1 ? null : SINGER.SINGER_1)} className={`px-2 py-1 text-xs rounded ${paintMode === SINGER.SINGER_1 ? 'bg-cyan-500 text-white' : isDark ? 'bg-white/10 text-gray-400' : 'bg-gray-200 text-gray-600'}`}>
                            {paintMode === SINGER.SINGER_1 ? 'Painting...' : 'Paint'}
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Singer 2:</span>
                          <input type="color" value={duetColors.singer2} onChange={(e) => { setDuetColors(prev => ({ ...prev, singer2: e.target.value })); setHasChanges(true); }} className="w-8 h-8 rounded cursor-pointer" />
                          <button onClick={() => setPaintMode(paintMode === SINGER.SINGER_2 ? null : SINGER.SINGER_2)} className={`px-2 py-1 text-xs rounded ${paintMode === SINGER.SINGER_2 ? 'bg-pink-500 text-white' : isDark ? 'bg-white/10 text-gray-400' : 'bg-gray-200 text-gray-600'}`}>
                            {paintMode === SINGER.SINGER_2 ? 'Painting...' : 'Paint'}
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Both:</span>
                          <input type="color" value={duetColors.both} onChange={(e) => { setDuetColors(prev => ({ ...prev, both: e.target.value })); setHasChanges(true); }} className="w-8 h-8 rounded cursor-pointer" />
                          <button onClick={() => setPaintMode(paintMode === SINGER.BOTH ? null : SINGER.BOTH)} className={`px-2 py-1 text-xs rounded ${paintMode === SINGER.BOTH ? 'bg-yellow-500 text-white' : isDark ? 'bg-white/10 text-gray-400' : 'bg-gray-200 text-gray-600'}`}>
                            {paintMode === SINGER.BOTH ? 'Painting...' : 'Paint'}
                          </button>
                        </div>
                        {paintMode !== null && (
                          <button onClick={() => setPaintMode(null)} className="px-2 py-1 text-xs bg-gray-500 text-white rounded">Stop Painting</button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Zoom Controls */}
                  <div className={`px-4 py-2 border-t ${isDark ? 'border-white/10' : 'border-gray-200'} flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <button onClick={zoomOut} className={`p-2 rounded-lg ${isDark ? 'bg-white/10 hover:bg-white/20 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'} transition-colors`}>
                        <ZoomOut className="w-4 h-4" />
                      </button>
                      <span className={`text-sm font-medium w-20 text-center ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{zoom.toFixed(0)}px/s</span>
                      <button onClick={zoomIn} className={`p-2 rounded-lg ${isDark ? 'bg-white/10 hover:bg-white/20 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'} transition-colors`}>
                        <ZoomIn className="w-4 h-4" />
                      </button>
                      
                      {/* Waveform Threshold Slider */}
                      {waveformData && (
                        <div className="flex items-center gap-2 ml-4 pl-4 border-l border-white/10">
                          <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Threshold:</span>
                          <input
                            type="range"
                            min="0"
                            max="50"
                            value={waveformThreshold}
                            onChange={(e) => setWaveformThreshold(parseInt(e.target.value))}
                            className="w-20 h-1 accent-green-500 cursor-pointer"
                            title={`Hide waveform below ${waveformThreshold}% amplitude`}
                          />
                          <span className={`text-xs w-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{waveformThreshold}%</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedWordIndices.size > 1 && (
                        <span className="text-xs text-cyan-400 font-medium">{selectedWordIndices.size} words selected</span>
                      )}
                      <span className="text-xs text-gray-500 hidden sm:inline">Scroll to navigate | Drag edges to resize | Shift+Click range</span>
                      <span className="text-xs text-gray-500 sm:hidden">Swipe to scrub | Hold word for menu</span>
                    </div>
                  </div>

                  {/* Timeline with Time Markers - LCD Style Background */}
                  <div 
                    ref={timelineContainerRef} 
                    onClick={handleTimelineClick}
                    onTouchStart={handleTimelineTouchStart}
                    onMouseMove={(e) => {
                      // Calculate time at mouse position for tooltip
                      const rect = e.currentTarget.getBoundingClientRect();
                      const mouseX = e.clientX - rect.left;
                      const centerX = rect.width / 2;
                      const timeAtMouse = currentTime + (mouseX - centerX) / zoom;
                      setTimelineHover({ 
                        show: true, 
                        x: mouseX, 
                        time: Math.max(0, Math.min(duration, timeAtMouse))
                      });
                    }}
                    onMouseLeave={() => setTimelineHover({ show: false, x: 0, time: 0 })}
                    className="relative overflow-hidden cursor-crosshair"
                    style={{ 
                      height: isDuetMode ? TIMELINE_HEIGHT_DUET : TIMELINE_HEIGHT,
                      background: isDark 
                        ? 'linear-gradient(180deg, #0a0f14 0%, #0d1318 50%, #0a0f14 100%)' 
                        : 'linear-gradient(180deg, #1a1f24 0%, #1d2228 50%, #1a1f24 100%)',
                      borderTop: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.1)',
                      boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.4)'
                    }}
                  >
                    {/* Waveform Visualization - Solid Filled Wave */}
                    <div className="absolute inset-0 bottom-6 overflow-hidden pointer-events-none" style={{ opacity: vocalsVolume > 0 ? 0.5 : 0.25 }}>
                      {(() => {
                        const containerWidth = timelineContainerRef.current?.offsetWidth || 800;
                        const centerX = containerWidth / 2;
                        const currentTimelineHeight = isDuetMode ? TIMELINE_HEIGHT_DUET : TIMELINE_HEIGHT;
                        const waveformHeight = currentTimelineHeight - 30;
                        const centerY = waveformHeight / 2 + 4;
                        const thresholdValue = waveformThreshold / 100; // Convert 0-100 to 0-1
                        
                        // Use real waveform data if available
                        if (waveformData && waveformData.amplitudes) {
                          const samplesPerSecond = waveformData.samples_per_second || 20;
                          const secondsPerSample = 1 / samplesPerSecond;
                          
                          // Build SVG path points for top and bottom of waveform
                          const topPoints = [];
                          const bottomPoints = [];
                          
                          for (let sampleIndex = 0; sampleIndex < waveformData.amplitudes.length; sampleIndex++) {
                            const sampleTime = sampleIndex * secondsPerSample;
                            const barX = centerX + (sampleTime - currentTime) * zoom;
                            
                            // Skip if way off-screen (with buffer for smooth edges)
                            if (barX < -50 || barX > containerWidth + 50) continue;
                            
                            let amplitude = waveformData.amplitudes[sampleIndex];
                            
                            // Apply threshold - if amplitude is below threshold, set to 0
                            if (amplitude < thresholdValue) {
                              amplitude = 0;
                            }
                            
                            // Scale amplitude for visual display
                            const heightPercent = amplitude > 0 ? (0.05 + amplitude * 0.9) : 0;
                            const halfHeight = (heightPercent * waveformHeight) / 2;
                            
                            topPoints.push({ x: barX, y: centerY - halfHeight });
                            bottomPoints.push({ x: barX, y: centerY + halfHeight });
                          }
                          
                          if (topPoints.length < 2) {
                            return null;
                          }
                          
                          // Create smooth path - top line going right, bottom line going left
                          let pathD = `M ${topPoints[0].x} ${topPoints[0].y}`;
                          
                          // Draw top edge (left to right)
                          for (let i = 1; i < topPoints.length; i++) {
                            pathD += ` L ${topPoints[i].x} ${topPoints[i].y}`;
                          }
                          
                          // Connect to bottom and draw bottom edge (right to left)
                          const lastBottom = bottomPoints[bottomPoints.length - 1];
                          pathD += ` L ${lastBottom.x} ${lastBottom.y}`;
                          
                          for (let i = bottomPoints.length - 2; i >= 0; i--) {
                            pathD += ` L ${bottomPoints[i].x} ${bottomPoints[i].y}`;
                          }
                          
                          pathD += ' Z'; // Close the path
                          
                          return (
                            <svg 
                              width={containerWidth} 
                              height={waveformHeight + 8} 
                              className="absolute top-0 left-0"
                              style={{ overflow: 'visible' }}
                            >
                              <defs>
                                <linearGradient id="waveformGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                  <stop offset="0%" stopColor={vocalsVolume > 0 ? '#22c55e' : '#2d5a2d'} stopOpacity="0.6" />
                                  <stop offset="50%" stopColor={vocalsVolume > 0 ? '#16a34a' : '#1f4a1f'} stopOpacity="0.4" />
                                  <stop offset="100%" stopColor={vocalsVolume > 0 ? '#22c55e' : '#2d5a2d'} stopOpacity="0.6" />
                                </linearGradient>
                              </defs>
                              <path 
                                d={pathD} 
                                fill="url(#waveformGradient)"
                                stroke={vocalsVolume > 0 ? '#22c55e' : '#2d5a2d'}
                                strokeWidth="0.5"
                                strokeOpacity="0.3"
                              />
                            </svg>
                          );
                        } else {
                          // Fallback: Show flat line placeholder
                          return (
                            <div 
                              className="absolute rounded-full"
                              style={{
                                left: 0,
                                right: 0,
                                height: waveformLoading ? 4 : 2,
                                top: centerY - 1,
                                backgroundColor: '#2d5a2d',
                                opacity: 0.3,
                              }}
                            />
                          );
                        }
                      })()}
                    </div>
                    
                    {/* Waveform loading indicator */}
                    {waveformLoading && (
                      <div className="absolute top-2 right-2 text-xs text-green-500/60 flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        Loading waveform...
                      </div>
                    )}
                    
                    {/* No waveform data indicator */}
                    {!waveformData && !waveformLoading && (
                      <div className="absolute top-2 right-2 text-xs text-gray-500/60">
                        No waveform data
                      </div>
                    )}
                    
                    {/* Subtle grid lines for LCD effect */}
                    <div 
                      className="absolute inset-0 pointer-events-none opacity-10"
                      style={{
                        backgroundImage: `
                          linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px),
                          linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)
                        `,
                        backgroundSize: '20px 20px'
                      }}
                    />
                    
                    {/* Time Markers */}
                    <div className={`absolute bottom-0 left-0 right-0 h-6 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                      {(() => {
                        const containerWidth = timelineContainerRef.current?.offsetWidth || 800;
                        const centerX = containerWidth / 2;
                        return timeMarkers.map(({ time, isMajor }) => {
                          const markerX = centerX + (time - currentTime) * zoom;
                          if (markerX < -50 || markerX > containerWidth + 50) return null;
                          return (
                            <div
                              key={time}
                              className="absolute bottom-0 flex flex-col items-center"
                              style={{ left: markerX, transform: 'translateX(-50%)' }}
                            >
                              <div className={`${isMajor ? 'h-4 w-0.5 bg-gray-400' : 'h-2 w-px bg-gray-600'}`} />
                              {isMajor && (
                                <span className="text-[10px] text-gray-500 mt-0.5">{formatTimeShort(time)}</span>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                    
                    {/* Hover Time Tooltip */}
                    {timelineHover.show && (
                      <div 
                        className="absolute bottom-7 z-40 pointer-events-none transform -translate-x-1/2"
                        style={{ left: timelineHover.x }}
                      >
                        <div className="bg-gray-900 text-cyan-400 text-xs font-mono px-2 py-1 rounded shadow-lg border border-cyan-500/30">
                          {Math.floor(timelineHover.time / 60)}:{(timelineHover.time % 60).toFixed(2).padStart(5, '0')}
                        </div>
                        {/* Small arrow pointing down */}
                        <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-gray-900 border-r border-b border-cyan-500/30 transform rotate-45" />
                      </div>
                    )}
                    
                    {/* Hover vertical line */}
                    {timelineHover.show && (
                      <div 
                        className="absolute top-0 bottom-6 w-px bg-cyan-400/30 pointer-events-none z-20"
                        style={{ left: timelineHover.x }}
                      />
                    )}

                    {/* Center Playhead */}
                    <div className="absolute top-0 bottom-6 w-0.5 bg-cyan-400 z-30 pointer-events-none" style={{ left: '50%', transform: 'translateX(-50%)', boxShadow: '0 0 15px rgba(0, 212, 255, 0.7)' }}>
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-cyan-400" />
                    </div>

                    {/* Duet Mode Row Labels */}
                    {isDuetMode && (
                      <div className="absolute left-2 top-0 bottom-6 flex flex-col justify-around pointer-events-none z-10" style={{ width: '50px' }}>
                        <div className="flex items-center gap-1" title="Singer 1">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: duetColors.singer1 }} />
                          <span className="text-[10px] font-medium" style={{ color: duetColors.singer1 }}>S1</span>
                        </div>
                        <div className="flex items-center gap-1" title="Both Singers">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: duetColors.both }} />
                          <span className="text-[10px] font-medium" style={{ color: duetColors.both }}>Both</span>
                        </div>
                        <div className="flex items-center gap-1" title="Singer 2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: duetColors.singer2 }} />
                          <span className="text-[10px] font-medium" style={{ color: duetColors.singer2 }}>S2</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Duet Mode Row Dividers */}
                    {isDuetMode && (
                      <>
                        <div className="absolute left-0 right-0 border-t border-dashed border-white/10 pointer-events-none" style={{ top: (TIMELINE_HEIGHT_DUET - 24) / 3 }} />
                        <div className="absolute left-0 right-0 border-t border-dashed border-white/10 pointer-events-none" style={{ top: ((TIMELINE_HEIGHT_DUET - 24) / 3) * 2 }} />
                      </>
                    )}

                    {/* Words on timeline - Direct pixel positioning */}
                    {(() => {
                      const containerWidth = timelineContainerRef.current?.offsetWidth || 800;
                      const centerX = containerWidth / 2;
                      const currentTimelineHeight = isDuetMode ? TIMELINE_HEIGHT_DUET : TIMELINE_HEIGHT;
                      const wordHeight = isDuetMode ? 36 : 44; // Smaller words in duet mode to fit 3 rows
                      const timelineContentHeight = currentTimelineHeight - 24; // Exclude time markers area
                      
                      // Calculate row positions for duet mode
                      const rowHeight = timelineContentHeight / 3;
                      const getWordTop = (singer) => {
                        if (!isDuetMode) {
                          return (timelineContentHeight - wordHeight) / 2;
                        }
                        // Singer 1 = top row, Both = middle row, Singer 2 = bottom row
                        switch (singer) {
                          case SINGER.SINGER_1:
                            return (rowHeight - wordHeight) / 2; // Top row
                          case SINGER.SINGER_2:
                            return rowHeight * 2 + (rowHeight - wordHeight) / 2; // Bottom row
                          case SINGER.BOTH:
                          default:
                            return rowHeight + (rowHeight - wordHeight) / 2; // Middle row
                        }
                      };

                      return words.map((word, index) => {
                        const wordX = centerX + (word.start - currentTime) * zoom;
                        const wordWidth = Math.max(isDuetMode ? 35 : 40, (word.end - word.start) * zoom);

                        // Skip if off-screen
                        if (wordX + wordWidth < -100 || wordX > containerWidth + 100) return null;

                        const isSelected = selectedWordIndices.has(index);
                        const isCurrent = isWordCurrent(word);
                        const wordColor = getWordColor(word, isSelected, isCurrent);
                        const wordSinger = word.singer ?? SINGER.BOTH;
                        const wordTop = getWordTop(wordSinger);

                        // Format timestamp for tooltip - shows exact AssemblyAI timing
                        const formatTimestamp = (seconds) => {
                          const mins = Math.floor(seconds / 60);
                          const secs = (seconds % 60).toFixed(3);
                          return `${mins}:${secs.padStart(6, '0')}`;
                        };
                        const singerLabel = wordSinger === SINGER.SINGER_1 ? 'Singer 1' : wordSinger === SINGER.SINGER_2 ? 'Singer 2' : 'Both';
                        const tooltipText = `"${word.word}"\nStart: ${formatTimestamp(word.start)}\nEnd: ${formatTimestamp(word.end)}\nDuration: ${(word.end - word.start).toFixed(3)}s${isDuetMode ? `\nSinger: ${singerLabel}` : ''}${word.confidence ? `\nConfidence: ${(word.confidence * 100).toFixed(0)}%` : ''}`;

                        const isHovered = hoveredWordIndex === index;
                        const isBeingResized = isWordResizing && wordResizeIndex === index;

                        return (
                          <div
                            key={index}
                            className="timeline-word absolute cursor-pointer select-none group"
                            style={{
                              left: wordX,
                              width: wordWidth,
                              height: wordHeight,
                              top: wordTop
                            }}
                            onMouseDown={(e) => {
                              // Only start drag if not clicking on resize handles
                              if (!e.target.classList.contains('resize-handle')) {
                                handleTimelineWordMouseDown(index, e);
                              }
                            }}
                            onTouchStart={(e) => {
                              // Touch support: start both drag AND long-press timer
                              if (e.touches.length === 1 && !e.target.classList.contains('resize-handle')) {
                                handleTimelineWordMouseDown(index, e, e.touches[0].clientX);
                                handleWordTouchStart(index, e);
                              }
                            }}
                            onTouchMove={(e) => {
                              // Cancel long-press if finger moves (user is dragging)
                              handleWordTouchMove(e);
                            }}
                            onTouchEnd={() => {
                              // Clean up long-press timer
                              handleWordTouchEnd();
                            }}
                            onTouchCancel={() => {
                              handleWordTouchEnd();
                            }}
                            onMouseEnter={() => {
                              handleTimelineWordMouseEnter(index);
                              setHoveredWordIndex(index);
                            }}
                            onMouseLeave={() => {
                              if (!isWordResizing) setHoveredWordIndex(null);
                            }}
                            onClick={(e) => { 
                              if (!e.target.classList.contains('resize-handle')) {
                                e.stopPropagation(); 
                                handleWordClick(index, e); 
                              }
                            }}
                            onContextMenu={(e) => handleWordContextMenu(index, e)}
                            title={tooltipText + '\n\nDrag edges to resize'}
                          >
                            {/* Left resize handle */}
                            <div
                              className={`resize-handle absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize z-10 flex items-center justify-center transition-opacity ${isHovered || isBeingResized ? 'opacity-100' : 'opacity-0'}`}
                              onMouseDown={(e) => handleWordResizeStart(index, 'left', e)}
                              onTouchStart={(e) => {
                                if (e.touches.length === 1) {
                                  e.stopPropagation();
                                  handleWordResizeStart(index, 'left', e, e.touches[0].clientX);
                                }
                              }}
                              title="Drag to adjust start time"
                            >
                              <div className={`w-1 h-6 rounded-full ${isBeingResized && wordResizeEdge === 'left' ? 'bg-cyan-400' : 'bg-white/60'}`} />
                            </div>
                            
                            {/* Word content */}
                            <div
                              className={`h-full rounded-lg border-2 flex items-center justify-center px-3 overflow-hidden ${isSelected
                                  ? 'border-cyan-400 shadow-lg shadow-cyan-500/30 bg-cyan-500/20'
                                  : isCurrent
                                    ? isDark ? 'border-white/40 bg-white/15' : 'border-gray-400 bg-gray-200/50'
                                    : isDark ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-gray-200 bg-gray-100 hover:bg-gray-200'
                                }`}
                              style={{ 
                                borderColor: isDuetMode && !isSelected ? (wordSinger === SINGER.SINGER_1 ? duetColors.singer1 + '40' : wordSinger === SINGER.SINGER_2 ? duetColors.singer2 + '40' : duetColors.both + '40') : undefined
                              }}
                            >
                              <span className={`${isDuetMode ? 'text-[10px]' : 'text-xs'} font-medium truncate`} style={{ color: wordColor }}>{word.word}</span>
                            </div>
                            
                            {/* Right resize handle */}
                            <div
                              className={`resize-handle absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize z-10 flex items-center justify-center transition-opacity ${isHovered || isBeingResized ? 'opacity-100' : 'opacity-0'}`}
                              onMouseDown={(e) => handleWordResizeStart(index, 'right', e)}
                              onTouchStart={(e) => {
                                if (e.touches.length === 1) {
                                  e.stopPropagation();
                                  handleWordResizeStart(index, 'right', e, e.touches[0].clientX);
                                }
                              }}
                              title="Drag to adjust end time"
                            >
                              <div className={`w-1 h-6 rounded-full ${isBeingResized && wordResizeEdge === 'right' ? 'bg-cyan-400' : 'bg-white/60'}`} />
                            </div>
                            
                            {word.lineBreak && <div className="absolute -right-0.5 top-0 bottom-0 w-1 bg-cyan-500 rounded-full" title="Line break" />}
                          </div>
                        );
                      });
                    })()}
                  </div>

                  {/* Playback Controls - V10.8 with Volume Sliders */}
                  <div className={`px-4 py-3 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                    {/* Main Playback Row */}
                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        <button onClick={restart} className={`p-2 rounded-lg ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'}`}><SkipBack className="w-4 h-4" /></button>
                        <button onClick={togglePlayback} className={`p-3 rounded-xl ${isPlaying ? 'bg-red-500 hover:bg-red-600' : 'bg-cyan-500 hover:bg-cyan-600'} text-white`}>
                          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                        </button>
                      </div>

                      <div className="flex-1 flex items-center gap-2">
                        <span className={`text-xs font-mono w-24 ${currentTime < INTRO_DURATION ? 'text-yellow-400' : 'text-cyan-400'}`} title="Current playback time (countdown during intro)">
                          {formatTrackTimeDetailed(currentTime)}
                        </span>
                        <div onClick={handleProgressClick} className={`flex-1 h-2 rounded-full cursor-pointer overflow-hidden ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}>
                          <div className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full transition-all" style={{ width: `${(currentTime / duration) * 100}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 w-12">{formatTime(duration)}</span>
                      </div>
                    </div>

                    {/* Volume Controls - simple toggles on mobile, sliders on desktop */}
                    <div className={`pt-2 border-t ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
                      {/* Mobile: Simple on/off toggle buttons */}
                      <div className="flex sm:hidden items-center justify-center gap-3">
                        <button
                          onClick={() => {
                            const newMuted = !instrumentalMuted;
                            setInstrumentalMuted(newMuted);
                            if (instrumentalRef.current) instrumentalRef.current.muted = newMuted;
                          }}
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                            instrumentalMuted
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          <span className="text-base">ðŸŽµ</span>
                          <span>Music {instrumentalMuted ? 'OFF' : 'ON'}</span>
                        </button>

                        {project.vocals_audio_url && (
                          <button
                            onClick={() => {
                              const newMuted = !vocalsMuted;
                              setVocalsMuted(newMuted);
                              if (!newMuted) setVocalsVolume(100);
                              if (vocalsRef.current) vocalsRef.current.muted = newMuted;
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                              vocalsMuted
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            <span className="text-base">ðŸŽ¤</span>
                            <span>Vocals {vocalsMuted ? 'OFF' : 'ON'}</span>
                          </button>
                        )}
                      </div>

                      {/* Desktop: Full volume sliders */}
                      <div className="hidden sm:flex sm:items-center sm:justify-between gap-2">
                        {/* Backing Track Volume */}
                        <VolumeSlider
                          value={instrumentalVolume}
                          onChange={handleInstrumentalVolumeChange}
                          label="Backing"
                          icon={Music}
                          color="#06b6d4"
                          muted={instrumentalMuted}
                          onMuteToggle={toggleInstrumentalMute}
                          isDark={isDark}
                        />

                        {/* Vocals Volume (Reference Only) */}
                        {project.vocals_audio_url ? (
                          <div className="flex items-center gap-2">
                            <VolumeSlider
                              value={vocalsVolume}
                              onChange={handleVocalsVolumeChange}
                              label="Vocals"
                              icon={Mic}
                              color="#f472b6"
                              muted={vocalsMuted}
                              onMuteToggle={toggleVocalsMute}
                              isDark={isDark}
                            />
                            <span className={`text-[10px] px-2 py-0.5 rounded flex-shrink-0 ${isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700'}`}>
                              Reference only
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Mic className="w-4 h-4 text-gray-500" />
                            <span className="text-xs text-gray-500">No vocals track available</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
          </div>
                </>
              )}

              {/* STYLE TAB - V11 Implementation */}
              {activeTab === 'style' && (
                <div className="p-4 space-y-6 max-h-[450px] overflow-y-auto">
                  {/* Font Selection */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Font
                    </label>
                    <FontDropdown
                      value={styleSettings.selectedFont}
                      onChange={(fontValue) => updateStyleSettings({ selectedFont: fontValue })}
                      isDark={isDark}
                      isStudioUser={true}
                    />
                    
                    {/* Custom Font Upload Section - Shows when Custom Font is selected */}
                    {styleSettings.selectedFont === 'custom' && (
                      <div className={`mt-3 p-4 rounded-lg ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                        {/* DaFont Link */}
                        <div className="flex items-center justify-between mb-3">
                          <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            Need a font?
                          </span>
                          <a 
                            href="https://www.dafont.com/" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90 transition-opacity"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Browse DaFont
                          </a>
                        </div>

                        {/* Current Font Status */}
                        {project?.custom_font_url && (
                          <div className={`mb-3 p-2 rounded-lg ${isDark ? 'bg-green-500/10 border border-green-500/30' : 'bg-green-50 border border-green-200'}`}>
                            <p className={`text-sm flex items-center gap-1 ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                              <Check className="w-4 h-4" /> <span className="font-medium">{project.custom_font_name || 'CustomFont'}</span> is active
                            </p>
                          </div>
                        )}

                        {/* Upload Box */}
                        <div>
                          <label className={`block text-xs mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Upload Custom Font (.ttf, .otf, .woff, .woff2)
                          </label>
                          <label 
                            className={`flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                              customFontUploading 
                                ? 'opacity-50 cursor-wait' 
                                : isDark 
                                  ? 'border-white/20 hover:border-cyan-500/50 hover:bg-white/5' 
                                  : 'border-gray-300 hover:border-cyan-500 hover:bg-cyan-50'
                            }`}
                          >
                            {customFontUploading ? (
                              <>
                                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-2" />
                                <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                  Uploading font...
                                </span>
                              </>
                            ) : (
                              <>
                                <Upload className={`w-8 h-8 mb-2 ${isDark ? 'text-gray-400' : 'text-gray-400'}`} />
                                <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                  {project?.custom_font_url ? 'Upload New Font' : 'Click to Upload Font'}
                                </span>
                                <span className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                  Max 5MB
                                </span>
                              </>
                            )}
                            <input 
                              type="file" 
                              accept=".ttf,.otf,.woff,.woff2" 
                              onChange={handleCustomFontUpload}
                              disabled={customFontUploading}
                              className="hidden" 
                            />
                          </label>
                          
                          {/* Error Message */}
                          {customFontError && (
                            <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                              <AlertCircle className="w-4 h-4" />
                              {customFontError}
                            </p>
                          )}
                        </div>

                        {/* Tip */}
                        <p className={`mt-3 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          Tip: Download a .ttf or .otf file from DaFont, then upload it here
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Font Size */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Font Size
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {FONT_SIZE_OPTIONS.map(size => (
                        <button
                          key={size.value}
                          onClick={() => updateStyleSettings({ fontSize: size.value })}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                            styleSettings.fontSize === size.value
                              ? 'bg-cyan-500 text-white'
                              : isDark ? 'bg-white/10 text-gray-300 hover:bg-white/20' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {size.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Colors Section */}
                  <div>
                    <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Text Colors
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Text Color */}
                      <div>
                        <label className={`block text-xs mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Unsung Text
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={styleSettings.textColor}
                            onChange={(e) => updateStyleSettings({ textColor: e.target.value })}
                            className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent"
                          />
                          <input
                            type="text"
                            value={styleSettings.textColor}
                            onChange={(e) => updateStyleSettings({ textColor: e.target.value })}
                            className={`flex-1 px-2 py-1.5 text-xs rounded-lg ${isDark ? 'bg-white/10 text-white border-white/10' : 'bg-gray-100 text-gray-900 border-gray-200'} border`}
                          />
                        </div>
                      </div>

                      {/* Highlight/Sung Color */}
                      <div>
                        <label className={`block text-xs mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Highlight/Sung
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={styleSettings.sungColor}
                            onChange={(e) => updateStyleSettings({ sungColor: e.target.value })}
                            className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent"
                          />
                          <input
                            type="text"
                            value={styleSettings.sungColor}
                            onChange={(e) => updateStyleSettings({ sungColor: e.target.value })}
                            className={`flex-1 px-2 py-1.5 text-xs rounded-lg ${isDark ? 'bg-white/10 text-white border-white/10' : 'bg-gray-100 text-gray-900 border-gray-200'} border`}
                          />
                        </div>
                      </div>

                      {/* Outline Color */}
                      <div>
                        <label className={`block text-xs mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Text Outline
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={styleSettings.outlineColor}
                            onChange={(e) => updateStyleSettings({ outlineColor: e.target.value })}
                            className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent"
                          />
                          <input
                            type="text"
                            value={styleSettings.outlineColor}
                            onChange={(e) => updateStyleSettings({ outlineColor: e.target.value })}
                            className={`flex-1 px-2 py-1.5 text-xs rounded-lg ${isDark ? 'bg-white/10 text-white border-white/10' : 'bg-gray-100 text-gray-900 border-gray-200'} border`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Duet Mode Colors (if enabled) */}
                  {isDuetMode && (
                    <div>
                      <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Duet Mode Colors
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className={`block text-xs mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Singer 1
                          </label>
                          <input
                            type="color"
                            value={duetColors.singer1}
                            onChange={(e) => { setDuetColors(prev => ({ ...prev, singer1: e.target.value })); setHasChanges(true); }}
                            className="w-full h-10 rounded-lg cursor-pointer border-0"
                          />
                        </div>
                        <div>
                          <label className={`block text-xs mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Singer 2
                          </label>
                          <input
                            type="color"
                            value={duetColors.singer2}
                            onChange={(e) => { setDuetColors(prev => ({ ...prev, singer2: e.target.value })); setHasChanges(true); }}
                            className="w-full h-10 rounded-lg cursor-pointer border-0"
                          />
                        </div>
                        <div>
                          <label className={`block text-xs mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Both
                          </label>
                          <input
                            type="color"
                            value={duetColors.both}
                            onChange={(e) => { setDuetColors(prev => ({ ...prev, both: e.target.value })); setHasChanges(true); }}
                            className="w-full h-10 rounded-lg cursor-pointer border-0"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* BRANDING SECTION - Studio Tier */}
                  <div className={`border-t pt-6 ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-400" />
                        <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Branding</h3>
                        <span className="px-2 py-0.5 text-[10px] rounded-full bg-purple-500/20 text-purple-400">
                          Studio
                        </span>
                      </div>
                    </div>

                    {/* Logo/Watermark */}
                    <div className="space-y-4">
                      <div>
                        <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          Logo / Watermark
                        </label>
                        {brandingSettings.logoUrl ? (
                          <div className="flex items-start gap-3">
                            <div className={`relative w-20 h-20 rounded-lg overflow-hidden ${isDark ? 'bg-white/10' : 'bg-gray-100'}`} style={{ backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)', backgroundSize: '10px 10px', backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px' }}>
                              <img src={brandingSettings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                            </div>
                            <div className="flex-1 space-y-2">
                              <button
                                onClick={() => updateBrandingSettings({ logoUrl: null })}
                                className="text-xs text-red-400 hover:text-red-300"
                              >
                                Remove Logo
                              </button>
                              
                              {/* Position Selector */}
                              <div>
                                <label className={`block text-[10px] mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Position</label>
                                <div className="grid grid-cols-3 gap-1 w-24">
                                  {LOGO_POSITION_OPTIONS.map(pos => (
                                    <button
                                      key={pos.value}
                                      onClick={() => updateBrandingSettings({ logoPosition: pos.value })}
                                      className={`w-7 h-7 rounded text-xs flex items-center justify-center transition-all ${
                                        brandingSettings.logoPosition === pos.value
                                          ? 'bg-cyan-500 text-white'
                                          : isDark ? 'bg-white/10 text-gray-400 hover:bg-white/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                      }`}
                                    >
                                      {pos.label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Size Slider */}
                              <div>
                                <label className={`block text-[10px] mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Size: {brandingSettings.logoSize}px</label>
                                <input
                                  type="range"
                                  min="20"
                                  max="150"
                                  value={brandingSettings.logoSize || 50}
                                  onChange={(e) => updateBrandingSettings({ logoSize: parseInt(e.target.value) })}
                                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                                  style={{ background: `linear-gradient(to right, #06b6d4 ${((brandingSettings.logoSize || 50) - 20) / 130 * 100}%, ${isDark ? '#374151' : '#d1d5db'} ${((brandingSettings.logoSize || 50) - 20) / 130 * 100}%)` }}
                                />
                              </div>

                              {/* Opacity Slider */}
                              <div>
                                <label className={`block text-[10px] mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Opacity: {brandingSettings.logoOpacity}%</label>
                                <input
                                  type="range"
                                  min="10"
                                  max="100"
                                  value={brandingSettings.logoOpacity}
                                  onChange={(e) => updateBrandingSettings({ logoOpacity: parseInt(e.target.value) })}
                                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                                  style={{ background: `linear-gradient(to right, #06b6d4 ${brandingSettings.logoOpacity}%, ${isDark ? '#374151' : '#d1d5db'} ${brandingSettings.logoOpacity}%)` }}
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <label className={`flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                            logoUploading ? 'opacity-50 cursor-wait' : isDark ? 'border-white/20 hover:border-purple-500/50 hover:bg-white/5' : 'border-gray-300 hover:border-purple-500 hover:bg-purple-50'
                          }`}>
                            {logoUploading ? (
                              <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                            ) : (
                              <>
                                <Upload className="w-6 h-6 text-gray-400 mb-1" />
                                <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Upload Logo (PNG for transparency)</span>
                              </>
                            )}
                            <input type="file" accept="image/*" onChange={handleLogoUpload} disabled={logoUploading} className="hidden" />
                          </label>
                        )}
                      </div>

                      {/* Start Image */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className={`block text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            Start Image / Intro Overlay
                          </label>
                        </div>
                        {brandingSettings.startImageUrl ? (
                          <div className="space-y-3">
                            <div className="flex items-start gap-3">
                              <div className={`relative w-28 h-16 rounded-lg overflow-hidden ${isDark ? 'bg-white/10' : 'bg-gray-100'}`} style={{ backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)', backgroundSize: '10px 10px', backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px' }}>
                                <img 
                                  src={brandingSettings.startImageUrl} 
                                  alt="Start" 
                                  className="w-full h-full"
                                  style={{ 
                                    objectFit: brandingSettings.startImageFit || 'contain',
                                    opacity: (brandingSettings.startImageOpacity || 100) / 100
                                  }}
                                />
                              </div>
                              <div className="flex-1 space-y-2">
                                <button
                                  onClick={() => updateBrandingSettings({ startImageUrl: null })}
                                  className="text-xs text-red-400 hover:text-red-300"
                                >
                                  Remove
                                </button>
                                
                                {/* Fit Mode */}
                                <div>
                                  <label className={`block text-[10px] mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Fit Mode</label>
                                  <div className="flex gap-1">
                                    {[
                                      { value: 'contain', label: 'Fit', title: 'Show full image (may have bars)' },
                                      { value: 'cover', label: 'Fill', title: 'Fill screen (may crop edges)' },
                                      { value: 'fill', label: 'Stretch', title: 'Stretch to fit (may distort)' },
                                    ].map(mode => (
                                      <button
                                        key={mode.value}
                                        onClick={() => updateBrandingSettings({ startImageFit: mode.value })}
                                        title={mode.title}
                                        className={`px-2 h-6 rounded text-[10px] font-medium transition-all ${
                                          brandingSettings.startImageFit === mode.value
                                            ? 'bg-cyan-500 text-white'
                                            : isDark ? 'bg-white/10 text-gray-400 hover:bg-white/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                      >
                                        {mode.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Opacity Slider */}
                            <div>
                              <label className={`block text-[10px] mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Opacity: {brandingSettings.startImageOpacity || 100}%</label>
                              <input
                                type="range"
                                min="20"
                                max="100"
                                value={brandingSettings.startImageOpacity || 100}
                                onChange={(e) => updateBrandingSettings({ startImageOpacity: parseInt(e.target.value) })}
                                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                                style={{ background: `linear-gradient(to right, #06b6d4 ${(brandingSettings.startImageOpacity || 100) - 20}%, ${isDark ? '#374151' : '#d1d5db'} ${(brandingSettings.startImageOpacity || 100) - 20}%)` }}
                              />
                            </div>
                            
                            {/* Show Title Checkbox */}
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={brandingSettings.startImageShowTitle ?? true}
                                onChange={(e) => updateBrandingSettings({ startImageShowTitle: e.target.checked })}
                                className="w-4 h-4 rounded border-gray-300 text-cyan-500 focus:ring-cyan-500"
                              />
                              <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                Show Artist & Title over image
                              </span>
                            </label>
                          </div>
                        ) : (
                          <label className={`flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                            startImageUploading ? 'opacity-50 cursor-wait' : isDark ? 'border-white/20 hover:border-purple-500/50 hover:bg-white/5' : 'border-gray-300 hover:border-purple-500 hover:bg-purple-50'
                          }`}>
                            {startImageUploading ? (
                              <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                            ) : (
                              <>
                                <Image className="w-6 h-6 text-gray-400 mb-1" />
                                <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Upload Start Image</span>
                                <span className={`text-[10px] mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                  {layoutSettings.aspectRatio === '16:9' ? 'Recommended: 1920x1080px' : 
                                   layoutSettings.aspectRatio === '9:16' ? 'Recommended: 1080x1920px' : 
                                   layoutSettings.aspectRatio === '4:3' ? 'Recommended: 1440x1080px' : 
                                   'PNG for transparency'}
                                </span>
                              </>
                            )}
                            <input type="file" accept="image/*" onChange={handleStartImageUpload} disabled={startImageUploading} className="hidden" />
                          </label>
                        )}
                        <p className={`text-[10px] mt-1.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          Displays during the intro before lyrics begin
                        </p>
                      </div>

                      {/* Outro Message */}
                      <div>
                        <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          Outro Message
                        </label>
                        <textarea
                          value={brandingSettings.outroText}
                          onChange={(e) => updateBrandingSettings({ outroText: e.target.value })}
                          placeholder="Thanks for watching! Subscribe for more..."
                          maxLength={150}
                          rows={2}
                          className={`w-full px-3 py-2 rounded-lg text-sm border resize-none ${isDark ? 'bg-white/10 border-white/10 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`}
                        />
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Duration:</span>
                            {[2, 3, 4, 5].map(sec => (
                              <button
                                key={sec}
                                onClick={() => updateBrandingSettings({ outroDuration: sec })}
                                className={`w-6 h-5 rounded text-[10px] font-medium transition-all ${
                                  brandingSettings.outroDuration === sec
                                    ? 'bg-cyan-500 text-white'
                                    : isDark ? 'bg-white/10 text-gray-400 hover:bg-white/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                              >
                                {sec}s
                              </button>
                            ))}
                          </div>
                          <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {brandingSettings.outroText.length}/150
                          </span>
                        </div>
                      </div>

                      {/* Branding Error */}
                      {brandingError && (
                        <div className={`p-2 rounded-lg ${isDark ? 'bg-red-500/10 border border-red-500/30' : 'bg-red-50 border border-red-200'}`}>
                          <p className="text-xs text-red-400 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {brandingError}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Preview Hint */}
                  <div className={`p-3 rounded-lg ${isDark ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-cyan-50 border border-cyan-200'}`}>
                    <p className={`text-xs ${isDark ? 'text-cyan-400' : 'text-cyan-700'}`}>
                      Tip: Changes are previewed in real-time above. Click Save to keep your changes.
                    </p>
                  </div>
                </div>
              )}

              {/* BACKGROUND TAB - V11 Implementation */}
              {activeTab === 'background' && (
                <div className="p-4 space-y-6 max-h-[500px] overflow-y-auto">
                  {/* Background Type Selector */}
                  <div>
                    <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Background Type
                    </label>
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        { value: 'color', label: 'Color', icon: Palette },
                        { value: 'gradient', label: 'Gradient', icon: Sparkles },
                        { value: 'image', label: 'Image', icon: Image },
                        { value: 'video', label: 'Video', icon: Video },
                        { value: 'custom-video', label: 'Custom', icon: Upload },
                      ].map(type => (
                        <button
                          key={type.value}
                          onClick={() => updateBgSettings({ bgType: type.value })}
                          className={`flex flex-col items-center gap-1 p-3 rounded-lg text-xs font-medium transition-all ${
                            bgSettings.bgType === type.value
                              ? 'bg-cyan-500 text-white'
                              : isDark ? 'bg-white/10 text-gray-300 hover:bg-white/20' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <type.icon className="w-5 h-5" />
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* SOLID COLOR */}
                  {bgSettings.bgType === 'color' && (
                    <div>
                      <label className={`block text-xs mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Background Color
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={bgSettings.bgColor1}
                          onChange={(e) => updateBgSettings({ bgColor1: e.target.value })}
                          className="w-16 h-16 rounded-lg cursor-pointer border-0"
                        />
                        <input
                          type="text"
                          value={bgSettings.bgColor1}
                          onChange={(e) => updateBgSettings({ bgColor1: e.target.value })}
                          className={`flex-1 px-3 py-2 rounded-lg text-sm ${isDark ? 'bg-white/10 text-white border-white/10' : 'bg-gray-100 text-gray-900 border-gray-200'} border`}
                        />
                      </div>
                    </div>
                  )}

                  {/* GRADIENT */}
                  {bgSettings.bgType === 'gradient' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={`block text-xs mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Color 1</label>
                          <input
                            type="color"
                            value={bgSettings.bgColor1}
                            onChange={(e) => updateBgSettings({ bgColor1: e.target.value })}
                            className="w-full h-12 rounded-lg cursor-pointer border-0"
                          />
                        </div>
                        <div>
                          <label className={`block text-xs mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Color 2</label>
                          <input
                            type="color"
                            value={bgSettings.bgColor2}
                            onChange={(e) => updateBgSettings({ bgColor2: e.target.value })}
                            className="w-full h-12 rounded-lg cursor-pointer border-0"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className={`block text-xs mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Direction</label>
                        <select
                          value={bgSettings.gradientDirection}
                          onChange={(e) => updateBgSettings({ gradientDirection: e.target.value })}
                          className={`w-full px-3 py-2 rounded-lg text-sm border ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                          style={{ colorScheme: isDark ? 'dark' : 'light' }}
                        >
                          <option value="to bottom">&#8595; Top to Bottom</option>
                          <option value="to top">&#8593; Bottom to Top</option>
                          <option value="to right">&#8594; Left to Right</option>
                          <option value="to left">&#8592; Right to Left</option>
                          <option value="to bottom right">&#8600; Diagonal Down</option>
                          <option value="to top right">&#8599; Diagonal Up</option>
                        </select>
                      </div>

                      {/* Gradient Preview */}
                      <div 
                        className="h-20 rounded-lg border"
                        style={{ 
                          background: `linear-gradient(${bgSettings.gradientDirection}, ${bgSettings.bgColor1}, ${bgSettings.bgColor2})`,
                          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                        }}
                      />
                    </div>
                  )}

                  {/* IMAGE UPLOAD */}
                  {bgSettings.bgType === 'image' && (
                    <div>
                      <label className={`block text-xs mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Background Image
                      </label>
                      {bgSettings.bgImagePreview ? (
                        <div className="relative">
                          <img 
                            src={bgSettings.bgImagePreview} 
                            alt="Background" 
                            className="w-full h-32 object-cover rounded-lg" 
                          />
                          <button
                            onClick={() => updateBgSettings({ bgImageUrl: null, bgImagePreview: null })}
                            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label className={`flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                          bgImageUploading ? 'opacity-50 cursor-wait' : isDark ? 'border-white/20 hover:border-cyan-500/50 hover:bg-white/5' : 'border-gray-300 hover:border-cyan-500 hover:bg-cyan-50'
                        }`}>
                          {bgImageUploading ? (
                            <>
                              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-2" />
                              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Uploading...</span>
                            </>
                          ) : (
                            <>
                              <Image className="w-8 h-8 text-gray-400 mb-2" />
                              <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Click to upload image</span>
                              <span className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>JPG, PNG up to 10MB</span>
                            </>
                          )}
                          <input type="file" accept="image/*" onChange={handleBgImageUpload} disabled={bgImageUploading} className="hidden" />
                        </label>
                      )}
                      
                      {/* Image Fit Mode - only show when image is uploaded */}
                      {bgSettings.bgImageUrl && (
                        <div className="mt-3">
                          <label className={`block text-xs mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            Image Fit Mode
                          </label>
                          <div className="flex gap-2">
                            {[
                              { value: 'fill', label: 'Fill', desc: 'Fills frame, crops edges' },
                              { value: 'fit', label: 'Fit', desc: 'Shows entire image' },
                              { value: 'stretch', label: 'Stretch', desc: 'Stretches to fill' }
                            ].map(mode => (
                              <button
                                key={mode.value}
                                onClick={() => updateBgSettings({ bgImageFit: mode.value })}
                                className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                                  bgSettings.bgImageFit === mode.value
                                    ? 'bg-cyan-500 text-white'
                                    : isDark
                                      ? 'bg-white/10 text-gray-300 hover:bg-white/20'
                                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                                title={mode.desc}
                              >
                                {mode.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* VIDEO PRESETS */}
                  {bgSettings.bgType === 'video' && (
                    <div className="space-y-4">
                      {/* Category Filter - scrollable row on mobile */}
                      <div className="flex flex-wrap gap-1.5 sm:gap-2">
                        {VIDEO_CATEGORIES.map(cat => (
                          <button
                            key={cat.id}
                            onClick={() => setSelectedVideoCategory(cat.id)}
                            className={`px-3 py-2 sm:py-1.5 rounded-full text-xs font-medium transition-all ${
                              selectedVideoCategory === cat.id
                                ? 'bg-cyan-500 text-white'
                                : isDark ? 'bg-white/10 text-gray-300 hover:bg-white/20' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>

                      {/* Video Grid - 2 cols on mobile, 3 on sm, 4 on md+ */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-2 max-h-72 sm:max-h-56 overflow-y-auto pr-1 -mr-1">
                        {filteredVideoPresets.map(preset => (
                          <button
                            key={preset.id}
                            onClick={() => updateBgSettings({ 
                              bgVideoPreset: preset, 
                              bgVideoPresetFilename: preset.filename,
                              bgCustomVideoUrl: null,
                              bgCustomVideoPreview: null,
                            })}
                            className={`relative aspect-video rounded-xl overflow-hidden border-2 transition-all min-h-[60px] ${
                              bgSettings.bgVideoPreset?.id === preset.id
                                ? 'border-cyan-400 ring-2 ring-cyan-400/50'
                                : isDark ? 'border-white/10 hover:border-white/30' : 'border-gray-200 hover:border-gray-400'
                            }`}
                          >
                            <img
                              src={`${PRESET_BASE_URL}/${preset.filename.replace('.mp4', '-thumb.jpg')}`}
                              alt={preset.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => { e.target.style.background = '#333'; }}
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 py-1.5 sm:py-1">
                              <p className="text-[11px] sm:text-[10px] text-white truncate font-medium">{preset.name}</p>
                            </div>
                            {bgSettings.bgVideoPreset?.id === preset.id && (
                              <div className="absolute top-1.5 right-1.5 sm:top-1 sm:right-1 w-6 h-6 sm:w-5 sm:h-5 bg-cyan-500 rounded-full flex items-center justify-center shadow-lg">
                                <Check className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-white" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* CUSTOM VIDEO UPLOAD */}
                  {bgSettings.bgType === 'custom-video' && (
                    <div>
                      <label className={`block text-xs mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Upload Custom Video Background
                      </label>
                      {bgSettings.bgCustomVideoPreview ? (
                        <div className="relative">
                          <video 
                            src={bgSettings.bgCustomVideoPreview} 
                            className="w-full h-32 object-cover rounded-lg"
                            autoPlay
                            loop
                            muted
                            playsInline
                          />
                          <button
                            onClick={() => updateBgSettings({ bgCustomVideoUrl: null, bgCustomVideoPreview: null })}
                            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label className={`flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                          bgVideoUploading ? 'opacity-50 cursor-wait' : isDark ? 'border-white/20 hover:border-cyan-500/50 hover:bg-white/5' : 'border-gray-300 hover:border-cyan-500 hover:bg-cyan-50'
                        }`}>
                          {bgVideoUploading ? (
                            <>
                              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-2" />
                              <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Uploading video...</span>
                            </>
                          ) : (
                            <>
                              <Video className="w-8 h-8 text-gray-400 mb-2" />
                              <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Click to upload video</span>
                              <span className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>MP4 recommended, up to 50MB</span>
                            </>
                          )}
                          <input type="file" accept="video/*" onChange={handleBgVideoUpload} disabled={bgVideoUploading} className="hidden" />
                        </label>
                      )}
                      
                      <p className={`mt-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        Tip: For best results, use a looping video with 1920x1080 resolution
                      </p>
                    </div>
                  )}

                  {/* Error Message */}
                  {bgUploadError && (
                    <div className={`p-3 rounded-lg ${isDark ? 'bg-red-500/10 border border-red-500/30' : 'bg-red-50 border border-red-200'}`}>
                      <p className="text-sm text-red-400 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        {bgUploadError}
                      </p>
                    </div>
                  )}

                  {/* Preview Hint */}
                  <div className={`p-3 rounded-lg ${isDark ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-cyan-50 border border-cyan-200'}`}>
                    <p className={`text-xs ${isDark ? 'text-cyan-400' : 'text-cyan-700'}`}>
                      Tip: Your background is shown in the preview above. Click Save to keep your changes.
                    </p>
                  </div>
                </div>
              )}

              {/* LAYOUT TAB - V11 Implementation */}
              {activeTab === 'layout' && (
                <div className="p-4 space-y-6 max-h-[500px] overflow-y-auto">
                  {/* Display Mode */}
                  <div>
                    <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Display Mode
                    </label>
                    <div className="space-y-2">
                      {DISPLAY_MODE_OPTIONS.map(mode => (
                        <button
                          key={mode.value}
                          onClick={() => updateLayoutSettings({ displayMode: mode.value })}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
                            layoutSettings.displayMode === mode.value
                              ? 'bg-cyan-500/20 border-2 border-cyan-500'
                              : isDark ? 'bg-white/5 border-2 border-transparent hover:bg-white/10' : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                          }`}
                        >
                          <mode.Icon className={`w-6 h-6 ${layoutSettings.displayMode === mode.value ? 'text-cyan-400' : isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                          <div className="flex-1">
                            <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{mode.label}</p>
                            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{mode.description}</p>
                          </div>
                          {layoutSettings.displayMode === mode.value && (
                            <Check className="w-5 h-5 text-cyan-400" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Lines on Screen - Shows for each mode with appropriate options */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Lines on Screen
                    </label>
                    <div className="flex gap-2">
                      {layoutSettings.displayMode === 'scroll' ? (
                        // Scroll mode: 3-6 lines
                        [3, 4, 5, 6].map(num => (
                          <button
                            key={num}
                            onClick={() => updateLayoutSettings({ linesPerScroll: num })}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                              layoutSettings.linesPerScroll === num
                                ? 'bg-cyan-500 text-white'
                                : isDark ? 'bg-white/10 text-gray-300 hover:bg-white/20' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {num}
                          </button>
                        ))
                      ) : layoutSettings.displayMode === 'page' ? (
                        // Page mode: 4-8 lines
                        [4, 5, 6, 7, 8].map(num => (
                          <button
                            key={num}
                            onClick={() => updateLayoutSettings({ linesPerPage: num })}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                              layoutSettings.linesPerPage === num
                                ? 'bg-cyan-500 text-white'
                                : isDark ? 'bg-white/10 text-gray-300 hover:bg-white/20' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {num}
                          </button>
                        ))
                      ) : (
                        // Overwrite mode: 4-8 lines
                        [4, 5, 6, 7, 8].map(num => (
                          <button
                            key={num}
                            onClick={() => updateLayoutSettings({ linesPerOverwrite: num })}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                              layoutSettings.linesPerOverwrite === num
                                ? 'bg-cyan-500 text-white'
                                : isDark ? 'bg-white/10 text-gray-300 hover:bg-white/20' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {num}
                          </button>
                        ))
                      )}
                    </div>
                    <p className={`text-xs mt-1.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {layoutSettings.displayMode === 'scroll' 
                        ? 'Number of lyric lines visible while scrolling'
                        : layoutSettings.displayMode === 'page'
                        ? 'Number of lyric lines per page'
                        : 'Number of lyric lines visible at once'}
                    </p>
                  </div>

                  {/* Aspect Ratio */}
                  <div>
                    <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Aspect Ratio
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {ASPECT_RATIO_OPTIONS.map(ratio => (
                        <button
                          key={ratio.value}
                          onClick={() => updateLayoutSettings({ aspectRatio: ratio.value })}
                          className={`flex flex-col items-center gap-2 p-4 rounded-lg transition-all ${
                            layoutSettings.aspectRatio === ratio.value
                              ? 'bg-cyan-500/20 border-2 border-cyan-500'
                              : isDark ? 'bg-white/5 border-2 border-transparent hover:bg-white/10' : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                          }`}
                        >
                          <ratio.icon className={`w-8 h-8 ${layoutSettings.aspectRatio === ratio.value ? 'text-cyan-400' : isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                          <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{ratio.label}</span>
                          <span className={`text-[10px] text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{ratio.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Content Options */}
                  <div>
                    <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Content Options
                    </label>
                    <div className="space-y-3">
                      {/* Clean Lyrics Toggle */}
                      <label className={`flex items-center justify-between p-3 rounded-lg cursor-pointer ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-50 hover:bg-gray-100'}`}>
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Clean Lyrics
                          </p>
                          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Replace profanity with ### in rendered video
                          </p>
                        </div>
                        <div 
                          onClick={() => updateLayoutSettings({ cleanVersion: !layoutSettings.cleanVersion })}
                          className={`relative w-12 h-6 rounded-full transition-colors ${layoutSettings.cleanVersion ? 'bg-cyan-500' : isDark ? 'bg-white/20' : 'bg-gray-300'}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${layoutSettings.cleanVersion ? 'translate-x-7' : 'translate-x-1'}`} />
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Timer & Animation Options */}
                  <div>
                    <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Timing & Animations
                    </label>
                    <div className="space-y-3">
                      {/* Emphasize Current Line Toggle */}
                      <label className={`flex items-center justify-between p-3 rounded-lg cursor-pointer ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-50 hover:bg-gray-100'}`}>
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Emphasize Current Line
                          </p>
                          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Make the currently singing line larger than others
                          </p>
                        </div>
                        <div 
                          onClick={() => updateLayoutSettings({ emphasizeCurrentLine: !layoutSettings.emphasizeCurrentLine })}
                          className={`relative w-12 h-6 rounded-full transition-colors ${layoutSettings.emphasizeCurrentLine ? 'bg-cyan-500' : isDark ? 'bg-white/20' : 'bg-gray-300'}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${layoutSettings.emphasizeCurrentLine ? 'translate-x-7' : 'translate-x-1'}`} />
                        </div>
                      </label>
                      {/* Warning when emphasize is ON */}
                      {layoutSettings.emphasizeCurrentLine && (
                        <div className={`flex items-start gap-2 p-3 rounded-lg ${isDark ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-yellow-50 border border-yellow-200'}`}>
                          <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className={`text-xs font-medium ${isDark ? 'text-yellow-400' : 'text-yellow-700'}`}>
                              Line limits reduced
                            </p>
                            <p className={`text-xs mt-0.5 ${isDark ? 'text-yellow-400/70' : 'text-yellow-600'}`}>
                              The current line renders 30% larger. Check the{' '}
                              <button 
                                onClick={() => setActiveTab('timing')} 
                                className="underline font-medium hover:opacity-80"
                              >
                                Line &amp; Word Editor
                              </button>
                              {' '}for any lines that now exceed the limit.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Progress Bar Toggle */}
                      <label className={`flex items-center justify-between p-3 rounded-lg cursor-pointer ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-50 hover:bg-gray-100'}`}>
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Show Progress Bar
                          </p>
                          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Display progress bar during instrumental breaks (5+ seconds)
                          </p>
                        </div>
                        <div 
                          onClick={() => updateLayoutSettings({ showProgressBar: !layoutSettings.showProgressBar })}
                          className={`relative w-12 h-6 rounded-full transition-colors ${layoutSettings.showProgressBar ? 'bg-cyan-500' : isDark ? 'bg-white/20' : 'bg-gray-300'}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${layoutSettings.showProgressBar ? 'translate-x-7' : 'translate-x-1'}`} />
                        </div>
                      </label>

                      {/* Lead-in Bars Toggle */}
                      <label className={`flex items-center justify-between p-3 rounded-lg cursor-pointer ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-50 hover:bg-gray-100'}`}>
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Show Lead-in Bars
                          </p>
                          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Sweep animation 1-2 seconds before each line
                          </p>
                        </div>
                        <div 
                          onClick={() => updateLayoutSettings({ showLeadInBars: !layoutSettings.showLeadInBars })}
                          className={`relative w-12 h-6 rounded-full transition-colors ${layoutSettings.showLeadInBars ? 'bg-cyan-500' : isDark ? 'bg-white/20' : 'bg-gray-300'}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${layoutSettings.showLeadInBars ? 'translate-x-7' : 'translate-x-1'}`} />
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Preview Hint */}
                  <div className={`p-3 rounded-lg ${isDark ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-cyan-50 border border-cyan-200'}`}>
                    <p className={`text-xs ${isDark ? 'text-cyan-400' : 'text-cyan-700'}`}>
                      Tip: Display mode changes will be reflected in your rendered video. Click Save to keep changes.
                    </p>
                  </div>
                </div>
              )}

              {/* EXPORT TAB - V12 Credit-Based System */}
              {activeTab === 'export' && (
                <div className="p-4 space-y-6 max-h-[500px] overflow-y-auto">
                  {/* Video Quality Selection */}
                  <div>
                    <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Video Quality
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {VIDEO_QUALITY_OPTIONS.map(option => (
                        <button
                          key={option.value}
                          onClick={() => updateExportSettings({ videoQuality: option.value })}
                          className={`relative flex flex-col items-center gap-1 p-3 rounded-lg transition-all ${
                            exportSettings.videoQuality === option.value
                              ? 'bg-cyan-500/20 border-2 border-cyan-500'
                              : isDark ? 'bg-white/5 border-2 border-transparent hover:bg-white/10' : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                          }`}
                        >
                          <span className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{option.label}</span>
                          <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{option.resolution}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                            option.value === '4k' 
                              ? 'bg-purple-500/20 text-purple-400' 
                              : 'bg-cyan-500/20 text-cyan-400'
                          }`}>
                            {option.creditsPerMin} cr/min
                          </span>
                          {exportSettings.videoQuality === option.value && (
                            <div className="absolute top-1 right-1">
                              <Check className="w-3 h-3 text-cyan-400" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Export Mode Selection */}
                  <div>
                    <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Export Mode
                    </label>
                    <div className="space-y-2">
                      {EXPORT_MODE_OPTIONS.map(option => {
                        const qualityOption = VIDEO_QUALITY_OPTIONS.find(q => q.value === exportSettings.videoQuality);
                        const creditsPerMin = option.value === 'instant' ? qualityOption?.instantCreditsPerMin : qualityOption?.creditsPerMin;
                        
                        return (
                          <button
                            key={option.value}
                            onClick={() => updateExportSettings({ exportMode: option.value })}
                            className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
                              exportSettings.exportMode === option.value
                                ? option.value === 'instant' 
                                  ? 'bg-amber-500/20 border-2 border-amber-500'
                                  : 'bg-cyan-500/20 border-2 border-cyan-500'
                                : isDark ? 'bg-white/5 border-2 border-transparent hover:bg-white/10' : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                            }`}
                          >
                            <div className={`p-2 rounded-lg ${
                              option.value === 'instant'
                                ? 'bg-amber-500/20'
                                : isDark ? 'bg-cyan-500/20' : 'bg-cyan-100'
                            }`}>
                              <option.icon className={`w-5 h-5 ${option.value === 'instant' ? 'text-amber-400' : 'text-cyan-400'}`} />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{option.label}</p>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                  option.value === 'instant'
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : 'bg-cyan-500/20 text-cyan-400'
                                }`}>
                                  {creditsPerMin} CREDITS / MIN
                                </span>
                              </div>
                              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{option.description}</p>
                            </div>
                            {exportSettings.exportMode === option.value && (
                              <Check className={`w-5 h-5 ${option.value === 'instant' ? 'text-amber-400' : 'text-cyan-400'}`} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Audio Track Selection */}
                  <div>
                    <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Audio Track
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {AUDIO_TRACK_OPTIONS.map(option => (
                        <button
                          key={option.value}
                          onClick={() => updateExportSettings({ audioTrack: option.value })}
                          className={`flex flex-col items-center gap-1 p-3 rounded-lg text-left transition-all ${
                            exportSettings.audioTrack === option.value
                              ? 'bg-cyan-500/20 border-2 border-cyan-500'
                              : isDark ? 'bg-white/5 border-2 border-transparent hover:bg-white/10' : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                          }`}
                        >
                          <span className="text-xl">{option.icon}</span>
                          <span className={`text-xs font-medium text-center ${isDark ? 'text-white' : 'text-gray-900'}`}>{option.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Credit Cost Calculator */}
                  {(() => {
                    const qualityOption = VIDEO_QUALITY_OPTIONS.find(q => q.value === exportSettings.videoQuality);
                    const creditsPerMin = exportSettings.exportMode === 'instant' 
                      ? qualityOption?.instantCreditsPerMin || 2 
                      : qualityOption?.creditsPerMin || 1;
                    const songMinutes = Math.ceil((duration || 180) / 60); // Default 3 min if no duration
                    const totalCredits = creditsPerMin * songMinutes;
                    const userCredits = project?.user_credits || 0; // You'd get this from user profile
                    const hasEnoughCredits = userCredits >= totalCredits;
                    
                    return (
                      <div className={`p-4 rounded-xl ${
                        hasEnoughCredits
                          ? isDark ? 'bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30' : 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200'
                          : isDark ? 'bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30' : 'bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200'
                      }`}>
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-xl ${hasEnoughCredits ? 'bg-green-500/20' : 'bg-amber-500/20'}`}>
                            <Sparkles className={`w-6 h-6 ${hasEnoughCredits ? 'text-green-400' : 'text-amber-400'}`} />
                          </div>
                          <div className="flex-1">
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              {exportSettings.videoQuality.toUpperCase()} {String.fromCharCode(8226)} {songMinutes} min {String.fromCharCode(8226)} {exportSettings.exportMode === 'instant' ? 'Instant' : 'Queue'}
                            </p>
                            <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              This will cost {totalCredits} credits
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Your balance</p>
                            <p className={`text-2xl font-bold ${hasEnoughCredits ? 'text-green-400' : 'text-amber-400'}`}>
                              {userCredits}
                            </p>
                          </div>
                        </div>
                        
                        {!hasEnoughCredits && (
                          <div className="mt-3 pt-3 border-t border-amber-500/30">
                            <Link href="/pricing" className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors">
                              <Plus className="w-4 h-4" />
                              Get More Credits
                            </Link>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Render Button */}
                  <button
                    onClick={handleApproveAndRender}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl text-lg font-semibold bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin" />
                        Starting Render...
                      </>
                    ) : (
                      <>
                        <Download className="w-6 h-6" />
                        Export Video
                      </>
                    )}
                  </button>

                  {/* Render Info */}
                  <div className={`space-y-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    <p className="flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      {exportSettings.exportMode === 'instant' 
                        ? 'Instant mode typically renders in under 2 minutes'
                        : 'Queue mode typically takes 5-15 minutes during busy times'}
                    </p>
                    <p className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3" />
                      You'll receive an email when your video is ready
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* BOTTOM ACTION BAR */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className={`rounded-2xl overflow-hidden ${isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}>
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={resetToOriginal} disabled={!hasChanges} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${hasChanges ? isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700' : 'bg-gray-500/20 text-gray-500 cursor-not-allowed'}`}>
                  <RotateCcw className="w-4 h-4" />Reset
                </button>
                <button onClick={saveChanges} disabled={saving || !hasChanges} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${hasChanges ? 'bg-cyan-500 hover:bg-cyan-600 text-white' : 'bg-gray-500/20 text-gray-500 cursor-not-allowed'}`}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save
                </button>
              </div>
              <button onClick={handleApproveAndRender} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:opacity-90 transition-opacity">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Render
              </button>
            </div>
          </motion.div>

          {/* Spacer so chat bubble doesn't cover action bar on mobile */}
          <div className="h-20 sm:h-0" />

        </main>
      </div>

      {/* Word Context Menu - Right-click options */}
      <WordContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        word={contextMenu.wordIndex !== null ? words[contextMenu.wordIndex] : null}
        wordIndex={contextMenu.wordIndex}
        onClose={closeContextMenu}
        onRename={handleContextMenuRename}
        onAddWordBefore={handleContextMenuAddBefore}
        onAddWordAfter={handleContextMenuAddAfter}
        onDeleteWord={handleContextMenuDelete}
        isDark={isDark}
      />

      {/* V12: Presets Modal */}
      <AnimatePresence>
        {presetModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setPresetModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl ${
                isDark ? 'bg-gray-900 border border-white/10' : 'bg-white border border-gray-200'
              }`}
            >
              {/* Modal Header */}
              <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isDark ? 'bg-amber-500/20' : 'bg-amber-100'}`}>
                    <Bookmark className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Style Presets</h2>
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Save and load your favorite settings</p>
                  </div>
                </div>
                <button
                  onClick={() => setPresetModalOpen(false)}
                  className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Save New Preset Section */}
              <div className={`px-6 py-4 border-b ${isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Save Current Settings as Preset
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="Enter preset name..."
                    className={`flex-1 px-3 py-2 rounded-lg text-sm outline-none transition-all ${
                      isDark 
                        ? 'bg-white/10 border border-white/20 text-white placeholder:text-gray-500 focus:border-amber-500' 
                        : 'bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-amber-500'
                    }`}
                    onKeyDown={(e) => e.key === 'Enter' && savePreset()}
                  />
                  <button
                    onClick={savePreset}
                    disabled={savingPreset || !presetName.trim()}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      savingPreset || !presetName.trim()
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-amber-500 text-white hover:bg-amber-600'
                    }`}
                  >
                    {savingPreset ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Save
                  </button>
                </div>
                {presetError && (
                  <p className="text-xs text-red-500 mt-2">{presetError}</p>
                )}
              </div>

              {/* Saved Presets List */}
              <div className="px-6 py-4 max-h-[300px] overflow-y-auto">
                <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Your Saved Presets ({presets.length})
                </label>
                
                {presetsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                  </div>
                ) : presets.length === 0 ? (
                  <div className={`text-center py-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No presets saved yet</p>
                    <p className="text-xs mt-1">Save your current settings above to create your first preset</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {presets.map(preset => (
                      <div
                        key={preset.id}
                        className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                          isDark 
                            ? 'bg-white/5 hover:bg-white/10 border border-white/10' 
                            : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${isDark ? 'bg-amber-500/20' : 'bg-amber-100'}`}>
                          <Star className="w-4 h-4 text-amber-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {preset.name}
                          </p>
                          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {preset.display_mode} {String.fromCharCode(8226)} {preset.aspect_ratio} {String.fromCharCode(8226)} {preset.font || 'Default font'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => loadPreset(preset)}
                            disabled={loadingPresetId === preset.id}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              loadingPresetId === preset.id
                                ? 'bg-green-500 text-white'
                                : isDark
                                  ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
                                  : 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200'
                            }`}
                          >
                            {loadingPresetId === preset.id ? (
                              <Check className="w-3 h-3" />
                            ) : (
                              'Load'
                            )}
                          </button>
                          <button
                            onClick={() => deletePreset(preset.id)}
                            className={`p-1.5 rounded-lg transition-all ${
                              isDark
                                ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/10'
                                : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                            }`}
                            title="Delete preset"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className={`px-6 py-4 border-t ${isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
                <p className={`text-xs text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  Presets include: Style, Background, Layout, Export settings, and Branding
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}