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
  Eye,
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
// This is a reusable dropdown menu that appears when you click
// the three-dot menu (⋮) on each project card
function ProjectActionsDropdown({ 
  project, 
  isDark, 
  onDownload, 
  onDelete, 
  onRetry,
  onViewHistory,
  downloadingId,
  isHistoryOpen 
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
    <div className="relative" ref={dropdownRef}>
      {/* Three-dot menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          p-2.5 rounded-xl transition-all duration-200
          ${isDark 
            ? 'hover:bg-white/10 active:bg-white/20' 
            : 'hover:bg-gray-100 active:bg-gray-200'
          }
          ${isOpen 
            ? isDark ? 'bg-white/10' : 'bg-gray-100' 
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
              absolute right-0 top-full mt-2 z-50 min-w-[200px]
              rounded-2xl overflow-hidden
              ${isDark 
                ? 'bg-gray-900/95 border border-white/10' 
                : 'bg-white/95 border border-gray-200'
              }
              backdrop-blur-xl shadow-2xl
            `}
            style={{
              // Liquid glass effect
              boxShadow: isDark 
                ? '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
                : '0 8px 32px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.8)'
            }}
          >
            <div className="py-2">
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
                      w-full px-4 py-3 flex items-center gap-3 transition-colors
                      ${isDark 
                        ? 'hover:bg-white/10 text-white' 
                        : 'hover:bg-gray-50 text-gray-900'
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
                        w-full px-4 py-3 flex items-center gap-3 transition-colors
                        ${isDark 
                          ? 'hover:bg-white/10 text-white' 
                          : 'hover:bg-gray-50 text-gray-900'
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
                      w-full px-4 py-3 flex items-center gap-3 transition-colors
                      ${isDark 
                        ? 'hover:bg-white/10 text-white' 
                        : 'hover:bg-gray-50 text-gray-900'
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
                  <div className={`my-2 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`} />
                </>
              )}

              {/* AWAITING REVIEW OPTIONS */}
              {isAwaitingReview && (
                <>
                  <Link href={`/preview/${project.id}`}>
                    <button
                      onClick={() => setIsOpen(false)}
                      className={`
                        w-full px-4 py-3 flex items-center gap-3 transition-colors
                        ${isDark 
                          ? 'hover:bg-white/10 text-white' 
                          : 'hover:bg-gray-50 text-gray-900'
                        }
                      `}
                    >
                      <Edit3 className="w-4 h-4 text-purple-400" />
                      <span className="font-medium">Review Lyrics</span>
                    </button>
                  </Link>

                  {/* Divider */}
                  <div className={`my-2 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`} />
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
                      w-full px-4 py-3 flex items-center gap-3 transition-colors
                      ${isDark 
                        ? 'hover:bg-white/10 text-white' 
                        : 'hover:bg-gray-50 text-gray-900'
                      }
                    `}
                  >
                    <RefreshCw className="w-4 h-4 text-orange-400" />
                    <span className="font-medium">Retry Processing</span>
                  </button>

                  {/* Divider */}
                  <div className={`my-2 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`} />
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
                  <div className={`my-2 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`} />
                </>
              )}

              {/* DELETE - always available */}
              <button
                onClick={() => {
                  onDelete(project);
                  setIsOpen(false);
                }}
                className={`
                  w-full px-4 py-3 flex items-center gap-3 transition-colors
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
// It warns them that this action cannot be undone
function DeleteConfirmationModal({ project, isDark, onConfirm, onCancel, isDeleting }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={`
          w-full max-w-md rounded-3xl p-6 
          ${isDark 
            ? 'bg-gray-900/95 border border-white/10' 
            : 'bg-white/95 border border-gray-200'
          }
          backdrop-blur-xl
        `}
        style={{
          boxShadow: isDark 
            ? '0 24px 48px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
            : '0 24px 48px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.8)'
        }}
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
          ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}
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
// STATUS BADGE COMPONENT
// ============================================
// Displays the project status with appropriate styling
function StatusBadge({ status, isDark }) {
  const statusConfig = {
    completed: {
      icon: CheckCircle,
      text: 'Ready',
      color: 'text-green-400',
      bg: isDark ? 'bg-green-500/20' : 'bg-green-100',
      border: isDark ? 'border-green-500/30' : 'border-green-300'
    },
    processing: {
      icon: Loader2,
      text: 'Processing...',
      color: 'text-yellow-400',
      bg: isDark ? 'bg-yellow-500/20' : 'bg-yellow-100',
      border: isDark ? 'border-yellow-500/30' : 'border-yellow-300',
      animate: true
    },
    transcribing: {
      icon: Loader2,
      text: 'Transcribing...',
      color: 'text-blue-400',
      bg: isDark ? 'bg-blue-500/20' : 'bg-blue-100',
      border: isDark ? 'border-blue-500/30' : 'border-blue-300',
      animate: true
    },
    rendering: {
      icon: Loader2,
      text: 'Rendering...',
      color: 'text-cyan-400',
      bg: isDark ? 'bg-cyan-500/20' : 'bg-cyan-100',
      border: isDark ? 'border-cyan-500/30' : 'border-cyan-300',
      animate: true
    },
    awaiting_review: {
      icon: Edit3,
      text: 'Review Lyrics',
      color: 'text-purple-400',
      bg: isDark ? 'bg-purple-500/20' : 'bg-purple-100',
      border: isDark ? 'border-purple-500/30' : 'border-purple-300'
    },
    failed: {
      icon: AlertCircle,
      text: 'Failed',
      color: 'text-red-400',
      bg: isDark ? 'bg-red-500/20' : 'bg-red-100',
      border: isDark ? 'border-red-500/30' : 'border-red-300'
    }
  };

  const config = statusConfig[status] || statusConfig.processing;
  const Icon = config.icon;

  return (
    <div className={`
      inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
      ${config.bg} ${config.color} border ${config.border}
    `}>
      <Icon className={`w-3.5 h-3.5 ${config.animate ? 'animate-spin' : ''}`} />
      <span className="hidden sm:inline">{config.text}</span>
    </div>
  );
}

// ============================================
// PROJECT CARD COMPONENT
// ============================================
// Individual project card with mobile-friendly design
function ProjectCard({
  project,
  isDark,
  onDownload,
  onDelete,
  onRetry,
  onViewHistory,
  downloadingId,
  showRenderHistory,
  renderHistory,
  loadingHistory
}) {
  const isCompleted = project.status === 'completed';
  const isAwaitingReview = project.status === 'awaiting_review';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`
        rounded-2xl p-4 sm:p-5 transition-all duration-300
        ${isDark 
          ? 'bg-white/5 border border-white/10 hover:bg-white/[0.07] hover:border-white/20' 
          : 'bg-white/60 border border-gray-200 hover:bg-white/80 hover:border-gray-300'
        }
        backdrop-blur-xl
      `}
      style={{
        boxShadow: isDark 
          ? '0 4px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.03)'
          : '0 4px 24px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.5)'
      }}
    >
      {/* Main Row - Project Info */}
      <div className="flex items-center gap-4">
        {/* Music Icon */}
        <div className={`
          w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center flex-shrink-0
          ${isDark 
            ? 'bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10' 
            : 'bg-gradient-to-br from-purple-100 to-cyan-100 border border-purple-200'
          }
        `}>
          <Music className={`w-6 h-6 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
        </div>

        {/* Project Info - grows to fill space */}
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {project.title}
          </h3>
          <p className={`text-sm truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {new Date(project.created_at).toLocaleDateString()} • {project.artist_name || 'Unknown Artist'}
          </p>
        </div>

        {/* Status Badge - Hidden on very small screens, replaced by mobile row */}
        <div className="hidden sm:block">
          <StatusBadge status={project.status} isDark={isDark} />
        </div>

        {/* Quick Actions for Completed Projects - Desktop only */}
        {isCompleted && (
          <button
            onClick={() => onDownload(project)}
            disabled={downloadingId === project.id}
            className={`
              hidden md:flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium
              bg-gradient-to-r from-cyan-500 to-purple-500 text-white
              hover:shadow-lg hover:shadow-cyan-500/25 transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {downloadingId === project.id ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="hidden lg:inline">Loading...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span className="hidden lg:inline">Download</span>
              </>
            )}
          </button>
        )}

        {/* Review Button for Awaiting Review - Desktop only */}
        {isAwaitingReview && (
          <Link href={`/preview/${project.id}`}>
            <button className={`
              hidden md:flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium
              bg-gradient-to-r from-purple-500 to-pink-500 text-white
              hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-200
            `}>
              <Edit3 className="w-4 h-4" />
              <span className="hidden lg:inline">Review</span>
            </button>
          </Link>
        )}

        {/* Actions Dropdown - Always visible */}
        <ProjectActionsDropdown
          project={project}
          isDark={isDark}
          onDownload={onDownload}
          onDelete={onDelete}
          onRetry={onRetry}
          onViewHistory={onViewHistory}
          downloadingId={downloadingId}
          isHistoryOpen={showRenderHistory === project.id}
        />
      </div>

      {/* Mobile Status Row - Only visible on small screens */}
      <div className="sm:hidden mt-3 flex items-center justify-between">
        <StatusBadge status={project.status} isDark={isDark} />
        
        {/* Mobile Quick Action */}
        {isCompleted && (
          <button
            onClick={() => onDownload(project)}
            disabled={downloadingId === project.id}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium
              bg-gradient-to-r from-cyan-500 to-purple-500 text-white
              disabled:opacity-50
            `}
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
        {isAwaitingReview && (
          <Link href={`/preview/${project.id}`}>
            <button className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-purple-500 to-pink-500 text-white">
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
            <div className={`
              mt-4 p-4 rounded-xl
              ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}
            `}>
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
                      className={`
                        flex items-center justify-between p-3 rounded-xl
                        ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-white hover:bg-gray-100'}
                        ${render.is_expired ? 'opacity-50' : ''}
                        transition-colors
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`
                          text-xs px-2 py-1 rounded-lg font-medium
                          ${index === 0 
                            ? 'bg-cyan-500/20 text-cyan-400' 
                            : isDark ? 'bg-white/10 text-gray-400' : 'bg-gray-200 text-gray-600'
                          }
                        `}>
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
                          className={`
                            p-2.5 rounded-xl transition-all
                            ${isDark 
                              ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30' 
                              : 'bg-cyan-100 text-cyan-600 hover:bg-cyan-200'
                            }
                          `}
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

  // Toggle render history
  const handleToggleHistory = (projectId) => {
    if (showRenderHistory === projectId) {
      setShowRenderHistory(null);
    } else {
      setShowRenderHistory(projectId);
      fetchRenderHistory(projectId);
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
        // Remove from local state
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

  // Handle download
  const handleDownload = async (project) => {
    try {
      setDownloadingId(project.id);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/projects/${project.id}/download`,
        {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.url) {
          // Open download in new tab
          window.open(data.url, '_blank');
        }
      } else {
        const error = await response.json();
        addNotification(error.error || 'Download failed', 'error');
      }
    } catch (err) {
      addNotification('Failed to download', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  // Fetch projects
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
                  audio.play().catch(() => {});
                } catch (e) {}
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

  // Count processing projects
  const processingCount = projects.filter(p => 
    ['processing', 'transcribing', 'rendering'].includes(p.status)
  ).length;

  // Initial load effect would go here - keeping placeholder for now
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

        // Fetch initial projects
        await fetchProjects(user.id, false);
        
        setLoading(false);
      } catch (err) {
        console.error('Error:', err);
        setLoading(false);
      }
    };

    checkUser();
  }, []);

  // Polling effect
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      fetchProjects(user.id, true);
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [user, fetchProjects]);

  // If still loading, show loading state
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <>
      <SEO 
        title="Dashboard"
        description="Manage your karaoke projects"
      />
      
      <div className={`min-h-screen ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>
        <AppNavigation />
        
        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {/* Recent Projects Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {/* Section Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h2 className={`text-xl sm:text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Recent Projects
                </h2>
                {processingCount > 0 && (
                  <span className={`
                    px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1.5
                    ${isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700'}
                  `}>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {processingCount} processing
                  </span>
                )}
              </div>
              <button
                onClick={() => fetchProjects(user?.id, false)}
                className={`
                  px-3 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2
                  ${isDark 
                    ? 'text-gray-400 hover:text-white hover:bg-white/10' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }
                `}
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>

            {/* Projects List */}
            {projects.length === 0 ? (
              <div className={`
                text-center py-16 rounded-2xl
                ${isDark 
                  ? 'bg-white/5 border border-white/10' 
                  : 'bg-white/60 border border-gray-200'
                }
              `}>
                <Music className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
                <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  No projects yet
                </h3>
                <p className={`mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Upload your first track to get started!
                </p>
                <Link href="/upload">
                  <button className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-medium hover:shadow-lg hover:shadow-cyan-500/25 transition-all">
                    <Upload className="w-4 h-4 inline mr-2" />
                    Upload Track
                  </button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {projects.map(project => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    isDark={isDark}
                    onDownload={handleDownload}
                    onDelete={setProjectToDelete}
                    onRetry={handleRetryProject}
                    onViewHistory={handleToggleHistory}
                    downloadingId={downloadingId}
                    showRenderHistory={showRenderHistory}
                    renderHistory={renderHistory}
                    loadingHistory={loadingHistory}
                  />
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

        {/* Notifications */}
        <div className="fixed bottom-4 right-4 z-50 space-y-2">
          <AnimatePresence>
            {notifications.map(notification => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 100 }}
                className={`
                  px-4 py-3 rounded-xl shadow-lg backdrop-blur-xl flex items-center gap-3 max-w-sm
                  ${notification.type === 'error' 
                    ? isDark ? 'bg-red-500/90' : 'bg-red-500' 
                    : notification.type === 'info'
                    ? isDark ? 'bg-blue-500/90' : 'bg-blue-500'
                    : isDark ? 'bg-green-500/90' : 'bg-green-500'
                  }
                  text-white
                `}
              >
                {notification.type === 'error' ? (
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                ) : notification.type === 'info' ? (
                  <Loader2 className="w-5 h-5 flex-shrink-0 animate-spin" />
                ) : (
                  <CheckCircle className="w-5 h-5 flex-shrink-0" />
                )}
                <span className="text-sm font-medium">{notification.message}</span>
                <button
                  onClick={() => removeNotification(notification.id)}
                  className="ml-auto hover:bg-white/20 rounded-lg p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Help Modal */}
        <HelpModal 
          isOpen={showHelpModal} 
          onClose={() => setShowHelpModal(false)} 
          profile={profile}
        />
      </div>
    </>
  );
}
