'use client';

/**
 * Share Page - View-Only Preview for Karatrack Studio
 * 
 * This page allows anyone with the link to:
 * - View the karaoke video preview
 * - Experiment with ALL settings (fonts, colors, timing, etc.)
 * - Changes are LOCAL ONLY - nothing is saved to the database
 * 
 * Features NOT available:
 * - Save changes
 * - Export/Render
 * - Access to dashboard or other projects
 * 
 * Place this at: frontend/src/pages/share/[id].jsx
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, SkipBack, SkipForward, Music2, RotateCcw,
  ZoomIn, ZoomOut, Users, Check, X, Loader2, AlertCircle,
  Plus, Trash2, Paintbrush,
  ArrowDown, ArrowUp, Type, SplitSquareHorizontal,
  AlertTriangle, ChevronDown, ChevronRight, GripHorizontal,
  Volume2, VolumeX, Mic, Music, FileVideo,
  Clock, Timer, Minus, MoreHorizontal,
  Image, Download, Grid3X3, Palette, Sparkles, Video,
  Monitor, Smartphone, Square, Lock, Eye,
  ExternalLink, ScrollText, FileText, Edit3,
  Bookmark, Star, FolderOpen,
  Maximize2, Minimize2, Info, Rocket
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import SEO from '../../components/SEO';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const SINGER = { BOTH: 0, SINGER_1: 1, SINGER_2: 2 };
const DEFAULT_DUET_COLORS = { singer1: '#00FFFF', singer2: '#FF69B4', both: '#FFD700' };
const PIXELS_PER_SECOND_DEFAULT = 100;

// Preset video backgrounds base URL
const PRESET_BASE_URL = process.env.NEXT_PUBLIC_PRESET_VIDEOS_URL || 'https://pub-71dae0f9e45e4d8e8d1eedd472780341.r2.dev/presets';

// Font options
const FONT_OPTIONS = [
  { value: 'arial', label: 'Arial', family: 'Arial, sans-serif' },
  { value: 'roboto', label: 'Roboto', family: '"Roboto", sans-serif' },
  { value: 'poppins', label: 'Poppins', family: '"Poppins", sans-serif' },
  { value: 'montserrat', label: 'Montserrat', family: '"Montserrat", sans-serif' },
  { value: 'oswald', label: 'Oswald', family: '"Oswald", sans-serif' },
  { value: 'bebas', label: 'Bebas Neue', family: '"Bebas Neue", sans-serif' },
  { value: 'impact', label: 'Impact', family: 'Impact, sans-serif' },
];

const FONT_SIZE_OPTIONS = [
  { value: 'small', label: 'Small', scale: 0.85 },
  { value: 'normal', label: 'Normal', scale: 1.0 },
  { value: 'large', label: 'Large', scale: 1.15 },
  { value: 'xlarge', label: 'X-Large', scale: 1.3 },
];

// Tabs for settings
const TABS = [
  { id: 'style', label: 'Style', icon: Type },
  { id: 'background', label: 'Background', icon: Image },
  { id: 'layout', label: 'Layout', icon: Grid3X3 },
];

// ============================================================
// SWEEP WORD COMPONENT (simplified for share page)
// ============================================================
const SweepWord = ({ word, sweepPercent, color, unsungColor, outlineColor, isActive, isPast }) => {
  const textShadow = `2px 2px 3px ${outlineColor}, -2px -2px 3px ${outlineColor}`;
  const displayColor = isPast ? color : (isActive ? color : unsungColor);
  
  return (
    <span style={{ 
      color: displayColor,
      textShadow,
      transition: 'color 0.1s ease'
    }}>
      {word}
    </span>
  );
};

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function SharePage() {
  const router = useRouter();
  const { id } = router.query;
  const { isDark } = useTheme();

  // Core state
  const [project, setProject] = useState(null);
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [localChanges, setLocalChanges] = useState(false);

  // Audio/Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const instrumentalRef = useRef(null);

  // Volume state
  const [instrumentalVolume, setInstrumentalVolume] = useState(80);
  const [instrumentalMuted, setInstrumentalMuted] = useState(false);

  // Settings state (all LOCAL - changes are not saved)
  const [styleSettings, setStyleSettings] = useState({
    selectedFont: 'arial',
    fontSize: 'normal',
    textColor: '#ffffff',
    sungColor: '#00d4ff',
    outlineColor: '#000000',
  });

  const [bgSettings, setBgSettings] = useState({
    bgType: 'gradient',
    bgColor1: '#1a1a2e',
    bgColor2: '#16213e',
    gradientDirection: 'to bottom',
  });

  const [layoutSettings, setLayoutSettings] = useState({
    displayMode: 'scroll',
    aspectRatio: '16:9',
    linesPerScroll: 4,
  });

  const [activeTab, setActiveTab] = useState('style');
  const [isDuetMode, setIsDuetMode] = useState(false);
  const [duetColors, setDuetColors] = useState(DEFAULT_DUET_COLORS);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ============================================================
  // LOAD PROJECT (public access - no auth required)
  // ============================================================
  useEffect(() => {
    if (!id) return;
    
    const loadProject = async () => {
      try {
        setLoading(true);
        
        // Fetch project without authentication
        // RLS policy allows this if share_enabled is true
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('*')
          .eq('id', id)
          .eq('share_enabled', true)
          .single();

        if (projectError || !projectData) {
          setError('This project is not available for sharing, or the link is invalid.');
          return;
        }

        setProject(projectData);
        setWords(projectData.lyrics_json || []);
        setIsDuetMode(projectData.is_duet_mode || false);
        
        if (projectData.duet_singer1_color) {
          setDuetColors({
            singer1: projectData.duet_singer1_color,
            singer2: projectData.duet_singer2_color || DEFAULT_DUET_COLORS.singer2,
            both: projectData.duet_both_color || DEFAULT_DUET_COLORS.both
          });
        }

        // Initialize settings from project
        setStyleSettings({
          selectedFont: projectData.font || 'arial',
          fontSize: projectData.font_size || 'normal',
          textColor: projectData.text_color || '#ffffff',
          sungColor: projectData.sung_color || '#00d4ff',
          outlineColor: projectData.outline_color || '#000000',
        });

        setBgSettings({
          bgType: projectData.bg_type || 'gradient',
          bgColor1: projectData.bg_color_1 || '#1a1a2e',
          bgColor2: projectData.bg_color_2 || '#16213e',
          gradientDirection: projectData.gradient_direction || 'to bottom',
        });

        setLayoutSettings({
          displayMode: projectData.display_mode || 'scroll',
          aspectRatio: projectData.aspect_ratio || '16:9',
          linesPerScroll: projectData.lines_per_scroll || 4,
        });

      } catch (err) {
        console.error('Load error:', err);
        setError('Failed to load project');
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [id]);

  // ============================================================
  // AUDIO PLAYBACK
  // ============================================================
  useEffect(() => {
    let rafId;
    const updateTime = () => {
      if (instrumentalRef.current && isPlaying) {
        flushSync(() => {
          setCurrentTime(instrumentalRef.current.currentTime);
        });
        rafId = requestAnimationFrame(updateTime);
      }
    };
    if (isPlaying) {
      rafId = requestAnimationFrame(updateTime);
    }
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isPlaying]);

  const handleAudioLoaded = useCallback(() => {
    if (instrumentalRef.current) {
      setDuration(instrumentalRef.current.duration);
      instrumentalRef.current.volume = instrumentalMuted ? 0 : instrumentalVolume / 100;
    }
  }, [instrumentalVolume, instrumentalMuted]);

  const togglePlayback = useCallback(() => {
    if (!instrumentalRef.current) return;
    if (isPlaying) {
      instrumentalRef.current.pause();
    } else {
      instrumentalRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const seekTo = useCallback((time) => {
    const clampedTime = Math.max(0, Math.min(time, duration));
    if (instrumentalRef.current) instrumentalRef.current.currentTime = clampedTime;
    setCurrentTime(clampedTime);
  }, [duration]);

  const restart = useCallback(() => seekTo(0), [seekTo]);

  // ============================================================
  // LYRICS PROCESSING
  // ============================================================
  const lyricsLines = useMemo(() => {
    if (!words.length) return [];
    const lines = [];
    let currentLine = [];
    
    words.forEach((word, idx) => {
      currentLine.push({ ...word, globalIndex: idx });
      if (word.lineBreak) {
        lines.push(currentLine);
        currentLine = [];
      }
    });
    
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
    
    return lines;
  }, [words]);

  // Get current lyrics for preview
  const getCurrentLyricsData = () => {
    if (!lyricsLines.length) return { currentLine: null, upcomingLines: [] };

    let currentLineIdx = -1;
    for (let i = 0; i < lyricsLines.length; i++) {
      const line = lyricsLines[i];
      for (let j = 0; j < line.length; j++) {
        if (currentTime >= line[j].start && currentTime <= line[j].end) {
          currentLineIdx = i;
          break;
        }
      }
      if (currentLineIdx !== -1) break;
    }

    if (currentLineIdx === -1) {
      // Find next line
      for (let i = 0; i < lyricsLines.length; i++) {
        if (lyricsLines[i][0]?.start > currentTime) {
          currentLineIdx = i;
          break;
        }
      }
    }

    if (currentLineIdx === -1) currentLineIdx = lyricsLines.length - 1;

    const currentLineWords = lyricsLines[currentLineIdx]?.map(w => ({
      word: w.word,
      index: w.globalIndex,
      start: w.start,
      end: w.end,
      isActive: currentTime >= w.start && currentTime <= w.end,
      isPast: currentTime > w.end,
      sweepPercent: currentTime > w.end ? 1 : currentTime >= w.start ? (currentTime - w.start) / (w.end - w.start) : 0
    })) || [];

    const upcomingLines = [];
    for (let i = currentLineIdx + 1; i < Math.min(currentLineIdx + 4, lyricsLines.length); i++) {
      upcomingLines.push(lyricsLines[i].map(w => w.word).join(' '));
    }

    return { currentLine: currentLineWords, upcomingLines, currentLineIdx };
  };

  const currentLyrics = getCurrentLyricsData();

  // ============================================================
  // SETTINGS HANDLERS (LOCAL ONLY)
  // ============================================================
  const updateStyleSettings = (updates) => {
    setStyleSettings(prev => ({ ...prev, ...updates }));
    setLocalChanges(true);
  };

  const updateBgSettings = (updates) => {
    setBgSettings(prev => ({ ...prev, ...updates }));
    setLocalChanges(true);
  };

  const updateLayoutSettings = (updates) => {
    setLayoutSettings(prev => ({ ...prev, ...updates }));
    setLocalChanges(true);
  };

  // ============================================================
  // UTILITY
  // ============================================================
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPreviewBackground = () => {
    if (bgSettings.bgType === 'gradient') {
      return { background: `linear-gradient(${bgSettings.gradientDirection}, ${bgSettings.bgColor1}, ${bgSettings.bgColor2})` };
    }
    return { backgroundColor: bgSettings.bgColor1 };
  };

  const previewFontFamily = FONT_OPTIONS.find(f => f.value === styleSettings.selectedFont)?.family || 'Arial, sans-serif';
  const fontSizeMultiplier = FONT_SIZE_OPTIONS.find(opt => opt.value === styleSettings.fontSize)?.scale || 1.0;

  // ============================================================
  // LOADING / ERROR STATES
  // ============================================================
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-animated-dark' : 'bg-animated-light'}`}>
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-cyan-400 mx-auto mb-4" />
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>Loading preview...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-6 p-4 ${isDark ? 'bg-animated-dark' : 'bg-animated-light'}`}>
        <div className={`p-4 rounded-2xl ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className={`text-xl font-bold text-center mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Project Not Available
          </h1>
          <p className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {error || 'This project is not available for sharing.'}
          </p>
        </div>
        <Link 
          href="/"
          className="flex items-center gap-2 px-6 py-3 bg-cyan-500 text-white rounded-xl font-medium hover:bg-cyan-600 transition-colors"
        >
          <Rocket className="w-5 h-5" />
          Create Your Own Karaoke Video
        </Link>
      </div>
    );
  }

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <>
      <SEO 
        title={`${project.song_title || project.title} - Karaoke Preview | Karatrack Studio`}
        description={`Preview karaoke video for ${project.song_title || project.title} by ${project.artist_name || 'Unknown Artist'}`}
      />

      {/* Audio Element */}
      <audio
        ref={instrumentalRef}
        src={project.processed_audio_url}
        onLoadedMetadata={handleAudioLoaded}
        onEnded={() => setIsPlaying(false)}
        preload="auto"
      />

      <div className={`min-h-screen ${isDark ? 'bg-animated-dark' : 'bg-animated-light'}`}>
        {/* Background Effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className={`absolute -top-1/2 -left-1/2 w-full h-full ${isDark ? 'bg-gradient-to-br from-cyan-900/20 via-transparent to-purple-900/20' : 'bg-gradient-to-br from-cyan-100/50 via-transparent to-purple-100/50'} rounded-full blur-3xl`} />
        </div>

        {/* Header */}
        <header className={`sticky top-0 z-40 backdrop-blur-xl ${isDark ? 'bg-gray-900/80 border-b border-white/10' : 'bg-white/80 border-b border-gray-200'}`}>
          <div className="max-w-6xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${isDark ? 'bg-cyan-500/20' : 'bg-cyan-500/10'}`}>
                  <Music2 className="w-5 h-5 text-cyan-500" />
                </div>
                <div>
                  <h1 className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {project.song_title || project.title || 'Untitled'}
                  </h1>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {project.artist_name || 'Unknown Artist'}
                  </p>
                </div>
              </div>

              {/* View-Only Badge */}
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>
                  <Eye className="w-4 h-4" />
                  <span className="text-sm font-medium">View Only</span>
                </div>
                <Link
                  href="/"
                  className="hidden sm:flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-xl text-sm font-medium hover:bg-cyan-600 transition-colors"
                >
                  <Rocket className="w-4 h-4" />
                  Create Your Own
                </Link>
              </div>
            </div>
          </div>
        </header>

        <main className="relative z-10 max-w-6xl mx-auto px-4 py-6">
          {/* Local Changes Notice */}
          {localChanges && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mb-4 flex items-center gap-3 p-3 rounded-xl ${isDark ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-yellow-50 border border-yellow-200'}`}
            >
              <Info className={`w-5 h-5 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} />
              <p className={`text-sm ${isDark ? 'text-yellow-400' : 'text-yellow-700'}`}>
                Your changes are preview-only and won't be saved. Want to create your own?{' '}
                <Link href="/" className="underline font-medium">Sign up free</Link>
              </p>
            </motion.div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Video Preview */}
            <div className="lg:col-span-2">
              <div className={`rounded-2xl overflow-hidden ${isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}>
                {/* Preview Header */}
                <div className={`px-4 py-3 flex items-center justify-between ${isDark ? 'border-b border-white/10' : 'border-b border-gray-200'}`}>
                  <div className="flex items-center gap-2">
                    <FileVideo className="w-4 h-4 text-cyan-400" />
                    <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      Preview ({layoutSettings.aspectRatio})
                    </span>
                  </div>
                  <button
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Video Container */}
                <div className={`p-4 ${isDark ? 'bg-black/30' : 'bg-gray-100'}`}>
                  <div 
                    className="relative mx-auto rounded-lg overflow-hidden shadow-2xl"
                    style={{
                      aspectRatio: layoutSettings.aspectRatio.replace(':', '/'),
                      maxHeight: '400px',
                      ...getPreviewBackground()
                    }}
                  >
                    {/* Lyrics Display */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                      {currentLyrics.currentLine && (
                        <div className="text-center">
                          <p 
                            className="font-bold flex flex-wrap justify-center gap-2"
                            style={{ 
                              fontFamily: previewFontFamily,
                              fontSize: `${24 * fontSizeMultiplier}px`
                            }}
                          >
                            {currentLyrics.currentLine.map((wordData, idx) => (
                              <SweepWord
                                key={idx}
                                word={wordData.word}
                                sweepPercent={wordData.sweepPercent}
                                color={styleSettings.sungColor}
                                unsungColor={styleSettings.textColor}
                                outlineColor={styleSettings.outlineColor}
                                isActive={wordData.isActive}
                                isPast={wordData.isPast}
                              />
                            ))}
                          </p>
                        </div>
                      )}

                      {/* Upcoming Lines */}
                      {currentLyrics.upcomingLines.length > 0 && (
                        <div className="mt-4 text-center space-y-2">
                          {currentLyrics.upcomingLines.slice(0, 2).map((line, idx) => (
                            <p
                              key={idx}
                              className="font-bold opacity-50"
                              style={{
                                fontFamily: previewFontFamily,
                                fontSize: `${18 * fontSizeMultiplier}px`,
                                color: styleSettings.textColor,
                                textShadow: `1px 1px 2px ${styleSettings.outlineColor}`
                              }}
                            >
                              {line}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Playback Controls */}
                <div className={`px-4 py-3 ${isDark ? 'border-t border-white/10' : 'border-t border-gray-200'}`}>
                  {/* Progress Bar */}
                  <div 
                    className="h-2 bg-gray-700 rounded-full mb-3 cursor-pointer overflow-hidden"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const percent = (e.clientX - rect.left) / rect.width;
                      seekTo(percent * duration);
                    }}
                  >
                    <div 
                      className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full transition-all"
                      style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={restart}
                        className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => seekTo(currentTime - 10)}
                        className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
                      >
                        <SkipBack className="w-4 h-4" />
                      </button>
                      <button
                        onClick={togglePlayback}
                        className="p-3 bg-cyan-500 text-white rounded-xl hover:bg-cyan-600 transition-colors"
                      >
                        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                      </button>
                      <button
                        onClick={() => seekTo(currentTime + 10)}
                        className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
                      >
                        <SkipForward className="w-4 h-4" />
                      </button>
                    </div>

                    <div className={`text-sm font-mono ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </div>

                    {/* Volume */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setInstrumentalMuted(!instrumentalMuted)}
                        className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
                      >
                        {instrumentalMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={instrumentalMuted ? 0 : instrumentalVolume}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setInstrumentalVolume(val);
                          setInstrumentalMuted(val === 0);
                          if (instrumentalRef.current) {
                            instrumentalRef.current.volume = val / 100;
                          }
                        }}
                        className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Settings Panel */}
            <div className="lg:col-span-1">
              <div className={`rounded-2xl overflow-hidden ${isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}>
                {/* Tabs */}
                <div className={`flex border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                  {TABS.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium transition-colors ${
                        activeTab === tab.id
                          ? isDark
                            ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/10'
                            : 'text-cyan-600 border-b-2 border-cyan-500 bg-cyan-50'
                          : isDark
                            ? 'text-gray-400 hover:text-white hover:bg-white/5'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <tab.icon className="w-4 h-4" />
                      <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="p-4 space-y-4">
                  {activeTab === 'style' && (
                    <>
                      {/* Font Selection */}
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          Font
                        </label>
                        <select
                          value={styleSettings.selectedFont}
                          onChange={(e) => updateStyleSettings({ selectedFont: e.target.value })}
                          className={`w-full px-3 py-2 rounded-lg text-sm ${isDark ? 'bg-white/10 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border`}
                        >
                          {FONT_OPTIONS.map(font => (
                            <option key={font.value} value={font.value}>{font.label}</option>
                          ))}
                        </select>
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
                              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                                styleSettings.fontSize === size.value
                                  ? 'bg-cyan-500 text-white'
                                  : isDark
                                    ? 'bg-white/10 text-gray-300 hover:bg-white/20'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {size.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Colors */}
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            Text
                          </label>
                          <input
                            type="color"
                            value={styleSettings.textColor}
                            onChange={(e) => updateStyleSettings({ textColor: e.target.value })}
                            className="w-full h-8 rounded-lg cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            Sung
                          </label>
                          <input
                            type="color"
                            value={styleSettings.sungColor}
                            onChange={(e) => updateStyleSettings({ sungColor: e.target.value })}
                            className="w-full h-8 rounded-lg cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            Outline
                          </label>
                          <input
                            type="color"
                            value={styleSettings.outlineColor}
                            onChange={(e) => updateStyleSettings({ outlineColor: e.target.value })}
                            className="w-full h-8 rounded-lg cursor-pointer"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {activeTab === 'background' && (
                    <>
                      {/* Background Type */}
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          Background Type
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {['color', 'gradient'].map(type => (
                            <button
                              key={type}
                              onClick={() => updateBgSettings({ bgType: type })}
                              className={`px-3 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                                bgSettings.bgType === type
                                  ? 'bg-cyan-500 text-white'
                                  : isDark
                                    ? 'bg-white/10 text-gray-300 hover:bg-white/20'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Background Colors */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            Color 1
                          </label>
                          <input
                            type="color"
                            value={bgSettings.bgColor1}
                            onChange={(e) => updateBgSettings({ bgColor1: e.target.value })}
                            className="w-full h-10 rounded-lg cursor-pointer"
                          />
                        </div>
                        {bgSettings.bgType === 'gradient' && (
                          <div>
                            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              Color 2
                            </label>
                            <input
                              type="color"
                              value={bgSettings.bgColor2}
                              onChange={(e) => updateBgSettings({ bgColor2: e.target.value })}
                              className="w-full h-10 rounded-lg cursor-pointer"
                            />
                          </div>
                        )}
                      </div>

                      {/* Gradient Direction */}
                      {bgSettings.bgType === 'gradient' && (
                        <div>
                          <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            Direction
                          </label>
                          <select
                            value={bgSettings.gradientDirection}
                            onChange={(e) => updateBgSettings({ gradientDirection: e.target.value })}
                            className={`w-full px-3 py-2 rounded-lg text-sm ${isDark ? 'bg-white/10 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} border`}
                          >
                            <option value="to bottom">Top to Bottom</option>
                            <option value="to top">Bottom to Top</option>
                            <option value="to right">Left to Right</option>
                            <option value="to left">Right to Left</option>
                            <option value="to bottom right">Diagonal</option>
                          </select>
                        </div>
                      )}
                    </>
                  )}

                  {activeTab === 'layout' && (
                    <>
                      {/* Aspect Ratio */}
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          Aspect Ratio
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {['16:9', '4:3', '9:16'].map(ratio => (
                            <button
                              key={ratio}
                              onClick={() => updateLayoutSettings({ aspectRatio: ratio })}
                              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                                layoutSettings.aspectRatio === ratio
                                  ? 'bg-cyan-500 text-white'
                                  : isDark
                                    ? 'bg-white/10 text-gray-300 hover:bg-white/20'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {ratio === '16:9' && <Monitor className="w-4 h-4" />}
                              {ratio === '4:3' && <Square className="w-4 h-4" />}
                              {ratio === '9:16' && <Smartphone className="w-4 h-4" />}
                              {ratio}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Display Mode */}
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          Display Mode
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {['scroll', 'page', 'overwrite'].map(mode => (
                            <button
                              key={mode}
                              onClick={() => updateLayoutSettings({ displayMode: mode })}
                              className={`px-3 py-2 rounded-lg text-xs font-medium capitalize transition-colors ${
                                layoutSettings.displayMode === mode
                                  ? 'bg-cyan-500 text-white'
                                  : isDark
                                    ? 'bg-white/10 text-gray-300 hover:bg-white/20'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {mode}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* CTA */}
                <div className={`p-4 border-t ${isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
                  <Link
                    href="/"
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-xl font-medium hover:from-cyan-600 hover:to-purple-600 transition-all"
                  >
                    <Rocket className="w-5 h-5" />
                    Create Your Own - Free!
                  </Link>
                  <p className={`text-center text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    Sign up to save your changes and export videos
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className={`mt-12 py-6 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          <p className="text-sm">
            Powered by <a href="https://studio.karatrack.com" className="text-cyan-500 hover:underline">Karatrack Studio</a>
          </p>
        </footer>
      </div>
    </>
  );
}
