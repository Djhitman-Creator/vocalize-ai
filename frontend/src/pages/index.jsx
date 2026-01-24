'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useTheme } from '../context/ThemeContext';
import SEO, { getOrganizationSchema, getSoftwareAppSchema } from '../components/SEO';
import { createClient } from '@supabase/supabase-js';
import {
  Upload,
  Music,
  Mic2,
  FileVideo,
  Sparkles,
  Moon,
  Sun,
  Zap,
  Play,
  Check,
  Scale,
  Menu,
  X
} from 'lucide-react';

const ThemeToggle = ({ isDark, toggle }) => (
  <button onClick={toggle} className="glass-button p-3 rounded-full" aria-label="Toggle theme">
    {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
  </button>
);

const CreditBadge = ({ credits, isDark }) => (
  <div className="credit-badge">
    <div className="credit-badge-icon">
      <Zap className="w-3 h-3 text-white" />
    </div>
    <span className={`text-sm ${isDark ? 'text-white' : 'text-gray-800'}`}>{credits} Credits</span>
  </div>
);

// ============================================
// VIDEO MODAL COMPONENT (NEW)
// ============================================
const VideoModal = ({ isOpen, onClose, isDark }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          
          {/* Modal Content */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-4xl z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute -top-12 right-0 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
              aria-label="Close video"
            >
              <X className="w-6 h-6" />
            </button>
            
            {/* Video Container */}
            <div className={`rounded-2xl overflow-hidden shadow-2xl ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
              {/* Video Header */}
              <div className={`px-4 py-3 border-b ${isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Karatrack Studio Demo
                </h3>
              </div>
              
              {/* Video Player */}
              <div className="aspect-video bg-black">
                {/* 
                  IMPORTANT: Replace the src URL below with your actual video URL
                  Options:
                  1. Cloudflare R2: https://pub-xxxxx.r2.dev/videos/demo.mp4
                  2. YouTube embed: Use iframe instead of video tag
                */}
                <video
                  controls
                  autoPlay
                  className="w-full h-full"
                >
                  {/* Demo video hosted on Cloudflare R2 */}
                  <source src="https://pub-71dae0f9e45e4d8e8d1eedd472780341.r2.dev/assets/freekaratrack-demo.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
                
                {/* 
                  ALTERNATIVE: YouTube Embed (uncomment and replace video tag above)
                  <iframe
                    className="w-full h-full"
                    src="https://www.youtube.com/embed/YOUR_VIDEO_ID?autoplay=1"
                    title="Karatrack Studio Demo"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                */}
              </div>
              
              {/* Video Footer */}
              <div className={`px-4 py-3 border-t ${isDark ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-gray-50'}`}>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  See how easy it is to create professional karaoke videos in minutes!
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const Navigation = ({ isDark, toggleTheme, credits }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: '#features', label: 'Features' },
    { href: '#pricing', label: 'Pricing' },
    { href: '#how-it-works', label: 'How It Works' },
  ];

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 py-4"
    >
      <div className="max-w-7xl mx-auto">
        <div className="glass-panel px-4 sm:px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2 sm:gap-3">
            <img src="/logo.png" alt="Karatrack Studio" className="h-8 sm:h-10 w-auto" />
            <span className="font-display font-bold text-lg sm:text-xl text-gradient hidden sm:inline">Karatrack Studio</span>
            <span className="font-display font-bold text-lg text-gradient sm:hidden">Karatrack</span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`text-sm transition-colors ${isDark ? 'text-gray-300 hover:text-cyan-400' : 'text-gray-600 hover:text-cyan-600'}`}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop Right Side */}
          <div className="hidden md:flex items-center gap-4">
            <CreditBadge credits={credits} isDark={isDark} />
            <ThemeToggle isDark={isDark} toggle={toggleTheme} />
            <Link href="/login" className={`text-sm font-medium transition-colors ${isDark ? 'text-gray-300 hover:text-cyan-400' : 'text-gray-600 hover:text-cyan-600'}`}>
              Log In
            </Link>
            <Link href="#pricing">
              <button className="glass-button-primary glass-button">Get Started</button>
            </Link>
          </div>

          {/* Mobile Right Side */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle isDark={isDark} toggle={toggleTheme} />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="glass-button p-3 rounded-full"
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
              className="glass-panel mt-2 p-4 lg:hidden"
            >
              {/* Navigation Links */}
              <div className="space-y-1 mb-4">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={closeMobileMenu}
                    className={`block px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      isDark 
                        ? 'text-gray-300 hover:text-cyan-400 hover:bg-white/5' 
                        : 'text-gray-600 hover:text-cyan-600 hover:bg-gray-100'
                    }`}
                  >
                    {link.label}
                  </a>
                ))}
              </div>

              {/* Divider */}
              <div className={`border-t ${isDark ? 'border-white/10' : 'border-gray-200'} my-4`}></div>

              {/* Credits Badge */}
              <div className="px-4 py-2 mb-4">
                <CreditBadge credits={credits} isDark={isDark} />
              </div>

              {/* Auth Buttons */}
              <div className="space-y-2 px-2">
                <Link href="/login" onClick={closeMobileMenu} className="block">
                  <button className={`w-full glass-button py-3 ${isDark ? 'text-white' : 'text-gray-800'}`}>
                    Log In
                  </button>
                </Link>
                <Link href="#pricing" onClick={closeMobileMenu} className="block">
                  <button className="w-full glass-button-primary glass-button py-3">
                    Get Started
                  </button>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.nav>
  );
};

// UPDATED: HeroSection now accepts onWatchDemo callback
const HeroSection = ({ isDark, onWatchDemo }) => (
  <section className="min-h-screen flex items-center justify-center px-6 pt-32 pb-20">
    <div className="max-w-6xl mx-auto text-center">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="inline-flex items-center gap-2 glass-panel px-4 py-2 mb-8"
      >
        <Sparkles className="w-4 h-4 text-cyan-500" />
        <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>AI-Powered Music Processing</span>
      </motion.div>
      <motion.h1
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className={`font-display text-4xl sm:text-5xl md:text-7xl font-bold mb-6 leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}
      >
        Transform Your Music<br />
        <span className="text-gradient">With AI Magic</span>
      </motion.h1>
      <motion.p
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className={`text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-12 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
      >
        Remove vocals, add guide vocals for practice, add scrolling lyrics, and export stunning music videos - all powered by cutting-edge AI.
      </motion.p>
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex flex-col sm:flex-row items-center justify-center gap-4"
      >
        <Link href="#pricing">
          <button className="glass-button-primary glass-button flex items-center gap-2 text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4">
            <Sparkles className="w-5 h-5" />
            Get Started
          </button>
        </Link>
        {/* UPDATED: Watch Demo button now triggers the modal */}
        <button 
          onClick={onWatchDemo}
          className={`glass-button flex items-center gap-2 text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 ${isDark ? 'text-white' : 'text-gray-800'}`}
        >
          <Play className="w-5 h-5" />
          Watch Demo
        </button>
      </motion.div>

      {/* Legal Disclaimer */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.55 }}
        className={`max-w-2xl mx-auto mt-8 p-4 rounded-xl ${isDark
            ? 'bg-white/5 border border-white/10'
            : 'bg-gray-50 border border-gray-200'
          }`}
      >
        <div className="flex items-start gap-3">
          <Scale className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
          <div className="text-left">
            <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              <strong>For personal use only.</strong> By using Karatrack Studio, you confirm you have
              the rights to any music you upload - either through ownership, license, or original creation.
            </p>
            <Link
              href="/terms"
              className={`text-sm mt-2 inline-block ${isDark ? 'text-cyan-400 hover:text-cyan-300' : 'text-cyan-600 hover:text-cyan-700'}`}
            >
              Read our Terms of Service 
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="grid grid-cols-3 gap-4 sm:gap-8 mt-16 max-w-2xl mx-auto"
      >
        {[
          { value: '98%+', label: 'Lyrics Accuracy*' },
          { value: 'Word-Level', label: 'Timing Sync' },
          { value: 'Up to 4K', label: 'Export Quality*' },
        ].map((stat, i) => (
          <div key={i} className="text-center">
            <div className="font-display text-xl sm:text-3xl font-bold text-gradient">{stat.value}</div>
            <div className={`text-xs sm:text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{stat.label}</div>
          </div>
        ))}
      </motion.div>
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.65 }}
        className={`text-xs mt-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
      >
        *with edit-before-render feature on Pro/Studio plans. 4K export available on Studio plan only.
      </motion.div>
    </div>
  </section>
);

const FeaturesSection = ({ isDark }) => {
  const features = [
    { icon: <Mic2 className="w-8 h-8" />, title: 'Vocal Removal', description: 'Remove all vocals from any track with studio-quality precision using advanced AI separation.' },
    { icon: <Music className="w-8 h-8" />, title: 'Guide Vocals', description: 'Reduce the lead vocal by 70% - great for practice and learning new songs.' },
    { icon: <FileVideo className="w-8 h-8" />, title: 'Scrolling Lyrics', description: 'AI automatically transcribes and syncs lyrics with smooth, karaoke-style animations.' },
    { icon: <Sparkles className="w-8 h-8" />, title: 'Video Export', description: 'Export your processed track as a beautiful MP4 video with custom thumbnails.*' },
  ];

  return (
    <section id="features" className="py-20 sm:py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ y: 30, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} className="text-center mb-12 sm:mb-16">
          <h2 className={`font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Powerful <span className="text-gradient">Features</span>
          </h2>
          <p className={`text-base sm:text-lg max-w-xl mx-auto ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Everything you need to transform your music into professional content.
          </p>
        </motion.div>
        <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
          {features.map((feature, i) => (
            <motion.div key={i} initial={{ y: 30, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="feature-card group">
              <div className="w-12 sm:w-16 h-12 sm:h-16 rounded-2xl bg-gradient-to-br from-cyan-400/20 to-purple-500/20 flex items-center justify-center mb-4 sm:mb-6 group-hover:from-cyan-400/40 group-hover:to-purple-500/40 transition-all">
                <span className="text-cyan-500">{feature.icon}</span>
              </div>
              <h3 className={`font-display text-lg sm:text-xl font-semibold mb-2 sm:mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>{feature.title}</h3>
              <p className={`text-sm sm:text-base ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{feature.description}</p>
            </motion.div>
          ))}
        </div>
        <div className={`text-center text-xs mt-6 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          *Custom thumbnails available with the Studio package.
        </div>
      </div>
    </section>
  );
};

const PricingSection = ({ isDark }) => {
  const plans = [
    { name: 'Free', tier: 'free', price: 0, features: ['3 credits/month', '480p video quality', 'Karatrack watermark', 'Chat support'], popular: false },
    { name: 'Starter', tier: 'starter', price: 9.99, features: ['25 credits/month', '1080p video quality', 'No watermark', 'Color customization', 'Email support'], popular: false },
    { name: 'Pro', tier: 'pro', price: 24.99, features: ['75 credits/month', '1080p video quality', 'No watermark', 'Edit lyrics before render', 'Email support'], popular: true },
    { name: 'Studio', tier: 'studio', price: 49.99, features: ['200 credits/month', '4K video quality', 'Custom logo watermark', 'Edit lyrics before render', 'Full style control', 'Priority support'], popular: false },
  ];

  return (
    <section id="pricing" className="py-20 sm:py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ y: 30, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} className="text-center mb-6 sm:mb-8">
          <h2 className={`font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Simple <span className="text-gradient">Pricing</span>
          </h2>
          <p className={`text-base sm:text-lg max-w-xl mx-auto ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Choose the plan that fits your needs. Upgrade or downgrade anytime.
          </p>
        </motion.div>
        
        {/* Select a plan message */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }} 
          whileInView={{ y: 0, opacity: 1 }} 
          viewport={{ once: true }}
          className="text-center mb-8 sm:mb-12"
        >
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${isDark ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-cyan-50 border border-cyan-200'}`}>
            <Sparkles className="w-4 h-4 text-cyan-500" />
            <span className={`text-sm font-medium ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
              Select a plan to get started
            </span>
          </div>
        </motion.div>

        {/* Mobile: 2x2 grid, Desktop: 4 columns */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {plans.map((plan, i) => (
            <motion.div key={i} initial={{ y: 30, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className={`feature-card relative ${plan.popular ? 'border-cyan-500/50' : ''}`}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-gradient-to-r from-cyan-400 to-purple-500 text-white text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-1 rounded-full whitespace-nowrap">MOST POPULAR</span>
                </div>
              )}
              <h3 className={`font-display text-base sm:text-xl font-semibold mb-1 sm:mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{plan.name}</h3>
              <div className="mb-3 sm:mb-6">
                <span className={`text-2xl sm:text-4xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>${plan.price}</span>
                <span className={`text-xs sm:text-base ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>/mo</span>
              </div>
              <ul className="space-y-1.5 sm:space-y-3 mb-4 sm:mb-8">
                {plan.features.map((feature, j) => (
                  <li key={j} className={`flex items-start gap-1.5 sm:gap-2 text-xs sm:text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    <Check className="w-3 sm:w-4 h-3 sm:h-4 text-cyan-500 flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link href={`/signup?plan=${plan.tier}`}>
                <button className={`w-full ${plan.popular ? 'glass-button-primary' : ''} glass-button text-xs sm:text-base py-2 sm:py-3 ${!plan.popular && (isDark ? 'text-white' : 'text-gray-800')}`}>
                  {plan.price === 0 ? 'Get Started Free' : 'Get Started'}
                </button>
              </Link>
            </motion.div>
          ))}
        </div>
        
        {/* Link to full pricing page */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }} 
          whileInView={{ y: 0, opacity: 1 }} 
          viewport={{ once: true }}
          className="text-center mt-6 sm:mt-8"
        >
          <Link href="/pricing" className={`text-xs sm:text-sm ${isDark ? 'text-gray-400 hover:text-cyan-400' : 'text-gray-600 hover:text-cyan-600'} transition-colors`}>
            View full pricing details & compare features 
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

const UploadSection = ({ isDark }) => (
  <section id="how-it-works" className="py-20 sm:py-32 px-6">
    <div className="max-w-4xl mx-auto">
      <motion.div initial={{ y: 30, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} className="text-center mb-12 sm:mb-16">
        <h2 className={`font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          How It <span className="text-gradient">Works</span>
        </h2>
        <p className={`text-base sm:text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          Three simple steps to transform your music.
        </p>
      </motion.div>
      <motion.div initial={{ y: 30, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} className="dropzone cursor-pointer group">
        <div className="w-16 sm:w-20 h-16 sm:h-20 mx-auto mb-4 sm:mb-6 rounded-2xl bg-gradient-to-br from-cyan-400/20 to-purple-500/20 flex items-center justify-center group-hover:from-cyan-400/40 group-hover:to-purple-500/40 transition-all">
          <Upload className="w-8 sm:w-10 h-8 sm:h-10 text-cyan-500" />
        </div>
        <h3 className={`font-display text-xl sm:text-2xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Drop your audio file here</h3>
        <p className={`mb-4 text-sm sm:text-base ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>or click to browse - MP3, WAV, FLAC supported</p>
        <div className={`text-xs sm:text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
          Quality options: <span className="text-cyan-500">480p, 1080p, and 4K</span> (varies by plan)
        </div>
      </motion.div>
      <div className="grid grid-cols-3 gap-4 sm:gap-8 mt-12 sm:mt-16">
        {[
          { step: '01', title: 'Upload', desc: 'Drop your audio file' },
          { step: '02', title: 'Process', desc: 'AI works its magic' },
          { step: '03', title: 'Export', desc: 'Download your video' },
        ].map((item, i) => (
          <motion.div key={i} initial={{ y: 20, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="text-center">
            <div className="font-display text-3xl sm:text-5xl font-bold text-gradient mb-2 sm:mb-4">{item.step}</div>
            <h4 className={`font-semibold text-sm sm:text-lg mb-1 sm:mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.title}</h4>
            <p className={`text-xs sm:text-base ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{item.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

const Footer = ({ isDark }) => (
  <footer className={`py-8 sm:py-12 px-6 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Karatrack Studio" className="h-8 w-auto" />
          <span className="font-display font-bold text-gradient">Karatrack Studio</span>
        </div>
        <div className={`flex items-center gap-6 sm:gap-8 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          <Link href="/privacy" className="hover:text-cyan-500 transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-cyan-500 transition-colors">Terms</Link>
          <a href="mailto:support@karatrack.com" className="hover:text-cyan-500 transition-colors">Contact</a>
        </div>
        <div className={`text-xs sm:text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          © 2025 Karatrack Studio. All rights reserved.
        </div>
      </div>
    </div>
  </footer>
);

// Initialize Supabase client for auth checking
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function HomePage() {
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();
  const [credits, setCredits] = useState(25);
  
  // NEW: State for video modal
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

  // Check if user just confirmed their email and redirect to dashboard
  // This handles the case where Supabase redirects to homepage after email confirmation
  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      // Check URL for auth tokens (Supabase puts them in the hash)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');
      
      // IMPORTANT: Don't redirect if this is a password recovery flow
      // Password reset links have type=recovery
      if (type === 'recovery') {
        console.log('Password recovery detected, not redirecting');
        return;
      }
      
      // If we have an access token and it's a signup confirmation, redirect to dashboard
      if (accessToken && type === 'signup') {
        console.log('Email confirmed, redirecting to dashboard...');
        router.replace('/dashboard');
        return;
      }

      // Only check for pending plan redirect if there's no auth hash in URL
      // This prevents interfering with other auth flows
      if (!accessToken) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email_confirmed_at) {
          // Check if they have a pending plan that needs checkout
          const pendingPlan = localStorage.getItem('karatrack_pending_plan');
          if (pendingPlan && pendingPlan !== 'free') {
            console.log('Logged in user with pending plan, redirecting to dashboard...');
            router.replace('/dashboard');
            return;
          }
        }
      }
    };

    checkAuthAndRedirect();
    
    // Also listen for auth state changes - but only for signup, not recovery
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Don't redirect on PASSWORD_RECOVERY event
      if (event === 'PASSWORD_RECOVERY') {
        console.log('Password recovery auth event, not redirecting');
        return;
      }
      
      // Only redirect on SIGNED_IN if it looks like a signup confirmation
      // Check URL to make sure this isn't a password reset flow
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const type = hashParams.get('type');
      
      if (type === 'recovery') {
        return; // Don't redirect for password recovery
      }
      
      if (event === 'SIGNED_IN' && session?.user?.email_confirmed_at && type === 'signup') {
        console.log('Auth state: SIGNED_IN (signup), redirecting to dashboard...');
        router.replace('/dashboard');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return (
    <>
      <SEO
        title={null}
        description="Transform any song into a professional karaoke video with AI. Remove vocals, add synchronized scrolling lyrics, and export stunning MP4 videos in minutes."
        path="/"
        structuredData={[getOrganizationSchema(), getSoftwareAppSchema()]}
      />
      <div className={isDark ? 'dark' : ''}>
        <div className={`min-h-screen ${isDark ? 'bg-animated-dark' : 'bg-animated-light'}`}>
          <Navigation isDark={isDark} toggleTheme={toggleTheme} credits={credits} />
          
          {/* UPDATED: Pass the modal open handler to HeroSection */}
          <HeroSection isDark={isDark} onWatchDemo={() => setIsVideoModalOpen(true)} />
          
          <FeaturesSection isDark={isDark} />
          <UploadSection isDark={isDark} />
          <PricingSection isDark={isDark} />
          <Footer isDark={isDark} />
          
          {/* NEW: Video Modal */}
          <VideoModal 
            isOpen={isVideoModalOpen} 
            onClose={() => setIsVideoModalOpen(false)} 
            isDark={isDark}
          />
        </div>
      </div>
    </>
  );
}