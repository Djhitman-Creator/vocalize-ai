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
  ArrowLeft, Play, Pause, SkipBack, Music2, Save, RotateCcw,
  ZoomIn, ZoomOut, Users, Check, X, Loader2, AlertCircle,
  CheckCircle, Plus, Trash2, Paintbrush,
  ArrowDown, ArrowUp, Type, SplitSquareHorizontal,
  AlertTriangle, ChevronDown, ChevronRight, GripHorizontal,
  Volume2, VolumeX, Mic, Music, FileVideo,
  Clock, Timer, Minus, MoreHorizontal,
  // V11: Tab icons
  Image, Download, Grid3X3, Palette, Sparkles, Video,
  Monitor, Smartphone, Square, Upload, Lock, Undo2, Redo2,
  ExternalLink
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import AppNavigation from '../../components/AppNavigation';
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

// Preset video backgrounds base URL
const PRESET_BASE_URL = process.env.NEXT_PUBLIC_PRESET_VIDEOS_URL || 'https://pub-71dae0f9e45e4d8e8d1eedd472780341.r2.dev/presets';

// Line length settings
const MAX_WORDS_PER_LINE = 10;

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
  { id: 'timing', label: 'Timing', icon: Clock, mobileLabel: 'ðŸŽµ' },
  { id: 'style', label: 'Style', icon: Type, mobileLabel: 'ðŸŽ¨' },
  { id: 'background', label: 'Background', icon: Image, mobileLabel: 'ðŸ–¼ï¸' },
  { id: 'layout', label: 'Layout', icon: Grid3X3, mobileLabel: 'ðŸ“' },
  { id: 'export', label: 'Export', icon: Download, mobileLabel: 'ðŸ“¤' },
];

// V11: Font options for Style tab
const FONT_OPTIONS = [
  { value: 'arial', label: 'Arial', family: 'Arial, sans-serif' },
  { value: 'roboto', label: 'Roboto', family: '"Roboto", sans-serif' },
  { value: 'poppins', label: 'Poppins', family: '"Poppins", sans-serif' },
  { value: 'montserrat', label: 'Montserrat', family: '"Montserrat", sans-serif' },
  { value: 'oswald', label: 'Oswald', family: '"Oswald", sans-serif' },
  { value: 'playfair', label: 'Playfair Display', family: '"Playfair Display", serif' },
  { value: 'bebas', label: 'Bebas Neue', family: '"Bebas Neue", sans-serif' },
  { value: 'impact', label: 'Impact', family: 'Impact, sans-serif' },
  { value: 'custom', label: 'Custom Font', family: 'CustomKaraokeFont, sans-serif', requiresStudio: true },
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
  { value: 'scroll', label: 'Scroll', description: 'Teleprompter style - lyrics scroll up as you sing', icon: 'ðŸ“œ' },
  { value: 'page', label: 'Page', description: 'Show multiple lines at once, highlight current line', icon: 'ðŸ“„' },
  { value: 'overwrite', label: 'Overwrite', description: 'Single line display, each line replaces the previous', icon: 'âœï¸' },
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
  { value: 'instrumental', label: 'Remove All Vocals', description: 'Karaoke mode - sing along to the music', icon: 'ðŸŽ¤' },
  { value: 'guide', label: 'Guide Vocals', description: 'Vocals reduced by 70% to help you learn the song', icon: 'ðŸŽµ' },
  { value: 'original', label: 'Keep Original', description: 'Full original audio with all vocals', icon: 'ðŸŽ§' },
];

// V11: Video quality options
const VIDEO_QUALITY_OPTIONS = [
  { value: '480p', label: '480p', description: 'SD - Fast render', resolution: '854Ã—480', tier: 'free' },
  { value: '720p', label: '720p', description: 'HD - Good quality', resolution: '1280Ã—720', tier: 'free' },
  { value: '1080p', label: '1080p', description: 'Full HD - Best for YouTube', resolution: '1920Ã—1080', tier: 'pro' },
  { value: '4k', label: '4K', description: 'Ultra HD - Maximum quality', resolution: '3840Ã—2160', tier: 'studio' },
];

// V11: Branding - Logo position options
const LOGO_POSITION_OPTIONS = [
  { value: 'top-left', label: 'â†–', gridArea: '1 / 1' },
  { value: 'top-center', label: 'â†‘', gridArea: '1 / 2' },
  { value: 'top-right', label: 'â†—', gridArea: '1 / 3' },
  { value: 'bottom-left', label: 'â†™', gridArea: '2 / 1' },
  { value: 'bottom-center', label: 'â†“', gridArea: '2 / 2' },
  { value: 'bottom-right', label: 'â†˜', gridArea: '2 / 3' },
];

// V11: Branding - Size options
const SIZE_OPTIONS = [
  { value: 'small', label: 'S', scale: 0.7 },
  { value: 'medium', label: 'M', scale: 1.0 },
  { value: 'large', label: 'L', scale: 1.3 },
];

// ============================================================
// SWEEP WORD COMPONENT
// ============================================================
const SweepWord = ({ word, sweepPercent, color, unsungColor, outlineColor, isActive, isPast, showGlow }) => {
  const baseTextShadow = `1px 1px 2px ${outlineColor}, -1px -1px 2px ${outlineColor}, 1px -1px 2px ${outlineColor}, -1px 1px 2px ${outlineColor}`;
  const glowTextShadow = `0 0 10px ${color}, 0 0 20px ${color}, 1px 1px 2px ${outlineColor}`;

  if (isPast || sweepPercent >= 1) {
    return <span className="mx-1" style={{ color: color, textShadow: baseTextShadow }}>{word}</span>;
  }

  if (sweepPercent <= 0 && !isActive) {
    return <span className="mx-1" style={{ color: unsungColor, textShadow: baseTextShadow }}>{word}</span>;
  }

  const clipPercent = Math.max(0, Math.min(100, sweepPercent * 100));
  const softClipPercent = Math.min(100, clipPercent + 2);

  return (
    <span className="mx-1" style={{ position: 'relative', display: 'inline-block' }}>
      <span style={{ color: unsungColor, textShadow: baseTextShadow }}>{word}</span>
      <span style={{
        position: 'absolute', top: 0, left: 0,
        color: color,
        textShadow: showGlow ? glowTextShadow : baseTextShadow,
        clipPath: `inset(0 ${100 - softClipPercent}% 0 0)`,
        WebkitClipPath: `inset(0 ${100 - softClipPercent}% 0 0)`,
      }}>{word}</span>
    </span>
  );
};

// ============================================================
// SWEEP-IN BAR COMPONENT
// ============================================================
const SweepInBar = ({ progress, color }) => {
  const width = Math.max(0, (1 - progress) * 80);
  const opacity = 0.3 + (progress * 0.4);

  if (width < 2) return null;

  return (
    <div
      style={{
        width: `${width}px`,
        height: '1.2em',
        background: `linear-gradient(to right, transparent, ${color})`,
        opacity: opacity,
        borderRadius: '4px',
        boxShadow: `0 0 15px ${color}40`,
        transition: 'width 50ms linear, opacity 50ms linear',
      }}
    />
  );
};

// ============================================================
// INSTRUMENTAL PROGRESS BAR COMPONENT
// ============================================================
const InstrumentalProgressBar = ({ progress, nextLyrics, color, textColor, outlineColor }) => {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-64 h-2 bg-white/20 rounded-full overflow-hidden">
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
          className="text-lg opacity-40 text-center max-w-md"
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
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onMuteToggle}
        className={`p-1.5 rounded transition-colors ${muted
            ? 'text-red-400 hover:text-red-300'
            : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'
          }`}
        title={muted ? `Unmute ${label}` : `Mute ${label}`}
      >
        {muted ? <VolumeX className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
      </button>
      <div className="flex items-center gap-1.5">
        <span className={`text-xs w-14 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{label}</span>
        <input
          type="range"
          min="0"
          max="100"
          value={muted ? 0 : value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="w-20 h-1.5 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, ${color} ${muted ? 0 : value}%, ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} ${muted ? 0 : value}%)`,
          }}
          title={`${label}: ${value}%`}
        />
        <span className={`text-xs w-8 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{value}%</span>
      </div>
    </div>
  );
};

// ============================================================
// LINE LENGTH WARNING COMPONENT
// ============================================================
const LineLengthWarning = ({ lineIndex, wordCount, charCount }) => (
  <div className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded" title={`Line ${lineIndex + 1} may be too long. Consider splitting it.`}>
    <AlertTriangle className="w-3 h-3" />
    <span>Too long - split this line</span>
  </div>
);

// ============================================================
// WORD DURATION CONTEXT MENU COMPONENT - NEW in V10.10
// ============================================================
const WordDurationContextMenu = ({ 
  isOpen, 
  position, 
  word, 
  wordIndex, 
  onClose, 
  onExtendEnd, 
  onShortenEnd, 
  onExtendStart, 
  onShortenStart,
  onSetCustomDuration,
  isDark 
}) => {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customDuration, setCustomDuration] = useState('');
  const menuRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    const newDuration = parseFloat(customDuration);
    if (!isNaN(newDuration) && newDuration > 0) {
      onSetCustomDuration(wordIndex, newDuration);
      setShowCustomInput(false);
      setCustomDuration('');
      onClose();
    }
  };

  const MenuItem = ({ icon: Icon, label, onClick, danger = false, disabled = false }) => (
    <button
      onClick={() => { onClick(); onClose(); }}
      disabled={disabled}
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors rounded-lg
        ${disabled 
          ? 'opacity-50 cursor-not-allowed' 
          : danger 
            ? 'hover:bg-red-500/20 text-red-400' 
            : isDark 
              ? 'hover:bg-white/10 text-white' 
              : 'hover:bg-gray-100 text-gray-700'
        }`}
    >
      <Icon className="w-4 h-4" />
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
        className={`fixed z-50 min-w-[220px] rounded-xl shadow-xl border overflow-hidden
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
            {word.start.toFixed(2)}s Ã¢â€ â€™ {word.end.toFixed(2)}s
          </div>
        </div>

        {/* Menu items */}
        <div className="p-1">
          {/* Extend End Section */}
          <div className={`px-2 py-1 text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            Extend End (for drawn-out vocals)
          </div>
          <MenuItem icon={Plus} label="Extend +0.1s" onClick={() => onExtendEnd(wordIndex, 0.1)} />
          <MenuItem icon={Plus} label="Extend +0.25s" onClick={() => onExtendEnd(wordIndex, 0.25)} />
          <MenuItem icon={Plus} label="Extend +0.5s" onClick={() => onExtendEnd(wordIndex, 0.5)} />
          <MenuItem icon={Plus} label="Extend +1.0s" onClick={() => onExtendEnd(wordIndex, 1.0)} />
          
          <div className={`my-1 border-t ${isDark ? 'border-white/5' : 'border-gray-100'}`} />

          {/* Shorten End Section */}
          <div className={`px-2 py-1 text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            Shorten End (for quick syllables)
          </div>
          <MenuItem 
            icon={Minus} 
            label="Shorten -0.1s" 
            onClick={() => onShortenEnd(wordIndex, 0.1)} 
            disabled={word.end - word.start <= 0.15}
          />
          <MenuItem 
            icon={Minus} 
            label="Shorten -0.25s" 
            onClick={() => onShortenEnd(wordIndex, 0.25)} 
            disabled={word.end - word.start <= 0.3}
          />
          
          <div className={`my-1 border-t ${isDark ? 'border-white/5' : 'border-gray-100'}`} />

          {/* Adjust Start Section */}
          <div className={`px-2 py-1 text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            Adjust Start Time
          </div>
          <MenuItem 
            icon={Clock} 
            label="Start earlier -0.1s" 
            onClick={() => onShortenStart(wordIndex, 0.1)} 
            disabled={word.start <= 0.1}
          />
          <MenuItem icon={Clock} label="Start later +0.1s" onClick={() => onExtendStart(wordIndex, 0.1)} />
          
          <div className={`my-1 border-t ${isDark ? 'border-white/5' : 'border-gray-100'}`} />

          {/* Custom Duration */}
          {!showCustomInput ? (
            <MenuItem 
              icon={Timer} 
              label="Set custom duration..." 
              onClick={(e) => { e?.stopPropagation?.(); setShowCustomInput(true); setCustomDuration(currentDuration); }}
            />
          ) : (
            <form onSubmit={handleCustomSubmit} className="px-3 py-2">
              <label className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                New duration (seconds):
              </label>
              <div className="flex gap-2 mt-1">
                <input
                  type="number"
                  step="0.01"
                  min="0.05"
                  value={customDuration}
                  onChange={(e) => setCustomDuration(e.target.value)}
                  className={`flex-1 px-2 py-1 text-sm rounded border ${isDark 
                    ? 'bg-white/5 border-white/10 text-white' 
                    : 'bg-gray-50 border-gray-200 text-gray-900'
                  }`}
                  autoFocus
                  onKeyDown={(e) => e.stopPropagation()}
                />
                <button
                  type="submit"
                  className="px-2 py-1 bg-cyan-500 text-white text-sm rounded hover:bg-cyan-600"
                >
                  Set
                </button>
              </div>
            </form>
          )}
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

  // V11: Active tab state
  const [activeTab, setActiveTab] = useState('timing');

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
    logoSize: 'medium', // small, medium, large
    logoOpacity: 80, // 0-100
    // Start Image
    startImageUrl: null,
    startImageDuration: 3, // 1-5 seconds
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
    bgVideoPreset: null,
    bgVideoPresetFilename: null,
    bgCustomVideoUrl: null,
    bgCustomVideoPreview: null,
  });

  // V11: Layout settings state
  const [layoutSettings, setLayoutSettings] = useState({
    displayMode: 'scroll', // 'scroll', 'page', 'overwrite'
    aspectRatio: '16:9', // '16:9', '4:3', '9:16'
    linesPerPage: 4, // 2-6, only for page mode
    showProgressBar: true, // Show progress bar during instrumental breaks
    showCountdown: true, // Show countdown dots before lyrics start
    showLeadInBars: true, // Show lead-in sweep bars before each line
  });

  // V11: Update layout settings helper
  const updateLayoutSettings = useCallback((updates) => {
    setLayoutSettings(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  }, []);

  // V11: Export settings state
  const [exportSettings, setExportSettings] = useState({
    audioTrack: 'instrumental', // 'instrumental', 'backing', 'original'
    videoQuality: '720p', // '480p', '720p', '1080p', '4k'
  });

  // V11: Update export settings helper
  const updateExportSettings = useCallback((updates) => {
    setExportSettings(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  }, []);

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

  // Section collapse state - ALL START COLLAPSED
  const [lineEditorExpanded, setLineEditorExpanded] = useState(false);
  const [timelineEditorExpanded, setTimelineEditorExpanded] = useState(false);

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
  
  // For backwards compatibility - compute single selected index (must be after all useState)
  const selectedWordIndex = selectedWordIndices.size === 1 ? [...selectedWordIndices][0] : null;

  // ============================================================
  // PREVIEW RESIZE HANDLERS
  // ============================================================
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartY.current = e.clientY;
    resizeStartHeight.current = previewHeight;
  }, [previewHeight]);

  useEffect(() => {
    const handleResizeMove = (e) => {
      if (!isResizing) return;
      const deltaY = e.clientY - resizeStartY.current;
      const newHeight = Math.min(MAX_PREVIEW_HEIGHT, Math.max(MIN_PREVIEW_HEIGHT, resizeStartHeight.current + deltaY));
      setPreviewHeight(newHeight);
    };

    const handleResizeEnd = () => setIsResizing(false);

    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [isResizing]);

  // ============================================================
  // EDITOR RESIZE HANDLERS
  // ============================================================
  const handleEditorResizeStart = useCallback((e) => {
    e.preventDefault();
    setIsResizingEditor(true);
    editorResizeStartY.current = e.clientY;
    editorResizeStartHeight.current = editorHeight;
  }, [editorHeight]);

  useEffect(() => {
    const handleEditorResizeMove = (e) => {
      if (!isResizingEditor) return;
      const deltaY = e.clientY - editorResizeStartY.current;
      const newHeight = Math.min(500, Math.max(150, editorResizeStartHeight.current + deltaY));
      setEditorHeight(newHeight);
    };

    const handleEditorResizeEnd = () => setIsResizingEditor(false);

    if (isResizingEditor) {
      window.addEventListener('mousemove', handleEditorResizeMove);
      window.addEventListener('mouseup', handleEditorResizeEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleEditorResizeMove);
      window.removeEventListener('mouseup', handleEditorResizeEnd);
    };
  }, [isResizingEditor]);

  // ============================================================
  // VOLUME HANDLERS - NEW in V10.8
  // ============================================================
  // Update instrumental volume when state changes
  useEffect(() => {
    if (instrumentalRef.current) {
      instrumentalRef.current.volume = instrumentalMuted ? 0 : instrumentalVolume / 100;
    }
  }, [instrumentalVolume, instrumentalMuted]);

  // Update vocals volume when state changes
  useEffect(() => {
    if (vocalsRef.current) {
      vocalsRef.current.volume = vocalsMuted ? 0 : vocalsVolume / 100;
      vocalsRef.current.muted = false;  // Remove permanent mute - we control via volume
    }
  }, [vocalsVolume, vocalsMuted]);

  const handleInstrumentalVolumeChange = useCallback((value) => {
    setInstrumentalVolume(value);
    if (value > 0 && instrumentalMuted) {
      setInstrumentalMuted(false);
    }
  }, [instrumentalMuted]);

  const handleVocalsVolumeChange = useCallback((value) => {
    setVocalsVolume(value);
    if (value > 0 && vocalsMuted) {
      setVocalsMuted(false);
    }
  }, [vocalsMuted]);

  const toggleInstrumentalMute = useCallback(() => {
    setInstrumentalMuted(prev => !prev);
  }, []);

  const toggleVocalsMute = useCallback(() => {
    setVocalsMuted(prev => !prev);
    // If unmuting and volume is 0, set to a reasonable default
    if (vocalsMuted && vocalsVolume === 0) {
      setVocalsVolume(50);
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
    if (line.length > MAX_WORDS_PER_LINE) return true;
    const charCount = line.reduce((sum, w) => sum + w.word.length + 1, 0);
    return charCount > 50;
  }, []);

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
  // LOAD PROJECT
  // ============================================================
  useEffect(() => {
    if (!id) return;
    const loadProject = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push('/login'); return; }

        const { data: projectData, error: projectError } = await supabase
          .from('projects').select('*').eq('id', id).eq('user_id', user.id).single();

        if (projectError || !projectData) { setError('Project not found'); return; }

        // Debug: Log custom font info
        console.log('Custom font URL:', projectData.custom_font_url);
        console.log('Custom font name:', projectData.custom_font_name);
        console.log('Font setting:', projectData.font);

        setProject(projectData);
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
          showProgressBar: projectData.show_progress_bar !== false, // default true
          showCountdown: projectData.show_countdown !== false, // default true
          showLeadInBars: projectData.show_lead_in_bars !== false, // default true
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
          logoSize: projectData.logo_size || 'medium',
          logoOpacity: projectData.logo_opacity ?? 80,
          startImageUrl: projectData.start_image_url || null,
          startImageDuration: projectData.start_image_duration || 3,
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
  // Use requestAnimationFrame for smooth visual updates
  // Read directly from audio.currentTime each frame
  // Use flushSync to bypass React 18's automatic batching for smooth animations

  useEffect(() => {
    let rafId = null;

    const updateTime = () => {
      if (instrumentalRef.current && isPlaying) {
        const audioTime = instrumentalRef.current.currentTime;

        // flushSync forces React to update synchronously, bypassing batching
        // This ensures smooth animations during playback
        flushSync(() => {
          setCurrentTime(audioTime);
        });

        // Keep vocals in sync
        if (vocalsRef.current) {
          const diff = Math.abs(vocalsRef.current.currentTime - audioTime);
          if (diff > 0.1) {
            vocalsRef.current.currentTime = audioTime;
          }
        }

        // Continue the loop
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
      // Apply initial volume
      instrumentalRef.current.volume = instrumentalMuted ? 0 : instrumentalVolume / 100;
    }
  }, [instrumentalVolume, instrumentalMuted]);

  const handleVocalsLoaded = useCallback(() => {
    if (vocalsRef.current) {
      // Apply initial volume - vocals start muted for reference only
      vocalsRef.current.volume = vocalsMuted ? 0 : vocalsVolume / 100;
    }
  }, [vocalsVolume, vocalsMuted]);

  const togglePlayback = useCallback(() => {
    if (!instrumentalRef.current) return;
    if (isPlaying) {
      instrumentalRef.current.pause();
      if (vocalsRef.current) vocalsRef.current.pause();
    } else {
      // Sync time before playing
      if (vocalsRef.current) {
        vocalsRef.current.currentTime = instrumentalRef.current.currentTime;
      }
      instrumentalRef.current.play();
      if (vocalsRef.current) vocalsRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const seekTo = useCallback((time) => {
    const clampedTime = Math.max(0, Math.min(time, duration));
    if (instrumentalRef.current) instrumentalRef.current.currentTime = clampedTime;
    if (vocalsRef.current) vocalsRef.current.currentTime = clampedTime;
    setCurrentTime(clampedTime);
  }, [duration]);

  const restart = useCallback(() => seekTo(0), [seekTo]);

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
        if (contextMenu.isOpen) { setContextMenu(prev => ({ ...prev, isOpen: false })); }
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
  }, [selectedWordIndices, selectedWordIndex, editingWordIndex, showAddWordModal, paintMode, words, deleteSelectedWords, nudgeSelectedWords, togglePlayback, contextMenu.isOpen]);
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

  const handleTimelineWordMouseDown = useCallback((index, e) => {
    e.stopPropagation();
    if (paintMode !== null) {
      setIsPainting(true);
      setPaintedIndices(new Set([index]));
      paintWord(index);
      return;
    }

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
    setDragStartX(e.clientX);
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

  // Extend word end time (makes the word last longer)
  const extendWordEnd = useCallback((index, amount) => {
    setWords(prev => {
      const updated = [...prev];
      const word = updated[index];
      updated[index] = { ...word, end: word.end + amount };
      return updated;
    });
    setHasChanges(true);
  }, []);

  // Shorten word end time (makes the word shorter)
  const shortenWordEnd = useCallback((index, amount) => {
    setWords(prev => {
      const updated = [...prev];
      const word = updated[index];
      const newEnd = Math.max(word.start + 0.05, word.end - amount); // Minimum 0.05s duration
      updated[index] = { ...word, end: newEnd };
      return updated;
    });
    setHasChanges(true);
  }, []);

  // Extend word start time (delay when word starts)
  const extendWordStart = useCallback((index, amount) => {
    setWords(prev => {
      const updated = [...prev];
      const word = updated[index];
      const newStart = Math.min(word.end - 0.05, word.start + amount); // Keep minimum duration
      updated[index] = { ...word, start: newStart };
      return updated;
    });
    setHasChanges(true);
  }, []);

  // Shorten word start time (start word earlier)
  const shortenWordStart = useCallback((index, amount) => {
    setWords(prev => {
      const updated = [...prev];
      const word = updated[index];
      const newStart = Math.max(0, word.start - amount);
      updated[index] = { ...word, start: newStart };
      return updated;
    });
    setHasChanges(true);
  }, []);

  // Set custom word duration (keeps start time, adjusts end)
  const setWordCustomDuration = useCallback((index, newDuration) => {
    setWords(prev => {
      const updated = [...prev];
      const word = updated[index];
      updated[index] = { ...word, end: word.start + newDuration };
      return updated;
    });
    setHasChanges(true);
  }, []);

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
  // TIMELINE DRAGGING
  // ============================================================
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging || paintMode !== null) return;
      const deltaX = e.clientX - dragStartX;
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

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        setDragStartTimes({});
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStartX, dragStartTimes, zoom, paintMode]);

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
          bg_video_preset_filename: bgSettings.bgVideoPresetFilename,
          bg_video_url: bgSettings.bgCustomVideoUrl,
          // V11: Layout settings
          display_mode: layoutSettings.displayMode,
          aspect_ratio: layoutSettings.aspectRatio,
          lines_per_page: layoutSettings.linesPerPage,
          show_progress_bar: layoutSettings.showProgressBar,
          show_countdown: layoutSettings.showCountdown,
          show_lead_in_bars: layoutSettings.showLeadInBars,
          // V11: Export settings
          audio_track: exportSettings.audioTrack,
          video_quality: exportSettings.videoQuality,
          // V11: Branding settings
          logo_url: brandingSettings.logoUrl,
          logo_position: brandingSettings.logoPosition,
          logo_size: brandingSettings.logoSize,
          logo_opacity: brandingSettings.logoOpacity,
          start_image_url: brandingSettings.startImageUrl,
          start_image_duration: brandingSettings.startImageDuration,
          outro_text: brandingSettings.outroText,
          outro_duration: brandingSettings.outroDuration,
          outro_font_size: brandingSettings.outroFontSize,
        })
        .eq('id', id);

      if (error) throw error;
      setHasChanges(false);
      setOriginalWords(JSON.parse(JSON.stringify(words)));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error('Save error:', err);
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  }, [hasChanges, words, isDuetMode, duetColors, styleSettings, bgSettings, layoutSettings, exportSettings, brandingSettings, id, router]);

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
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
  const LINES_PER_PAGE = 4; // Match handler.py

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

            return {
              prevLine: prevLineText,
              currentLine: currentLineText,
              next: lyricsLines[i + 1] ? lyricsLines[i + 1].map(w => w.word).join(' ') : '',
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

            return {
              prevLine: prevLineText,
              currentLine: null, next: '',
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
              return {
                prevLine: prevPrevLineText,
                currentLine: currentLineText,
                next: line.map(w => w.word).join(' '),
                showSweepIn: false, sweepInProgress: 0,
                showProgressBar: false, progressBarPercent: 0, nextLyricsForProgressBar: ''
              };
            }
          }

          return {
            prevLine: i > 0 ? lyricsLines[i - 1].map(w => w.word).join(' ') : '',
            currentLine: null, next: line.map(w => w.word).join(' '),
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
            const currentLineText = lastLine.map(w => ({
              word: w.word, index: w.globalIndex, start: w.start, end: w.end,
              isActive: false, isPast: true, sweepPercent: 1
            }));
            const prevLineText = lyricsLines.length > 1 ? lyricsLines[lyricsLines.length - 2].map(w => w.word).join(' ') : '';
            return {
              prevLine: prevLineText,
              currentLine: currentLineText, next: '',
              showSweepIn: false, sweepInProgress: 0,
              showProgressBar: false, progressBarPercent: 0, nextLyricsForProgressBar: ''
            };
          }
        }
        return {
          prevLine: '',
          currentLine: null, next: '',
          showSweepIn: false, sweepInProgress: 0,
          showProgressBar: false, progressBarPercent: 0, nextLyricsForProgressBar: ''
        };
      }
    }

    // Build current line with sweep percentages
    const line = lyricsLines[currentLineIdx];
    const currentLineText = line.map(w => {
      let sweepPercent = 0;
      const isActive = currentTime >= w.start && currentTime <= w.end;
      const isPast = currentTime > w.end;

      if (isPast) {
        sweepPercent = 1;
      } else if (isActive) {
        const wordDuration = w.end - w.start;
        if (wordDuration > 0) {
          sweepPercent = (currentTime - w.start) / wordDuration;
        }
      }

      return { word: w.word, index: w.globalIndex, start: w.start, end: w.end, isActive, isPast, sweepPercent };
    });

    const prevLine = currentLineIdx > 0 ? lyricsLines[currentLineIdx - 1] : null;
    const prevText = prevLine ? prevLine.map(w => w.word).join(' ') : '';
    const nextLine = lyricsLines[currentLineIdx + 1];
    const nextText = nextLine ? nextLine.map(w => w.word).join(' ') : '';

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
        const isWordActive = currentTime >= w.start && currentTime <= w.end;
        const isWordPast = currentTime > w.end;
        
        if (isPastLine || isWordPast) {
          sweepPct = 1;
        } else if (isCurrentLine && isWordActive) {
          const dur = w.end - w.start;
          if (dur > 0) sweepPct = (currentTime - w.start) / dur;
        }
        
        return { word: w.word, index: w.globalIndex, start: w.start, end: w.end, isActive: isWordActive, isPast: isWordPast || isPastLine, sweepPercent: sweepPct };
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
      pageLines,
      currentLineIdx,
      showSweepIn: false, sweepInProgress: 0,
      showProgressBar: false, progressBarPercent: 0, nextLyricsForProgressBar: ''
    };
  };

  // Call during render to get fresh values every frame
  const currentLyrics = getCurrentLyricsData();

  const handleTimelineClick = useCallback((e) => {
    if (!timelineContainerRef.current || isDragging) return;
    const rect = timelineContainerRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const clickX = e.clientX - rect.left;
    const offsetFromCenter = clickX - centerX;
    const timeOffset = offsetFromCenter / zoom;
    seekTo(currentTime + timeOffset);
  }, [zoom, currentTime, seekTo, isDragging]);

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
              <Link href="/dashboard" className={`p-2 rounded-xl ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'}`}>
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{project.title}</h1>
                <p className="text-sm text-gray-500">{project.artist_name} - {project.song_title}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
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
              <span className="text-xs text-gray-500">Drag bottom edge to resize</span>
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
                
                const baseFontSize = Math.max(12, Math.min(32, 14 * scaleFactor * fontSizeMultiplier)); // Clamp between 12-32px
                const currentLineFontSize = Math.max(14, Math.min(40, 18 * scaleFactor * fontSizeMultiplier));
                const lineGap = Math.max(2, Math.min(12, 4 * scaleFactor));
                const textShadowSize = Math.max(1, Math.min(3, 1.5 * scaleFactor));
                const wordSpacing = Math.max(2, Math.min(8, 3 * scaleFactor));
                
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
                        className="absolute inset-0 w-full h-full object-cover opacity-60" 
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
                    <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ padding: `${Math.max(8, 16 * scaleFactor)}px` }}>
                      {currentLyrics.showProgressBar ? (
                        <InstrumentalProgressBar
                          progress={currentLyrics.progressBarPercent}
                          nextLyrics={currentLyrics.nextLyricsForProgressBar}
                          color={sungColor}
                          textColor={textColor}
                          outlineColor={outlineColor}
                        />
                      ) : project.display_mode === 'overwrite' ? (
                        /* OVERWRITE MODE - Single line at a time, centered */
                        <div className="flex flex-col items-center justify-center w-full">
                          {currentLyrics.currentLine ? (
                            <div className="text-center w-full">
                              <p 
                                className="font-bold relative inline-flex flex-wrap justify-center" 
                                style={{ 
                                  fontFamily: previewFontFamily,
                                  fontSize: `${currentLineFontSize}px`,
                                  gap: `${wordSpacing}px`
                                }}
                              >
                                {currentLyrics.currentLine.map((wordData, i) => {
                                  const highlightColor = getHighlightColor(wordData.index);
                                  return (
                                    <SweepWord key={i} word={wordData.word} sweepPercent={wordData.sweepPercent} color={highlightColor} unsungColor={unsungColor} outlineColor={outlineColor} isActive={wordData.isActive} isPast={wordData.isPast} showGlow={wordData.isActive} />
                                  );
                                })}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      ) : project.display_mode === 'page' ? (
                        /* PAGE MODE - Show 4 lines per page, all visible at once */
                        <div className="flex flex-col items-center justify-center w-full" style={{ gap: `${lineGap}px` }}>
                          {currentLyrics.pageLines && currentLyrics.pageLines.map((lineData, lineIdx) => (
                            <div key={lineIdx} className="text-center w-full">
                              <p 
                                className="font-bold relative inline-flex flex-wrap justify-center"
                                style={{ 
                                  fontFamily: previewFontFamily,
                                  fontSize: `${baseFontSize}px`,
                                  gap: `${wordSpacing}px`,
                                  opacity: lineData.isCurrentLine ? 1 : lineData.isPastLine ? 0.8 : 0.6
                                }}
                              >
                                {lineData.words.map((wordData, wordIdx) => {
                                  const highlightColor = getHighlightColor(wordData.index);
                                  const shadowStyle = `${textShadowSize}px ${textShadowSize}px ${textShadowSize * 1.5}px ${outlineColor}, -${textShadowSize}px -${textShadowSize}px ${textShadowSize * 1.5}px ${outlineColor}, ${textShadowSize}px -${textShadowSize}px ${textShadowSize * 1.5}px ${outlineColor}, -${textShadowSize}px ${textShadowSize}px ${textShadowSize * 1.5}px ${outlineColor}`;
                                  
                                  if (lineData.isPastLine) {
                                    return (
                                      <span key={wordIdx} style={{ color: sungColor, textShadow: shadowStyle }}>
                                        {wordData.word}
                                      </span>
                                    );
                                  }
                                  if (lineData.isCurrentLine) {
                                    return (
                                      <SweepWord key={wordIdx} word={wordData.word} sweepPercent={wordData.sweepPercent} color={highlightColor} unsungColor={unsungColor} outlineColor={outlineColor} isActive={wordData.isActive} isPast={wordData.isPast} showGlow={wordData.isActive} />
                                    );
                                  }
                                  return (
                                    <span key={wordIdx} style={{ color: textColor, textShadow: shadowStyle }}>
                                      {wordData.word}
                                    </span>
                                  );
                                })}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        /* SCROLL MODE (default) - 3 lines: previous, current, next */
                        <div className="flex flex-col items-center justify-center w-full" style={{ gap: `${lineGap}px` }}>
                          {/* Previous Line - fully highlighted (sung) */}
                          {currentLyrics.prevLine && (
                            <p 
                              className="font-bold text-center w-full"
                              style={{ 
                                fontFamily: previewFontFamily,
                                fontSize: `${baseFontSize}px`,
                                color: sungColor,
                                textShadow: `${textShadowSize}px ${textShadowSize}px ${textShadowSize * 1.5}px ${outlineColor}, -${textShadowSize}px -${textShadowSize}px ${textShadowSize * 1.5}px ${outlineColor}`,
                                opacity: 0.7,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {currentLyrics.prevLine}
                            </p>
                          )}
                          
                          {/* Current Line - with sweep highlighting */}
                          {currentLyrics.currentLine ? (
                            <div className="text-center w-full">
                              <p 
                                className="font-bold relative inline-flex flex-wrap justify-center" 
                                style={{ 
                                  fontFamily: previewFontFamily,
                                  fontSize: `${currentLineFontSize}px`,
                                  gap: `${wordSpacing}px`
                                }}
                              >
                                {currentLyrics.currentLine.map((wordData, i) => {
                                  const highlightColor = getHighlightColor(wordData.index);
                                  return (
                                    <SweepWord key={i} word={wordData.word} sweepPercent={wordData.sweepPercent} color={highlightColor} unsungColor={unsungColor} outlineColor={outlineColor} isActive={wordData.isActive} isPast={wordData.isPast} showGlow={wordData.isActive} />
                                  );
                                })}
                              </p>
                            </div>
                          ) : null}
                          
                          {/* Next Line - upcoming (dimmed) */}
                          {currentLyrics.next && (
                            <p 
                              className="font-bold text-center w-full"
                              style={{ 
                                fontFamily: previewFontFamily,
                                fontSize: `${baseFontSize}px`,
                                color: textColor,
                                textShadow: `${textShadowSize}px ${textShadowSize}px ${textShadowSize * 1.5}px ${outlineColor}, -${textShadowSize}px -${textShadowSize}px ${textShadowSize * 1.5}px ${outlineColor}`,
                                opacity: 0.5,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {currentLyrics.next}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Timestamp overlay */}
                    <div className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 px-1.5 py-0.5 bg-black/60 rounded text-[10px] sm:text-xs text-white/80 font-mono">
                      {formatTime(currentTime)}
                    </div>
                    
                    {/* Resolution indicator - shows current aspect ratio */}
                    <div className="absolute top-1 left-1 sm:top-2 sm:left-2 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white/60 font-mono">
                      {layoutSettings.aspectRatio}
                    </div>
                  </div>
                );
              })()}
            </div>
            
            {/* Resize Handle */}
            <div 
              onMouseDown={handleResizeStart} 
              className={`h-3 cursor-ns-resize flex items-center justify-center ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'} transition-colors`}
            >
              <GripHorizontal className="w-4 h-4 text-gray-400" />
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
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all whitespace-nowrap
                      ${activeTab === tab.id 
                        ? `border-b-2 border-cyan-500 ${isDark ? 'text-cyan-400 bg-white/5' : 'text-cyan-600 bg-cyan-50'}` 
                        : isDark 
                          ? 'text-gray-400 hover:text-white hover:bg-white/5' 
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.mobileLabel}</span>
                  </button>
                ))}
              </div>
              
              {/* Undo/Redo Buttons */}
              <div className={`flex items-center gap-1 px-2 border-l ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                <button
                  onClick={handleUndo}
                  disabled={wordsHistoryIndex <= 0}
                  className={`p-2 rounded-lg transition-all ${
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
                  className={`p-2 rounded-lg transition-all ${
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
            <div className="min-h-[200px]">
              {/* TIMING TAB */}
              {activeTab === 'timing' && (
                <>
                  {/* LINE & WORD EDITOR - Collapsible */}
                  <div className={`${isDark ? 'border-b border-white/10' : 'border-b border-gray-200'}`}>
                    <div onClick={() => setLineEditorExpanded(!lineEditorExpanded)} className={`flex items-center justify-between px-4 py-3 cursor-pointer select-none ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}>
                      <div className="flex items-center gap-2">
                        {lineEditorExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                        <SplitSquareHorizontal className="w-4 h-4 text-cyan-400" />
                        <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Line & Word Editor (Rhyme Sync)</span>
                      </div>
                      <span className="text-xs text-gray-500">{lyricsLines.length} lines | {words.length} words</span>
                    </div>

            <AnimatePresence>
              {lineEditorExpanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
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
                          const lineTooLong = isLineTooLong(line);
                          const charCount = line.reduce((sum, w) => sum + w.word.length + 1, 0);
                          
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
                                {lineTooLong && <LineLengthWarning lineIndex={lineIndex} wordCount={line.length} charCount={charCount} />}
                                
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

                    {/* Right: Original Lyrics */}
                    <div className="p-4 overflow-y-auto" style={{ maxHeight: editorHeight }}>
                      <div className="flex items-center gap-2 mb-2">
                        <Type className="w-4 h-4 text-gray-400" />
                        <span className="text-xs font-medium text-gray-400">Original Lyrics (Reference)</span>
                      </div>
                      <div className={`p-3 rounded-lg text-sm ${isDark ? 'bg-white/5 text-gray-300' : 'bg-gray-50 text-gray-700'}`}>
                        {originalLyricsText ? (
                          <pre className="whitespace-pre-wrap font-sans">{originalLyricsText}</pre>
                        ) : (
                          <p className="text-gray-500 italic">No original lyrics available</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Editor Resize Handle */}
                  <div
                    onMouseDown={handleEditorResizeStart}
                    className={`h-3 cursor-ns-resize flex items-center justify-center ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'}`}
                  >
                    <GripHorizontal className="w-4 h-4 text-gray-400" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* TIMELINE EDITOR - Collapsible with Duet Mode Toggle */}
          <div className={`${isDark ? 'border-t border-white/10' : 'border-t border-gray-200'}`}>
            <div
              onClick={() => setTimelineEditorExpanded(!timelineEditorExpanded)}
              className={`flex items-center justify-between px-4 py-3 cursor-pointer select-none ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
            >
              <div className="flex items-center gap-2">
                {timelineEditorExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                <Music2 className="w-4 h-4 text-cyan-400" />

                <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Timeline Editor</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDuetMode(!isDuetMode);
                  setHasChanges(true);
                  if (!isDuetMode && !timelineEditorExpanded) setTimelineEditorExpanded(true);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isDuetMode ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-red-500/20 text-red-400 border border-red-500/50'}`}
              >
                {isDuetMode ? 'Duet Mode On' : 'Duet Mode Off'}
              </button>
            </div>

            <AnimatePresence>
              {timelineEditorExpanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">

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
                      <span className="text-xs text-gray-500 hidden sm:inline">Scroll wheel to navigate | Right-click for duration</span>
                    </div>
                  </div>

                  {/* Timeline with Time Markers - LCD Style Background */}
                  <div 
                    ref={timelineContainerRef} 
                    onClick={handleTimelineClick}
                    onWheel={(e) => {
                      // Prevent page scrolling
                      e.stopPropagation();
                      // Scroll through timeline with mouse wheel
                      const scrollAmount = e.deltaY > 0 ? 2 : -2; // Scroll 2 seconds per wheel tick
                      const newTime = Math.max(0, Math.min(duration, currentTime + scrollAmount));
                      setCurrentTime(newTime);
                      if (instrumentalRef.current) {
                        instrumentalRef.current.currentTime = newTime;
                      }
                      if (vocalsRef.current) {
                        vocalsRef.current.currentTime = newTime;
                      }
                    }}
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
                      height: TIMELINE_HEIGHT,
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
                        const waveformHeight = TIMELINE_HEIGHT - 30;
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

                    {/* Words on timeline - Direct pixel positioning like V8 */}
                    {(() => {
                      const containerWidth = timelineContainerRef.current?.offsetWidth || 800;
                      const centerX = containerWidth / 2;
                      const wordHeight = 44;

                      return words.map((word, index) => {
                        const wordX = centerX + (word.start - currentTime) * zoom;
                        const wordWidth = Math.max(40, (word.end - word.start) * zoom);

                        // Skip if off-screen
                        if (wordX + wordWidth < -100 || wordX > containerWidth + 100) return null;

                        const isSelected = selectedWordIndices.has(index);
                        const isCurrent = isWordCurrent(word);
                        const wordColor = getWordColor(word, isSelected, isCurrent);

                        // Format timestamp for tooltip - shows exact AssemblyAI timing
                        const formatTimestamp = (seconds) => {
                          const mins = Math.floor(seconds / 60);
                          const secs = (seconds % 60).toFixed(3);
                          return `${mins}:${secs.padStart(6, '0')}`;
                        };
                        const tooltipText = `"${word.word}"\nStart: ${formatTimestamp(word.start)}\nEnd: ${formatTimestamp(word.end)}\nDuration: ${(word.end - word.start).toFixed(3)}s${word.confidence ? `\nConfidence: ${(word.confidence * 100).toFixed(0)}%` : ''}`;

                        return (
                          <motion.div
                            key={index}
                            className="absolute cursor-pointer select-none"
                            style={{
                              left: wordX,
                              width: wordWidth,
                              height: wordHeight,
                              top: (TIMELINE_HEIGHT - 24 - wordHeight) / 2
                            }}
                            onMouseDown={(e) => handleTimelineWordMouseDown(index, e)}
                            onMouseEnter={() => handleTimelineWordMouseEnter(index)}
                            onClick={(e) => { e.stopPropagation(); handleWordClick(index, e); }}
                            onContextMenu={(e) => handleWordContextMenu(index, e)}
                            title={tooltipText + '\n\nRight-click for duration options'}
                          >
                            <div
                              className={`h-full rounded-lg border-2 flex items-center justify-center px-2 overflow-hidden transition-colors ${isSelected
                                  ? 'border-cyan-400 shadow-lg shadow-cyan-500/30 bg-cyan-500/20'
                                  : isCurrent
                                    ? isDark ? 'border-white/40 bg-white/15' : 'border-gray-400 bg-gray-200/50'
                                    : isDark ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-gray-200 bg-gray-100 hover:bg-gray-200'
                                }`}
                              style={{ backdropFilter: 'blur(4px)' }}
                            >
                              <span className="text-xs font-medium truncate" style={{ color: wordColor }}>{word.word}</span>
                            </div>
                            {word.lineBreak && <div className="absolute -right-0.5 top-0 bottom-0 w-1 bg-cyan-500 rounded-full" title="Line break" />}
                            {isDuetMode && word.singer !== undefined && word.singer !== SINGER.BOTH && (
                              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 rounded-full" style={{ backgroundColor: word.singer === SINGER.SINGER_1 ? duetColors.singer1 : duetColors.singer2 }} />
                            )}
                          </motion.div>
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
                        <span className="text-xs font-mono text-cyan-400 w-20" title="Current playback time">
                          {Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(2).padStart(5, '0')}
                        </span>
                        <div onClick={handleProgressClick} className={`flex-1 h-2 rounded-full cursor-pointer overflow-hidden ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}>
                          <div className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full transition-all" style={{ width: `${(currentTime / duration) * 100}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 w-12">{formatTime(duration)}</span>
                      </div>
                    </div>

                    {/* Volume Controls Row - NEW in V10.8 */}
                    <div className={`flex items-center justify-between pt-2 border-t ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
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
                        <div className="flex items-center gap-3">
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
                          <span className={`text-[10px] px-2 py-0.5 rounded ${isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700'}`}>
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
                </motion.div>
              )}
            </AnimatePresence>
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
                    <select
                      value={styleSettings.selectedFont}
                      onChange={(e) => updateStyleSettings({ selectedFont: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg text-sm border focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${isDark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                      style={{ colorScheme: isDark ? 'dark' : 'light' }}
                    >
                      {FONT_OPTIONS.map(font => (
                        <option 
                          key={font.value} 
                          value={font.value} 
                          className={isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}
                        >
                          {font.label} {font.requiresStudio ? '(Studio)' : ''}
                        </option>
                      ))}
                    </select>
                    
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
                            <p className={`text-sm ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                              âœ“ <span className="font-medium">{project.custom_font_name || 'CustomFont'}</span> is active
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
                          ðŸ’¡ Download a .ttf or .otf file from DaFont, then upload it here
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

                              {/* Size Selector */}
                              <div>
                                <label className={`block text-[10px] mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Size</label>
                                <div className="flex gap-1">
                                  {SIZE_OPTIONS.map(size => (
                                    <button
                                      key={size.value}
                                      onClick={() => updateBrandingSettings({ logoSize: size.value })}
                                      className={`w-8 h-6 rounded text-xs font-medium transition-all ${
                                        brandingSettings.logoSize === size.value
                                          ? 'bg-cyan-500 text-white'
                                          : isDark ? 'bg-white/10 text-gray-400 hover:bg-white/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                      }`}
                                    >
                                      {size.label}
                                    </button>
                                  ))}
                                </div>
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
                        <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          Start Image / Intro Overlay
                        </label>
                        {brandingSettings.startImageUrl ? (
                          <div className="flex items-start gap-3">
                            <div className={`relative w-28 h-16 rounded-lg overflow-hidden ${isDark ? 'bg-white/10' : 'bg-gray-100'}`} style={{ backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)', backgroundSize: '10px 10px', backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px' }}>
                              <img src={brandingSettings.startImageUrl} alt="Start" className="w-full h-full object-contain" />
                            </div>
                            <div className="flex-1 space-y-2">
                              <button
                                onClick={() => updateBrandingSettings({ startImageUrl: null })}
                                className="text-xs text-red-400 hover:text-red-300"
                              >
                                Remove
                              </button>
                              
                              {/* Duration */}
                              <div>
                                <label className={`block text-[10px] mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Duration: {brandingSettings.startImageDuration}s</label>
                                <div className="flex gap-1">
                                  {[1, 2, 3, 4, 5].map(sec => (
                                    <button
                                      key={sec}
                                      onClick={() => updateBrandingSettings({ startImageDuration: sec })}
                                      className={`w-7 h-6 rounded text-xs font-medium transition-all ${
                                        brandingSettings.startImageDuration === sec
                                          ? 'bg-cyan-500 text-white'
                                          : isDark ? 'bg-white/10 text-gray-400 hover:bg-white/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                      }`}
                                    >
                                      {sec}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <label className={`flex flex-col items-center justify-center h-20 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                            startImageUploading ? 'opacity-50 cursor-wait' : isDark ? 'border-white/20 hover:border-purple-500/50 hover:bg-white/5' : 'border-gray-300 hover:border-purple-500 hover:bg-purple-50'
                          }`}>
                            {startImageUploading ? (
                              <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                            ) : (
                              <>
                                <Image className="w-6 h-6 text-gray-400 mb-1" />
                                <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Upload Start Image (PNG for transparency)</span>
                              </>
                            )}
                            <input type="file" accept="image/*" onChange={handleStartImageUpload} disabled={startImageUploading} className="hidden" />
                          </label>
                        )}
                        <p className={`text-[10px] mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          Displays over the background at the start of the video
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
                      ðŸ’¡ Changes are previewed in real-time above. Click Save to keep your changes.
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
                          <option value="to bottom">â†“ Top to Bottom</option>
                          <option value="to top">â†‘ Bottom to Top</option>
                          <option value="to right">â†’ Left to Right</option>
                          <option value="to left">â† Right to Left</option>
                          <option value="to bottom right">â†˜ Diagonal Down</option>
                          <option value="to top right">â†— Diagonal Up</option>
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
                    </div>
                  )}

                  {/* VIDEO PRESETS */}
                  {bgSettings.bgType === 'video' && (
                    <div className="space-y-4">
                      {/* Category Filter */}
                      <div className="flex flex-wrap gap-2">
                        {VIDEO_CATEGORIES.map(cat => (
                          <button
                            key={cat.id}
                            onClick={() => setSelectedVideoCategory(cat.id)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                              selectedVideoCategory === cat.id
                                ? 'bg-cyan-500 text-white'
                                : isDark ? 'bg-white/10 text-gray-300 hover:bg-white/20' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>

                      {/* Video Grid */}
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
                        {filteredVideoPresets.map(preset => (
                          <button
                            key={preset.id}
                            onClick={() => updateBgSettings({ 
                              bgVideoPreset: preset, 
                              bgVideoPresetFilename: preset.filename,
                              bgCustomVideoUrl: null,
                              bgCustomVideoPreview: null,
                            })}
                            className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                              bgSettings.bgVideoPreset?.id === preset.id
                                ? 'border-cyan-400 ring-2 ring-cyan-400/50'
                                : 'border-transparent hover:border-white/30'
                            }`}
                          >
                            <img
                              src={`${PRESET_BASE_URL}/${preset.filename.replace('.mp4', '-thumb.jpg')}`}
                              alt={preset.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => { e.target.style.background = '#333'; }}
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 py-1">
                              <p className="text-[10px] text-white truncate">{preset.name}</p>
                            </div>
                            {bgSettings.bgVideoPreset?.id === preset.id && (
                              <div className="absolute top-1 right-1 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center">
                                <Check className="w-3 h-3 text-white" />
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
                        ðŸ’¡ For best results, use a looping video with 1920x1080 resolution
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
                      ðŸ’¡ Your background is shown in the preview above. Click Save to keep your changes.
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
                          <span className="text-2xl">{mode.icon}</span>
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

                  {/* Lines Per Page - Only show for Page mode */}
                  {layoutSettings.displayMode === 'page' && (
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        Lines Per Page
                      </label>
                      <div className="flex gap-2">
                        {LINES_PER_PAGE_OPTIONS.map(num => (
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
                        ))}
                      </div>
                      <p className={`text-xs mt-1.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        Number of lyric lines visible at once
                      </p>
                    </div>
                  )}

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

                  {/* Timer & Animation Options */}
                  <div>
                    <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Timing & Animations
                    </label>
                    <div className="space-y-3">
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

                      {/* Countdown Toggle */}
                      <label className={`flex items-center justify-between p-3 rounded-lg cursor-pointer ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-50 hover:bg-gray-100'}`}>
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Show Countdown
                          </p>
                          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            Animated countdown dots before lyrics begin
                          </p>
                        </div>
                        <div 
                          onClick={() => updateLayoutSettings({ showCountdown: !layoutSettings.showCountdown })}
                          className={`relative w-12 h-6 rounded-full transition-colors ${layoutSettings.showCountdown ? 'bg-cyan-500' : isDark ? 'bg-white/20' : 'bg-gray-300'}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${layoutSettings.showCountdown ? 'translate-x-7' : 'translate-x-1'}`} />
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
                      ðŸ’¡ Display mode changes will be reflected in your rendered video. Click Save to keep changes.
                    </p>
                  </div>
                </div>
              )}

              {/* EXPORT TAB - V11 Implementation */}
              {activeTab === 'export' && (
                <div className="p-4 space-y-6 max-h-[500px] overflow-y-auto">
                  {/* Audio Track Selection */}
                  <div>
                    <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Audio Track
                    </label>
                    <div className="space-y-2">
                      {AUDIO_TRACK_OPTIONS.map(option => (
                        <button
                          key={option.value}
                          onClick={() => updateExportSettings({ audioTrack: option.value })}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
                            exportSettings.audioTrack === option.value
                              ? 'bg-cyan-500/20 border-2 border-cyan-500'
                              : isDark ? 'bg-white/5 border-2 border-transparent hover:bg-white/10' : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                          }`}
                        >
                          <span className="text-2xl">{option.icon}</span>
                          <div className="flex-1">
                            <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{option.label}</p>
                            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{option.description}</p>
                          </div>
                          {exportSettings.audioTrack === option.value && (
                            <Check className="w-5 h-5 text-cyan-400" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Video Quality Selection */}
                  <div>
                    <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Video Quality
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {VIDEO_QUALITY_OPTIONS.map(option => {
                        // Check tier restrictions (simplified - you'd check actual user tier)
                        const isLocked = option.tier === 'pro' || option.tier === 'studio';
                        const tierLabel = option.tier === 'pro' ? 'Pro' : option.tier === 'studio' ? 'Studio' : null;
                        
                        return (
                          <button
                            key={option.value}
                            onClick={() => !isLocked && updateExportSettings({ videoQuality: option.value })}
                            disabled={isLocked}
                            className={`relative flex flex-col items-center gap-1 p-4 rounded-lg transition-all ${
                              exportSettings.videoQuality === option.value
                                ? 'bg-cyan-500/20 border-2 border-cyan-500'
                                : isLocked
                                  ? isDark ? 'bg-white/5 border-2 border-transparent opacity-50 cursor-not-allowed' : 'bg-gray-50 border-2 border-transparent opacity-50 cursor-not-allowed'
                                  : isDark ? 'bg-white/5 border-2 border-transparent hover:bg-white/10' : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                            }`}
                          >
                            {isLocked && (
                              <div className="absolute top-2 right-2">
                                <Lock className="w-4 h-4 text-yellow-500" />
                              </div>
                            )}
                            <span className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{option.label}</span>
                            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{option.resolution}</span>
                            <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{option.description}</span>
                            {tierLabel && (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full ${option.tier === 'studio' ? 'bg-purple-500/20 text-purple-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                {tierLabel}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Credit Cost Info */}
                  <div className={`p-4 rounded-lg ${isDark ? 'bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30' : 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Render Cost</p>
                        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>This will use credits from your balance</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-400">1</p>
                        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>credit</p>
                      </div>
                    </div>
                  </div>

                  {/* Render Info */}
                  <div className={`space-y-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    <p className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Rendering typically takes 2-5 minutes depending on video length
                    </p>
                    <p className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      You'll receive an email notification when your video is ready
                    </p>
                    <p className="flex items-center gap-2">
                      <Download className="w-4 h-4" />
                      Download your finished video from the Dashboard
                    </p>
                  </div>

                  {/* Render Button - Large prominent button */}
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
                        <Sparkles className="w-6 h-6" />
                        Render Video
                      </>
                    )}
                  </button>

                  {/* Tip */}
                  <div className={`p-3 rounded-lg ${isDark ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-cyan-50 border border-cyan-200'}`}>
                    <p className={`text-xs ${isDark ? 'text-cyan-400' : 'text-cyan-700'}`}>
                      ðŸ’¡ Make sure to Save your changes before rendering. All your customizations will be applied to the final video.
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

        </main>
      </div>

      {/* V10.10: Word Duration Context Menu */}
      <WordDurationContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        word={contextMenu.wordIndex !== null ? words[contextMenu.wordIndex] : null}
        wordIndex={contextMenu.wordIndex}
        onClose={closeContextMenu}
        onExtendEnd={extendWordEnd}
        onShortenEnd={shortenWordEnd}
        onExtendStart={extendWordStart}
        onShortenStart={shortenWordStart}
        onSetCustomDuration={setWordCustomDuration}
        isDark={isDark}
      />
    </>
  );
}