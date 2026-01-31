'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Music,
  Upload,
  Zap,
  Settings,
  LogOut,
  FileVideo,
  Clock,
  CheckCircle,
  AlertCircle,
  Sun,
  Moon,
  Download,
  Loader2,
  Bell,
  X,
  Edit3,
  HelpCircle,
  Lightbulb,
  Send,
  History,
  ChevronDown
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import AppNavigation from '../components/AppNavigation';
import { createClient } from '@supabase/supabase-js';
import SEO from '../components/SEO';
import HelpModal from '../components/HelpModal';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Polling interval in milliseconds (5 seconds)
const POLL_INTERVAL = 5000;

// Global storage for dropped file (survives navigation)
if (typeof window !== 'undefined') {
  window.__droppedAudioFile = window.__droppedAudioFile || null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const { isDark, toggleTheme } = useTheme();

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);

  // Notification state
  const [notifications, setNotifications] = useState([]);
  const [completedIds, setCompletedIds] = useState(new Set()); // Track which we've notified about

  // Pending subscription checkout state
  const [checkingPendingPlan, setCheckingPendingPlan] = useState(false);

  // Help modal state
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Suggestion modal state
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [suggestionTitle, setSuggestionTitle] = useState('');
  const [suggestionDescription, setSuggestionDescription] = useState('');
  const [suggestionCategory, setSuggestionCategory] = useState('feature');
  const [submittingSuggestion, setSubmittingSuggestion] = useState(false);
  
  // Render history state
  const [showRenderHistory, setShowRenderHistory] = useState(null);
  const [renderHistory, setRenderHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Add notification
  const addNotification = useCallback((message, type = 'success') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);

    // Auto-remove after 5 seconds for success, 10 seconds for errors
    const duration = type === 'error' ? 10000 : 5000;
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, duration);
  }, []);

  // Remove notification
  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

// Fetch render history for a project
  const fetchRenderHistory = async (projectId) => {
    try {
      setLoadingHistory(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/projects/${projectId}/renders`,
        {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setRenderHistory(data.renders || []);
      }
    } catch (err) {
      console.error('Failed to fetch render history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Fetch projects (used for polling)
  const fetchProjects = useCallback(async (userId, isPolling = false) => {
    try {
      const { data: projectsData } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (projectsData) {
        // Check for newly completed projects (only when polling)
        if (isPolling) {
          projectsData.forEach(project => {
            if (project.status === 'completed' && !completedIds.has(project.id)) {
              // Check if this was previously processing or rendering
              const oldProject = projects.find(p => p.id === project.id);
              if (oldProject && ['processing', 'rendering'].includes(oldProject.status)) {
                addNotification(`"${project.title}" is ready for download!`, 'success');

                // Play notification sound (optional)
                try {
                  const audio = new Audio('/notification.mp3');
                  audio.volume = 0.5;
                  audio.play().catch(() => { }); // Ignore if no sound file
                } catch (e) { }
              }
              setCompletedIds(prev => new Set([...prev, project.id]));
            }

            // Check for awaiting_review (transcription completed)
            if (project.status === 'awaiting_review' && !completedIds.has(project.id)) {
              const oldProject = projects.find(p => p.id === project.id);
              if (oldProject && oldProject.status === 'transcribing') {
                addNotification(`"${project.title}" is ready for lyrics review!`, 'success');
              }
              setCompletedIds(prev => new Set([...prev, project.id]));
            }

            // Check for failed projects
            if (project.status === 'failed' && !completedIds.has(project.id)) {
              const oldProject = projects.find(p => p.id === project.id);
              if (oldProject && ['processing', 'transcribing', 'rendering'].includes(oldProject.status)) {
                addNotification(`"${project.title}" failed to process`, 'error');
              }
              setCompletedIds(prev => new Set([...prev, project.id]));
            }
          });
        }

        setProjects(projectsData);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  }, [projects, completedIds, addNotification]);

  // Initial load
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          router.push('/login');
          return;
        }

        setUser(user);

        // Fetch profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        setProfile(profileData);

        // Initial fetch of projects
        await fetchProjects(user.id, false);

        // Initialize completedIds with already-completed projects
        const { data: projectsData } = await supabase
          .from('projects')
          .select('id, status')
          .eq('user_id', user.id)
          .in('status', ['completed', 'failed']);

        if (projectsData) {
          setCompletedIds(new Set(projectsData.map(p => p.id)));
        }

      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };

    checkUser();
  }, [router]);

  // Check for pending subscription plan after email verification
  // This handles the case where user selected a paid plan during signup
  useEffect(() => {
    const checkPendingPlan = async () => {
      // Only run if user is loaded and profile exists
      if (!user || !profile) return;
      
      // Check localStorage for pending plan
      const pendingPlan = localStorage.getItem('karatrack_pending_plan');
      
      // Also check user metadata as fallback
      const metadataPlan = user.user_metadata?.pending_plan;
      
      const planToActivate = pendingPlan || metadataPlan;
      
      // Skip if no pending plan, or if it's free, or if user already has a paid subscription
      if (!planToActivate || planToActivate === 'free') {
        return;
      }
      
      // Skip if user already has the plan they selected (or any paid plan)
      if (profile.subscription_tier && profile.subscription_tier !== 'free') {
        // Clear the pending plan since they already have a subscription
        localStorage.removeItem('karatrack_pending_plan');
        return;
      }
      
      console.log('Pending plan detected:', planToActivate);
      setCheckingPendingPlan(true);
      
      // Small delay to ensure auth session is fully established after email confirmation
      await new Promise(resolve => setTimeout(resolve, 500));
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.error('No session for pending plan checkout');
          addNotification('Session not ready. Please click your plan again on the pricing page.', 'error');
          setCheckingPendingPlan(false);
          return;
        }
        
        console.log('Session found, fetching plan data for:', planToActivate);
        
        // Get the Stripe price ID for this plan
        const { data: planData, error: planError } = await supabase
          .from('subscription_plans')
          .select('stripe_price_id')
          .eq('tier', planToActivate)
          .single();
        
        if (planError) {
          console.error('Plan fetch error:', planError);
          addNotification(`Could not find plan "${planToActivate}". Please select from pricing page.`, 'error');
          localStorage.removeItem('karatrack_pending_plan');
          setCheckingPendingPlan(false);
          return;
        }
        
        if (!planData?.stripe_price_id) {
          console.error('Plan not found:', planToActivate);
          localStorage.removeItem('karatrack_pending_plan');
          setCheckingPendingPlan(false);
          return;
        }
        
        console.log('Creating checkout session with price:', planData.stripe_price_id);
        
        // Clear the pending plan from localStorage BEFORE redirect
        // This prevents redirect loops if user cancels checkout
        localStorage.removeItem('karatrack_pending_plan');
        
        // Create Stripe checkout session
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stripe/create-checkout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            price_id: planData.stripe_price_id,
          }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          console.error('Checkout API error:', data);
          throw new Error(data.error || 'Failed to create checkout');
        }
        
        // Redirect to Stripe checkout
        console.log('STRIPE] Redirecting to Stripe checkout for', planToActivate);
        window.location.href = data.url;
        
      } catch (err) {
        console.error('Pending plan checkout error:', err);
        console.error('Error details:', err.message);
        addNotification(`Failed to start checkout: ${err.message}. Please try from the pricing page.`, 'error');
        setCheckingPendingPlan(false);
      }
    };
    
    checkPendingPlan();
  }, [user, profile, addNotification]);

  // Show notification if redirected from upload with review mode
  useEffect(() => {
    if (router.query.awaiting_review === 'true') {
      addNotification('Your track is being transcribed. Click "Review Lyrics" when it\'s ready!', 'info');
      // Remove the query param from URL without refresh
      router.replace('/dashboard', undefined, { shallow: true });
    }
  }, [router.query.awaiting_review, addNotification, router]);

  // Show notification for successful upgrade
  useEffect(() => {
    if (router.query.upgraded === 'true') {
      addNotification('Upgrade successful! Your new plan is now active.', 'success');
      router.replace('/dashboard', undefined, { shallow: true });
    }
  }, [router.query.upgraded, addNotification, router]);

  // Show notification for scheduled downgrade
  useEffect(() => {
    if (router.query.downgrade_scheduled === 'true' && profile?.scheduled_tier_date) {
      const effectiveDate = new Date(profile.scheduled_tier_date).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
      addNotification(
        `Downgrade scheduled! You'll switch to ${profile.scheduled_tier} on ${effectiveDate}. You keep all current benefits until then.`,
        'info'
      );
      router.replace('/dashboard', undefined, { shallow: true });
    } else if (router.query.downgrade_scheduled === 'true') {
      addNotification('Downgrade scheduled! You\'ll keep your current plan until the end of your billing period.', 'info');
      router.replace('/dashboard', undefined, { shallow: true });
    }
  }, [router.query.downgrade_scheduled, profile?.scheduled_tier, profile?.scheduled_tier_date, addNotification, router]);

  // Show notification for credit purchase
  useEffect(() => {
    if (router.query.credits_purchased === 'true') {
      addNotification('Credits purchased successfully! They\'ve been added to your account.', 'success');
      router.replace('/dashboard', undefined, { shallow: true });
    }
  }, [router.query.credits_purchased, addNotification, router]);

  // Polling effect - only poll when there are processing projects
  useEffect(() => {
    if (!user) return;

    const hasActiveProjects = projects.some(p =>
      ['processing', 'transcribing', 'rendering'].includes(p.status)
    );

    if (!hasActiveProjects) return;

    console.log('Starting polling - active projects detected');

    const pollInterval = setInterval(() => {
      fetchProjects(user.id, true);
    }, POLL_INTERVAL);

    return () => {
      console.log('Stopping polling');
      clearInterval(pollInterval);
    };
  }, [user, projects, fetchProjects]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleDownload = async (project) => {
    try {
      setDownloadingId(project.id);

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        alert('Please log in again');
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/projects/${project.id}/download`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get download links');
      }

      const urls = await response.json();

      if (urls.video || urls.processed_audio) {
        const downloadUrl = urls.video || urls.processed_audio;
        const filename = `${project.song_title || project.title} - ${project.artist_name || 'Karaoke'}.mp4`;
        
        // Check if iOS/Safari
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        
        if (isIOS || isSafari) {
          // For iOS/Safari: Navigate directly to the video URL
          // This opens the video in the browser where user can long-press to save
          window.location.href = downloadUrl;
        } else {
          // For desktop/Android: Use anchor tag download
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = filename;
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } else {
        alert('No files available for download');
      }
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to download. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  // Manual refresh
  const handleRefresh = async () => {
    if (user) {
      await fetchProjects(user.id, false);
      addNotification('Projects refreshed', 'info');
    }
  };

  // Submit feature suggestion
  const handleSubmitSuggestion = async () => {
    if (!suggestionTitle.trim() || !suggestionDescription.trim()) {
      addNotification('Please fill in all fields', 'error');
      return;
    }

    setSubmittingSuggestion(true);
    try {
      const { error } = await supabase
        .from('roadmap_suggestions')
        .insert({
          title: suggestionTitle.trim(),
          description: suggestionDescription.trim(),
          category: suggestionCategory,
          user_id: user.id,
          user_email: user.email,
          status: 'pending',
          vote_count: 0
        });

      if (error) throw error;

      addNotification('Thank you! Your suggestion has been submitted for review.', 'success');
      setSuggestionTitle('');
      setSuggestionDescription('');
      setSuggestionCategory('feature');
      setShowSuggestionModal(false);
    } catch (err) {
      console.error('Suggestion error:', err);
      addNotification('Failed to submit suggestion. Please try again.', 'error');
    } finally {
      setSubmittingSuggestion(false);
    }
  };

  if (loading || checkingPendingPlan) {
    return (
      <>
        <SEO
          title="Dashboard"
          description="Manage your karaoke projects in Karatrack Studio. View processing status, download completed videos, and upload new tracks."
          path="/dashboard"
        />
        <div className={`min-h-screen ${isDark ? 'bg-animated-dark' : 'bg-animated-light'} flex items-center justify-center`}>
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">Loading...</p>
          </div>
        </div>
      </>
    );
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'processing':
      case 'transcribing':
      case 'rendering':
        return <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />;
      case 'awaiting_review':
        return <Edit3 className="w-5 h-5 text-purple-400" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed':
        return 'Ready';
      case 'processing':
        return 'Processing...';
      case 'transcribing':
        return 'Transcribing...';
      case 'rendering':
        return 'Rendering...';
      case 'awaiting_review':
        return 'Review Lyrics';
      case 'failed':
        return 'Failed';
      default:
        return status;
    }
  };

  // Count processing projects (all active statuses)
  const processingCount = projects.filter(p =>
    ['processing', 'transcribing', 'rendering'].includes(p.status)
  ).length;

  // Check if user has paid subscription (for showing help button)
  const isPaidUser = profile?.subscription_tier && profile.subscription_tier !== 'free';

  return (
    <>
      <SEO
        title="Dashboard"
        description="Manage your karaoke projects in Karatrack Studio. View processing status, download completed videos, and upload new tracks."
        path="/dashboard"
      />
      <div className={`min-h-screen ${isDark ? 'bg-animated-dark' : 'bg-animated-light'}`}>
        {/* Notification Toasts */}
        <div className="fixed top-4 right-4 z-50 space-y-2">
          <AnimatePresence>
            {notifications.map(notification => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, x: 100, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 100, scale: 0.9 }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg backdrop-blur-md ${notification.type === 'success'
                    ? 'bg-green-500/20 border border-green-500/50'
                    : notification.type === 'error'
                      ? 'bg-red-500/20 border border-red-500/50'
                      : 'bg-cyan-500/20 border border-cyan-500/50'
                  }`}
              >
                {notification.type === 'success' && <CheckCircle className="w-5 h-5 text-green-400" />}
                {notification.type === 'error' && <AlertCircle className="w-5 h-5 text-red-400" />}
                {notification.type === 'info' && <Bell className="w-5 h-5 text-cyan-400" />}
                <span className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{notification.message}</span>
                <button
                  onClick={() => removeNotification(notification.id)}
                  className="ml-2 text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <AppNavigation profile={profile} />

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-6 py-8">
          {/* Welcome Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Welcome back, {profile?.full_name || user?.email?.split('@')[0]}!
            </h1>
            <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>Ready to transform some music?</p>
          </motion.div>

          {/* Stats Cards - Changes to 4 columns when paid user, 3 columns for free */}
          <div className={`grid ${isPaidUser ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-6 mb-8`}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-panel p-6"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Credits Remaining</p>
                  <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{profile?.credits_remaining || 0}</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-panel p-6"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <FileVideo className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Total Projects</p>
                  <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{projects.length}</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-panel p-6"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Subscription</p>
                  <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} capitalize`}>{profile?.subscription_tier || 'Free'}</p>
                </div>
              </div>
            </motion.div>

            {/* Help/Support Card - Only show for paid users */}
            {isPaidUser && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="glass-panel p-6 cursor-pointer hover:border-purple-500/50 transition-colors"
                onClick={() => setShowHelpModal(true)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <HelpCircle className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Need Help?</p>
                    <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {profile?.subscription_tier === 'studio' ? 'Priority' : 'Standard'} Support
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Upload Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-8"
          >
            <div
              className={`dropzone cursor-pointer group transition-all ${isDragging ? 'border-cyan-400 bg-cyan-400/10 scale-[1.02]' : ''
                }`}
              onClick={() => router.push('/upload')}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(true);
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);

                const files = e.dataTransfer.files;
                if (files && files.length > 0) {
                  const file = files[0];
                  const audioTypes = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/mp3', 'audio/x-wav', 'audio/x-m4a', 'audio/mp4'];

                  if (audioTypes.includes(file.type) || file.name.match(/\.(mp3|wav|flac|m4a)$/i)) {
                    // Store file in global variable for upload page to access
                    window.__droppedAudioFile = file;
                    console.log('File dropped:', file.name);
                    router.push('/upload');
                  } else {
                    addNotification('Please drop an audio file (MP3, WAV, FLAC, M4A)', 'error');
                  }
                }
              }}
            >
              <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br flex items-center justify-center transition-all ${isDragging
                  ? 'from-cyan-400/40 to-purple-500/40'
                  : 'from-cyan-400/20 to-purple-500/20 group-hover:from-cyan-400/40 group-hover:to-purple-500/40'
                }`}>
                <Upload className={`w-8 h-8 ${isDragging ? 'text-cyan-400' : 'text-cyan-500'}`} />
              </div>
              <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {isDragging ? 'Drop your file here!' : 'Upload New Track'}
              </h3>
              <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                {isDragging ? 'Release to start uploading' : 'Drop your audio file or click to browse'}
              </p>
            </div>
          </motion.div>

          {/* Suggest a Feature Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="mb-8"
          >
            <div
              onClick={() => setShowSuggestionModal(true)}
              className={`glass-panel p-6 cursor-pointer hover:border-yellow-500/50 transition-all group ${isDark ? 'hover:bg-yellow-500/5' : 'hover:bg-yellow-50'}`}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Lightbulb className="w-6 h-6 text-yellow-400" />
                </div>
                <div className="flex-1">
                  <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Have an idea?
                  </h3>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Suggest a feature and help shape Karatrack Studio
                  </p>
                </div>
                <div className={`text-sm font-medium ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>
                  Suggest Feature
                </div>
              </div>
            </div>
          </motion.div>

          {/* Recent Projects */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Recent Projects</h2>
                {processingCount > 0 && (
                  <span className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-400 rounded-full flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {processingCount} processing
                  </span>
                )}
              </div>
              <button
                onClick={handleRefresh}
                className="text-sm text-gray-400 hover:text-cyan-400 transition-colors"
              >
                Refresh
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="glass-panel p-8 text-center">
                <FileVideo className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>No projects yet. Upload your first track!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {projects.map((project, i) => (
                  <motion.div
                    key={project.id}
                    className={`glass-panel p-4 flex items-center justify-between ${['processing', 'transcribing', 'rendering'].includes(project.status) ? 'border border-yellow-500/30' :
                        project.status === 'awaiting_review' ? 'border border-purple-500/30' : ''
                      }`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${project.status === 'completed' ? 'bg-green-500/20' :
                          ['processing', 'transcribing', 'rendering'].includes(project.status) ? 'bg-yellow-500/20' :
                            project.status === 'awaiting_review' ? 'bg-purple-500/20' :
                              project.status === 'failed' ? 'bg-red-500/20' : 'bg-white/5'
                        }`}>
                        <Music className={`w-6 h-6 ${project.status === 'completed' ? 'text-green-400' :
                            ['processing', 'transcribing', 'rendering'].includes(project.status) ? 'text-yellow-400' :
                              project.status === 'awaiting_review' ? 'text-purple-400' :
                                project.status === 'failed' ? 'text-red-400' : 'text-cyan-400'
                          }`} />
                      </div>
                      <div>
                        <h3 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{project.title}</h3>
                        <p className="text-gray-400 text-sm">
                          {new Date(project.created_at).toLocaleDateString()} - {project.artist_name || 'Unknown Artist'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(project.status)}
                        <span className={`text-sm ${project.status === 'completed' ? 'text-green-400' :
                            ['processing', 'transcribing', 'rendering'].includes(project.status) ? 'text-yellow-400' :
                              project.status === 'awaiting_review' ? 'text-purple-400' :
                                project.status === 'failed' ? 'text-red-400' : 'text-gray-400'
                          }`}>
                          {getStatusText(project.status)}
                        </span>
                      </div>

                      {/* Download & Edit Buttons - only show for completed projects */}
                      {project.status === 'completed' && (
                        <div className="flex items-center gap-2 ml-2">
                          {/* Download Button */}
                          <button
                            onClick={() => handleDownload(project)}
                            disabled={downloadingId === project.id}
                            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-lg text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                          >
                            {downloadingId === project.id ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Loading...</span>
                              </>
                            ) : (
                              <>
                                <Download className="w-4 h-4" />
                                <span>Download</span>
                              </>
                            )}
                          </button>
                          
                          {/* Version History Button */}
                          <button
                            onClick={() => {
                              if (showRenderHistory === project.id) {
                                setShowRenderHistory(null);
                              } else {
                                setShowRenderHistory(project.id);
                                fetchRenderHistory(project.id);
                              }
                            }}
                            className={`px-3 py-2 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                              isDark 
                                ? 'bg-white/10 hover:bg-white/20 text-white border border-white/10' 
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
                            } ${showRenderHistory === project.id ? 'ring-2 ring-cyan-500' : ''}`}
                            title="View all render versions"
                          >
                            <History className="w-4 h-4" />
                            <ChevronDown className={`w-3 h-3 transition-transform ${showRenderHistory === project.id ? 'rotate-180' : ''}`} />
                          </button>
                          
                          {/* Edit/Re-export Button */}
                          <Link href={`/preview/${project.id}`}>
                            <button 
                              className={`px-3 py-2 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                                isDark 
                                  ? 'bg-white/10 hover:bg-white/20 text-white border border-white/10' 
                                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
                              }`}
                              title="Edit project or export in different format"
                            >
                              <Edit3 className="w-4 h-4" />
                              <span>Edit</span>
                            </button>
                          </Link>
                        </div>
                      )}

                      {/* Render History Dropdown */}
                      {showRenderHistory === project.id && (
                        <div className={`mt-3 p-3 rounded-lg ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                          <h4 className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            Render History
                          </h4>
                          
                          {loadingHistory ? (
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Loading history...
                            </div>
                          ) : renderHistory.length === 0 ? (
                            <p className="text-sm text-gray-400">No render history found</p>
                          ) : (
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {renderHistory.map((render, index) => (
                                <div 
                                  key={render.id}
                                  className={`flex items-center justify-between p-2 rounded ${
                                    isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-white hover:bg-gray-100'
                                  } ${render.is_expired ? 'opacity-50' : ''}`}
                                >
                                  <div className="flex items-center gap-3">
                                    <span className={`text-xs px-2 py-0.5 rounded ${
                                      index === 0 
                                        ? 'bg-cyan-500/20 text-cyan-400' 
                                        : isDark ? 'bg-white/10 text-gray-400' : 'bg-gray-200 text-gray-600'
                                    }`}>
                                      {index === 0 ? 'Latest' : `v${render.render_number}`}
                                    </span>
                                    <div>
                                      <p className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        {render.video_quality || '720p'} • {new Date(render.created_at).toLocaleDateString()}
                                      </p>
                                      <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                        {new Date(render.created_at).toLocaleTimeString()}
                                        {render.is_expired && ' • Expired'}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  {!render.is_expired && render.download_url ? (
                                    
                                      href={render.download_url}
                                      download
                                      className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors"
                                      title="Download this version"
                                    >
                                      <Download className="w-4 h-4" />
                                    </a>
                                  ) : render.is_expired ? (
                                    <span className="text-xs text-red-400">Expired</span>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          )}
                          
                          <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            Renders are available for 30 days
                          </p>
                        </div>
                      )}

                      {/* Review Lyrics Button - for awaiting_review projects */}
                      {project.status === 'awaiting_review' && (
                        <Link href={`/preview/${project.id}`}>
                          <button className="ml-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-white font-medium hover:opacity-90 transition-opacity flex items-center gap-2">
                            <Edit3 className="w-4 h-4" />
                            <span>Review Lyrics</span>
                          </button>
                        </Link>
                      )}

                      {/* Retry button for failed projects */}
                      {project.status === 'failed' && (
                        <button
                          onClick={async () => {
                            try {
                              const { data: { session } } = await supabase.auth.getSession();
                              if (!session) return;

                              const response = await fetch(
                                `${process.env.NEXT_PUBLIC_API_URL}/api/projects/${project.id}/retry`,
                                {
                                  method: 'POST',
                                  headers: {
                                    'Authorization': `Bearer ${session.access_token}`
                                  }
                                }
                              );

                              if (response.ok) {
                                addNotification('Retrying your track...', 'info');
                                fetchProjects(user.id, false);
                              } else {
                                const error = await response.json();
                                addNotification(`${error.error || 'Retry failed'}`, 'error');
                              }
                            } catch (err) {
                              addNotification('Failed to retry', 'error');
                            }
                          }}
                          className="ml-2 px-4 py-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 font-medium hover:bg-red-500/30 transition-colors"
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </main>
      </div>

      {/* Help Modal */}
      <HelpModal 
        isOpen={showHelpModal} 
        onClose={() => setShowHelpModal(false)} 
        profile={profile}
      />

      {/* Suggestion Modal */}
      <AnimatePresence>
        {showSuggestionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={() => setShowSuggestionModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-lg rounded-2xl p-6 ${isDark ? 'bg-gray-900' : 'bg-white'} border ${isDark ? 'border-white/10' : 'border-gray-200'}`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                    <Lightbulb className="w-5 h-5 text-yellow-400" />
                  </div>
                  <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Suggest a Feature
                  </h3>
                </div>
                <button
                  onClick={() => setShowSuggestionModal(false)}
                  className={`p-2 rounded-lg ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Title
                  </label>
                  <input
                    type="text"
                    value={suggestionTitle}
                    onChange={(e) => setSuggestionTitle(e.target.value)}
                    placeholder="Brief title for your idea"
                    maxLength={100}
                    className={`w-full px-4 py-3 rounded-lg border ${
                      isDark 
                        ? 'bg-white/5 border-white/20 text-white placeholder-gray-500' 
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                    } focus:outline-none focus:border-cyan-500`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Description
                  </label>
                  <textarea
                    value={suggestionDescription}
                    onChange={(e) => setSuggestionDescription(e.target.value)}
                    placeholder="Describe your feature idea and why it would be useful..."
                    rows={4}
                    maxLength={500}
                    className={`w-full px-4 py-3 rounded-lg border resize-none ${
                      isDark 
                        ? 'bg-white/5 border-white/20 text-white placeholder-gray-500' 
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                    } focus:outline-none focus:border-cyan-500`}
                  />
                  <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    {suggestionDescription.length}/500 characters
                  </p>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Category
                  </label>
                  <select
                    value={suggestionCategory}
                    onChange={(e) => setSuggestionCategory(e.target.value)}
                    className={`w-full px-4 py-3 rounded-lg border ${
                      isDark 
                        ? 'bg-white/5 border-white/20 text-white' 
                        : 'bg-white border-gray-300 text-gray-900'
                    } focus:outline-none focus:border-cyan-500`}
                  >
                    <option value="feature" className={isDark ? 'bg-gray-900' : 'bg-white'}>New Feature</option>
                    <option value="improvement" className={isDark ? 'bg-gray-900' : 'bg-white'}>Improvement</option>
                    <option value="ui" className={isDark ? 'bg-gray-900' : 'bg-white'}>UI/UX</option>
                    <option value="integration" className={isDark ? 'bg-gray-900' : 'bg-white'}>Integration</option>
                    <option value="other" className={isDark ? 'bg-gray-900' : 'bg-white'}>Other</option>
                  </select>
                </div>

                <div className={`p-3 rounded-lg ${isDark ? 'bg-cyan-500/10 border border-cyan-500/20' : 'bg-cyan-50 border border-cyan-200'}`}>
                  <p className={`text-sm ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
                    Your suggestion will be reviewed by our team. Approved ideas will appear on the public roadmap for voting!
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowSuggestionModal(false)}
                    className={`flex-1 px-4 py-3 rounded-lg font-medium ${
                      isDark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    } transition-colors`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitSuggestion}
                    disabled={submittingSuggestion || !suggestionTitle.trim() || !suggestionDescription.trim()}
                    className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submittingSuggestion ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Submit
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}