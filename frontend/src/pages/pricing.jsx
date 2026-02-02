'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Music,
  Check,
  Zap,
  Sparkles,
  Clock,
  Download,
  Gift,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Video,
  Star,
  Fuel,
  Crown,
  Mic2,
  Palette,
  Type,
  Image,
  Layers,
  Shield,
  Repeat,
  Users,
  Globe,
  Wand2,
  MonitorPlay,
  BadgePercent,
  ArrowRight,
  Info
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import SEO, { getOrganizationSchema } from '../components/SEO';
import AppNavigation from '../components/AppNavigation';
import { useTheme } from '../context/ThemeContext';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ============================================
// PAY-AS-YOU-GO CREDIT PACKS (Regular Price)
// ============================================
const creditPacks = [
  { credits: 10,   price: 1.99,  perCredit: 0.199 },
  { credits: 25,   price: 3.99,  perCredit: 0.160 },
  { credits: 50,   price: 6.99,  perCredit: 0.140 },
  { credits: 100,  price: 11.99, perCredit: 0.120 },
  { credits: 250,  price: 27.99, perCredit: 0.112 },
  { credits: 500,  price: 49.99, perCredit: 0.100 },
  { credits: 1000, price: 89.99, perCredit: 0.090 },
];

// ============================================
// SUBSCRIPTION PLANS (Discounted Credits)
// ============================================
const subscriptionOptions = [
  { credits: 50,   monthlyPrice: 2.99,  annualMonthlyPrice: 2.49,  annualPrice: 29.88   },
  { credits: 100,  monthlyPrice: 4.99,  annualMonthlyPrice: 3.99,  annualPrice: 47.88   },
  { credits: 250,  monthlyPrice: 9.99,  annualMonthlyPrice: 7.99,  annualPrice: 95.88   },
  { credits: 500,  monthlyPrice: 17.99, annualMonthlyPrice: 14.49, annualPrice: 173.88  },
  { credits: 1000, monthlyPrice: 29.99, annualMonthlyPrice: 23.99, annualPrice: 287.88  },
];

// ============================================
// QUALITY TIERS (Credit costs per minute)
// ============================================
const qualityTiers = [
  { quality: '480p',  resolution: '854×480',   credits: 3, description: 'SD — Quick drafts' },
  { quality: '720p',  resolution: '1280×720',  credits: 5, description: 'HD — Great quality' },
  { quality: '1080p', resolution: '1920×1080', credits: 7, description: 'Full HD — YouTube ready' },
  { quality: '4K',    resolution: '3840×2160', credits: 9, description: 'Ultra HD — Maximum quality' },
];

// ============================================
// FEATURES LIST — What you get
// ============================================
const allFeatures = [
  {
    category: 'AI-Powered Audio',
    items: [
      { icon: Music, text: 'AI vocal removal — isolate or remove vocals instantly' },
      { icon: Mic2, text: 'Backing vocal isolation — keep harmonies, remove lead' },
      { icon: Sparkles, text: 'Auto lyrics sync — word-level timing powered by AI' },
      { icon: Globe, text: '50+ language support for lyrics transcription' },
    ]
  },
  {
    category: 'Video Customization',
    items: [
      { icon: MonitorPlay, text: 'Multiple display modes — Scroll, Page, Overwrite' },
      { icon: Image, text: 'Custom backgrounds — images, videos, gradients, solid colors' },
      { icon: Layers, text: 'Custom intro screen with thumbnail upload' },
      { icon: Shield, text: 'Logo & watermark branding overlay' },
    ]
  },
  {
    category: 'Styling & Effects',
    items: [
      { icon: Type, text: 'Custom font uploads — use any .ttf or .otf font' },
      { icon: Palette, text: 'Full color control — text, outline, sung/highlight colors' },
      { icon: Wand2, text: 'Word effects — glow, sweep highlight, shadow styling' },
      { icon: Star, text: 'Save & load presets — your style, one click' },
    ]
  },
  {
    category: 'Export & Output',
    items: [
      { icon: Download, text: 'Up to 4K MP4 export — crisp, professional output' },
      { icon: Users, text: 'Duet mode — color-coded parts for two singers' },
      { icon: Repeat, text: 'Re-export unlimited — tweak and re-render at no extra cost' },
      { icon: Video, text: 'WYSIWYG editor — what you preview is what you get' },
    ]
  },
];

// ============================================
// FAQ
// ============================================
const faqItems = [
  {
    question: 'How do credits work?',
    answer: 'Credits are used when you process and export a video. The cost depends on video quality. For example, a typical 4-minute song at 1080p costs about 7 credits. Higher resolution = more credits. You can preview and customize your video unlimited times before spending any credits on the final export.'
  },
  {
    question: 'What\'s the difference between credit packs and a subscription?',
    answer: 'Credit packs are one-time purchases at regular price — buy what you need, when you need it. No commitment. Subscriptions give you a monthly credit reload at a significantly reduced per-credit rate, plus annual billing saves you even more. Both options unlock 100% of features.'
  },
  {
    question: 'Do credits expire?',
    answer: 'Credits from one-time packs are valid for 1 year. Subscription credits are valid for 90 days. Your free signup credits never expire — take your time!'
  },
  {
    question: 'What do I get with a free account?',
    answer: 'Every new account gets 15 free credits — enough to create 2-3 karaoke videos and try every single feature. No credit card required. Free exports include a small watermark which is removed with any purchase.'
  },
  {
    question: 'Can I cancel my subscription anytime?',
    answer: 'Absolutely. Cancel anytime from your dashboard. You\'ll keep your remaining credits and access until they\'re used up. No cancellation fees, no hassle.'
  },
  {
    question: 'Can I buy extra credits on top of my subscription?',
    answer: 'Yes! Subscribers can purchase additional credit packs at any time. Subscription credits and purchased credits are tracked separately so you always know what you have.'
  },
  {
    question: 'Is there a watermark on free videos?',
    answer: 'Free account exports include a small "Made with Karatrack" watermark. Any credit purchase or subscription removes it automatically on all future exports.'
  },
  {
    question: 'What audio formats are supported?',
    answer: 'Upload MP3, WAV, FLAC, AAC, OGG, M4A, and more. Karatrack handles the conversion — just upload and go.'
  },
];

// ============================================
// COMPONENT
// ============================================
export default function Pricing() {
  const router = useRouter();
  const { isDark } = useTheme();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedFaq, setExpandedFaq] = useState(null);

  // Purchase mode: 'credits' or 'subscription'
  const [purchaseMode, setPurchaseMode] = useState('subscription');

  // Credit pack selector (dropdown index)
  const [selectedPackIndex, setSelectedPackIndex] = useState(3); // default 100 credits

  // Subscription selector
  const [selectedSubIndex, setSelectedSubIndex] = useState(2); // default 250 credits
  const [billingCycle, setBillingCycle] = useState('annual'); // 'monthly' or 'annual'

  // Feature section expand
  const [featuresExpanded, setFeaturesExpanded] = useState(false);

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

  const handlePurchaseCredits = async () => {
    if (!user) {
      router.push('/signup?redirect=pricing');
      return;
    }
    const pack = creditPacks[selectedPackIndex];
    // TODO: Stripe checkout for credit pack
    console.log('Purchasing credit pack:', pack);
  };

  const handleSubscribe = async () => {
    if (!user) {
      router.push('/signup?redirect=pricing');
      return;
    }
    const sub = subscriptionOptions[selectedSubIndex];
    // TODO: Stripe checkout for subscription
    console.log('Subscribing:', sub, billingCycle);
  };

  // Helper: compute savings for subscription vs pay-as-you-go
  const getSubSavings = (subOption) => {
    // Find equivalent pay-as-you-go price for same credits
    const paygoEquivalent = subOption.credits * 0.12; // ~$0.12 baseline per credit
    const subPrice = billingCycle === 'annual' ? subOption.annualMonthlyPrice : subOption.monthlyPrice;
    const pct = Math.round((1 - subPrice / paygoEquivalent) * 100);
    return pct;
  };

  const selectedPack = creditPacks[selectedPackIndex];
  const selectedSub = subscriptionOptions[selectedSubIndex];
  const subPrice = billingCycle === 'annual' ? selectedSub.annualMonthlyPrice : selectedSub.monthlyPrice;
  const subPerCredit = subPrice / selectedSub.credits;

  return (
    <>
      <SEO
        title="Pricing — Credits & Subscriptions | Karatrack Studio"
        description="Create professional karaoke videos with AI. Buy credits as you go or save with a subscription. All features included. Start free with 15 credits."
        canonical="https://studio.karatrack.com/pricing"
        additionalSchema={[getOrganizationSchema()]}
      />

      <div className={`min-h-screen ${isDark ? 'bg-[#0A0A0F]' : 'bg-[#F8FAFC]'}`}>
        <AppNavigation />

        <main className="max-w-6xl mx-auto px-4 py-12">

          {/* ============================================ */}
          {/* HERO HEADER */}
          {/* ============================================ */}
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
              <span className="text-sm font-medium text-[var(--accent-primary)]">Flexible Pricing</span>
            </div>

            <h1 className={`text-4xl md:text-5xl font-bold mb-4 ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
              Turn any song into a
              <br />
              <span className="text-gradient">professional karaoke video.</span>
            </h1>

            <p className={`text-lg max-w-2xl mx-auto ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
              AI-powered vocal removal, word-level lyrics sync, and a full video editor —
              all in your browser. Buy credits when you need them or subscribe and save.
            </p>
          </motion.div>

          {/* ============================================ */}
          {/* FREE ACCOUNT BANNER */}
          {/* ============================================ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-panel mb-10 p-6"
          >
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${isDark ? 'bg-green-500/20' : 'bg-green-100'}`}>
                  <Gift className="w-8 h-8 text-green-500" />
                </div>
                <div>
                  <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
                    Start Free — 15 Credits Included
                  </h3>
                  <p className={`${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
                    Enough to create 2-3 full karaoke videos. Every feature unlocked. No credit card needed.
                  </p>
                </div>
              </div>
              {!user && (
                <Link
                  href="/signup"
                  className="glass-button glass-button-primary whitespace-nowrap flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Create Free Account
                </Link>
              )}
            </div>
          </motion.div>

          {/* ============================================ */}
          {/* PURCHASE MODE TOGGLE */}
          {/* ============================================ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex justify-center mb-8"
          >
            <div className={`inline-flex rounded-2xl p-1.5 ${
              isDark ? 'bg-white/5 border border-white/10' : 'bg-black/5 border border-black/10'
            }`}>
              <button
                onClick={() => setPurchaseMode('subscription')}
                className={`px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${
                  purchaseMode === 'subscription'
                    ? 'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white shadow-lg'
                    : isDark ? 'text-[#94A3B8] hover:text-white' : 'text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                <Crown className="w-4 h-4" />
                Subscribe & Save
              </button>
              <button
                onClick={() => setPurchaseMode('credits')}
                className={`px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${
                  purchaseMode === 'credits'
                    ? 'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white shadow-lg'
                    : isDark ? 'text-[#94A3B8] hover:text-white' : 'text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                Buy Credits
              </button>
            </div>
          </motion.div>

          {/* ============================================ */}
          {/* SUBSCRIPTION MODE */}
          {/* ============================================ */}
          {purchaseMode === 'subscription' && (
            <motion.div
              key="subscription"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-16"
            >
              {/* Billing Cycle Toggle */}
              <div className="flex justify-center mb-8">
                <div className={`inline-flex rounded-xl p-1 ${
                  isDark ? 'bg-white/5 border border-white/10' : 'bg-black/5 border border-black/10'
                }`}>
                  <button
                    onClick={() => setBillingCycle('monthly')}
                    className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                      billingCycle === 'monthly'
                        ? isDark ? 'bg-white/10 text-white' : 'bg-white text-[#0F172A] shadow-sm'
                        : isDark ? 'text-[#94A3B8]' : 'text-[#475569]'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setBillingCycle('annual')}
                    className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                      billingCycle === 'annual'
                        ? isDark ? 'bg-white/10 text-white' : 'bg-white text-[#0F172A] shadow-sm'
                        : isDark ? 'text-[#94A3B8]' : 'text-[#475569]'
                    }`}
                  >
                    Annual
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-500/20 text-green-400">
                      Save ~20%
                    </span>
                  </button>
                </div>
              </div>

              {/* Subscription Card */}
              <div className="max-w-xl mx-auto">
                <div className={`glass-panel p-8 relative overflow-hidden ${
                  isDark ? 'border-[var(--accent-primary)]/30' : 'border-[var(--accent-primary)]/20'
                }`} style={{ borderWidth: '1px' }}>
                  {/* Best Value Badge */}
                  <div className="absolute top-0 right-0">
                    <div className="bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white text-xs font-bold px-4 py-1.5 rounded-bl-xl">
                      BEST VALUE
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-[var(--accent-primary)]/20 to-[var(--accent-secondary)]/20">
                      <Crown className="w-6 h-6 text-[var(--accent-primary)]" />
                    </div>
                    <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
                      Monthly Credit Subscription
                    </h2>
                  </div>

                  <p className={`text-sm mb-6 ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
                    Choose how many credits you receive each {billingCycle === 'annual' ? 'month (billed annually)' : 'month'}. Change or cancel anytime.
                  </p>

                  {/* Credit Amount Dropdown */}
                  <div className="mb-6">
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-[#CBD5E1]' : 'text-[#334155]'}`}>
                      Credits per month
                    </label>
                    <div className="relative">
                      <select
                        value={selectedSubIndex}
                        onChange={(e) => setSelectedSubIndex(parseInt(e.target.value))}
                        className={`w-full px-4 py-3.5 rounded-xl text-base font-medium appearance-none cursor-pointer transition-all
                          ${isDark
                            ? 'bg-white/5 border border-white/10 text-white hover:border-[var(--accent-primary)]/50 focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20'
                            : 'bg-white border border-black/10 text-[#0F172A] hover:border-[var(--accent-primary)]/50 focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20'
                          } outline-none`}
                      >
                        {subscriptionOptions.map((opt, idx) => (
                          <option key={idx} value={idx}>
                            {opt.credits} credits/month — ${billingCycle === 'annual' ? opt.annualMonthlyPrice.toFixed(2) : opt.monthlyPrice.toFixed(2)}/mo
                          </option>
                        ))}
                      </select>
                      <ChevronDown className={`absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`} />
                    </div>
                  </div>

                  {/* Price Display */}
                  <div className={`rounded-xl p-5 mb-6 ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
                    <div className="flex items-baseline justify-between mb-3">
                      <div>
                        <span className={`text-4xl font-bold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
                          ${subPrice.toFixed(2)}
                        </span>
                        <span className={`text-base ml-1 ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
                          /month
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-green-400">
                          Save {getSubSavings(selectedSub)}%
                        </div>
                        <div className={`text-xs ${isDark ? 'text-[#64748B]' : 'text-[#94A3B8]'}`}>
                          vs. pay-as-you-go
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className={`text-sm ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
                        <span className="font-medium text-[var(--accent-primary)]">{selectedSub.credits} credits</span> delivered monthly
                      </div>
                      <div className={`text-sm ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
                        ${subPerCredit.toFixed(3)}/credit
                      </div>
                    </div>

                    {billingCycle === 'annual' && (
                      <div className={`mt-3 pt-3 border-t text-sm ${isDark ? 'border-white/10 text-[#64748B]' : 'border-black/10 text-[#94A3B8]'}`}>
                        Billed as ${selectedSub.annualPrice.toFixed(2)}/year (${selectedSub.annualMonthlyPrice.toFixed(2)} × 12)
                      </div>
                    )}
                  </div>

                  {/* Subscribe Button */}
                  <button
                    onClick={handleSubscribe}
                    className="w-full py-4 rounded-xl font-bold text-lg text-white bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] hover:shadow-lg hover:shadow-[var(--accent-primary)]/25 transition-all duration-300 flex items-center justify-center gap-2"
                  >
                    <Crown className="w-5 h-5" />
                    {user ? 'Subscribe Now' : 'Sign Up & Subscribe'}
                  </button>

                  <p className={`text-xs text-center mt-3 ${isDark ? 'text-[#64748B]' : 'text-[#94A3B8]'}`}>
                    Cancel anytime. Credits valid for 90 days. All features included.
                  </p>
                </div>

                {/* "Or buy credits" nudge */}
                <div className="text-center mt-6">
                  <button
                    onClick={() => setPurchaseMode('credits')}
                    className={`text-sm font-medium inline-flex items-center gap-1 transition-colors ${
                      isDark ? 'text-[#94A3B8] hover:text-white' : 'text-[#475569] hover:text-[#0F172A]'
                    }`}
                  >
                    Prefer no commitment? Buy credits instead <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ============================================ */}
          {/* PAY-AS-YOU-GO CREDIT PACKS MODE */}
          {/* ============================================ */}
          {purchaseMode === 'credits' && (
            <motion.div
              key="credits"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-16"
            >
              <div className="max-w-xl mx-auto">
                <div className="glass-panel p-8">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-xl ${isDark ? 'bg-[var(--accent-primary)]/20' : 'bg-cyan-100'}`}>
                      <CreditCard className="w-6 h-6 text-[var(--accent-primary)]" />
                    </div>
                    <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
                      Buy Credits
                    </h2>
                  </div>

                  <p className={`text-sm mb-6 ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
                    One-time purchase. No subscription, no commitment. Credits are valid for 1 year.
                  </p>

                  {/* Pack Dropdown */}
                  <div className="mb-6">
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-[#CBD5E1]' : 'text-[#334155]'}`}>
                      Select credit amount
                    </label>
                    <div className="relative">
                      <select
                        value={selectedPackIndex}
                        onChange={(e) => setSelectedPackIndex(parseInt(e.target.value))}
                        className={`w-full px-4 py-3.5 rounded-xl text-base font-medium appearance-none cursor-pointer transition-all
                          ${isDark
                            ? 'bg-white/5 border border-white/10 text-white hover:border-[var(--accent-primary)]/50 focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20'
                            : 'bg-white border border-black/10 text-[#0F172A] hover:border-[var(--accent-primary)]/50 focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20'
                          } outline-none`}
                      >
                        {creditPacks.map((pack, idx) => (
                          <option key={idx} value={idx}>
                            {pack.credits} credits — ${pack.price.toFixed(2)}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className={`absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`} />
                    </div>
                  </div>

                  {/* Price Display */}
                  <div className={`rounded-xl p-5 mb-6 ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
                    <div className="flex items-baseline justify-between mb-2">
                      <div>
                        <span className={`text-4xl font-bold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
                          ${selectedPack.price.toFixed(2)}
                        </span>
                        <span className={`text-base ml-1 ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
                          one-time
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className={`text-sm ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
                        <span className="font-medium text-[var(--accent-primary)]">{selectedPack.credits} credits</span>
                      </div>
                      <div className={`text-sm ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
                        ${selectedPack.perCredit.toFixed(3)}/credit
                      </div>
                    </div>
                  </div>

                  {/* Buy Button */}
                  <button
                    onClick={handlePurchaseCredits}
                    className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 flex items-center justify-center gap-2 ${
                      isDark
                        ? 'bg-white/10 text-white border border-white/20 hover:bg-white/15 hover:border-white/30'
                        : 'bg-[#0F172A] text-white hover:bg-[#1E293B]'
                    }`}
                  >
                    <CreditCard className="w-5 h-5" />
                    {user ? 'Buy Credits' : 'Sign Up & Buy'}
                  </button>

                  <p className={`text-xs text-center mt-3 ${isDark ? 'text-[#64748B]' : 'text-[#94A3B8]'}`}>
                    No subscription. Credits valid for 1 year. All features included.
                  </p>
                </div>

                {/* Savings hint — subscribe nudge */}
                <div className={`mt-6 glass-panel p-4 flex items-start gap-3 ${
                  isDark ? 'border-green-500/20' : 'border-green-500/20'
                }`} style={{ borderWidth: '1px' }}>
                  <BadgePercent className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
                      Want to save up to 60%?
                    </p>
                    <p className={`text-sm ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
                      Subscribers get the same credits at a much lower per-credit cost.{' '}
                      <button
                        onClick={() => setPurchaseMode('subscription')}
                        className="text-[var(--accent-primary)] font-medium hover:underline"
                      >
                        See subscription plans →
                      </button>
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ============================================ */}
          {/* CREDIT COST TABLE */}
          {/* ============================================ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-panel mb-16 p-6"
          >
            <h2 className={`text-2xl font-bold text-center mb-2 ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
              How Credits Are Used
            </h2>
            <p className={`text-sm text-center mb-6 ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
              Credits are consumed per song based on the export quality you choose.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${isDark ? 'border-white/10' : 'border-black/10'}`}>
                    <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>Quality</th>
                    <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>Resolution</th>
                    <th className={`text-center py-3 px-4 font-medium ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
                      <div className="flex items-center justify-center gap-2">
                        <Fuel className="w-4 h-4" />
                        Credits / Song
                      </div>
                    </th>
                    <th className={`text-left py-3 px-4 font-medium hidden sm:table-cell ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>Description</th>
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
                            Premium
                          </span>
                        )}
                      </td>
                      <td className={`py-4 px-4 ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
                        {tier.resolution}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`px-3 py-1 rounded-full font-bold ${
                          isDark ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]' : 'bg-cyan-100 text-cyan-700'
                        }`}>
                          {tier.credits} credits
                        </span>
                      </td>
                      <td className={`py-4 px-4 hidden sm:table-cell ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
                        {tier.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={`mt-6 p-4 rounded-xl flex items-start gap-3 ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
              <Info className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`} />
              <div className={`text-sm ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
                <strong>Example:</strong> Exporting a 1080p karaoke video costs <strong className="text-[var(--accent-primary)]">7 credits</strong> regardless of song length.
                With a subscription at 250 credits/month, that's about <strong className="text-[var(--accent-primary)]">35 videos</strong> per month.
              </div>
            </div>
          </motion.div>

          {/* ============================================ */}
          {/* FULL FEATURE LIST */}
          {/* ============================================ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-16"
          >
            <div className="text-center mb-8">
              <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
                Every Feature. Every Plan. No Exceptions.
              </h2>
              <p className={`text-sm ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
                Whether you use free credits, buy a pack, or subscribe — you get the full studio.
              </p>
            </div>

            {/* Feature Grid */}
            <div className="grid md:grid-cols-2 gap-6">
              {allFeatures.map((section, sIdx) => (
                <div key={sIdx} className="glass-panel p-6">
                  <h3 className={`text-sm font-bold uppercase tracking-wider mb-4 ${
                    isDark ? 'text-[var(--accent-primary)]' : 'text-[var(--accent-primary)]'
                  }`}>
                    {section.category}
                  </h3>
                  <div className="space-y-3">
                    {section.items.map((item, iIdx) => (
                      <div key={iIdx} className="flex items-start gap-3">
                        <div className={`p-1.5 rounded-lg flex-shrink-0 mt-0.5 ${isDark ? 'bg-[var(--accent-primary)]/10' : 'bg-cyan-50'}`}>
                          <item.icon className="w-4 h-4 text-[var(--accent-primary)]" />
                        </div>
                        <span className={`text-sm ${isDark ? 'text-[#CBD5E1]' : 'text-[#334155]'}`}>
                          {item.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ============================================ */}
          {/* COMPARISON TABLE — Credit vs Subscription */}
          {/* ============================================ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="glass-panel mb-16 p-6"
          >
            <h2 className={`text-2xl font-bold text-center mb-6 ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
              Credits vs. Subscription at a Glance
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${isDark ? 'border-white/10' : 'border-black/10'}`}>
                    <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}></th>
                    <th className={`text-center py-3 px-4 font-medium ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
                      <div className="flex items-center justify-center gap-2">
                        <CreditCard className="w-4 h-4" />
                        Buy Credits
                      </div>
                    </th>
                    <th className={`text-center py-3 px-4 font-medium ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
                      <div className="flex items-center justify-center gap-2">
                        <Crown className="w-4 h-4 text-[var(--accent-primary)]" />
                        <span className="text-[var(--accent-primary)]">Subscribe</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className={`text-sm ${isDark ? 'text-[#CBD5E1]' : 'text-[#334155]'}`}>
                  {[
                    ['All features included', true, true],
                    ['No watermark', true, true],
                    ['Per-credit cost', '~$0.09–$0.20', '~$0.02–$0.06'],
                    ['Credit validity', '1 year', '90 days'],
                    ['Commitment', 'None', 'Cancel anytime'],
                    ['Annual billing discount', '—', '~20% off'],
                    ['Monthly auto-reload', '—', '✓'],
                    ['Best for', 'Occasional use', 'Regular creators'],
                  ].map(([label, credits, sub], idx) => (
                    <tr key={idx} className={`border-b ${isDark ? 'border-white/5' : 'border-black/5'}`}>
                      <td className={`py-3 px-4 font-medium ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
                        {label}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {credits === true ? (
                          <Check className="w-5 h-5 text-green-500 mx-auto" />
                        ) : (
                          <span>{credits}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {sub === true ? (
                          <Check className="w-5 h-5 text-green-500 mx-auto" />
                        ) : sub === '✓' ? (
                          <Check className="w-5 h-5 text-green-500 mx-auto" />
                        ) : (
                          <span>{sub}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* ============================================ */}
          {/* FAQ */}
          {/* ============================================ */}
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
                      <ChevronUp className={`w-5 h-5 flex-shrink-0 ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`} />
                    ) : (
                      <ChevronDown className={`w-5 h-5 flex-shrink-0 ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`} />
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

          {/* ============================================ */}
          {/* BOTTOM CTA */}
          {/* ============================================ */}
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
              Start free with 15 credits. No credit card required. Every feature unlocked.
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
                    className="glass-button glass-button-primary flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
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
              © {new Date().getFullYear()} Karatrack Studio. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
