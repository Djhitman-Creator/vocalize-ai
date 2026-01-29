'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Music,
  Check,
  Zap,
  ArrowLeft,
  Sparkles,
  Clock,
  Download,
  Gift,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Video,
  Star,
  Fuel
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import SEO, { getOrganizationSchema } from '../components/SEO';
import AppNavigation from '../components/AppNavigation';
import { useTheme } from '../context/ThemeContext';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Credit packs
const creditPacks = [
  {
    id: 'starter',
    name: 'Starter',
    credits: 50,
    price: 4.99,
    perCredit: 0.10,
    savings: null,
    description: 'Perfect to try it out',
    popular: false,
  },
  {
    id: 'standard',
    name: 'Standard',
    credits: 150,
    price: 11.99,
    perCredit: 0.08,
    savings: '20%',
    description: 'Great for casual creators',
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    credits: 400,
    price: 27.99,
    perCredit: 0.07,
    savings: '30%',
    description: 'Best for regular use',
    popular: true,
  },
  {
    id: 'studio',
    name: 'Studio',
    credits: 1000,
    price: 54.99,
    perCredit: 0.055,
    savings: '45%',
    description: 'Maximum value for power users',
    popular: false,
  },
];

// Quality tiers with credit costs
const qualityTiers = [
  { quality: '540p', resolution: '960×540', queueCredits: 1, instantCredits: 2, description: 'SD - Fast render' },
  { quality: '720p', resolution: '1280×720', queueCredits: 2, instantCredits: 4, description: 'HD - Great quality' },
  { quality: '1080p', resolution: '1920×1080', queueCredits: 3, instantCredits: 6, description: 'Full HD - YouTube ready' },
  { quality: '4K', resolution: '3840×2160', queueCredits: 5, instantCredits: 10, description: 'Ultra HD - Maximum quality' },
];

// What's included for everyone
const includedFeatures = [
  { icon: Music, text: 'AI vocal removal' },
  { icon: Sparkles, text: 'Auto lyrics sync' },
  { icon: Video, text: 'All display modes (Scroll, Page, Overwrite)' },
  { icon: Download, text: 'Up to 4K video export' },
  { icon: Star, text: 'Custom fonts & colors' },
  { icon: Gift, text: 'Background images & videos' },
  { icon: CreditCard, text: 'Logo/branding options' },
  { icon: Clock, text: 'Presets to save your style' },
];

// FAQ items
const faqItems = [
  {
    question: 'How do credits work?',
    answer: 'Credits are used when you export a video. The cost depends on video quality and length. For example, a 4-minute song at 720p quality costs 8 credits (2 credits/min × 4 min). Higher quality = more credits per minute.'
  },
  {
    question: 'Do credits expire?',
    answer: 'Purchased credits are valid for 1 year from the date of purchase. Plenty of time to use them!'
  },
  {
    question: "What's the difference between Queue and Instant?",
    answer: 'Queue mode processes your video in order with other users - it\'s more affordable but may take longer during busy times (5-15 min). Instant mode skips the queue and starts rendering immediately (under 2 min), but costs 2x the credits.'
  },
  {
    question: 'What do I get with a free account?',
    answer: 'Every new account gets 15 free credits - enough to create your first karaoke video and try all the features. You\'ll see exactly what Karatrack can do before purchasing more credits.'
  },
  {
    question: 'Is there a watermark on free videos?',
    answer: 'Free account exports include a small "Made with Karatrack.com" watermark. Any purchased credits remove the watermark automatically.'
  },
  {
    question: 'Can I use my own music?',
    answer: 'Yes! Upload any audio file (MP3, WAV, FLAC, etc.) and Karatrack will remove the vocals, sync the lyrics, and create your karaoke video. We support songs in 50+ languages.'
  },
];

export default function Pricing() {
  const router = useRouter();
  const { isDark } = useTheme();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [selectedPack, setSelectedPack] = useState('pro');

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    } catch (error) {
      console.error('Auth error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (packId) => {
    if (!user) {
      router.push('/signup?redirect=pricing');
      return;
    }
    
    // TODO: Integrate with Stripe checkout
    console.log('Purchasing pack:', packId);
    // router.push(`/checkout?pack=${packId}`);
  };

  return (
    <>
      <SEO
        title="Pricing - Credit Packs | Karatrack Studio"
        description="Simple, transparent pricing. Buy credits and use them whenever you want. No subscriptions, no limits. All features included for everyone."
        canonical="https://studio.karatrack.com/pricing"
        additionalSchema={[getOrganizationSchema()]}
      />

      <div className={`min-h-screen ${isDark ? 'bg-[#0A0A0F]' : 'bg-[#F8FAFC]'}`}>
        <AppNavigation />

        <main className="max-w-6xl mx-auto px-4 py-12">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 ${
              isDark 
                ? 'bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30' 
                : 'bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30'
            }`}>
              <Fuel className="w-4 h-4 text-[var(--accent-primary)]" />
              <span className="text-sm font-medium text-[var(--accent-primary)]">Simple Credit System</span>
            </div>
            
            <h1 className={`text-4xl md:text-5xl font-bold mb-4 ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
              No subscriptions. No limits.
              <br />
              <span className="text-gradient">Just credits.</span>
            </h1>
            
            <p className={`text-lg max-w-2xl mx-auto ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
              Buy credits when you need them. All features included for everyone.
              Start free with 15 credits to try everything.
            </p>
          </motion.div>

          {/* Free Account Banner */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-panel mb-12 p-6"
          >
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${isDark ? 'bg-green-500/20' : 'bg-green-100'}`}>
                  <Gift className="w-8 h-8 text-green-500" />
                </div>
                <div>
                  <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
                    Start Free with 15 Credits
                  </h3>
                  <p className={`${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
                    Create your first karaoke video and try all features - no credit card required
                  </p>
                </div>
              </div>
              {!user && (
                <Link
                  href="/signup"
                  className="glass-button glass-button-primary whitespace-nowrap"
                >
                  Create Free Account
                </Link>
              )}
            </div>
          </motion.div>

          {/* Credit Packs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-16"
          >
            <h2 className={`text-2xl font-bold text-center mb-8 ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
              Credit Packs
            </h2>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {creditPacks.map((pack, idx) => (
                <motion.div
                  key={pack.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * idx }}
                  className={`relative glass-panel p-6 cursor-pointer transition-all hover:scale-[1.02] ${
                    pack.popular ? 'ring-2 ring-[var(--accent-primary)]' : ''
                  }`}
                  onClick={() => setSelectedPack(pack.id)}
                >
                  {pack.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[var(--accent-primary)] text-[#0A0A0F] text-xs font-bold">
                      BEST VALUE
                    </div>
                  )}
                  
                  {pack.savings && (
                    <div className={`absolute top-4 right-4 px-2 py-1 rounded-full text-xs font-bold ${
                      isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600'
                    }`}>
                      Save {pack.savings}
                    </div>
                  )}
                  
                  <h3 className={`text-lg font-bold mb-1 ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
                    {pack.name}
                  </h3>
                  <p className={`text-sm mb-4 ${isDark ? 'text-[#64748B]' : 'text-[#94A3B8]'}`}>
                    {pack.description}
                  </p>
                  
                  <div className="mb-4">
                    <span className={`text-4xl font-bold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
                      {pack.credits}
                    </span>
                    <span className={`text-lg ml-1 ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
                      credits
                    </span>
                  </div>
                  
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
                      ${pack.price}
                    </span>
                    <span className={`text-sm ${isDark ? 'text-[#64748B]' : 'text-[#94A3B8]'}`}>
                      (${pack.perCredit}/credit)
                    </span>
                  </div>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePurchase(pack.id);
                    }}
                    className={`w-full py-3 rounded-xl font-semibold transition-all ${
                      pack.popular
                        ? 'glass-button-primary'
                        : 'glass-button'
                    }`}
                  >
                    Buy Credits
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Credit Cost Calculator */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-panel mb-16 p-6"
          >
            <h2 className={`text-2xl font-bold text-center mb-6 ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
              Credit Cost per Minute
            </h2>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${isDark ? 'border-white/10' : 'border-black/10'}`}>
                    <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>Quality</th>
                    <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>Resolution</th>
                    <th className={`text-center py-3 px-4 font-medium ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
                      <div className="flex items-center justify-center gap-2">
                        <Clock className="w-4 h-4" />
                        Queue
                      </div>
                    </th>
                    <th className={`text-center py-3 px-4 font-medium ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
                      <div className="flex items-center justify-center gap-2">
                        <Zap className="w-4 h-4 text-[var(--accent-secondary)]" />
                        Instant
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {qualityTiers.map((tier) => (
                    <tr key={tier.quality} className={`border-b ${isDark ? 'border-white/5' : 'border-black/5'}`}>
                      <td className={`py-4 px-4 ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
                        <span className="font-bold">{tier.quality}</span>
                        {tier.quality === '4K' && (
                          <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                            isDark ? 'bg-[var(--accent-secondary)]/20 text-[var(--accent-secondary)]' : 'bg-purple-100 text-purple-600'
                          }`}>
                            Exclusive
                          </span>
                        )}
                      </td>
                      <td className={`py-4 px-4 ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
                        {tier.resolution}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`px-3 py-1 rounded-full font-medium ${
                          isDark ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]' : 'bg-cyan-100 text-cyan-700'
                        }`}>
                          {tier.queueCredits} cr/min
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`px-3 py-1 rounded-full font-medium ${
                          isDark ? 'bg-[var(--accent-secondary)]/20 text-[var(--accent-secondary)]' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {tier.instantCredits} cr/min
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className={`mt-6 p-4 rounded-xl ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
              <p className={`text-sm ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
                <strong>Example:</strong> A 4-minute song at 1080p quality using Queue mode = 3 credits/min × 4 min = <strong className="text-[var(--accent-primary)]">12 credits</strong>
              </p>
            </div>
          </motion.div>

          {/* What's Included */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-16"
          >
            <h2 className={`text-2xl font-bold text-center mb-8 ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
              Everything Included for Everyone
            </h2>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {includedFeatures.map((feature, idx) => (
                <div
                  key={idx}
                  className="glass-panel flex items-center gap-3 p-4"
                >
                  <div className={`p-2 rounded-lg ${isDark ? 'bg-[var(--accent-primary)]/20' : 'bg-cyan-100'}`}>
                    <feature.icon className="w-5 h-5 text-[var(--accent-primary)]" />
                  </div>
                  <span className={`font-medium ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
                    {feature.text}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* FAQ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mb-16"
          >
            <h2 className={`text-2xl font-bold text-center mb-8 ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
              Frequently Asked Questions
            </h2>
            
            <div className="max-w-3xl mx-auto space-y-3">
              {faqItems.map((item, idx) => (
                <div
                  key={idx}
                  className="glass-panel overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                    className={`w-full flex items-center justify-between p-4 text-left transition-colors ${
                      isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'
                    }`}
                  >
                    <span className={`font-medium ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
                      {item.question}
                    </span>
                    {expandedFaq === idx ? (
                      <ChevronUp className={`w-5 h-5 ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`} />
                    ) : (
                      <ChevronDown className={`w-5 h-5 ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`} />
                    )}
                  </button>
                  
                  {expandedFaq === idx && (
                    <div className={`px-4 pb-4 ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
                      {item.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="glass-panel text-center p-8"
          >
            <h2 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
              Ready to create your first karaoke video?
            </h2>
            <p className={`mb-6 ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
              Start free with 15 credits. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {user ? (
                <Link
                  href="/dashboard"
                  className="glass-button glass-button-primary"
                >
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/signup"
                    className="glass-button glass-button-primary"
                  >
                    Create Free Account
                  </Link>
                  <Link
                    href="/login"
                    className="glass-button"
                  >
                    Sign In
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        </main>

        {/* Footer */}
        <footer className={`mt-16 py-8 border-t ${isDark ? 'border-white/10' : 'border-black/10'}`}>
          <div className="max-w-6xl mx-auto px-4 text-center">
            <p className={`text-sm ${isDark ? 'text-[#64748B]' : 'text-[#94A3B8]'}`}>
              © {new Date().getFullYear()} Karatrack. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
