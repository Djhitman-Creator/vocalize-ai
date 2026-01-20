'use client';

/**
 * Preview/Edit Page - Karatrack Studio
 * 
 * Place this at: frontend/src/pages/preview/[id].jsx
 * 
 * Features:
 * - Timeline visualization with word-level timing
 * - Dual audio track support (Instrumental + Vocals)
 * - Drag-to-adjust word timing
 * - Duet mode color assignment (Singer 1, Singer 2, Both)
 * - Word text editing (fix misspellings)
 * - Live preview synchronization
 * - Futuristic liquid glass design theme
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Play,
  Pause,
  SkipBack,
  Volume2,
  VolumeX,
  Mic,
  Music2,
  Save,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Users,
  Check,
  X,
  Edit3,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sun,
  Moon,
  AlertCircle,
  CheckCircle,
  Settings2
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import AppNavigation from '../../components/AppNavigation';
import { createClient } from '@supabase/supabase-js';
import SEO from '../../components/SEO';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Singer assignment constants
const SINGER = {
  BOTH: 0,
  SINGER_1: 1,
  SINGER_2: 2
};

// Default duet colors
const DEFAULT_DUET_COLORS = {
  singer1: '#00FFFF',  // Cyan
  singer2: '#FF69B4',  // Pink
  both: '#FFD700'      // Gold
};

// Timeline constants
const PIXELS_PER_SECOND_DEFAULT = 100; // Zoom level
const TIMELINE_HEIGHT = 120;
const WORD_HEIGHT = 40;

export default function PreviewPage() {
  const router = useRouter();
  const { id } = router.query;
  const { isDark, toggleTheme } = useTheme();

  // Project data
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Lyrics data
  const [words, setWords] = useState([]);
  const [originalWords, setOriginalWords] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Selection state
  const [selectedWordIndices, setSelectedWordIndices] = useState([]);
  const [editingWordIndex, setEditingWordIndex] = useState(null);
  const [editingText, setEditingText] = useState('');

  // Audio state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [instrumentalVolume, setInstrumentalVolume] = useState(0.8);
  const [vocalsVolume, setVocalsVolume] = useState(0.5);
  const [instrumentalMuted, setInstrumentalMuted] = useState(false);
  const [vocalsMuted, setVocalsMuted] = useState(false);

  // Timeline state
  const [zoom, setZoom] = useState(PIXELS_PER_SECOND_DEFAULT);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTimes, setDragStartTimes] = useState({});

  // Duet mode state
  const [isDuetMode, setIsDuetMode] = useState(false);
  const [duetColors, setDuetColors] = useState(DEFAULT_DUET_COLORS);
  const [showDuetPanel, setShowDuetPanel] = useState(false);

  // Settings panel state
  const [showSettings, setShowSettings] = useState(false);

  // Refs
  const instrumentalRef = useRef(null);
  const vocalsRef = useRef(null);
  const timelineRef = useRef(null);
  const playheadRef = useRef(null);
  const animationFrameRef = useRef(null);
  const containerRef = useRef(null);

  // Load project data
  useEffect(() => {
    if (!id) return;

    const loadProject = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          router.push('/login');
          return;
        }

        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('*')
          .eq('id', id)
          .eq('user_id', user.id)
          .single();

        if (projectError || !projectData) {
          setError('Project not found');
          return;
        }

        setProject(projectData);
        
        // Parse lyrics data
        const lyricsData = projectData.lyrics_json || [];
        setWords(lyricsData);
        setOriginalWords(JSON.parse(JSON.stringify(lyricsData)));
        
        // Load duet mode settings
        setIsDuetMode(projectData.is_duet_mode || false);
        if (projectData.duet_singer1_color) {
          setDuetColors({
            singer1: projectData.duet_singer1_color,
            singer2: projectData.duet_singer2_color || DEFAULT_DUET_COLORS.singer2,
            both: projectData.duet_both_color || DEFAULT_DUET_COLORS.both
          });
        }
      } catch (err) {
        console.error('Load error:', err);
        setError('Failed to load project');
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [id, router]);

  // Audio sync animation loop
  useEffect(() => {
    const updateTime = () => {
      if (instrumentalRef.current && isPlaying) {
        const time = instrumentalRef.current.currentTime;
        setCurrentTime(time);
        
        // Auto-scroll timeline to keep playhead visible
        if (timelineRef.current && containerRef.current) {
          const playheadPosition = time * zoom;
          const containerWidth = containerRef.current.offsetWidth;
          const visibleStart = scrollLeft;
          const visibleEnd = scrollLeft + containerWidth;
          
          // If playhead is near the right edge, scroll
          if (playheadPosition > visibleEnd - 100) {
            setScrollLeft(playheadPosition - containerWidth / 3);
          }
        }
      }
      animationFrameRef.current = requestAnimationFrame(updateTime);
    };

    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateTime);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, zoom, scrollLeft]);

  // Sync vocals audio with instrumental
  useEffect(() => {
    if (instrumentalRef.current && vocalsRef.current) {
      vocalsRef.current.currentTime = instrumentalRef.current.currentTime;
    }
  }, [currentTime]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Space = play/pause
      if (e.code === 'Space' && !editingWordIndex) {
        e.preventDefault();
        togglePlayback();
      }
      // Escape = deselect / cancel edit
      if (e.code === 'Escape') {
        if (editingWordIndex !== null) {
          setEditingWordIndex(null);
          setEditingText('');
        } else {
          setSelectedWordIndices([]);
        }
      }
      // Delete = remove word (careful!)
      // Arrow keys for nudging
      if (selectedWordIndices.length > 0 && !editingWordIndex) {
        if (e.code === 'ArrowLeft') {
          e.preventDefault();
          nudgeSelectedWords(e.shiftKey ? -0.1 : -0.05);
        }
        if (e.code === 'ArrowRight') {
          e.preventDefault();
          nudgeSelectedWords(e.shiftKey ? 0.1 : 0.05);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedWordIndices, editingWordIndex, isPlaying]);

  // Audio loaded handler
  const handleAudioLoaded = useCallback(() => {
    if (instrumentalRef.current) {
      setDuration(instrumentalRef.current.duration);
    }
  }, []);

  // Toggle playback
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

  // Seek to time
  const seekTo = useCallback((time) => {
    if (instrumentalRef.current) {
      instrumentalRef.current.currentTime = time;
      if (vocalsRef.current) {
        vocalsRef.current.currentTime = time;
      }
      setCurrentTime(time);
    }
  }, []);

  // Restart from beginning
  const restart = useCallback(() => {
    seekTo(0);
    setScrollLeft(0);
  }, [seekTo]);

  // Handle timeline click to seek
  const handleTimelineClick = useCallback((e) => {
    if (!timelineRef.current || isDragging) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollLeft;
    const time = x / zoom;
    seekTo(Math.max(0, Math.min(time, duration)));
  }, [zoom, scrollLeft, duration, seekTo, isDragging]);

  // Handle progress bar click
  const handleProgressClick = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const time = percent * duration;
    seekTo(Math.max(0, Math.min(time, duration)));
  }, [duration, seekTo]);

  // Word selection
  const handleWordClick = useCallback((index, e) => {
    e.stopPropagation();

    if (e.shiftKey && selectedWordIndices.length > 0) {
      // Shift-click: select range
      const lastSelected = selectedWordIndices[selectedWordIndices.length - 1];
      const start = Math.min(lastSelected, index);
      const end = Math.max(lastSelected, index);
      const range = [];
      for (let i = start; i <= end; i++) {
        range.push(i);
      }
      setSelectedWordIndices(range);
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd-click: toggle selection
      if (selectedWordIndices.includes(index)) {
        setSelectedWordIndices(selectedWordIndices.filter(i => i !== index));
      } else {
        setSelectedWordIndices([...selectedWordIndices, index]);
      }
    } else {
      // Regular click: select only this word
      setSelectedWordIndices([index]);
    }
  }, [selectedWordIndices]);

  // Word double-click to edit text
  const handleWordDoubleClick = useCallback((index, e) => {
    e.stopPropagation();
    setEditingWordIndex(index);
    setEditingText(words[index].word);
    setSelectedWordIndices([index]);
  }, [words]);

  // Save edited word text
  const saveWordEdit = useCallback(() => {
    if (editingWordIndex === null || !editingText.trim()) return;

    setWords(prev => {
      const updated = [...prev];
      updated[editingWordIndex] = {
        ...updated[editingWordIndex],
        word: editingText.trim()
      };
      return updated;
    });
    setHasChanges(true);
    setEditingWordIndex(null);
    setEditingText('');
  }, [editingWordIndex, editingText]);

  // Cancel word edit
  const cancelWordEdit = useCallback(() => {
    setEditingWordIndex(null);
    setEditingText('');
  }, []);

  // Nudge selected words timing
  const nudgeSelectedWords = useCallback((delta) => {
    if (selectedWordIndices.length === 0) return;

    setWords(prev => {
      const updated = [...prev];
      selectedWordIndices.forEach(index => {
        const word = updated[index];
        const newStart = Math.max(0, word.start + delta);
        const wordDuration = word.end - word.start;
        updated[index] = {
          ...word,
          start: newStart,
          end: newStart + wordDuration
        };
      });
      return updated;
    });
    setHasChanges(true);
  }, [selectedWordIndices]);

  // Word drag start
  const handleWordDragStart = useCallback((index, e) => {
    e.stopPropagation();
    
    // Ensure this word is selected
    if (!selectedWordIndices.includes(index)) {
      setSelectedWordIndices([index]);
    }

    setIsDragging(true);
    setDragStartX(e.clientX);
    
    // Store starting times for all selected words
    const startTimes = {};
    const indicesToDrag = selectedWordIndices.includes(index) 
      ? selectedWordIndices 
      : [index];
    
    indicesToDrag.forEach(i => {
      startTimes[i] = { start: words[i].start, end: words[i].end };
    });
    setDragStartTimes(startTimes);
  }, [selectedWordIndices, words]);

  // Word drag move (window event)
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;

      const deltaX = e.clientX - dragStartX;
      const deltaTime = deltaX / zoom;

      setWords(prev => {
        const updated = [...prev];
        Object.keys(dragStartTimes).forEach(indexStr => {
          const index = parseInt(indexStr);
          const original = dragStartTimes[index];
          const newStart = Math.max(0, original.start + deltaTime);
          const wordDuration = original.end - original.start;
          updated[index] = {
            ...updated[index],
            start: newStart,
            end: newStart + wordDuration
          };
        });
        return updated;
      });
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        setDragStartTimes({});
        setHasChanges(true);
      }
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

  // Assign singer to selected words
  const assignSinger = useCallback((singer) => {
    if (selectedWordIndices.length === 0) return;

    setWords(prev => {
      const updated = [...prev];
      selectedWordIndices.forEach(index => {
        updated[index] = {
          ...updated[index],
          singer: singer
        };
      });
      return updated;
    });
    setHasChanges(true);
  }, [selectedWordIndices]);

  // Reset to original
  const resetToOriginal = useCallback(() => {
    if (window.confirm('Reset all changes? This will restore the original lyrics timing and text.')) {
      setWords(JSON.parse(JSON.stringify(originalWords)));
      setSelectedWordIndices([]);
      setHasChanges(false);
    }
  }, [originalWords]);

  // Save changes
  const saveChanges = useCallback(async () => {
    if (!project) return;

    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('projects')
        .update({
          lyrics_json: words,
          is_duet_mode: isDuetMode,
          duet_singer1_color: duetColors.singer1,
          duet_singer2_color: duetColors.singer2,
          duet_both_color: duetColors.both,
          updated_at: new Date().toISOString()
        })
        .eq('id', project.id);

      if (updateError) throw updateError;

      setOriginalWords(JSON.parse(JSON.stringify(words)));
      setHasChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Save error:', err);
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  }, [project, words, isDuetMode, duetColors]);

  // Proceed to render
  const proceedToRender = useCallback(async () => {
    if (hasChanges) {
      await saveChanges();
    }
    // Update project status to trigger rendering
    const { error: statusError } = await supabase
      .from('projects')
      .update({ 
        status: 'rendering',
        lyrics_json: words 
      })
      .eq('id', project.id);

    if (statusError) {
      console.error('Status update error:', statusError);
      return;
    }

    router.push('/dashboard');
  }, [hasChanges, saveChanges, project, words, router]);

  // Format time display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get word color based on mode and singer
  const getWordColor = useCallback((word, isSelected, isCurrent) => {
    if (isSelected) {
      return 'rgba(0, 212, 255, 0.9)'; // Selection color
    }
    
    if (isDuetMode) {
      const singer = word.singer || SINGER.BOTH;
      switch (singer) {
        case SINGER.SINGER_1:
          return isCurrent ? duetColors.singer1 : `${duetColors.singer1}99`;
        case SINGER.SINGER_2:
          return isCurrent ? duetColors.singer2 : `${duetColors.singer2}99`;
        default:
          return isCurrent ? duetColors.both : `${duetColors.both}99`;
      }
    }
    
    // Standard mode
    return isCurrent ? '#00d4ff' : 'rgba(255, 255, 255, 0.7)';
  }, [isDuetMode, duetColors]);

  // Check if word is "current" (being sung)
  const isWordCurrent = useCallback((word) => {
    return currentTime >= word.start && currentTime <= word.end;
  }, [currentTime]);

  // Calculate timeline width
  const timelineWidth = useMemo(() => {
    return Math.max(duration * zoom, 1000);
  }, [duration, zoom]);

  // Zoom controls
  const zoomIn = () => setZoom(prev => Math.min(prev * 1.5, 400));
  const zoomOut = () => setZoom(prev => Math.max(prev / 1.5, 25));

  // Render loading state
  if (loading) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-gray-950' : 'bg-gray-100'}`}>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        </div>
      </div>
    );
  }

  // Render error state
  if (error || !project) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-gray-950' : 'bg-gray-100'}`}>
        <div className="flex flex-col items-center justify-center h-screen gap-4">
          <AlertCircle className="w-12 h-12 text-red-400" />
          <p className="text-red-400">{error || 'Project not found'}</p>
          <Link href="/dashboard" className="text-cyan-400 hover:underline">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO
        title={`Edit: ${project.title} | Karatrack Studio`}
        description="Edit lyrics timing and customize your karaoke track"
      />

      {/* Hidden audio elements */}
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
          preload="auto"
        />
      )}

      <div className={`min-h-screen ${isDark ? 'bg-gray-950' : 'bg-gray-100'} transition-colors duration-300`}>
        {/* Background Effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className={`absolute -top-1/2 -left-1/2 w-full h-full ${
            isDark 
              ? 'bg-gradient-to-br from-cyan-900/20 via-transparent to-purple-900/20' 
              : 'bg-gradient-to-br from-cyan-100/50 via-transparent to-purple-100/50'
          } rounded-full blur-3xl`} />
          <div className={`absolute -bottom-1/2 -right-1/2 w-full h-full ${
            isDark 
              ? 'bg-gradient-to-tl from-purple-900/20 via-transparent to-cyan-900/20' 
              : 'bg-gradient-to-tl from-purple-100/50 via-transparent to-cyan-100/50'
          } rounded-full blur-3xl`} />
        </div>

        {/* Navigation */}
        <AppNavigation />

        {/* Main Content */}
        <main className="relative z-10 px-4 py-6 max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-6"
          >
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className={`p-2 rounded-xl ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'} transition-colors`}
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {project.title}
                </h1>
                <p className="text-sm text-gray-500">
                  Edit lyrics timing and text
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Unsaved changes indicator */}
              {hasChanges && (
                <span className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/20 text-yellow-400 text-sm rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  Unsaved changes
                </span>
              )}

              {/* Save success indicator */}
              <AnimatePresence>
                {saveSuccess && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 text-green-400 text-sm rounded-lg"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Saved!
                  </motion.span>
                )}
              </AnimatePresence>

              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className={`p-2 rounded-xl ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'} transition-colors`}
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              {/* Settings button */}
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-xl ${showSettings ? 'bg-cyan-500/20 text-cyan-400' : isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'} transition-colors`}
              >
                <Settings2 className="w-5 h-5" />
              </button>

              {/* Duet mode toggle */}
              <button
                onClick={() => setShowDuetPanel(!showDuetPanel)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                  isDuetMode
                    ? 'bg-gradient-to-r from-cyan-500/20 to-pink-500/20 border border-cyan-400/50 text-cyan-400'
                    : isDark ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-black/5 hover:bg-black/10 text-gray-900'
                }`}
              >
                <Users className="w-4 h-4" />
                <span className="text-sm">Duet Mode</span>
                {isDuetMode && <Check className="w-4 h-4" />}
              </button>

              {/* Reset button */}
              <button
                onClick={resetToOriginal}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'}`}
              >
                <RotateCcw className="w-4 h-4" />
                <span className="text-sm">Reset</span>
              </button>

              {/* Save button */}
              <button
                onClick={saveChanges}
                disabled={saving || !hasChanges}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                  hasChanges
                    ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:opacity-90'
                    : isDark ? 'bg-white/10 text-gray-500 cursor-not-allowed' : 'bg-black/10 text-gray-400 cursor-not-allowed'
                }`}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span className="text-sm">Save</span>
              </button>
            </div>
          </motion.div>

          {/* Settings Panel (collapsible) */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-4"
              >
                <div className={`p-4 rounded-2xl ${isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}>
                  <h3 className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Timeline Settings
                  </h3>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Zoom:</span>
                      <button onClick={zoomOut} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                        <ZoomOut className="w-4 h-4" />
                      </button>
                      <span className="text-xs text-gray-400 min-w-[60px] text-center">{Math.round(zoom)}px/s</span>
                      <button onClick={zoomIn} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                        <ZoomIn className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="text-xs text-gray-500">
                      <span>Tip: Use Shift+Click to select multiple words. Arrow keys nudge timing.</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Duet Mode Panel (collapsible) */}
          <AnimatePresence>
            {showDuetPanel && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-4"
              >
                <div className={`p-4 rounded-2xl ${isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      Duet Mode Colors
                    </h3>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-xs text-gray-500">Enable Duet Mode</span>
                      <div 
                        onClick={() => {
                          setIsDuetMode(!isDuetMode);
                          setHasChanges(true);
                        }}
                        className={`relative w-12 h-6 rounded-full transition-colors ${isDuetMode ? 'bg-gradient-to-r from-cyan-500 to-pink-500' : 'bg-gray-600'}`}
                      >
                        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${isDuetMode ? 'translate-x-6' : ''}`} />
                      </div>
                    </label>
                  </div>

                  {isDuetMode && (
                    <div className="grid grid-cols-3 gap-4">
                      {/* Singer 1 Color */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Singer 1</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={duetColors.singer1}
                            onChange={(e) => {
                              setDuetColors(prev => ({ ...prev, singer1: e.target.value }));
                              setHasChanges(true);
                            }}
                            className="w-10 h-10 rounded-lg cursor-pointer border-0"
                          />
                          <button
                            onClick={() => assignSinger(SINGER.SINGER_1)}
                            disabled={selectedWordIndices.length === 0}
                            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                              selectedWordIndices.length > 0
                                ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
                                : 'bg-white/5 text-gray-500 cursor-not-allowed'
                            }`}
                            style={selectedWordIndices.length > 0 ? { borderColor: duetColors.singer1, borderWidth: 1 } : {}}
                          >
                            Assign Singer 1
                          </button>
                        </div>
                      </div>

                      {/* Singer 2 Color */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Singer 2</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={duetColors.singer2}
                            onChange={(e) => {
                              setDuetColors(prev => ({ ...prev, singer2: e.target.value }));
                              setHasChanges(true);
                            }}
                            className="w-10 h-10 rounded-lg cursor-pointer border-0"
                          />
                          <button
                            onClick={() => assignSinger(SINGER.SINGER_2)}
                            disabled={selectedWordIndices.length === 0}
                            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                              selectedWordIndices.length > 0
                                ? 'bg-pink-500/20 text-pink-400 hover:bg-pink-500/30'
                                : 'bg-white/5 text-gray-500 cursor-not-allowed'
                            }`}
                            style={selectedWordIndices.length > 0 ? { borderColor: duetColors.singer2, borderWidth: 1 } : {}}
                          >
                            Assign Singer 2
                          </button>
                        </div>
                      </div>

                      {/* Both Color */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Both Singers</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={duetColors.both}
                            onChange={(e) => {
                              setDuetColors(prev => ({ ...prev, both: e.target.value }));
                              setHasChanges(true);
                            }}
                            className="w-10 h-10 rounded-lg cursor-pointer border-0"
                          />
                          <button
                            onClick={() => assignSinger(SINGER.BOTH)}
                            disabled={selectedWordIndices.length === 0}
                            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                              selectedWordIndices.length > 0
                                ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                                : 'bg-white/5 text-gray-500 cursor-not-allowed'
                            }`}
                            style={selectedWordIndices.length > 0 ? { borderColor: duetColors.both, borderWidth: 1 } : {}}
                          >
                            Assign Both
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {!isDuetMode && (
                    <p className="text-xs text-gray-500">
                      Enable duet mode to assign different colors to different singers.
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Timeline Container */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`rounded-2xl overflow-hidden ${isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}
            style={{ backdropFilter: 'blur(10px)' }}
          >
            {/* Time Ruler */}
            <div 
              className={`h-8 ${isDark ? 'bg-black/30' : 'bg-gray-100'} border-b ${isDark ? 'border-white/10' : 'border-gray-200'} overflow-hidden`}
              ref={containerRef}
            >
              <div 
                className="relative h-full"
                style={{ 
                  width: timelineWidth,
                  transform: `translateX(-${scrollLeft}px)`
                }}
              >
                {/* Time markers */}
                {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 h-full flex flex-col justify-end"
                    style={{ left: i * zoom }}
                  >
                    <div className={`w-px h-2 ${isDark ? 'bg-white/30' : 'bg-gray-400'}`} />
                    <span className="text-[10px] text-gray-500 ml-1">{formatTime(i)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline Track */}
            <div
              ref={timelineRef}
              className={`relative overflow-x-auto ${isDark ? 'bg-gray-900/50' : 'bg-gray-50'}`}
              style={{ height: TIMELINE_HEIGHT }}
              onClick={handleTimelineClick}
              onScroll={(e) => setScrollLeft(e.currentTarget.scrollLeft)}
            >
              <div 
                className="relative h-full"
                style={{ width: timelineWidth, minWidth: '100%' }}
              >
                {/* Playhead */}
                <div
                  ref={playheadRef}
                  className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 z-20 pointer-events-none"
                  style={{ 
                    left: currentTime * zoom,
                    boxShadow: '0 0 10px rgba(0, 212, 255, 0.5)'
                  }}
                >
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-cyan-400 rotate-45" />
                </div>

                {/* Words */}
                {words.map((word, index) => {
                  const isSelected = selectedWordIndices.includes(index);
                  const isCurrent = isWordCurrent(word);
                  const isEditing = editingWordIndex === index;
                  const wordWidth = Math.max((word.end - word.start) * zoom, 30);
                  const wordLeft = word.start * zoom;

                  return (
                    <motion.div
                      key={index}
                      className={`absolute cursor-pointer select-none transition-all ${
                        isDragging && isSelected ? 'cursor-grabbing' : 'cursor-grab'
                      }`}
                      style={{
                        left: wordLeft,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: wordWidth,
                        height: WORD_HEIGHT,
                        zIndex: isSelected ? 15 : isCurrent ? 10 : 5
                      }}
                      onClick={(e) => handleWordClick(index, e)}
                      onDoubleClick={(e) => handleWordDoubleClick(index, e)}
                      onMouseDown={(e) => handleWordDragStart(index, e)}
                      whileHover={{ scale: 1.02 }}
                      animate={{
                        backgroundColor: isSelected 
                          ? 'rgba(0, 212, 255, 0.2)' 
                          : isCurrent 
                            ? 'rgba(255, 255, 255, 0.1)' 
                            : 'rgba(255, 255, 255, 0.05)',
                        borderColor: isSelected
                          ? 'rgba(0, 212, 255, 0.8)'
                          : isCurrent
                            ? 'rgba(255, 255, 255, 0.3)'
                            : 'rgba(255, 255, 255, 0.1)'
                      }}
                    >
                      <div
                        className={`h-full rounded-lg border-2 flex items-center justify-center px-2 overflow-hidden ${
                          isSelected ? 'border-cyan-400 shadow-lg shadow-cyan-500/20' : 'border-transparent'
                        }`}
                        style={{
                          backgroundColor: isSelected 
                            ? 'rgba(0, 212, 255, 0.15)' 
                            : isCurrent 
                              ? 'rgba(255, 255, 255, 0.1)' 
                              : 'rgba(255, 255, 255, 0.03)',
                          backdropFilter: 'blur(4px)'
                        }}
                      >
                        {isEditing ? (
                          <input
                            type="text"
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveWordEdit();
                              if (e.key === 'Escape') cancelWordEdit();
                            }}
                            onBlur={saveWordEdit}
                            autoFocus
                            className="w-full h-full bg-transparent text-center text-sm font-medium outline-none border-none text-cyan-300"
                            style={{ minWidth: 40 }}
                          />
                        ) : (
                          <span
                            className="text-xs font-medium truncate"
                            style={{ color: getWordColor(word, isSelected, isCurrent) }}
                          >
                            {word.word}
                          </span>
                        )}
                      </div>

                      {/* Low confidence indicator */}
                      {word.confidence && word.confidence < 0.8 && !isSelected && (
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-orange-400 rounded-full" title="Low confidence" />
                      )}

                      {/* Singer indicator (duet mode) */}
                      {isDuetMode && word.singer && word.singer !== SINGER.BOTH && (
                        <div 
                          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 rounded-full"
                          style={{ 
                            backgroundColor: word.singer === SINGER.SINGER_1 
                              ? duetColors.singer1 
                              : duetColors.singer2 
                          }}
                        />
                      )}
                    </motion.div>
                  );
                })}

                {/* Line break indicators */}
                {words.map((word, index) => {
                  if (index < words.length - 1 && word.line !== words[index + 1].line) {
                    return (
                      <div
                        key={`line-${index}`}
                        className="absolute top-2 bottom-2 w-px bg-cyan-400/30"
                        style={{ left: word.end * zoom + 4 }}
                        title="Line break"
                      />
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          </motion.div>

          {/* Audio Control Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`mt-4 p-4 rounded-2xl ${isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}
            style={{ backdropFilter: 'blur(10px)' }}
          >
            {/* Progress bar */}
            <div 
              className={`h-2 rounded-full ${isDark ? 'bg-white/10' : 'bg-gray-200'} cursor-pointer mb-4 overflow-hidden`}
              onClick={handleProgressClick}
            >
              <motion.div
                className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
            </div>

            <div className="flex items-center justify-between">
              {/* Left: Playback controls */}
              <div className="flex items-center gap-3">
                <button
                  onClick={restart}
                  className={`p-2 rounded-xl ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'} transition-colors`}
                >
                  <SkipBack className="w-5 h-5" />
                </button>

                <button
                  onClick={togglePlayback}
                  className="p-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:opacity-90 transition-opacity"
                >
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                </button>

                <div className="text-sm font-mono text-gray-400">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
              </div>

              {/* Right: Volume controls */}
              <div className="flex items-center gap-6">
                {/* Instrumental volume */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setInstrumentalMuted(!instrumentalMuted);
                      if (instrumentalRef.current) {
                        instrumentalRef.current.muted = !instrumentalMuted;
                      }
                    }}
                    className={`p-1.5 rounded-lg transition-colors ${instrumentalMuted ? 'text-gray-500' : 'text-cyan-400'}`}
                  >
                    <Music2 className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-gray-500 w-20">Instrumental</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={instrumentalVolume}
                    onChange={(e) => {
                      const vol = parseFloat(e.target.value);
                      setInstrumentalVolume(vol);
                      if (instrumentalRef.current) {
                        instrumentalRef.current.volume = vol;
                      }
                    }}
                    className="w-24 accent-cyan-500"
                  />
                </div>

                {/* Vocals volume (if available) */}
                {project.vocals_audio_url && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setVocalsMuted(!vocalsMuted);
                        if (vocalsRef.current) {
                          vocalsRef.current.muted = !vocalsMuted;
                        }
                      }}
                      className={`p-1.5 rounded-lg transition-colors ${vocalsMuted ? 'text-gray-500' : 'text-pink-400'}`}
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-gray-500 w-12">Vocals</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={vocalsVolume}
                      onChange={(e) => {
                        const vol = parseFloat(e.target.value);
                        setVocalsVolume(vol);
                        if (vocalsRef.current) {
                          vocalsRef.current.volume = vol;
                        }
                      }}
                      className="w-24 accent-pink-500"
                    />
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Word Editor Panel (shown when words selected) */}
          <AnimatePresence>
            {selectedWordIndices.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className={`mt-4 p-4 rounded-2xl ${isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-400">
                      {selectedWordIndices.length} word{selectedWordIndices.length > 1 ? 's' : ''} selected
                    </span>

                    {selectedWordIndices.length === 1 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Start:</span>
                        <span className="text-sm font-mono text-cyan-400">
                          {words[selectedWordIndices[0]].start.toFixed(2)}s
                        </span>
                        <span className="text-xs text-gray-500 ml-2">End:</span>
                        <span className="text-sm font-mono text-cyan-400">
                          {words[selectedWordIndices[0]].end.toFixed(2)}s
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Nudge buttons */}
                    <span className="text-xs text-gray-500 mr-2">Nudge:</span>
                    <button
                      onClick={() => nudgeSelectedWords(-0.1)}
                      className={`px-2 py-1 text-xs rounded-lg ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'} transition-colors`}
                    >
                      -0.1s
                    </button>
                    <button
                      onClick={() => nudgeSelectedWords(-0.05)}
                      className={`px-2 py-1 text-xs rounded-lg ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'} transition-colors`}
                    >
                      -0.05s
                    </button>
                    <button
                      onClick={() => nudgeSelectedWords(0.05)}
                      className={`px-2 py-1 text-xs rounded-lg ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'} transition-colors`}
                    >
                      +0.05s
                    </button>
                    <button
                      onClick={() => nudgeSelectedWords(0.1)}
                      className={`px-2 py-1 text-xs rounded-lg ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'} transition-colors`}
                    >
                      +0.1s
                    </button>

                    {/* Edit text button (single selection) */}
                    {selectedWordIndices.length === 1 && (
                      <button
                        onClick={() => handleWordDoubleClick(selectedWordIndices[0], { stopPropagation: () => {} })}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors ml-2"
                      >
                        <Edit3 className="w-3 h-3" />
                        Edit Text
                      </button>
                    )}

                    {/* Clear selection */}
                    <button
                      onClick={() => setSelectedWordIndices([])}
                      className={`p-1.5 rounded-lg ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'} transition-colors ml-2`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6 flex items-center justify-between"
          >
            <Link
              href="/dashboard"
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'}`}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </Link>

            <button
              onClick={proceedToRender}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:opacity-90 transition-opacity"
            >
              <CheckCircle className="w-5 h-5" />
              <span>Approve & Render Video</span>
            </button>
          </motion.div>

          {/* Keyboard shortcuts help */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 text-center"
          >
            <p className="text-xs text-gray-500">
              <span className="font-medium">Keyboard shortcuts:</span>{' '}
              <span className="mx-2">Space = Play/Pause</span>
              <span className="mx-2">←/→ = Nudge timing</span>
              <span className="mx-2">Shift+Click = Select range</span>
              <span className="mx-2">Double-click = Edit word</span>
              <span className="mx-2">Esc = Deselect</span>
            </p>
          </motion.div>
        </main>
      </div>
    </>
  );
}