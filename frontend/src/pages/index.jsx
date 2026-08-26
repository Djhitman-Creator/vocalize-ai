'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useTheme } from '../context/ThemeContext';
import SEO, { getOrganizationSchema, getSoftwareAppSchema, getFAQSchema } from '../components/SEO';
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
  X,
  ChevronDown
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

// ============================================
// HERO SECTION WITH PARALLAX BACKGROUND
// ============================================
const HeroSection = ({ isDark, onWatchDemo }) => {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Parallax: background moves at 40% of scroll speed
  const parallaxOffset = scrollY * 0.4;

  return (
    <section className="relative min-h-screen flex items-center justify-center px-6 pt-32 pb-20 overflow-hidden">
      {/* Parallax Background Screenshot */}
      <div 
        className="absolute inset-0 z-0"
        style={{ 
          transform: `translateY(${parallaxOffset}px)`,
          willChange: 'transform'
        }}
      >
        {/* Screenshot Image */}
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: 'url(/screenshots/editor-preview.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
            backgroundRepeat: 'no-repeat',
          }}
        />
        
        {/* Gradient overlay to fade screenshot into background */}
        <div 
          className={`absolute inset-0 ${
            isDark 
              ? 'bg-gradient-to-b from-[#0a0a0f]/70 via-[#0a0a0f]/85 to-[#0a0a0f]' 
              : 'bg-gradient-to-b from-white/70 via-white/85 to-white'
          }`}
        />
        
        {/* Additional radial gradient for center focus */}
        <div 
          className={`absolute inset-0 ${
            isDark 
              ? 'bg-[radial-gradient(ellipse_at_center,transparent_0%,#0a0a0f_70%)]' 
              : 'bg-[radial-gradient(ellipse_at_center,transparent_0%,white_70%)]'
          }`}
          style={{ opacity: 0.6 }}
        />
        
        {/* Subtle color tint overlay */}
        <div 
          className={`absolute inset-0 ${
            isDark 
              ? 'bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5' 
              : 'bg-gradient-to-br from-cyan-500/3 via-transparent to-purple-500/3'
          }`}
        />
      </div>

      {/* Hero Content */}
      <div className="relative z-10 max-w-6xl mx-auto text-center">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="inline-flex items-center gap-2 glass-panel px-4 py-2 mb-8"
        >
          <Sparkles className="w-4 h-4 text-cyan-500" />
          <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>AI Karaoke Maker & Creator</span>
        </motion.div>
        <motion.h1
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className={`font-display text-4xl sm:text-5xl md:text-7xl font-bold mb-6 leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}
        >
          The AI Karaoke Maker<br />
          <span className="text-gradient">For Any Song</span>
        </motion.h1>
        <motion.p
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className={`text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-12 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
        >
          Create a karaoke track from any MP3. Our AI removes the vocals, syncs scrolling lyrics word-by-word, and exports an HD karaoke video - perfect for hard-to-find songs that have no karaoke version.
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
          className={`max-w-2xl mx-auto mt-8 p-4 rounded-xl backdrop-blur-sm ${isDark
              ? 'bg-white/5 border border-white/10'
              : 'bg-gray-50/80 border border-gray-200'
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
          *with edit-before-render feature. All quality tiers available to everyone.
        </motion.div>
      </div>
    </section>
  );
};

const FeaturesSection = ({ isDark }) => {
  const features = [
    { icon: <Mic2 className="w-8 h-8" />, title: 'AI Vocal Removal', description: 'Remove all vocals from any track with studio-quality precision using advanced AI separation.' },
    { icon: <Music className="w-8 h-8" />, title: 'Listen to Isolated Vocals', description: 'Play back the isolated original vocals to assist with timing adjustments and lyric accuracy.' },
    { icon: <FileVideo className="w-8 h-8" />, title: 'Auto Scrolling Lyrics', description: 'AI automatically transcribes and syncs lyrics with smooth, word-level karaoke-style animations in 50+ languages.' },
    { icon: <Sparkles className="w-8 h-8" />, title: 'Customizable Video Export', description: 'Export as MP4 in up to 4K with custom fonts, colors, backgrounds, intro screens, logos, and more.' },
  ];

  return (
    <section id="features" className="py-20 sm:py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ y: 30, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} className="text-center mb-12 sm:mb-16">
          <h2 className={`font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Powerful <span className="text-gradient">Features</span>
          </h2>
          <p className={`text-base sm:text-lg max-w-xl mx-auto ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Everything you need to make professional karaoke tracks from your own music. All features included for everyone.
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
      </div>
    </section>
  );
};

// ============================================
// EVERYTHING INCLUDED SECTION - Features grid
// ============================================
const EverythingIncludedSection = ({ isDark }) => {
  const includedFeatures = [
    { icon: <Music className="w-5 h-5" />, text: 'AI vocal removal' },
    { icon: <Mic2 className="w-5 h-5" />, text: 'Listen to isolated original vocals to assist with adjustments' },
    { icon: <Sparkles className="w-5 h-5" />, text: 'Auto lyrics sync (50+ languages)' },
    { icon: <FileVideo className="w-5 h-5" />, text: 'All display modes (Scroll, Page, Overwrite)' },
    { icon: <Zap className="w-5 h-5" />, text: 'Up to 4K MP4 export' },
    { icon: <Upload className="w-5 h-5" />, text: 'Custom backgrounds (images, video, gradients)' },
    { icon: <FileVideo className="w-5 h-5" />, text: 'Standard and Custom font uploads (.ttf / .otf)' },
    { icon: <Sparkles className="w-5 h-5" />, text: 'Full color control & word highlight effects' },
    { icon: <Check className="w-5 h-5" />, text: 'Logo & watermark overlay' },
    { icon: <FileVideo className="w-5 h-5" />, text: 'Customize your unique intro screen / add logo' },
    { icon: <Music className="w-5 h-5" />, text: 'Duet mode (color-coded singer parts)' },
    { icon: <Check className="w-5 h-5" />, text: 'Save & load favorite style presets' },
    { icon: <Check className="w-5 h-5" />, text: 'Readiness checklist before export' },
    { icon: <Zap className="w-5 h-5" />, text: 'Share via link or QR code for team edits & client approval' },
  ];

  return (
    <section className="py-16 sm:py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className={`font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Everything Included <span className="text-gradient">for Everyone</span>
          </h2>
          <p className={`text-base sm:text-lg max-w-xl mx-auto ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            No tier restrictions. Every feature unlocked from day one.
          </p>
        </motion.div>

        <motion.div
          initial={{ y: 30, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
        >
          {includedFeatures.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.03 }}
              className={`
                flex items-start gap-3 p-4 rounded-xl transition-all
                ${isDark 
                  ? 'bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-cyan-500/30' 
                  : 'bg-gray-50 border border-gray-100 hover:bg-white hover:border-cyan-200 hover:shadow-sm'
                }
              `}
            >
              <div className={`flex-shrink-0 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
                {feature.icon}
              </div>
              <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {feature.text}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

const PricingSection = ({ isDark }) => {
  const [mode, setMode] = useState('subscription');   // 'subscription' or 'credits'
  const [billing, setBilling] = useState('annual');    // 'monthly' or 'annual'
  const [subIndex, setSubIndex] = useState(2);         // default to 250 cr/mo

  const packs = [
    { name: 'Starter',  credits: 40,  price: 4.99,  perCredit: '$0.125', savings: null,  popular: false },
    { name: 'Standard', credits: 110, price: 11.99, perCredit: '$0.11', savings: '13%', popular: false },
    { name: 'Pro',      credits: 280, price: 27.99, perCredit: '$0.10', savings: '20%', popular: true },
    { name: 'Studio',   credits: 600, price: 54.99, perCredit: '$0.09', savings: '26%', popular: false },
  ];

  const subs = [
    { credits: 30,  monthly: 2.99,  annualMo: 2.49,  annualTotal: 29.88  },
    { credits: 60,  monthly: 4.99,  annualMo: 3.99,  annualTotal: 47.88  },
    { credits: 120, monthly: 9.99,  annualMo: 7.99,  annualTotal: 95.88  },
    { credits: 240, monthly: 17.99, annualMo: 14.49, annualTotal: 173.88 },
    { credits: 400, monthly: 29.99, annualMo: 23.99, annualTotal: 287.88 },
  ];

  const sel = subs[subIndex];
  const subPrice = billing === 'annual' ? sel.annualMo : sel.monthly;
  const paygoEquiv = sel.credits * 0.10;
  const savingsPct = Math.round((1 - subPrice / paygoEquiv) * 100);

  return (
    <section id="pricing" className="py-20 sm:py-32 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Heading */}
        <motion.div initial={{ y: 30, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} className="text-center mb-6 sm:mb-8">
          <h2 className={`font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Simple <span className="text-gradient">Credit Pricing</span>
          </h2>
          <p className={`text-base sm:text-lg max-w-xl mx-auto ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            All features included for everyone. Subscribe monthly and save, or buy credits as you go.
          </p>
        </motion.div>

        {/* Free banner - clickable link to signup */}
        <motion.div initial={{ y: 20, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} className="text-center mb-8">
          <Link href="/signup" className={`inline-flex items-center gap-2 px-4 py-2 rounded-full cursor-pointer transition-all hover:scale-105 ${isDark ? 'bg-green-500/10 border border-green-500/30 hover:bg-green-500/20' : 'bg-green-50 border border-green-200 hover:bg-green-100'}`}>
            <Sparkles className="w-4 h-4 text-green-500" />
            <span className={`text-sm font-medium ${isDark ? 'text-green-400' : 'text-green-600'}`}>
              Start free with 19 credits &mdash; no credit card required
            </span>
          </Link>
        </motion.div>

        {/* Mode toggle */}
        <motion.div initial={{ y: 20, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} className="flex justify-center mb-8">
          <div className={`inline-flex rounded-2xl p-1.5 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-100 border border-gray-200'}`}>
            {[
              { key: 'subscription', label: 'Subscribe & Save' },
              { key: 'credits', label: 'Buy Credits' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setMode(tab.key)}
                className={`px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  mode === tab.key
                    ? 'bg-gradient-to-r from-cyan-400 to-purple-500 text-white shadow-lg'
                    : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* ===== SUBSCRIPTION VIEW ===== */}
        {mode === 'subscription' && (
          <motion.div key="sub" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {/* Billing toggle */}
            <div className="flex justify-center mb-6">
              <div className={`inline-flex rounded-xl p-1 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-100 border border-gray-200'}`}>
                {['monthly', 'annual'].map((cycle) => (
                  <button
                    key={cycle}
                    onClick={() => setBilling(cycle)}
                    className={`flex items-center gap-2 px-4 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                      billing === cycle
                        ? isDark ? 'bg-white/10 text-white' : 'bg-white text-gray-900 shadow-sm'
                        : isDark ? 'text-gray-500' : 'text-gray-400'
                    }`}
                  >
                    {cycle === 'monthly' ? 'Monthly' : 'Annual'}
                    {cycle === 'annual' && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-green-500/20 text-green-400">Annual Discount</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Subscription card */}
            <div className="max-w-md mx-auto">
              <div className={`feature-card relative ${isDark ? 'border-cyan-500/50' : 'border-cyan-300'}`}>
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-gradient-to-r from-cyan-400 to-purple-500 text-white text-[10px] sm:text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">BEST VALUE</span>
                </div>

                <h3 className={`font-display text-base sm:text-xl font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Monthly Credit Subscription
                </h3>
                <p className={`text-xs sm:text-sm mb-5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Credits delivered monthly. Change or cancel anytime.
                </p>

                {/* Dropdown */}
                <div className="relative mb-5">
                  <label className={`block text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Credits per month</label>
                  <select
                    value={subIndex}
                    onChange={(e) => setSubIndex(parseInt(e.target.value))}
                    style={{ colorScheme: isDark ? 'dark' : 'light' }}
                    className={`w-full py-3 pl-4 pr-10 rounded-xl text-sm font-medium appearance-none cursor-pointer outline-none transition-colors ${
                      isDark
                        ? 'bg-white/5 border border-white/10 text-white focus:border-cyan-400'
                        : 'bg-white border border-gray-200 text-gray-900 focus:border-cyan-500'
                    }`}
                  >
                    {subs.map((plan, idx) => (
                      <option key={idx} value={idx} className="bg-white text-gray-900 dark:bg-gray-800 dark:text-white">
                        {plan.credits} credits/mo &mdash; ${billing === 'annual' ? plan.annualMo.toFixed(2) : plan.monthly.toFixed(2)}/mo
                      </option>
                    ))}
                  </select>
                  <ChevronDown className={`absolute right-3 top-[calc(50%+10px)] -translate-y-1/2 w-5 h-5 pointer-events-none ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                </div>

                {/* Price summary */}
                <div className={`rounded-xl p-4 mb-5 ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                  <div className="flex items-baseline justify-between mb-2">
                    <div>
                      <span className={`text-3xl sm:text-4xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>${subPrice.toFixed(2)}</span>
                      <span className={`text-sm ml-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>/mo</span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs sm:text-sm font-bold text-green-400">Save {savingsPct}%</div>
                      <div className={`text-[10px] sm:text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>vs. pay-as-you-go</div>
                    </div>
                  </div>
                  <div className={`flex items-center justify-between text-xs sm:text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    <span><span className="font-semibold text-cyan-400">{sel.credits} credits</span> delivered monthly</span>
                    <span>${(subPrice / sel.credits).toFixed(3)}/credit</span>
                  </div>
                  <div className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    Enough for ~{Math.max(1, Math.floor(sel.credits / 46))}&ndash;{Math.floor(sel.credits / 19)} songs/mo (depending on resolution &amp; speed)
                  </div>
                  {billing === 'annual' && (
                    <div className={`mt-2 pt-2 border-t text-[10px] sm:text-xs ${isDark ? 'border-white/10 text-gray-500' : 'border-gray-200 text-gray-400'}`}>
                      Billed as ${sel.annualTotal.toFixed(2)}/year
                    </div>
                  )}
                </div>

                <Link href="/signup">
                  <button className="w-full glass-button-primary glass-button text-sm sm:text-base py-3">
                    Subscribe Now
                  </button>
                </Link>

                <p className={`text-center text-[10px] sm:text-xs mt-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  Just need a one-time purchase?{' '}
                  <button onClick={() => setMode('credits')} className="text-cyan-400 hover:underline font-medium">Buy a credit pack</button>
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ===== CREDIT PACKS VIEW ===== */}
        {mode === 'credits' && (
          <motion.div key="packs" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              {packs.map((pack, i) => (
                <motion.div key={i} initial={{ y: 30, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className={`feature-card relative ${pack.popular ? 'border-cyan-500/50' : ''}`}>
                  {pack.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-gradient-to-r from-cyan-400 to-purple-500 text-white text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-1 rounded-full whitespace-nowrap">BEST VALUE</span>
                    </div>
                  )}
                  {pack.savings && (
                    <div className={`absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold ${
                      isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600'
                    }`}>
                      Save {pack.savings}
                    </div>
                  )}
                  <h3 className={`font-display text-base sm:text-xl font-semibold mb-1 sm:mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{pack.name}</h3>
                  <div className="mb-1 sm:mb-2">
                    <span className={`text-2xl sm:text-4xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{pack.credits}</span>
                    <span className={`text-xs sm:text-base ml-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>credits</span>
                  </div>
                  <div className={`text-xs mb-3 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    Enough for ~{Math.max(1, Math.floor(pack.credits / 46))}&ndash;{Math.floor(pack.credits / 19)} songs
                  </div>
                  <div className="mb-3 sm:mb-6">
                    <span className={`text-lg sm:text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>${pack.price}</span>
                    <span className={`text-xs sm:text-sm ml-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>({pack.perCredit}/cr)</span>
                  </div>
                  <ul className="space-y-1.5 sm:space-y-2 mb-4 sm:mb-6">
                    {[
                      'All features included',
                      'Up to 4K MP4 export',
                      'Credits valid 1 year',
                    ].map((feat, j) => (
                      <li key={j} className={`flex items-start gap-1.5 sm:gap-2 text-xs sm:text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        <Check className="w-3 sm:w-4 h-3 sm:h-4 text-cyan-500 flex-shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/signup">
                    <button className={`w-full ${pack.popular ? 'glass-button-primary' : ''} glass-button text-xs sm:text-base py-2 sm:py-3 ${!pack.popular && (isDark ? 'text-white' : 'text-gray-800')}`}>
                      Buy Credits
                    </button>
                  </Link>
                </motion.div>
              ))}
            </div>

            <p className={`text-center text-xs sm:text-sm mt-6 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              Want automatic monthly credits at a discount?{' '}
              <button onClick={() => setMode('subscription')} className="text-cyan-400 hover:underline font-medium">Check out subscriptions</button>
            </p>
          </motion.div>
        )}

        {/* Link to full pricing page */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mt-6 sm:mt-8"
        >
          <Link href="/pricing" className={`text-xs sm:text-sm ${isDark ? 'text-gray-400 hover:text-cyan-400' : 'text-gray-600 hover:text-cyan-600'} transition-colors`}>
            View credit costs per track, re-render pricing & full details &rarr;
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
          Quality options: <span className="text-cyan-500">540p, 720p, 1080p, and 4K</span> available for everyone
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

// ============================================
// FAQ SECTION - visible Q&As + FAQPage schema
// ============================================
export const homeFaqs = [
  {
    question: 'What is an AI karaoke maker?',
    answer: 'A karaoke maker (also called a karaoke creator) turns a normal song into a karaoke version. Karatrack Studio uses AI to remove the lead vocals from your audio file and add scrolling lyrics that are synced word-by-word, then exports the result as a karaoke video you can play anywhere.',
  },
  {
    question: 'Is Karatrack Studio really a free karaoke maker?',
    answer: 'Yes. Every new account gets 19 free credits - enough to create your first HD karaoke video completely free, with no credit card required. Free exports include a small watermark that is removed with any purchase, and your free credits never expire.',
  },
  {
    question: 'How do I turn an MP3 into a karaoke track?',
    answer: 'Three steps: upload your MP3 (WAV and FLAC work too), let the AI remove the vocals and sync the lyrics automatically, then customize the look and export your karaoke video as an MP4. Most tracks are ready in minutes.',
  },
  {
    question: 'Can I make karaoke versions of hard-to-find songs?',
    answer: 'That is exactly what Karatrack Studio is for. If a song has no official karaoke version - an indie release, a regional hit, an older track, or your own original music - you can create your own karaoke version from any audio file you have the rights to use, in any of 50+ languages.',
  },
  {
    question: 'What languages does the karaoke creator support?',
    answer: 'The AI transcribes and syncs lyrics in 50+ languages, so you can make karaoke tracks for songs in English, Spanish, Japanese, Korean, Tagalog, Vietnamese, Hindi, and many more.',
  },
  {
    question: 'What quality can I export karaoke videos in?',
    answer: 'You can export karaoke videos in 540p, 720p HD, 1080p Full HD, or 4K Ultra HD, with custom fonts, colors, backgrounds, intro screens, and logos. Lyrics stay synced at the word level at every resolution.',
  },
];

const FAQSection = ({ isDark }) => (
  <section id="faq" className="py-20 sm:py-32 px-6">
    <div className="max-w-3xl mx-auto">
      <motion.div initial={{ y: 30, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} className="text-center mb-10 sm:mb-14">
        <h2 className={`font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Karaoke Maker <span className="text-gradient">FAQ</span>
        </h2>
        <p className={`text-base sm:text-lg max-w-xl mx-auto ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          Common questions about creating karaoke tracks with Karatrack Studio.
        </p>
      </motion.div>
      <div className="space-y-3">
        {homeFaqs.map((faq, i) => (
          <details key={i} className={`group rounded-2xl border px-5 py-4 ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'}`}>
            <summary className={`flex items-center justify-between cursor-pointer list-none font-semibold text-sm sm:text-base ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {faq.question}
              <ChevronDown className={`w-5 h-5 flex-shrink-0 ml-3 transition-transform group-open:rotate-180 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
            </summary>
            <p className={`mt-3 text-sm sm:text-base leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {faq.answer}
            </p>
          </details>
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
        <div className={`flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          <Link href="/karaoke-maker" className="hover:text-cyan-500 transition-colors">Karaoke Maker</Link>
          <Link href="/mp3-to-karaoke" className="hover:text-cyan-500 transition-colors">MP3 to Karaoke</Link>
          <Link href="/hard-to-find-karaoke-songs" className="hover:text-cyan-500 transition-colors">Hard-to-Find Songs</Link>
          <Link href="/privacy" className="hover:text-cyan-500 transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-cyan-500 transition-colors">Terms</Link>
          <a href="mailto:support@karatrack.com" className="hover:text-cyan-500 transition-colors">Contact</a>
        </div>
        <div className={`text-xs sm:text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          &copy; {new Date().getFullYear()} Rush Monkey LLC. All rights reserved. Karatrack Studio is a service of Rush Monkey LLC.
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
  const [credits, setCredits] = useState(19);
  
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
        description="Online AI karaoke maker: upload any MP3 and our AI removes the vocals, syncs scrolling lyrics word-by-word, and exports an HD karaoke video. Try it free - your first karaoke track is on us."
        path="/"
        structuredData={[getOrganizationSchema(), getSoftwareAppSchema(), getFAQSchema(homeFaqs)]}
      />
      <div className={isDark ? 'dark' : ''}>
        <div className={`min-h-screen ${isDark ? 'bg-animated-dark' : 'bg-animated-light'}`}>
          <Navigation isDark={isDark} toggleTheme={toggleTheme} credits={credits} />
          
          {/* Hero with parallax screenshot background */}
          <HeroSection isDark={isDark} onWatchDemo={() => setIsVideoModalOpen(true)} />
          
          <FeaturesSection isDark={isDark} />
          
          {/* Everything included features grid */}
          <EverythingIncludedSection isDark={isDark} />
          
          <UploadSection isDark={isDark} />
          <PricingSection isDark={isDark} />
          <FAQSection isDark={isDark} />
          <Footer isDark={isDark} />
          
          {/* Video Modal */}
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