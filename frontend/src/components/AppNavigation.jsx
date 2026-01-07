'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  Upload,
  Settings,
  CreditCard,
  LayoutDashboard
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function AppNavigation({ profile, showBackToDashboard = false }) {
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/upload', label: 'Upload', icon: Upload },
    { href: '/pricing', label: 'Pricing', icon: CreditCard },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  const credits = profile?.credits_remaining || 0;

  return (
    <nav className={`border-b ${isDark ? 'border-white/10' : 'border-gray-200'} px-4 sm:px-6 py-4`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 sm:gap-3">
          <img src="/logo.png" alt="Karatrack Studio" className="h-8 sm:h-10 w-auto" />
          <span className="font-display font-bold text-lg sm:text-xl text-gradient hidden sm:inline">Karatrack Studio</span>
          <span className="font-display font-bold text-lg text-gradient sm:hidden">Karatrack</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-6">
          <Link href="/upload" className={`text-sm transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}>
            Upload
          </Link>
          <Link href="/pricing" className={`text-sm transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}>
            Pricing
          </Link>
          <Link href="/settings" className={`text-sm transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}>
            Settings
          </Link>

          <div className="credit-badge">
            <div className="credit-badge-icon">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span className={`text-sm ${isDark ? 'text-white' : 'text-gray-800'}`}>{credits} Credits</span>
          </div>

          <button
            onClick={toggleTheme}
            className="glass-button p-3 rounded-xl"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <button
            onClick={handleLogout}
            className={`glass-button p-3 rounded-xl transition-colors ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
            aria-label="Log out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile Right Side */}
        <div className="flex md:hidden items-center gap-2">
          {/* Credits Badge - compact version */}
          <div className="credit-badge">
            <div className="credit-badge-icon">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span className={`text-sm ${isDark ? 'text-white' : 'text-gray-800'}`}>{credits}</span>
          </div>

          <button
            onClick={toggleTheme}
            className="glass-button p-2.5 rounded-xl"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="glass-button p-2.5 rounded-xl"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="md:hidden glass-panel mt-4 p-4 mx-0"
          >
            {/* Navigation Links */}
            <div className="space-y-1 mb-4">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = router.pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={closeMobileMenu}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? isDark
                          ? 'bg-cyan-500/20 text-cyan-400'
                          : 'bg-cyan-50 text-cyan-600'
                        : isDark
                        ? 'text-gray-300 hover:text-white hover:bg-white/5'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {link.label}
                  </Link>
                );
              })}
            </div>

            {/* Divider */}
            <div className={`border-t ${isDark ? 'border-white/10' : 'border-gray-200'} my-4`}></div>

            {/* Subscription Info */}
            {profile && (
              <div className={`px-4 py-2 mb-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                <span className="font-medium">Plan:</span>{' '}
                <span className="text-cyan-400 capitalize">{profile.subscription_tier || 'Free'}</span>
              </div>
            )}

            {/* Logout Button */}
            <button
              onClick={() => {
                closeMobileMenu();
                handleLogout();
              }}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isDark
                  ? 'text-red-400 hover:bg-red-500/10'
                  : 'text-red-600 hover:bg-red-50'
              }`}
            >
              <LogOut className="w-5 h-5" />
              Log Out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}