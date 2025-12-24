'use client';

/**
 * Upload Page - Karatrack Studio
 * 
 * NEW FILE - Place this at: frontend/pages/upload.jsx
 * 
 * Features added:
 * - Required lyrics textarea (for 100% accuracy)
 * - Display mode selector (Auto/Scroll/Page-by-Page/Overwrite)
 * - Clean version checkbox (profanity filter)
 * - All existing functionality preserved
 */

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import {
  Music,
  Upload,
  Zap,
  Sun,
  Moon,
  LogOut,
  ArrowLeft,
  FileAudio,
  Image as ImageIcon,
  X,
  AlertCircle,
  CheckCircle,
  Loader2,
  ScrollText,
  FileText,
  Layers,
  Wand2,
  ShieldCheck
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function UploadPage() {
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();
  
  // Form state
  const [audioFile, setAudioFile] = useState(null);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState(null);
  const [title, setTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [trackNumber, setTrackNumber] = useState('KT-01');
  const [processingType, setProcessingType] = useState('remove_vocals');
  const [videoQuality, setVideoQuality] = useState('1080p');
  
  // NEW: Lyrics and display options
  const [lyrics, setLyrics] = useState('');
  const [displayMode, setDisplayMode] = useState('auto');
  const [cleanVersion, setCleanVersion] = useState(false);
  
  // UI state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(null);
  
  // Refs
  const thumbnailInputRef = useRef(null);

  // Load user profile on mount
  useState(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      setProfile(data);
    };
    loadProfile();
  }, []);

  // Audio file dropzone
  const onDropAudio = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      setAudioFile(file);
      // Auto-fill title from filename
      if (!title) {
        const nameWithoutExt = file.name.replace(/\.(mp3|wav|flac)$/i, '');
        setTitle(nameWithoutExt);
      }
      setError(null);
    }
  }, [title]);

  const { getRootProps: getAudioRootProps, getInputProps: getAudioInputProps, isDragActive: isAudioDragActive } = useDropzone({
    onDrop: onDropAudio,
    accept: {
      'audio/mpeg': ['.mp3'],
      'audio/wav': ['.wav'],
      'audio/flac': ['.flac']
    },
    maxSize: 500 * 1024 * 1024, // 500MB
    multiple: false
  });

  // Thumbnail handling
  const handleThumbnailChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setThumbnailFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnailPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeThumbnail = () => {
    setThumbnailFile(null);
    setThumbnailPreview(null);
  };

  // Form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!audioFile) {
      setError('Please select an audio file');
      return;
    }

    if (!lyrics.trim()) {
      setError('Please paste the song lyrics for accurate sync. You can find lyrics on sites like Genius or AZLyrics.');
      return;
    }

    if (lyrics.trim().length < 50) {
      setError('Please enter the complete song lyrics (minimum 50 characters)');
      return;
    }

    if (!title.trim()) {
      setError('Please enter a track title');
      return;
    }

    if (!artistName.trim()) {
      setError('Please enter an artist name');
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      // Create FormData
      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('title', title.trim());
      formData.append('artist_name', artistName.trim());
      formData.append('song_title', title.trim());
      formData.append('track_number', trackNumber);
      formData.append('processing_type', processingType);
      formData.append('video_quality', videoQuality);
      formData.append('include_lyrics', 'true');
      
      // NEW: Add lyrics and display options
      formData.append('lyrics_text', lyrics.trim());
      formData.append('display_mode', displayMode);
      formData.append('clean_version', cleanVersion.toString());

      if (thumbnailFile) {
        formData.append('thumbnail', thumbnailFile);
      }

      setUploadProgress(30);

      // Upload to backend
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/projects`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          },
          body: formData
        }
      );

      setUploadProgress(70);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const project = await response.json();
      setUploadProgress(100);

      // Redirect to dashboard
      setTimeout(() => {
        router.push('/dashboard');
      }, 500);

    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Upload failed. Please try again.');
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Display mode options
  const displayModes = [
    {
      value: 'auto',
      label: 'Auto',
      icon: Wand2,
      description: 'AI picks the best mode based on song tempo'
    },
    {
      value: 'scroll',
      label: 'Scroll',
      icon: ScrollText,
      description: 'Smooth continuous scroll - best for fast songs & rap'
    },
    {
      value: 'page',
      label: 'Page-by-Page',
      icon: Layers,
      description: 'Shows verse blocks - best for ballads & slow songs'
    },
    {
      value: 'overwrite',
      label: 'Overwrite',
      icon: FileText,
      description: 'Line by line replacement - traditional karaoke style'
    }
  ];

  return (
    <div className={`min-h-screen ${isDark ? 'bg-animated-dark' : 'bg-animated-light'}`}>
      {/* Navigation */}
      <nav className="border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center">
              <Music className="w-6 h-6 text-white" />
            </div>
            <span className="font-display font-bold text-xl text-gradient">Karatrack Studio</span>
          </Link>

          <div className="flex items-center gap-6">
            {profile && (
              <div className="credit-badge">
                <div className="credit-badge-icon">
                  <Zap className="w-3 h-3 text-white" />
                </div>
                <span className="text-sm text-white">{profile.credits_remaining || 0} Credits</span>
              </div>
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
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Back Button */}
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-8"
        >
          <h1 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            🎵 Create Karaoke Track
          </h1>
          <p className={`mb-8 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Upload your audio and paste the lyrics for perfect sync
          </p>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Section 1: Audio Upload */}
            <section>
              <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                1. Upload Audio File
              </h2>
              
              <div
                {...getAudioRootProps()}
                className={`dropzone cursor-pointer transition-all ${
                  isAudioDragActive ? 'border-cyan-400 bg-cyan-400/10' : ''
                } ${audioFile ? 'border-green-400 bg-green-400/5' : ''}`}
              >
                <input {...getAudioInputProps()} />
                
                {audioFile ? (
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-green-400" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{audioFile.name}</p>
                      <p className="text-gray-400 text-sm">{(audioFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAudioFile(null);
                      }}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-400/20 to-purple-500/20 flex items-center justify-center">
                      <FileAudio className="w-8 h-8 text-cyan-400" />
                    </div>
                    <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {isAudioDragActive ? 'Drop your audio file here' : 'Drag & drop your audio file'}
                    </p>
                    <p className="text-gray-400 text-sm mt-1">MP3, WAV, or FLAC (max 500MB)</p>
                  </>
                )}
              </div>
            </section>

            {/* Section 2: Track Information */}
            <section>
              <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                2. Track Information
              </h2>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Track Title *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter song title"
                    className="glass-input w-full px-4 py-3 rounded-xl"
                  />
                </div>
                
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Artist Name *
                  </label>
                  <input
                    type="text"
                    value={artistName}
                    onChange={(e) => setArtistName(e.target.value)}
                    placeholder="Enter artist name"
                    className="glass-input w-full px-4 py-3 rounded-xl"
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Track Number
                  </label>
                  <input
                    type="text"
                    value={trackNumber}
                    onChange={(e) => setTrackNumber(e.target.value)}
                    placeholder="KT-01"
                    className="glass-input w-full px-4 py-3 rounded-xl"
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Video Quality
                  </label>
                  <select
                    value={videoQuality}
                    onChange={(e) => setVideoQuality(e.target.value)}
                    className="glass-input w-full px-4 py-3 rounded-xl"
                  >
                    <option value="720p">720p (Standard)</option>
                    <option value="1080p">1080p (HD)</option>
                    <option value="4k">4K (Ultra HD)</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Section 3: Lyrics Input (NEW - REQUIRED) */}
            <section>
              <h2 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                3. Song Lyrics *
              </h2>
              <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Paste the complete lyrics below. This ensures 100% accurate word display and sync.
                Find lyrics on <a href="https://genius.com" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Genius</a>, <a href="https://www.azlyrics.com" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">AZLyrics</a>, or <a href="https://www.musixmatch.com" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Musixmatch</a>.
              </p>
              
              <textarea
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                placeholder={`Paste the song lyrics here...\n\nExample:\nVerse 1:\nNever gonna give you up\nNever gonna let you down\nNever gonna run around and desert you\n\nChorus:\n...`}
                rows={10}
                className="glass-input w-full px-4 py-3 rounded-xl resize-y min-h-[200px]"
              />
              
              <div className="flex justify-between mt-2">
                <span className={`text-sm ${lyrics.length < 50 ? 'text-yellow-400' : 'text-green-400'}`}>
                  {lyrics.length} characters {lyrics.length < 50 && '(minimum 50)'}
                </span>
                <span className="text-sm text-gray-500">
                  ~{lyrics.split(/\s+/).filter(w => w).length} words
                </span>
              </div>
            </section>

            {/* Section 4: Display Mode (NEW) */}
            <section>
              <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                4. Lyrics Display Mode
              </h2>
              
              <div className="grid sm:grid-cols-2 gap-3">
                {displayModes.map((mode) => {
                  const Icon = mode.icon;
                  return (
                    <label
                      key={mode.value}
                      className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-all ${
                        displayMode === mode.value
                          ? 'bg-cyan-500/20 border-2 border-cyan-400'
                          : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
                      }`}
                    >
                      <input
                        type="radio"
                        name="displayMode"
                        value={mode.value}
                        checked={displayMode === mode.value}
                        onChange={(e) => setDisplayMode(e.target.value)}
                        className="sr-only"
                      />
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        displayMode === mode.value ? 'bg-cyan-500/30' : 'bg-white/10'
                      }`}>
                        <Icon className={`w-5 h-5 ${displayMode === mode.value ? 'text-cyan-400' : 'text-gray-400'}`} />
                      </div>
                      <div>
                        <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{mode.label}</p>
                        <p className="text-sm text-gray-400">{mode.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </section>

            {/* Section 5: Processing Options */}
            <section>
              <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                5. Processing Options
              </h2>
              
              {/* Vocal Options */}
              <div className="mb-6">
                <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Vocal Removal
                </label>
                <div className="flex flex-wrap gap-3">
                  {[
                    { value: 'remove_vocals', label: 'Remove All Vocals', desc: 'Full karaoke track' },
                    { value: 'isolate_backing', label: 'Keep Backing Vocals', desc: 'Remove lead, keep harmonies' },
                    { value: 'both', label: 'Both Versions', desc: 'Get instrumental + vocals separate' }
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={`flex-1 min-w-[150px] p-3 rounded-xl cursor-pointer transition-all text-center ${
                        processingType === option.value
                          ? 'bg-purple-500/20 border-2 border-purple-400'
                          : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
                      }`}
                    >
                      <input
                        type="radio"
                        name="processingType"
                        value={option.value}
                        checked={processingType === option.value}
                        onChange={(e) => setProcessingType(e.target.value)}
                        className="sr-only"
                      />
                      <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{option.label}</p>
                      <p className="text-xs text-gray-400 mt-1">{option.desc}</p>
                    </label>
                  ))}
                </div>
              </div>

              {/* Clean Version Checkbox (NEW) */}
              <label className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all ${
                cleanVersion
                  ? 'bg-green-500/20 border-2 border-green-400'
                  : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
              }`}>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  cleanVersion ? 'bg-green-500/30' : 'bg-white/10'
                }`}>
                  <ShieldCheck className={`w-5 h-5 ${cleanVersion ? 'text-green-400' : 'text-gray-400'}`} />
                </div>
                <div className="flex-1">
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Clean Version (Family Friendly)
                  </p>
                  <p className="text-sm text-gray-400">
                    Replace profanity with #### symbols
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={cleanVersion}
                  onChange={(e) => setCleanVersion(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-12 h-6 rounded-full transition-colors ${
                  cleanVersion ? 'bg-green-500' : 'bg-gray-600'
                }`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform mt-0.5 ${
                    cleanVersion ? 'translate-x-6 ml-0.5' : 'translate-x-0.5'
                  }`} />
                </div>
              </label>
            </section>

            {/* Section 6: Thumbnail (Optional) */}
            <section>
              <h2 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                6. Thumbnail Image (Optional)
              </h2>
              
              {thumbnailPreview ? (
                <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl">
                  <img
                    src={thumbnailPreview}
                    alt="Thumbnail preview"
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{thumbnailFile?.name}</p>
                    <p className="text-gray-400 text-sm">Thumbnail added</p>
                  </div>
                  <button
                    type="button"
                    onClick={removeThumbnail}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => thumbnailInputRef.current?.click()}
                  className="w-full p-6 border-2 border-dashed border-white/20 rounded-xl hover:border-white/40 transition-colors"
                >
                  <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Add Thumbnail</p>
                  <p className="text-gray-400 text-sm">JPG or PNG (shown at start of video)</p>
                </button>
              )}
              <input
                ref={thumbnailInputRef}
                type="file"
                accept="image/jpeg,image/png,image/jpg"
                onChange={handleThumbnailChange}
                className="hidden"
              />
            </section>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isUploading}
                className="w-full py-4 px-6 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-xl text-white font-semibold text-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Processing... {uploadProgress}%</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    <span>Create Karaoke Track</span>
                  </>
                )}
              </button>
              
              {isUploading && (
                <div className="mt-4">
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-cyan-500 to-purple-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              )}
            </div>
          </form>
        </motion.div>
      </main>
    </div>
  );
}