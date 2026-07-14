'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Music,
  Upload,
  Zap,
  FileVideo,
  Clock,
  CheckCircle,
  AlertCircle,
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
  ChevronUp,
  Trash2,
  RefreshCw,
  AlertTriangle,
  ExternalLink,
  RotateCcw,
  Calendar
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
// STATUS HELPERS
// ============================================
const STATUS_CONFIG = {
  completed: {
    label: 'Ready',
    color: 'green',
    bgClass: 'bg-emerald-500/15',
    textClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/30',
    dotClass: 'bg-emerald-400',
    lightTextClass: 'text-emerald-600',
    lightBgClass: 'bg-emerald-50',
    lightBorderClass: 'border-emerald-200',
    lightDotClass: 'bg-emerald-500',
  },
  processing: {
    label: 'Processing',
    color: 'amber',
    bgClass: 'bg-amber-500/15',
    textClass: 'text-amber-400',
    borderClass: 'border-amber-500/30',
    dotClass: 'bg-amber-400',
    lightTextClass: 'text-amber-600',
    lightBgClass: 'bg-amber-50',
    lightBorderClass: 'border-amber-200',
    lightDotClass: 'bg-amber-500',
    animated: true,
  },
  transcribing: {
    label: 'Transcribing',
    color: 'amber',
    bgClass: 'bg-amber-500/15',
    textClass: 'text-amber-400',
    borderClass: 'border-amber-500/30',
    dotClass: 'bg-amber-400',
    lightTextClass: 'text-amber-600',
    lightBgClass: 'bg-amber-50',
    lightBorderClass: 'border-amber-200',
    lightDotClass: 'bg-amber-500',
    animated: true,
  },
  rendering: {
    label: 'Rendering',
    color: 'amber',
    bgClass: 'bg-amber-500/15',
    textClass: 'text-amber-400',
    borderClass: 'border-amber-500/30',
    dotClass: 'bg-amber-400',
    lightTextClass: 'text-amber-600',
    lightBgClass: 'bg-amber-50',
    lightBorderClass: 'border-amber-200',
    lightDotClass: 'bg-amber-500',
    animated: true,
  },
  awaiting_review: {
    label: 'Review Lyrics',
    color: 'purple',
    bgClass: 'bg-purple-500/15',
    textClass: 'text-purple-400',
    borderClass: 'border-purple-500/30',
    dotClass: 'bg-purple-400',
    lightTextClass: 'text-purple-600',
    lightBgClass: 'bg-purple-50',
    lightBorderClass: 'border-purple-200',
    lightDotClass: 'bg-purple-500',
  },
  failed: {
    label: 'Failed',
    color: 'red',
    bgClass: 'bg-red-500/15',
    textClass: 'text-red-400',
    borderClass: 'border-red-500/30',
    dotClass: 'bg-red-400',
    lightTextClass: 'text-red-600',
    lightBgClass: 'bg-red-50',
    lightBorderClass: 'border-red-200',
    lightDotClass: 'bg-red-500',
  },
};

const getStatusConfig = (status) => STATUS_CONFIG[status] || {
  label: status,
  color: 'gray',
  bgClass: 'bg-gray-500/15',
  textClass: 'text-gray-400',
  borderClass: 'border-gray-500/30',
  dotClass: 'bg-gray-400',
  lightTextClass: 'text-gray-600',
  lightBgClass: 'bg-gray-50',
  lightBorderClass: 'border-gray-200',
  lightDotClass: 'bg-gray-500',
};


// ============================================
// STATUS BADGE COMPONENT
// ============================================
function StatusBadge({ status, isDark }) {
  const config = getStatusConfig(status);

  return (
    <span className={`
      inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide
      ${isDark
        ? `${config.bgClass} ${config.textClass}`
        : `${config.lightBgClass} ${config.lightTextClass} border ${config.lightBorderClass}`
      }
    `}>
      {/* Status dot - animates for processing states */}
      <span className={`
        w-1.5 h-1.5 rounded-full flex-shrink-0
        ${isDark ? config.dotClass : config.lightDotClass}
        ${config.animated ? 'animate-pulse' : ''}
      `} />
      {config.label}
    </span>
  );
}


// ============================================
// PROJECT CARD COMPONENT
// ============================================
// Each project is a card that expands when clicked to show all actions.
// No more three-dot menus or fragile dropdowns.
function ProjectCard({
  project,
  isDark,
  isExpanded,
  onToggle,
  onDownload,
  onDelete,
  onRetry,
  downloadingId,
  renderHistory,
  loadingHistory,
  onToggleHistory,
  showHistory,
}) {
  const config = getStatusConfig(project.status);
  const isCompleted = project.status === 'completed';
  const isAwaitingReview = project.status === 'awaiting_review';
  const isFailed = project.status === 'failed';
  const isProcessing = ['processing', 'transcribing', 'rendering'].includes(project.status);

  return (
    <motion.div
      layout
      className={`
        rounded-2xl overflow-hidden transition-all duration-300
        ${isDark
          ? `bg-white/[0.04] border ${isExpanded ? 'border-white/20 shadow-lg shadow-cyan-500/5' : 'border-white/[0.08] hover:border-white/15'}`
          : `bg-white/70 border ${isExpanded ? 'border-gray-300 shadow-lg shadow-gray-200' : 'border-gray-200/80 hover:border-gray-300'}`
        }
        backdrop-blur-xl
      `}
    >
      {/* ---- MAIN ROW (always visible) ---- */}
      {/* Clicking this row expands/collapses the card */}
      <button
        onClick={onToggle}
        className={`
          w-full text-left p-4 sm:p-5 flex items-center gap-3 sm:gap-4
          transition-colors duration-200
          ${isDark ? 'hover:bg-white/[0.03]' : 'hover:bg-gray-50/50'}
        `}
      >
        {/* Project icon */}
        <div className={`
          w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0
          ${isDark ? config.bgClass : config.lightBgClass}
        `}>
          {isProcessing ? (
            <Loader2 className={`w-5 h-5 sm:w-6 sm:h-6 animate-spin ${isDark ? config.textClass : config.lightTextClass}`} />
          ) : (
            <Music className={`w-5 h-5 sm:w-6 sm:h-6 ${isDark ? config.textClass : config.lightTextClass}`} />
          )}
        </div>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold truncate text-[15px] ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {project.title}
          </h3>
          <p className={`text-xs mt-0.5 truncate ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
            {project.artist_name || 'Unknown Artist'}
            <span className="mx-1.5">&#183;</span>
            {new Date(project.created_at).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric'
            })}
          </p>
        </div>

        {/* Status badge */}
        <StatusBadge status={project.status} isDark={isDark} />

        {/* Expand/collapse chevron */}
        <div className={`
          flex-shrink-0 transition-transform duration-300
          ${isExpanded ? 'rotate-180' : ''}
          ${isDark ? 'text-gray-500' : 'text-gray-400'}
        `}>
          <ChevronDown className="w-5 h-5" />
        </div>
      </button>

      {/* ---- EXPANDED CONTENT (actions + history) ---- */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {/* Separator line */}
            <div className={`mx-4 sm:mx-5 border-t ${isDark ? 'border-white/[0.08]' : 'border-gray-200'}`} />

            {/* Action buttons row */}
            <div className="p-4 sm:p-5 space-y-3">
              {/* Primary actions row */}
              <div className="flex flex-wrap gap-2">
                {/* COMPLETED: Download + Edit + History */}
                {isCompleted && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDownload(project); }}
                      disabled={downloadingId === project.id}
                      className={`
                        flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
                        transition-all duration-200
                        bg-gradient-to-r from-cyan-500 to-blue-500 text-white
                        hover:shadow-lg hover:shadow-cyan-500/25 hover:scale-[1.02]
                        active:scale-[0.98]
                        disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none
                      `}
                    >
                      {downloadingId === project.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      {downloadingId === project.id ? 'Downloading...' : 'Download'}
                    </button>

                    <Link href={`/preview/${project.id}`}>
                      <button className={`
                        flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
                        transition-all duration-200
                        ${isDark
                          ? 'bg-white/10 text-white hover:bg-white/15'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }
                        hover:scale-[1.02] active:scale-[0.98]
                      `}>
                        <Edit3 className="w-4 h-4" />
                        Edit / Re-export
                      </button>
                    </Link>

                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleHistory(project.id); }}
                      className={`
                        flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
                        transition-all duration-200
                        ${showHistory
                          ? isDark
                            ? 'bg-cyan-500/20 text-cyan-400'
                            : 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                          : isDark
                            ? 'bg-white/10 text-white hover:bg-white/15'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }
                        hover:scale-[1.02] active:scale-[0.98]
                      `}
                    >
                      <History className="w-4 h-4" />
                      History
                      {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </>
                )}

                {/* AWAITING REVIEW: Review button */}
                {isAwaitingReview && (
                  <Link href={`/preview/${project.id}`}>
                    <button className={`
                      flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
                      transition-all duration-200
                      bg-gradient-to-r from-purple-500 to-pink-500 text-white
                      hover:shadow-lg hover:shadow-purple-500/25 hover:scale-[1.02]
                      active:scale-[0.98]
                    `}>
                      <Edit3 className="w-4 h-4" />
                      Review Lyrics
                    </button>
                  </Link>
                )}

                {/* FAILED: Retry button */}
                {isFailed && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRetry(project); }}
                    className={`
                      flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
                      transition-all duration-200
                      ${isDark
                        ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                      }
                      hover:scale-[1.02] active:scale-[0.98]
                    `}
                  >
                    <RotateCcw className="w-4 h-4" />
                    Retry Processing
                  </button>
                )}

                {/* PROCESSING: Status info */}
                {isProcessing && (
                  <div className={`
                    flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm
                    ${isDark ? 'bg-amber-500/10 text-amber-400/80' : 'bg-amber-50 text-amber-600'}
                  `}>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Your track is being {project.status === 'rendering' ? 'rendered' : project.status === 'transcribing' ? 'transcribed' : 'processed'}. This may take a few minutes.
                  </div>
                )}

                {/* Spacer to push delete to end */}
                <div className="flex-1" />

                {/* DELETE: Always available */}
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(project); }}
                  className={`
                    flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium
                    transition-all duration-200
                    ${isDark
                      ? 'text-gray-500 hover:bg-red-500/15 hover:text-red-400'
                      : 'text-gray-400 hover:bg-red-50 hover:text-red-600'
                    }
                  `}
                  title="Delete Project"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Delete</span>
                </button>
              </div>

              {/* ---- RENDER HISTORY PANEL ---- */}
              <AnimatePresence>
                {showHistory && isCompleted && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className={`
                      rounded-xl p-4
                      ${isDark ? 'bg-white/[0.03] border border-white/[0.08]' : 'bg-gray-50 border border-gray-200'}
                    `}>
                      <h4 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        <History className="w-4 h-4" />
                        Render History
                      </h4>

                      {loadingHistory ? (
                        <div className="flex items-center justify-center gap-2 text-sm py-6">
                          <Loader2 className={`w-4 h-4 animate-spin ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                          <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Loading history...</span>
                        </div>
                      ) : renderHistory.length === 0 ? (
                        <div className={`text-sm text-center py-6 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          No render history found
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-56 overflow-y-auto">
                          {renderHistory.map((render, index) => (
                            <div
                              key={render.id}
                              className={`
                                flex items-center justify-between p-3 rounded-lg transition-colors
                                ${isDark
                                  ? 'bg-white/[0.03] hover:bg-white/[0.06]'
                                  : 'bg-white hover:bg-gray-100'
                                }
                                ${render.is_expired ? 'opacity-50' : ''}
                              `}
                            >
                              <div className="flex items-center gap-3">
                                <span className={`
                                  text-xs px-2 py-0.5 rounded-md font-semibold
                                  ${index === 0
                                    ? isDark
                                      ? 'bg-cyan-500/20 text-cyan-400'
                                      : 'bg-cyan-50 text-cyan-700'
                                    : isDark
                                      ? 'bg-white/10 text-gray-500'
                                      : 'bg-gray-100 text-gray-500'
                                  }
                                `}>
                                  {index === 0 ? 'Latest' : `v${render.render_number}`}
                                </span>
                                <div>
                                  <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {render.video_quality || '720p'}
                                    {render.settings_snapshot?.display_mode && (
                                      <span className={`ml-1.5 font-normal ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                        {render.settings_snapshot.display_mode}
                                      </span>
                                    )}
                                    {render.settings_snapshot?.audio_track && (
                                      <span className={`ml-1.5 font-normal ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                        {render.settings_snapshot.audio_track === 'instrumental' ? 'No Vocals' :
                                         render.settings_snapshot.audio_track === 'guide' ? 'Guide' :
                                         render.settings_snapshot.audio_track === 'original' ? 'Original' :
                                         render.settings_snapshot.audio_track}
                                      </span>
                                    )}
                                    <span className={`ml-2 font-normal ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                      {new Date(render.created_at).toLocaleDateString('en-US', {
                                        month: 'short', day: 'numeric'
                                      })}
                                    </span>
                                  </p>
                                  {render.is_expired && (
                                    <p className="text-xs text-red-400 mt-0.5">Expired</p>
                                  )}
                                </div>
                              </div>

                              {!render.is_expired && render.download_url ? (
                                <a
                                  href={render.download_url}
                                  download
                                  onClick={(e) => e.stopPropagation()}
                                  className={`
                                    p-2 rounded-lg transition-all
                                    ${isDark
                                      ? 'bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25'
                                      : 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100'
                                    }
                                  `}
                                  title="Download this version"
                                >
                                  <Download className="w-4 h-4" />
                                </a>
                              ) : render.is_expired ? (
                                <span className="text-xs text-red-400/70 px-2">Expired</span>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}

                      <p className={`text-xs mt-3 text-center ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                        Renders are available for 30 days
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}


// ============================================
// DELETE CONFIRMATION MODAL
// ============================================
function DeleteConfirmationModal({ project, isDark, onConfirm, onCancel, isDeleting }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className={`
          w-full max-w-md rounded-2xl p-6
          ${isDark
            ? 'bg-gray-900/95 border border-white/15'
            : 'bg-white border border-gray-200'
          }
          backdrop-blur-xl shadow-2xl
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Warning Icon */}
        <div className="flex justify-center mb-4">
          <div className={`
            w-14 h-14 rounded-full flex items-center justify-center
            ${isDark ? 'bg-red-500/15' : 'bg-red-50'}
          `}>
            <AlertTriangle className={`w-7 h-7 ${isDark ? 'text-red-400' : 'text-red-500'}`} />
          </div>
        </div>

        <h3 className={`text-lg font-bold text-center mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Delete Project?
        </h3>

        <p className={`text-center text-sm mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          You are about to delete:
        </p>
        <p className={`
          text-center font-semibold mb-4 px-4 py-2 rounded-xl text-sm
          ${isDark ? 'bg-white/5 text-white' : 'bg-gray-100 text-gray-900'}
        `}>
          &ldquo;{project?.title}&rdquo;
        </p>

        <div className={`
          p-3 rounded-xl mb-5
          ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}
        `}>
          <p className={`text-sm text-center ${isDark ? 'text-red-300' : 'text-red-700'}`}>
            This action cannot be undone. All project data, renders, and associated files will be permanently deleted.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className={`
              flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all
              ${isDark
                ? 'bg-white/10 text-white hover:bg-white/15'
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
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Delete
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

  // Project expansion state - which project card is currently expanded
  const [expandedProjectId, setExpandedProjectId] = useState(null);

  // Render history state
  const [showRenderHistory, setShowRenderHistory] = useState(null);
  const [renderHistory, setRenderHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Delete confirmation state
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);


  // ---- NOTIFICATIONS ----
  const addNotification = useCallback((message, type = 'success') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);

    const duration = type === 'error' ? 10000 : 5000;
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, duration);
  }, []);

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };


  // ---- DATA FETCHING ----
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

  const fetchProjects = useCallback(async (userId, isPolling = false) => {
    try {
      const { data: projectsData } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (projectsData) {
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


  // ---- INITIAL LOAD ----
  useEffect(() => {
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
        await fetchProjects(user.id, false);

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


  // ---- PENDING PLAN CHECKOUT ----
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

      setCheckingPendingPlan(true);
      await new Promise(resolve => setTimeout(resolve, 500));

      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          addNotification('Session not ready. Please click your plan again on the pricing page.', 'error');
          setCheckingPendingPlan(false);
          return;
        }

        // V15 model: checkout is keyed by credits_per_month + billing_cycle.
        // The pending plan value should be a credits amount (50/100/250/500/1000).
        // Clear any stale metadata copy so this can't re-trigger in a loop.
        localStorage.removeItem('karatrack_pending_plan');
        if (user.user_metadata?.pending_plan) {
          supabase.auth.updateUser({ data: { pending_plan: null } }).catch(() => {});
        }

        const creditsPerMonth = parseInt(planToActivate, 10);
        const validCredits = [50, 100, 250, 500, 1000];
        if (!validCredits.includes(creditsPerMonth)) {
          // Unknown/legacy plan format - can't map safely; send to pricing to choose.
          addNotification('Please choose your plan on the pricing page.', 'info');
          setCheckingPendingPlan(false);
          router.push('/pricing');
          return;
        }

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stripe/create-checkout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ credits_per_month: creditsPerMonth, billing_cycle: 'monthly' }),
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


  // ---- QUERY PARAM NOTIFICATIONS ----
  useEffect(() => {
    if (router.query.awaiting_review === 'true') {
      addNotification('Your track is being transcribed. Click "Review Lyrics" when it\'s ready!', 'info');
      router.replace('/dashboard', undefined, { shallow: true });
    }
  }, [router.query.awaiting_review, addNotification, router]);

  useEffect(() => {
    if (router.query.upgraded === 'true') {
      addNotification('Upgrade successful! Your new plan is now active.', 'success');
      router.replace('/dashboard', undefined, { shallow: true });
    }
  }, [router.query.upgraded, addNotification, router]);

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

  useEffect(() => {
    if (router.query.credits_purchased === 'true') {
      addNotification('Credits purchased successfully!', 'success');
      router.replace('/dashboard', undefined, { shallow: true });
    }
  }, [router.query.credits_purchased, addNotification, router]);


  // ---- POLLING ----
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


  // ---- HANDLERS ----
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
        // If the deleted project was expanded, collapse it
        if (expandedProjectId === projectToDelete.id) {
          setExpandedProjectId(null);
        }
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

  const handleToggleHistory = (projectId) => {
    if (showRenderHistory === projectId) {
      setShowRenderHistory(null);
    } else {
      setShowRenderHistory(projectId);
      fetchRenderHistory(projectId);
    }
  };

  const handleRefresh = async () => {
    if (user) {
      await fetchProjects(user.id, false);
      addNotification('Projects refreshed', 'info');
    }
  };

  const handleToggleExpand = (projectId) => {
    setExpandedProjectId(prev => prev === projectId ? null : projectId);
    // Close render history if collapsing
    if (expandedProjectId === projectId) {
      setShowRenderHistory(null);
    }
  };

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


  // ---- LOADING STATE ----
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
            <div className="w-14 h-14 border-[3px] border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>Loading...</p>
          </div>
        </div>
      </>
    );
  }

  const processingCount = projects.filter(p =>
    ['processing', 'transcribing', 'rendering'].includes(p.status)
  ).length;

  // V15: User is "paid" if they have an active subscription OR have ever paid (credit pack purchase)
  const isPaidUser = profile?.has_ever_paid || (profile?.subscription_credits_per_month > 0);


  // ---- RENDER ----
  return (
    <>
      <SEO
        title="Dashboard"
        description="Manage your karaoke projects in Karatrack Studio."
        path="/dashboard"
      />
      <div className={`min-h-screen ${isDark ? 'bg-animated-dark' : 'bg-animated-light'}`}>
        {/* Notification Toasts */}
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full pointer-events-none">
          <AnimatePresence>
            {notifications.map(notification => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, x: 50, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 50, scale: 0.95 }}
                className={`
                  pointer-events-auto
                  flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg backdrop-blur-xl
                  ${notification.type === 'success'
                    ? isDark
                      ? 'bg-emerald-500/15 border border-emerald-500/30'
                      : 'bg-emerald-50 border border-emerald-200'
                    : notification.type === 'error'
                      ? isDark
                        ? 'bg-red-500/15 border border-red-500/30'
                        : 'bg-red-50 border border-red-200'
                      : isDark
                        ? 'bg-cyan-500/15 border border-cyan-500/30'
                        : 'bg-cyan-50 border border-cyan-200'
                  }
                `}
              >
                {notification.type === 'success' && <CheckCircle className={`w-5 h-5 flex-shrink-0 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />}
                {notification.type === 'error' && <AlertCircle className={`w-5 h-5 flex-shrink-0 ${isDark ? 'text-red-400' : 'text-red-500'}`} />}
                {notification.type === 'info' && <Bell className={`w-5 h-5 flex-shrink-0 ${isDark ? 'text-cyan-400' : 'text-cyan-500'}`} />}
                <span className={`text-sm flex-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{notification.message}</span>
                <button
                  onClick={() => removeNotification(notification.id)}
                  className={`ml-1 flex-shrink-0 ${isDark ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-gray-700'} transition-colors`}
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
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {/* Welcome Section */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 sm:mb-8"
          >
            <h1 className={`text-2xl sm:text-3xl font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Welcome back, {profile?.full_name || user?.email?.split('@')[0]}!
            </h1>
            <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Ready to transform some music?</p>
          </motion.div>

          {/* Stats Row */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className={`
              grid grid-cols-3 ${isPaidUser ? 'sm:grid-cols-4' : ''} gap-3 sm:gap-4 mb-6 sm:mb-8
            `}
          >
            {/* Credits */}
            <div className={`
              rounded-2xl p-4 sm:p-5 backdrop-blur-xl
              ${isDark
                ? 'bg-white/[0.04] border border-white/[0.08]'
                : 'bg-white/70 border border-gray-200/80'
              }
            `}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-cyan-500/15' : 'bg-cyan-50'}`}>
                  <Zap className={`w-4 h-4 sm:w-5 sm:h-5 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
                </div>
                <div>
                  <p className={`text-[11px] sm:text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Credits</p>
                  <p className={`text-lg sm:text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{profile?.credits_remaining || 0}</p>
                </div>
              </div>
            </div>

            {/* Projects */}
            <div className={`
              rounded-2xl p-4 sm:p-5 backdrop-blur-xl
              ${isDark
                ? 'bg-white/[0.04] border border-white/[0.08]'
                : 'bg-white/70 border border-gray-200/80'
              }
            `}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-purple-500/15' : 'bg-purple-50'}`}>
                  <FileVideo className={`w-4 h-4 sm:w-5 sm:h-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                </div>
                <div>
                  <p className={`text-[11px] sm:text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Projects</p>
                  <p className={`text-lg sm:text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{projects.length}</p>
                </div>
              </div>
            </div>

            {/* Plan - Gold highlighted card linking to pricing */}
            <Link href="/pricing">
              <div className={`
                rounded-2xl p-4 sm:p-5 backdrop-blur-xl cursor-pointer transition-all duration-200
                ${isDark
                  ? 'bg-gradient-to-br from-amber-500/10 to-yellow-500/5 border-2 border-amber-500/40 hover:border-amber-400/60 hover:shadow-lg hover:shadow-amber-500/10'
                  : 'bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-300 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-200/50'
                }
              `}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-amber-500/20' : 'bg-amber-100'}`}>
                    <Zap className={`w-4 h-4 sm:w-5 sm:h-5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    {profile?.subscription_credits_per_month > 0 ? (
                      <>
                        <p className={`text-[11px] sm:text-xs font-medium ${isDark ? 'text-amber-400/80' : 'text-amber-600/80'}`}>Your Plan</p>
                        <p className={`text-base sm:text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {profile.subscription_credits_per_month} cr/mo
                        </p>
                        <p className={`text-[10px] sm:text-xs ${isDark ? 'text-amber-400/60' : 'text-amber-600/60'} truncate`}>
                          {profile.subscription_billing_cycle === 'annual' ? 'Annual' : 'Monthly'} • Manage
                        </p>
                      </>
                    ) : (
                      <>
                        <p className={`text-[11px] sm:text-xs font-medium ${isDark ? 'text-amber-400/80' : 'text-amber-600/80'}`}>No Plan</p>
                        <p className={`text-sm sm:text-base font-bold ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                          Get More Credits
                        </p>
                        <p className={`text-[10px] sm:text-xs ${isDark ? 'text-amber-400/60' : 'text-amber-600/60'}`}>
                          Subscribe & Save
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Link>

            {/* Help (paid only) */}
            {isPaidUser && (
              <div
                onClick={() => setShowHelpModal(true)}
                className={`
                  rounded-2xl p-4 sm:p-5 backdrop-blur-xl cursor-pointer transition-all duration-200
                  ${isDark
                    ? 'bg-white/[0.04] border border-white/[0.08] hover:border-purple-500/30'
                    : 'bg-white/70 border border-gray-200/80 hover:border-purple-300'
                  }
                  hidden sm:block
                `}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-purple-500/15' : 'bg-purple-50'}`}>
                    <HelpCircle className={`w-4 h-4 sm:w-5 sm:h-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                  </div>
                  <div>
                    <p className={`text-[11px] sm:text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Support</p>
                    <p className={`text-lg sm:text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {profile?.subscription_credits_per_month >= 500 ? 'Priority' : 'Standard'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>

          {/* Upload Zone */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-6 sm:mb-8"
          >
            <div
              className={`
                rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all duration-300 group
                border-2 border-dashed backdrop-blur-xl
                ${isDragging
                  ? isDark
                    ? 'border-cyan-400 bg-cyan-400/10 scale-[1.01]'
                    : 'border-cyan-500 bg-cyan-50 scale-[1.01]'
                  : isDark
                    ? 'border-white/[0.1] bg-white/[0.02] hover:border-cyan-500/40 hover:bg-white/[0.04]'
                    : 'border-gray-300 bg-white/50 hover:border-cyan-400 hover:bg-cyan-50/30'
                }
              `}
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
              <div className={`
                w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center transition-all duration-300
                ${isDragging
                  ? 'bg-cyan-500/20 scale-110'
                  : isDark
                    ? 'bg-gradient-to-br from-cyan-500/15 to-purple-500/15 group-hover:from-cyan-500/25 group-hover:to-purple-500/25'
                    : 'bg-gradient-to-br from-cyan-100 to-purple-100 group-hover:from-cyan-200 group-hover:to-purple-200'
                }
              `}>
                <Upload className={`w-7 h-7 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
              </div>
              <h3 className={`text-lg font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {isDragging ? 'Drop your file here!' : 'Upload New Track'}
              </h3>
              <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                {isDragging ? 'Release to start uploading' : 'Drop your audio file or click to browse'}
              </p>
            </div>
          </motion.div>

          {/* Suggest a Feature */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-6 sm:mb-8"
          >
            <button
              onClick={() => setShowSuggestionModal(true)}
              className={`
                w-full rounded-2xl p-4 sm:p-5 text-left transition-all duration-200 group backdrop-blur-xl
                ${isDark
                  ? 'bg-white/[0.04] border border-white/[0.08] hover:border-amber-500/30 hover:bg-amber-500/[0.04]'
                  : 'bg-white/70 border border-gray-200/80 hover:border-amber-300 hover:bg-amber-50/30'
                }
              `}
            >
              <div className="flex items-center gap-3 sm:gap-4">
                <div className={`
                  w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105
                  ${isDark ? 'bg-amber-500/15' : 'bg-amber-50'}
                `}>
                  <Lightbulb className={`w-5 h-5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Have an idea?
                  </h3>
                  <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                    Suggest a feature and help shape Karatrack Studio
                  </p>
                </div>
                <span className={`text-sm font-medium hidden sm:block ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                  Suggest Feature
                </span>
              </div>
            </button>
          </motion.div>

          {/* ==================== */}
          {/* RECENT PROJECTS LIST */}
          {/* ==================== */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className={`text-lg sm:text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Recent Projects</h2>
                {processingCount > 0 && (
                  <span className={`
                    px-2 py-0.5 text-xs font-medium rounded-full flex items-center gap-1
                    ${isDark
                      ? 'bg-amber-500/15 text-amber-400'
                      : 'bg-amber-50 text-amber-600 border border-amber-200'
                    }
                  `}>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {processingCount}
                  </span>
                )}
              </div>
              <button
                onClick={handleRefresh}
                className={`
                  flex items-center gap-1.5 text-sm font-medium transition-colors
                  ${isDark ? 'text-gray-500 hover:text-cyan-400' : 'text-gray-400 hover:text-cyan-600'}
                `}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>

            {projects.length === 0 ? (
              <div className={`
                rounded-2xl p-10 text-center backdrop-blur-xl
                ${isDark
                  ? 'bg-white/[0.04] border border-white/[0.08]'
                  : 'bg-white/70 border border-gray-200/80'
                }
              `}>
                <FileVideo className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
                <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>No projects yet. Upload your first track!</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {projects.map((project, i) => (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.22 + i * 0.03 }}
                  >
                    <ProjectCard
                      project={project}
                      isDark={isDark}
                      isExpanded={expandedProjectId === project.id}
                      onToggle={() => handleToggleExpand(project.id)}
                      onDownload={handleDownload}
                      onDelete={setProjectToDelete}
                      onRetry={handleRetryProject}
                      downloadingId={downloadingId}
                      renderHistory={renderHistory}
                      loadingHistory={loadingHistory}
                      onToggleHistory={handleToggleHistory}
                      showHistory={showRenderHistory === project.id}
                    />
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
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setShowSuggestionModal(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className={`
                  w-full max-w-lg rounded-2xl p-6 backdrop-blur-xl
                  ${isDark
                    ? 'bg-gray-900/95 border border-white/15'
                    : 'bg-white border border-gray-200'
                  }
                  shadow-2xl
                `}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? 'bg-amber-500/15' : 'bg-amber-50'}`}>
                      <Lightbulb className={`w-5 h-5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                    </div>
                    <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      Suggest a Feature
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowSuggestionModal(false)}
                    className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Form */}
                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Title
                    </label>
                    <input
                      type="text"
                      value={suggestionTitle}
                      onChange={(e) => setSuggestionTitle(e.target.value)}
                      placeholder="Brief title for your idea"
                      maxLength={100}
                      className={`
                        w-full px-4 py-2.5 rounded-xl border text-sm
                        ${isDark
                          ? 'bg-white/5 border-white/15 text-white placeholder-gray-600'
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                        }
                        focus:outline-none focus:border-cyan-500 transition-colors
                      `}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Description
                    </label>
                    <textarea
                      value={suggestionDescription}
                      onChange={(e) => setSuggestionDescription(e.target.value)}
                      placeholder="Describe your feature idea and why it would be useful..."
                      rows={4}
                      maxLength={500}
                      className={`
                        w-full px-4 py-2.5 rounded-xl border resize-none text-sm
                        ${isDark
                          ? 'bg-white/5 border-white/15 text-white placeholder-gray-600'
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                        }
                        focus:outline-none focus:border-cyan-500 transition-colors
                      `}
                    />
                    <p className={`text-xs mt-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                      {suggestionDescription.length}/500 characters
                    </p>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                      Category
                    </label>
                    <select
                      value={suggestionCategory}
                      onChange={(e) => setSuggestionCategory(e.target.value)}
                      className={`
                        w-full px-4 py-2.5 rounded-xl border text-sm
                        ${isDark
                          ? 'bg-white/5 border-white/15 text-white'
                          : 'bg-white border-gray-300 text-gray-900'
                        }
                        focus:outline-none focus:border-cyan-500 transition-colors
                      `}
                    >
                      <option value="feature" className={isDark ? 'bg-gray-900' : 'bg-white'}>New Feature</option>
                      <option value="improvement" className={isDark ? 'bg-gray-900' : 'bg-white'}>Improvement</option>
                      <option value="ui" className={isDark ? 'bg-gray-900' : 'bg-white'}>UI/UX</option>
                      <option value="integration" className={isDark ? 'bg-gray-900' : 'bg-white'}>Integration</option>
                      <option value="other" className={isDark ? 'bg-gray-900' : 'bg-white'}>Other</option>
                    </select>
                  </div>

                  <div className={`
                    p-3 rounded-xl text-sm
                    ${isDark
                      ? 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-300'
                      : 'bg-cyan-50 border border-cyan-200 text-cyan-700'
                    }
                  `}>
                    Your suggestion will be reviewed by our team. Approved ideas will appear on the public roadmap for voting!
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={() => setShowSuggestionModal(false)}
                      className={`
                        flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors
                        ${isDark
                          ? 'bg-white/10 text-white hover:bg-white/15'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }
                      `}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitSuggestion}
                      disabled={submittingSuggestion || !suggestionTitle.trim() || !suggestionDescription.trim()}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
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
