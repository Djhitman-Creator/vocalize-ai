'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  Music, 
  Upload, 
  Zap, 
  LogOut, 
  X,
  FileAudio,
  Mic2,
  FileVideo,
  Type,
  ChevronLeft,
  Check,
  AlertCircle,
  Image,
  User
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function UploadPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Upload state
  const [file, setFile] = useState(null);
  const [thumbnail, setThumbnail] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  
  // Track info
  const [artistName, setArtistName] = useState('');
  const [songTitle, setSongTitle] = useState('');
  
  // Options
  const [processingType, setProcessingType] = useState('remove_vocals');
  const [includeLyrics, setIncludeLyrics] = useState(true);
  const [videoQuality, setVideoQuality] = useState('1080p');

  // Calculate next track number
  const nextTrackNumber = `KT-${String((profile?.track_count || 0) + 1).padStart(2, '0')}`;
  
  // Preview of export filename
  const exportFilename = artistName && songTitle 
    ? `${nextTrackNumber} - ${artistName} - ${songTitle}`
    : nextTrackNumber;

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      setUser(user);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      setProfile(profileData);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate credits needed
  const calculateCredits = () => {
    let credits = 0;
    
    // Processing type
    if (processingType === 'both') {
      credits += 3;
    } else {
      credits += 2;
    }
    
    // Lyrics
    if (includeLyrics) {
      credits += 1;
    }
    
    // Video quality
    if (videoQuality === '4k') {
      credits += 3;
    } else if (videoQuality === '1080p') {
      credits += 2;
    } else {
      credits += 1;
    }
    
    return credits;
  };

  const creditsNeeded = calculateCredits();
  const hasEnoughCredits = profile?.credits_remaining >= creditsNeeded;

  // Handle drag events
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  // Handle drop
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  // Handle file selection
  const handleFile = (selectedFile) => {
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/mp3', 'audio/x-wav'];
    
    if (!allowedTypes.includes(selectedFile.type)) {
      setError('Invalid file type. Please upload MP3, WAV, or FLAC files.');
      return;
    }
    
    // Check file size (100MB max for Pro, adjust based on tier)
    const maxSize = 100 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      setError('File too large. Maximum size is 100MB.');
      return;
    }
    
    setFile(selectedFile);
    
    // Try to parse artist - title from filename
    const filename = selectedFile.name.replace(/\.[^/.]+$/, '');
    if (filename.includes(' - ')) {
      const parts = filename.split(' - ');
      setArtistName(parts[0].trim());
      setSongTitle(parts.slice(1).join(' - ').trim());
    } else {
      setSongTitle(filename);
    }
    
    setError('');
  };

  // Handle thumbnail selection
  const handleThumbnail = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(selectedFile.type)) {
      setError('Invalid thumbnail type. Please upload JPG or PNG.');
      return;
    }
    
    setThumbnail(selectedFile);
    setThumbnailPreview(URL.createObjectURL(selectedFile));
    setError('');
  };

  // Handle upload
  const handleUpload = async () => {
    if (!file) {
      setError('Please select an audio file');
      return;
    }
    
    if (!artistName.trim()) {
      setError('Please enter an artist name');
      return;
    }
    
    if (!songTitle.trim()) {
      setError('Please enter a song title');
      return;
    }
    
    if (!hasEnoughCredits) {
      setError('Not enough credits. Please purchase more credits.');
      return;
    }
    
    setUploading(true);
    setError('');
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const formData = new FormData();
      formData.append('audio', file);
      formData.append('title', `${nextTrackNumber} - ${artistName} - ${songTitle}`);
      formData.append('artist_name', artistName);
      formData.append('song_title', songTitle);
      formData.append('track_number', nextTrackNumber);
      formData.append('processing_type', processingType);
      formData.append('include_lyrics', includeLyrics);
      formData.append('video_quality', videoQuality);
      
      if (thumbnail) {
        formData.append('thumbnail', thumbnail);
      }
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/projects`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }
      
      // Redirect to dashboard with success
      router.push('/dashboard?upload=success');
      
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-animated-dark flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-animated-dark">
      {/* Navigation */}
      <nav className="border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center">
              <Music className="w-6 h-6 text-white" />
            </div>
            <span className="font-display font-bold text-xl text-gradient">VocalizeAI</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <div className="credit-badge">
              <div className="credit-badge-icon">
                <Zap className="w-3 h-3 text-white" />
              </div>
              <span className="text-sm text-white">{profile?.credits_remaining || 0} Credits</span>
            </div>
            
            <button
              onClick={handleLogout}
              className="glass-button p-3 rounded-xl text-gray-400 hover:text-white"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Back Button */}
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6">
          <ChevronLeft className="w-5 h-5" />
          Back to Dashboard
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold text-white mb-2">Upload Track</h1>
          <p className="text-gray-400 mb-8">Transform your music with AI-powered processing</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mb-6 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-400">{error}</p>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-8">
            {/* Left Column - File Upload */}
            <div className="space-y-6">
              {/* Audio Upload */}
              <div className="glass-panel p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <FileAudio className="w-5 h-5 text-cyan-400" />
                  Audio File
                </h2>
                
                {!file ? (
                  <div
                    className={`dropzone relative ${dragActive ? 'border-cyan-400 bg-cyan-400/10' : ''}`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                  >
                    <input
                      type="file"
                      accept=".mp3,.wav,.flac"
                      onChange={(e) => handleFile(e.target.files[0])}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Upload className="w-12 h-12 text-cyan-500 mx-auto mb-4" />
                    <p className="text-white font-medium mb-2">Drop your audio file here</p>
                    <p className="text-gray-400 text-sm">or click to browse</p>
                    <p className="text-gray-500 text-xs mt-4">MP3, WAV, FLAC • Max 100MB</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 p-4 bg-white/5 rounded-xl">
                    <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                      <Music className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{file.name}</p>
                      <p className="text-gray-400 text-sm">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setFile(null);
                        setArtistName('');
                        setSongTitle('');
                      }}
                      className="p-2 text-gray-400 hover:text-white"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Artist & Song Title */}
              <div className="glass-panel p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-purple-400" />
                  Track Information
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Artist Name *</label>
                    <input
                      type="text"
                      value={artistName}
                      onChange={(e) => setArtistName(e.target.value)}
                      placeholder="Enter artist name..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Song Title *</label>
                    <input
                      type="text"
                      value={songTitle}
                      onChange={(e) => setSongTitle(e.target.value)}
                      placeholder="Enter song title..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  
                  {/* Export Filename Preview */}
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <p className="text-gray-400 text-sm mb-1">Export filename:</p>
                    <p className="text-cyan-400 font-mono text-sm">{exportFilename}.mp4</p>
                  </div>
                </div>
              </div>

              {/* Thumbnail Upload */}
              <div className="glass-panel p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Image className="w-5 h-5 text-purple-400" />
                  Thumbnail (Optional)
                </h2>
                
                {!thumbnail ? (
                  <div className="relative">
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png"
                      onChange={handleThumbnail}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center hover:border-purple-400/50 transition-colors">
                      <Image className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                      <p className="text-gray-400 text-sm">Add a thumbnail for your video</p>
                      <p className="text-gray-500 text-xs mt-2">JPG or PNG</p>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <img
                      src={thumbnailPreview}
                      alt="Thumbnail preview"
                      className="w-full h-40 object-cover rounded-xl"
                    />
                    <button
                      onClick={() => {
                        setThumbnail(null);
                        setThumbnailPreview(null);
                      }}
                      className="absolute top-2 right-2 p-2 bg-black/50 rounded-lg text-white hover:bg-black/70"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Options */}
            <div className="space-y-6">
              {/* Processing Type */}
              <div className="glass-panel p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Mic2 className="w-5 h-5 text-cyan-400" />
                  Processing Type
                </h2>
                <div className="space-y-3">
                  {[
                    { value: 'remove_vocals', label: 'Remove Vocals', desc: 'Remove all vocals from track' },
                    { value: 'isolate_backing', label: 'Isolate Backing Vocals', desc: 'Keep only backing vocals' },
                    { value: 'both', label: 'Both', desc: 'Get instrumental + isolated vocals' },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-colors ${
                        processingType === option.value
                          ? 'bg-cyan-500/20 border border-cyan-500/50'
                          : 'bg-white/5 border border-transparent hover:border-white/10'
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
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        processingType === option.value ? 'border-cyan-400' : 'border-gray-500'
                      }`}>
                        {processingType === option.value && (
                          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-white font-medium">{option.label}</p>
                        <p className="text-gray-400 text-sm">{option.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Include Lyrics */}
              <div className="glass-panel p-6">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Type className="w-5 h-5 text-purple-400" />
                      Add Scrolling Lyrics
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">AI transcribes and syncs lyrics automatically</p>
                  </div>
                  <div
                    className={`w-14 h-8 rounded-full p-1 transition-colors ${
                      includeLyrics ? 'bg-cyan-500' : 'bg-white/10'
                    }`}
                    onClick={() => setIncludeLyrics(!includeLyrics)}
                  >
                    <div
                      className={`w-6 h-6 rounded-full bg-white transition-transform ${
                        includeLyrics ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </label>
              </div>

              {/* Video Quality */}
              <div className="glass-panel p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <FileVideo className="w-5 h-5 text-cyan-400" />
                  Video Quality
                </h2>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: '720p', label: '720p', credits: '+1' },
                    { value: '1080p', label: '1080p', credits: '+2' },
                    { value: '4k', label: '4K', credits: '+3' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setVideoQuality(option.value)}
                      className={`py-3 px-4 rounded-xl text-center transition-colors ${
                        videoQuality === option.value
                          ? 'bg-cyan-500/20 border border-cyan-500/50 text-white'
                          : 'bg-white/5 border border-transparent text-gray-400 hover:border-white/10'
                      }`}
                    >
                      <p className="font-medium">{option.label}</p>
                      <p className="text-xs mt-1 text-gray-500">{option.credits} credits</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Credit Summary */}
              <div className="glass-panel p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-gray-400">Credits Required</span>
                  <span className="text-2xl font-bold text-gradient">{creditsNeeded}</span>
                </div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-gray-400">Your Balance</span>
                  <span className={`text-lg font-semibold ${hasEnoughCredits ? 'text-green-400' : 'text-red-400'}`}>
                    {profile?.credits_remaining || 0} credits
                  </span>
                </div>
                
                {!hasEnoughCredits && (
                  <Link href="/pricing" className="block">
                    <button className="w-full glass-button py-3 text-yellow-400 border-yellow-400/50 mb-4">
                      Buy More Credits
                    </button>
                  </Link>
                )}
                
                <button
                  onClick={handleUpload}
                  disabled={!file || uploading || !hasEnoughCredits}
                  className="w-full glass-button-primary glass-button py-4 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      Start Processing
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}