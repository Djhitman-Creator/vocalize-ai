'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
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
  Check
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

const Navigation = ({ isDark, toggleTheme, credits }) => (
  <motion.nav 
    initial={{ y: -20, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    transition={{ duration: 0.5 }}
    className="fixed top-0 left-0 right-0 z-50 px-6 py-4"
  >
    <div className="max-w-7xl mx-auto">
      <div className="glass-panel px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center">
            <Music className="w-6 h-6 text-white" />
          </div>
          <span className="font-display font-bold text-xl text-gradient">VocalizeAI</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className={`text-sm transition-colors ${isDark ? 'text-gray-300 hover:text-cyan-400' : 'text-gray-600 hover:text-cyan-600'}`}>Features</a>
          <a href="#pricing" className={`text-sm transition-colors ${isDark ? 'text-gray-300 hover:text-cyan-400' : 'text-gray-600 hover:text-cyan-600'}`}>Pricing</a>
          <a href="#how-it-works" className={`text-sm transition-colors ${isDark ? 'text-gray-300 hover:text-cyan-400' : 'text-gray-600 hover:text-cyan-600'}`}>How It Works</a>
        </div>
        <div className="flex items-center gap-4">
          <CreditBadge credits={credits} isDark={isDark} />
          <ThemeToggle isDark={isDark} toggle={toggleTheme} />
          <Link href="/signup">
            <button className="glass-button-primary glass-button">Get Started</button>
          </Link>
        </div>
      </div>
    </div>
  </motion.nav>
);

const HeroSection = ({ isDark }) => (
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
        className={`font-display text-5xl md:text-7xl font-bold mb-6 leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}
      >
        Transform Your Music<br />
        <span className="text-gradient">With AI Magic</span>
      </motion.h1>
      <motion.p
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className={`text-lg md:text-xl max-w-2xl mx-auto mb-12 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
      >
        Remove vocals, isolate backing tracks, add scrolling lyrics, and export stunning music videos — all powered by cutting-edge AI.
      </motion.p>
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex flex-col sm:flex-row items-center justify-center gap-4"
      >
        <button className="glass-button-primary glass-button flex items-center gap-2 text-lg px-8 py-4">
          <Upload className="w-5 h-5" />
          Upload Your Track
        </button>
        <button className={`glass-button flex items-center gap-2 text-lg px-8 py-4 ${isDark ? 'text-white' : 'text-gray-800'}`}>
          <Play className="w-5 h-5" />
          Watch Demo
        </button>
      </motion.div>
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="grid grid-cols-3 gap-8 mt-20 max-w-2xl mx-auto"
      >
        {[
          { value: '50K+', label: 'Tracks Processed' },
          { value: '98%', label: 'Accuracy Rate' },
          { value: '<2min', label: 'Processing Time' },
        ].map((stat, i) => (
          <div key={i} className="text-center">
            <div className="font-display text-3xl font-bold text-gradient">{stat.value}</div>
            <div className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{stat.label}</div>
          </div>
        ))}
      </motion.div>
    </div>
  </section>
);

const FeaturesSection = ({ isDark }) => {
  const features = [
    { icon: <Mic2 className="w-8 h-8" />, title: 'Vocal Removal', description: 'Remove all vocals from any track with studio-quality precision using advanced AI separation.' },
    { icon: <Music className="w-8 h-8" />, title: 'Backing Vocal Isolation', description: 'Extract backing vocals while removing lead vocals — perfect for harmonies and remixes.' },
    { icon: <FileVideo className="w-8 h-8" />, title: 'Scrolling Lyrics', description: 'AI automatically transcribes and syncs lyrics with smooth, karaoke-style animations.' },
    { icon: <Sparkles className="w-8 h-8" />, title: 'Video Export', description: 'Export your processed track as a beautiful MP4 or AVI video with custom thumbnails.' },
  ];

  return (
    <section id="features" className="py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ y: 30, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} className="text-center mb-16">
          <h2 className={`font-display text-4xl md:text-5xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Powerful <span className="text-gradient">Features</span>
          </h2>
          <p className={`text-lg max-w-xl mx-auto ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Everything you need to transform your music into professional content.
          </p>
        </motion.div>
        <div className="grid md:grid-cols-2 gap-6">
          {features.map((feature, i) => (
            <motion.div key={i} initial={{ y: 30, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="feature-card group">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400/20 to-purple-500/20 flex items-center justify-center mb-6 group-hover:from-cyan-400/40 group-hover:to-purple-500/40 transition-all">
                <span className="text-cyan-500">{feature.icon}</span>
              </div>
              <h3 className={`font-display text-xl font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>{feature.title}</h3>
              <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const PricingSection = ({ isDark }) => {
  const plans = [
    { name: 'Free', price: 0, features: ['3 credits/month', '10MB max file size', '720p video export', 'Community support'], popular: false },
    { name: 'Starter', price: 9.99, features: ['25 credits/month', '50MB max file size', '1080p video export', 'Email support'], popular: false },
    { name: 'Pro', price: 24.99, features: ['75 credits/month', '100MB max file size', '1080p video export', 'Priority support'], popular: true },
    { name: 'Studio', price: 49.99, features: ['200 credits/month', '500MB max file size', '4K video export', 'Dedicated support'], popular: false },
  ];

  return (
    <section id="pricing" className="py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ y: 30, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} className="text-center mb-16">
          <h2 className={`font-display text-4xl md:text-5xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Simple <span className="text-gradient">Pricing</span>
          </h2>
          <p className={`text-lg max-w-xl mx-auto ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Choose the plan that fits your needs.
          </p>
        </motion.div>
        <div className="grid md:grid-cols-4 gap-6">
          {plans.map((plan, i) => (
            <motion.div key={i} initial={{ y: 30, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className={`feature-card relative ${plan.popular ? 'border-cyan-500/50' : ''}`}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-gradient-to-r from-cyan-400 to-purple-500 text-white text-xs font-bold px-3 py-1 rounded-full">MOST POPULAR</span>
                </div>
              )}
              <h3 className={`font-display text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{plan.name}</h3>
              <div className="mb-6">
                <span className={`text-4xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>${plan.price}</span>
                <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, j) => (
                  <li key={j} className={`flex items-center gap-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    <Check className="w-4 h-4 text-cyan-500" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link href={plan.price === 0 ? '/signup' : '/pricing'}>
                <button className={`w-full ${plan.popular ? 'glass-button-primary' : ''} glass-button ${!plan.popular && (isDark ? 'text-white' : 'text-gray-800')}`}>
                  {plan.price === 0 ? 'Get Started' : 'Subscribe'}
                </button>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const UploadSection = ({ isDark }) => (
  <section id="how-it-works" className="py-32 px-6">
    <div className="max-w-4xl mx-auto">
      <motion.div initial={{ y: 30, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} className="text-center mb-16">
        <h2 className={`font-display text-4xl md:text-5xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          How It <span className="text-gradient">Works</span>
        </h2>
        <p className={`text-lg ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          Three simple steps to transform your music.
        </p>
      </motion.div>
      <motion.div initial={{ y: 30, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} className="dropzone cursor-pointer group">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-cyan-400/20 to-purple-500/20 flex items-center justify-center group-hover:from-cyan-400/40 group-hover:to-purple-500/40 transition-all">
          <Upload className="w-10 h-10 text-cyan-500" />
        </div>
        <h3 className={`font-display text-2xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Drop your audio file here</h3>
        <p className={`mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>or click to browse • MP3, WAV, FLAC supported</p>
        <div className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
          Max file size: <span className="text-cyan-500">100MB</span>
        </div>
      </motion.div>
      <div className="grid md:grid-cols-3 gap-8 mt-16">
        {[
          { step: '01', title: 'Upload', desc: 'Drop your audio file' },
          { step: '02', title: 'Process', desc: 'AI works its magic' },
          { step: '03', title: 'Export', desc: 'Download your video' },
        ].map((item, i) => (
          <motion.div key={i} initial={{ y: 20, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="text-center">
            <div className="font-display text-5xl font-bold text-gradient mb-4">{item.step}</div>
            <h4 className={`font-semibold text-lg mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.title}</h4>
            <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>{item.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

const Footer = ({ isDark }) => (
  <footer className={`py-12 px-6 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center">
            <Music className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-bold text-gradient">VocalizeAI</span>
        </div>
        <div className={`flex items-center gap-8 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          <a href="#" className="hover:text-cyan-500 transition-colors">Privacy</a>
          <a href="#" className="hover:text-cyan-500 transition-colors">Terms</a>
          <a href="#" className="hover:text-cyan-500 transition-colors">Contact</a>
        </div>
        <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          © 2024 VocalizeAI. All rights reserved.
        </div>
      </div>
    </div>
  </footer>
);

export default function HomePage() {
  const [isDark, setIsDark] = useState(true);
  const [credits, setCredits] = useState(25);

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className={`min-h-screen ${isDark ? 'bg-animated-dark' : 'bg-animated-light'}`}>
        <Navigation isDark={isDark} toggleTheme={toggleTheme} credits={credits} />
        <HeroSection isDark={isDark} />
        <FeaturesSection isDark={isDark} />
        <UploadSection isDark={isDark} />
        <PricingSection isDark={isDark} />
        <Footer isDark={isDark} />
      </div>
    </div>
  );
}