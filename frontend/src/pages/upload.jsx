'use client';

/**
 * Upload Page - Karatrack Studio (Simplified)
 * 
 * Place this at: frontend/src/pages/upload.jsx
 * 
 * Simplified layout:
 * - Song Title input
 * - Audio upload with compatible file types list + drag & drop
 * - Lyrics paste/drop area
 * - Email notification checkbox
 * - Combined rights confirmation + render button
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import {
  Music,
  Upload,
  Zap,
  ArrowLeft,
  FileAudio,
  X,
  AlertCircle,
  CheckCircle,
  Loader2,
  Type,
  Shield,
  Send,
  FileText,
  Headphones
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import AppNavigation from '../components/AppNavigation';
import { createClient } from '@supabase/supabase-js';
import SEO from '../components/SEO';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Compatible audio file types
const COMPATIBLE_TYPES = [
  { ext: '.mp3', label: 'MP3', desc: 'MPEG Audio' },
  { ext: '.wav', label: 'WAV', desc: 'Waveform Audio' },
  { ext: '.flac', label: 'FLAC', desc: 'Free Lossless' },
  { ext: '.m4a', label: 'M4A', desc: 'MPEG-4 Audio' },
  { ext: '.aac', label: 'AAC', desc: 'Advanced Audio' },
  { ext: '.ogg', label: 'OGG', desc: 'Ogg Vorbis' },
  { ext: '.wma', label: 'WMA', desc: 'Windows Media' },
];

// Sample lyrics placeholder
const LYRICS_PLACEHOLDER = `Paste your lyrics here...

Example:
Chasing stars across the sky tonight
Dreams are dancing in the neon light
Every heartbeat tells a story new
Finding magic in the morning dew

Leave a blank line between verses.`;

export default function UploadPage() {
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();

  // Form state
  const [audioFile, setAudioFile] = useState(null);
  const [trackNumber, setTrackNumber] = useState('KT-01');
  const [artistName, setArtistName] = useState('');
  const [title, setTitle] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [notifyOnComplete, setNotifyOnComplete] = useState(true);

  // UI state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(null);

  // Load user profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError) {
          console.error('Profile error:', profileError);
        }

        let subData = null;
        const { data: sub1 } = await supabase
          .from('subscriptions')
          .select('*, subscription_plans(*)')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();

        if (sub1) {
          subData = sub1;
        } else {
          const { data: sub2 } = await supabase
            .from('subscriptions')
            .select('*, subscription_plans(*)')
            .eq('user_id', user.id)
            .maybeSingle();
          if (sub2) subData = sub2;
        }

        setProfile({ ...profileData, subscription: subData });
      } catch (err) {
        console.error('Load profile error:', err);
      }
    };
    loadProfile();
  }, [router]);

  // Check for dropped file from dashboard
  useEffect(() => {
    if (typeof window !== 'undefined' && window.__droppedAudioFile) {
      const file = window.__droppedAudioFile;
      setAudioFile(file);
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      setTitle(nameWithoutExt);
      window.__droppedAudioFile = null;
    }
  }, []);

  // Audio dropzone
  const onAudioDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      setAudioFile(file);
      if (!title) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        setTitle(nameWithoutExt);
      }
    }
  }, [title]);

  const { getRootProps: getAudioRootProps, getInputProps: getAudioInputProps, isDragActive: isAudioDragActive } = useDropzone({
    onDrop: onAudioDrop,
    accept: { 'audio/*': ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.wma'] },
    maxFiles: 1,
    maxSize: 500 * 1024 * 1024
  });

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Form submit handler
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!rightsConfirmed) {
      setError('Please confirm you have the rights to use this file');
      return;
    }
    if (!audioFile) {
      setError('Please upload an audio file');
      return;
    }
    if (!title) {
      setError('Please enter a song title');
      return;
    }
    if (!lyrics || lyrics.length < 50) {
      setError('Please paste your lyrics (minimum 50 characters)');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('title', title);
      formData.append('artist_name', artistName);
      formData.append('song_title', title);
      formData.append('track_number', trackNumber);
      formData.append('lyrics_text', lyrics);
      formData.append('notify_on_complete', notifyOnComplete.toString());
      formData.append('include_lyrics', 'true');
      formData.append('processing_mode', 'transcribe_only');  // Preview lyrics before rendering

      // Use defaults for everything else
      formData.append('processing_type', 'remove_vocals');
      formData.append('video_quality', '480p');
      formData.append('display_mode', 'auto');
      formData.append('bg_type', 'gradient');
      formData.append('bg_color_1', '#1a1a2e');
      formData.append('bg_color_2', '#16213e');
      formData.append('use_gradient', 'true');
      formData.append('gradient_direction', 'to bottom');
      formData.append('text_color', '#ffffff');
      formData.append('outline_color', '#000000');
      formData.append('sung_color', '#00d4ff');
      formData.append('font', 'arial');
      formData.append('font_size', 'normal');
      formData.append('clean_version', 'false');

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/projects`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      router.push('/dashboard');
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Can we submit?
  const canSubmit = audioFile && title && lyrics.length >= 50 && rightsConfirmed && !isUploading;

  return (
    <>
      <SEO
        title="Create Karaoke Track | Karatrack Studio"
        description="Upload your music and create professional karaoke videos with synced lyrics."
      />

      <div className={`min-h-screen transition-colors ${isDark ? 'bg-animated-dark' : 'bg-animated-light'}`}>
        <AppNavigation profile={profile} />

        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Back Link */}
          <Link
            href="/dashboard"
            className={`inline-flex items-center gap-2 text-sm mb-8 transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>

          {/* Page Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className={`text-3xl sm:text-4xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
              <span className="text-gradient">Create</span> Karaoke Track
            </h1>
            <p className={`mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Upload your audio, paste your lyrics, and we'll handle the rest.
            </p>
          </motion.div>

          {/* Error Display */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-400 text-sm">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="ml-auto p-1 rounded-lg hover:bg-red-500/20 transition-colors"
                >
                  <X className="w-4 h-4 text-red-400" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                SECTION 1: Track Info
            â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="glass-panel p-6"
            >
              <h2 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                <Music className="w-5 h-5 text-cyan-400" />
                Track Info
              </h2>

              <div className="grid grid-cols-4 gap-3">
                {/* Track ID - smaller, 1 column */}
                <div className="col-span-1">
                  <label
                    htmlFor="track-id"
                    className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
                  >
                    Track ID
                  </label>
                  <input
                    id="track-id"
                    type="text"
                    value={trackNumber}
                    onChange={(e) => setTrackNumber(e.target.value)}
                    placeholder="KT-01"
                    className="glass-input w-full px-3 py-3 rounded-xl text-sm"
                  />
                </div>

                {/* Artist - 3 columns */}
                <div className="col-span-3">
                  <label
                    htmlFor="artist-name"
                    className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
                  >
                    Artist
                  </label>
                  <input
                    id="artist-name"
                    type="text"
                    value={artistName}
                    onChange={(e) => setArtistName(e.target.value)}
                    placeholder="Artist name"
                    className="glass-input w-full px-3 py-3 rounded-xl text-sm"
                  />
                </div>

                {/* Song Title - full width */}
                <div className="col-span-4">
                  <label
                    htmlFor="song-title"
                    className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
                  >
                    Song Title *
                  </label>
                  <input
                    id="song-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter the song title..."
                    className="glass-input w-full px-3 py-3 rounded-xl text-sm"
                  />
                </div>
              </div>
            </motion.div>

            {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                SECTION 2: Audio Upload + File Types
            â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-panel p-6"
            >
              <h2 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                <FileAudio className="w-5 h-5 text-cyan-400" />
                Upload Audio File
              </h2>

              {/* Drag & Drop / File Explorer Zone */}
              <div
                {...getAudioRootProps()}
                className={`relative rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300 overflow-hidden ${
                  isAudioDragActive
                    ? 'border-cyan-400 bg-cyan-400/10 scale-[1.01]'
                    : audioFile
                      ? isDark
                        ? 'border-green-400/50 bg-green-400/5'
                        : 'border-green-400/50 bg-green-50'
                      : isDark
                        ? 'border-white/15 hover:border-cyan-400/50 bg-white/[0.02]'
                        : 'border-gray-300 hover:border-cyan-500/50 bg-white/50'
                }`}
              >
                <input {...getAudioInputProps()} />

                {audioFile ? (
                  /* â”€â”€ File Selected State â”€â”€ */
                  <div className="p-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-green-500/20' : 'bg-green-100'}`}>
                        <CheckCircle className="w-6 h-6 text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {audioFile.name}
                        </p>
                        <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                          {formatFileSize(audioFile.size)} &middot; Ready to process
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setAudioFile(null); }}
                        className={`p-2 rounded-xl transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-200'}`}
                      >
                        <X className="w-5 h-5 text-gray-400" />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* â”€â”€ Empty / Drag State â”€â”€ */
                  <div className="p-8 sm:p-10 text-center">
                    <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center ${isDark ? 'bg-cyan-400/10' : 'bg-cyan-50'}`}>
                      <Upload className={`w-8 h-8 ${isAudioDragActive ? 'text-cyan-300 animate-bounce' : 'text-cyan-400'}`} />
                    </div>
                    <p className={`text-base font-medium mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {isAudioDragActive ? 'Drop your audio file here...' : 'Drag & drop your audio file'}
                    </p>
                    <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                      or <span className="text-cyan-400 font-medium">browse files</span> &middot; Max 500MB
                    </p>
                  </div>
                )}
              </div>

              {/* Compatible File Types */}
              <div className="mt-4">
                <p className={`text-xs font-medium mb-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                  Compatible formats:
                </p>
                <div className="flex flex-wrap gap-2">
                  {COMPATIBLE_TYPES.map((type) => (
                    <span
                      key={type.ext}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        isDark
                          ? 'bg-white/[0.04] text-gray-400 border border-white/[0.06]'
                          : 'bg-gray-100 text-gray-600 border border-gray-200'
                      }`}
                      title={type.desc}
                    >
                      <Headphones className="w-3 h-3 opacity-50" />
                      {type.label}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                SECTION 3: Lyrics
            â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="glass-panel p-6"
            >
              <h2 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                <Type className="w-5 h-5 text-cyan-400" />
                Lyrics
              </h2>

              {/* AI timing note */}
              <p className={`text-xs mb-4 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                Paste your lyrics below. Our AI will sync them to the audio with precise timing.
              </p>

              <textarea
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                placeholder={LYRICS_PLACEHOLDER}
                rows={10}
                className="glass-input w-full px-4 py-3 rounded-xl text-sm resize-none leading-relaxed"
              />

              {/* Character / word count */}
              <div className="flex items-center justify-between mt-3">
                <span className={`text-xs font-medium ${
                  lyrics.length === 0
                    ? isDark ? 'text-gray-600' : 'text-gray-400'
                    : lyrics.length < 50
                      ? 'text-yellow-400'
                      : 'text-green-400'
                }`}>
                  {lyrics.length} characters {lyrics.length > 0 && lyrics.length < 50 && '(min 50)'}
                </span>
                <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                  ~{lyrics.split(/\s+/).filter(w => w).length} words
                </span>
              </div>
            </motion.div>

            {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                SECTION 4: Email + Rights + Render
            â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-panel p-6 space-y-4"
            >
              {/* Email Notification Toggle */}
              <label className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                notifyOnComplete
                  ? isDark
                    ? 'bg-purple-500/15 border border-purple-400/40'
                    : 'bg-purple-50 border border-purple-300'
                  : isDark
                    ? 'bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06]'
                    : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
              }`}>
                <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 border-2 transition-colors ${
                  notifyOnComplete ? 'bg-purple-500 border-purple-500' : isDark ? 'border-gray-600' : 'border-gray-400'
                }`}>
                  {notifyOnComplete && <CheckCircle className="w-3 h-3 text-white" />}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Notify me when processing is complete
                  </p>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                    We'll email you a download link when your karaoke track is ready
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={notifyOnComplete}
                  onChange={(e) => setNotifyOnComplete(e.target.checked)}
                  className="sr-only"
                />
              </label>

              {/* Divider */}
              <div className={`border-t ${isDark ? 'border-white/[0.06]' : 'border-gray-200'}`} />

              {/* Combined: Rights Confirmation + Render Button */}
              <div>
                {/* Rights checkbox */}
                <label className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all mb-4 ${
                  rightsConfirmed
                    ? isDark
                      ? 'bg-cyan-500/15 border border-cyan-400/40'
                      : 'bg-cyan-50 border border-cyan-300'
                    : isDark
                      ? 'bg-white/[0.03] border border-red-500/30 hover:bg-white/[0.06]'
                      : 'bg-gray-50 border border-red-300/50 hover:bg-gray-100'
                }`}>
                  <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 border-2 transition-colors ${
                    rightsConfirmed ? 'bg-cyan-500 border-cyan-500' : isDark ? 'border-gray-600' : 'border-gray-400'
                  }`}>
                    {rightsConfirmed && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      I confirm I have the legal right to use this audio
                    </p>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                      I own, have licensed, or created this content.{' '}
                      <Link href="/terms" className="text-cyan-400 hover:underline">
                        Terms of Service
                      </Link>
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={rightsConfirmed}
                    onChange={(e) => setRightsConfirmed(e.target.checked)}
                    className="sr-only"
                  />
                </label>

                {/* Render Button */}
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={`w-full py-4 px-6 rounded-xl text-white font-semibold text-lg transition-all duration-300 flex items-center justify-center gap-3 ${
                    canSubmit
                      ? 'bg-gradient-to-r from-cyan-500 to-purple-500 hover:shadow-lg hover:shadow-cyan-500/25 hover:scale-[1.01] active:scale-[0.99]'
                      : isDark
                        ? 'bg-white/10 text-white/30 cursor-not-allowed'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Processing... {uploadProgress}%</span>
                    </>
                  ) : !rightsConfirmed ? (
                    <>
                      <Shield className="w-5 h-5" />
                      <span>Confirm Rights to Render</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      <span>Process Track for Customization</span>
                    </>
                  )}
                </button>

                {/* Progress bar (shown during upload) */}
                {isUploading && (
                  <div className={`mt-4 h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}>
                    <motion.div
                      className="h-full bg-gradient-to-r from-cyan-500 to-purple-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}
              </div>
            </motion.div>

          </form>

          {/* Footer spacer */}
          <div className="h-12" />
        </main>
      </div>
    </>
  );
}
