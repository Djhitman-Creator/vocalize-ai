'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  Music, 
  Upload, 
  Zap, 
  Settings, 
  LogOut, 
  FileVideo,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

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

      // Fetch projects
      const { data: projectsData } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      setProjects(projectsData || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-animated-dark flex items-center justify-center">
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
        return <Clock className="w-5 h-5 text-yellow-400 animate-pulse" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-animated-dark">
      {/* Navigation */}
      <nav className="border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center">
              <Music className="w-6 h-6 text-white" />
            </div>
            <span className="font-display font-bold text-xl text-gradient">VocalizeAI</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <div className="credit-badge">
              <div className="credit-badge-icon">
                <Zap className="w-3 h-3 text-white" />
              </div>
              <span className="text-sm text-white">{profile?.credits_remaining || 0} Credits</span>
            </div>
            
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
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome back, {profile?.full_name || user?.email?.split('@')[0]}!
          </h1>
          <p className="text-gray-400">Ready to transform some music?</p>
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
                <p className="text-gray-400 text-sm">Credits Remaining</p>
                <p className="text-2xl font-bold text-white">{profile?.credits_remaining || 0}</p>
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
                <p className="text-gray-400 text-sm">Total Projects</p>
                <p className="text-2xl font-bold text-white">{projects.length}</p>
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
                <p className="text-gray-400 text-sm">Subscription</p>
                <p className="text-2xl font-bold text-white capitalize">{profile?.subscription_tier || 'Free'}</p>
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
              <h3 className="text-xl font-semibold text-white mb-2">Upload New Track</h3>
              <p className="text-gray-400">Drop your audio file or click to browse</p>
            </div>
          </Link>
        </motion.div>

        {/* Recent Projects */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h2 className="text-xl font-bold text-white mb-4">Recent Projects</h2>
          
          {projects.length === 0 ? (
            <div className="glass-panel p-8 text-center">
              <FileVideo className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">No projects yet. Upload your first track!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {projects.map((project, i) => (
                <div key={project.id} className="glass-panel p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                      <Music className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-medium">{project.title}</h3>
                      <p className="text-gray-400 text-sm">
                        {new Date(project.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {getStatusIcon(project.status)}
                    <span className="text-gray-400 text-sm capitalize">{project.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}