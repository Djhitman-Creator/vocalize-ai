'use client';

/**
 * ShareModal.jsx - QR Code Sharing Component for Karatrack Studio
 * 
 * Features:
 * - Two QR codes: Full Edit (for owner's other devices) and View-Only (for sharing)
 * - Liquid glass theme with dark/light mode support
 * - Copy link buttons
 * - Regenerate token functionality
 * - Toggle for enabling/disabling public sharing
 * 
 * Place this at: frontend/src/components/ShareModal.jsx
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, QrCode, Copy, Check, RefreshCw, Share2, 
  Smartphone, Users, Eye, Edit3, AlertTriangle,
  ExternalLink, Lock, Unlock, Info
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Get base URL for links
const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL || 'https://studio.karatrack.com';
};

export default function ShareModal({ 
  isOpen, 
  onClose, 
  project, 
  isDark,
  onTokensUpdated 
}) {
  // State
  const [editToken, setEditToken] = useState(project?.edit_token || '');
  const [shareToken, setShareToken] = useState(project?.share_token || '');
  const [shareEnabled, setShareEnabled] = useState(project?.share_enabled || false);
  const [copiedEdit, setCopiedEdit] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('edit'); // 'edit' or 'share'

  // Update state when project changes
  useEffect(() => {
    if (project) {
      setEditToken(project.edit_token || '');
      setShareToken(project.share_token || '');
      setShareEnabled(project.share_enabled || false);
    }
  }, [project]);

  // Generate URLs
  const baseUrl = getBaseUrl();
  const editUrl = `${baseUrl}/preview/${project?.id}?token=${editToken}`;
  const shareUrl = `${baseUrl}/share/${project?.id}`;

  // Copy to clipboard
  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'edit') {
        setCopiedEdit(true);
        setTimeout(() => setCopiedEdit(false), 2000);
      } else {
        setCopiedShare(true);
        setTimeout(() => setCopiedShare(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Regenerate edit token
  const regenerateEditToken = async () => {
    if (!project?.id) return;
    
    setRegenerating(true);
    try {
      // Generate new token
      const newToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const { error } = await supabase
        .from('projects')
        .update({ edit_token: newToken })
        .eq('id', project.id);

      if (error) throw error;

      setEditToken(newToken);
      if (onTokensUpdated) {
        onTokensUpdated({ ...project, edit_token: newToken });
      }
    } catch (err) {
      console.error('Failed to regenerate token:', err);
    } finally {
      setRegenerating(false);
    }
  };

  // Toggle share enabled
  const toggleShareEnabled = async () => {
    if (!project?.id) return;
    
    setSaving(true);
    try {
      const newValue = !shareEnabled;
      
      const { error } = await supabase
        .from('projects')
        .update({ share_enabled: newValue })
        .eq('id', project.id);

      if (error) throw error;

      setShareEnabled(newValue);
      if (onTokensUpdated) {
        onTokensUpdated({ ...project, share_enabled: newValue });
      }
    } catch (err) {
      console.error('Failed to toggle sharing:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        
        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className={`relative w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl ${
            isDark 
              ? 'bg-gray-900/90 border border-white/10' 
              : 'bg-white/90 border border-gray-200'
          } backdrop-blur-xl`}
        >
          {/* Liquid glass effect overlay */}
          <div className="absolute inset-0 pointer-events-none">
            <div className={`absolute -top-1/2 -right-1/2 w-full h-full rounded-full blur-3xl ${
              isDark ? 'bg-cyan-500/10' : 'bg-cyan-500/5'
            }`} />
            <div className={`absolute -bottom-1/2 -left-1/2 w-full h-full rounded-full blur-3xl ${
              isDark ? 'bg-purple-500/10' : 'bg-purple-500/5'
            }`} />
          </div>

          {/* Header */}
          <div className={`relative px-6 py-4 border-b ${
            isDark ? 'border-white/10' : 'border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${
                  isDark ? 'bg-cyan-500/20' : 'bg-cyan-500/10'
                }`}>
                  <QrCode className="w-5 h-5 text-cyan-500" />
                </div>
                <div>
                  <h2 className={`text-lg font-semibold ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}>
                    Share Project
                  </h2>
                  <p className={`text-sm ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    {project?.title || 'Untitled'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className={`p-2 rounded-xl transition-colors ${
                  isDark 
                    ? 'hover:bg-white/10 text-gray-400 hover:text-white' 
                    : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Switcher */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setActiveTab('edit')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === 'edit'
                    ? isDark
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'bg-cyan-500/10 text-cyan-600 border border-cyan-500/20'
                    : isDark
                      ? 'bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>Edit on Mobile</span>
              </button>
              <button
                onClick={() => setActiveTab('share')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === 'share'
                    ? isDark
                      ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                      : 'bg-purple-500/10 text-purple-600 border border-purple-500/20'
                    : isDark
                      ? 'bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Share Preview</span>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="relative px-6 py-6">
            <AnimatePresence mode="wait">
              {activeTab === 'edit' ? (
                <motion.div
                  key="edit"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Edit Tab Content */}
                  <div className="flex flex-col items-center">
                    {/* QR Code */}
                    <div className={`p-4 rounded-2xl ${
                      isDark ? 'bg-white' : 'bg-white border border-gray-200'
                    }`}>
                      <QRCodeSVG
                        value={editUrl}
                        size={180}
                        level="M"
                        includeMargin={false}
                        bgColor="#ffffff"
                        fgColor="#000000"
                      />
                    </div>

                    {/* Description */}
                    <div className="mt-4 text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Edit3 className={`w-4 h-4 ${
                          isDark ? 'text-cyan-400' : 'text-cyan-600'
                        }`} />
                        <span className={`font-medium ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}>
                          Full Edit Access
                        </span>
                      </div>
                      <p className={`text-sm ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        Scan this QR code with your phone to continue editing this project with full save capabilities.
                      </p>
                    </div>

                    {/* Warning */}
                    <div className={`mt-4 flex items-start gap-2 p-3 rounded-xl ${
                      isDark ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-yellow-50 border border-yellow-200'
                    }`}>
                      <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                        isDark ? 'text-yellow-400' : 'text-yellow-600'
                      }`} />
                      <p className={`text-xs ${
                        isDark ? 'text-yellow-400' : 'text-yellow-700'
                      }`}>
                        This link grants full edit access. Only share it with your own devices or people you trust completely.
                      </p>
                    </div>

                    {/* URL and Copy Button */}
                    <div className={`mt-4 w-full p-3 rounded-xl ${
                      isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'
                    }`}>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={editUrl}
                          className={`flex-1 text-xs bg-transparent outline-none truncate ${
                            isDark ? 'text-gray-300' : 'text-gray-600'
                          }`}
                        />
                        <button
                          onClick={() => copyToClipboard(editUrl, 'edit')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            copiedEdit
                              ? 'bg-green-500/20 text-green-400'
                              : isDark
                                ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
                                : 'bg-cyan-500/10 text-cyan-600 hover:bg-cyan-500/20'
                          }`}
                        >
                          {copiedEdit ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Regenerate Token Button */}
                    <button
                      onClick={regenerateEditToken}
                      disabled={regenerating}
                      className={`mt-3 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                        isDark
                          ? 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                      } disabled:opacity-50`}
                    >
                      <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
                      {regenerating ? 'Regenerating...' : 'Regenerate Link'}
                    </button>
                    <p className={`mt-2 text-xs ${
                      isDark ? 'text-gray-500' : 'text-gray-400'
                    }`}>
                      This will invalidate the previous edit link
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="share"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Share Tab Content */}
                  <div className="flex flex-col items-center">
                    {/* Enable/Disable Toggle */}
                    <div className={`w-full p-4 rounded-xl mb-4 ${
                      isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {shareEnabled ? (
                            <Unlock className={`w-5 h-5 ${
                              isDark ? 'text-green-400' : 'text-green-600'
                            }`} />
                          ) : (
                            <Lock className={`w-5 h-5 ${
                              isDark ? 'text-gray-400' : 'text-gray-500'
                            }`} />
                          )}
                          <div>
                            <p className={`font-medium ${
                              isDark ? 'text-white' : 'text-gray-900'
                            }`}>
                              Public Sharing
                            </p>
                            <p className={`text-xs ${
                              isDark ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                              {shareEnabled ? 'Anyone with the link can view' : 'Only you can access'}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={toggleShareEnabled}
                          disabled={saving}
                          className={`relative w-12 h-6 rounded-full transition-colors ${
                            shareEnabled
                              ? 'bg-green-500'
                              : isDark ? 'bg-gray-600' : 'bg-gray-300'
                          }`}
                        >
                          <motion.div
                            animate={{ x: shareEnabled ? 24 : 2 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
                          />
                        </button>
                      </div>
                    </div>

                    {shareEnabled ? (
                      <>
                        {/* QR Code */}
                        <div className={`p-4 rounded-2xl ${
                          isDark ? 'bg-white' : 'bg-white border border-gray-200'
                        }`}>
                          <QRCodeSVG
                            value={shareUrl}
                            size={180}
                            level="M"
                            includeMargin={false}
                            bgColor="#ffffff"
                            fgColor="#000000"
                          />
                        </div>

                        {/* Description */}
                        <div className="mt-4 text-center">
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <Eye className={`w-4 h-4 ${
                              isDark ? 'text-purple-400' : 'text-purple-600'
                            }`} />
                            <span className={`font-medium ${
                              isDark ? 'text-white' : 'text-gray-900'
                            }`}>
                              View Only
                            </span>
                          </div>
                          <p className={`text-sm ${
                            isDark ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            Others can preview and experiment with settings, but changes won't be saved.
                          </p>
                        </div>

                        {/* Info Box */}
                        <div className={`mt-4 flex items-start gap-2 p-3 rounded-xl ${
                          isDark ? 'bg-purple-500/10 border border-purple-500/20' : 'bg-purple-50 border border-purple-200'
                        }`}>
                          <Info className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                            isDark ? 'text-purple-400' : 'text-purple-600'
                          }`} />
                          <p className={`text-xs ${
                            isDark ? 'text-purple-400' : 'text-purple-700'
                          }`}>
                            Viewers can play with all features (fonts, colors, timing) but their changes are local only - nothing is saved to your project.
                          </p>
                        </div>

                        {/* URL and Copy Button */}
                        <div className={`mt-4 w-full p-3 rounded-xl ${
                          isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'
                        }`}>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              readOnly
                              value={shareUrl}
                              className={`flex-1 text-xs bg-transparent outline-none truncate ${
                                isDark ? 'text-gray-300' : 'text-gray-600'
                              }`}
                            />
                            <button
                              onClick={() => copyToClipboard(shareUrl, 'share')}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                copiedShare
                                  ? 'bg-green-500/20 text-green-400'
                                  : isDark
                                    ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                                    : 'bg-purple-500/10 text-purple-600 hover:bg-purple-500/20'
                              }`}
                            >
                              {copiedShare ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  Copy
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      /* Disabled State */
                      <div className={`text-center py-8 ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        <Lock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="font-medium mb-1">Sharing is disabled</p>
                        <p className="text-sm">Enable public sharing to generate a QR code for others to view your project.</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className={`relative px-6 py-4 border-t ${
            isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Share2 className={`w-4 h-4 ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`} />
                <span className={`text-xs ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Powered by Karatrack Studio
                </span>
              </div>
              <button
                onClick={onClose}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  isDark
                    ? 'bg-white/10 text-white hover:bg-white/20'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Done
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
