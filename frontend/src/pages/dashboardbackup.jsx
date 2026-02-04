'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  ChevronDown,
  MoreVertical,
  Trash2,
  RefreshCw,
  AlertTriangle
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

// ============================================
// PROJECT ACTIONS DROPDOWN COMPONENT
// ============================================
// This dropdown appears when clicking the three-dot menu (⋮)
// It contains all actions for a project in one clean menu
function ProjectActionsDropdown({ 
  project, 
  isDark, 
  onDownload, 
  onDelete, 
  onRetry,
  onViewHistory,
  downloadingId,
  isHistoryOpen,
  index  // We need this to calculate z-index
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown when pressing Escape
  useEffect(() => {
    function handleEscape(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const isCompleted = project.status === 'completed';
  const isAwaitingReview = project.status === 'awaiting_review';
  const isFailed = project.status === 'failed';
  const isProcessing = ['processing', 'transcribing', 'rendering'].includes(project.status);

  return (
    <div className="relative" ref={dropdownRef} style={{ zIndex: isOpen ? 100 : 1 }}>
      {/* Three-dot menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          p-2 rounded-lg transition-all duration-200
          ${isDark 
            ? 'hover:bg-white/10 active:bg-white/20' 
            : 'hover:bg-gray-200 active:bg-gray-300'
          }
          ${isOpen 
            ? isDark ? 'bg-white/10' : 'bg-gray-200' 
            : ''
          }
        `}
        aria-label="Project actions"
        aria-expanded={isOpen}
      >
        <MoreVertical className={`w-5 h-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15 }}
            className={`
              absolute right-0 top-full mt-2 min-w-[200px]
              rounded-xl overflow-hidden
              ${isDark 
                ? 'bg-gray-900 border border-white/20' 
                : 'bg-white border border-gray-200'
              }
              shadow-2xl
            `}
            style={{ zIndex: 9999 }}
          >
            <div className="py-1">
              {/* COMPLETED PROJECT OPTIONS */}
              {isCompleted && (
                <>
                  {/* Download */}
                  <button
                    onClick={() => {
                      onDownload(project);
                      setIsOpen(false);
                    }}
                    disabled={downloadingId === project.id}
                    className={`
                      w-full px-4 py-3 flex items-center gap-3 transition-colors text-left
                      ${isDark 
                        ? 'hover:bg-white/10 text-white' 
                        : 'hover:bg-gray-100 text-gray-900'
                      }
                      disabled:opacity-50
                    `}
                  >
                    {downloadingId === project.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                    ) : (
                      <Download className="w-4 h-4 text-cyan-400" />
                    )}
                    <span className="font-medium">
                      {downloadingId === project.id ? 'Downloading...' : 'Download'}
                    </span>
                  </button>

                  {/* Edit/Preview */}
                  <Link href={`/preview/${project.id}`}>
                    <button
                      onClick={() => setIsOpen(false)}
                      className={`
                        w-full px-4 py-3 flex items-center gap-3 transition-colors text-left
                        ${isDark 
                          ? 'hover:bg-white/10 text-white' 
                          : 'hover:bg-gray-100 text-gray-900'
                        }
                      `}
                    >
                      <Edit3 className="w-4 h-4 text-purple-400" />
                      <span className="font-medium">Edit / Re-export</span>
                    </button>
                  </Link>

                  {/* View Render History */}
                  <button
                    onClick={() => {
                      onViewHistory(project.id);
                      setIsOpen(false);
                    }}
                    className={`
                      w-full px-4 py-3 flex items-center gap-3 transition-colors text-left
                      ${isDark 
                        ? 'hover:bg-white/10 text-white' 
                        : 'hover:bg-gray-100 text-gray-900'
                      }
                    `}
                  >
                    <History className="w-4 h-4 text-blue-400" />
                    <span className="font-medium">Render History</span>
                    {isHistoryOpen && (
                      <CheckCircle className="w-3 h-3 text-cyan-400 ml-auto" />
                    )}
                  </button>

                  {/* Divider */}
                  <div className={`my-1 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`} />
                </>
              )}

              {/* AWAITING REVIEW OPTIONS */}
              {isAwaitingReview && (
                <>
                  <Link href={`/preview/${project.id}`}>
                    <button
                      onClick={() => setIsOpen(false)}
                      className={`
                        w-full px-4 py-3 flex items-center gap-3 transition-colors text-left
                        ${isDark 
                          ? 'hover:bg-white/10 text-white' 
                          : 'hover:bg-gray-100 text-gray-900'
                        }
                      `}
                    >
                      <Edit3 className="w-4 h-4 text-purple-400" />
                      <span className="font-medium">Review Lyrics</span>
                    </button>
                  </Link>

                  {/* Divider */}
                  <div className={`my-1 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`} />
                </>
              )}

              {/* FAILED PROJECT OPTIONS */}
              {isFailed && (
                <>
                  <button
                    onClick={() => {
                      onRetry(project);
                      setIsOpen(false);
                    }}
                    className={`
                      w-full px-4 py-3 flex items-center gap-3 transition-colors text-left
                      ${isDark 
                        ? 'hover:bg-white/10 text-white' 
                        : 'hover:bg-gray-100 text-gray-900'
                      }
                    `}
                  >
                    <RefreshCw className="w-4 h-4 text-orange-400" />
                    <span className="font-medium">Retry Processing</span>
                  </button>

                  {/* Divider */}
                  <div className={`my-1 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`} />
                </>
              )}

              {/* PROCESSING - just show status, no actions */}
              {isProcessing && (
                <>
                  <div className={`
                    px-4 py-3 flex items-center gap-3
                    ${isDark ? 'text-gray-400' : 'text-gray-500'}
                  `}>
                    <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />
                    <span className="text-sm">Processing in progress...</span>
                  </div>

                  {/* Divider */}
                  <div className={`my-1 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`} />
                </>
              )}

              {/* DELETE - always available */}
              <button
                onClick={() => {
                  onDelete(project);
                  setIsOpen(false);
                }}
                className={`
                  w-full px-4 py-3 flex items-center gap-3 transition-colors text-left
                  ${isDark 
                    ? 'hover:bg-red-500/20 text-red-400' 
                    : 'hover:bg-red-50 text-red-600'
                  }
                `}
              >
                <Trash2 className="w-4 h-4" />
                <span className="font-medium">Delete Project</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// DELETE CONFIRMATION MODAL
// ============================================
// This modal appears when user clicks "Delete Project"
function DeleteConfirmationModal({ project, isDark, onConfirm, onCancel, isDeleting }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={`
          w-full max-w-md rounded-2xl p-6 
          ${isDark 
            ? 'bg-gray-900 border border-white/20' 
            : 'bg-white border border-gray-200'
          }
          shadow-2xl
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Warning Icon */}
        <div className="flex justify-center mb-4">
          <div className={`
            w-16 h-16 rounded-full flex items-center justify-center
            ${isDark ? 'bg-red-500/20' : 'bg-red-100'}
          `}>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>

        {/* Title */}
        <h3 className={`text-xl font-bold text-center mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Delete Project?
        </h3>

        {/* Project Name */}
        <p className={`text-center mb-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          You are about to delete:
        </p>
        <p className={`
          text-center font-semibold mb-4 px-4 py-2 rounded-xl
          ${isDark ? 'bg-white/5 text-white' : 'bg-gray-100 text-gray-900'}
        `}>
          "{project?.title}"
        </p>

        {/* Warning Message */}
        <div className={`
          p-4 rounded-xl mb-6
          ${isDark ? 'bg-red-500/10 border border-red-500/30' : 'bg-red-50 border border-red-200'}
        `}>
          <p className={`text-sm text-center ${isDark ? 'text-red-300' : 'text-red-700'}`}>
            <strong>Warning:</strong> This action cannot be undone. All project data, 
            renders, and associated files will be permanently deleted.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className={`
              flex-1 px-4 py-3 rounded-xl font-medium transition-all
              ${isDark 
                ? 'bg-white/10 text-white hover:bg-white/20' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
              disabled:opacity-50
            `}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className={`
              flex-1 px-4 py-3 rounded-xl font-medium transition-all
              bg-red-500 text-white hover:bg-red-600
              disabled:opacity-50 flex items-center justify-center gap-2
            `}
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Delete Forever
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================
// MAIN DASHBOARD COMPONENT
// ============================================
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
  const [completedIds, setCompletedIds] = useState(new Set());

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

  // Delete confirmation state
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Add notification
  const addNotification = useCallback((message, type = 'success') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);

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
              const oldProject = projects.find(p => p.id === project.id);
              if (oldProject && ['processing', 'rendering'].includes(oldProject.status)) {
                addNotification(`"${project.title}" is ready for download!`, 'success');

                try {
                  const audio = new Audio('/notification.mp3');
                  audio.volume = 0.5;
                  audio.play().catch(() => { });
                } catch (e) { }
              }
              setCompletedIds(prev => new Set([...prev, project.id]));
            }

            if (project.status === 'awaiting_review' && !completedIds.has(project.id)) {
              const oldProject = projects.find(p => p.id === project.id);
              if (oldProject && oldProject.status === 'transcribing') {
                addNotification(`"${project.title}" is ready for lyrics review!`, 'success');
              }
              setCompletedIds(prev => new Set([...prev, project.id]));
            }

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
  useEffect(() => {
    const checkPendingPlan = async () => {
      if (!user || !profile) return;
      
      const pendingPlan = localStorage.getItem('karatrack_pending_plan');
      const metadataPlan = user.user_metadata?.pending_plan;
      const planToActivate = pendingPlan || metadataPlan;
      
      if (!planToActivate || planToActivate === 'free') return;
      
      if (profile.subscription_tier && profile.subscription_tier !== 'free') {
        localStorage.removeItem('karatrack_pending_plan');
        return;
      }
      
      console.log('Pending plan detected:', planToActivate);
      setCheckingPendingPlan(true);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          addNotification('Session not ready. Please click your plan again on the pricing page.', 'error');
          setCheckingPendingPlan(false);
          return;
        }
        
        const { data: planData, error: planError } = await supabase
          .from('subscription_plans')
          .select('stripe_price_id')
          .eq('tier', planToActivate)
          .single();
        
        if (planError || !planData?.stripe_price_id) {
          addNotification(`Could not find plan "${planToActivate}". Please select from pricing page.`, 'error');
          localStorage.removeItem('karatrack_pending_plan');
          setCheckingPendingPlan(false);
          return;
        }
        
        localStorage.removeItem('karatrack_pending_plan');
        
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stripe/create-checkout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ price_id: planData.stripe_price_id }),
        });
        
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.error || 'Failed to create checkout');
        
        window.location.href = data.url;
        
      } catch (err) {
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
        month: 'long', day: 'numeric', year: 'numeric'
      });
      addNotification(
        `Downgrade scheduled! You'll switch to ${profile.scheduled_tier} on ${effectiveDate}.`,
        'info'
      );
      router.replace('/dashboard', undefined, { shallow: true });
    } else if (router.query.downgrade_scheduled === 'true') {
      addNotification('Downgrade scheduled!', 'info');
      router.replace('/dashboard', undefined, { shallow: true });
    }
  }, [router.query.downgrade_scheduled, profile?.scheduled_tier, profile?.scheduled_tier_date, addNotification, router]);

  // Show notification for credit purchase
  useEffect(() => {
    if (router.query.credits_purchased === 'true') {
      addNotification('Credits purchased successfully!', 'success');
      router.replace('/dashboard', undefined, { shallow: true });
    }
  }, [router.query.credits_purchased, addNotification, router]);

  // Polling effect
  useEffect(() => {
    if (!user) return;

    const hasActiveProjects = projects.some(p =>
      ['processing', 'transcribing', 'rendering'].includes(p.status)
    );

    if (!hasActiveProjects) return;

    const pollInterval = setInterval(() => {
      fetchProjects(user.id, true);
    }, POLL_INTERVAL);

    return () => clearInterval(pollInterval);
  }, [user, projects, fetchProjects]);

  // Handle download
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
        { headers: { 'Authorization': `Bearer ${session.access_token}` } }
      );

      if (!response.ok) throw new Error('Failed to get download links');

      const urls = await response.json();

      if (urls.video || urls.processed_audio) {
        const downloadUrl = urls.video || urls.processed_audio;
        const filename = `${project.song_title || project.title} - ${project.artist_name || 'Karaoke'}.mp4`;
        
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        
        if (isIOS || isSafari) {
          window.location.href = downloadUrl;
        } else {
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

  // Handle retry failed project
  const handleRetryProject = async (project) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/projects/${project.id}/retry`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        }
      );

      if (response.ok) {
        addNotification('Retrying your track...', 'info');
        fetchProjects(user.id, false);
      } else {
        const error = await response.json();
        addNotification(error.error || 'Retry failed', 'error');
      }
    } catch (err) {
      addNotification('Failed to retry', 'error');
    }
  };

  // Handle delete project
  const handleDeleteProject = async () => {
    if (!projectToDelete) return;

    try {
      setIsDeleting(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/projects/${projectToDelete.id}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        }
      );

      if (response.ok) {
        setProjects(prev => prev.filter(p => p.id !== projectToDelete.id));
        addNotification(`"${projectToDelete.title}" has been deleted`, 'success');
      } else {
        const error = await response.json();
        addNotification(error.error || 'Failed to delete project', 'error');
      }
    } catch (err) {
      console.error('Failed to delete project:', err);
      addNotification('Failed to delete project', 'error');
    } finally {
      setIsDeleting(false);
      setProjectToDelete(null);
    }
  };

  // Toggle render history
  const handleToggleHistory = (projectId) => {
    if (showRenderHistory === projectId) {
      setShowRenderHistory(null);
    } else {
      setShowRenderHistory(projectId);
      fetchRenderHistory(projectId);
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
      addNotification('Failed to submit suggestion. Please try again.', 'error');
    } finally {
      setSubmittingSuggestion(false);
    }
  };

  // Loading state
  if (loading || checkingPendingPlan) {
    return (
      <>
        <SEO
          title="Dashboard"
          description="Manage your karaoke projects in Karatrack Studio."
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

  // Status helpers
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
      case 'completed': return 'Ready';
      case 'processing': return 'Processing...';
      case 'transcribing': return 'Transcribing...';
      case 'rendering': return 'Rendering...';
      case 'awaiting_review': return 'Review Lyrics';
      case 'failed': return 'Failed';
      default: return status;
    }
  };

  const processingCount = projects.filter(p =>
    ['processing', 'transcribing', 'rendering'].includes(p.status)
  ).length;

  const isPaidUser = profile?.subscription_tier && profile.subscription_tier !== 'free';

  return (
    <>
      <SEO
        title="Dashboard"
        description="Manage your karaoke projects in Karatrack Studio."
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
                className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg backdrop-blur-md ${
                  notification.type === 'success'
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
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          {/* Welcome Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className={`text-2xl sm:text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Welcome back, {profile?.full_name || user?.email?.split('@')[0]}!
            </h1>
            <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>Ready to transform some music?</p>
          </motion.div>

          {/* Stats Cards */}
          <div className={`grid grid-cols-2 ${isPaidUser ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4 sm:gap-6 mb-8`}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-panel p-4 sm:p-6"
            >
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400" />
                </div>
                <div>
                  <p className={`text-xs sm:text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Credits</p>
                  <p className={`text-xl sm:text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{profile?.credits_remaining || 0}</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-panel p-4 sm:p-6"
            >
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <FileVideo className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
                </div>
                <div>
                  <p className={`text-xs sm:text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Projects</p>
                  <p className={`text-xl sm:text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{projects.length}</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-panel p-4 sm:p-6"
            >
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" />
                </div>
                <div>
                  <p className={`text-xs sm:text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Plan</p>
                  <p className={`text-xl sm:text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} capitalize`}>{profile?.subscription_tier || 'Free'}</p>
                </div>
              </div>
            </motion.div>

            {isPaidUser && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="glass-panel p-4 sm:p-6 cursor-pointer hover:border-purple-500/50 transition-colors"
                onClick={() => setShowHelpModal(true)}
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <HelpCircle className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
                  </div>
                  <div>
                    <p className={`text-xs sm:text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Need Help?</p>
                    <p className={`text-base sm:text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {profile?.subscription_tier === 'studio' ? 'Priority' : 'Standard'}
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
              className={`dropzone cursor-pointer group transition-all ${isDragging ? 'border-cyan-400 bg-cyan-400/10 scale-[1.02]' : ''}`}
              onClick={() => router.push('/upload')}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
              onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);

                const files = e.dataTransfer.files;
                if (files && files.length > 0) {
                  const file = files[0];
                  const audioTypes = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/mp3', 'audio/x-wav', 'audio/x-m4a', 'audio/mp4'];

                  if (audioTypes.includes(file.type) || file.name.match(/\.(mp3|wav|flac|m4a)$/i)) {
                    window.__droppedAudioFile = file;
                    router.push('/upload');
                  } else {
                    addNotification('Please drop an audio file (MP3, WAV, FLAC, M4A)', 'error');
                  }
                }
              }}
            >
              <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br flex items-center justify-center transition-all ${
                isDragging
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
              className={`glass-panel p-4 sm:p-6 cursor-pointer hover:border-yellow-500/50 transition-all group ${isDark ? 'hover:bg-yellow-500/5' : 'hover:bg-yellow-50'}`}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Lightbulb className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" />
                </div>
                <div className="flex-1">
                  <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Have an idea?
                  </h3>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Suggest a feature and help shape Karatrack Studio
                  </p>
                </div>
                <div className={`text-sm font-medium hidden sm:block ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>
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
                className={`flex items-center gap-2 text-sm transition-colors ${isDark ? 'text-gray-400 hover:text-cyan-400' : 'text-gray-600 hover:text-cyan-600'}`}
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="glass-panel p-8 text-center">
                <FileVideo className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>No projects yet. Upload your first track!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {projects.map((project, i) => (
                  <motion.div
                    key={project.id}
                    className={`glass-panel p-4 ${
                      ['processing', 'transcribing', 'rendering'].includes(project.status) ? 'border border-yellow-500/30' :
                      project.status === 'awaiting_review' ? 'border border-purple-500/30' : ''
                    }`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    style={{ position: 'relative', zIndex: projects.length - i }}
                  >
                    {/* Main Row */}
                    <div className="flex items-center gap-3 sm:gap-4">
                      {/* Project Icon */}
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        project.status === 'completed' ? 'bg-green-500/20' :
                        ['processing', 'transcribing', 'rendering'].includes(project.status) ? 'bg-yellow-500/20' :
                        project.status === 'awaiting_review' ? 'bg-purple-500/20' :
                        project.status === 'failed' ? 'bg-red-500/20' : 'bg-white/5'
                      }`}>
                        <Music className={`w-5 h-5 sm:w-6 sm:h-6 ${
                          project.status === 'completed' ? 'text-green-400' :
                          ['processing', 'transcribing', 'rendering'].includes(project.status) ? 'text-yellow-400' :
                          project.status === 'awaiting_review' ? 'text-purple-400' :
                          project.status === 'failed' ? 'text-red-400' : 'text-cyan-400'
                        }`} />
                      </div>

                      {/* Project Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{project.title}</h3>
                        <p className="text-gray-400 text-sm truncate">
                          {new Date(project.created_at).toLocaleDateString()} • {project.artist_name || 'Unknown Artist'}
                        </p>
                      </div>

                      {/* Status Badge */}
                      <div className="hidden sm:flex items-center gap-2">
                        {getStatusIcon(project.status)}
                        <span className={`text-sm ${
                          project.status === 'completed' ? 'text-green-400' :
                          ['processing', 'transcribing', 'rendering'].includes(project.status) ? 'text-yellow-400' :
                          project.status === 'awaiting_review' ? 'text-purple-400' :
                          project.status === 'failed' ? 'text-red-400' : 'text-gray-400'
                        }`}>
                          {getStatusText(project.status)}
                        </span>
                      </div>

                      {/* Quick Download Button - Desktop Only, Completed Only */}
                      {project.status === 'completed' && (
                        <button
                          onClick={() => handleDownload(project)}
                          disabled={downloadingId === project.id}
                          className="hidden md:flex px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-lg text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 items-center gap-2"
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
                      )}

                      {/* Quick Review Button - Desktop Only, Awaiting Review Only */}
                      {project.status === 'awaiting_review' && (
                        <Link href={`/preview/${project.id}`} className="hidden md:block">
                          <button className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-white font-medium hover:opacity-90 transition-opacity flex items-center gap-2">
                            <Edit3 className="w-4 h-4" />
                            <span>Review</span>
                          </button>
                        </Link>
                      )}

                      {/* Actions Dropdown - Always Visible */}
                      <ProjectActionsDropdown
                        project={project}
                        isDark={isDark}
                        onDownload={handleDownload}
                        onDelete={setProjectToDelete}
                        onRetry={handleRetryProject}
                        onViewHistory={handleToggleHistory}
                        downloadingId={downloadingId}
                        isHistoryOpen={showRenderHistory === project.id}
                        index={i}
                      />
                    </div>

                    {/* Mobile Status Row */}
                    <div className="sm:hidden mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(project.status)}
                        <span className={`text-sm ${
                          project.status === 'completed' ? 'text-green-400' :
                          ['processing', 'transcribing', 'rendering'].includes(project.status) ? 'text-yellow-400' :
                          project.status === 'awaiting_review' ? 'text-purple-400' :
                          project.status === 'failed' ? 'text-red-400' : 'text-gray-400'
                        }`}>
                          {getStatusText(project.status)}
                        </span>
                      </div>

                      {/* Mobile Quick Actions */}
                      {project.status === 'completed' && (
                        <button
                          onClick={() => handleDownload(project)}
                          disabled={downloadingId === project.id}
                          className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-lg text-white text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {downloadingId === project.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Download className="w-4 h-4" />
                              Download
                            </>
                          )}
                        </button>
                      )}
                      {project.status === 'awaiting_review' && (
                        <Link href={`/preview/${project.id}`}>
                          <button className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-white text-sm font-medium flex items-center gap-1.5">
                            <Edit3 className="w-4 h-4" />
                            Review
                          </button>
                        </Link>
                      )}
                    </div>

                    {/* Render History Panel */}
                    <AnimatePresence>
                      {showRenderHistory === project.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className={`mt-4 p-4 rounded-xl ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                            <h4 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                              <History className="w-4 h-4" />
                              Render History
                            </h4>
                            
                            {loadingHistory ? (
                              <div className="flex items-center gap-2 text-sm text-gray-400 py-4 justify-center">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Loading history...
                              </div>
                            ) : renderHistory.length === 0 ? (
                              <p className="text-sm text-gray-400 text-center py-4">No render history found</p>
                            ) : (
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {renderHistory.map((render, index) => (
                                  <div 
                                    key={render.id}
                                    className={`flex items-center justify-between p-3 rounded-xl ${
                                      isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-white hover:bg-gray-100'
                                    } ${render.is_expired ? 'opacity-50' : ''} transition-colors`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className={`text-xs px-2 py-1 rounded-lg font-medium ${
                                        index === 0 
                                          ? 'bg-cyan-500/20 text-cyan-400' 
                                          : isDark ? 'bg-white/10 text-gray-400' : 'bg-gray-200 text-gray-600'
                                      }`}>
                                        {index === 0 ? 'Latest' : `v${render.render_number}`}
                                      </span>
                                      <div>
                                        <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                          {render.video_quality || '720p'} • {new Date(render.created_at).toLocaleDateString()}
                                        </p>
                                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                          {new Date(render.created_at).toLocaleTimeString()}
                                          {render.is_expired && ' • Expired'}
                                        </p>
                                      </div>
                                    </div>
                                    
                                    {!render.is_expired && render.download_url ? (
                                      <a
                                        href={render.download_url}
                                        download
                                        className={`p-2.5 rounded-xl transition-all ${
                                          isDark 
                                            ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30' 
                                            : 'bg-cyan-100 text-cyan-600 hover:bg-cyan-200'
                                        }`}
                                        title="Download this version"
                                      >
                                        <Download className="w-4 h-4" />
                                      </a>
                                    ) : render.is_expired ? (
                                      <span className="text-xs text-red-400 px-2">Expired</span>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            <p className={`text-xs mt-3 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                              Renders are available for 30 days
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </main>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {projectToDelete && (
            <DeleteConfirmationModal
              project={projectToDelete}
              isDark={isDark}
              onConfirm={handleDeleteProject}
              onCancel={() => setProjectToDelete(null)}
              isDeleting={isDeleting}
            />
          )}
        </AnimatePresence>

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
      </div>
    </>
  );
}
