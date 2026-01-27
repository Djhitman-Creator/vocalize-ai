'use client';

/**
 * Roadmap Page - Karatrack Studio
 * 
 * Features:
 * - Submit feature suggestions (sent to admin for approval)
 * - View approved suggestions and vote on them
 * - See "In Progress" and "Completed" sections
 * - Admin comments visible on items
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Lightbulb,
  ThumbsUp,
  Clock,
  CheckCircle2,
  Loader2,
  Send,
  MessageSquare,
  ChevronUp,
  Rocket,
  Sparkles,
  AlertCircle,
  X
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { createClient } from '@supabase/supabase-js';
import AppNavigation from '../components/AppNavigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Status badge component
const StatusBadge = ({ status, isDark }) => {
  const statusConfig = {
    pending: { 
      label: 'Under Review', 
      bgClass: 'bg-yellow-500/20', 
      textClass: 'text-yellow-400',
      icon: Clock
    },
    approved: { 
      label: 'Open for Voting', 
      bgClass: 'bg-cyan-500/20', 
      textClass: 'text-cyan-400',
      icon: ThumbsUp
    },
    in_progress: { 
      label: 'In Progress', 
      bgClass: 'bg-purple-500/20', 
      textClass: 'text-purple-400',
      icon: Rocket
    },
    completed: { 
      label: 'Completed', 
      bgClass: 'bg-green-500/20', 
      textClass: 'text-green-400',
      icon: CheckCircle2
    },
    rejected: { 
      label: 'Not Planned', 
      bgClass: 'bg-gray-500/20', 
      textClass: 'text-gray-400',
      icon: X
    }
  };

  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${config.bgClass} ${config.textClass}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
};

// Suggestion card component
const SuggestionCard = ({ suggestion, isDark, onVote, userVoted, currentUser }) => {
  const [isVoting, setIsVoting] = useState(false);

  const handleVote = async () => {
    if (!currentUser) {
      // Redirect to login if not logged in
      return;
    }
    setIsVoting(true);
    await onVote(suggestion.id, !userVoted);
    setIsVoting(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-5 rounded-xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'} hover:border-cyan-500/30 transition-all`}
    >
      <div className="flex gap-4">
        {/* Vote button */}
        <div className="flex flex-col items-center">
          <button
            onClick={handleVote}
            disabled={isVoting || !currentUser || suggestion.status !== 'approved'}
            className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center transition-all ${
              userVoted 
                ? 'bg-cyan-500 text-white' 
                : isDark 
                  ? 'bg-white/10 text-gray-400 hover:bg-cyan-500/20 hover:text-cyan-400' 
                  : 'bg-gray-100 text-gray-500 hover:bg-cyan-100 hover:text-cyan-600'
            } ${(!currentUser || suggestion.status !== 'approved') ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={!currentUser ? 'Login to vote' : userVoted ? 'Remove vote' : 'Vote for this feature'}
          >
            {isVoting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <ChevronUp className="w-5 h-5" />
                <span className="text-xs font-bold">{suggestion.vote_count || 0}</span>
              </>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {suggestion.title}
            </h3>
            <StatusBadge status={suggestion.status} isDark={isDark} />
          </div>
          
          <p className={`text-sm mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {suggestion.description}
          </p>

          {/* Admin comment */}
          {suggestion.admin_comment && (
            <div className={`mt-3 p-3 rounded-lg ${isDark ? 'bg-cyan-500/10 border border-cyan-500/20' : 'bg-cyan-50 border border-cyan-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="w-4 h-4 text-cyan-500" />
                <span className={`text-xs font-medium ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
                  Team Response
                </span>
              </div>
              <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {suggestion.admin_comment}
              </p>
            </div>
          )}

          {/* Meta info */}
          <div className={`mt-3 flex items-center gap-4 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            <span>Suggested {new Date(suggestion.created_at).toLocaleDateString()}</span>
            {suggestion.category && (
              <span className={`px-2 py-0.5 rounded ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}>
                {suggestion.category}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default function RoadmapPage() {
  const router = useRouter();
  const { isDark } = useTheme();

  // Auth state
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Suggestions state
  const [suggestions, setSuggestions] = useState([]);
  const [userVotes, setUserVotes] = useState(new Set());
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);

  // New suggestion form
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState('feature');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Filter state
  const [activeTab, setActiveTab] = useState('voting');

  // Categories for suggestions
  const categories = [
    { value: 'feature', label: 'New Feature' },
    { value: 'improvement', label: 'Improvement' },
    { value: 'ui', label: 'UI/UX' },
    { value: 'integration', label: 'Integration' },
    { value: 'other', label: 'Other' }
  ];

  // Check auth
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setCurrentUser(session?.user || null);
      } catch (err) {
        console.error('Auth error:', err);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setCurrentUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load suggestions
  useEffect(() => {
    loadSuggestions();
  }, [currentUser]);

  const loadSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      // Fetch all non-pending suggestions (approved, in_progress, completed)
      const { data, error } = await supabase
        .from('roadmap_suggestions')
        .select('*')
        .in('status', ['approved', 'in_progress', 'completed'])
        .order('vote_count', { ascending: false });

      if (error) throw error;
      setSuggestions(data || []);

      // If user is logged in, fetch their votes
      if (currentUser) {
        const { data: votes, error: votesError } = await supabase
          .from('roadmap_votes')
          .select('suggestion_id')
          .eq('user_id', currentUser.id);

        if (!votesError && votes) {
          setUserVotes(new Set(votes.map(v => v.suggestion_id)));
        }
      }
    } catch (err) {
      console.error('Error loading suggestions:', err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Handle vote
  const handleVote = async (suggestionId, addVote) => {
    if (!currentUser) return;

    try {
      if (addVote) {
        // Add vote
        const { error } = await supabase
          .from('roadmap_votes')
          .insert({
            suggestion_id: suggestionId,
            user_id: currentUser.id
          });

        if (error) throw error;

        // Update local state
        setUserVotes(prev => new Set([...prev, suggestionId]));
        setSuggestions(prev => prev.map(s => 
          s.id === suggestionId ? { ...s, vote_count: (s.vote_count || 0) + 1 } : s
        ));
      } else {
        // Remove vote
        const { error } = await supabase
          .from('roadmap_votes')
          .delete()
          .eq('suggestion_id', suggestionId)
          .eq('user_id', currentUser.id);

        if (error) throw error;

        // Update local state
        setUserVotes(prev => {
          const newSet = new Set(prev);
          newSet.delete(suggestionId);
          return newSet;
        });
        setSuggestions(prev => prev.map(s => 
          s.id === suggestionId ? { ...s, vote_count: Math.max((s.vote_count || 0) - 1, 0) } : s
        ));
      }
    } catch (err) {
      console.error('Vote error:', err);
    }
  };

  // Submit new suggestion
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
      router.push('/login?redirect=/roadmap');
      return;
    }

    if (!newTitle.trim() || !newDescription.trim()) {
      setSubmitError('Please fill in all fields');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const { error } = await supabase
        .from('roadmap_suggestions')
        .insert({
          title: newTitle.trim(),
          description: newDescription.trim(),
          category: newCategory,
          user_id: currentUser.id,
          user_email: currentUser.email,
          status: 'pending', // Requires admin approval
          vote_count: 0
        });

      if (error) throw error;

      setSubmitSuccess(true);
      setNewTitle('');
      setNewDescription('');
      setNewCategory('feature');
      
      // Hide form after 2 seconds
      setTimeout(() => {
        setShowForm(false);
        setSubmitSuccess(false);
      }, 2000);
    } catch (err) {
      console.error('Submit error:', err);
      setSubmitError('Failed to submit suggestion. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter suggestions by tab
  const filteredSuggestions = suggestions.filter(s => {
    if (activeTab === 'voting') return s.status === 'approved';
    if (activeTab === 'in_progress') return s.status === 'in_progress';
    if (activeTab === 'completed') return s.status === 'completed';
    return true;
  });

  // Count by status
  const votingCount = suggestions.filter(s => s.status === 'approved').length;
  const inProgressCount = suggestions.filter(s => s.status === 'in_progress').length;
  const completedCount = suggestions.filter(s => s.status === 'completed').length;

  return (
    <div className={`min-h-screen ${isDark ? 'bg-animated-dark' : 'bg-animated-light'}`}>
      <AppNavigation />

      <main className="pt-24 pb-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/30 mb-6">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span className="text-cyan-400 text-sm font-medium">Community Driven</span>
            </div>
            
            <h1 className={`text-3xl sm:text-4xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Product Roadmap
            </h1>
            <p className={`text-lg max-w-2xl mx-auto ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Help shape the future of Karatrack Studio. Vote on features you want to see or suggest new ideas!
            </p>
          </motion.div>

          {/* Suggest Feature Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            {!showForm ? (
              <button
                onClick={() => {
                  if (!currentUser) {
                    router.push('/login?redirect=/roadmap');
                    return;
                  }
                  setShowForm(true);
                }}
                className="w-full p-4 rounded-xl border-2 border-dashed border-cyan-500/30 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all flex items-center justify-center gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                  <Lightbulb className="w-5 h-5 text-cyan-400" />
                </div>
                <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Suggest a Feature
                </span>
              </button>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`p-6 rounded-xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'}`}
              >
                {submitSuccess ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8 text-green-400" />
                    </div>
                    <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      Thank You!
                    </h3>
                    <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                      Your suggestion has been submitted for review. Our team will review it shortly.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        Suggest a Feature
                      </h3>
                      <button
                        type="button"
                        onClick={() => setShowForm(false)}
                        className={`p-2 rounded-lg ${isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {submitError && (
                      <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400" />
                        <span className="text-sm text-red-400">{submitError}</span>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          Title
                        </label>
                        <input
                          type="text"
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          placeholder="Brief title for your feature idea"
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
                          value={newDescription}
                          onChange={(e) => setNewDescription(e.target.value)}
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
                          {newDescription.length}/500 characters
                        </p>
                      </div>

                      <div>
                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          Category
                        </label>
                        <select
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value)}
                          className={`w-full px-4 py-3 rounded-lg border ${
                            isDark 
                              ? 'bg-white/5 border-white/20 text-white' 
                              : 'bg-white border-gray-300 text-gray-900'
                          } focus:outline-none focus:border-cyan-500`}
                        >
                          {categories.map(cat => (
                            <option key={cat.value} value={cat.value} className={isDark ? 'bg-gray-900' : 'bg-white'}>
                              {cat.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className={`p-3 rounded-lg ${isDark ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-yellow-50 border border-yellow-200'}`}>
                        <p className={`text-sm ${isDark ? 'text-yellow-300' : 'text-yellow-700'}`}>
                          Note: All suggestions are reviewed by our team before being added to the public roadmap for voting.
                        </p>
                      </div>

                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setShowForm(false)}
                          className={`flex-1 px-4 py-3 rounded-lg font-medium ${
                            isDark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          } transition-colors`}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={submitting || !newTitle.trim() || !newDescription.trim()}
                          className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {submitting ? (
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
                  </form>
                )}
              </motion.div>
            )}
          </motion.div>

          {/* Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex gap-2 mb-6 overflow-x-auto pb-2"
          >
            <button
              onClick={() => setActiveTab('voting')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                activeTab === 'voting'
                  ? 'bg-cyan-500 text-white'
                  : isDark 
                    ? 'bg-white/10 text-gray-400 hover:bg-white/20' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <ThumbsUp className="w-4 h-4" />
              Open for Voting
              {votingCount > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'voting' ? 'bg-white/20' : 'bg-cyan-500/20 text-cyan-400'}`}>
                  {votingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('in_progress')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                activeTab === 'in_progress'
                  ? 'bg-purple-500 text-white'
                  : isDark 
                    ? 'bg-white/10 text-gray-400 hover:bg-white/20' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Rocket className="w-4 h-4" />
              In Progress
              {inProgressCount > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'in_progress' ? 'bg-white/20' : 'bg-purple-500/20 text-purple-400'}`}>
                  {inProgressCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                activeTab === 'completed'
                  ? 'bg-green-500 text-white'
                  : isDark 
                    ? 'bg-white/10 text-gray-400 hover:bg-white/20' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              Completed
              {completedCount > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'completed' ? 'bg-white/20' : 'bg-green-500/20 text-green-400'}`}>
                  {completedCount}
                </span>
              )}
            </button>
          </motion.div>

          {/* Suggestions List */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {loadingSuggestions ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mb-4" />
                <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>Loading roadmap...</p>
              </div>
            ) : filteredSuggestions.length === 0 ? (
              <div className={`text-center py-16 rounded-xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                {activeTab === 'voting' && (
                  <>
                    <ThumbsUp className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
                    <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      No Features Open for Voting
                    </h3>
                    <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                      Be the first to suggest a feature! Click the button above to submit your idea.
                    </p>
                  </>
                )}
                {activeTab === 'in_progress' && (
                  <>
                    <Rocket className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
                    <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      Nothing In Progress Yet
                    </h3>
                    <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                      Features with the most votes will be picked up for development.
                    </p>
                  </>
                )}
                {activeTab === 'completed' && (
                  <>
                    <CheckCircle2 className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
                    <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      No Completed Features Yet
                    </h3>
                    <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                      Completed features will appear here. Stay tuned!
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                  {filteredSuggestions.map((suggestion) => (
                    <SuggestionCard
                      key={suggestion.id}
                      suggestion={suggestion}
                      isDark={isDark}
                      onVote={handleVote}
                      userVoted={userVotes.has(suggestion.id)}
                      currentUser={currentUser}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>

          {/* Login prompt for non-authenticated users */}
          {!currentUser && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className={`mt-8 p-6 rounded-xl border text-center ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}
            >
              <p className={`mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Sign in to vote on features and submit your own suggestions!
              </p>
              <Link href="/login?redirect=/roadmap">
                <button className="px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-medium hover:opacity-90 transition-opacity">
                  Sign In to Participate
                </button>
              </Link>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}