'use client';

/**
 * Preview/Edit Page - Karatrack Studio (V9.5)
 * 
 * Place this at: frontend/src/pages/preview/[id].jsx
 * 
 * V9.5 FIXES:
 * - NEW: "Merge Down to New Line" - creates new line with selected words
 * - NEW: Resizable Line & Word Editor (drag handle like video preview)
 * - FIXED: Timeline sync - matches original implementation exactly
 * - Merge Down works on selected word
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Play, Pause, SkipBack, Music2, Save, RotateCcw,
  ZoomIn, ZoomOut, Users, Check, Loader2, AlertCircle,
  CheckCircle, Plus, Trash2, Paintbrush,
  ArrowDown, ArrowUp, Type, SplitSquareHorizontal,
  AlertTriangle, ChevronDown, ChevronRight, GripHorizontal
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
const WORD_HEIGHT = 44;

const MAX_WORDS_PER_LINE = 10;

// Preview & Editor size settings
const MIN_PREVIEW_HEIGHT = 150;
const MAX_PREVIEW_HEIGHT = 600;
const DEFAULT_PREVIEW_HEIGHT = 250;
const MIN_EDITOR_HEIGHT = 150;
const MAX_EDITOR_HEIGHT = 500;
const DEFAULT_EDITOR_HEIGHT = 200;

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
// LINE LENGTH WARNING COMPONENT
// ============================================================
const LineLengthWarning = ({ lineIndex, wordCount, charCount }) => (
  <div className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded" title={`Line ${lineIndex + 1} may be too long`}>
    <AlertTriangle className="w-3 h-3" />
    <span>Too long</span>
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

  // Section collapse state
  const [lineEditorExpanded, setLineEditorExpanded] = useState(false);
  const [timelineEditorExpanded, setTimelineEditorExpanded] = useState(false);

  // Resize state - Preview
  const [previewHeight, setPreviewHeight] = useState(DEFAULT_PREVIEW_HEIGHT);
  const [isResizingPreview, setIsResizingPreview] = useState(false);
  const previewResizeStartY = useRef(0);
  const previewResizeStartHeight = useRef(0);

  // Resize state - Editor
  const [editorHeight, setEditorHeight] = useState(DEFAULT_EDITOR_HEIGHT);
  const [isResizingEditor, setIsResizingEditor] = useState(false);
  const editorResizeStartY = useRef(0);
  const editorResizeStartHeight = useRef(0);

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
  const [selectedWordIndex, setSelectedWordIndex] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTimes, setDragStartTimes] = useState({});

  // Word editing state
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

  // ============================================================
  // RESIZE HANDLERS - PREVIEW
  // ============================================================
  const handlePreviewResizeStart = useCallback((e) => {
    e.preventDefault();
    setIsResizingPreview(true);
    previewResizeStartY.current = e.clientY;
    previewResizeStartHeight.current = previewHeight;
  }, [previewHeight]);

  useEffect(() => {
    if (!isResizingPreview) return;
    const handleMove = (e) => {
      const deltaY = e.clientY - previewResizeStartY.current;
      setPreviewHeight(Math.min(MAX_PREVIEW_HEIGHT, Math.max(MIN_PREVIEW_HEIGHT, previewResizeStartHeight.current + deltaY)));
    };
    const handleUp = () => setIsResizingPreview(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
  }, [isResizingPreview]);

  // ============================================================
  // RESIZE HANDLERS - EDITOR
  // ============================================================
  const handleEditorResizeStart = useCallback((e) => {
    e.preventDefault();
    setIsResizingEditor(true);
    editorResizeStartY.current = e.clientY;
    editorResizeStartHeight.current = editorHeight;
  }, [editorHeight]);

  useEffect(() => {
    if (!isResizingEditor) return;
    const handleMove = (e) => {
      const deltaY = e.clientY - editorResizeStartY.current;
      setEditorHeight(Math.min(MAX_EDITOR_HEIGHT, Math.max(MIN_EDITOR_HEIGHT, editorResizeStartHeight.current + deltaY)));
    };
    const handleUp = () => setIsResizingEditor(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
  }, [isResizingEditor]);

  // ============================================================
  // GROUP LYRICS INTO LINES
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
  // AUTO-ADD LINE BREAKS ON LOAD
  // ============================================================
  const addAutoLineBreaks = useCallback((wordsArray) => {
    if (!wordsArray.length) return wordsArray;
    const result = [...wordsArray];
    let wordsSinceBreak = 0;
    
    for (let i = 0; i < result.length; i++) {
      if (result[i].lineBreak === true) { wordsSinceBreak = 0; continue; }
      wordsSinceBreak++;
      let shouldBreak = false;
      if (wordsSinceBreak >= MAX_WORDS_PER_LINE) shouldBreak = true;
      else if (i < result.length - 1 && wordsSinceBreak >= 3) {
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
  // LINE BREAK FUNCTIONS
  // ============================================================
  
  // Move word down - moves selected word and all after it to next line
  const moveWordDown = useCallback((globalIndex) => {
    if (globalIndex === 0) return;
    setWords(prev => {
      const newWords = [...prev];
      newWords[globalIndex - 1] = { ...newWords[globalIndex - 1], lineBreak: true };
      // Remove next line break to merge
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

  // Merge line up - merge current line with previous
  const mergeLineUp = useCallback((lineIndex) => {
    if (lineIndex === 0) return;
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

  // Merge line down - moves selected word (or last word) and all after to next line
  const mergeLineDown = useCallback((lineIndex) => {
    const currentLine = lyricsLines[lineIndex];
    if (!currentLine || currentLine.length <= 1) return;
    
    let splitIndex = -1;
    for (let i = 0; i < currentLine.length; i++) {
      if (currentLine[i].globalIndex === selectedWordIndex) {
        splitIndex = i;
        break;
      }
    }
    if (splitIndex <= 0) splitIndex = currentLine.length - 1;
    
    const wordBeforeSplitIndex = currentLine[splitIndex - 1].globalIndex;
    
    setWords(prev => {
      const newWords = [...prev];
      newWords[wordBeforeSplitIndex] = { ...newWords[wordBeforeSplitIndex], lineBreak: true };
      const lastWordIndex = currentLine[currentLine.length - 1].globalIndex;
      if (newWords[lastWordIndex].lineBreak) {
        newWords[lastWordIndex] = { ...newWords[lastWordIndex], lineBreak: false };
      }
      return newWords;
    });
    setHasChanges(true);
  }, [lyricsLines, selectedWordIndex]);

  // NEW: Merge Down to New Line - creates a NEW line with selected words
  const mergeDownToNewLine = useCallback((lineIndex) => {
    const currentLine = lyricsLines[lineIndex];
    if (!currentLine || currentLine.length <= 1) return;
    
    let splitIndex = -1;
    for (let i = 0; i < currentLine.length; i++) {
      if (currentLine[i].globalIndex === selectedWordIndex) {
        splitIndex = i;
        break;
      }
    }
    if (splitIndex <= 0) splitIndex = currentLine.length - 1;
    
    const wordBeforeSplitIndex = currentLine[splitIndex - 1].globalIndex;
    const lastWordIndex = currentLine[currentLine.length - 1].globalIndex;
    
    setWords(prev => {
      const newWords = [...prev];
      // Add line break before selected word
      newWords[wordBeforeSplitIndex] = { ...newWords[wordBeforeSplitIndex], lineBreak: true };
      // Keep line break on last word of this segment (creates new line)
      // If there wasn't one, add it
      if (!newWords[lastWordIndex].lineBreak && lineIndex < lyricsLines.length - 1) {
        newWords[lastWordIndex] = { ...newWords[lastWordIndex], lineBreak: true };
      }
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

        setProject(projectData);
        let lyricsData = projectData.lyrics_json || [];
        
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
  // AUDIO PLAYBACK - EXACTLY MATCHING ORIGINAL
  // ============================================================
  useEffect(() => {
    const updateTime = () => {
      if (instrumentalRef.current) setCurrentTime(instrumentalRef.current.currentTime);
      animationFrameRef.current = requestAnimationFrame(updateTime);
    };
    if (isPlaying) animationFrameRef.current = requestAnimationFrame(updateTime);
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [isPlaying]);

  useEffect(() => {
    if (vocalsRef.current && instrumentalRef.current) {
      const diff = Math.abs(vocalsRef.current.currentTime - instrumentalRef.current.currentTime);
      if (diff > 0.1) vocalsRef.current.currentTime = instrumentalRef.current.currentTime;
    }
  }, [currentTime]);

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
        else setSelectedWordIndex(null);
      }
      if ((e.code === 'Delete' || e.code === 'Backspace') && selectedWordIndex !== null && editingWordIndex === null) {
        e.preventDefault(); deleteSelectedWord();
      }
      if (selectedWordIndex !== null && editingWordIndex === null) {
        if (e.code === 'ArrowLeft') { e.preventDefault(); nudgeSelectedWord(e.shiftKey ? -0.1 : -0.05); }
        if (e.code === 'ArrowRight') { e.preventDefault(); nudgeSelectedWord(e.shiftKey ? 0.1 : 0.05); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedWordIndex, editingWordIndex, isPlaying, showAddWordModal, paintMode]);

  // ============================================================
  // WORD EDITING
  // ============================================================
  const handleWordClick = useCallback((index) => {
    if (paintMode !== null) return;
    if (editingWordIndex !== null && editingWordIndex !== index) saveWordEdit();
    setSelectedWordIndex(index);
  }, [paintMode, editingWordIndex]);

  const handleWordDoubleClick = useCallback((index, e) => {
    e?.stopPropagation();
    if (paintMode !== null) return;
    setEditingWordIndex(index);
    setEditingText(words[index].word);
    setSelectedWordIndex(index);
  }, [words, paintMode]);

  useEffect(() => {
    if (editingWordIndex !== null && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingWordIndex]);

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

  const cancelWordEdit = useCallback(() => { setEditingWordIndex(null); setEditingText(''); }, []);

  const nudgeSelectedWord = useCallback((delta) => {
    if (selectedWordIndex === null) return;
    setWords(prev => {
      const updated = [...prev];
      const word = updated[selectedWordIndex];
      const newStart = Math.max(0, word.start + delta);
      updated[selectedWordIndex] = { ...word, start: newStart, end: newStart + (word.end - word.start) };
      return updated;
    });
    setHasChanges(true);
  }, [selectedWordIndex]);

  const deleteSelectedWord = useCallback(() => {
    if (selectedWordIndex === null) return;
    if (window.confirm(`Delete "${words[selectedWordIndex].word}"?`)) {
      setWords(prev => { const updated = [...prev]; updated.splice(selectedWordIndex, 1); return updated; });
      setSelectedWordIndex(null);
      setHasChanges(true);
    }
  }, [selectedWordIndex, words]);

  const addNewWord = useCallback(() => {
    if (!newWordText.trim() || selectedWordIndex === null) return;
    const selectedWord = words[selectedWordIndex];
    const midPoint = selectedWord.start + (selectedWord.end - selectedWord.start) / 2;
    
    if (addWordPosition === 'before') {
      const newWord = { word: newWordText.trim(), start: selectedWord.start, end: midPoint, confidence: 1.0 };
      setWords(prev => {
        const updated = [...prev];
        updated[selectedWordIndex] = { ...updated[selectedWordIndex], start: midPoint };
        updated.splice(selectedWordIndex, 0, newWord);
        return updated;
      });
    } else {
      const newWord = { word: newWordText.trim(), start: midPoint, end: selectedWord.end, confidence: 1.0 };
      setWords(prev => {
        const updated = [...prev];
        updated[selectedWordIndex] = { ...updated[selectedWordIndex], end: midPoint };
        updated.splice(selectedWordIndex + 1, 0, newWord);
        return updated;
      });
    }
    setShowAddWordModal(false); setNewWordText(''); setSelectedWordIndex(null); setHasChanges(true);
  }, [newWordText, selectedWordIndex, words, addWordPosition]);

  // ============================================================
  // DUET MODE
  // ============================================================
  const paintWord = useCallback((index) => {
    if (paintMode === null) return;
    setWords(prev => { const updated = [...prev]; updated[index] = { ...updated[index], singer: paintMode }; return updated; });
    setHasChanges(true);
  }, [paintMode]);

  const handleTimelineWordMouseDown = useCallback((index, e) => {
    e.stopPropagation();
    if (paintMode !== null) {
      setIsPainting(true); setPaintedIndices(new Set([index])); paintWord(index); return;
    }
    setSelectedWordIndex(index);
    setIsDragging(true);
    setDragStartX(e.clientX);
    setDragStartTimes({ [index]: { start: words[index].start, end: words[index].end } });
  }, [words, paintMode, paintWord]);

  const handleTimelineWordMouseEnter = useCallback((index) => {
    if (isPainting && paintMode !== null && !paintedIndices.has(index)) {
      setPaintedIndices(prev => new Set([...prev, index])); paintWord(index);
    }
  }, [isPainting, paintMode, paintedIndices, paintWord]);

  useEffect(() => {
    const handleUp = () => { if (isPainting) { setIsPainting(false); setPaintedIndices(new Set()); } };
    window.addEventListener('mouseup', handleUp);
    return () => window.removeEventListener('mouseup', handleUp);
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
          updated[index] = { ...updated[index], start: Math.max(0, original.start + deltaTime), end: Math.max(0.1, original.end + deltaTime) };
        });
        return updated;
      });
      setHasChanges(true);
    };
    const handleMouseUp = () => { if (isDragging) { setIsDragging(false); setDragStartTimes({}); } };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [isDragging, dragStartX, dragStartTimes, zoom, paintMode]);

  // ============================================================
  // SAVE & RENDER
  // ============================================================
  const resetToOriginal = useCallback(() => {
    if (!hasChanges) return;
    if (window.confirm('Reset all changes?')) {
      setWords(JSON.parse(JSON.stringify(originalWords)));
      setHasChanges(false); setSelectedWordIndex(null); setEditingWordIndex(null);
      setIsDuetMode(project?.is_duet_mode || false);
    }
  }, [hasChanges, originalWords, project]);

  const saveChanges = useCallback(async () => {
    if (!hasChanges) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      const { error } = await supabase.from('projects').update({
        lyrics_json: words, is_duet_mode: isDuetMode,
        duet_singer1_color: duetColors.singer1, duet_singer2_color: duetColors.singer2, duet_both_color: duetColors.both,
      }).eq('id', id);
      if (error) throw error;
      setHasChanges(false); setOriginalWords(JSON.parse(JSON.stringify(words)));
      setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) { console.error('Save error:', err); setError('Failed to save'); }
    finally { setSaving(false); }
  }, [hasChanges, words, isDuetMode, duetColors, id, router]);

  const handleApproveAndRender = useCallback(async () => {
    if (hasChanges) await saveChanges();
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/projects/${id}/render`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ edited_lyrics: words })
      });
      if (!response.ok) { const errData = await response.json(); throw new Error(errData.error || 'Failed'); }
      router.push('/dashboard');
    } catch (err) { console.error('Render error:', err); setError(err.message); }
    finally { setSaving(false); }
  }, [hasChanges, saveChanges, words, router, id]);

  // ============================================================
  // UTILITY
  // ============================================================
  const formatTime = (s) => { if (!s || isNaN(s)) return '0:00'; return `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`; };
  const formatTimeShort = (s) => { const m = Math.floor(s/60), sec = Math.floor(s%60); return m > 0 ? `${m}:${sec.toString().padStart(2,'0')}` : `${sec}s`; };

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
  const getCurrentLyrics = useCallback(() => {
    if (!lyricsLines.length) return { currentLine: null, next: '' };
    
    let currentLineIdx = -1;
    for (let i = 0; i < lyricsLines.length; i++) {
      const line = lyricsLines[i];
      for (let j = 0; j < line.length; j++) {
        if (currentTime >= line[j].start && currentTime <= line[j].end) { currentLineIdx = i; break; }
      }
      if (currentLineIdx !== -1) break;
    }
    
    if (currentLineIdx === -1) {
      for (let i = 0; i < lyricsLines.length; i++) {
        const line = lyricsLines[i];
        if (line.length > 0 && line[0].start > currentTime) {
          if (i > 0) {
            const prevLine = lyricsLines[i - 1];
            const lastWordEnd = prevLine[prevLine.length - 1].end;
            if (currentTime - lastWordEnd <= 2) {
              return { currentLine: prevLine.map(w => ({ word: w.word, index: w.globalIndex, start: w.start, end: w.end, isActive: false, isPast: true, sweepPercent: 1 })), next: line.map(w => w.word).join(' ') };
            }
          }
          return { currentLine: null, next: line.map(w => w.word).join(' ') };
        }
      }
    }

    if (currentLineIdx === -1 && lyricsLines.length > 0) {
      const lastLine = lyricsLines[lyricsLines.length - 1];
      if (currentTime > lastLine[lastLine.length - 1].end) {
        return { currentLine: lastLine.map(w => ({ word: w.word, index: w.globalIndex, start: w.start, end: w.end, isActive: false, isPast: true, sweepPercent: 1 })), next: '' };
      }
    }

    if (currentLineIdx === -1) return { currentLine: null, next: '' };

    const currentLine = lyricsLines[currentLineIdx];
    const currentLineText = currentLine.map(w => {
      const isActive = currentTime >= w.start && currentTime <= w.end;
      const isPast = currentTime > w.end;
      let sweepPercent = isPast ? 1 : isActive ? (currentTime - w.start) / (w.end - w.start) : 0;
      return { word: w.word, index: w.globalIndex, start: w.start, end: w.end, isActive, isPast, sweepPercent };
    });

    const nextLine = lyricsLines[currentLineIdx + 1];
    return { currentLine: currentLineText, next: nextLine ? nextLine.map(w => w.word).join(' ') : '' };
  }, [lyricsLines, currentTime]);

  const handleTimelineClick = useCallback((e) => {
    if (!timelineContainerRef.current || isDragging) return;
    const rect = timelineContainerRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const clickX = e.clientX - rect.left;
    seekTo(currentTime + (clickX - centerX) / zoom);
  }, [zoom, currentTime, seekTo, isDragging]);

  const handleProgressClick = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    seekTo((e.clientX - rect.left) / rect.width * duration);
  }, [duration, seekTo]);

  const zoomIn = () => setZoom(prev => Math.min(prev * 1.25, 300));
  const zoomOut = () => setZoom(prev => Math.max(prev / 1.25, 30));

  // Time markers for timeline
  const timeMarkers = useMemo(() => {
    if (!duration) return [];
    const markers = [];
    const visibleRange = 20;
    const startTime = Math.max(0, currentTime - visibleRange);
    const endTime = Math.min(duration, currentTime + visibleRange);
    for (let t = Math.floor(startTime); t <= Math.ceil(endTime); t++) markers.push({ time: t, isMajor: t % 5 === 0 });
    return markers;
  }, [currentTime, duration]);

  // ============================================================
  // LOADING / ERROR
  // ============================================================
  if (loading) return <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-950' : 'bg-gray-100'}`}><Loader2 className="w-8 h-8 animate-spin text-cyan-400" /></div>;
  if (error || !project) return <div className={`min-h-screen flex flex-col items-center justify-center gap-4 ${isDark ? 'bg-gray-950' : 'bg-gray-100'}`}><AlertCircle className="w-12 h-12 text-red-400" /><p className="text-red-400">{error || 'Project not found'}</p><Link href="/dashboard" className="text-cyan-400 hover:underline">Return to Dashboard</Link></div>;

  const getPreviewBackground = () => project.bg_type === 'gradient' || project.use_gradient ? { background: `linear-gradient(${project.gradient_direction || 'to bottom'}, ${project.bg_color_1 || '#1a1a2e'}, ${project.bg_color_2 || '#16213e'})` } : { backgroundColor: project.bg_color_1 || '#1a1a2e' };

  const currentLyrics = getCurrentLyrics();
  const textColor = project?.text_color || '#ffffff';
  const outlineColor = project?.outline_color || '#000000';
  const unsungColor = '#cccccc';

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <>
      <SEO title={`Edit: ${project.title} | Karatrack Studio`} description="Edit lyrics" />
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
                  <button onClick={() => setAddWordPosition('before')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${addWordPosition === 'before' ? 'bg-cyan-500 text-white' : isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>Before "{words[selectedWordIndex]?.word}"</button>
                  <button onClick={() => setAddWordPosition('after')} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${addWordPosition === 'after' ? 'bg-cyan-500 text-white' : isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>After "{words[selectedWordIndex]?.word}"</button>
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm text-gray-500 mb-2">New Word</label>
                <input type="text" value={newWordText} onChange={(e) => setNewWordText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addNewWord(); if (e.key === 'Escape') { setShowAddWordModal(false); setNewWordText(''); }}} placeholder="Enter word..." autoFocus className={`w-full px-4 py-2 rounded-lg text-sm ${isDark ? 'bg-white/5 border border-white/10 text-white' : 'bg-gray-50 border border-gray-200 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-cyan-500`} />
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setShowAddWordModal(false); setNewWordText(''); }} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'}`}>Cancel</button>
                <button onClick={addNewWord} disabled={!newWordText.trim()} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${newWordText.trim() ? 'bg-cyan-500 text-white hover:bg-cyan-600' : 'bg-gray-500 text-gray-300 cursor-not-allowed'}`}>Add</button>
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
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className={`p-2 rounded-xl ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'}`}><ArrowLeft className="w-5 h-5" /></Link>
              <div>
                <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{project.title}</h1>
                <p className="text-sm text-gray-500">{project.artist_name} - {project.song_title}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {paintMode !== null && <span className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 text-purple-400 text-xs rounded-lg animate-pulse"><Paintbrush className="w-3 h-3" />Paint Mode</span>}
              {hasChanges && <span className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-lg"><AlertCircle className="w-3 h-3" />Unsaved</span>}
              <AnimatePresence>{saveSuccess && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 text-green-400 text-xs rounded-lg"><CheckCircle className="w-3 h-3" />Saved!</motion.span>}</AnimatePresence>
            </div>
          </motion.div>

          {/* VIDEO PREVIEW */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl overflow-hidden mb-4 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}>
            <div className="relative w-full overflow-hidden" style={{ height: previewHeight, ...getPreviewBackground() }}>
              {project.bg_image_url && <img className="absolute inset-0 w-full h-full object-cover opacity-60" src={project.bg_image_url} alt="" />}
              {project.bg_video_url && <video className="absolute inset-0 w-full h-full object-cover opacity-60" src={project.bg_video_url} autoPlay loop muted playsInline />}
              {project.custom_font_url && <style>{`@font-face { font-family: 'CustomKaraokeFont'; src: url('${project.custom_font_url}'); }`}</style>}
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                {currentLyrics.currentLine ? (
                  <div className="text-center">
                    <p className="text-xl md:text-2xl lg:text-3xl font-bold" style={{ fontFamily: project.custom_font_url ? 'CustomKaraokeFont' : (project.font || 'Arial') }}>
                      {currentLyrics.currentLine.map((w, i) => <SweepWord key={i} word={w.word} sweepPercent={w.sweepPercent} color={getHighlightColor(w.index)} unsungColor={unsungColor} outlineColor={outlineColor} isActive={w.isActive} isPast={w.isPast} showGlow={w.isActive} />)}
                    </p>
                  </div>
                ) : null}
                {currentLyrics.next && <p className="text-sm md:text-base lg:text-lg opacity-50 mt-2" style={{ color: textColor, fontFamily: project.custom_font_url ? 'CustomKaraokeFont' : (project.font || 'Arial'), textShadow: `1px 1px 2px ${outlineColor}` }}>{currentLyrics.next}</p>}
              </div>
              <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/50 rounded text-xs text-white/70 font-mono">{formatTime(currentTime)}</div>
            </div>
            <div onMouseDown={handlePreviewResizeStart} className={`h-3 cursor-ns-resize flex items-center justify-center ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'}`}><GripHorizontal className="w-4 h-4 text-gray-400" /></div>
          </motion.div>

          {/* LINE & WORD EDITOR */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className={`rounded-2xl overflow-hidden mb-4 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}>
            <div onClick={() => setLineEditorExpanded(!lineEditorExpanded)} className={`flex items-center justify-between px-4 py-3 cursor-pointer select-none ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}>
              <div className="flex items-center gap-2">
                {lineEditorExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                <SplitSquareHorizontal className="w-4 h-4 text-cyan-400" />
                <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Line & Word Editor</span>
              </div>
              <span className="text-xs text-gray-500">{lyricsLines.length} lines • {words.length} words</span>
            </div>
            
            <AnimatePresence>
              {lineEditorExpanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  {/* Selected Word Actions */}
                  {selectedWordIndex !== null && editingWordIndex === null && (
                    <div className={`px-4 py-2 border-t ${isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-gray-500">Selected: "{words[selectedWordIndex]?.word}"</span>
                        <div className="flex gap-1 flex-wrap">
                          {selectedWordIndex > 0 && <button onClick={() => moveWordDown(selectedWordIndex)} className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 flex items-center gap-1"><ArrowDown className="w-3 h-3" />Move to Next Line</button>}
                          <button onClick={() => setShowAddWordModal(true)} className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 rounded hover:bg-purple-500/30 flex items-center gap-1"><Plus className="w-3 h-3" />Add Word</button>
                          <button onClick={deleteSelectedWord} className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 flex items-center gap-1"><Trash2 className="w-3 h-3" />Delete</button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                    {/* Left: Line Editor */}
                    <div className={`p-4 overflow-y-auto ${isDark ? 'border-r border-white/10' : 'border-r border-gray-200'}`} style={{ maxHeight: editorHeight }}>
                      <div className="text-xs text-gray-500 mb-2">Double-click word to edit • Click to select</div>
                      <div className="space-y-2">
                        {lyricsLines.map((line, lineIndex) => {
                          const lineTooLong = isLineTooLong(line);
                          const charCount = line.reduce((sum, w) => sum + w.word.length + 1, 0);
                          
                          return (
                            <div key={lineIndex} className="group">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs text-gray-500 w-6">{lineIndex + 1}</span>
                                {lineIndex > 0 && <button onClick={() => mergeLineUp(lineIndex)} className="opacity-0 group-hover:opacity-100 px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded hover:bg-purple-500/30 flex items-center gap-1"><ArrowUp className="w-3 h-3" />Merge Up</button>}
                                {line.length > 1 && <button onClick={() => mergeLineDown(lineIndex)} className="opacity-0 group-hover:opacity-100 px-2 py-0.5 text-xs bg-orange-500/20 text-orange-400 rounded hover:bg-orange-500/30 flex items-center gap-1"><ArrowDown className="w-3 h-3" />Merge Down</button>}
                                {line.length > 1 && <button onClick={() => mergeDownToNewLine(lineIndex)} className="opacity-0 group-hover:opacity-100 px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 flex items-center gap-1"><ArrowDown className="w-3 h-3" />To New Line</button>}
                                {lineTooLong && <LineLengthWarning lineIndex={lineIndex} wordCount={line.length} charCount={charCount} />}
                              </div>
                              <div className={`flex flex-wrap items-center gap-1 p-2 rounded-lg ${lineTooLong ? 'bg-yellow-500/10 border border-yellow-500/30' : isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
                                {line.map((wordData, wordIndex) => {
                                  const isSelected = selectedWordIndex === wordData.globalIndex;
                                  const isEditing = editingWordIndex === wordData.globalIndex;
                                  const isLastInLine = wordIndex === line.length - 1;
                                  const isCurrent = isWordCurrent(wordData);
                                  
                                  return (
                                    <span key={wordData.globalIndex} className="inline-flex items-center">
                                      {isEditing ? (
                                        <input ref={editInputRef} type="text" value={editingText} onChange={(e) => setEditingText(e.target.value)} onBlur={saveWordEdit} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveWordEdit(); } if (e.key === 'Escape') { e.preventDefault(); cancelWordEdit(); }}} className="px-2 py-1 rounded text-sm bg-cyan-500/30 text-white border-2 border-cyan-500 focus:outline-none min-w-[60px]" style={{ width: `${Math.max(60, editingText.length * 10)}px` }} />
                                      ) : (
                                        <button onClick={() => handleWordClick(wordData.globalIndex)} onDoubleClick={(e) => handleWordDoubleClick(wordData.globalIndex, e)} className={`px-2 py-1 rounded text-sm transition-all ${isSelected ? 'bg-cyan-500/30 text-cyan-300 ring-2 ring-cyan-500' : isCurrent ? 'bg-green-500/30 text-green-300' : wordData.confidence !== undefined && wordData.confidence < 0.5 ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30' : isDark ? 'hover:bg-white/10 text-gray-300' : 'hover:bg-gray-200 text-gray-700'}`} title={`${wordData.start.toFixed(2)}s - ${wordData.end.toFixed(2)}s`}>{wordData.word}</button>
                                      )}
                                      {isLastInLine && lineIndex < lyricsLines.length - 1 && <span className="ml-1 w-1 h-4 bg-cyan-500 rounded-full" title="Line break" />}
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
                      <div className="flex items-center gap-2 mb-2"><Type className="w-4 h-4 text-gray-400" /><span className="text-xs font-medium text-gray-400">Original Lyrics</span></div>
                      <div className={`p-3 rounded-lg text-sm ${isDark ? 'bg-white/5 text-gray-300' : 'bg-gray-50 text-gray-700'}`}>
                        {originalLyricsText ? <pre className="whitespace-pre-wrap font-sans">{originalLyricsText}</pre> : <p className="text-gray-500 italic">No original lyrics</p>}
                      </div>
                    </div>
                  </div>
                  
                  {/* Editor Resize Handle */}
                  <div onMouseDown={handleEditorResizeStart} className={`h-3 cursor-ns-resize flex items-center justify-center ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'}`}><GripHorizontal className="w-4 h-4 text-gray-400" /></div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* TIMELINE EDITOR */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={`rounded-2xl overflow-hidden mb-4 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}>
            <div className={`flex items-center justify-between px-4 py-3 ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}>
              <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => setTimelineEditorExpanded(!timelineEditorExpanded)}>
                {timelineEditorExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                <Music2 className="w-4 h-4 text-cyan-400" />
                <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Timeline Editor</span>
              </div>
              <button onClick={() => { setIsDuetMode(!isDuetMode); setHasChanges(true); if (!isDuetMode && !timelineEditorExpanded) setTimelineEditorExpanded(true); }} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${isDuetMode ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-red-500/20 text-red-400 border border-red-500/50'}`}>{isDuetMode ? 'Duet Mode On' : 'Duet Mode Off'}</button>
            </div>

            <AnimatePresence>
              {timelineEditorExpanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  {/* Duet Colors */}
                  {isDuetMode && (
                    <div className={`px-4 py-3 border-t ${isDark ? 'border-white/10 bg-gradient-to-r from-cyan-500/10 to-pink-500/10' : 'border-gray-200 bg-gradient-to-r from-cyan-50 to-pink-50'}`}>
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Singer 1:</span>
                          <input type="color" value={duetColors.singer1} onChange={(e) => { setDuetColors(p => ({ ...p, singer1: e.target.value })); setHasChanges(true); }} className="w-8 h-8 rounded cursor-pointer" />
                          <button onClick={() => setPaintMode(paintMode === SINGER.SINGER_1 ? null : SINGER.SINGER_1)} className={`px-2 py-1 text-xs rounded ${paintMode === SINGER.SINGER_1 ? 'bg-cyan-500 text-white' : 'bg-white/10 text-gray-400'}`}>{paintMode === SINGER.SINGER_1 ? 'Painting...' : 'Paint'}</button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Singer 2:</span>
                          <input type="color" value={duetColors.singer2} onChange={(e) => { setDuetColors(p => ({ ...p, singer2: e.target.value })); setHasChanges(true); }} className="w-8 h-8 rounded cursor-pointer" />
                          <button onClick={() => setPaintMode(paintMode === SINGER.SINGER_2 ? null : SINGER.SINGER_2)} className={`px-2 py-1 text-xs rounded ${paintMode === SINGER.SINGER_2 ? 'bg-pink-500 text-white' : 'bg-white/10 text-gray-400'}`}>{paintMode === SINGER.SINGER_2 ? 'Painting...' : 'Paint'}</button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Both:</span>
                          <input type="color" value={duetColors.both} onChange={(e) => { setDuetColors(p => ({ ...p, both: e.target.value })); setHasChanges(true); }} className="w-8 h-8 rounded cursor-pointer" />
                          <button onClick={() => setPaintMode(paintMode === SINGER.BOTH ? null : SINGER.BOTH)} className={`px-2 py-1 text-xs rounded ${paintMode === SINGER.BOTH ? 'bg-yellow-500 text-white' : 'bg-white/10 text-gray-400'}`}>{paintMode === SINGER.BOTH ? 'Painting...' : 'Paint'}</button>
                        </div>
                        {paintMode !== null && <button onClick={() => setPaintMode(null)} className="px-2 py-1 text-xs bg-gray-500 text-white rounded">Stop</button>}
                      </div>
                    </div>
                  )}

                  {/* Zoom */}
                  <div className={`px-4 py-2 border-t ${isDark ? 'border-white/10' : 'border-gray-200'} flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <button onClick={zoomOut} className={`p-1.5 rounded ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'}`}><ZoomOut className="w-4 h-4" /></button>
                      <span className="text-xs text-gray-500 w-16 text-center">{zoom.toFixed(0)}px/s</span>
                      <button onClick={zoomIn} className={`p-1.5 rounded ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'}`}><ZoomIn className="w-4 h-4" /></button>
                    </div>
                    <span className="text-xs text-gray-500">Drag words • Arrow keys to nudge</span>
                  </div>

                  {/* Timeline - MATCHING ORIGINAL */}
                  <div ref={timelineContainerRef} className={`relative overflow-hidden cursor-pointer ${isDark ? 'bg-gray-900/50' : 'bg-gray-50'}`} style={{ height: TIMELINE_HEIGHT }} onClick={handleTimelineClick}>
                    {/* Time Markers */}
                    <div className="absolute bottom-0 left-0 right-0 h-6 border-t border-white/10">
                      {timeMarkers.map(({ time, isMajor }) => {
                        const containerWidth = timelineContainerRef.current?.offsetWidth || 800;
                        const centerX = containerWidth / 2;
                        const offset = centerX + (time - currentTime) * zoom;
                        return (
                          <div key={time} className="absolute bottom-0 flex flex-col items-center" style={{ left: offset, transform: 'translateX(-50%)' }}>
                            <div className={`${isMajor ? 'h-4 w-0.5 bg-gray-400' : 'h-2 w-px bg-gray-600'}`} />
                            {isMajor && <span className="text-[10px] text-gray-500 mt-0.5">{formatTimeShort(time)}</span>}
                          </div>
                        );
                      })}
                    </div>

                    {/* Playhead */}
                    <div className="absolute top-0 bottom-6 w-0.5 bg-cyan-400 z-30 pointer-events-none" style={{ left: '50%', transform: 'translateX(-50%)', boxShadow: '0 0 15px rgba(0, 212, 255, 0.7)' }}>
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-cyan-400" />
                    </div>

                    {/* Words - MATCHING ORIGINAL POSITIONING */}
                    {words.map((word, index) => {
                      const containerWidth = timelineContainerRef.current?.offsetWidth || 800;
                      const centerX = containerWidth / 2;
                      const wordX = centerX + (word.start - currentTime) * zoom;
                      const wordWidth = Math.max(40, (word.end - word.start) * zoom);
                      
                      if (wordX + wordWidth < -100 || wordX > containerWidth + 100) return null;
                      
                      const isSelected = selectedWordIndex === index;
                      const isCurrent = isWordCurrent(word);

                      return (
                        <motion.div key={index} className="absolute cursor-pointer select-none" style={{ left: wordX, width: wordWidth, height: WORD_HEIGHT, top: (TIMELINE_HEIGHT - 24 - WORD_HEIGHT) / 2 }}
                          onClick={(e) => { e.stopPropagation(); handleWordClick(index); }}
                          onMouseDown={(e) => handleTimelineWordMouseDown(index, e)}
                          onMouseEnter={() => handleTimelineWordMouseEnter(index)}>
                          <div className={`h-full rounded-lg border-2 flex items-center justify-center px-2 overflow-hidden transition-all ${isSelected ? 'border-cyan-400 shadow-lg shadow-cyan-500/30 bg-cyan-500/20' : isCurrent ? 'border-white/40 bg-white/15' : 'border-white/10 bg-white/5 hover:bg-white/10'}`} style={{ backdropFilter: 'blur(4px)' }}>
                            <span className="text-xs font-medium truncate" style={{ color: getWordColor(word, isSelected, isCurrent) }}>{word.word}</span>
                          </div>
                          {word.lineBreak && <div className="absolute -right-0.5 top-0 bottom-0 w-1 bg-cyan-500 rounded-full" />}
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Playback */}
                  <div className={`px-4 py-3 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <button onClick={restart} className={`p-2 rounded-lg ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'}`}><SkipBack className="w-4 h-4" /></button>
                        <button onClick={togglePlayback} className={`p-3 rounded-xl ${isPlaying ? 'bg-red-500 hover:bg-red-600' : 'bg-cyan-500 hover:bg-cyan-600'} text-white`}>{isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}</button>
                      </div>
                      <div className="flex-1 flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-12">{formatTime(currentTime)}</span>
                        <div onClick={handleProgressClick} className="flex-1 h-2 bg-white/10 rounded-full cursor-pointer overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
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
                <button onClick={resetToOriginal} disabled={!hasChanges} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${hasChanges ? isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700' : 'bg-gray-500/20 text-gray-500 cursor-not-allowed'}`}><RotateCcw className="w-4 h-4" />Reset</button>
                <button onClick={saveChanges} disabled={saving || !hasChanges} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${hasChanges ? 'bg-cyan-500 hover:bg-cyan-600 text-white' : 'bg-gray-500/20 text-gray-500 cursor-not-allowed'}`}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save</button>
              </div>
              <button onClick={handleApproveAndRender} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:opacity-90">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Approve & Render</button>
            </div>
          </motion.div>
        </main>
      </div>
    </>
  );
}