'use client';

/**
 * Edit/Review Lyrics Page - Karatrack Studio
 * 
 * Place this at: frontend/src/pages/edit/[id].jsx
 * 
 * Features:
 * - View AI-transcribed lyrics with timestamps
 * - Edit individual words (fix spelling)
 * - Adjust line breaks with two-action system
 * - Live karaoke preview
 * - Re-render with custom edits
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Save,
  Play,
  Pause,
  RotateCcw,
  Loader2,
  CheckCircle,
  AlertCircle,
  Type,
  ArrowDown,
  ArrowUp,
  Eye,
  Sun,
  Moon,
  Zap,
  Music
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function EditLyricsPage() {
  const router = useRouter();
  const { id } = router.query;
  const { isDark, toggleTheme } = useTheme();

  // Project data
  const [project, setProject] = useState(null);
  const [lyrics, setLyrics] = useState([]); // Array of {word, start, end, lineBreak}
  const [originalLyrics, setOriginalLyrics] = useState([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [selectedWordIndex, setSelectedWordIndex] = useState(null);
  const [editingWord, setEditingWord] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewMode, setPreviewMode] = useState('video'); // 'video' or 'lyrics'
  const [originalLyricsText, setOriginalLyricsText] = useState('');
  const LOW_CONFIDENCE_THRESHOLD = 0.5;

  // User profile
  const [profile, setProfile] = useState(null);

  // Load project and lyrics
  useEffect(() => {
    if (!id) return;

    const loadProject = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }

        // Load profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        setProfile(profileData);

        // Load project
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('*')
          .eq('id', id)
          .eq('user_id', session.user.id)
          .single();

        if (projectError || !projectData) {
          setError('Project not found');
          setLoading(false);
          return;
        }

        setProject(projectData);

        // Parse lyrics from project data
        let parsedLyrics = [];
        if (projectData.lyrics_json) {
          // If stored as JSON string
          parsedLyrics = typeof projectData.lyrics_json === 'string'
            ? JSON.parse(projectData.lyrics_json)
            : projectData.lyrics_json;
        } else if (projectData.transcription_result?.lyrics) {
          parsedLyrics = projectData.transcription_result.lyrics;
        }

        // Ensure each word has lineBreak property
        const lyricsWithBreaks = parsedLyrics.map((word, index) => ({
          ...word,
          lineBreak: word.lineBreak || false
        }));

        // Auto-add initial line breaks based on timing gaps
        const lyricsWithAutoBreaks = addAutoLineBreaks(lyricsWithBreaks);

        setLyrics(lyricsWithAutoBreaks);
        console.log('Lyrics with confidence:', lyricsWithAutoBreaks.slice(0, 5));
        setOriginalLyrics(JSON.parse(JSON.stringify(lyricsWithAutoBreaks)));
        setOriginalLyricsText(projectData.lyrics_text || '');
        setLoading(false);
      } catch (err) {
        console.error('Error loading project:', err);
        setError('Failed to load project');
        setLoading(false);
      }
    };

    loadProject();
  }, [id, router]);

  // Auto-add line breaks based on timing gaps (for initial display)
  const addAutoLineBreaks = (lyrics) => {
    if (!lyrics.length) return lyrics;

    const WORDS_PER_LINE = 7;
    const result = [...lyrics];
    let wordsSinceBreak = 0;

    for (let i = 0; i < result.length; i++) {
      wordsSinceBreak++;

      let shouldBreak = false;

      // Break at WORDS_PER_LINE words
      if (wordsSinceBreak >= WORDS_PER_LINE) {
        shouldBreak = true;
      }
      // Or break on 0.5+ second gap (if we have at least 3 words)
      else if (i < result.length - 1 && wordsSinceBreak >= 3) {
        const gap = result[i + 1].start - result[i].end;
        if (gap >= 0.5) {
          shouldBreak = true;
        }
      }

      if (shouldBreak) {
        result[i] = { ...result[i], lineBreak: true };
        wordsSinceBreak = 0;
      }
    }

    return result;
  };

  // Group lyrics into lines for display
  const lyricsLines = useMemo(() => {
    const lines = [];
    let currentLine = [];
    let globalIndex = 0;

    lyrics.forEach((word, idx) => {
      currentLine.push({ ...word, globalIndex: idx });

      if (word.lineBreak || idx === lyrics.length - 1) {
        lines.push(currentLine);
        currentLine = [];
      }
    });

    return lines;
  }, [lyrics]);

  // Handle word click for editing
  const handleWordClick = (globalIndex) => {
    if (selectedWordIndex === globalIndex) {
      // Start editing
      setEditingWord(lyrics[globalIndex].word);
    } else {
      setSelectedWordIndex(globalIndex);
      setEditingWord(null);
    }
  };

  // Handle word edit save
  const handleWordSave = (globalIndex, newWord) => {
    const newLyrics = [...lyrics];
    newLyrics[globalIndex] = { ...newLyrics[globalIndex], word: newWord };
    setLyrics(newLyrics);
    setEditingWord(null);
  };

  // Move word down (add line break before this word)
  const moveWordDown = (globalIndex) => {
    if (globalIndex === 0) return; // Can't move first word down

    const newLyrics = [...lyrics];

    // Add line break BEFORE this word (i.e., on the previous word)
    newLyrics[globalIndex - 1] = { ...newLyrics[globalIndex - 1], lineBreak: true };

    // Remove line break from the next word's previous position (redistribute)
    // Find the next line break after this word and remove it
    for (let i = globalIndex; i < newLyrics.length; i++) {
      if (newLyrics[i].lineBreak) {
        newLyrics[i] = { ...newLyrics[i], lineBreak: false };
        break;
      }
    }

    setLyrics(newLyrics);
  };

  // Merge line up (remove line break before this line)
  const mergeLineUp = (lineIndex) => {
    if (lineIndex === 0) return; // Can't merge first line up

    const newLyrics = [...lyrics];

    // Find the word at the end of the previous line and remove its line break
    const prevLineLastWordIndex = lyricsLines[lineIndex - 1][lyricsLines[lineIndex - 1].length - 1].globalIndex;
    newLyrics[prevLineLastWordIndex] = { ...newLyrics[prevLineLastWordIndex], lineBreak: false };

    setLyrics(newLyrics);
  };

  // Reset to original lyrics
  const handleReset = () => {
    setLyrics(JSON.parse(JSON.stringify(originalLyrics)));
    setSelectedWordIndex(null);
    setEditingWord(null);
  };

  // Check if lyrics have been modified
  const hasChanges = useMemo(() => {
    return JSON.stringify(lyrics) !== JSON.stringify(originalLyrics);
  }, [lyrics, originalLyrics]);

  // Save and re-render
  const handleSaveAndRender = async () => {
    setSaving(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // Call backend API to save edited lyrics and trigger re-render
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/projects/${id}/render`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            edited_lyrics: lyrics,
            processing_mode: 'render_only'
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save');
      }

      setSuccessMessage('Lyrics saved! Your video is being rendered...');

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);

    } catch (err) {
      console.error('Save error:', err);
      setError(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // Preview playback simulation
  useEffect(() => {
    let interval;
    if (isPlaying && showPreview) {
      interval = setInterval(() => {
        setPreviewTime(prev => {
          const maxTime = lyrics[lyrics.length - 1]?.end || 0;
          if (prev >= maxTime) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 0.1;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, showPreview, lyrics]);

  // Get currently highlighted word based on preview time
  const getCurrentWordIndex = useMemo(() => {
    for (let i = 0; i < lyrics.length; i++) {
      if (previewTime >= lyrics[i].start && previewTime <= lyrics[i].end) {
        return i;
      }
    }
    return -1;
  }, [previewTime, lyrics]);

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-animated-dark' : 'bg-animated-light'}`}>
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center ${isDark ? 'bg-animated-dark' : 'bg-animated-light'}`}>
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-red-400 mb-4">{error}</p>
        <Link href="/dashboard" className="text-cyan-400 hover:underline">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-animated-dark' : 'bg-animated-light'}`}>
      {/* Navigation */}
      <nav className="border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
              <span>Back</span>
            </Link>
            <div className="h-6 w-px bg-white/20" />
            <div>
              <h1 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Edit Lyrics
              </h1>
              <p className="text-sm text-gray-400">{project?.title}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {profile && (
              <div className="credit-badge">
                <div className="credit-badge-icon">
                  <Zap className="w-3 h-3 text-white" />
                </div>
                <span className="text-sm text-white">{profile.credits_remaining || 0}</span>
              </div>
            )}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              {isDark ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-gray-600" />}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Success/Error Messages */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-xl flex items-center gap-3"
            >
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-green-400">{successMessage}</span>
            </motion.div>
          )}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl flex items-center gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-400" />
              <span className="text-red-400">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Instructions */}
        <div className={`glass-panel p-4 mb-6 ${isDark ? 'bg-white/5' : 'bg-white/80'}`}>
          <h3 className={`font-medium mb-2 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            <Type className="w-4 h-4 text-cyan-400" />
            How to Edit
          </h3>
          <ul className={`text-sm space-y-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            <li>• <strong>Click a word</strong> to select it, click again to edit the text</li>
            <li>• <strong>⬇️ Move Down</strong> - Moves the selected word to the next line</li>
            <li>• <strong>⬆️ Merge Up</strong> - Merges a line with the one above</li>
            <li>• <span className="text-cyan-400">Cyan indicator</span> shows where each line ends</li>
            <li>• <span className="text-orange-400 bg-orange-500/20 px-1 rounded">Orange words</span> have low transcription confidence - review these carefully</li>
          </ul>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lyrics Editor */}
          <div className={`glass-panel p-6 ${isDark ? 'bg-white/5' : 'bg-white/80'}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Lyrics ({lyrics.length} words)
              </h2>
              <button
                onClick={handleReset}
                disabled={!hasChanges}
                className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-colors ${hasChanges
                  ? 'bg-white/10 hover:bg-white/20 text-white'
                  : 'bg-white/5 text-gray-500 cursor-not-allowed'
                  }`}
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
            </div>

            {/* Lines display */}
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
              {lyricsLines.map((line, lineIndex) => (
                <div key={lineIndex} className="group">
                  {/* Line number and merge button */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-500 w-6">{lineIndex + 1}</span>
                    {lineIndex > 0 && (
                      <button
                        onClick={() => mergeLineUp(lineIndex)}
                        className="opacity-0 group-hover:opacity-100 px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded hover:bg-purple-500/30 transition-all flex items-center gap-1"
                        title="Merge with line above"
                      >
                        <ArrowUp className="w-3 h-3" />
                        Merge Up
                      </button>
                    )}
                  </div>

                  {/* Words in line */}
                  <div className={`flex flex-wrap items-center gap-1 p-2 rounded-lg ${isDark ? 'bg-white/5' : 'bg-gray-100'
                    }`}>
                    {line.map((wordData, wordIndex) => {
                      const isSelected = selectedWordIndex === wordData.globalIndex;
                      const isEditing = isSelected && editingWord !== null;
                      const isLastInLine = wordIndex === line.length - 1;

                      return (
                        <span key={wordData.globalIndex} className="inline-flex items-center">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editingWord}
                              onChange={(e) => setEditingWord(e.target.value)}
                              onBlur={() => handleWordSave(wordData.globalIndex, editingWord)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleWordSave(wordData.globalIndex, editingWord);
                                } else if (e.key === 'Escape') {
                                  setEditingWord(null);
                                }
                              }}
                              className="px-2 py-1 bg-cyan-500/20 border border-cyan-500 rounded text-white text-sm focus:outline-none"
                              autoFocus
                            />
                          ) : (
                            <button
                              onClick={() => handleWordClick(wordData.globalIndex)}
                              className={`px-2 py-1 rounded text-sm transition-all ${isSelected
                                ? 'bg-cyan-500/30 text-cyan-300 ring-2 ring-cyan-500'
                                : wordData.confidence !== undefined && wordData.confidence < LOW_CONFIDENCE_THRESHOLD
                                  ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                                  : isDark
                                    ? 'hover:bg-white/10 text-gray-300'
                                    : 'hover:bg-gray-200 text-gray-700'
                                }`}
                              title={wordData.confidence !== undefined ? `Confidence: ${(wordData.confidence * 100).toFixed(0)}%` : ''}
                            >
                              {wordData.word}
                            </button>
                          )}

                          {/* Line break indicator */}
                          {isLastInLine && lineIndex < lyricsLines.length - 1 && (
                            <span className="ml-1 w-1 h-4 bg-cyan-500 rounded-full" title="Line break" />
                          )}
                        </span>
                      );
                    })}
                  </div>

                  {/* Selected word actions */}
                  {line.some(w => w.globalIndex === selectedWordIndex) && selectedWordIndex !== null && editingWord === null && (
                    <div className="flex items-center gap-2 mt-2 ml-8">
                      <button
                        onClick={() => {
                          setEditingWord(lyrics[selectedWordIndex].word);
                        }}
                        className="px-3 py-1 text-xs bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors"
                      >
                        Edit Word
                      </button>
                      {selectedWordIndex > 0 && (
                        <button
                          onClick={() => moveWordDown(selectedWordIndex)}
                          className="px-3 py-1 text-xs bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-colors flex items-center gap-1"
                        >
                          <ArrowDown className="w-3 h-3" />
                          Move Down
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Preview Panel */}
          <div className={`glass-panel p-6 ${isDark ? 'bg-white/5' : 'bg-white/80'}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-lg font-semibold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                <Eye className="w-5 h-5 text-cyan-400" />
                Preview
              </h2>
              <div className="flex items-center gap-2">
                {showPreview && (
                  <div className="flex rounded-lg overflow-hidden border border-white/20">
                    <button
                      onClick={() => setPreviewMode('video')}
                      className={`px-3 py-1.5 text-sm transition-colors ${previewMode === 'video'
                          ? 'bg-cyan-500 text-white'
                          : 'bg-white/10 text-gray-300 hover:bg-white/20'
                        }`}
                    >
                      Video
                    </button>
                    <button
                      onClick={() => setPreviewMode('lyrics')}
                      className={`px-3 py-1.5 text-sm transition-colors ${previewMode === 'lyrics'
                          ? 'bg-purple-500 text-white'
                          : 'bg-white/10 text-gray-300 hover:bg-white/20'
                        }`}
                    >
                      Original Lyrics
                    </button>
                  </div>
                )}
                <button
                  onClick={() => {
                    setShowPreview(!showPreview);
                    setPreviewTime(0);
                    setIsPlaying(false);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${showPreview
                      ? 'bg-cyan-500 text-white'
                      : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }`}
                >
                  {showPreview ? 'Hide' : 'Show'} Preview
                </button>
              </div>
            </div>

            {showPreview ? (
              <div>
                {previewMode === 'video' ? (
                  <>
                    {/* Karaoke preview simulation */}
                    <div
                      className="rounded-xl p-6 mb-4 min-h-[300px] flex flex-col items-center justify-center"
                      style={{ background: 'linear-gradient(to bottom, #1a1a2e, #16213e)' }}
                    >
                      {lyricsLines.slice(
                        Math.max(0, lyricsLines.findIndex(line =>
                          line.some(w => w.globalIndex === getCurrentWordIndex)
                        ) - 1),
                        lyricsLines.findIndex(line =>
                          line.some(w => w.globalIndex === getCurrentWordIndex)
                        ) + 3
                      ).map((line, idx) => (
                        <div key={idx} className="text-center mb-2">
                          {line.map((wordData) => (
                            <span
                              key={wordData.globalIndex}
                              className={`text-lg mx-1 transition-colors ${wordData.globalIndex === getCurrentWordIndex
                                ? 'text-cyan-400 font-bold'
                                : wordData.globalIndex < getCurrentWordIndex
                                  ? 'text-cyan-600'
                                  : 'text-white'
                                }`}
                            >
                              {wordData.word}
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>

                    {/* Playback controls */}
                    <div className="flex items-center justify-center gap-4">
                      <button
                        onClick={() => setPreviewTime(0)}
                        className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                      >
                        <RotateCcw className="w-4 h-4 text-white" />
                      </button>
                      <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="p-3 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:opacity-90 transition-opacity"
                      >
                        {isPlaying ? (
                          <Pause className="w-5 h-5 text-white" />
                        ) : (
                          <Play className="w-5 h-5 text-white ml-0.5" />
                        )}
                      </button>
                      <span className="text-sm text-gray-400 w-20 text-center">
                        {previewTime.toFixed(1)}s
                      </span>
                    </div>
                  </>
                ) : (
                  <div
                    className="rounded-xl p-6 min-h-[300px] max-h-[400px] overflow-y-auto"
                    style={{ background: 'linear-gradient(to bottom, #1a1a2e, #16213e)' }}
                  >
                    <h3 className="text-purple-400 text-sm font-medium mb-3">Your Uploaded Lyrics:</h3>
                    <pre className="text-white text-sm whitespace-pre-wrap font-sans leading-relaxed">
                      {originalLyricsText || 'No original lyrics available'}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Click "Show Preview" to see how your lyrics will appear</p>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/10">
          <Link href="/dashboard">
            <button className={`px-6 py-3 rounded-xl font-medium transition-colors ${isDark
              ? 'bg-white/10 text-white hover:bg-white/20'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}>
              Cancel
            </button>
          </Link>

          <div className="flex items-center gap-3">
            {hasChanges && (
              <span className="text-sm text-yellow-400">
                You have unsaved changes
              </span>
            )}
            <button
              onClick={handleSaveAndRender}
              disabled={saving}
              className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-xl text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Rendering...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>Save & Render Video</span>
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}