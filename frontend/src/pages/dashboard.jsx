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
  X
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Polling interval in milliseconds (5 seconds)
const POLL_INTERVAL = 5000;

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const { isDark, toggleTheme } = useTheme();
  
  // Notification state
  const [notifications, setNotifications] = useState([]);
  const [completedIds, setCompletedIds] = useState(new Set()); // Track which we've notified about

  // Add notification
  const addNotification = useCallback((message, type = 'success') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  }, []);

  // Remove notification
  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
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
              // Check if this was previously processing
              const oldProject = projects.find(p => p.id === project.id);
              if (oldProject && oldProject.status === 'processing') {
                addNotification(`🎉 "${project.title}" is ready for download!`, 'success');
                
                // Play notification sound (optional)
                try {
                  const audio = new Audio('/notification.mp3');
                  audio.volume = 0.5;
                  audio.play().catch(() => {}); // Ignore if no sound file
                } catch (e) {}
              }
              setCompletedIds(prev => new Set([...prev, project.id]));
            }
            
            // Check for failed projects
            if (project.status === 'failed' && !completedIds.has(project.id)) {
              const oldProject = projects.find(p => p.id === project.id);
              if (oldProject && oldProject.status === 'processing') {
                addNotification(`❌ "${project.title}" failed to process`, 'error');
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

  // Polling effect - only poll when there are processing projects
  useEffect(() => {
    if (!user) return;
    
    const hasProcessingProjects = projects.some(p => p.status === 'processing');
    
    if (!hasProcessingProjects) return;
    
    console.log('🔄 Starting polling - processing projects detected');
    
    const pollInterval = setInterval(() => {
      fetchProjects(user.id, true);
    }, POLL_INTERVAL);

    return () => {
      console.log('⏹️ Stopping polling');
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

      if (urls.video) {
        window.open(urls.video, '_blank');
      } else if (urls.processed_audio) {
        window.open(urls.processed_audio, '_blank');
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

  if (loading) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-animated-dark' : 'bg-animated-light'} flex items-center justify-center`}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'processing':
        return <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />;
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
      case 'failed':
        return 'Failed';
      default:
        return status;
    }
  };

  // Count processing projects
  const processingCount = projects.filter(p => p.status === 'processing').length;

  return (
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
      <nav className="border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center">
              <Music className="w-6 h-6 text-white" />
            </div>
            <span className="font-display font-bold text-xl text-gradient">Karatrack Studio</span>
          </Link>

          <div className="flex items-center gap-6">
            <Link href="/upload" className="text-gray-400 hover:text-white">Upload</Link>
            <Link href="/pricing" className="text-gray-400 hover:text-white">Pricing</Link>
            <Link href="/settings" className="text-gray-400 hover:text-white">Settings</Link>

            <div className="credit-badge">
              <div className="credit-badge-icon">
                <Zap className="w-3 h-3 text-white" />
              </div>
              <span className="text-sm text-white">{profile?.credits_remaining || 0} Credits</span>
            </div>

            <button
              onClick={toggleTheme}
              className="glass-button p-3 rounded-xl"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <button
              onClick={handleLogout}
              className="glass-button p-3 rounded-xl text-gray-400 hover:text-white"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

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

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
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
        </div>

        {/* Upload Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-8"
        >
          <Link href="/upload" className="block">
            <div className="dropzone cursor-pointer group">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-400/20 to-purple-500/20 flex items-center justify-center group-hover:from-cyan-400/40 group-hover:to-purple-500/40 transition-all">
                <Upload className="w-8 h-8 text-cyan-500" />
              </div>
              <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Upload New Track</h3>
              <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>Drop your audio file or click to browse</p>
            </div>
          </Link>
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
                  className={`glass-panel p-4 flex items-center justify-between ${
                    project.status === 'processing' ? 'border border-yellow-500/30' : ''
                  }`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      project.status === 'completed' ? 'bg-green-500/20' :
                      project.status === 'processing' ? 'bg-yellow-500/20' :
                      project.status === 'failed' ? 'bg-red-500/20' : 'bg-white/5'
                    }`}>
                      <Music className={`w-6 h-6 ${
                        project.status === 'completed' ? 'text-green-400' :
                        project.status === 'processing' ? 'text-yellow-400' :
                        project.status === 'failed' ? 'text-red-400' : 'text-cyan-400'
                      }`} />
                    </div>
                    <div>
                      <h3 className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{project.title}</h3>
                      <p className="text-gray-400 text-sm">
                        {new Date(project.created_at).toLocaleDateString()} • {project.artist_name || 'Unknown Artist'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(project.status)}
                      <span className={`text-sm ${
                        project.status === 'completed' ? 'text-green-400' :
                        project.status === 'processing' ? 'text-yellow-400' :
                        project.status === 'failed' ? 'text-red-400' : 'text-gray-400'
                      }`}>
                        {getStatusText(project.status)}
                      </span>
                    </div>
                    
                    {/* Download Button - only show for completed projects */}
                    {project.status === 'completed' && (
                      <button
                        onClick={() => handleDownload(project)}
                        disabled={downloadingId === project.id}
                        className="ml-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-lg text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
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
                    
                    {/* Retry button for failed projects */}
                    {project.status === 'failed' && (
                      <Link href="/upload">
                        <button className="ml-2 px-4 py-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 font-medium hover:bg-red-500/30 transition-colors">
                          Retry
                        </button>
                      </Link>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}