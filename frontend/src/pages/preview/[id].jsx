'use client';

/**
 * Preview/Edit Page - Karatrack Studio (V6)
 * 
 * V6 UPDATES:
 * - DRAG TO PAINT: Click and drag across multiple words to paint them all
 * - CLICK ANYWHERE TO SEEK: Click anywhere in timeline area (above/below/between words) to seek
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Play, Pause, SkipBack, Mic, Music2, Save, RotateCcw,
  ZoomIn, ZoomOut, Users, Check, X, Edit3, Loader2, AlertCircle,
  CheckCircle, Maximize2, Minimize2, Plus, Trash2, Paintbrush
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

export default function PreviewPage() {
  const router = useRouter();
  const { id } = router.query;
  const { isDark } = useTheme();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [words, setWords] = useState([]);
  const [originalWords, setOriginalWords] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);

  const [selectedWordIndices, setSelectedWordIndices] = useState([]);
  const [editingWordIndex, setEditingWordIndex] = useState(null);
  const [editingText, setEditingText] = useState('');

  const [showAddWordModal, setShowAddWordModal] = useState(false);
  const [addWordPosition, setAddWordPosition] = useState('after');
  const [newWordText, setNewWordText] = useState('');

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [instrumentalVolume, setInstrumentalVolume] = useState(0.8);
  const [vocalsVolume, setVocalsVolume] = useState(0.5);
  const [instrumentalMuted, setInstrumentalMuted] = useState(false);
  const [vocalsMuted, setVocalsMuted] = useState(true);

  const [zoom, setZoom] = useState(PIXELS_PER_SECOND_DEFAULT);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTimes, setDragStartTimes] = useState({});

  const [isDuetMode, setIsDuetMode] = useState(false);
  const [duetColors, setDuetColors] = useState(DEFAULT_DUET_COLORS);
  const [showDuetPanel, setShowDuetPanel] = useState(false);
  
  // PAINT MODE
  const [paintMode, setPaintMode] = useState(null);
  const [isPainting, setIsPainting] = useState(false); // Track if mouse is down for drag-painting
  const [paintedIndices, setPaintedIndices] = useState(new Set()); // Track already painted words in this drag

  const [previewExpanded, setPreviewExpanded] = useState(false);

  const instrumentalRef = useRef(null);
  const vocalsRef = useRef(null);
  const animationFrameRef = useRef(null);
  const timelineContainerRef = useRef(null);

  const groupedLines = useCallback(() => {
    if (!words.length) return [];
    
    const hasLineProperty = words.some(w => w.line !== undefined);
    
    if (hasLineProperty) {
      const lineMap = {};
      words.forEach((word, idx) => {
        const lineNum = word.line || 0;
        if (!lineMap[lineNum]) lineMap[lineNum] = [];
        lineMap[lineNum].push({ ...word, index: idx });
      });
      return Object.keys(lineMap).sort((a, b) => a - b).map(k => lineMap[k]);
    } else {
      const lines = [];
      let currentLine = [];
      
      words.forEach((word, idx) => {
        currentLine.push({ ...word, index: idx });
        
        const nextWord = words[idx + 1];
        const gap = nextWord ? nextWord.start - word.end : 0;
        
        if (gap > 0.5 || currentLine.length >= 8 || word.lineBreak) {
          lines.push(currentLine);
          currentLine = [];
        }
      });
      
      if (currentLine.length > 0) lines.push(currentLine);
      return lines;
    }
  }, [words]);

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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space' && editingWordIndex === null) { e.preventDefault(); togglePlayback(); }
      if (e.code === 'Escape') {
        if (paintMode !== null) { setPaintMode(null); }
        else if (showAddWordModal) { setShowAddWordModal(false); setNewWordText(''); }
        else if (editingWordIndex !== null) { setEditingWordIndex(null); setEditingText(''); }
        else setSelectedWordIndices([]);
      }
      if ((e.code === 'Delete' || e.code === 'Backspace') && selectedWordIndices.length > 0 && editingWordIndex === null && paintMode === null) {
        e.preventDefault();
        deleteSelectedWords();
      }
      if (selectedWordIndices.length > 0 && editingWordIndex === null && paintMode === null) {
        if (e.code === 'ArrowLeft') { e.preventDefault(); nudgeSelectedWords(e.shiftKey ? -0.1 : -0.05); }
        if (e.code === 'ArrowRight') { e.preventDefault(); nudgeSelectedWords(e.shiftKey ? 0.1 : 0.05); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedWordIndices, editingWordIndex, isPlaying, showAddWordModal, paintMode]);

  // Handle mouse up globally to end paint drag
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

  // TIMELINE CLICK - Always seeks, even in paint mode (when clicking empty space)
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

  // Paint a single word
  const paintWord = useCallback((index) => {
    if (paintMode === null) return;
    setWords(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], singer: paintMode };
      return updated;
    });
    setHasChanges(true);
  }, [paintMode]);

  const handleWordMouseDown = useCallback((index, e) => {
    e.stopPropagation();
    
    if (paintMode !== null) {
      // Start paint drag
      setIsPainting(true);
      setPaintedIndices(new Set([index]));
      paintWord(index);
      return;
    }
    
    // Normal drag behavior for moving words
    if (!selectedWordIndices.includes(index)) setSelectedWordIndices([index]);
    setIsDragging(true);
    setDragStartX(e.clientX);
    const startTimes = {};
    const indicesToDrag = selectedWordIndices.includes(index) ? selectedWordIndices : [index];
    indicesToDrag.forEach(i => { startTimes[i] = { start: words[i].start, end: words[i].end }; });
    setDragStartTimes(startTimes);
  }, [selectedWordIndices, words, paintMode, paintWord]);

  const handleWordMouseEnter = useCallback((index) => {
    // Paint on hover while dragging in paint mode
    if (isPainting && paintMode !== null && !paintedIndices.has(index)) {
      setPaintedIndices(prev => new Set([...prev, index]));
      paintWord(index);
    }
  }, [isPainting, paintMode, paintedIndices, paintWord]);

  const handleWordClick = useCallback((index, e) => {
    e.stopPropagation();
    
    // In paint mode, painting is handled by mousedown/mouseenter
    if (paintMode !== null) return;
    
    // Normal selection mode
    if (e.shiftKey && selectedWordIndices.length > 0) {
      const lastSelected = selectedWordIndices[selectedWordIndices.length - 1];
      const start = Math.min(lastSelected, index);
      const end = Math.max(lastSelected, index);
      const range = [];
      for (let i = start; i <= end; i++) range.push(i);
      setSelectedWordIndices(range);
    } else if (e.ctrlKey || e.metaKey) {
      if (selectedWordIndices.includes(index)) setSelectedWordIndices(selectedWordIndices.filter(i => i !== index));
      else setSelectedWordIndices([...selectedWordIndices, index]);
    } else {
      setSelectedWordIndices([index]);
    }
  }, [selectedWordIndices, paintMode]);

  const handleWordDoubleClick = useCallback((index, e) => {
    e.stopPropagation();
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
        sortedIndices.forEach(index => {
          updated.splice(index, 1);
        });
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
    
    let newWord;
    if (addWordPosition === 'before') {
      const midPoint = selectedWord.start + (selectedWord.end - selectedWord.start) / 2;
      newWord = {
        word: newWordText.trim(),
        start: selectedWord.start,
        end: midPoint,
        confidence: 1.0
      };
      setWords(prev => {
        const updated = [...prev];
        updated[selectedIndex] = { ...updated[selectedIndex], start: midPoint };
        updated.splice(selectedIndex, 0, newWord);
        return updated;
      });
    } else {
      const midPoint = selectedWord.start + (selectedWord.end - selectedWord.start) / 2;
      newWord = {
        word: newWordText.trim(),
        start: midPoint,
        end: selectedWord.end,
        confidence: 1.0
      };
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

  // Word dragging (for timing adjustment, not painting)
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging || paintMode !== null) return;
      const deltaX = e.clientX - dragStartX;
      const deltaTime = deltaX / zoom;
      setWords(prev => {
        const updated = [...prev];
        Object.keys(dragStartTimes).forEach(indexStr => {
          const index = parseInt(indexStr);
          const original = dragStartTimes[index];
          const newStart = Math.max(0, original.start + deltaTime);
          const wordDuration = original.end - original.start;
          updated[index] = { ...updated[index], start: newStart, end: newStart + wordDuration };
        });
        return updated;
      });
    };
    const handleMouseUp = () => {
      if (isDragging) { setIsDragging(false); setDragStartTimes({}); setHasChanges(true); }
    };
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStartX, dragStartTimes, zoom, paintMode]);

  const togglePaintMode = useCallback((singer) => {
    if (paintMode === singer) {
      setPaintMode(null);
    } else {
      setPaintMode(singer);
      setSelectedWordIndices([]);
    }
  }, [paintMode]);

  const assignSinger = useCallback((singer) => {
    if (selectedWordIndices.length === 0) return;
    setWords(prev => {
      const updated = [...prev];
      selectedWordIndices.forEach(index => { updated[index] = { ...updated[index], singer }; });
      return updated;
    });
    setHasChanges(true);
  }, [selectedWordIndices]);

  const resetToOriginal = useCallback(() => {
    if (window.confirm('Reset all changes?')) {
      setWords(JSON.parse(JSON.stringify(originalWords)));
      setSelectedWordIndices([]);
      setHasChanges(false);
      setPaintMode(null);
    }
  }, [originalWords]);

  const saveChanges = useCallback(async () => {
    if (!project) return;
    setSaving(true);
    try {
      const { error: updateError } = await supabase.from('projects').update({
        lyrics_json: words, is_duet_mode: isDuetMode,
        duet_singer1_color: duetColors.singer1, duet_singer2_color: duetColors.singer2,
        duet_both_color: duetColors.both, updated_at: new Date().toISOString()
      }).eq('id', project.id);
      if (updateError) throw updateError;
      setOriginalWords(JSON.parse(JSON.stringify(words)));
      setHasChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) { console.error('Save error:', err); setError('Failed to save'); }
    finally { setSaving(false); }
  }, [project, words, isDuetMode, duetColors]);

  const proceedToRender = useCallback(async () => {
    if (hasChanges) await saveChanges();
    await supabase.from('projects').update({ status: 'rendering', lyrics_json: words }).eq('id', project.id);
    router.push('/dashboard');
  }, [hasChanges, saveChanges, project, words, router]);

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

  const getCurrentLyrics = useCallback(() => {
    const lines = groupedLines();
    if (!lines.length) return { currentLine: null, next: '' };
    
    let currentLineIdx = -1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (let j = 0; j < line.length; j++) {
        const word = line[j];
        if (currentTime >= word.start && currentTime <= word.end) {
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
          if (i === 0) {
            return { currentLine: null, next: line.map(w => w.word).join(' ') };
          }
          const prevLine = lines[i - 1];
          const lastWordEnd = prevLine[prevLine.length - 1].end;
          if (currentTime - lastWordEnd > 2) {
            return { currentLine: null, next: line.map(w => w.word).join(' ') };
          }
          const currentLineText = prevLine.map(w => ({
            word: w.word,
            index: w.index,
            isActive: false,
            isPast: true
          }));
          return { currentLine: currentLineText, next: line.map(w => w.word).join(' ') };
        }
        if (line.length > 0 && line[line.length - 1].end >= currentTime) {
          currentLineIdx = i;
          break;
        }
      }
      
      if (currentLineIdx === -1) {
        if (lines.length > 0) {
          const lastLine = lines[lines.length - 1];
          const lastWordEnd = lastLine[lastLine.length - 1].end;
          if (currentTime - lastWordEnd > 2) {
            return { currentLine: null, next: '' };
          }
          const currentLineText = lastLine.map(w => ({
            word: w.word,
            index: w.index,
            isActive: false,
            isPast: true
          }));
          return { currentLine: currentLineText, next: '' };
        }
        return { currentLine: null, next: '' };
      }
    }

    const line = lines[currentLineIdx];
    const currentLineText = line.map(w => ({
      word: w.word,
      index: w.index,
      isActive: currentTime >= w.start && currentTime <= w.end,
      isPast: currentTime > w.end
    }));

    const nextLine = lines[currentLineIdx + 1];
    const nextText = nextLine ? nextLine.map(w => w.word).join(' ') : '';
    
    return { currentLine: currentLineText, next: nextText };
  }, [groupedLines, currentTime]);

  const zoomIn = () => setZoom(prev => Math.min(prev * 1.25, 300));
  const zoomOut = () => setZoom(prev => Math.max(prev / 1.25, 30));

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
  const containerWidth = timelineContainerRef.current?.offsetWidth || 800;

  return (
    <>
      <SEO title={`Edit: ${project.title} | Karatrack Studio`} description="Edit lyrics timing" />

      <audio ref={instrumentalRef} src={project.processed_audio_url} onLoadedMetadata={handleAudioLoaded} onEnded={() => setIsPlaying(false)} preload="auto" />
      {project.vocals_audio_url && <audio ref={vocalsRef} src={project.vocals_audio_url} preload="auto" muted={vocalsMuted} />}

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
                  type="text"
                  value={newWordText}
                  onChange={(e) => setNewWordText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addNewWord(); if (e.key === 'Escape') { setShowAddWordModal(false); setNewWordText(''); } }}
                  placeholder="Enter word..."
                  autoFocus
                  className={`w-full px-4 py-2 rounded-lg text-sm ${isDark ? 'bg-white/5 border border-white/10 text-white' : 'bg-gray-50 border border-gray-200 text-gray-900'} focus:outline-none focus:ring-2 focus:ring-cyan-500`}
                />
                <p className="text-xs text-gray-500 mt-2">
                  The new word will share timing with the selected word.
                </p>
              </div>
              
              <div className="flex gap-2">
                <button onClick={() => { setShowAddWordModal(false); setNewWordText(''); }} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'}`}>
                  Cancel
                </button>
                <button onClick={addNewWord} disabled={!newWordText.trim()} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${newWordText.trim() ? 'bg-cyan-500 text-white hover:bg-cyan-600' : 'bg-gray-500 text-gray-300 cursor-not-allowed'}`}>
                  Add Word
                </button>
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

        <main className="relative z-10 px-4 py-4 max-w-7xl mx-auto">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className={`p-2 rounded-xl ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'}`}>
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{project.title}</h1>
                <p className="text-sm text-gray-500">Edit lyrics timing and text</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {paintMode !== null && (
                <span className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 text-purple-400 text-xs rounded-lg animate-pulse">
                  <Paintbrush className="w-3 h-3" />
                  Paint Mode - Click/drag words
                </span>
              )}
              {hasChanges && <span className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-lg"><AlertCircle className="w-3 h-3" />Unsaved</span>}
              <AnimatePresence>
                {saveSuccess && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 text-green-400 text-xs rounded-lg"><CheckCircle className="w-3 h-3" />Saved!</motion.span>}
              </AnimatePresence>
              <button onClick={() => setShowDuetPanel(!showDuetPanel)} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium ${isDuetMode ? 'bg-gradient-to-r from-cyan-500/20 to-pink-500/20 border border-cyan-400/50 text-cyan-400' : isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'}`}>
                <Users className="w-4 h-4" />Duet{isDuetMode && <Check className="w-3 h-3" />}
              </button>
              <button onClick={resetToOriginal} className={`p-2 rounded-xl ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'}`} title="Reset"><RotateCcw className="w-4 h-4" /></button>
              <button onClick={saveChanges} disabled={saving || !hasChanges} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${hasChanges ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:opacity-90' : isDark ? 'bg-white/10 text-gray-500 cursor-not-allowed' : 'bg-black/10 text-gray-400 cursor-not-allowed'}`}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save
              </button>
            </div>
          </motion.div>

          {/* Duet Panel */}
          <AnimatePresence>
            {showDuetPanel && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-4">
                <div className={`p-4 rounded-2xl ${isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Duet Mode Colors</h3>
                      <span className="text-xs text-gray-500">(Click & drag to paint words)</span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-xs text-gray-500">Enable</span>
                      <div onClick={() => { setIsDuetMode(!isDuetMode); setHasChanges(true); setPaintMode(null); }} className={`relative w-10 h-5 rounded-full cursor-pointer ${isDuetMode ? 'bg-gradient-to-r from-cyan-500 to-pink-500' : 'bg-gray-600'}`}>
                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${isDuetMode ? 'translate-x-5' : ''}`} />
                      </div>
                    </label>
                  </div>
                  {isDuetMode && (
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Singer 1</label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={duetColors.singer1} onChange={(e) => { setDuetColors(prev => ({ ...prev, singer1: e.target.value })); setHasChanges(true); }} className="w-8 h-8 rounded cursor-pointer border-0" />
                          <button 
                            onClick={() => togglePaintMode(SINGER.SINGER_1)} 
                            className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                              paintMode === SINGER.SINGER_1 
                                ? 'bg-cyan-500 text-white ring-2 ring-cyan-300' 
                                : 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/50'
                            }`}
                          >
                            <Paintbrush className="w-3 h-3" />
                            {paintMode === SINGER.SINGER_1 ? 'Painting...' : 'Paint'}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Singer 2</label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={duetColors.singer2} onChange={(e) => { setDuetColors(prev => ({ ...prev, singer2: e.target.value })); setHasChanges(true); }} className="w-8 h-8 rounded cursor-pointer border-0" />
                          <button 
                            onClick={() => togglePaintMode(SINGER.SINGER_2)} 
                            className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                              paintMode === SINGER.SINGER_2 
                                ? 'bg-pink-500 text-white ring-2 ring-pink-300' 
                                : 'bg-pink-500/20 text-pink-400 hover:bg-pink-500/30 border border-pink-500/50'
                            }`}
                          >
                            <Paintbrush className="w-3 h-3" />
                            {paintMode === SINGER.SINGER_2 ? 'Painting...' : 'Paint'}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Both</label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={duetColors.both} onChange={(e) => { setDuetColors(prev => ({ ...prev, both: e.target.value })); setHasChanges(true); }} className="w-8 h-8 rounded cursor-pointer border-0" />
                          <button 
                            onClick={() => togglePaintMode(SINGER.BOTH)} 
                            className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                              paintMode === SINGER.BOTH 
                                ? 'bg-yellow-500 text-white ring-2 ring-yellow-300' 
                                : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/50'
                            }`}
                          >
                            <Paintbrush className="w-3 h-3" />
                            {paintMode === SINGER.BOTH ? 'Painting...' : 'Paint'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {paintMode !== null && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <p className="text-xs text-gray-400">
                        Click and drag across words to paint them. Press <kbd className="px-1 py-0.5 bg-white/10 rounded text-[10px]">Esc</kbd> or click the paint button again to exit.
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* VIDEO PREVIEW */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl overflow-hidden mb-4 ${isDark ? 'bg-black/40 border border-white/10' : 'bg-white border border-gray-200'}`}>
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
              <span className="text-xs font-medium text-gray-400">Video Preview</span>
              <button onClick={() => setPreviewExpanded(!previewExpanded)} className="p-1 rounded hover:bg-white/10">
                {previewExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
            <div className={`relative transition-all duration-300 ${previewExpanded ? 'h-80' : 'h-48'}`} style={getPreviewBackground()}>
              {project.bg_video_url && <video className="absolute inset-0 w-full h-full object-cover opacity-50" src={project.bg_video_url} autoPlay loop muted playsInline />}
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
                <div className="text-center mb-4">
                  {currentLyrics.currentLine ? (
                    <p className="text-2xl md:text-3xl font-bold" style={{ fontFamily: project.font || 'Arial' }}>
                      {currentLyrics.currentLine.map((wordData, i) => {
                        let wordColor;
                        if (isDuetMode && words[wordData.index]?.singer !== undefined) {
                          const singer = words[wordData.index].singer;
                          if (singer === SINGER.SINGER_1) wordColor = duetColors.singer1;
                          else if (singer === SINGER.SINGER_2) wordColor = duetColors.singer2;
                          else wordColor = duetColors.both;
                        } else {
                          wordColor = (wordData.isActive || wordData.isPast)
                            ? (project.sung_color || '#00d4ff')
                            : (project.text_color || '#ffffff');
                        }
                        return (
                          <span key={i} className="mx-1 transition-colors duration-150" style={{
                            color: wordColor,
                            textShadow: `2px 2px 4px ${project.outline_color || '#000000'}`
                          }}>{wordData.word}</span>
                        );
                      })}
                    </p>
                  ) : (
                    <p className="text-2xl md:text-3xl font-bold opacity-50" style={{ color: project.text_color || '#ffffff', textShadow: `2px 2px 4px ${project.outline_color || '#000000'}` }}>♪ ♪ ♪</p>
                  )}
                </div>
                {currentLyrics.next && <p className="text-lg md:text-xl opacity-50" style={{ color: project.text_color || '#ffffff', fontFamily: project.font || 'Arial', textShadow: `1px 1px 2px ${project.outline_color || '#000000'}` }}>{currentLyrics.next}</p>}
              </div>
              <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/50 rounded text-xs text-white/70 font-mono">{formatTime(currentTime)}</div>
            </div>
          </motion.div>

          {/* TIMELINE EDITOR */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={`rounded-2xl overflow-hidden ${isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}>
            <div className={`flex items-center justify-between px-4 py-2 border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
              <span className="text-xs font-medium text-gray-400">Timeline Editor</span>
              <div className="flex items-center gap-2">
                <button onClick={zoomOut} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10" title="Zoom out"><ZoomOut className="w-4 h-4" /></button>
                <span className="text-xs text-gray-500 min-w-[50px] text-center">{Math.round(zoom)}px/s</span>
                <button onClick={zoomIn} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10" title="Zoom in"><ZoomIn className="w-4 h-4" /></button>
              </div>
            </div>

            <div 
              ref={timelineContainerRef} 
              className={`relative overflow-hidden cursor-pointer ${isDark ? 'bg-gray-900/50' : 'bg-gray-50'}`} 
              style={{ height: TIMELINE_HEIGHT }} 
              onClick={handleTimelineClick}
            >
              {/* CENTERED PLAYHEAD */}
              <div className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 z-30 pointer-events-none" style={{ left: '50%', transform: 'translateX(-50%)', boxShadow: '0 0 15px rgba(0, 212, 255, 0.7)' }}>
                <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-cyan-400" />
              </div>

              {/* Time markers */}
              <div className="absolute top-0 left-0 right-0 h-6 pointer-events-none" style={{ background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.8)' }}>
                {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => {
                  const offset = (i - currentTime) * zoom;
                  const position = containerWidth / 2 + offset;
                  if (position < -100 || position > containerWidth + 100) return null;
                  return (
                    <div key={i} className="absolute top-0 h-full flex flex-col justify-end" style={{ left: position }}>
                      <div className={`w-px h-2 ${isDark ? 'bg-white/30' : 'bg-gray-400'}`} />
                      <span className="text-[10px] text-gray-500 ml-1">{formatTime(i)}</span>
                    </div>
                  );
                })}
              </div>

              {/* Words */}
              {words.map((word, index) => {
                const isSelected = selectedWordIndices.includes(index);
                const isCurrent = isWordCurrent(word);
                const isEditing = editingWordIndex === index;
                const wordWidth = Math.max((word.end - word.start) * zoom, 35);
                const timeOffset = word.start - currentTime;
                const wordLeft = containerWidth / 2 + (timeOffset * zoom);
                if (wordLeft + wordWidth < -100 || wordLeft > containerWidth + 100) return null;

                return (
                  <motion.div 
                    key={index} 
                    className={`absolute select-none ${paintMode !== null ? 'cursor-crosshair' : isDragging && isSelected ? 'cursor-grabbing' : 'cursor-grab'}`}
                    style={{ left: wordLeft, top: '50%', transform: 'translateY(-50%)', width: wordWidth, height: WORD_HEIGHT, zIndex: isSelected ? 15 : isCurrent ? 10 : 5 }}
                    onClick={(e) => handleWordClick(index, e)} 
                    onDoubleClick={(e) => handleWordDoubleClick(index, e)} 
                    onMouseDown={(e) => handleWordMouseDown(index, e)}
                    onMouseEnter={() => handleWordMouseEnter(index)}
                  >
                    <div className={`h-full rounded-lg border-2 flex items-center justify-center px-2 overflow-hidden transition-all ${isSelected ? 'border-cyan-400 shadow-lg shadow-cyan-500/30 bg-cyan-500/20' : isCurrent ? 'border-white/40 bg-white/15' : 'border-white/10 bg-white/5 hover:bg-white/10'}`} style={{ backdropFilter: 'blur(4px)' }}>
                      {isEditing ? (
                        <input type="text" value={editingText} onChange={(e) => setEditingText(e.target.value)}
                          onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') saveWordEdit(); if (e.key === 'Escape') { setEditingWordIndex(null); setEditingText(''); } }}
                          onBlur={saveWordEdit} onClick={(e) => e.stopPropagation()} autoFocus
                          className="w-full h-full bg-transparent text-center text-sm font-medium outline-none border-none text-cyan-300" />
                      ) : (
                        <span className="text-xs font-medium truncate" style={{ color: getWordColor(word, isSelected, isCurrent) }}>{word.word}</span>
                      )}
                    </div>
                    {word.confidence && word.confidence < 0.8 && !isSelected && <div className="absolute -top-1 -right-1 w-2 h-2 bg-orange-400 rounded-full" title="Low confidence" />}
                    {isDuetMode && word.singer !== undefined && word.singer !== SINGER.BOTH && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 rounded-full" style={{ backgroundColor: word.singer === SINGER.SINGER_1 ? duetColors.singer1 : duetColors.singer2 }} />
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* AUDIO CONTROLS */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className={`mt-4 p-4 rounded-2xl ${isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}>
            <div className={`h-2 rounded-full ${isDark ? 'bg-white/10' : 'bg-gray-200'} cursor-pointer mb-4 overflow-hidden`} onClick={handleProgressClick}>
              <div className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full transition-all duration-100" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={restart} className={`p-2 rounded-xl ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'}`}><SkipBack className="w-5 h-5" /></button>
                <button onClick={togglePlayback} className="p-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:opacity-90">
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                </button>
                <div className="text-sm font-mono text-gray-400">{formatTime(currentTime)} / {formatTime(duration)}</div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <button onClick={() => { setInstrumentalMuted(!instrumentalMuted); if (instrumentalRef.current) instrumentalRef.current.muted = !instrumentalMuted; }} className={`p-1 rounded ${instrumentalMuted ? 'text-gray-500' : 'text-cyan-400'}`}><Music2 className="w-4 h-4" /></button>
                  <span className="text-xs text-gray-500 w-20">Instrumental</span>
                  <input type="range" min="0" max="1" step="0.01" value={instrumentalVolume} onChange={(e) => { const vol = parseFloat(e.target.value); setInstrumentalVolume(vol); if (instrumentalRef.current) instrumentalRef.current.volume = vol; }} className="w-28 accent-cyan-500" />
                </div>
                {project.vocals_audio_url && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setVocalsMuted(!vocalsMuted); if (vocalsRef.current) vocalsRef.current.muted = !vocalsMuted; }} className={`p-1 rounded ${vocalsMuted ? 'text-gray-500' : 'text-pink-400'}`}><Mic className="w-4 h-4" /></button>
                    <span className="text-xs text-gray-500 w-20">Vocals</span>
                    <input type="range" min="0" max="1" step="0.01" value={vocalsVolume} onChange={(e) => { const vol = parseFloat(e.target.value); setVocalsVolume(vol); if (vocalsRef.current) vocalsRef.current.volume = vol; }} className="w-28 accent-pink-500" />
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Word Editor Panel */}
          <AnimatePresence>
            {selectedWordIndices.length > 0 && paintMode === null && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className={`mt-4 p-4 rounded-2xl ${isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-400">{selectedWordIndices.length} word{selectedWordIndices.length > 1 ? 's' : ''} selected</span>
                    {selectedWordIndices.length === 1 && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500">Start:</span><span className="font-mono text-cyan-400">{words[selectedWordIndices[0]].start.toFixed(2)}s</span>
                        <span className="text-gray-500 ml-2">End:</span><span className="font-mono text-cyan-400">{words[selectedWordIndices[0]].end.toFixed(2)}s</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedWordIndices.length === 1 && (
                      <button onClick={() => setShowAddWordModal(true)} className="flex items-center gap-1 px-3 py-1 text-xs rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/50">
                        <Plus className="w-3 h-3" />Add
                      </button>
                    )}
                    
                    <button onClick={deleteSelectedWords} className="flex items-center gap-1 px-3 py-1 text-xs rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/50">
                      <Trash2 className="w-3 h-3" />Delete
                    </button>
                    
                    <span className="text-xs text-gray-500 ml-2">Nudge:</span>
                    <button onClick={() => nudgeSelectedWords(-0.1)} className={`px-2 py-1 text-xs rounded-lg ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'}`}>-0.1s</button>
                    <button onClick={() => nudgeSelectedWords(-0.05)} className={`px-2 py-1 text-xs rounded-lg ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'}`}>-0.05s</button>
                    <button onClick={() => nudgeSelectedWords(0.05)} className={`px-2 py-1 text-xs rounded-lg ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'}`}>+0.05s</button>
                    <button onClick={() => nudgeSelectedWords(0.1)} className={`px-2 py-1 text-xs rounded-lg ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'}`}>+0.1s</button>
                    {selectedWordIndices.length === 1 && (
                      <button onClick={() => handleWordDoubleClick(selectedWordIndices[0], { stopPropagation: () => {} })} className="flex items-center gap-1 px-3 py-1 text-xs rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 ml-2"><Edit3 className="w-3 h-3" />Edit</button>
                    )}
                    <button onClick={() => setSelectedWordIndices([])} className={`p-1.5 rounded-lg ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'} ml-2`}><X className="w-4 h-4" /></button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Buttons */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-4 flex items-center justify-between">
            <Link href="/dashboard" className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'}`}><ArrowLeft className="w-4 h-4" />Back</Link>
            <button onClick={proceedToRender} className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:opacity-90"><CheckCircle className="w-5 h-5" />Approve & Render Video</button>
          </motion.div>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500"><span className="font-medium">Shortcuts:</span> Space = Play/Pause • ←/→ = Nudge • Delete = Remove • Shift+Click = Range • Double-click = Edit • Esc = Exit • Click timeline = Seek</p>
          </div>
        </main>
      </div>
    </>
  );
}