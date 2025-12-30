'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Music,
  User,
  Mail,
  Lock,
  Zap,
  LogOut,
  ChevronLeft,
  Save,
  AlertCircle,
  CheckCircle,
  CreditCard,
  Sun,
  Moon,
  FolderOpen,
  X,
  Download
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const { isDark, toggleTheme } = useTheme();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Download folder (localStorage)
  const [downloadFolder, setDownloadFolder] = useState('');
  const [downloadFolderSuccess, setDownloadFolderSuccess] = useState('');

  useEffect(() => {
    checkUser();
    // Load download folder from localStorage
    const savedFolder = localStorage.getItem('karatrack_download_folder');
    if (savedFolder) {
      setDownloadFolder(savedFolder);
    }
  }, []);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      setUser(user);
      setEmail(user.email);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      setProfile(profileData);
      setFullName(profileData?.full_name || '');
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await supabase.auth.updateUser({
        data: { full_name: fullName }
      });

      setSuccess('Profile updated successfully!');
      setProfile({ ...profile, full_name: fullName });
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setChangingPassword(true);
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      setChangingPassword(false);
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      setChangingPassword(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setPasswordSuccess('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(''), 3000);
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSaveDownloadFolder = () => {
    if (downloadFolder.trim()) {
      localStorage.setItem('karatrack_download_folder', downloadFolder.trim());
      setDownloadFolderSuccess('Download folder saved!');
      setTimeout(() => setDownloadFolderSuccess(''), 3000);
    }
  };

  const handleClearDownloadFolder = () => {
    localStorage.removeItem('karatrack_download_folder');
    setDownloadFolder('');
    setDownloadFolderSuccess('Download folder cleared!');
    setTimeout(() => setDownloadFolderSuccess(''), 3000);
  };

  const handleManageSubscription = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stripe/portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to open portal');
      }

      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-animated-dark' : 'bg-animated-light'} flex items-center justify-center`}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'bg-animated-dark' : 'bg-animated-light'}`}>
      {/* Navigation */}
      <nav className={`border-b ${isDark ? 'border-white/10' : 'border-gray-200'} px-6 py-4`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center">
              <Music className="w-6 h-6 text-white" />
            </div>
            <span className="font-display font-bold text-xl text-gradient">Karatrack Studio</span>
          </Link>

          <div className="flex items-center gap-6">
            {profile && (
              <div className="credit-badge">
                <div className="credit-badge-icon">
                  <Zap className="w-3 h-3 text-white" />
                </div>
                <span className={`text-sm ${isDark ? 'text-white' : 'text-gray-800'}`}>{profile.credits_remaining || 0} Credits</span>
              </div>
            )}
            <button onClick={toggleTheme} className="glass-button p-3 rounded-xl">
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={handleLogout} className={`glass-button py-2 px-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              <LogOut className="w-4 h-4" />
              Log Out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <Link href="/dashboard" className={`inline-flex items-center gap-2 mb-8 transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}>
          <ChevronLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className={`text-3xl font-bold mb-8 ${isDark ? 'text-white' : 'text-gray-900'}`}>Account Settings</h1>

          {/* Profile Section */}
          <div className="glass-panel p-6 mb-6">
            <h2 className={`text-xl font-semibold mb-6 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              <User className="w-5 h-5 text-cyan-400" />
              Profile Information
            </h2>

            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mb-6 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-red-400">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4 mb-6 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                <p className="text-green-400">{success}</p>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={`w-full border rounded-xl py-3 pl-12 pr-4 placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                    placeholder="Your name"
                  />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="email"
                    value={email}
                    disabled
                    className={`w-full border rounded-xl py-3 pl-12 pr-4 cursor-not-allowed ${isDark ? 'bg-white/5 border-white/10 text-gray-400' : 'bg-gray-100 border-gray-300 text-gray-500'}`}
                  />
                </div>
                <p className={`text-sm mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Email cannot be changed</p>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="glass-button-primary glass-button py-3 px-6 flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Download Folder Section */}
          <div className="glass-panel p-6 mb-6">
            <h2 className={`text-xl font-semibold mb-6 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              <Download className="w-5 h-5 text-cyan-400" />
              Download Settings
            </h2>

            <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Set a default download folder for your karaoke tracks. This setting is saved locally on this device only.
            </p>

            {downloadFolderSuccess && (
              <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-3 mb-4 flex items-center gap-3">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                <p className="text-green-400 text-sm">{downloadFolderSuccess}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Default Download Folder
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <FolderOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type="text"
                      value={downloadFolder}
                      onChange={(e) => setDownloadFolder(e.target.value)}
                      className={`w-full border rounded-xl py-3 pl-12 pr-4 placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                      placeholder="C:\Users\YourName\Music\Karaoke"
                    />
                  </div>
                  {downloadFolder && (
                    <button
                      type="button"
                      onClick={handleClearDownloadFolder}
                      className="p-3 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                      title="Clear folder"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
                <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                  Enter the full path where you want your downloads to be saved
                </p>
              </div>

              <button
                type="button"
                onClick={handleSaveDownloadFolder}
                disabled={!downloadFolder.trim()}
                className={`glass-button py-3 px-6 flex items-center gap-2 disabled:opacity-50 ${isDark ? 'text-white' : 'text-gray-900'}`}
              >
                <Save className="w-4 h-4" />
                Save Download Folder
              </button>
            </div>
          </div>

          {/* Password Section */}
          <div className="glass-panel p-6 mb-6">
            <h2 className={`text-xl font-semibold mb-6 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              <Lock className="w-5 h-5 text-cyan-400" />
              Change Password
            </h2>

            {passwordError && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mb-6 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-red-400">{passwordError}</p>
              </div>
            )}

            {passwordSuccess && (
              <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4 mb-6 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                <p className="text-green-400">{passwordSuccess}</p>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>New Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={`w-full border rounded-xl py-3 pl-12 pr-4 placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Confirm New Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full border rounded-xl py-3 pl-12 pr-4 placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={changingPassword || !newPassword || !confirmPassword}
                className={`glass-button py-3 px-6 flex items-center gap-2 disabled:opacity-50 ${isDark ? 'text-white' : 'text-gray-900'}`}
              >
                {changingPassword ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Update Password
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Subscription Section */}
          <div className="glass-panel p-6 mb-6">
            <h2 className={`text-xl font-semibold mb-6 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              <CreditCard className="w-5 h-5 text-cyan-400" />
              Subscription
            </h2>

            <div className="flex items-center justify-between mb-6">
              <div>
                <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Current Plan</p>
                <p className={`capitalize ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{profile?.subscription_tier || 'Free'}</p>
              </div>
              <div className="text-right">
                <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Credits Remaining</p>
                <p className="text-cyan-400">{profile?.credits_remaining || 0} credits</p>
              </div>
            </div>

            <div className="flex gap-4">
              <Link href="/pricing">
                <button className="glass-button-primary glass-button py-3 px-6">
                  Upgrade Plan
                </button>
              </Link>

              {profile?.stripe_customer_id && (
                <button
                  onClick={handleManageSubscription}
                  className={`glass-button py-3 px-6 ${isDark ? 'text-white' : 'text-gray-900'}`}
                >
                  Manage Billing
                </button>
              )}
            </div>
          </div>

          {/* Account Stats */}
          <div className="glass-panel p-6">
            <h2 className={`text-xl font-semibold mb-6 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              <Zap className="w-5 h-5 text-cyan-400" />
              Account Stats
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className={`rounded-xl p-4 text-center ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
                <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{profile?.track_count || 0}</p>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Tracks Processed</p>
              </div>
              <div className={`rounded-xl p-4 text-center ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
                <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{profile?.credits_used_this_month || 0}</p>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Credits Used (Month)</p>
              </div>
              <div className={`rounded-xl p-4 text-center ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
                <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{profile?.credits_remaining || 0}</p>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Credits Available</p>
              </div>
              <div className={`rounded-xl p-4 text-center ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
                <p className={`text-2xl font-bold capitalize ${isDark ? 'text-white' : 'text-gray-900'}`}>{profile?.subscription_tier || 'Free'}</p>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Plan</p>
              </div>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}