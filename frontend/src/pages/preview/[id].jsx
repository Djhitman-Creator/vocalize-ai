'use client';

/**
 * Preview/Edit Page - Karatrack Studio (V10.9)
 * 
 * Place this at: frontend/src/pages/preview/[id].jsx
 * 
 * V10.9 MULTI-SELECT:
 * - Shift+Click to select range of words
 * - Ctrl/Cmd+Click to toggle individual words
 * - Ctrl/Cmd+A to select all words
 * - Drag any selected word to move ALL selected
 * - Arrow keys nudge all selected words
 * - Delete/Backspace removes all selected
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
  Volume2, VolumeX, Mic, Music, FileVideo  // Added FileVideo for preview header
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
        if (paintMode !== null) setPaintMode(null);
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
  }, [selectedWordIndices, selectedWordIndex, editingWordIndex, showAddWordModal, paintMode, words, deleteSelectedWords, nudgeSelectedWords, togglePlayback]);
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
  }, [hasChanges, words, isDuetMode, duetColors, id, router]);

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
    return isCurrent ? (project?.sung_color || '#00d4ff') : (project?.text_color || '#ffffff');
  }, [isDuetMode, duetColors, project]);

  const isWordCurrent = useCallback((word) => currentTime >= word.start && currentTime <= word.end, [currentTime]);

  const getHighlightColor = useCallback((wordIndex) => {
    if (isDuetMode && words[wordIndex]?.singer !== undefined) {
      const singer = words[wordIndex].singer;
      if (singer === SINGER.SINGER_1) return duetColors.singer1;
      if (singer === SINGER.SINGER_2) return duetColors.singer2;
      return duetColors.both;
    }
    return project?.sung_color || '#00d4ff';
  }, [isDuetMode, words, duetColors, project]);

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

  const getPreviewBackground = () => {
    if (project.bg_type === 'gradient' || project.use_gradient) {
      return { background: `linear-gradient(${project.gradient_direction || 'to bottom'}, ${project.bg_color_1 || '#1a1a2e'}, ${project.bg_color_2 || '#16213e'})` };
    }
    return { backgroundColor: project.bg_color_1 || '#1a1a2e' };
  };

  // Get video URL - either from custom upload or preset
  const getVideoBackgroundUrl = () => {
    if (project.bg_video_url) {
      return project.bg_video_url;
    }
    if (project.bg_video_preset_filename) {
      return `${PRESET_BASE_URL}/${project.bg_video_preset_filename}`;
    }
    if (project.bg_video_preset) {
      // Fallback: if only preset ID is stored, try to use it as filename
      return `${PRESET_BASE_URL}/${project.bg_video_preset}`;
    }
    return null;
  };

  const videoBackgroundUrl = getVideoBackgroundUrl();

  // currentLyrics is now calculated via useMemo above
  const textColor = project?.text_color || '#ffffff';
  const outlineColor = project?.outline_color || '#000000';
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

          {/* VIDEO PREVIEW - 16:9 Aspect Ratio Centered Container */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl overflow-hidden mb-4 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}>
            {/* Preview Label */}
            <div className={`px-4 py-2 flex items-center justify-between ${isDark ? 'border-b border-white/10' : 'border-b border-gray-200'}`}>
              <div className="flex items-center gap-2">
                <FileVideo className="w-4 h-4 text-cyan-400" />
                <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Video Preview (16:9)</span>
                <span className={`px-2 py-0.5 text-[10px] rounded ${project.display_mode === 'overwrite' ? 'bg-purple-500/20 text-purple-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
                  {project.display_mode === 'overwrite' ? 'Overwrite' : project.display_mode === 'page' ? 'Page' : 'Scroll'}
                </span>
              </div>
              <span className="text-xs text-gray-500">Drag bottom edge to resize</span>
            </div>
            
            {/* 16:9 Container - Centered with proper aspect ratio */}
            <div 
              className={`flex items-center justify-center p-4 ${isDark ? 'bg-black/30' : 'bg-gray-100'}`}
              style={{ minHeight: previewHeight }}
            >
              {/* Actual 16:9 Preview Box */}
              {(() => {
                // Calculate dynamic font sizes based on preview height
                // Base reference: 1080p video height = 1080px, typical font size ~48px
                // Scale proportionally to preview height
                const boxHeight = previewHeight - 32;
                const scaleFactor = boxHeight / 270; // 270px as baseline (small preview)
                const baseFontSize = Math.max(12, Math.min(32, 14 * scaleFactor)); // Clamp between 12-32px
                const currentLineFontSize = Math.max(14, Math.min(40, 18 * scaleFactor));
                const lineGap = Math.max(2, Math.min(12, 4 * scaleFactor));
                const textShadowSize = Math.max(1, Math.min(3, 1.5 * scaleFactor));
                const wordSpacing = Math.max(2, Math.min(8, 3 * scaleFactor));
                
                return (
                  <div 
                    className="relative overflow-hidden rounded-lg shadow-2xl"
                    style={{ 
                      width: `${boxHeight * (16/9)}px`,
                      height: `${boxHeight}px`,
                      maxWidth: '100%',
                      aspectRatio: '16 / 9',
                      ...getPreviewBackground()
                    }}
                  >
                    {/* Background Image */}
                    {project.bg_image_url && (
                      <img 
                        className="absolute inset-0 w-full h-full object-cover opacity-60" 
                        src={project.bg_image_url} 
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
                          color={project?.sung_color || '#00d4ff'}
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
                                  fontFamily: project.custom_font_url ? 'CustomKaraokeFont' : (project.font || 'Arial'),
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
                                  fontFamily: project.custom_font_url ? 'CustomKaraokeFont' : (project.font || 'Arial'),
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
                                      <span key={wordIdx} style={{ color: project?.sung_color || '#00d4ff', textShadow: shadowStyle }}>
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
                                fontFamily: project.custom_font_url ? 'CustomKaraokeFont' : (project.font || 'Arial'),
                                fontSize: `${baseFontSize}px`,
                                color: project?.sung_color || '#00d4ff',
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
                                  fontFamily: project.custom_font_url ? 'CustomKaraokeFont' : (project.font || 'Arial'),
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
                                fontFamily: project.custom_font_url ? 'CustomKaraokeFont' : (project.font || 'Arial'),
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
                    
                    {/* Resolution indicator */}
                    <div className="absolute top-1 left-1 sm:top-2 sm:left-2 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white/60 font-mono">
                      16:9
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

          {/* LINE & WORD EDITOR - Collapsible */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className={`rounded-2xl overflow-hidden mb-4 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}>
            <div onClick={() => setLineEditorExpanded(!lineEditorExpanded)} className={`flex items-center justify-between px-4 py-3 cursor-pointer select-none ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}>
              <div className="flex items-center gap-2">
                {lineEditorExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                <SplitSquareHorizontal className="w-4 h-4 text-cyan-400" />
                <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Line & Word Editor (Rhyme Sync)</span>
              </div>
              <span className="text-xs text-gray-500">{lyricsLines.length} lines &bull; {words.length} words</span>
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
                              </div>
                              <div className={`flex flex-wrap items-center gap-1 p-2 rounded-lg ${lineTooLong ? 'bg-yellow-500/10 border border-yellow-500/30' : isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
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
          </motion.div>

          {/* TIMELINE EDITOR - Collapsible with Duet Mode Toggle */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={`rounded-2xl overflow-hidden mb-4 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}>
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
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedWordIndices.size > 1 && (
                        <span className="text-xs text-cyan-400 font-medium">{selectedWordIndices.size} words selected</span>
                      )}
                      <span className="text-xs text-gray-500 hidden sm:inline">Shift+Click range • Ctrl+Click toggle • Ctrl+A all</span>
                    </div>
                  </div>

                  {/* Timeline with Time Markers */}
                  <div ref={timelineContainerRef} onClick={handleTimelineClick} className={`relative overflow-hidden cursor-crosshair border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`} style={{ height: TIMELINE_HEIGHT }}>
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
                            title={tooltipText}
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
              </button>
            </div>
          </motion.div>

        </main>
      </div>
    </>
  );
}