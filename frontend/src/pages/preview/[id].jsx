'use client';

/**
 * Preview/Edit Page - Karatrack Studio (V9)
 * 
 * Place this at: frontend/src/pages/preview/[id].jsx
 * 
 * V9 UPDATES - UI REORGANIZATION:
 * - Video Preview: Full width
 * - Line & Word Editor: Collapsible, includes original lyrics side-by-side
 * - Timeline Editor: Collapsible, with Duet Mode toggle button
 * - All sections start collapsed
 * - Word editing moved to Line Editor
 * - Playback controls only visible when Timeline expanded
 * - Save/Reset/Render buttons moved to bottom
 * 
 * V8 FEATURES:
 * - Line break control (rhyme sync)
 * - Line length warning
 * 
 * V7 FEATURES:
 * - Sweep highlighting
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Play, Pause, SkipBack, Mic, Music2, Save, RotateCcw,
  ZoomIn, ZoomOut, Users, Check, X, Edit3, Loader2, AlertCircle,
  CheckCircle, Maximize2, Minimize2, Plus, Trash2, Paintbrush,
  ArrowDown, ArrowUp, Type, Eye, EyeOff, SplitSquareHorizontal,
  AlertTriangle, ChevronDown, ChevronRight
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
const TIMELINE_HEIGHT = 140;
const WORD_HEIGHT = 44;

// Sweep highlighting constants
const SWEEP_IN_LONG_DURATION = 2.0;
const SWEEP_IN_LONG_MIN_GAP = 2.0;
const SWEEP_IN_SHORT_DURATION = 1.0;
const SWEEP_IN_SHORT_MIN_GAP = 1.25;
const INSTRUMENTAL_BREAK_THRESHOLD = 5.0;

// Line length settings
const MAX_LINE_WIDTH_PERCENT = 90;
const MAX_WORDS_PER_LINE = 10;

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
    <div style={{
      width: `${width}px`, height: '1.2em',
      background: `linear-gradient(to right, transparent, ${color})`,
      opacity: opacity, borderRadius: '4px',
      boxShadow: `0 0 15px ${color}40`,
    }} />
  );
};

// ============================================================
// INSTRUMENTAL PROGRESS BAR COMPONENT
// ============================================================
const InstrumentalProgressBar = ({ progress, nextLyrics, color, textColor, outlineColor }) => {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-64 h-2 bg-white/20 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-100" style={{
          width: `${progress * 100}%`,
          background: `linear-gradient(to right, ${color}, ${color}cc)`,
          boxShadow: `0 0 10px ${color}60`,
        }} />
      </div>
      {nextLyrics && (
        <p className="text-lg opacity-60" style={{ color: textColor, textShadow: `1px 1px 2px ${outlineColor}` }}>
          {nextLyrics}
        </p>
      )}
    </div>
  );
};

// ============================================================
// LINE LENGTH WARNING COMPONENT
// ============================================================
const LineLengthWarning = ({ lineIndex, wordCount, charCount }) => (
  <div className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded" title={`Line ${lineIndex + 1} may be too long. Consider splitting it.`}>
    <AlertTriangle className="w-3 h-3" />
    <span>{wordCount} words, {charCount} chars - may run off screen</span>
  </div>
);

// ============================================================
// COLLAPSIBLE SECTION HEADER COMPONENT
// ============================================================
const CollapsibleHeader = ({ title, icon: Icon, isExpanded, onToggle, rightContent }) => {
  const { isDark } = useTheme();
  return (
    <div className={`flex items-center justify-between px-4 py-3 cursor-pointer select-none ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}>
      <div className="flex items-center gap-2" onClick={onToggle}>
        {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        <Icon className="w-4 h-4 text-cyan-400" />
        <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</span>
      </div>
      {rightContent && <div onClick={(e) => e.stopPropagation()}>{rightContent}</div>}
    </div>
  );
};

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function PreviewEditPage() {
  const router = useRouter();
  const { id } = router.query;
  const { isDark, toggleTheme } = useTheme();

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

  // Audio state
  const instrumentalRef = useRef(null);
  const vocalsRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const animationFrameRef = useRef(null);

  // Timeline state
  const timelineContainerRef = useRef(null);
  const [zoom, setZoom] = useState(PIXELS_PER_SECOND_DEFAULT);
  const [selectedWordIndices, setSelectedWordIndices] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTimes, setDragStartTimes] = useState({});

  // Word editing state (for Line Editor)
  const [editingWordIndex, setEditingWordIndex] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [showAddWordModal, setShowAddWordModal] = useState(false);
  const [newWordText, setNewWordText] = useState('');
  const [addWordPosition, setAddWordPosition] = useState('after');

  // Duet mode state
  const [isDuetMode, setIsDuetMode] = useState(false);
  const [duetColors, setDuetColors] = useState(DEFAULT_DUET_COLORS);
  const [paintMode, setPaintMode] = useState(null);
  const [isPainting, setIsPainting] = useState(false);
  const [paintedIndices, setPaintedIndices] = useState(new Set());

  // ============================================================
  // GROUP LYRICS INTO LINES
  // ============================================================
  const groupedLines = useCallback(() => {
    if (!words.length) return [];
    const lines = [];
    let currentLine = [];
    
    words.forEach((word, idx) => {
      currentLine.push({ ...word, index: idx });
      
      if (word.lineBreak) {
        lines.push(currentLine);
        currentLine = [];
      } else {
        const nextWord = words[idx + 1];
        const gap = nextWord ? nextWord.start - word.end : 0;
        if (gap > 0.5 || currentLine.length >= MAX_WORDS_PER_LINE) {
          lines.push(currentLine);
          currentLine = [];
        }
      }
    });
    
    if (currentLine.length > 0) lines.push(currentLine);
    return lines;
  }, [words]);

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
  // LINE BREAK FUNCTIONS (Rhyme Sync)
  // ============================================================
  const addLineBreakAfter = useCallback((globalIndex) => {
    if (globalIndex >= words.length - 1) return;
    setWords(prev => {
      const updated = [...prev];
      updated[globalIndex] = { ...updated[globalIndex], lineBreak: true };
      return updated;
    });
    setHasChanges(true);
  }, [words.length]);

  const removeLineBreakAfter = useCallback((globalIndex) => {
    setWords(prev => {
      const updated = [...prev];
      updated[globalIndex] = { ...updated[globalIndex], lineBreak: false };
      return updated;
    });
    setHasChanges(true);
  }, []);

  // Split line here - add line break BEFORE selected word
  const splitLineHere = useCallback((globalIndex) => {
    if (globalIndex === 0) return;
    addLineBreakAfter(globalIndex - 1);
  }, [addLineBreakAfter]);

  // Move word to next line (add line break before it)
  const moveWordToNextLine = useCallback((globalIndex) => {
    if (globalIndex === 0) return;
    addLineBreakAfter(globalIndex - 1);
  }, [addLineBreakAfter]);

  // Merge with previous line
  const mergeWithPreviousLine = useCallback((lineIndex) => {
    if (lineIndex === 0) return;
    const lines = groupedLines();
    const prevLine = lines[lineIndex - 1];
    if (!prevLine || prevLine.length === 0) return;
    const lastWordOfPrevLine = prevLine[prevLine.length - 1];
    removeLineBreakAfter(lastWordOfPrevLine.index);
  }, [groupedLines, removeLineBreakAfter]);

  // Merge with next line (move first word of next line up)
  const mergeWithNextLine = useCallback((lineIndex) => {
    const lines = groupedLines();
    if (lineIndex >= lines.length - 1) return;
    const currentLine = lines[lineIndex];
    if (!currentLine || currentLine.length === 0) return;
    const lastWordOfCurrentLine = currentLine[currentLine.length - 1];
    removeLineBreakAfter(lastWordOfCurrentLine.index);
  }, [groupedLines, removeLineBreakAfter]);

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

        setProject(projectData);
        const lyricsData = projectData.lyrics_json || [];
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
  }, [id, router]);

  // ============================================================
  // AUDIO PLAYBACK
  // ============================================================
  useEffect(() => {
    const updateTime = () => {
      if (instrumentalRef.current) setCurrentTime(instrumentalRef.current.currentTime);
      animationFrameRef.current = requestAnimationFrame(updateTime);
    };
    if (isPlaying) animationFrameRef.current = requestAnimationFrame(updateTime);
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [isPlaying]);

  const handleAudioLoaded = useCallback(() => {
    if (instrumentalRef.current) setDuration(instrumentalRef.current.duration);
  }, []);

  const togglePlayback = useCallback(() => {
    if (!instrumentalRef.current) return;
    if (isPlaying) {
      instrumentalRef.current.pause();
      if (vocalsRef.current) vocalsRef.current.pause();
    } else {
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
  // KEYBOARD SHORTCUTS
  // ============================================================
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space' && editingWordIndex === null) { e.preventDefault(); togglePlayback(); }
      if (e.code === 'Escape') {
        if (paintMode !== null) setPaintMode(null);
        else if (showAddWordModal) { setShowAddWordModal(false); setNewWordText(''); }
        else if (editingWordIndex !== null) { setEditingWordIndex(null); setEditingText(''); }
        else setSelectedWordIndices([]);
      }
      if ((e.code === 'Delete' || e.code === 'Backspace') && selectedWordIndices.length > 0 && editingWordIndex === null) {
        e.preventDefault();
        deleteSelectedWords();
      }
      if (selectedWordIndices.length > 0 && editingWordIndex === null) {
        if (e.code === 'ArrowLeft') { e.preventDefault(); nudgeSelectedWords(e.shiftKey ? -0.1 : -0.05); }
        if (e.code === 'ArrowRight') { e.preventDefault(); nudgeSelectedWords(e.shiftKey ? 0.1 : 0.05); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedWordIndices, editingWordIndex, isPlaying, showAddWordModal, paintMode]);

  // ============================================================
  // WORD EDITING FUNCTIONS
  // ============================================================
  const handleWordClick = useCallback((index, e) => {
    e?.stopPropagation();
    if (paintMode !== null) return;
    if (e?.shiftKey && selectedWordIndices.length > 0) {
      const lastSelected = selectedWordIndices[selectedWordIndices.length - 1];
      const start = Math.min(lastSelected, index);
      const end = Math.max(lastSelected, index);
      const range = [];
      for (let i = start; i <= end; i++) range.push(i);
      setSelectedWordIndices(range);
    } else if (e?.ctrlKey || e?.metaKey) {
      if (selectedWordIndices.includes(index)) setSelectedWordIndices(selectedWordIndices.filter(i => i !== index));
      else setSelectedWordIndices([...selectedWordIndices, index]);
    } else {
      setSelectedWordIndices([index]);
    }
  }, [selectedWordIndices, paintMode]);

  const handleWordDoubleClick = useCallback((index, e) => {
    e?.stopPropagation();
    if (paintMode !== null) return;
    setEditingWordIndex(index);
    setEditingText(words[index].word);
    setSelectedWordIndices([index]);
  }, [words, paintMode]);

  const saveWordEdit = useCallback(() => {
    if (editingWordIndex === null || !editingText.trim()) return;
    setWords(prev => {
      const updated = [...prev];
      updated[editingWordIndex] = { ...updated[editingWordIndex], word: editingText.trim() };
      return updated;
    });
    setHasChanges(true);
    setEditingWordIndex(null);
    setEditingText('');
  }, [editingWordIndex, editingText]);

  const cancelWordEdit = useCallback(() => {
    setEditingWordIndex(null);
    setEditingText('');
  }, []);

  const nudgeSelectedWords = useCallback((delta) => {
    if (selectedWordIndices.length === 0) return;
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
    if (selectedWordIndices.length === 0) return;
    const confirmMsg = selectedWordIndices.length === 1 
      ? `Delete "${words[selectedWordIndices[0]].word}"?`
      : `Delete ${selectedWordIndices.length} words?`;
    
    if (window.confirm(confirmMsg)) {
      setWords(prev => {
        const sortedIndices = [...selectedWordIndices].sort((a, b) => b - a);
        const updated = [...prev];
        sortedIndices.forEach(index => updated.splice(index, 1));
        return updated;
      });
      setSelectedWordIndices([]);
      setHasChanges(true);
    }
  }, [selectedWordIndices, words]);

  const addNewWord = useCallback(() => {
    if (!newWordText.trim() || selectedWordIndices.length !== 1) return;
    const selectedIndex = selectedWordIndices[0];
    const selectedWord = words[selectedIndex];
    
    if (addWordPosition === 'before') {
      const midPoint = selectedWord.start + (selectedWord.end - selectedWord.start) / 2;
      const newWord = { word: newWordText.trim(), start: selectedWord.start, end: midPoint, confidence: 1.0 };
      setWords(prev => {
        const updated = [...prev];
        updated[selectedIndex] = { ...updated[selectedIndex], start: midPoint };
        updated.splice(selectedIndex, 0, newWord);
        return updated;
      });
    } else {
      const midPoint = selectedWord.start + (selectedWord.end - selectedWord.start) / 2;
      const newWord = { word: newWordText.trim(), start: midPoint, end: selectedWord.end, confidence: 1.0 };
      setWords(prev => {
        const updated = [...prev];
        updated[selectedIndex] = { ...updated[selectedIndex], end: midPoint };
        updated.splice(selectedIndex + 1, 0, newWord);
        return updated;
      });
    }
    
    setShowAddWordModal(false);
    setNewWordText('');
    setSelectedWordIndices([]);
    setHasChanges(true);
  }, [newWordText, selectedWordIndices, words, addWordPosition]);

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
    if (!selectedWordIndices.includes(index)) setSelectedWordIndices([index]);
    setIsDragging(true);
    setDragStartX(e.clientX);
    const startTimes = {};
    const indicesToDrag = selectedWordIndices.includes(index) ? selectedWordIndices : [index];
    indicesToDrag.forEach(i => { startTimes[i] = { start: words[i].start, end: words[i].end }; });
    setDragStartTimes(startTimes);
  }, [selectedWordIndices, words, paintMode, paintWord]);

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
      setSelectedWordIndices([]);
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
  }, [hasChanges, saveChanges, project, words, router, id]);

  // ============================================================
  // UTILITY FUNCTIONS
  // ============================================================
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  const getHighlightColor = (wordIndex) => {
    if (isDuetMode && words[wordIndex]?.singer !== undefined) {
      const singer = words[wordIndex].singer;
      if (singer === SINGER.SINGER_1) return duetColors.singer1;
      if (singer === SINGER.SINGER_2) return duetColors.singer2;
      return duetColors.both;
    }
    return project?.sung_color || '#00d4ff';
  };

  // ============================================================
  // GET CURRENT LYRICS FOR PREVIEW
  // ============================================================
  const getCurrentLyrics = useCallback(() => {
    const lines = groupedLines();
    if (!lines.length) return { 
      currentLine: null, next: '', showSweepIn: false, sweepInProgress: 0,
      showProgressBar: false, progressBarPercent: 0, nextLyricsForProgressBar: ''
    };
    
    let currentLineIdx = -1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (let j = 0; j < line.length; j++) {
        if (currentTime >= line[j].start && currentTime <= line[j].end) {
          currentLineIdx = i;
          break;
        }
      }
      if (currentLineIdx !== -1) break;
    }
    
    if (currentLineIdx === -1) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.length > 0 && line[0].start > currentTime) {
          const firstWordStart = line[0].start;
          const timeUntilLine = firstWordStart - currentTime;
          const prevLineEnd = i === 0 ? 0 : lines[i - 1][lines[i - 1].length - 1].end;
          const gapDuration = firstWordStart - prevLineEnd;
          
          let sweepDuration = 0;
          if (gapDuration >= SWEEP_IN_LONG_MIN_GAP) sweepDuration = SWEEP_IN_LONG_DURATION;
          else if (gapDuration >= SWEEP_IN_SHORT_MIN_GAP) sweepDuration = SWEEP_IN_SHORT_DURATION;
          
          if (sweepDuration > 0 && timeUntilLine <= sweepDuration) {
            const sweepProgress = 1 - (timeUntilLine / sweepDuration);
            const currentLineText = line.map(w => ({
              word: w.word, index: w.index, start: w.start, end: w.end,
              isActive: false, isPast: false, sweepPercent: 0
            }));
            return {
              currentLine: currentLineText,
              next: lines[i + 1] ? lines[i + 1].map(w => w.word).join(' ') : '',
              showSweepIn: true, sweepInProgress: sweepProgress,
              showProgressBar: false, progressBarPercent: 0, nextLyricsForProgressBar: ''
            };
          }
          
          if (i > 0) {
            const prevLine = lines[i - 1];
            const lastWordEnd = prevLine[prevLine.length - 1].end;
            if (currentTime - lastWordEnd <= 2) {
              const currentLineText = prevLine.map(w => ({
                word: w.word, index: w.index, start: w.start, end: w.end,
                isActive: false, isPast: true, sweepPercent: 1
              }));
              return { 
                currentLine: currentLineText, next: line.map(w => w.word).join(' '),
                showSweepIn: false, sweepInProgress: 0,
                showProgressBar: false, progressBarPercent: 0, nextLyricsForProgressBar: ''
              };
            }
          }
          
          return { 
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
    }

    if (currentLineIdx === -1 && lines.length > 0) {
      const lastLine = lines[lines.length - 1];
      const currentLineText = lastLine.map(w => ({
        word: w.word, index: w.index, start: w.start, end: w.end,
        isActive: false, isPast: true, sweepPercent: 1
      }));
      return { 
        currentLine: currentLineText, next: '',
        showSweepIn: false, sweepInProgress: 0,
        showProgressBar: false, progressBarPercent: 0, nextLyricsForProgressBar: ''
      };
    }

    if (currentLineIdx === -1) {
      return { 
        currentLine: null, next: '',
        showSweepIn: false, sweepInProgress: 0,
        showProgressBar: false, progressBarPercent: 0, nextLyricsForProgressBar: ''
      };
    }

    const currentLine = lines[currentLineIdx];
    const currentLineText = currentLine.map(w => {
      const isActive = currentTime >= w.start && currentTime <= w.end;
      const isPast = currentTime > w.end;
      let sweepPercent = 0;
      if (isPast) sweepPercent = 1;
      else if (isActive) {
        const wordDuration = w.end - w.start;
        if (wordDuration > 0) sweepPercent = (currentTime - w.start) / wordDuration;
      }
      return { word: w.word, index: w.index, start: w.start, end: w.end, isActive, isPast, sweepPercent };
    });

    const nextLine = lines[currentLineIdx + 1];
    return { 
      currentLine: currentLineText,
      next: nextLine ? nextLine.map(w => w.word).join(' ') : '',
      showSweepIn: false, sweepInProgress: 0,
      showProgressBar: false, progressBarPercent: 0, nextLyricsForProgressBar: ''
    };
  }, [groupedLines, currentTime]);

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
  // LOADING / ERROR STATES
  // ============================================================
  if (loading) return (
    <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-950' : 'bg-gray-100'}`}>
      <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
    </div>
  );

  if (error || !project) return (
    <div className={`min-h-screen flex flex-col items-center justify-center gap-4 ${isDark ? 'bg-gray-950' : 'bg-gray-100'}`}>
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

  const currentLyrics = getCurrentLyrics();
  const textColor = project?.text_color || '#ffffff';
  const outlineColor = project?.outline_color || '#000000';
  const unsungColor = '#cccccc';
  const lines = groupedLines();

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <>
      <SEO title={`Edit: ${project.title} | Karatrack Studio`} description="Edit lyrics timing and line breaks" />

      <audio ref={instrumentalRef} src={project.processed_audio_url} onLoadedMetadata={handleAudioLoaded} onEnded={() => setIsPlaying(false)} preload="auto" />
      {project.vocals_audio_url && <audio ref={vocalsRef} src={project.vocals_audio_url} preload="auto" muted />}

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
                    Before "{words[selectedWordIndices[0]]?.word}"
                  </button>
                  <button onClick={() => setAddWordPosition('after')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${addWordPosition === 'after' ? 'bg-cyan-500 text-white' : isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                    After "{words[selectedWordIndices[0]]?.word}"
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

      <div className={`min-h-screen ${isDark ? 'bg-gray-950' : 'bg-gray-100'}`}>
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className={`absolute -top-1/2 -left-1/2 w-full h-full ${isDark ? 'bg-gradient-to-br from-cyan-900/20 via-transparent to-purple-900/20' : 'bg-gradient-to-br from-cyan-100/50 via-transparent to-purple-100/50'} rounded-full blur-3xl`} />
        </div>

        <AppNavigation />

        <main className="relative z-10 px-4 py-4 max-w-[1800px] mx-auto">
          {/* Header - Simplified */}
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

          {/* VIDEO PREVIEW - Full Width */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl overflow-hidden mb-4 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}>
            <div className="relative aspect-video w-full overflow-hidden" style={getPreviewBackground()}>
              {project.bg_image_url && (
                <img className="absolute inset-0 w-full h-full object-cover opacity-60" src={project.bg_image_url} alt="" />
              )}
              {project.bg_video_url && (
                <video className="absolute inset-0 w-full h-full object-cover opacity-60" src={project.bg_video_url} autoPlay loop muted playsInline />
              )}
              {project.custom_font_url && (
                <style>{`@font-face { font-family: 'CustomKaraokeFont'; src: url('${project.custom_font_url}'); }`}</style>
              )}
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
                {currentLyrics.showProgressBar ? (
                  <InstrumentalProgressBar 
                    progress={currentLyrics.progressBarPercent}
                    nextLyrics={currentLyrics.nextLyricsForProgressBar}
                    color={project?.sung_color || '#00d4ff'}
                    textColor={textColor}
                    outlineColor={outlineColor}
                  />
                ) : currentLyrics.currentLine ? (
                  <div className="text-center mb-4">
                    <p className="text-2xl md:text-4xl font-bold relative inline-block" style={{ fontFamily: project.custom_font_url ? 'CustomKaraokeFont' : (project.font || 'Arial') }}>
                      {currentLyrics.showSweepIn && (
                        <span style={{ position: 'absolute', right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: '-0.25em' }}>
                          <SweepInBar progress={currentLyrics.sweepInProgress} color={getHighlightColor(currentLyrics.currentLine[0]?.index)} />
                        </span>
                      )}
                      {currentLyrics.currentLine.map((wordData, i) => {
                        const highlightColor = getHighlightColor(wordData.index);
                        if (currentLyrics.showSweepIn && i === 0) {
                          return (
                            <span key={i} className="mx-1" style={{ position: 'relative', display: 'inline-block' }}>
                              <span style={{ color: unsungColor, textShadow: `1px 1px 2px ${outlineColor}, -1px -1px 2px ${outlineColor}` }}>{wordData.word}</span>
                            </span>
                          );
                        }
                        return (
                          <SweepWord key={i} word={wordData.word} sweepPercent={wordData.sweepPercent} color={highlightColor} unsungColor={unsungColor} outlineColor={outlineColor} isActive={wordData.isActive} isPast={wordData.isPast} showGlow={wordData.isActive} />
                        );
                      })}
                    </p>
                  </div>
                ) : (
                  <div className="text-center mb-4" />
                )}
                {currentLyrics.next && !currentLyrics.showProgressBar && (
                  <p className="text-lg md:text-2xl opacity-50" style={{ color: textColor, fontFamily: project.custom_font_url ? 'CustomKaraokeFont' : (project.font || 'Arial'), textShadow: `1px 1px 2px ${outlineColor}` }}>
                    {currentLyrics.next}
                  </p>
                )}
              </div>
              <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/50 rounded text-xs text-white/70 font-mono">{formatTime(currentTime)}</div>
            </div>
          </motion.div>

          {/* LINE & WORD EDITOR - Collapsible */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className={`rounded-2xl overflow-hidden mb-4 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}>
            <CollapsibleHeader
              title="Line & Word Editor (Rhyme Sync)"
              icon={SplitSquareHorizontal}
              isExpanded={lineEditorExpanded}
              onToggle={() => setLineEditorExpanded(!lineEditorExpanded)}
              rightContent={
                <span className="text-xs text-gray-500">{lines.length} lines • {words.length} words</span>
              }
            />
            
            <AnimatePresence>
              {lineEditorExpanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  {/* Action Buttons for Selected Word */}
                  {selectedWordIndices.length > 0 && editingWordIndex === null && (
                    <div className={`px-4 py-2 border-b ${isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-gray-500">Selected: "{words[selectedWordIndices[0]]?.word}"</span>
                        <div className="flex gap-1">
                          <button onClick={() => handleWordDoubleClick(selectedWordIndices[0])} className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 flex items-center gap-1">
                            <Edit3 className="w-3 h-3" />Edit Word
                          </button>
                          {selectedWordIndices[0] > 0 && (
                            <button onClick={() => splitLineHere(selectedWordIndices[0])} className="px-2 py-1 text-xs bg-cyan-500/20 text-cyan-400 rounded hover:bg-cyan-500/30 flex items-center gap-1">
                              <SplitSquareHorizontal className="w-3 h-3" />Split Line Here
                            </button>
                          )}
                          {selectedWordIndices[0] > 0 && (
                            <button onClick={() => moveWordToNextLine(selectedWordIndices[0])} className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 flex items-center gap-1">
                              <ArrowDown className="w-3 h-3" />Move to Next Line
                            </button>
                          )}
                          <button onClick={() => setShowAddWordModal(true)} className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded hover:bg-purple-500/30 flex items-center gap-1">
                            <Plus className="w-3 h-3" />Add Word
                          </button>
                          <button onClick={deleteSelectedWords} className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 flex items-center gap-1">
                            <Trash2 className="w-3 h-3" />Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Word Editing Input */}
                  {editingWordIndex !== null && (
                    <div className={`px-4 py-2 border-b ${isDark ? 'border-white/10 bg-cyan-500/10' : 'border-gray-200 bg-cyan-50'}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Editing:</span>
                        <input
                          type="text" value={editingText} onChange={(e) => setEditingText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveWordEdit(); if (e.key === 'Escape') cancelWordEdit(); }}
                          autoFocus
                          className={`px-3 py-1 rounded text-sm ${isDark ? 'bg-white/10 text-white' : 'bg-white text-gray-900'} border border-cyan-500 focus:outline-none`}
                        />
                        <button onClick={saveWordEdit} className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600">Save</button>
                        <button onClick={cancelWordEdit} className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600">Cancel</button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                    {/* Left: Line Editor */}
                    <div className={`p-4 max-h-80 overflow-y-auto ${isDark ? 'border-r border-white/10' : 'border-r border-gray-200'}`}>
                      <div className="space-y-2">
                        {lines.map((line, lineIndex) => {
                          const lineTooLong = isLineTooLong(line);
                          const charCount = line.reduce((sum, w) => sum + w.word.length + 1, 0);
                          
                          return (
                            <div key={lineIndex} className="group">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs text-gray-500 w-6">{lineIndex + 1}</span>
                                {lineIndex > 0 && (
                                  <button onClick={() => mergeWithPreviousLine(lineIndex)} className="opacity-0 group-hover:opacity-100 px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded hover:bg-purple-500/30 transition-all flex items-center gap-1" title="Merge with line above">
                                    <ArrowUp className="w-3 h-3" />Merge Up
                                  </button>
                                )}
                                {lineIndex < lines.length - 1 && (
                                  <button onClick={() => mergeWithNextLine(lineIndex)} className="opacity-0 group-hover:opacity-100 px-2 py-0.5 text-xs bg-orange-500/20 text-orange-400 rounded hover:bg-orange-500/30 transition-all flex items-center gap-1" title="Merge with line below">
                                    <ArrowDown className="w-3 h-3" />Merge Down
                                  </button>
                                )}
                                {lineTooLong && <LineLengthWarning lineIndex={lineIndex} wordCount={line.length} charCount={charCount} />}
                              </div>
                              <div className={`flex flex-wrap items-center gap-1 p-2 rounded-lg ${lineTooLong ? 'bg-yellow-500/10 border border-yellow-500/30' : isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
                                {line.map((wordData, wordIndex) => {
                                  const isSelected = selectedWordIndices.includes(wordData.index);
                                  const isEditing = editingWordIndex === wordData.index;
                                  const isLastInLine = wordIndex === line.length - 1;
                                  const isCurrent = isWordCurrent(wordData);
                                  
                                  return (
                                    <span key={wordData.index} className="inline-flex items-center">
                                      <button
                                        onClick={(e) => handleWordClick(wordData.index, e)}
                                        onDoubleClick={(e) => handleWordDoubleClick(wordData.index, e)}
                                        className={`px-2 py-1 rounded text-sm transition-all ${
                                          isEditing ? 'bg-cyan-500/50 text-white ring-2 ring-cyan-500' :
                                          isSelected ? 'bg-cyan-500/30 text-cyan-300 ring-2 ring-cyan-500' :
                                          isCurrent ? 'bg-green-500/30 text-green-300' :
                                          wordData.confidence !== undefined && wordData.confidence < 0.5
                                            ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                                            : isDark ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-gray-200 text-gray-700'
                                        }`}
                                        title={`${wordData.start.toFixed(2)}s - ${wordData.end.toFixed(2)}s${wordData.confidence ? ` (${(wordData.confidence * 100).toFixed(0)}% conf)` : ''}`}
                                      >
                                        {wordData.word}
                                      </button>
                                      {isLastInLine && lineIndex < lines.length - 1 && (
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
                    <div className="p-4 max-h-80 overflow-y-auto">
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
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* TIMELINE EDITOR - Collapsible with Duet Mode Toggle */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={`rounded-2xl overflow-hidden mb-4 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}>
            <div className={`flex items-center justify-between px-4 py-3 ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}>
              <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => setTimelineEditorExpanded(!timelineEditorExpanded)}>
                {timelineEditorExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                <Music2 className="w-4 h-4 text-cyan-400" />
                <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Timeline Editor</span>
              </div>
              
              {/* Duet Mode Toggle Button */}
              <button
                onClick={() => {
                  setIsDuetMode(!isDuetMode);
                  setHasChanges(true);
                  if (!isDuetMode && !timelineEditorExpanded) {
                    setTimelineEditorExpanded(true);
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isDuetMode 
                    ? 'bg-green-500/20 text-green-400 border border-green-500/50' 
                    : 'bg-red-500/20 text-red-400 border border-red-500/50'
                }`}
              >
                {isDuetMode ? 'Duet Mode On' : 'Duet Mode Off'}
              </button>
            </div>

            <AnimatePresence>
              {timelineEditorExpanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  
                  {/* Duet Color Settings - Only visible when Duet Mode is ON */}
                  {isDuetMode && (
                    <div className={`px-4 py-3 border-b ${isDark ? 'border-white/10 bg-gradient-to-r from-cyan-500/10 to-pink-500/10' : 'border-gray-200 bg-gradient-to-r from-cyan-50 to-pink-50'}`}>
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Singer 1:</span>
                          <input type="color" value={duetColors.singer1} onChange={(e) => { setDuetColors(prev => ({ ...prev, singer1: e.target.value })); setHasChanges(true); }} className="w-8 h-8 rounded cursor-pointer" />
                          <button onClick={() => setPaintMode(paintMode === SINGER.SINGER_1 ? null : SINGER.SINGER_1)} className={`px-2 py-1 text-xs rounded ${paintMode === SINGER.SINGER_1 ? 'bg-cyan-500 text-white' : 'bg-white/10 text-gray-400'}`}>
                            {paintMode === SINGER.SINGER_1 ? 'Painting...' : 'Paint'}
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Singer 2:</span>
                          <input type="color" value={duetColors.singer2} onChange={(e) => { setDuetColors(prev => ({ ...prev, singer2: e.target.value })); setHasChanges(true); }} className="w-8 h-8 rounded cursor-pointer" />
                          <button onClick={() => setPaintMode(paintMode === SINGER.SINGER_2 ? null : SINGER.SINGER_2)} className={`px-2 py-1 text-xs rounded ${paintMode === SINGER.SINGER_2 ? 'bg-pink-500 text-white' : 'bg-white/10 text-gray-400'}`}>
                            {paintMode === SINGER.SINGER_2 ? 'Painting...' : 'Paint'}
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Both:</span>
                          <input type="color" value={duetColors.both} onChange={(e) => { setDuetColors(prev => ({ ...prev, both: e.target.value })); setHasChanges(true); }} className="w-8 h-8 rounded cursor-pointer" />
                          <button onClick={() => setPaintMode(paintMode === SINGER.BOTH ? null : SINGER.BOTH)} className={`px-2 py-1 text-xs rounded ${paintMode === SINGER.BOTH ? 'bg-yellow-500 text-white' : 'bg-white/10 text-gray-400'}`}>
                            {paintMode === SINGER.BOTH ? 'Painting...' : 'Paint'}
                          </button>
                        </div>
                        {paintMode !== null && (
                          <button onClick={() => setPaintMode(null)} className="px-2 py-1 text-xs bg-gray-500 text-white rounded">
                            Stop Painting
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Zoom Controls */}
                  <div className={`px-4 py-2 border-b ${isDark ? 'border-white/10' : 'border-gray-200'} flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <button onClick={zoomOut} className={`p-1.5 rounded ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'}`}><ZoomOut className="w-4 h-4" /></button>
                      <span className="text-xs text-gray-500 w-16 text-center">{zoom.toFixed(0)}px/s</span>
                      <button onClick={zoomIn} className={`p-1.5 rounded ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'}`}><ZoomIn className="w-4 h-4" /></button>
                    </div>
                    <span className="text-xs text-gray-500">Drag words to adjust timing • Arrow keys to nudge</span>
                  </div>

                  {/* Timeline */}
                  <div ref={timelineContainerRef} onClick={handleTimelineClick} className="relative overflow-hidden cursor-crosshair" style={{ height: TIMELINE_HEIGHT }}>
                    <div className="absolute inset-0 flex items-center">
                      {/* Center line indicator */}
                      <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-cyan-500 z-20" />
                      
                      {/* Words on timeline */}
                      <div className="relative w-full h-full">
                        {words.map((word, index) => {
                          const centerOffset = (word.start - currentTime) * zoom;
                          const width = Math.max(30, (word.end - word.start) * zoom);
                          const isSelected = selectedWordIndices.includes(index);
                          const isCurrent = isWordCurrent(word);
                          const wordColor = getWordColor(word, isSelected, isCurrent);
                          
                          return (
                            <div
                              key={index}
                              onMouseDown={(e) => handleTimelineWordMouseDown(index, e)}
                              onMouseEnter={() => handleTimelineWordMouseEnter(index)}
                              onClick={(e) => { e.stopPropagation(); handleWordClick(index, e); }}
                              className={`absolute top-1/2 -translate-y-1/2 px-2 py-1 rounded text-xs font-medium cursor-pointer select-none transition-all ${
                                isSelected ? 'ring-2 ring-cyan-400 z-10' : ''
                              } ${isCurrent ? 'scale-110' : ''}`}
                              style={{
                                left: `calc(50% + ${centerOffset}px)`,
                                width: `${width}px`,
                                backgroundColor: isSelected ? 'rgba(0,212,255,0.3)' : `${wordColor}20`,
                                borderLeft: `3px solid ${wordColor}`,
                                color: isDark ? '#fff' : '#333',
                              }}
                              title={`${word.word}: ${word.start.toFixed(2)}s - ${word.end.toFixed(2)}s`}
                            >
                              <span className="truncate block">{word.word}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Playback Controls - Only visible when Timeline is expanded */}
                  <div className={`px-4 py-3 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <button onClick={restart} className={`p-2 rounded-lg ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'}`}><SkipBack className="w-4 h-4" /></button>
                        <button onClick={togglePlayback} className={`p-3 rounded-xl ${isPlaying ? 'bg-red-500 hover:bg-red-600' : 'bg-cyan-500 hover:bg-cyan-600'} text-white`}>
                          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                        </button>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="flex-1 flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-12">{formatTime(currentTime)}</span>
                        <div onClick={handleProgressClick} className="flex-1 h-2 bg-white/10 rounded-full cursor-pointer overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full transition-all" style={{ width: `${(currentTime / duration) * 100}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 w-12">{formatTime(duration)}</span>
                      </div>
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
              
              <button onClick={handleApproveAndRender} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:opacity-90 transition-opacity">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Approve & Render Video
              </button>
            </div>
          </motion.div>

        </main>
      </div>
    </>
  );
}