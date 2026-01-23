'use client';

/**
 * Upload Page - Karatrack Studio (Redesigned with Tabs)
 * 
 * Place this at: frontend/src/pages/upload.jsx
 * 
 * Features:
 * - Tabbed interface for cleaner UX
 * - Video background support (42 presets + custom upload)
 * - Live preview with customization
 * - Background color/gradient/image/video options
 * - Text color, outline color, sung color
 * - Font selection
 * - Rights confirmation
 * - Save as Default settings (Starter+)
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
  Eye,
  Save,
  RotateCcw,
  Image,
  Lock,
  Video,
  Play,
  Pause,
  Settings,
  Sparkles,
  Grid3X3,
  Filter,
  Users,
  ExternalLink,
  FileType
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import AppNavigation from '../../components/AppNavigation';
import { createClient } from '@supabase/supabase-js';
import SEO from '../../components/SEO';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Available fonts
const FONT_OPTIONS = [
  { value: 'custom', label: 'âœ¨ Custom Font', family: 'CustomFont, sans-serif', isCustom: true },
  { value: 'arial', label: 'Arial', family: 'Arial, sans-serif' },
  { value: 'roboto', label: 'Roboto', family: '"Roboto", sans-serif' },
  { value: 'poppins', label: 'Poppins', family: '"Poppins", sans-serif' },
  { value: 'montserrat', label: 'Montserrat', family: '"Montserrat", sans-serif' },
  { value: 'oswald', label: 'Oswald', family: '"Oswald", sans-serif' },
  { value: 'playfair', label: 'Playfair Display', family: '"Playfair Display", serif' },
  { value: 'bebas', label: 'Bebas Neue', family: '"Bebas Neue", sans-serif' },
  { value: 'impact', label: 'Impact', family: 'Impact, sans-serif' },
];

// Font size options
const FONT_SIZE_OPTIONS = [
  { value: 'normal', label: 'Normal', scale: 1.0 },
  { value: 'large', label: 'Large', scale: 1.15 },
  { value: 'xlarge', label: 'X-Large', scale: 1.3 },
];

// Background type options
const BACKGROUND_TYPES = [
  { value: 'color', label: 'Solid Color', icon: Palette },
  { value: 'gradient', label: 'Gradient', icon: Sparkles },
  { value: 'image', label: 'Image', icon: Image },
  { value: 'video', label: 'Video', icon: Video, tier: 'studio' },
];

// Video background categories
const VIDEO_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'abstract', label: 'Abstract' },
  { id: 'elegant', label: 'Elegant' },
  { id: 'nature', label: 'Nature' },
  { id: 'space', label: 'Space' },
  { id: '80s', label: '80s/Retro' },
  { id: 'western', label: 'Western' },
];

// Preset video backgrounds (stored in R2/CDN)
// Base URL for video presets
const PRESET_BASE_URL = process.env.NEXT_PUBLIC_PRESET_VIDEOS_URL || 'https://pub-71dae0f9e45e4d8e8d1eedd472780341.r2.dev/presets';

const PRESET_VIDEO_BACKGROUNDS = [
  // Abstract (16 videos)
  { id: 'abstract-smokecurling', name: 'Smoke Curling', filename: 'bg-abstract-smokecurling.mp4', category: 'abstract' },
  { id: 'abstract-gradientpinklavenderblue', name: 'Pink Lavender Blue', filename: 'bg-abstract-gradientpinklavenderblue.mp4', category: 'abstract' },
  { id: 'abstract-flowinggradient', name: 'Flowing Gradient', filename: 'bg-abstract-flowinggradient.mp4', category: 'abstract' },
  { id: 'abstract-iridescencesoapbubble', name: 'Soap Bubble', filename: 'bg-abstract-iridescencesoapbubble.mp4', category: 'abstract' },
  { id: 'abstract-fiberoptics', name: 'Fiber Optics', filename: 'bg-abstract-fiberoptics.mp4', category: 'abstract' },
  { id: 'abstract-geometricshapes', name: 'Geometric Shapes', filename: 'bg-abstract-geometricshapes.mp4', category: 'abstract' },
  { id: 'abstract-inkinwater', name: 'Ink in Water', filename: 'bg-abstract-inkinwater.mp4', category: 'abstract' },
  { id: 'abstract-liquidchrome', name: 'Liquid Chrome', filename: 'bg-abstract-liquidchrome.mp4', category: 'abstract' },
  { id: 'abstract-liquidglass', name: 'Liquid Glass', filename: 'bg-abstract-liquidglass.mp4', category: 'abstract' },
  { id: 'abstract-matrix', name: 'Matrix', filename: 'bg-abstract-matrix.mp4', category: 'abstract' },
  { id: 'abstract-neonlightwaves', name: 'Neon Light Waves', filename: 'bg-abstract-neonlightwaves.mp4', category: 'abstract' },
  { id: 'abstract-neonrings', name: 'Neon Rings', filename: 'bg-abstract-neonrings.mp4', category: 'abstract' },
  { id: 'abstract-neontriangletunnel', name: 'Neon Triangle Tunnel', filename: 'bg-abstract-neontriangletunnel.mp4', category: 'abstract' },
  { id: 'abstract-prismlight', name: 'Prism Light', filename: 'bg-abstract-prismlight.mp4', category: 'abstract' },
  { id: 'abstract-smoketwist', name: 'Smoke Twist', filename: 'bg-abstract-smoketwist.mp4', category: 'abstract' },

  // Elegant (4 videos)
  { id: 'elegant-bokehlights', name: 'Bokeh Lights', filename: 'bg-elegant-bokehlights.mp4', category: 'elegant' },
  { id: 'elegant-goldendust', name: 'Golden Dust', filename: 'bg-elegant-goldendust.mp4', category: 'elegant' },
  { id: 'elegant-orbs', name: 'Floating Orbs', filename: 'bg-elegant-orbs.mp4', category: 'elegant' },
  { id: 'elegant-redsilkflowing', name: 'Red Silk Flowing', filename: 'bg-elegant-redsilkflowing.mp4', category: 'elegant' },

  // Nature (10 videos)
  { id: 'nature-nightsnow', name: 'Night Snow', filename: 'bg-nature-nightsnow.mp4', category: 'nature' },
  { id: 'nature-watercolorclouds', name: 'Watercolor Clouds', filename: 'bg-nature-watercolorclouds.mp4', category: 'nature' },
  { id: 'nature-pool', name: 'Pool Water', filename: 'bg-nature-pool.mp4', category: 'nature' },
  { id: 'nature-oceandepths', name: 'Ocean Depths', filename: 'bg-nature-oceandepths.mp4', category: 'nature' },
  { id: 'nature-aurora1', name: 'Northern Lights', filename: 'bg-nature-aurora1.mp4', category: 'nature' },
  { id: 'nature-cherryblossum', name: 'Cherry Blossom', filename: 'bg-nature-cherryblossum.mp4', category: 'nature' },
  { id: 'nature-fireflies', name: 'Fireflies', filename: 'bg-nature-fireflies.mp4', category: 'nature' },
  { id: 'nature-jellyfish', name: 'Jellyfish', filename: 'bg-nature-jellyfish.mp4', category: 'nature' },
  { id: 'nature-lightning', name: 'Lightning', filename: 'bg-nature-lightning.mp4', category: 'nature' },
  { id: 'nature-rainonwater', name: 'Rain on Water', filename: 'bg-nature-rainonwater.mp4', category: 'nature' },

  // Space (8 videos)
  { id: 'space-milkyway', name: 'Milky Way', filename: 'bg-space-milkyway.mp4', category: 'space' },
  { id: 'space-nebula1', name: 'Nebula 1', filename: 'bg-space-nebula1.mp4', category: 'space' },
  { id: 'space-nebula2', name: 'Nebula 2', filename: 'bg-space-nebula2.mp4', category: 'space' },
  { id: 'space-nebulaclouds1', name: 'Nebula Clouds', filename: 'bg-space-nebulaclouds1.mp4', category: 'space' },
  { id: 'space-saturn', name: 'Saturn', filename: 'bg-space-saturn.mp4', category: 'space' },
  { id: 'space-asteroidfield', name: 'Asteroid Field', filename: 'bg-space-asteroidfield.mp4', category: 'space' },
  { id: 'space-blackhole', name: 'Black Hole', filename: 'bg-space-blackhole.mp4', category: 'space' },

  // 80s/Retro (4 videos)
  { id: '80s-dancingkids', name: 'Dancing Kids', filename: 'bg-80s-dancingkids.mp4', category: '80s' },
  { id: '80s-neongrid', name: 'Neon Grid', filename: 'bg-80s-neongrid.mp4', category: '80s' },
  { id: '80s-neonpalms', name: 'Neon Palms', filename: 'bg-80s-nonpalms.mp4', category: '80s' },
  { id: '80s-watersunset', name: 'Water Sunset', filename: 'bg-80s-watersunset.mp4', category: '80s' },

  // Western (2 videos)
  { id: 'western-horse', name: 'Horse', filename: 'bg-western-horse.mp4', category: 'western' },
  { id: 'western-stampede', name: 'Stampede', filename: 'bg-western-stampede.mp4', category: 'western' },
];

// Style customization tabs
const STYLE_TABS = [
  { id: 'background', label: 'Background', icon: Image },
  { id: 'text', label: 'Text & Colors', icon: Type },
  { id: 'branding', label: 'Branding', icon: Sparkles, tier: 'studio' },
];

// Default settings
const DEFAULT_SETTINGS = {
  bgType: 'gradient',
  bgColor1: '#1a1a2e',
  bgColor2: '#16213e',
  useGradient: true,
  gradientDirection: 'to bottom',
  bgImage: null,
  bgVideo: null,
  bgVideoPreset: null,
  textColor: '#ffffff',
  outlineColor: '#000000',
  sungColor: '#00d4ff',
  selectedFont: 'arial',
  fontSize: 'normal',
  videoQuality: '480p',
  displayMode: 'auto',
  processingType: 'remove_vocals',
  cleanVersion: false,
  notifyOnComplete: true,
  reviewLyrics: false,
  isDuetMode: false,
  duetSinger1Color: '#00FFFF',
  duetSinger2Color: '#FF69B4',
  duetBothColor: '#FFD700'
};

// Sample lyrics for preview
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
  const [videoQuality, setVideoQuality] = useState('480p');
  const [lyrics, setLyrics] = useState('');
  const [displayMode, setDisplayMode] = useState('auto');
  const [cleanVersion, setCleanVersion] = useState(false);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [notifyOnComplete, setNotifyOnComplete] = useState(true);
  const [reviewLyrics, setReviewLyrics] = useState(false);

  // Background customization
  const [bgType, setBgType] = useState('gradient');
  const [bgColor1, setBgColor1] = useState('#1a1a2e');
  const [bgColor2, setBgColor2] = useState('#16213e');
  const [useGradient, setUseGradient] = useState(true);
  const [gradientDirection, setGradientDirection] = useState('to bottom');
  const [bgImage, setBgImage] = useState(null);
  const [bgImagePreview, setBgImagePreview] = useState(null);
  const [bgVideo, setBgVideo] = useState(null);
  const [bgVideoPreview, setBgVideoPreview] = useState(null);
  const [bgVideoPreset, setBgVideoPreset] = useState(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [selectedVideoCategory, setSelectedVideoCategory] = useState('all');

  // Text customization
  const [textColor, setTextColor] = useState('#ffffff');
  const [outlineColor, setOutlineColor] = useState('#000000');
  const [sungColor, setSungColor] = useState('#00d4ff');
  const [selectedFont, setSelectedFont] = useState('arial');
  const [fontSize, setFontSize] = useState('normal');

  // Duet mode settings
  const [isDuetMode, setIsDuetMode] = useState(false);
  const [duetSinger1Color, setDuetSinger1Color] = useState('#00FFFF');
  const [duetSinger2Color, setDuetSinger2Color] = useState('#FF69B4');
  const [duetBothColor, setDuetBothColor] = useState('#FFD700');

  // Custom watermark (Studio only)
  const [customWatermark, setCustomWatermark] = useState(null);
  const [outroText, setOutroText] = useState('');
  const [watermarkPreview, setWatermarkPreview] = useState(null);
  const [hasSavedWatermark, setHasSavedWatermark] = useState(false);

  // UI state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(null);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [preferencesMessage, setPreferencesMessage] = useState(null);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  // Custom font upload
  const [customFont, setCustomFont] = useState(null);
  const [customFontName, setCustomFontName] = useState('');
  const [customFontPreview, setCustomFontPreview] = useState(null);
  const [fontUploading, setFontUploading] = useState(false);

  // Tab state
  const [activeStyleTab, setActiveStyleTab] = useState('background');

  // Video preview ref
  const videoPreviewRef = useRef(null);

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

  // Load saved preferences when profile is available
  useEffect(() => {
    if (profile && !preferencesLoaded) {
      loadSavedPreferences();
      setPreferencesLoaded(true);
    }
  }, [profile, preferencesLoaded]);

  // Load saved preferences from profile
  const loadSavedPreferences = () => {
    if (!profile) return;
    const prefs = profile.upload_preferences || {};
    const tier = profile?.subscription_tier?.toLowerCase() || 'free';

    // Background settings
    if (prefs.bgType) setBgType(prefs.bgType);
    if (prefs.bgColor1) setBgColor1(prefs.bgColor1);
    if (prefs.bgColor2) setBgColor2(prefs.bgColor2);
    if (prefs.useGradient !== undefined) setUseGradient(prefs.useGradient);
    if (prefs.gradientDirection) setGradientDirection(prefs.gradientDirection);
    if (prefs.bgVideoPreset) {
      const preset = PRESET_VIDEO_BACKGROUNDS.find(p => p.id === prefs.bgVideoPreset);
      if (preset) setBgVideoPreset(preset);
    }

    // Text settings
    if (prefs.textColor) setTextColor(prefs.textColor);
    if (prefs.outlineColor) setOutlineColor(prefs.outlineColor);
    if (prefs.sungColor) setSungColor(prefs.sungColor);
    if (prefs.selectedFont) setSelectedFont(prefs.selectedFont);
    if (prefs.fontSize) setFontSize(prefs.fontSize);

    // Processing settings
    if (prefs.displayMode) setDisplayMode(prefs.displayMode);
    if (prefs.processingType) setProcessingType(prefs.processingType);
    if (prefs.cleanVersion !== undefined) setCleanVersion(prefs.cleanVersion);
    if (prefs.notifyOnComplete !== undefined) setNotifyOnComplete(prefs.notifyOnComplete);
    if (prefs.reviewLyrics !== undefined) setReviewLyrics(prefs.reviewLyrics);

    // Duet mode settings
    if (prefs.isDuetMode !== undefined) setIsDuetMode(prefs.isDuetMode);
    if (prefs.duetSinger1Color) setDuetSinger1Color(prefs.duetSinger1Color);
    if (prefs.duetSinger2Color) setDuetSinger2Color(prefs.duetSinger2Color);
    if (prefs.duetBothColor) setDuetBothColor(prefs.duetBothColor);

    // Video quality
    if (prefs.videoQuality) {
      const savedQuality = prefs.videoQuality;
      if (tier === 'free') {
        setVideoQuality('480p');
      } else if (tier === 'studio') {
        setVideoQuality(savedQuality);
      } else if (['starter', 'pro'].includes(tier)) {
        setVideoQuality(savedQuality === '4k' ? '1080p' : savedQuality);
      }
    } else {
      setVideoQuality(tier === 'free' ? '480p' : tier === 'studio' ? '1080p' : '720p');
    }

    // Watermark
    if (profile.default_watermark_url && tier === 'studio') {
      setHasSavedWatermark(true);
    }
  };

  // Helper functions
  const isFreeUser = () => !profile?.subscription_tier || profile?.subscription_tier === 'free';
  const isStudioUser = () => profile?.subscription_tier?.toLowerCase() === 'studio';
  const isPremiumUser = () => ['pro', 'studio'].includes(profile?.subscription_tier?.toLowerCase());

  const getCurrentFontFamily = () => {
    const font = FONT_OPTIONS.find(f => f.value === selectedFont);
    return font ? font.family : 'Arial, sans-serif';
  };

  const getQualityOptions = () => {
    const tier = profile?.subscription_tier?.toLowerCase() || 'free';
    if (tier === 'free') return [{ value: '480p', label: '480p (SD)' }];
    if (tier === 'starter') return [
      { value: '480p', label: '480p (SD)' },
      { value: '720p', label: '720p (HD)' },
      { value: '1080p', label: '1080p (Full HD)' }
    ];
    if (tier === 'pro') return [
      { value: '480p', label: '480p (SD)' },
      { value: '720p', label: '720p (HD)' },
      { value: '1080p', label: '1080p (Full HD)' }
    ];
    return [
      { value: '480p', label: '480p (SD)' },
      { value: '720p', label: '720p (HD)' },
      { value: '1080p', label: '1080p (Full HD)' },
      { value: '4k', label: '4K (Ultra HD)' }
    ];
  };

  // Get filtered video presets
  const getFilteredVideoPresets = () => {
    if (selectedVideoCategory === 'all') {
      return PRESET_VIDEO_BACKGROUNDS;
    }
    return PRESET_VIDEO_BACKGROUNDS.filter(preset => preset.category === selectedVideoCategory);
  };

  // Get video URL for a preset
  const getPresetVideoUrl = (preset) => {
    return `${PRESET_BASE_URL}/${preset.filename}`;
  };

  // Get thumbnail URL for a preset
  const getPresetThumbnailUrl = (preset) => {
    const thumbFilename = preset.filename.replace('.mp4', '-thumb.jpg');
    return `${PRESET_BASE_URL}/${thumbFilename}`;
  };

  // Get background style for preview
  const getBackgroundStyle = () => {
    if (bgType === 'video' && (bgVideoPreview || bgVideoPreset)) {
      return { backgroundColor: '#000' };
    }
    if (bgType === 'image' && bgImagePreview) {
      return {
        backgroundImage: `url(${bgImagePreview})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      };
    }
    if (bgType === 'gradient' || useGradient) {
      return {
        background: `linear-gradient(${gradientDirection}, ${bgColor1}, ${bgColor2})`
      };
    }
    return { backgroundColor: bgColor1 };
  };

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

  // Image dropzone
  const onImageDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      setBgImage(file);
      setBgImagePreview(URL.createObjectURL(file));
    }
  }, []);

  const { getRootProps: getImageRootProps, getInputProps: getImageInputProps, isDragActive: isImageDragActive } = useDropzone({
    onDrop: onImageDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024
  });

  // Video dropzone
  const onVideoDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      setBgVideo(file);
      setBgVideoPreview(URL.createObjectURL(file));
      setBgVideoPreset(null);
    }
  }, []);

  const { getRootProps: getVideoRootProps, getInputProps: getVideoInputProps, isDragActive: isVideoDragActive } = useDropzone({
    onDrop: onVideoDrop,
    accept: { 'video/*': ['.mp4', '.webm', '.mov'] },
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024
  });

  // Handle preset video selection
  const handlePresetVideoSelect = (preset) => {
    setBgVideoPreset(preset);
    setBgVideo(null);
    setBgVideoPreview(null);
  };

  // Toggle video playback in preview
  const toggleVideoPlayback = () => {
    if (videoPreviewRef.current) {
      if (isVideoPlaying) {
        videoPreviewRef.current.pause();
      } else {
        videoPreviewRef.current.play();
      }
      setIsVideoPlaying(!isVideoPlaying);
    }
  };

  // Save preferences
  const savePreferences = async () => {
    if (!profile) return;
    setSavingPreferences(true);
    setPreferencesMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const preferences = {
        bgType,
        bgColor1,
        bgColor2,
        useGradient,
        gradientDirection,
        bgVideoPreset: bgVideoPreset?.id || null,
        textColor,
        outlineColor,
        sungColor,
        selectedFont,
        fontSize,
        videoQuality,
        displayMode,
        processingType,
        cleanVersion,
        notifyOnComplete,
        reviewLyrics,
        isDuetMode,
        duetSinger1Color,
        duetSinger2Color,
        duetBothColor
      };

      // Handle watermark upload for Studio users
      if (isStudioUser() && customWatermark) {
        setPreferencesMessage({ type: 'info', text: 'Uploading watermark...' });
        const formData = new FormData();
        formData.append('watermark', customWatermark);

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/profile/watermark`,
          {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.access_token}` },
            body: formData
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to upload watermark');
        }

        const result = await response.json();
        setHasSavedWatermark(true);
        setProfile(prev => ({ ...prev, default_watermark_url: result.watermark_url }));
      }

      // Handle watermark deletion
      if (isStudioUser() && !customWatermark && !hasSavedWatermark) {
        await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/profile/watermark`,
          {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${session.access_token}` }
          }
        );
      }

      const { error } = await supabase
        .from('profiles')
        .update({ upload_preferences: preferences })
        .eq('id', session.user.id);

      if (error) throw error;

      setPreferencesMessage({ type: 'success', text: 'Settings saved as default!' });
      setTimeout(() => setPreferencesMessage(null), 3000);
    } catch (err) {
      console.error('Save preferences error:', err);
      setPreferencesMessage({ type: 'error', text: err.message });
    } finally {
      setSavingPreferences(false);
    }
  };

  // Reset to defaults
  const resetToDefaults = () => {
    setBgType(DEFAULT_SETTINGS.bgType);
    setBgColor1(DEFAULT_SETTINGS.bgColor1);
    setBgColor2(DEFAULT_SETTINGS.bgColor2);
    setUseGradient(DEFAULT_SETTINGS.useGradient);
    setGradientDirection(DEFAULT_SETTINGS.gradientDirection);
    setBgImage(null);
    setBgImagePreview(null);
    setBgVideo(null);
    setBgVideoPreview(null);
    setBgVideoPreset(null);
    setTextColor(DEFAULT_SETTINGS.textColor);
    setOutlineColor(DEFAULT_SETTINGS.outlineColor);
    setSungColor(DEFAULT_SETTINGS.sungColor);
    setSelectedFont(DEFAULT_SETTINGS.selectedFont);
    setFontSize(DEFAULT_SETTINGS.fontSize);
    setDisplayMode(DEFAULT_SETTINGS.displayMode);
    setProcessingType(DEFAULT_SETTINGS.processingType);
    setCleanVersion(DEFAULT_SETTINGS.cleanVersion);
    setVideoQuality(isFreeUser() ? '480p' : '720p');
    setIsDuetMode(false);
    setDuetSinger1Color('#00FFFF');
    setDuetSinger2Color('#FF69B4');
    setDuetBothColor('#FFD700');
  };

  // Custom font upload handler
  const handleFontUpload = useCallback(async (file) => {
    if (!file) return;

    const extension = file.name.toLowerCase().slice(-4);
    if (extension !== '.ttf' && extension !== '.otf') {
      setError('Please upload a .ttf or .otf font file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Font file must be less than 5MB');
      return;
    }

    setFontUploading(true);
    setError(null);

    try {
      const fontUrl = URL.createObjectURL(file);
      const fontFace = new FontFace('CustomFont', `url(${fontUrl})`);
      await fontFace.load();
      document.fonts.add(fontFace);

      setCustomFont(file);
      setCustomFontName(file.name.replace(/\.(ttf|otf)$/i, ''));
      setCustomFontPreview(fontUrl);
      setSelectedFont('custom');
    } catch (err) {
      console.error('Font load error:', err);
      setError('Failed to load font. Please ensure it is a valid TTF or OTF file.');
    } finally {
      setFontUploading(false);
    }
  }, []);

  const onFontDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      handleFontUpload(acceptedFiles[0]);
    }
  }, [handleFontUpload]);

  const { getRootProps: getFontRootProps, getInputProps: getFontInputProps, isDragActive: isFontDragActive } = useDropzone({
    onDrop: onFontDrop,
    accept: {
      'font/ttf': ['.ttf'],
      'font/otf': ['.otf'],
    },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
  });

  const clearCustomFont = () => {
    if (customFontPreview) URL.revokeObjectURL(customFontPreview);
    setCustomFont(null);
    setCustomFontName('');
    setCustomFontPreview(null);
    setSelectedFont('arial');
  };


  // Form submit handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!audioFile || !title || !lyrics || lyrics.length < 50) {
      setError('Please fill in all required fields');
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
      formData.append('processing_type', processingType);
      formData.append('video_quality', videoQuality);
      formData.append('display_mode', displayMode);
      formData.append('clean_version', cleanVersion.toString());
      formData.append('notify_on_complete', notifyOnComplete.toString());
      formData.append('processing_mode', reviewLyrics ? 'transcribe_only' : 'full');
      formData.append('include_lyrics', 'true');

      // Background settings
      formData.append('bg_type', bgType);
      formData.append('bg_color_1', bgColor1);
      formData.append('bg_color_2', bgColor2);
      formData.append('use_gradient', useGradient.toString());
      formData.append('gradient_direction', gradientDirection);

      if (bgType === 'image' && bgImage) {
        formData.append('bg_image', bgImage);
      }
      if (bgType === 'video') {
        if (bgVideo) {
          formData.append('bg_video', bgVideo);
        } else if (bgVideoPreset) {
          formData.append('bg_video_preset', bgVideoPreset.id);
          formData.append('bg_video_preset_filename', bgVideoPreset.filename);
        }
      }

      // Text settings
      formData.append('text_color', textColor);
      formData.append('outline_color', outlineColor);
      formData.append('sung_color', sungColor);
      formData.append('font', selectedFont);
      formData.append('font_size', fontSize);
      
      // Custom font
      if (selectedFont === 'custom' && customFont) {
        formData.append('custom_font', customFont);
        formData.append('custom_font_name', customFontName);
      }

      // Duet mode settings
      formData.append('is_duet_mode', isDuetMode.toString());
      if (isDuetMode) {
        formData.append('duet_singer1_color', duetSinger1Color);
        formData.append('duet_singer2_color', duetSinger2Color);
        formData.append('duet_both_color', duetBothColor);
      }

      // Studio features
      if (isStudioUser()) {
        if (customWatermark) formData.append('custom_watermark', customWatermark);
        if (outroText) formData.append('outro_text', outroText);
        if (hasSavedWatermark && !customWatermark && profile?.default_watermark_url) {
          formData.append('custom_watermark_url', profile.default_watermark_url);
        }
      }

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

      if (reviewLyrics && result.job_id) {
        router.push(`/review-lyrics/${result.job_id}`);
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Render background tab content
  const renderBackgroundTab = () => (
    <div className="space-y-4">
      {/* Background Type Selector */}
      <div>
        <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          Background Type
        </label>
        <div className="grid grid-cols-4 gap-2">
          {BACKGROUND_TYPES.map((type) => {
            const Icon = type.icon;
            const isLocked = type.tier === 'studio' && !isStudioUser();
            const isSelected = bgType === type.value;

            return (
              <button
                key={type.value}
                type="button"
                disabled={isLocked}
                onClick={() => !isLocked && setBgType(type.value)}
                className={`relative flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${isSelected
                    ? 'border-cyan-400 bg-cyan-400/10'
                    : isLocked
                      ? isDark ? 'border-white/10 bg-white/5 opacity-50 cursor-not-allowed' : 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                      : isDark ? 'border-white/10 bg-white/5 hover:border-white/30' : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                  }`}
              >
                {isLocked && (
                  <Lock className="absolute top-1 right-1 w-3 h-3 text-gray-500" />
                )}
                <Icon className={`w-5 h-5 ${isSelected ? 'text-cyan-400' : 'text-gray-400'}`} />
                <span className={`text-xs ${isSelected ? 'text-cyan-400' : 'text-gray-400'}`}>
                  {type.label}
                </span>
              </button>
            );
          })}
        </div>
        {!isStudioUser() && (
          <p className="text-xs text-gray-500 mt-2">
            <Link href="/pricing" className="text-cyan-400 hover:underline">Upgrade to Studio</Link> for video backgrounds
          </p>
        )}
      </div>

      {/* Color/Gradient Options */}
      {(bgType === 'color' || bgType === 'gradient') && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {bgType === 'gradient' ? 'Start Color' : 'Background Color'}
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

            {bgType === 'gradient' && (
              <div>
                <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  End Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={bgColor2}
                    onChange={(e) => setBgColor2(e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border-0"
                  />
                  <input
                    type="text"
                    value={bgColor2}
                    onChange={(e) => setBgColor2(e.target.value)}
                    className="glass-input flex-1 px-2 py-2 rounded-lg text-xs uppercase"
                  />
                </div>
              </div>
            )}
          </div>

          {bgType === 'gradient' && (
            <div>
              <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Direction
              </label>
              <select
                value={gradientDirection}
                onChange={(e) => setGradientDirection(e.target.value)}
                className="glass-input w-full px-3 py-2 rounded-lg text-sm"
              >
                <option value="to bottom">Top to Bottom</option>
                <option value="to top">Bottom to Top</option>
                <option value="to right">Left to Right</option>
                <option value="to left">Right to Left</option>
                <option value="to bottom right">Diagonal â†˜</option>
                <option value="to bottom left">Diagonal â†™</option>
              </select>
            </div>
          )}
        </div>
      )}

      {/* Image Upload */}
      {bgType === 'image' && (
        <div>
          <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Background Image
          </label>
          {bgImagePreview ? (
            <div className="relative rounded-xl overflow-hidden">
              <img src={bgImagePreview} alt="Background preview" className="w-full h-32 object-cover" />
              <button
                type="button"
                onClick={() => { setBgImage(null); setBgImagePreview(null); }}
                className="absolute top-2 right-2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div
              {...getImageRootProps()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${isImageDragActive
                  ? 'border-cyan-400 bg-cyan-400/10'
                  : isDark ? 'border-white/20 hover:border-cyan-400/50' : 'border-gray-300 hover:border-cyan-400/50'
                }`}
            >
              <input {...getImageInputProps()} />
              <Image className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Drop image or click to browse
              </p>
              <p className="text-xs text-gray-500 mt-1">JPG, PNG, WebP (max 10MB)</p>
            </div>
          )}
        </div>
      )}

      {/* Video Background (Studio Only) */}
      {bgType === 'video' && isStudioUser() && (
        <div className="space-y-4">
          {/* Category Filter */}
          <div>
            <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              <Filter className="w-3 h-3 inline mr-1" />
              Category
            </label>
            <div className="flex flex-wrap gap-1">
              {VIDEO_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedVideoCategory(cat.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${selectedVideoCategory === cat.id
                      ? 'bg-cyan-500 text-white'
                      : isDark ? 'bg-white/10 text-gray-400 hover:bg-white/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                  {cat.label}
                  {cat.id !== 'all' && (
                    <span className="ml-1 opacity-60">
                      ({PRESET_VIDEO_BACKGROUNDS.filter(p => p.category === cat.id).length})
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Preset Video Gallery */}
          <div>
            <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Preset Backgrounds ({getFilteredVideoPresets().length})
            </label>
            <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1">
              {getFilteredVideoPresets().map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetVideoSelect(preset)}
                  className={`relative rounded-lg overflow-hidden aspect-video border-2 transition-all group ${bgVideoPreset?.id === preset.id
                      ? 'border-cyan-400 ring-2 ring-cyan-400/50'
                      : 'border-transparent hover:border-white/30'
                    }`}
                  title={preset.name}
                >
                  {/* Thumbnail Image */}
                  <img
                    src={getPresetThumbnailUrl(preset)}
                    alt={preset.name}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                  />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <Video className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  {/* Selection indicator */}
                  {bgVideoPreset?.id === preset.id && (
                    <div className="absolute top-1 right-1 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-3 h-3 text-white" />
                    </div>
                  )}
                  {/* Name overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 py-1">
                    <p className="text-[10px] text-white truncate font-medium">{preset.name}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Video Upload */}
          <div>
            <label className={`block text-xs font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Or Upload Custom Video
            </label>
            {bgVideoPreview ? (
              <div className="relative rounded-xl overflow-hidden">
                <video
                  src={bgVideoPreview}
                  className="w-full h-32 object-cover"
                  muted
                  loop
                  autoPlay
                />
                <button
                  type="button"
                  onClick={() => { setBgVideo(null); setBgVideoPreview(null); }}
                  className="absolute top-2 right-2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                {...getVideoRootProps()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${isVideoDragActive
                    ? 'border-cyan-400 bg-cyan-400/10'
                    : isDark ? 'border-white/20 hover:border-cyan-400/50' : 'border-gray-300 hover:border-cyan-400/50'
                  }`}
              >
                <input {...getVideoInputProps()} />
                <Video className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Drop video or click to browse
                </p>
                <p className="text-[10px] text-gray-500 mt-1">MP4, WebM, MOV (max 100MB)</p>
              </div>
            )}
          </div>

          <p className="text-xs text-gray-500">
            ðŸ’¡ Videos will automatically loop or trim to match your track length.
          </p>
        </div>
      )}
    </div>
  );

  // Render text tab content
  const renderTextTab = () => (
    <div className="space-y-4">
      {/* Duet Mode Toggle */}
      <div className={`p-3 rounded-xl border ${isDuetMode
        ? 'bg-gradient-to-r from-cyan-500/10 to-pink-500/10 border-cyan-400/30'
        : isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'
        }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className={`w-5 h-5 ${isDuetMode ? 'text-cyan-400' : 'text-gray-500'}`} />
            <div>
              <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Duet Mode
              </p>
              <p className="text-xs text-gray-500">
                Assign different colors to different singers
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsDuetMode(!isDuetMode)}
            className={`relative w-12 h-6 rounded-full transition-colors ${isDuetMode ? 'bg-gradient-to-r from-cyan-500 to-pink-500' : isDark ? 'bg-gray-600' : 'bg-gray-300'
              }`}
          >
            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow ${isDuetMode ? 'translate-x-6' : ''
              }`} />
          </button>
        </div>

        {/* Duet Mode Color Pickers (only shown when enabled) */}
        {isDuetMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`mt-3 pt-3 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`}
          >
            <p className="text-xs text-gray-500 mb-3">
              Configure singer colors here. Assign words to singers on the Edit Lyrics page.
            </p>
            <div className="grid grid-cols-3 gap-3">
              {/* Singer 1 */}
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Singer 1</label>
                <div className="flex items-center gap-1">
                  <input
                    type="color"
                    value={duetSinger1Color}
                    onChange={(e) => setDuetSinger1Color(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border-0"
                  />
                  <input
                    type="text"
                    value={duetSinger1Color}
                    onChange={(e) => setDuetSinger1Color(e.target.value)}
                    className="glass-input flex-1 px-2 py-1 rounded text-[10px] uppercase"
                  />
                </div>
              </div>
              {/* Singer 2 */}
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Singer 2</label>
                <div className="flex items-center gap-1">
                  <input
                    type="color"
                    value={duetSinger2Color}
                    onChange={(e) => setDuetSinger2Color(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border-0"
                  />
                  <input
                    type="text"
                    value={duetSinger2Color}
                    onChange={(e) => setDuetSinger2Color(e.target.value)}
                    className="glass-input flex-1 px-2 py-1 rounded text-[10px] uppercase"
                  />
                </div>
              </div>
              {/* Both */}
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Both</label>
                <div className="flex items-center gap-1">
                  <input
                    type="color"
                    value={duetBothColor}
                    onChange={(e) => setDuetBothColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border-0"
                  />
                  <input
                    type="text"
                    value={duetBothColor}
                    onChange={(e) => setDuetBothColor(e.target.value)}
                    className="glass-input flex-1 px-2 py-1 rounded text-[10px] uppercase"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Font Selection with Custom Upload */}
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-1">
            <label className={`block text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Font
            </label>
            <a
              href="https://www.dafont.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Free Fonts
            </a>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <select
              value={selectedFont}
              onChange={(e) => {
                setSelectedFont(e.target.value);
                if (e.target.value !== 'custom') clearCustomFont();
              }}
              className="glass-input w-full px-3 py-2 rounded-lg text-sm"
            >
              {FONT_OPTIONS.map(font => (
                <option key={font.value} value={font.value}>
                  {font.isCustom && customFontName ? `âœ¨ ${customFontName}` : font.label}
                </option>
              ))}
            </select>
            
            <select
              value={fontSize}
              onChange={(e) => setFontSize(e.target.value)}
              className="glass-input w-full px-3 py-2 rounded-lg text-sm"
            >
              {FONT_SIZE_OPTIONS.map(size => (
                <option key={size.value} value={size.value}>{size.label}</option>
              ))}
            </select>
          </div>
          
          {/* Custom Font Upload Area */}
          <AnimatePresence>
            {selectedFont === 'custom' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2"
              >
                {customFont ? (
                  <div className={`flex items-center justify-between p-3 rounded-lg ${isDark ? 'bg-green-500/10 border border-green-500/30' : 'bg-green-50 border border-green-200'}`}>
                    <div className="flex items-center gap-2">
                      <FileType className="w-4 h-4 text-green-400" />
                      <span className="text-sm text-green-400 font-medium" style={{ fontFamily: 'CustomFont, sans-serif' }}>
                        {customFontName}
                      </span>
                      <span className="text-xs text-gray-500">
                        ({(customFont.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <button type="button" onClick={clearCustomFont} className={`p-1 rounded ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-200'}`}>
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                ) : (
                  <div
                    {...getFontRootProps()}
                    className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${
                      isFontDragActive ? 'border-cyan-400 bg-cyan-400/10' : isDark ? 'border-white/20 hover:border-cyan-400/50' : 'border-gray-300 hover:border-cyan-400/50'
                    }`}
                  >
                    <input {...getFontInputProps()} />
                    {fontUploading ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                        <span className="text-sm text-gray-400">Loading font...</span>
                      </div>
                    ) : (
                      <>
                        <FileType className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          Drop font file or click to browse
                        </p>
                        <p className="text-[10px] text-gray-500 mt-1">.TTF or .OTF (max 5MB)</p>
                      </>
                    )}
                  </div>
                )}
                
                {/* Font Preview */}
                {customFontPreview && (
                  <div className={`mt-2 p-3 rounded-lg ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                    <p className="text-[10px] text-gray-500 mb-1">Preview:</p>
                    <p className="text-lg" style={{ fontFamily: 'CustomFont, sans-serif', color: textColor || '#ffffff' }}>
                      The quick brown fox jumps over the lazy dog
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Text Color - Only show when NOT in duet mode */}
        {!isDuetMode && (
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Text Color
            </label>
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
        )}

        {/* Text Outline - Only show when NOT in duet mode */}
        {!isDuetMode && (
          <div>
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Text Outline
            </label>
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
        )}

        {/* Sung Color - Only show when NOT in duet mode */}
        {!isDuetMode && (
          <div className="col-span-2">
            <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Sung Color (Highlighted Text)
            </label>
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
              <span className="text-xs text-gray-500">First line shows this color</span>
            </div>
          </div>
        )}

        {/* Duet mode message about standard colors */}
        {isDuetMode && (
          <div className={`col-span-2 text-xs text-gray-500 p-2 rounded-lg ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
            ðŸ’¡ In Duet Mode, standard text/outline/sung colors are replaced by singer-specific colors.
            Configure them above or fine-tune on the Edit Lyrics page after processing.
          </div>
        )}
      </div>
    </div>
  );

  // Render branding tab content (Studio only)
  const renderBrandingTab = () => (
    <div className="space-y-4">
      {/* Outro Text */}
      <div>
        <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          Outro Text
        </label>
        <p className={`text-xs mb-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
          Add custom text that appears after the lyrics end
        </p>
        <textarea
          value={outroText}
          onChange={(e) => setOutroText(e.target.value)}
          placeholder="e.g. Created with love - www.mywebsite.com"
          maxLength={200}
          rows={2}
          className="glass-input w-full px-3 py-2 rounded-lg text-sm resize-none"
        />
        <p className="text-xs text-gray-500 mt-1">{outroText.length}/200 characters</p>
      </div>

      {/* Custom Watermark */}
      <div>
        <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          Custom Watermark
        </label>
        <p className={`text-xs mb-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
          Add your logo to the bottom-right corner (PNG recommended, max 2MB)
        </p>

        {watermarkPreview ? (
          <div className="relative inline-block">
            <img
              src={watermarkPreview}
              alt="Watermark preview"
              className="h-16 max-w-[200px] object-contain rounded-lg border border-white/20 bg-black/20 p-2"
            />
            <button
              type="button"
              onClick={() => { setCustomWatermark(null); setWatermarkPreview(null); setHasSavedWatermark(false); }}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : hasSavedWatermark ? (
          <div className="relative inline-block">
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-green-500/30 bg-green-500/10">
              <Image className="w-5 h-5 text-green-400" />
              <span className="text-sm text-green-400">Default logo saved</span>
            </div>
            <button
              type="button"
              onClick={() => setHasSavedWatermark(false)}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <label className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border-2 border-dashed ${isDark
              ? 'border-white/20 hover:border-cyan-400/50 hover:bg-white/5'
              : 'border-gray-300 hover:border-cyan-500 hover:bg-gray-50'
            }`}>
            <Upload className="w-5 h-5 text-cyan-400" />
            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Click to upload your logo
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  if (file.size > 2 * 1024 * 1024) {
                    setError('Watermark image must be under 2MB');
                    return;
                  }
                  setCustomWatermark(file);
                  setWatermarkPreview(URL.createObjectURL(file));
                }
              }}
              className="sr-only"
            />
          </label>
        )}
      </div>
    </div>
  );

  return (
    <>
      <SEO
        title="Create Karaoke Track | Karatrack Studio"
        description="Upload your music and create professional karaoke videos with synced lyrics."
      />

      <div className={`min-h-screen transition-colors ${isDark ? 'bg-animated-dark' : 'bg-animated-light'}`}>
        <AppNavigation />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link href="/dashboard" className={`inline-flex items-center gap-2 text-sm mb-6 ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}>
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
                {/* Audio & Track Info */}
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
                    className={`dropzone cursor-pointer transition-all mb-4 p-4 ${isAudioDragActive ? 'border-cyan-400 bg-cyan-400/10' : ''
                      } ${audioFile ? 'border-green-400 bg-green-400/5' : ''}`}
                  >
                    <input {...getAudioInputProps()} />
                    {audioFile ? (
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-400" />
                        <span className={`flex-1 truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{audioFile.name}</span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setAudioFile(null); }}
                          className={`p-1 rounded ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-200'}`}
                        >
                          <X className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <Upload className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
                        <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          Drop audio file or click to browse
                        </p>
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
                        {getQualityOptions().map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      {isFreeUser() && (
                        <p className="text-xs text-gray-500 mt-1">
                          <Link href="/pricing" className="text-cyan-400 hover:underline">Upgrade</Link> for HD quality
                        </p>
                      )}
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
                        <option value="guide_vocals">Guide Vocals</option>
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
                    {!isPremiumUser() ? (
                      <>Lyrics are synced using AI for precise timing. <Link href="/pricing" className="text-cyan-400 hover:underline font-medium">Upgrade to Pro or Studio</Link> to review and edit lyrics before rendering.</>
                    ) : (
                      <>Lyrics are synced using AI for precise timing. Use the "Review & edit lyrics" option below to fine-tune timing before rendering.</>
                    )}
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

              {/* RIGHT COLUMN - Preview & Customization */}
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
                    className="rounded-xl overflow-hidden aspect-video flex items-center justify-center p-6 relative"
                    style={getBackgroundStyle()}
                  >
                    {/* Video Background */}
                    {bgType === 'video' && (bgVideoPreview || bgVideoPreset) && (
                      <>
                        <video
                          ref={videoPreviewRef}
                          src={bgVideoPreview || getPresetVideoUrl(bgVideoPreset)}
                          className="absolute inset-0 w-full h-full object-cover"
                          muted
                          loop
                          autoPlay
                          playsInline
                        />
                        <button
                          type="button"
                          onClick={toggleVideoPlayback}
                          className="absolute bottom-2 right-2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors z-10"
                        >
                          {isVideoPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                      </>
                    )}

                    {/* Lyrics Preview */}
                    <div className="text-center relative z-10" style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: fontSize === 'xlarge' ? '0.75rem' : fontSize === 'large' ? '0.6rem' : '0.5rem'
                    }}>
                      {SAMPLE_LYRICS.split('\n').map((line, i) => {
                        const fontSizeMap = { 'normal': '1.1rem', 'large': '1.25rem', 'xlarge': '1.45rem' };
                        const previewFontSize = fontSizeMap[fontSize] || '1.1rem';

                        return (
                          <p
                            key={i}
                            style={{
                              fontFamily: getCurrentFontFamily(),
                              color: i === 0 ? sungColor : textColor,
                              textShadow: `-1px -1px 0 ${outlineColor}, 1px -1px 0 ${outlineColor}, -1px 1px 0 ${outlineColor}, 1px 1px 0 ${outlineColor}`,
                              fontSize: previewFontSize,
                              fontWeight: 'bold',
                              transition: 'all 0.2s ease',
                              margin: 0
                            }}
                          >
                            {line}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>

                {/* Style Customization - Tabbed Interface */}
                {!isFreeUser() ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="glass-panel p-6"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h2 className={`text-lg font-semibold flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        <Palette className="w-5 h-5 text-cyan-400" />
                        Style Customization
                      </h2>

                      {/* Save/Reset Buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={resetToDefaults}
                          className={`p-2 rounded-lg transition-colors ${isDark ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'}`}
                          title="Reset to defaults"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={savePreferences}
                          disabled={savingPreferences}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                          {savingPreferences ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Save className="w-3 h-3" />
                          )}
                          Save as Default
                        </button>
                      </div>
                    </div>

                    {/* Preferences Message */}
                    {preferencesMessage && (
                      <div className={`mb-4 p-2 rounded-lg text-xs flex items-center gap-2 ${preferencesMessage.type === 'success'
                          ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                          : preferencesMessage.type === 'info'
                            ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400'
                            : 'bg-red-500/10 border border-red-500/30 text-red-400'
                        }`}>
                        {preferencesMessage.type === 'success' ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : preferencesMessage.type === 'info' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <AlertCircle className="w-4 h-4" />
                        )}
                        {preferencesMessage.text}
                      </div>
                    )}

                    {/* Tab Navigation */}
                    <div className={`flex gap-1 mb-4 p-1 rounded-xl ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
                      {STYLE_TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isLocked = tab.tier === 'studio' && !isStudioUser();
                        const isActive = activeStyleTab === tab.id;

                        return (
                          <button
                            key={tab.id}
                            type="button"
                            disabled={isLocked}
                            onClick={() => !isLocked && setActiveStyleTab(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${isActive
                                ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white'
                                : isLocked
                                  ? 'text-gray-500 cursor-not-allowed'
                                  : isDark ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                              }`}
                          >
                            <Icon className="w-4 h-4" />
                            <span className="hidden sm:inline">{tab.label}</span>
                            {isLocked && <Lock className="w-3 h-3" />}
                          </button>
                        );
                      })}
                    </div>

                    {/* Tab Content */}
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeStyleTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                      >
                        {activeStyleTab === 'background' && renderBackgroundTab()}
                        {activeStyleTab === 'text' && renderTextTab()}
                        {activeStyleTab === 'branding' && isStudioUser() && renderBrandingTab()}
                      </motion.div>
                    </AnimatePresence>
                  </motion.div>
                ) : (
                  /* Free tier upgrade prompt */
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="glass-panel p-6"
                  >
                    <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      <Palette className="w-5 h-5 text-gray-500" />
                      Style Customization
                      <span className="ml-2 px-2 py-0.5 bg-gradient-to-r from-cyan-500 to-purple-500 text-white text-xs rounded-full">STARTER+</span>
                    </h2>
                    <div className={`p-4 rounded-xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'} mb-3`}>
                        Unlock custom colors, fonts, backgrounds, and branding options with a paid subscription.
                      </p>
                      <Link href="/pricing" className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity">
                        <Zap className="w-4 h-4" />
                        Upgrade to Unlock
                      </Link>
                    </div>
                  </motion.div>
                )}

                {/* Rights Confirmation & Submit */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="glass-panel p-6"
                >
                  {/* Email Notification Checkbox */}
                  <label className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all mb-3 ${notifyOnComplete
                      ? 'bg-purple-500/20 border border-purple-400'
                      : isDark ? 'bg-white/5 border border-transparent hover:bg-white/10' : 'bg-gray-50 border border-transparent hover:bg-gray-100'
                    }`}>
                    <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 border-2 transition-colors ${notifyOnComplete ? 'bg-purple-500 border-purple-500' : 'border-gray-500'
                      }`}>
                      {notifyOnComplete && <CheckCircle className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        Notify me when processing is complete
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

                  {/* Review Lyrics Checkbox */}
                  {isPremiumUser() ? (
                    <label className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all mb-3 ${reviewLyrics
                        ? 'bg-yellow-500/20 border border-yellow-400'
                        : isDark ? 'bg-white/5 border border-transparent hover:bg-white/10' : 'bg-gray-50 border border-transparent hover:bg-gray-100'
                      }`}>
                      <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 border-2 transition-colors ${reviewLyrics ? 'bg-yellow-500 border-yellow-500' : 'border-gray-500'
                        }`}>
                        {reviewLyrics && <CheckCircle className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          Review & edit lyrics before rendering
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
                  ) : (
                    <div className={`flex items-start gap-3 p-3 rounded-xl mb-3 opacity-75 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                      <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 border-2 ${isDark ? 'border-gray-600 bg-gray-700/50' : 'border-gray-400 bg-gray-200'}`}>
                        <Lock className="w-3 h-3 text-gray-500" />
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          Review & edit lyrics before rendering
                          <span className="ml-2 px-2 py-0.5 bg-gradient-to-r from-yellow-500/50 to-orange-500/50 text-white/70 text-xs rounded-full">PRO</span>
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Preview AI-generated lyrics and fix any mistakes before your video is created
                        </p>
                        <Link href="/pricing" className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs font-medium rounded-lg hover:opacity-90 transition-opacity">
                          <Zap className="w-3 h-3" />
                          Upgrade to Pro
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* Rights Checkbox */}
                  <label className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all mb-4 ${rightsConfirmed
                      ? 'bg-cyan-500/20 border border-cyan-400'
                      : isDark ? 'bg-white/5 border border-red-500/50 hover:bg-white/10' : 'bg-gray-50 border border-red-500/50 hover:bg-gray-100'
                    }`}>
                    <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 border-2 transition-colors ${rightsConfirmed ? 'bg-cyan-500 border-cyan-500' : 'border-gray-500'
                      }`}>
                      {rightsConfirmed && <CheckCircle className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        I confirm I have the legal right to use this audio
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        I own, have licensed, or created this content.{' '}
                        <Link href="/terms" className="text-cyan-400 hover:underline">Terms of Service</Link>
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
                    className={`w-full py-4 px-6 rounded-xl text-white font-semibold text-lg transition-all flex items-center justify-center gap-3 ${rightsConfirmed
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
                            ? 'Confirm Rights to Continue'
                            : reviewLyrics
                              ? 'Process & Review Lyrics'
                              : 'Create Karaoke Track'}
                        </span>
                      </>
                    )}
                  </button>

                  {isUploading && (
                    <div className={`mt-4 h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}>
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
    </>
  );
}