'use client';

/**
 * Preview/Edit Page - Karatrack Studio (V2)
 * 
 * Place this at: frontend/src/pages/preview/[id].jsx
 * 
 * UPDATES in V2:
 * - CENTERED PLAYHEAD with words scrolling right-to-left
 * - VIDEO PREVIEW panel (top) showing simulated karaoke output
 * - TIMELINE EDITOR (bottom) with words scrolling past fixed playhead
 * - Dual audio tracks with STACKED volume controls
 * - Zoom controls more prominent
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Play, Pause, SkipBack, Mic, Music2, Save, RotateCcw,
  ZoomIn, ZoomOut, Users, Check, X, Edit3, Loader2, AlertCircle,
  CheckCircle, Maximize2, Minimize2
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

  // Project & Lyrics
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [words, setWords] = useState([]);
  const [originalWords, setOriginalWords] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Selection
  const [selectedWordIndices, setSelectedWordIndices] = useState([]);
  const [editingWordIndex, setEditingWordIndex] = useState(null);
  const [editingText, setEditingText] = useState('');

  // Audio
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [instrumentalVolume, setInstrumentalVolume] = useState(0.8);
  const [vocalsVolume, setVocalsVolume] = useState(0.5);
  const [instrumentalMuted, setInstrumentalMuted] = useState(false);
  const [vocalsMuted, setVocalsMuted] = useState(true);

  // Timeline
  const [zoom, setZoom] = useState(PIXELS_PER_SECOND_DEFAULT);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTimes, setDragStartTimes] = useState({});

  // Duet
  const [isDuetMode, setIsDuetMode] = useState(false);
  const [duetColors, setDuetColors] = useState(DEFAULT_DUET_COLORS);
  const [showDuetPanel, setShowDuetPanel] = useState(false);

  // Preview
  const [previewExpanded, setPreviewExpanded] = useState(false);

  // Refs
  const instrumentalRef = useRef(null);
  const vocalsRef = useRef(null);
  const animationFrameRef = useRef(null);
  const timelineContainerRef = useRef(null);

  // Load project
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

  // Animation loop
  useEffect(() => {
    const updateTime = () => {
      if (instrumentalRef.current) setCurrentTime(instrumentalRef.current.currentTime);
      animationFrameRef.current = requestAnimationFrame(updateTime);
    };
    if (isPlaying) animationFrameRef.current = requestAnimationFrame(updateTime);
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [isPlaying]);

  // Sync vocals
  useEffect(() => {
    if (vocalsRef.current && instrumentalRef.current) {
      const diff = Math.abs(vocalsRef.current.currentTime - instrumentalRef.current.currentTime);
      if (diff > 0.1) vocalsRef.current.currentTime = instrumentalRef.current.currentTime;
    }
  }, [currentTime]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space' && editingWordIndex === null) { e.preventDefault(); togglePlayback(); }
      if (e.code === 'Escape') {
        if (editingWordIndex !== null) { setEditingWordIndex(null); setEditingText(''); }
        else setSelectedWordIndices([]);
      }
      if (selectedWordIndices.length > 0 && editingWordIndex === null) {
        if (e.code === 'ArrowLeft') { e.preventDefault(); nudgeSelectedWords(e.shiftKey ? -0.1 : -0.05); }
        if (e.code === 'ArrowRight') { e.preventDefault(); nudgeSelectedWords(e.shiftKey ? 0.1 : 0.05); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedWordIndices, editingWordIndex, isPlaying]);

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

  const handleWordClick = useCallback((index, e) => {
    e.stopPropagation();
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
  }, [selectedWordIndices]);

  const handleWordDoubleClick = useCallback((index, e) => {
    e.stopPropagation();
    setEditingWordIndex(index);
    setEditingText(words[index].word);
    setSelectedWordIndices([index]);
  }, [words]);

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

  const handleWordDragStart = useCallback((index, e) => {
    e.stopPropagation();
    if (!selectedWordIndices.includes(index)) setSelectedWordIndices([index]);
    setIsDragging(true);
    setDragStartX(e.clientX);
    const startTimes = {};
    const indicesToDrag = selectedWordIndices.includes(index) ? selectedWordIndices : [index];
    indicesToDrag.forEach(i => { startTimes[i] = { start: words[i].start, end: words[i].end }; });
    setDragStartTimes(startTimes);
  }, [selectedWordIndices, words]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - dragStartX;
      const deltaTime = -deltaX / zoom;
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
  }, [isDragging, dragStartX, dragStartTimes, zoom]);

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
  if (!words.length) return { currentLine: null, next: '' };
  
  // Find the current or most recent word (handles gaps between words)
  let currentWordIndex = words.findIndex(w => currentTime >= w.start && currentTime <= w.end);
  
  // If not currently on a word, find which line we should be showing
  if (currentWordIndex === -1) {
    // Find the next upcoming word
    const nextWordIndex = words.findIndex(w => w.start > currentTime);
    
    if (nextWordIndex === -1) {
      // Past all words - show nothing
      return { currentLine: null, next: '' };
    }
    
    if (nextWordIndex === 0) {
      // Before first word - show first line as upcoming
      const firstLine = words.filter(w => w.line === words[0].line).map(w => w.word).join(' ');
      return { currentLine: null, next: firstLine };
    }
    
    // Between words - show the line of the previous word (keeps display stable)
    const prevWord = words[nextWordIndex - 1];
    const lineWords = words.filter(w => w.line === prevWord.line);
    const currentLineText = lineWords.map(w => ({
      word: w.word,
      isActive: false,
      isPast: currentTime > w.end
    }));
    const nextLineNum = prevWord.line + 1;
    const nextLineWords = words.filter(w => w.line === nextLineNum);
    return { currentLine: currentLineText, next: nextLineWords.map(w => w.word).join(' ') };
  }
  
  // Currently on a word - show its line
  const currentWord = words[currentWordIndex];
  const lineWords = words.filter(w => w.line === currentWord.line);
  const currentLineText = lineWords.map(w => ({
    word: w.word,
    isActive: currentTime >= w.start && currentTime <= w.end,
    isPast: currentTime > w.end
  }));
  const nextLineWords = words.filter(w => w.line === currentWord.line + 1);
  return { currentLine: currentLineText, next: nextLineWords.map(w => w.word).join(' ') };
}, [words, currentTime]);

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
                    <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Duet Mode Colors</h3>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-xs text-gray-500">Enable</span>
                      <div onClick={() => { setIsDuetMode(!isDuetMode); setHasChanges(true); }} className={`relative w-10 h-5 rounded-full cursor-pointer ${isDuetMode ? 'bg-gradient-to-r from-cyan-500 to-pink-500' : 'bg-gray-600'}`}>
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
                          <button onClick={() => assignSinger(SINGER.SINGER_1)} disabled={selectedWordIndices.length === 0} className={`flex-1 px-2 py-1.5 rounded text-xs font-medium ${selectedWordIndices.length > 0 ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/50' : 'bg-white/5 text-gray-500 cursor-not-allowed'}`}>Assign</button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Singer 2</label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={duetColors.singer2} onChange={(e) => { setDuetColors(prev => ({ ...prev, singer2: e.target.value })); setHasChanges(true); }} className="w-8 h-8 rounded cursor-pointer border-0" />
                          <button onClick={() => assignSinger(SINGER.SINGER_2)} disabled={selectedWordIndices.length === 0} className={`flex-1 px-2 py-1.5 rounded text-xs font-medium ${selectedWordIndices.length > 0 ? 'bg-pink-500/20 text-pink-400 hover:bg-pink-500/30 border border-pink-500/50' : 'bg-white/5 text-gray-500 cursor-not-allowed'}`}>Assign</button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Both</label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={duetColors.both} onChange={(e) => { setDuetColors(prev => ({ ...prev, both: e.target.value })); setHasChanges(true); }} className="w-8 h-8 rounded cursor-pointer border-0" />
                          <button onClick={() => assignSinger(SINGER.BOTH)} disabled={selectedWordIndices.length === 0} className={`flex-1 px-2 py-1.5 rounded text-xs font-medium ${selectedWordIndices.length > 0 ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/50' : 'bg-white/5 text-gray-500 cursor-not-allowed'}`}>Assign</button>
                        </div>
                      </div>
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
                      {currentLyrics.currentLine.map((word, i) => (
                        <span key={i} className="mx-1 transition-colors duration-150" style={{
                          color: word.isActive ? (project.sung_color || '#00d4ff') : word.isPast ? (project.sung_color || '#00d4ff') : (project.text_color || '#ffffff'),
                          textShadow: `2px 2px 4px ${project.outline_color || '#000000'}`
                        }}>{word.word}</span>
                      ))}
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

            <div ref={timelineContainerRef} className={`relative overflow-hidden ${isDark ? 'bg-gray-900/50' : 'bg-gray-50'}`} style={{ height: TIMELINE_HEIGHT }} onClick={handleTimelineClick}>
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
                  <motion.div key={index} className={`absolute select-none ${isDragging && isSelected ? 'cursor-grabbing' : 'cursor-grab'}`}
                    style={{ left: wordLeft, top: '50%', transform: 'translateY(-50%)', width: wordWidth, height: WORD_HEIGHT, zIndex: isSelected ? 15 : isCurrent ? 10 : 5 }}
                    onClick={(e) => handleWordClick(index, e)} onDoubleClick={(e) => handleWordDoubleClick(index, e)} onMouseDown={(e) => handleWordDragStart(index, e)}>
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

              {/* STACKED VOLUME CONTROLS */}
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
            {selectedWordIndices.length > 0 && (
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
                    <span className="text-xs text-gray-500">Nudge:</span>
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
            <p className="text-xs text-gray-500"><span className="font-medium">Shortcuts:</span> Space = Play/Pause • ←/→ = Nudge • Shift+Click = Select range • Double-click = Edit • Esc = Deselect</p>
          </div>
        </main>
      </div>
    </>
  );
}