'use client';

/**
 * Admin Dashboard - Karatrack Studio
 * 
 * Features:
 * - Search users by email
 * - View/add credits
 * - Export mailing list CSV
 * - Manage mailing list opt-outs
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Search,
  Users,
  CreditCard,
  Mail,
  Download,
  Plus,
  Loader2,
  CheckCircle,
  AlertCircle,
  Shield,
  UserX,
  RefreshCw,
  Zap,
  Calendar,
  DollarSign,
  Trash2,
  AlertTriangle,
  Lightbulb,
  ThumbsUp,
  Clock,
  Rocket,
  CheckCircle2,
  X,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Eye
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Admin emails that can access this page
const ADMIN_EMAILS = [
  'jboyte72@gmail.com',
  'djhitman72@gmail.com',
  'agent@karatrack.com'
];

// Status configuration for roadmap
const STATUS_CONFIG = {
  pending: { label: 'Pending Review', color: 'yellow', icon: Clock },
  approved: { label: 'Open for Voting', color: 'cyan', icon: ThumbsUp },
  in_progress: { label: 'In Progress', color: 'purple', icon: Rocket },
  completed: { label: 'Completed', color: 'green', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'red', icon: X }
};

export default function AdminPage() {
  const router = useRouter();
  const { isDark } = useTheme();

  // Auth state
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  // Search state
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);

  // Credit grant state
  const [creditAmount, setCreditAmount] = useState(10);
  const [creditReason, setCreditReason] = useState('Customer support credit');
  const [granting, setGranting] = useState(false);

  // Users list state
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userStats, setUserStats] = useState({ total: 0, subscribed: 0, optedOut: 0 });

  // Messages
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Delete user state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Roadmap state
  const [roadmapSuggestions, setRoadmapSuggestions] = useState([]);
  const [loadingRoadmap, setLoadingRoadmap] = useState(false);
  const [roadmapFilter, setRoadmapFilter] = useState('pending');
  const [expandedSuggestion, setExpandedSuggestion] = useState(null);
  const [adminComment, setAdminComment] = useState('');
  const [savingComment, setSavingComment] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [roadmapStats, setRoadmapStats] = useState({
    pending: 0,
    approved: 0,
    in_progress: 0,
    completed: 0,
    rejected: 0
  });

  // Check admin access
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          router.push('/login');
          return;
        }

        setCurrentUser(session.user);

        if (ADMIN_EMAILS.includes(session.user.email)) {
          setIsAdmin(true);
          loadUsers();
          loadRoadmapSuggestions();
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.error('Auth error:', err);
      } finally {
        setLoading(false);
      }
    };

    checkAdmin();
  }, [router]);

  // Load all users
  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, credits_remaining, subscription_tier, mailing_list_opt_out, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setUsers(data || []);
      
      // Calculate stats
      const total = data?.length || 0;
      const optedOut = data?.filter(u => u.mailing_list_opt_out).length || 0;
      setUserStats({
        total,
        subscribed: total - optedOut,
        optedOut
      });
    } catch (err) {
      console.error('Error loading users:', err);
      setErrorMessage('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  // Load roadmap suggestions
  const loadRoadmapSuggestions = async () => {
    setLoadingRoadmap(true);
    try {
      const { data, error } = await supabase
        .from('roadmap_suggestions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRoadmapSuggestions(data || []);

      // Calculate stats
      const stats = {
        pending: 0,
        approved: 0,
        in_progress: 0,
        completed: 0,
        rejected: 0
      };
      (data || []).forEach(s => {
        if (stats.hasOwnProperty(s.status)) {
          stats[s.status]++;
        }
      });
      setRoadmapStats(stats);
    } catch (err) {
      console.error('Error loading roadmap:', err);
    } finally {
      setLoadingRoadmap(false);
    }
  };

  // Search user by email
  const handleSearch = async () => {
    if (!searchEmail.trim()) return;

    setSearching(true);
    setSearchResult(null);
    setErrorMessage('');

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('email', `%${searchEmail.trim()}%`)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        // Get credit batches
        const { data: batches } = await supabase
          .from('credit_batches')
          .select('*')
          .eq('user_id', data.id)
          .order('created_at', { ascending: false })
          .limit(5);

        // Get project count
        const { count: projectCount } = await supabase
          .from('projects')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', data.id);

        setSearchResult({
          ...data,
          credit_batches: batches || [],
          project_count: projectCount || 0
        });
      } else {
        setErrorMessage('User not found');
      }
    } catch (err) {
      console.error('Search error:', err);
      setErrorMessage('Search failed: ' + err.message);
    } finally {
      setSearching(false);
    }
  };

  // Grant credits to user
  const handleGrantCredits = async () => {
    if (!searchResult || creditAmount <= 0) return;

    setGranting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      // Insert credit batch
      const { error: batchError } = await supabase
        .from('credit_batches')
        .insert({
          user_id: searchResult.id,
          original_amount: creditAmount,
          remaining_amount: creditAmount,
          source: 'admin_grant',
          description: creditReason,
          expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
        });

      if (batchError) throw batchError;

      // Update profile credits
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          credits_remaining: (searchResult.credits_remaining || 0) + creditAmount 
        })
        .eq('id', searchResult.id);

      if (profileError) throw profileError;

      setSuccessMessage(`Successfully added ${creditAmount} credits to ${searchResult.email}`);
      
      // Refresh search result
      handleSearch();
    } catch (err) {
      console.error('Grant error:', err);
      setErrorMessage('Failed to grant credits: ' + err.message);
    } finally {
      setGranting(false);
    }
  };

  // Toggle mailing list opt-out
  const handleToggleOptOut = async (userId, currentStatus) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ mailing_list_opt_out: !currentStatus })
        .eq('id', userId);

      if (error) throw error;

      // Refresh users
      loadUsers();
      
      // Refresh search result if it's the same user
      if (searchResult?.id === userId) {
        handleSearch();
      }

      setSuccessMessage(`User ${!currentStatus ? 'removed from' : 'added to'} mailing list`);
    } catch (err) {
      console.error('Opt-out toggle error:', err);
      setErrorMessage('Failed to update: ' + err.message);
    }
  };

  // Export mailing list CSV
  const handleExportCSV = () => {
    const subscribedUsers = users.filter(u => !u.mailing_list_opt_out && u.email);
    
    const csvContent = [
      ['Email', 'Subscription Tier', 'Credits', 'Joined'].join(','),
      ...subscribedUsers.map(u => [
        u.email,
        u.subscription_tier || 'free',
        u.credits_remaining || 0,
        new Date(u.created_at).toLocaleDateString()
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `karatrack-mailing-list-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    setSuccessMessage(`Exported ${subscribedUsers.length} emails to CSV`);
  };

  // Export for Mailchimp (specific format)
  const handleExportMailchimp = () => {
    const subscribedUsers = users.filter(u => !u.mailing_list_opt_out && u.email);
    
    const csvContent = [
      ['Email Address', 'First Name', 'Last Name', 'TIER', 'CREDITS', 'JOINED'].join(','),
      ...subscribedUsers.map(u => {
        const nameParts = (u.full_name || '').split(' ');
        return [
          u.email,
          nameParts[0] || '',
          nameParts.slice(1).join(' ') || '',
          u.subscription_tier || 'free',
          u.credits_remaining || 0,
          new Date(u.created_at).toLocaleDateString()
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `karatrack-mailchimp-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    setSuccessMessage(`Exported ${subscribedUsers.length} emails in Mailchimp format`);
  };

  // Delete user completely (GDPR compliance)
  const handleDeleteUser = async () => {
    if (!searchResult) return;
    
    // Verify email confirmation matches
    if (deleteConfirmEmail !== searchResult.email) {
      setErrorMessage('Email confirmation does not match');
      return;
    }

    setDeleting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Call backend API to delete user
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/delete-user`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          user_id: searchResult.id,
          email: searchResult.email
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }

      setSuccessMessage(`Successfully deleted user ${searchResult.email} and all associated data`);
      setSearchResult(null);
      setSearchEmail('');
      setShowDeleteConfirm(false);
      setDeleteConfirmEmail('');
      
      // Refresh user list
      loadUsers();

    } catch (err) {
      console.error('Delete user error:', err);
      setErrorMessage('Failed to delete user: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  // Update roadmap suggestion status
  const handleUpdateSuggestionStatus = async (suggestionId, newStatus) => {
    setUpdatingStatus(suggestionId);
    try {
      const { error } = await supabase
        .from('roadmap_suggestions')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', suggestionId);

      if (error) throw error;

      setSuccessMessage(`Suggestion status updated to "${STATUS_CONFIG[newStatus]?.label || newStatus}"`);
      loadRoadmapSuggestions();
    } catch (err) {
      console.error('Status update error:', err);
      setErrorMessage('Failed to update status: ' + err.message);
    } finally {
      setUpdatingStatus(null);
    }
  };

  // Save admin comment on suggestion
  const handleSaveComment = async (suggestionId) => {
    setSavingComment(true);
    try {
      const { error } = await supabase
        .from('roadmap_suggestions')
        .update({ 
          admin_comment: adminComment,
          updated_at: new Date().toISOString()
        })
        .eq('id', suggestionId);

      if (error) throw error;

      setSuccessMessage('Comment saved successfully');
      setAdminComment('');
      setExpandedSuggestion(null);
      loadRoadmapSuggestions();
    } catch (err) {
      console.error('Comment save error:', err);
      setErrorMessage('Failed to save comment: ' + err.message);
    } finally {
      setSavingComment(false);
    }
  };

  // Delete roadmap suggestion
  const handleDeleteSuggestion = async (suggestionId) => {
    if (!confirm('Are you sure you want to delete this suggestion? This action cannot be undone.')) {
      return;
    }

    try {
      // First delete any votes for this suggestion
      await supabase
        .from('roadmap_votes')
        .delete()
        .eq('suggestion_id', suggestionId);

      // Then delete the suggestion
      const { error } = await supabase
        .from('roadmap_suggestions')
        .delete()
        .eq('id', suggestionId);

      if (error) throw error;

      setSuccessMessage('Suggestion deleted successfully');
      loadRoadmapSuggestions();
    } catch (err) {
      console.error('Delete suggestion error:', err);
      setErrorMessage('Failed to delete suggestion: ' + err.message);
    }
  };

  // Filter roadmap suggestions
  const filteredSuggestions = roadmapSuggestions.filter(s => {
    if (roadmapFilter === 'all') return true;
    return s.status === roadmapFilter;
  });

  // Loading state
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-animated-dark' : 'bg-animated-light'}`}>
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  // Not admin
  if (!isAdmin) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center ${isDark ? 'bg-animated-dark' : 'bg-animated-light'}`}>
        <Shield className="w-16 h-16 text-red-400 mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-gray-400 mb-6">You don't have permission to access this page.</p>
        <Link href="/dashboard" className="text-cyan-400 hover:underline">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-animated-dark' : 'bg-animated-light'}`}>
      {/* Navigation */}
      <nav className="border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
              <span>Dashboard</span>
            </Link>
            <div className="h-6 w-px bg-white/20" />
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-cyan-400" />
              <h1 className="text-xl font-bold text-white">Admin Panel</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/roadmap" className="text-cyan-400 hover:text-cyan-300 text-sm flex items-center gap-1">
              <Eye className="w-4 h-4" />
              View Public Roadmap
            </Link>
            <span className="text-sm text-gray-400">{currentUser?.email}</span>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Messages */}
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-xl flex items-center gap-3"
          >
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-green-400">{successMessage}</span>
            <button onClick={() => setSuccessMessage('')} className="ml-auto text-green-400 hover:text-green-300">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-400">{errorMessage}</span>
            <button onClick={() => setErrorMessage('')} className="ml-auto text-red-400 hover:text-red-300">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className={`glass-panel p-6 ${isDark ? 'bg-white/5' : 'bg-white/80'}`}>
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-cyan-400" />
              <span className="text-gray-400">Total Users</span>
            </div>
            <p className="text-3xl font-bold text-white">{userStats.total}</p>
          </div>
          <div className={`glass-panel p-6 ${isDark ? 'bg-white/5' : 'bg-white/80'}`}>
            <div className="flex items-center gap-3 mb-2">
              <Mail className="w-5 h-5 text-green-400" />
              <span className="text-gray-400">Mailing List</span>
            </div>
            <p className="text-3xl font-bold text-white">{userStats.subscribed}</p>
          </div>
          <div className={`glass-panel p-6 ${isDark ? 'bg-white/5' : 'bg-white/80'}`}>
            <div className="flex items-center gap-3 mb-2">
              <Lightbulb className="w-5 h-5 text-yellow-400" />
              <span className="text-gray-400">Pending Suggestions</span>
            </div>
            <p className="text-3xl font-bold text-white">{roadmapStats.pending}</p>
          </div>
          <div className={`glass-panel p-6 ${isDark ? 'bg-white/5' : 'bg-white/80'}`}>
            <div className="flex items-center gap-3 mb-2">
              <Rocket className="w-5 h-5 text-purple-400" />
              <span className="text-gray-400">In Progress</span>
            </div>
            <p className="text-3xl font-bold text-white">{roadmapStats.in_progress}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* User Search & Credit Management */}
          <div className={`glass-panel p-6 ${isDark ? 'bg-white/5' : 'bg-white/80'}`}>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Search className="w-5 h-5 text-cyan-400" />
              User Search & Credits
            </h2>

            {/* Search */}
            <div className="flex gap-2 mb-6">
              <input
                type="email"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search by email..."
                className="flex-1 px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={handleSearch}
                disabled={searching}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg text-white font-medium transition-colors disabled:opacity-50"
              >
                {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              </button>
            </div>

            {/* Search Result */}
            {searchResult && (
              <div className="space-y-4">
                <div className={`p-4 rounded-xl ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-white font-medium">{searchResult.email}</p>
                      <p className="text-sm text-gray-400">ID: {searchResult.id.slice(0, 8)}...</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      searchResult.subscription_tier === 'studio' ? 'bg-purple-500/20 text-purple-400' :
                      searchResult.subscription_tier === 'pro' ? 'bg-cyan-500/20 text-cyan-400' :
                      searchResult.subscription_tier === 'starter' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {searchResult.subscription_tier || 'free'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500">Credits</p>
                      <p className="text-lg font-bold text-cyan-400">{searchResult.credits_remaining || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Projects</p>
                      <p className="text-lg font-bold text-white">{searchResult.project_count}</p>
                    </div>
                  </div>

                  {/* Mailing List Status */}
                  <div className="flex items-center justify-between py-2 border-t border-white/10">
                    <span className="text-sm text-gray-400">Mailing List</span>
                    <button
                      onClick={() => handleToggleOptOut(searchResult.id, searchResult.mailing_list_opt_out)}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                        searchResult.mailing_list_opt_out
                          ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                          : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                      }`}
                    >
                      {searchResult.mailing_list_opt_out ? 'Opted Out' : 'Subscribed'}
                    </button>
                  </div>

                  {/* Delete User Button */}
                  <div className="flex items-center justify-between py-2 border-t border-white/10">
                    <span className="text-sm text-gray-400">Danger Zone</span>
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="px-3 py-1 rounded text-xs font-medium transition-colors bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete User
                    </button>
                  </div>
                </div>

                {/* Grant Credits */}
                <div className={`p-4 rounded-xl ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
                  <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-green-400" />
                    Grant Credits
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-500">Amount</label>
                      <input
                        type="number"
                        value={creditAmount}
                        onChange={(e) => setCreditAmount(parseInt(e.target.value) || 0)}
                        min="1"
                        className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Reason</label>
                      <input
                        type="text"
                        value={creditReason}
                        onChange={(e) => setCreditReason(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <button
                      onClick={handleGrantCredits}
                      disabled={granting || creditAmount <= 0}
                      className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {granting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Zap className="w-4 h-4" />
                          Grant {creditAmount} Credits
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Recent Credit History */}
                {searchResult.credit_batches?.length > 0 && (
                  <div className={`p-4 rounded-xl ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
                    <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-purple-400" />
                      Recent Credit History
                    </h3>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {searchResult.credit_batches.map((batch) => (
                        <div key={batch.id} className="flex items-center justify-between text-sm">
                          <div>
                            <span className="text-gray-400">{batch.source}</span>
                            {batch.description && (
                              <span className="text-gray-500 text-xs ml-2">({batch.description})</span>
                            )}
                          </div>
                          <span className="text-cyan-400 font-medium">+{batch.original_amount}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mailing List Export */}
          <div className={`glass-panel p-6 ${isDark ? 'bg-white/5' : 'bg-white/80'}`}>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-cyan-400" />
              Mailing List Management
            </h2>

            <div className="space-y-4">
              {/* Export Buttons */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={handleExportCSV}
                  className="p-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 transition-colors text-left"
                >
                  <Download className="w-6 h-6 text-green-400 mb-2" />
                  <p className="text-white font-medium">Export CSV</p>
                  <p className="text-xs text-gray-400">Basic format</p>
                </button>
                <button
                  onClick={handleExportMailchimp}
                  className="p-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 transition-colors text-left"
                >
                  <Download className="w-6 h-6 text-yellow-400 mb-2" />
                  <p className="text-white font-medium">Mailchimp CSV</p>
                  <p className="text-xs text-gray-400">Ready to import</p>
                </button>
              </div>

              {/* Instructions */}
              <div className={`p-4 rounded-xl ${isDark ? 'bg-cyan-500/10' : 'bg-cyan-100'} border border-cyan-500/30`}>
                <h3 className="text-cyan-400 font-medium mb-2">Mailchimp Integration</h3>
                <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
                  <li>Export using "Mailchimp CSV" button</li>
                  <li>Go to Mailchimp → Audience → Import contacts</li>
                  <li>Upload the CSV file</li>
                  <li>Map fields: Email Address, TIER, CREDITS, JOINED</li>
                  <li>Use TIER field to segment by subscription level</li>
                </ol>
              </div>

              {/* Users List Preview */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-medium">Recent Users</h3>
                  <button
                    onClick={loadUsers}
                    disabled={loadingUsers}
                    className="text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingUsers ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {users.slice(0, 10).map((user) => (
                    <div
                      key={user.id}
                      className={`flex items-center justify-between p-2 rounded-lg ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${user.mailing_list_opt_out ? 'bg-red-400' : 'bg-green-400'}`} />
                        <span className="text-sm text-gray-300 truncate max-w-[200px]">{user.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          user.subscription_tier === 'studio' ? 'bg-purple-500/20 text-purple-400' :
                          user.subscription_tier === 'pro' ? 'bg-cyan-500/20 text-cyan-400' :
                          user.subscription_tier === 'starter' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {user.subscription_tier || 'free'}
                        </span>
                        <button
                          onClick={() => {
                            setSearchEmail(user.email);
                            handleSearch();
                          }}
                          className="text-cyan-400 hover:text-cyan-300 text-xs"
                        >
                          View
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Roadmap Management Section */}
        <div className={`glass-panel p-6 mt-8 ${isDark ? 'bg-white/5' : 'bg-white/80'}`}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-400" />
              Roadmap Management
            </h2>
            <button
              onClick={loadRoadmapSuggestions}
              disabled={loadingRoadmap}
              className="text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${loadingRoadmap ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setRoadmapFilter('pending')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                roadmapFilter === 'pending'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
              }`}
            >
              <Clock className="w-4 h-4" />
              Pending ({roadmapStats.pending})
            </button>
            <button
              onClick={() => setRoadmapFilter('approved')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                roadmapFilter === 'approved'
                  ? 'bg-cyan-500 text-white'
                  : 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
              }`}
            >
              <ThumbsUp className="w-4 h-4" />
              Voting ({roadmapStats.approved})
            </button>
            <button
              onClick={() => setRoadmapFilter('in_progress')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                roadmapFilter === 'in_progress'
                  ? 'bg-purple-500 text-white'
                  : 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
              }`}
            >
              <Rocket className="w-4 h-4" />
              In Progress ({roadmapStats.in_progress})
            </button>
            <button
              onClick={() => setRoadmapFilter('completed')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                roadmapFilter === 'completed'
                  ? 'bg-green-500 text-white'
                  : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              Completed ({roadmapStats.completed})
            </button>
            <button
              onClick={() => setRoadmapFilter('rejected')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                roadmapFilter === 'rejected'
                  ? 'bg-red-500 text-white'
                  : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              }`}
            >
              <X className="w-4 h-4" />
              Rejected ({roadmapStats.rejected})
            </button>
            <button
              onClick={() => setRoadmapFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                roadmapFilter === 'all'
                  ? 'bg-white/20 text-white'
                  : 'bg-white/10 text-gray-400 hover:bg-white/20'
              }`}
            >
              All ({roadmapSuggestions.length})
            </button>
          </div>

          {/* Suggestions List */}
          {loadingRoadmap ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
            </div>
          ) : filteredSuggestions.length === 0 ? (
            <div className={`text-center py-12 rounded-xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
              <Lightbulb className={`w-12 h-12 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
              <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>
                No suggestions in this category
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              <AnimatePresence>
                {filteredSuggestions.map((suggestion) => {
                  const statusConfig = STATUS_CONFIG[suggestion.status] || STATUS_CONFIG.pending;
                  const StatusIcon = statusConfig.icon;
                  const isExpanded = expandedSuggestion === suggestion.id;

                  return (
                    <motion.div
                      key={suggestion.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className={`p-4 rounded-xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              {suggestion.title}
                            </h3>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              statusConfig.color === 'yellow' ? 'bg-yellow-500/20 text-yellow-400' :
                              statusConfig.color === 'cyan' ? 'bg-cyan-500/20 text-cyan-400' :
                              statusConfig.color === 'purple' ? 'bg-purple-500/20 text-purple-400' :
                              statusConfig.color === 'green' ? 'bg-green-500/20 text-green-400' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              <StatusIcon className="w-3 h-3" />
                              {statusConfig.label}
                            </span>
                          </div>
                          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {suggestion.description}
                          </p>
                        </div>
                        <div className={`px-3 py-1 rounded-lg ${isDark ? 'bg-white/10' : 'bg-gray-200'} text-center flex-shrink-0`}>
                          <p className="text-xs text-gray-500">Votes</p>
                          <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{suggestion.vote_count || 0}</p>
                        </div>
                      </div>

                      {/* Meta Info */}
                      <div className={`flex items-center gap-4 text-xs mb-3 flex-wrap ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        <span>From: {suggestion.user_email || 'Anonymous'}</span>
                        <span>Category: {suggestion.category || 'General'}</span>
                        <span>Date: {new Date(suggestion.created_at).toLocaleDateString()}</span>
                      </div>

                      {/* Current Admin Comment (if exists) */}
                      {suggestion.admin_comment && !isExpanded && (
                        <div className={`p-3 rounded-lg mb-3 ${isDark ? 'bg-cyan-500/10 border border-cyan-500/20' : 'bg-cyan-50 border border-cyan-200'}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <MessageSquare className="w-3 h-3 text-cyan-500" />
                            <span className="text-xs font-medium text-cyan-500">Admin Comment</span>
                          </div>
                          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {suggestion.admin_comment}
                          </p>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Status Change Buttons */}
                        {suggestion.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleUpdateSuggestionStatus(suggestion.id, 'approved')}
                              disabled={updatingStatus === suggestion.id}
                              className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 text-xs font-medium transition-colors flex items-center gap-1"
                            >
                              {updatingStatus === suggestion.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                              Approve
                            </button>
                            <button
                              onClick={() => handleUpdateSuggestionStatus(suggestion.id, 'rejected')}
                              disabled={updatingStatus === suggestion.id}
                              className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs font-medium transition-colors flex items-center gap-1"
                            >
                              <X className="w-3 h-3" />
                              Reject
                            </button>
                          </>
                        )}
                        {suggestion.status === 'approved' && (
                          <button
                            onClick={() => handleUpdateSuggestionStatus(suggestion.id, 'in_progress')}
                            disabled={updatingStatus === suggestion.id}
                            className="px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 text-xs font-medium transition-colors flex items-center gap-1"
                          >
                            {updatingStatus === suggestion.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Rocket className="w-3 h-3" />}
                            Start Progress
                          </button>
                        )}
                        {suggestion.status === 'in_progress' && (
                          <button
                            onClick={() => handleUpdateSuggestionStatus(suggestion.id, 'completed')}
                            disabled={updatingStatus === suggestion.id}
                            className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 text-xs font-medium transition-colors flex items-center gap-1"
                          >
                            {updatingStatus === suggestion.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                            Mark Complete
                          </button>
                        )}

                        {/* Add/Edit Comment Button */}
                        <button
                          onClick={() => {
                            if (isExpanded) {
                              setExpandedSuggestion(null);
                              setAdminComment('');
                            } else {
                              setExpandedSuggestion(suggestion.id);
                              setAdminComment(suggestion.admin_comment || '');
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 text-xs font-medium transition-colors flex items-center gap-1"
                        >
                          <MessageSquare className="w-3 h-3" />
                          {suggestion.admin_comment ? 'Edit Comment' : 'Add Comment'}
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDeleteSuggestion(suggestion.id)}
                          className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-colors flex items-center gap-1 ml-auto"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      </div>

                      {/* Expanded Comment Section */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-4 pt-4 border-t border-white/10"
                          >
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                              Admin Comment (visible to users)
                            </label>
                            <textarea
                              value={adminComment}
                              onChange={(e) => setAdminComment(e.target.value)}
                              placeholder="Add a public comment explaining the status or providing updates..."
                              rows={3}
                              className={`w-full px-4 py-3 rounded-lg border resize-none ${
                                isDark 
                                  ? 'bg-white/5 border-white/20 text-white placeholder-gray-500' 
                                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                              } focus:outline-none focus:border-cyan-500`}
                            />
                            <div className="flex justify-end gap-2 mt-3">
                              <button
                                onClick={() => {
                                  setExpandedSuggestion(null);
                                  setAdminComment('');
                                }}
                                className="px-4 py-2 rounded-lg bg-white/10 text-gray-400 hover:bg-white/20 text-sm font-medium transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveComment(suggestion.id)}
                                disabled={savingComment}
                                className="px-4 py-2 rounded-lg bg-cyan-500 text-white hover:bg-cyan-600 text-sm font-medium transition-colors flex items-center gap-2"
                              >
                                {savingComment ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <CheckCircle className="w-4 h-4" />
                                    Save Comment
                                  </>
                                )}
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>

      {/* Delete User Confirmation Modal */}
      {showDeleteConfirm && searchResult && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`w-full max-w-md rounded-2xl p-6 ${isDark ? 'bg-gray-900' : 'bg-white'} border border-red-500/30`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Delete User Permanently</h3>
                <p className="text-sm text-gray-400">This action cannot be undone</p>
              </div>
            </div>

            <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30">
              <p className="text-sm text-red-300 mb-2">
                <strong>Warning:</strong> This will permanently delete:
              </p>
              <ul className="text-sm text-gray-400 list-disc list-inside space-y-1">
                <li>User account and authentication</li>
                <li>Profile data</li>
                <li>All {searchResult.project_count || 0} projects</li>
                <li>Credit history</li>
                <li>Stripe subscription (if any)</li>
              </ul>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-400 mb-2">
                Type <span className="text-cyan-400 font-mono">{searchResult.email}</span> to confirm:
              </p>
              <input
                type="text"
                value={deleteConfirmEmail}
                onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                placeholder="Enter email to confirm"
                className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmEmail('');
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 text-white font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={deleting || deleteConfirmEmail !== searchResult.email}
                className="flex-1 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Forever
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}