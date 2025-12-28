'use client';

/**
 * Upload Page - Karatrack Studio (Redesigned)
 * 
 * Place this at: frontend/src/pages/upload.jsx
 * 
 * Features:
 * - Condensed layout
 * - Live preview with customization
 * - Background color/gradient
 * - Text color, outline color, sung color
 * - Font selection
 * - Rights confirmation
 */

import { useState, useRef, useCallback, useEffect } from 'react';
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
  ArrowLeft,
  FileAudio,
  X,
  AlertCircle,
  CheckCircle,
  Loader2,
  Palette,
  Type,
  Eye
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Available fonts
const FONT_OPTIONS = [
  { value: 'arial', label: 'Arial', family: 'Arial, sans-serif' },
  { value: 'roboto', label: 'Roboto', family: '"Roboto", sans-serif' },
  { value: 'poppins', label: 'Poppins', family: '"Poppins", sans-serif' },
  { value: 'montserrat', label: 'Montserrat', family: '"Montserrat", sans-serif' },
  { value: 'oswald', label: 'Oswald', family: '"Oswald", sans-serif' },
  { value: 'playfair', label: 'Playfair Display', family: '"Playfair Display", serif' },
  { value: 'bebas', label: 'Bebas Neue', family: '"Bebas Neue", sans-serif' },
  { value: 'impact', label: 'Impact', family: 'Impact, sans-serif' },
];

// Sample lyrics for preview (original, not from any real song)
const SAMPLE_LYRICS = `Chasing stars across the sky tonight
Dreams are dancing in the neon light
Every heartbeat tells a story new
Finding magic in the morning dew`;

export default function UploadPage() {
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();
  
  // Form state
  const [audioFile, setAudioFile] = useState(null);
  const [title, setTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [trackNumber, setTrackNumber] = useState('KT-01');
  const [processingType, setProcessingType] = useState('remove_vocals');
  const [videoQuality, setVideoQuality] = useState('1080p');
  const [lyrics, setLyrics] = useState('');
  const [displayMode, setDisplayMode] = useState('auto');
  const [cleanVersion, setCleanVersion] = useState(false);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [notifyOnComplete, setNotifyOnComplete] = useState(true);
  const [reviewLyrics, setReviewLyrics] = useState(false);  // NEW: Review lyrics before rendering
  
  // Style customization
  const [bgColor1, setBgColor1] = useState('#1a1a2e');
  const [bgColor2, setBgColor2] = useState('#16213e');
  const [useGradient, setUseGradient] = useState(true);
  const [gradientDirection, setGradientDirection] = useState('to bottom');
  const [textColor, setTextColor] = useState('#ffffff');
  const [outlineColor, setOutlineColor] = useState('#000000');
  const [sungColor, setSungColor] = useState('#00d4ff');
  const [selectedFont, setSelectedFont] = useState('arial');
  
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
        
        // Get profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (profileError) {
          console.error('Profile error:', profileError);
        }
        
        console.log('Profile loaded:', profileData);
        
        // Try to get subscription - attempt different query structures
        let subData = null;
        
        // Attempt 1: With status filter
        const { data: sub1, error: err1 } = await supabase
          .from('subscriptions')
          .select('*, subscription_plans(*)')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();
        
        if (sub1) {
          subData = sub1;
          console.log('Found subscription (with status):', sub1);
        } else {
          console.log('Attempt 1 failed:', err1?.message);
          
          // Attempt 2: Without status filter
          const { data: sub2, error: err2 } = await supabase
            .from('subscriptions')
            .select('*, subscription_plans(*)')
            .eq('user_id', user.id)
            .maybeSingle();
          
          if (sub2) {
            subData = sub2;
            console.log('Found subscription (no status filter):', sub2);
          } else {
            console.log('Attempt 2 failed:', err2?.message);
            
            // Attempt 3: Check if plan info is on profile itself
            console.log('Checking profile for plan info...');
            console.log('Profile fields:', Object.keys(profileData || {}));
          }
        }
        
        // Combine profile with subscription
        setProfile({
          ...profileData,
          subscription: subData
        });
      } catch (err) {
        console.error('Load profile error:', err);
      }
    };
    loadProfile();
  }, [router]);

  // Check if user has Pro or Studio plan
  const isPremiumUser = () => {
    if (!profile) {
      console.log('No profile yet');
      return false;
    }
    
    console.log('Checking premium for profile:', profile);
    console.log('Profile fields:', Object.keys(profile));
    
    // Check subscription plan name
    const planName = profile?.subscription?.subscription_plans?.name?.toLowerCase() || '';
    console.log('Subscription plan name:', planName);
    
    if (planName.includes('pro') || planName.includes('studio')) {
      console.log('✅ Premium via subscription_plans.name');
      return true;
    }
    
    // Check subscription plan_id or plan directly
    const planId = profile?.subscription?.plan_id || profile?.subscription?.subscription_plan_id;
    console.log('Plan ID:', planId);
    
    // Check various profile fields that might indicate plan
    const fieldsToCheck = ['plan_name', 'subscription_tier', 'current_plan', 'plan', 'tier', 'subscription_plan'];
    for (const field of fieldsToCheck) {
      if (profile[field]) {
        const value = String(profile[field]).toLowerCase();
        console.log(`Checking profile.${field}:`, value);
        if (value.includes('pro') || value.includes('studio')) {
          console.log(`✅ Premium via profile.${field}`);
          return true;
        }
      }
    }
    
    console.log('❌ Not premium');
    return false;
  };

  // Audio file dropzone
  const onDropAudio = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      setAudioFile(file);
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
    maxSize: 500 * 1024 * 1024,
    multiple: false
  });

  // Get current font family
  const getCurrentFontFamily = () => {
    const font = FONT_OPTIONS.find(f => f.value === selectedFont);
    return font ? font.family : 'Arial, sans-serif';
  };

  // Get background style
  const getBackgroundStyle = () => {
    if (useGradient) {
      return { background: `linear-gradient(${gradientDirection}, ${bgColor1}, ${bgColor2})` };
    }
    return { backgroundColor: bgColor1 };
  };

  // Form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!audioFile) {
      setError('Please select an audio file');
      return;
    }

    if (!lyrics.trim()) {
      setError('Please paste the song lyrics');
      return;
    }

    if (lyrics.trim().length < 50) {
      setError('Please enter the complete song lyrics (minimum 50 characters)');
      return;
    }

    if (!title.trim()) {
      setError('Please enter a song title');
      return;
    }

    if (!artistName.trim()) {
      setError('Please enter an artist name');
      return;
    }

    if (!rightsConfirmed) {
      setError('Please confirm that you have the legal right to use this audio');
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

      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('title', title.trim());
      formData.append('artist_name', artistName.trim());
      formData.append('song_title', title.trim());
      formData.append('track_number', trackNumber);
      formData.append('processing_type', processingType);
      formData.append('video_quality', videoQuality);
      formData.append('include_lyrics', 'true');
      formData.append('lyrics_text', lyrics.trim());
      formData.append('display_mode', displayMode);
      formData.append('clean_version', cleanVersion.toString());
      
      // Style options
      formData.append('bg_color_1', bgColor1);
      formData.append('bg_color_2', bgColor2);
      formData.append('use_gradient', useGradient.toString());
      formData.append('gradient_direction', gradientDirection);
      formData.append('text_color', textColor);
      formData.append('outline_color', outlineColor);
      formData.append('sung_color', sungColor);
      formData.append('font', selectedFont);
      
      // Email notification
      formData.append('notify_on_complete', notifyOnComplete.toString());
      
      // NEW: Processing mode for lyrics review
      formData.append('processing_mode', reviewLyrics ? 'transcribe_only' : 'full');

      setUploadProgress(30);

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

      const projectData = await response.json();
      setUploadProgress(100);

      setTimeout(() => {
        // Always go to dashboard first - user will click "Review Lyrics" 
        // button once transcription completes (status: awaiting_review)
        if (reviewLyrics) {
          router.push('/dashboard?awaiting_review=true');
        } else {
          router.push('/dashboard');
        }
      }, 500);

    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Upload failed. Please try again.');
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

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
            <button onClick={toggleTheme} className="glass-button p-3 rounded-xl">
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid lg:grid-cols-2 gap-8">
            
            {/* LEFT COLUMN - File & Track Info */}
            <div className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-panel p-6"
              >
                <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  <FileAudio className="w-5 h-5 text-cyan-400" />
                  Audio & Track Info
                </h2>

                {/* Audio Upload */}
                <div
                  {...getAudioRootProps()}
                  className={`dropzone cursor-pointer transition-all mb-4 p-4 ${
                    isAudioDragActive ? 'border-cyan-400 bg-cyan-400/10' : ''
                  } ${audioFile ? 'border-green-400 bg-green-400/5' : ''}`}
                >
                  <input {...getAudioInputProps()} />
                  {audioFile ? (
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      <span className={`flex-1 truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{audioFile.name}</span>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setAudioFile(null); }} className="p-1 hover:bg-white/10 rounded">
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <Upload className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
                      <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Drop audio file or click to browse</p>
                      <p className="text-xs text-gray-500 mt-1">MP3, WAV, FLAC (max 500MB)</p>
                    </div>
                  )}
                </div>

                {/* Track Info Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Disc ID</label>
                    <input
                      type="text"
                      value={trackNumber}
                      onChange={(e) => setTrackNumber(e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Artist *</label>
                    <input
                      type="text"
                      value={artistName}
                      onChange={(e) => setArtistName(e.target.value)}
                      placeholder="Artist name"
                      className="glass-input w-full px-3 py-2 rounded-lg text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Song Title *</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Song title"
                      className="glass-input w-full px-3 py-2 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Output Quality</label>
                    <select
                      value={videoQuality}
                      onChange={(e) => setVideoQuality(e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-lg text-sm"
                    >
                      <option value="720p">720p</option>
                      <option value="1080p">1080p (HD)</option>
                      <option value="4k">4K</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Lyric Display</label>
                    <select
                      value={displayMode}
                      onChange={(e) => setDisplayMode(e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-lg text-sm"
                    >
                      <option value="auto">Auto</option>
                      <option value="scroll">Scroll</option>
                      <option value="page">Page-by-Page</option>
                      <option value="overwrite">Overwrite</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Clean Lyrics</label>
                    <select
                      value={cleanVersion ? 'on' : 'off'}
                      onChange={(e) => setCleanVersion(e.target.value === 'on')}
                      className="glass-input w-full px-3 py-2 rounded-lg text-sm"
                    >
                      <option value="off">OFF</option>
                      <option value="on">ON</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Processing</label>
                    <select
                      value={processingType}
                      onChange={(e) => setProcessingType(e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-lg text-sm"
                    >
                      <option value="remove_vocals">Remove All Vocals</option>
                      <option value="isolate_backing">Keep Backing Vocals</option>
                      <option value="both">Both Versions</option>
                    </select>
                  </div>
                </div>
              </motion.div>

              {/* Lyrics Input */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-panel p-6"
              >
                <h2 className={`text-lg font-semibold mb-2 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  <Type className="w-5 h-5 text-cyan-400" />
                  Lyrics *
                </h2>
                
                {/* AI Disclaimer */}
                <div className={`mb-3 p-2 rounded-lg text-xs ${isDark ? 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-300' : 'bg-yellow-50 border border-yellow-200 text-yellow-700'}`}>
                  ⚡ Lyrics are synced using AI for precise timing. Some words may vary slightly — accuracy improves as AI technology advances.
                </div>
                
                <textarea
                  value={lyrics}
                  onChange={(e) => setLyrics(e.target.value)}
                  placeholder={`Paste lyrics here...\n\nExample:\n${SAMPLE_LYRICS}`}
                  rows={8}
                  className="glass-input w-full px-3 py-2 rounded-lg text-sm resize-none"
                />
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <span className={lyrics.length < 50 ? 'text-yellow-400' : 'text-green-400'}>
                    {lyrics.length} chars {lyrics.length < 50 && '(min 50)'}
                  </span>
                  <span>~{lyrics.split(/\s+/).filter(w => w).length} words</span>
                </div>
              </motion.div>
            </div>

            {/* RIGHT COLUMN - Style Customization & Preview */}
            <div className="space-y-6">
              {/* Live Preview */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-panel p-6"
              >
                <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  <Eye className="w-5 h-5 text-cyan-400" />
                  Live Preview
                </h2>
                
                {/* Preview Box */}
                <div
                  className="rounded-xl overflow-hidden aspect-video flex items-center justify-center p-6"
                  style={getBackgroundStyle()}
                >
                  <div className="text-center space-y-2">
                    {SAMPLE_LYRICS.split('\n').map((line, i) => (
                      <p
                        key={i}
                        style={{
                          fontFamily: getCurrentFontFamily(),
                          color: i === 0 ? sungColor : textColor,
                          textShadow: `
                            -1px -1px 0 ${outlineColor},
                            1px -1px 0 ${outlineColor},
                            -1px 1px 0 ${outlineColor},
                            1px 1px 0 ${outlineColor}
                          `,
                          fontSize: '1.1rem',
                          fontWeight: 'bold'
                        }}
                      >
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Style Customization */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="glass-panel p-6"
              >
                <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  <Palette className="w-5 h-5 text-cyan-400" />
                  Style Customization
                </h2>

                <div className="grid grid-cols-2 gap-4">
                  {/* Font Selection */}
                  <div className="col-span-2">
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Font</label>
                    <select
                      value={selectedFont}
                      onChange={(e) => setSelectedFont(e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-lg text-sm"
                    >
                      {FONT_OPTIONS.map(font => (
                        <option key={font.value} value={font.value}>{font.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Background Colors */}
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      Background {useGradient ? '(Start)' : ''}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={bgColor1}
                        onChange={(e) => setBgColor1(e.target.value)}
                        className="w-10 h-10 rounded-lg cursor-pointer border-0"
                      />
                      <input
                        type="text"
                        value={bgColor1}
                        onChange={(e) => setBgColor1(e.target.value)}
                        className="glass-input flex-1 px-2 py-2 rounded-lg text-xs uppercase"
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      {useGradient ? 'Background (End)' : 'Gradient (Off)'}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={bgColor2}
                        onChange={(e) => setBgColor2(e.target.value)}
                        disabled={!useGradient}
                        className={`w-10 h-10 rounded-lg cursor-pointer border-0 ${!useGradient && 'opacity-50'}`}
                      />
                      <input
                        type="text"
                        value={bgColor2}
                        onChange={(e) => setBgColor2(e.target.value)}
                        disabled={!useGradient}
                        className={`glass-input flex-1 px-2 py-2 rounded-lg text-xs uppercase ${!useGradient && 'opacity-50'}`}
                      />
                    </div>
                  </div>

                  {/* Gradient Toggle & Direction */}
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Gradient</label>
                    <select
                      value={useGradient ? 'on' : 'off'}
                      onChange={(e) => setUseGradient(e.target.value === 'on')}
                      className="glass-input w-full px-3 py-2 rounded-lg text-sm"
                    >
                      <option value="on">ON</option>
                      <option value="off">OFF</option>
                    </select>
                  </div>

                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Direction</label>
                    <select
                      value={gradientDirection}
                      onChange={(e) => setGradientDirection(e.target.value)}
                      disabled={!useGradient}
                      className={`glass-input w-full px-3 py-2 rounded-lg text-sm ${!useGradient && 'opacity-50'}`}
                    >
                      <option value="to bottom">Top → Bottom</option>
                      <option value="to top">Bottom → Top</option>
                      <option value="to right">Left → Right</option>
                      <option value="to left">Right → Left</option>
                      <option value="to bottom right">Diagonal ↘</option>
                      <option value="to bottom left">Diagonal ↙</option>
                    </select>
                  </div>

                  {/* Text Colors */}
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Text Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={textColor}
                        onChange={(e) => setTextColor(e.target.value)}
                        className="w-10 h-10 rounded-lg cursor-pointer border-0"
                      />
                      <input
                        type="text"
                        value={textColor}
                        onChange={(e) => setTextColor(e.target.value)}
                        className="glass-input flex-1 px-2 py-2 rounded-lg text-xs uppercase"
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Text Outline</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={outlineColor}
                        onChange={(e) => setOutlineColor(e.target.value)}
                        className="w-10 h-10 rounded-lg cursor-pointer border-0"
                      />
                      <input
                        type="text"
                        value={outlineColor}
                        onChange={(e) => setOutlineColor(e.target.value)}
                        className="glass-input flex-1 px-2 py-2 rounded-lg text-xs uppercase"
                      />
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Sung Color (After Read)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={sungColor}
                        onChange={(e) => setSungColor(e.target.value)}
                        className="w-10 h-10 rounded-lg cursor-pointer border-0"
                      />
                      <input
                        type="text"
                        value={sungColor}
                        onChange={(e) => setSungColor(e.target.value)}
                        className="glass-input flex-1 px-2 py-2 rounded-lg text-xs uppercase"
                      />
                      <span className="text-xs text-gray-500">← First line shows this color</span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Rights Confirmation & Submit */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="glass-panel p-6"
              >
                {/* Email Notification Checkbox */}
                <label className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all mb-3 ${
                  notifyOnComplete
                    ? 'bg-purple-500/20 border border-purple-400'
                    : 'bg-white/5 border border-transparent hover:bg-white/10'
                }`}>
                  <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 border-2 transition-colors ${
                    notifyOnComplete ? 'bg-purple-500 border-purple-500' : 'border-gray-500'
                  }`}>
                    {notifyOnComplete && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      📧 Notify me when processing is complete
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
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

                {/* Review Lyrics Checkbox - Pro/Studio Only */}
                {isPremiumUser() && (
                  <label className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all mb-3 ${
                    reviewLyrics
                      ? 'bg-yellow-500/20 border border-yellow-400'
                      : 'bg-white/5 border border-transparent hover:bg-white/10'
                  }`}>
                    <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 border-2 transition-colors ${
                      reviewLyrics ? 'bg-yellow-500 border-yellow-500' : 'border-gray-500'
                    }`}>
                      {reviewLyrics && <CheckCircle className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        ✏️ Review & edit lyrics before rendering
                        <span className="ml-2 px-2 py-0.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs rounded-full">PRO</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Preview AI-generated lyrics and fix any mistakes before your video is created
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={reviewLyrics}
                      onChange={(e) => setReviewLyrics(e.target.checked)}
                      className="sr-only"
                    />
                  </label>
                )}

                {/* Rights Checkbox */}
                <label className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all mb-4 ${
                  rightsConfirmed
                    ? 'bg-cyan-500/20 border border-cyan-400'
                    : 'bg-white/5 border border-red-500/50 hover:bg-white/10'
                }`}>
                  <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 border-2 transition-colors ${
                    rightsConfirmed ? 'bg-cyan-500 border-cyan-500' : 'border-gray-500'
                  }`}>
                    {rightsConfirmed && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      I confirm I have the legal right to use this audio
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      I own, have licensed, or created this content. <Link href="/terms" className="text-cyan-400 hover:underline">Terms of Service</Link>
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={rightsConfirmed}
                    onChange={(e) => setRightsConfirmed(e.target.checked)}
                    className="sr-only"
                  />
                </label>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isUploading || !rightsConfirmed}
                  className={`w-full py-4 px-6 rounded-xl text-white font-semibold text-lg transition-all flex items-center justify-center gap-3 ${
                    rightsConfirmed 
                      ? 'bg-gradient-to-r from-cyan-500 to-purple-500 hover:opacity-90' 
                      : 'bg-gray-600 cursor-not-allowed'
                  } disabled:opacity-50`}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Processing... {uploadProgress}%</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      <span>
                        {!rightsConfirmed 
                          ? 'Confirm Rights Above' 
                          : reviewLyrics 
                            ? 'Process & Review Lyrics' 
                            : 'Create Karaoke Track'
                        }
                      </span>
                    </>
                  )}
                </button>
                
                {isUploading && (
                  <div className="mt-4 h-2 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-cyan-500 to-purple-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}