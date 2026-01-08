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
import { motion } from 'framer-motion';
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
  DollarSign
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
  'djhitman72@gmail.com'
  // Add more admin emails here
];

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
          <span className="text-sm text-gray-400">{currentUser?.email}</span>
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
            <button onClick={() => setSuccessMessage('')} className="ml-auto text-green-400 hover:text-green-300">×</button>
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
            <button onClick={() => setErrorMessage('')} className="ml-auto text-red-400 hover:text-red-300">×</button>
          </motion.div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
              <UserX className="w-5 h-5 text-orange-400" />
              <span className="text-gray-400">Opted Out</span>
            </div>
            <p className="text-3xl font-bold text-white">{userStats.optedOut}</p>
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
      </main>
    </div>
  );
}