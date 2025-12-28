'use client';

/**
 * Lyrics Editor Page - Karatrack Studio
 * 
 * Place this at: frontend/src/pages/edit/[id].jsx
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Music,
  ArrowLeft,
  Check,
  X,
  Edit3,
  RefreshCw,
  Sun,
  Moon,
  Loader2,
  AlertCircle,
  Info,
  Zap
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function LyricsEditorPage() {
  const router = useRouter();
  const { id } = router.query;
  const { isDark, toggleTheme } = useTheme();
  
  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [project, setProject] = useState(null);
  const [lyrics, setLyrics] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Group lyrics into lines for display
  const groupLyricsIntoLines = (words, wordsPerLine = 7) => {
    const lines = [];
    for (let i = 0; i < words.length; i += wordsPerLine) {
      lines.push(words.slice(i, i + wordsPerLine));
    }
    return lines;
  };

  // Fetch project and lyrics
  useEffect(() => {
    if (!id) return;
    
    const fetchLyrics = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/projects/${id}/lyrics`,
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to load lyrics');
        }

        const data = await response.json();
        setProject(data);
        setLyrics(data.lyrics || []);
        
      } catch (err) {
        console.error('Error fetching lyrics:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLyrics();
  }, [id, router]);

  // Start editing a word
  const startEditing = (index) => {
    setEditingIndex(index);
    setEditValue(lyrics[index].word);
  };

  // Save edited word
  const saveEdit = () => {
    if (editingIndex === null) return;
    
    const newLyrics = [...lyrics];
    const originalWord = newLyrics[editingIndex].word;
    
    if (editValue.trim() !== originalWord) {
      newLyrics[editingIndex] = {
        ...newLyrics[editingIndex],
        word: editValue.trim(),
        edited: true,
        originalWord: newLyrics[editingIndex].originalWord || originalWord
      };
      setLyrics(newLyrics);
      setHasChanges(true);
    }
    
    setEditingIndex(null);
    setEditValue('');
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingIndex(null);
    setEditValue('');
  };

  // Revert a word to original
  const revertWord = (index) => {
    const newLyrics = [...lyrics];
    if (newLyrics[index].originalWord) {
      newLyrics[index] = {
        ...newLyrics[index],
        word: newLyrics[index].originalWord,
        edited: false,
        originalWord: undefined
      };
      setLyrics(newLyrics);
      
      const stillHasChanges = newLyrics.some(w => w.edited);
      setHasChanges(stillHasChanges);
    }
  };

  // Reset all changes
  const resetAll = () => {
    const originalLyrics = lyrics.map(word => ({
      ...word,
      word: word.originalWord || word.word,
      edited: false,
      originalWord: undefined
    }));
    setLyrics(originalLyrics);
    setHasChanges(false);
  };

  // Submit and render video
  const submitAndRender = async () => {
    try {
      setSaving(true);
      setError(null);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const cleanedLyrics = lyrics.map(({ word, start, end }) => ({
        word,
        start,
        end
      }));

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/projects/${id}/render`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            edited_lyrics: cleanedLyrics
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start rendering');
      }

      setShowSuccess(true);
      
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
      
    } catch (err) {
      console.error('Error submitting:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  // Format timestamp
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    return `${mins}:${secs.padStart(5, '0')}`;
  };

  // Loading state
  if (loading) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-animated-dark' : 'bg-animated-light'} flex items-center justify-center`}>
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>Loading lyrics...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !project) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-animated-dark' : 'bg-animated-light'} flex items-center justify-center`}>
        <div className="text-center glass-panel p-8 max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Error Loading Lyrics</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <Link href="/dashboard">
            <button className="px-6 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors">
              Back to Dashboard
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const lyricsLines = groupLyricsIntoLines(lyrics);

  return (
    <div className={`min-h-screen ${isDark ? 'bg-animated-dark' : 'bg-animated-light'}`}>
      {/* Success Modal */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="glass-panel p-8 text-center max-w-md mx-4"
            >
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Video Rendering Started!</h2>
              <p className="text-gray-400 mb-4">Your edited lyrics are being processed.</p>
              <p className="text-sm text-cyan-400">Redirecting to dashboard...</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <nav className="border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
              <span>Back</span>
            </Link>
            <div className="h-6 w-px bg-white/20" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center">
                <Music className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {project?.song_title || 'Untitled'}
                </h1>
                <p className="text-sm text-gray-400">{project?.artist_name || 'Unknown Artist'}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {hasChanges && (
              <button
                onClick={resetAll}
                className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reset All</span>
              </button>
            )}
            
            <button
              onClick={toggleTheme}
              className="glass-button p-3 rounded-xl"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Instructions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-4 mb-6 flex items-start gap-3"
        >
          <Info className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
              <strong>Click any word to edit it.</strong> The timing stays the same.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Edited words are highlighted in yellow. Press Enter to save, Escape to cancel.
            </p>
          </div>
        </motion.div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Lyrics Editor */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-panel p-6 mb-6"
        >
          <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            <Edit3 className="w-5 h-5 inline mr-2 text-cyan-400" />
            Edit Lyrics
          </h2>

          <div className="space-y-4">
            {lyricsLines.map((line, lineIndex) => (
              <div key={lineIndex} className="flex flex-wrap gap-2 items-center">
                <span className="text-xs text-gray-500 w-16 flex-shrink-0">
                  {formatTime(line[0]?.start || 0)}
                </span>
                
                {line.map((wordData, wordIndex) => {
                  const globalIndex = lineIndex * 7 + wordIndex;
                  const isEditing = editingIndex === globalIndex;
                  const isEdited = wordData.edited;
                  
                  return (
                    <div key={globalIndex} className="relative group">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            autoFocus
                            className="px-2 py-1 bg-cyan-500/20 border border-cyan-400 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 w-24"
                          />
                          <button
                            onClick={saveEdit}
                            className="p-1 text-green-400 hover:bg-green-400/20 rounded"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1 text-red-400 hover:bg-red-400/20 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditing(globalIndex)}
                          className={`px-2 py-1 rounded text-sm transition-all ${
                            isEdited
                              ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/50'
                              : 'bg-white/5 text-white hover:bg-white/10 border border-transparent'
                          }`}
                        >
                          {wordData.word}
                        </button>
                      )}
                      
                      {isEdited && !isEditing && (
                        <button
                          onClick={() => revertWord(globalIndex)}
                          className="absolute -top-2 -right-2 p-0.5 bg-gray-800 rounded-full text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          title={`Revert to "${wordData.originalWord}"`}
                        >
                          <RefreshCw className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {lyrics.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400">No lyrics available</p>
            </div>
          )}
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-3 gap-4 mb-6"
        >
          <div className="glass-panel p-4 text-center">
            <p className="text-2xl font-bold text-white">{lyrics.length}</p>
            <p className="text-xs text-gray-400">Total Words</p>
          </div>
          <div className="glass-panel p-4 text-center">
            <p className="text-2xl font-bold text-yellow-400">
              {lyrics.filter(w => w.edited).length}
            </p>
            <p className="text-xs text-gray-400">Words Edited</p>
          </div>
          <div className="glass-panel p-4 text-center">
            <p className="text-2xl font-bold text-cyan-400">{lyricsLines.length}</p>
            <p className="text-xs text-gray-400">Lines</p>
          </div>
        </motion.div>

        {/* Submit Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <button
            onClick={submitAndRender}
            disabled={saving}
            className="w-full py-4 px-6 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-xl text-white font-semibold text-lg transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Starting Video Render...</span>
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                <span>Generate Video with {hasChanges ? 'Edited' : 'These'} Lyrics</span>
              </>
            )}
          </button>
          
          <p className="text-center text-xs text-gray-500 mt-3">
            Video rendering typically takes 3-5 minutes.
          </p>
        </motion.div>
      </main>
    </div>
  );
}