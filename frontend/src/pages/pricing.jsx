'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion } from 'framer-motion';
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
  QrCode,
  ClipboardCheck,
  Bookmark,
  Share2
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
// PAY-AS-YOU-GO CREDIT PACKS
// ============================================
const creditPacks = [
  { id: 'starter',  name: 'Starter',  credits: 50,   price: 4.99,  perCredit: 0.10,  savings: null,  description: 'Perfect to try it out',         popular: false },
  { id: 'standard', name: 'Standard', credits: 150,  price: 11.99, perCredit: 0.08,  savings: '20%', description: 'Great for casual creators',      popular: false },
  { id: 'pro',      name: 'Pro',      credits: 400,  price: 27.99, perCredit: 0.07,  savings: '30%', description: 'Best for regular use',           popular: true  },
  { id: 'studio',   name: 'Studio',   credits: 1000, price: 54.99, perCredit: 0.055, savings: '45%', description: 'Maximum value for power users',  popular: false },
];

// ============================================
// SUBSCRIPTION PLANS
// ============================================
const subscriptionPlans = [
  { id: 'sub-50',   credits: 50,   monthlyPrice: 2.99,  annualMonthly: 2.49,  annualTotal: 29.88  },
  { id: 'sub-100',  credits: 100,  monthlyPrice: 4.99,  annualMonthly: 3.99,  annualTotal: 47.88  },
  { id: 'sub-250',  credits: 250,  monthlyPrice: 9.99,  annualMonthly: 7.99,  annualTotal: 95.88  },
  { id: 'sub-500',  credits: 500,  monthlyPrice: 17.99, annualMonthly: 14.49, annualTotal: 173.88 },
  { id: 'sub-1000', credits: 1000, monthlyPrice: 29.99, annualMonthly: 23.99, annualTotal: 287.88 },
];

// ============================================
// QUALITY TIERS — credits per minute
// Re-render = ~50% of original cost
// ============================================
const qualityTiers = [
  { quality: '540p',  resolution: '960\u00D7540',   queueCredits: 1, instantCredits: 2,  reRenderQueue: 1, reRenderInstant: 1, description: 'SD \u2014 Fast render' },
  { quality: '720p',  resolution: '1280\u00D7720',  queueCredits: 2, instantCredits: 4,  reRenderQueue: 1, reRenderInstant: 2, description: 'HD \u2014 Great quality' },
  { quality: '1080p', resolution: '1920\u00D71080', queueCredits: 3, instantCredits: 6,  reRenderQueue: 2, reRenderInstant: 3, description: 'Full HD \u2014 YouTube ready' },
  { quality: '4K',    resolution: '3840\u00D72160', queueCredits: 5, instantCredits: 10, reRenderQueue: 3, reRenderInstant: 5, description: 'Ultra HD \u2014 Maximum quality' },
];

// ============================================
// FEATURES — everything included
// ============================================
const includedFeatures = [
  { icon: Music,           text: 'AI vocal removal' },
  { icon: Mic2,            text: 'Backing vocal isolation' },
  { icon: Sparkles,        text: 'Auto lyrics sync (50+ languages)' },
  { icon: Video,           text: 'All display modes (Scroll, Page, Overwrite)' },
  { icon: Download,        text: 'Up to 4K MP4 export' },
  { icon: Image,           text: 'Custom backgrounds (images, video, gradients)' },
  { icon: Type,            text: 'Custom font uploads (.ttf / .otf)' },
  { icon: Palette,         text: 'Full color control & word highlight effects' },
  { icon: Shield,          text: 'Logo & watermark overlay' },
  { icon: Layers,          text: 'Custom intro screen / thumbnail' },
  { icon: Users,           text: 'Duet mode (color-coded singer parts)' },
  { icon: Bookmark,        text: 'Save & load favorite style presets' },
  { icon: ClipboardCheck,  text: 'Readiness checklist before export' },
  { icon: Share2,          text: 'Share via link or QR code for team edits & client approval' },
];

// ============================================
// FAQ
// ============================================
const faqItems = [
  {
    question: 'How do credits work?',
    answer: 'Credits are charged per minute of audio based on video quality. For example, a 4-minute song at 720p in Queue mode costs 2 cr/min \u00D7 4 min = 8 credits. You can preview and customize your video unlimited times before spending credits on export.'
  },
  {
    question: 'What\u2019s the difference between credit packs and a subscription?',
    answer: 'Credit packs are one-time purchases at regular price \u2014 buy what you need, when you need it. Subscriptions deliver credits monthly at a lower per-credit rate, and annual billing saves even more. Both unlock 100% of features.'
  },
  {
    question: 'Do credits expire?',
    answer: 'Purchased credit pack credits are valid for 1 year. Subscription credits are valid for 90 days. Your free signup credits never expire.'
  },
  {
    question: 'What\u2019s the difference between Queue and Instant?',
    answer: 'Queue mode processes your video in order with other users \u2014 more affordable but may take 5\u201315 minutes during peak times. Instant mode skips the queue and starts rendering immediately (under 2 min), but costs 2\u00D7 the credits.'
  },
  {
    question: 'How much does a re-render cost?',
    answer: 'Re-renders cost roughly half the original export price per minute. So if your first 1080p Queue export was 3 cr/min, a re-render is about 2 cr/min. Great for tweaking timing, colors, or backgrounds without paying full price again.'
  },
  {
    question: 'What do I get with a free account?',
    answer: 'Every new account gets 15 free credits \u2014 enough to create your first karaoke video and try every feature. No credit card required. Free exports include a small watermark, removed with any purchase.'
  },
  {
    question: 'Can I buy extra credits on top of my subscription?',
    answer: 'Yes! Subscribers can purchase additional credit packs anytime. Subscription credits and purchased credits are tracked separately so you always know what you have.'
  },
  {
    question: 'Can I share projects with my team or clients?',
    answer: 'Absolutely! Generate a share link or QR code from any project. You can give full edit access (for your own devices) or view-only preview access (for clients to approve). Toggle sharing on or off anytime.'
  },
  {
    question: 'Can I cancel my subscription?',
    answer: 'Yes. Cancel anytime from your dashboard. You keep your remaining credits and access until they\u2019re used up. No cancellation fees.'
  },
  {
    question: 'What audio formats are supported?',
    answer: 'Upload MP3, WAV, FLAC, AAC, OGG, M4A and more. Karatrack handles the conversion \u2014 just upload and go. Songs in 50+ languages are supported.'
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

  const [purchaseMode, setPurchaseMode] = useState('subscription');
  const [selectedPack, setSelectedPack] = useState('pro');
  const [selectedSubIndex, setSelectedSubIndex] = useState(2);
  const [billingCycle, setBillingCycle] = useState('annual');

  useEffect(() => { checkUser(); }, []);

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
    if (!user) { router.push('/signup?redirect=pricing'); return; }
    console.log('Purchasing pack:', packId);
  };

  const handleSubscribe = async () => {
    if (!user) { router.push('/signup?redirect=pricing'); return; }
    const plan = subscriptionPlans[selectedSubIndex];
    console.log('Subscribing:', plan, billingCycle);
  };

  const getSubSavings = (plan) => {
    const paygoEquivalent = plan.credits * 0.10;
    const subCost = billingCycle === 'annual' ? plan.annualMonthly : plan.monthlyPrice;
    return Math.round((1 - subCost / paygoEquivalent) * 100);
  };

  const selectedSub = subscriptionPlans[selectedSubIndex];
  const subPrice = billingCycle === 'annual' ? selectedSub.annualMonthly : selectedSub.monthlyPrice;
  const subPerCredit = subPrice / selectedSub.credits;

  return (
    <>
      <SEO
        title="Pricing - Credits & Subscriptions | Karatrack Studio"
        description="Create professional karaoke videos with AI. Buy credits as you go or save with a subscription. All features included. Start free with 15 credits."
        canonical="https://studio.karatrack.com/pricing"
        additionalSchema={[getOrganizationSchema()]}
      />

      {/* ===== bg-animated-dark / bg-animated-light to match all other pages ===== */}
      <div className={`min-h-screen ${isDark ? 'bg-animated-dark' : 'bg-animated-light'}`}>
        <AppNavigation />

        <main className="max-w-6xl mx-auto px-4 py-12">

          {/* ======== HERO ======== */}
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

            <h1 className={`text-4xl md:text-5xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Pay as you go, or{' '}
              <span className="text-gradient">subscribe & save.</span>
            </h1>

            <p className={`text-lg max-w-2xl mx-auto ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              All features included for everyone. Buy credits when you need them
              or get a monthly reload at a discount. Start free with 15 credits.
            </p>
          </motion.div>

          {/* ======== FREE BANNER — fully centered ======== */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-panel mb-10 p-6"
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div className={`p-3 rounded-xl ${isDark ? 'bg-green-500/20' : 'bg-green-100'}`}>
                <Gift className="w-8 h-8 text-green-500" />
              </div>
              <div>
                <h3 className={`text-xl font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Start Free &mdash; 15 Credits Included
                </h3>
                <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                  Create your first karaoke video and try every feature &mdash; no credit card required
                </p>
              </div>
              {!user && (
                <Link href="/signup" className="glass-button glass-button-primary whitespace-nowrap">
                  Create Free Account
                </Link>
              )}
            </div>
          </motion.div>

          {/* ======== MODE TOGGLE ======== */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex justify-center mb-8"
          >
            <div className={`inline-flex rounded-2xl p-1.5 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-black/5 border border-black/10'}`}>
              {[
                { key: 'subscription', label: 'Subscribe & Save', icon: Crown },
                { key: 'credits', label: 'Buy Credits', icon: CreditCard },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setPurchaseMode(tab.key)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all ${
                    purchaseMode === tab.key
                      ? 'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-[#0A0A0F] shadow-lg'
                      : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </motion.div>


          {/* ======== SUBSCRIPTION MODE ======== */}
          {purchaseMode === 'subscription' && (
            <motion.div
              key="subscription"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-16"
            >
              {/* Billing toggle */}
              <div className="flex justify-center mb-6">
                <div className={`inline-flex rounded-xl p-1 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-black/5 border border-black/10'}`}>
                  {['monthly', 'annual'].map((cycle) => (
                    <button
                      key={cycle}
                      onClick={() => setBillingCycle(cycle)}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                        billingCycle === cycle
                          ? isDark ? 'bg-white/10 text-white' : 'bg-white text-gray-900 shadow-sm'
                          : isDark ? 'text-gray-500' : 'text-gray-400'
                      }`}
                    >
                      {cycle === 'monthly' ? 'Monthly' : 'Annual'}
                      {cycle === 'annual' && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-500/20 text-green-400">
                          Save ~20%
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subscription card */}
              <div className="max-w-lg mx-auto">
                <div className="relative glass-panel p-8 ring-2 ring-[var(--accent-primary)]">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[var(--accent-primary)] text-[#0A0A0F] text-xs font-bold tracking-wide">
                    BEST VALUE
                  </div>

                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-xl ${isDark ? 'bg-[var(--accent-primary)]/20' : 'bg-cyan-100'}`}>
                      <Crown className="w-6 h-6 text-[var(--accent-primary)]" />
                    </div>
                    <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      Monthly Credit Subscription
                    </h2>
                  </div>
                  <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Choose how many credits you receive each {billingCycle === 'annual' ? 'month (billed annually)' : 'month'}. Change or cancel anytime.
                  </p>

                  {/* Dropdown */}
                  <div className="mb-6">
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                      Credits per month
                    </label>
                    <div className="relative">
                      <select
                        value={selectedSubIndex}
                        onChange={(e) => setSelectedSubIndex(parseInt(e.target.value))}
                        className={`w-full py-3.5 pl-4 pr-10 rounded-xl text-sm font-medium appearance-none cursor-pointer transition-colors outline-none ${
                          isDark
                            ? 'bg-white/5 border border-white/10 text-white focus:border-[var(--accent-primary)]'
                            : 'bg-white border border-gray-200 text-gray-900 focus:border-[var(--accent-primary)]'
                        }`}
                      >
                        {subscriptionPlans.map((plan, idx) => (
                          <option key={idx} value={idx}>
                            {plan.credits} credits/mo &mdash; ${billingCycle === 'annual' ? plan.annualMonthly.toFixed(2) : plan.monthlyPrice.toFixed(2)}/mo
                          </option>
                        ))}
                      </select>
                      <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                    </div>
                  </div>

                  {/* Price summary */}
                  <div className={`rounded-xl p-5 mb-6 ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                    <div className="flex items-baseline justify-between mb-3">
                      <div>
                        <span className={`text-4xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          ${subPrice.toFixed(2)}
                        </span>
                        <span className={`text-base ml-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>/month</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-green-400">Save {getSubSavings(selectedSub)}%</div>
                        <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>vs. pay-as-you-go</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        <span className="font-semibold text-[var(--accent-primary)]">{selectedSub.credits} credits</span> delivered monthly
                      </span>
                      <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        ${subPerCredit.toFixed(3)}/credit
                      </span>
                    </div>
                    {billingCycle === 'annual' && (
                      <div className={`mt-3 pt-3 border-t text-xs ${isDark ? 'border-white/10 text-gray-500' : 'border-gray-200 text-gray-400'}`}>
                        Billed as ${selectedSub.annualTotal.toFixed(2)}/year
                      </div>
                    )}
                  </div>

                  <button onClick={handleSubscribe} className="w-full glass-button glass-button-primary py-4 text-base font-bold">
                    Subscribe Now
                  </button>

                  <p className={`text-center text-xs mt-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    Just need a one-time purchase?{' '}
                    <button onClick={() => setPurchaseMode('credits')} className="text-[var(--accent-primary)] hover:underline font-medium">
                      Buy a credit pack instead
                    </button>
                  </p>
                </div>
              </div>
            </motion.div>
          )}


          {/* ======== CREDIT PACKS MODE ======== */}
          {purchaseMode === 'credits' && (
            <motion.div
              key="credits"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-16"
            >
              <h2 className={`text-2xl font-bold text-center mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Credit Packs
              </h2>
              <p className={`text-center mb-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                One-time purchase. No commitment. Credits valid for 1 year.
              </p>

              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {creditPacks.map((pack, idx) => (
                  <motion.div
                    key={pack.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * idx }}
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

                    <h3 className={`text-lg font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {pack.name}
                    </h3>
                    <p className={`text-sm mb-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {pack.description}
                    </p>

                    <div className="mb-4">
                      <span className={`text-4xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {pack.credits}
                      </span>
                      <span className={`text-lg ml-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        credits
                      </span>
                    </div>

                    <div className="flex items-baseline gap-1 mb-4">
                      <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        ${pack.price}
                      </span>
                      <span className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        (${pack.perCredit}/credit)
                      </span>
                    </div>

                    <button
                      onClick={(e) => { e.stopPropagation(); handlePurchase(pack.id); }}
                      className={`w-full py-3 rounded-xl font-semibold transition-all ${
                        pack.popular ? 'glass-button-primary' : 'glass-button'
                      }`}
                    >
                      Buy Credits
                    </button>
                  </motion.div>
                ))}
              </div>

              <p className={`text-center text-sm mt-6 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                Want automatic monthly credits at a discount?{' '}
                <button onClick={() => setPurchaseMode('subscription')} className="text-[var(--accent-primary)] hover:underline font-medium">
                  Check out subscriptions
                </button>
              </p>
            </motion.div>
          )}


          {/* ======== CREDIT COST PER MINUTE TABLE ======== */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-panel mb-16 p-6"
          >
            <h2 className={`text-2xl font-bold text-center mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Credit Cost per Minute
            </h2>
            <p className={`text-center text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Credits are charged per minute of audio. Re-renders are roughly half price.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                    <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Quality</th>
                    <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Resolution</th>
                    <th className={`text-center py-3 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      <div className="flex items-center justify-center gap-2">
                        <Clock className="w-4 h-4" />
                        Queue
                      </div>
                    </th>
                    <th className={`text-center py-3 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      <div className="flex items-center justify-center gap-2">
                        <Zap className="w-4 h-4 text-[var(--accent-secondary)]" />
                        Instant
                      </div>
                    </th>
                    <th className={`text-center py-3 px-4 font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      <div className="flex items-center justify-center gap-2">
                        <Repeat className="w-4 h-4 text-green-400" />
                        Re-Render
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {qualityTiers.map((tier) => (
                    <tr key={tier.quality} className={`border-b ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
                      <td className={`py-4 px-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        <span className="font-bold">{tier.quality}</span>
                        {tier.quality === '4K' && (
                          <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                            isDark ? 'bg-[var(--accent-secondary)]/20 text-[var(--accent-secondary)]' : 'bg-purple-100 text-purple-600'
                          }`}>
                            Premium
                          </span>
                        )}
                      </td>
                      <td className={`py-4 px-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
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
                      <td className="py-4 px-4 text-center">
                        <span className={`px-3 py-1 rounded-full font-medium ${
                          isDark ? 'bg-green-500/15 text-green-400' : 'bg-green-100 text-green-700'
                        }`}>
                          {tier.reRenderQueue}&ndash;{tier.reRenderInstant} cr/min
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={`mt-6 p-4 rounded-xl ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                <strong>Example:</strong> A 4-minute song at 1080p using Queue = 3 cr/min &times; 4 min ={' '}
                <strong className="text-[var(--accent-primary)]">12 credits</strong>.
                Re-rendering the same project? Only ~2 cr/min &times; 4 min ={' '}
                <strong className="text-green-400">8 credits</strong>.
              </p>
            </div>
          </motion.div>


          {/* ======== EVERYTHING INCLUDED ======== */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-16"
          >
            <h2 className={`text-2xl font-bold text-center mb-8 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Everything Included for Everyone
            </h2>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {includedFeatures.map((feature, idx) => (
                <div key={idx} className="glass-panel flex items-center gap-3 p-4">
                  <div className={`p-2 rounded-lg ${isDark ? 'bg-[var(--accent-primary)]/20' : 'bg-cyan-100'}`}>
                    <feature.icon className="w-5 h-5 text-[var(--accent-primary)]" />
                  </div>
                  <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {feature.text}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>


          {/* ======== FAQ ======== */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mb-16"
          >
            <h2 className={`text-2xl font-bold text-center mb-8 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Frequently Asked Questions
            </h2>

            <div className="max-w-3xl mx-auto space-y-3">
              {faqItems.map((item, idx) => (
                <div key={idx} className="glass-panel overflow-hidden">
                  <button
                    onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                    className={`w-full flex items-center justify-between p-4 text-left transition-colors ${
                      isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'
                    }`}
                  >
                    <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {item.question}
                    </span>
                    {expandedFaq === idx ? (
                      <ChevronUp className={`w-5 h-5 flex-shrink-0 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                    ) : (
                      <ChevronDown className={`w-5 h-5 flex-shrink-0 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                    )}
                  </button>

                  {expandedFaq === idx && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className={`px-4 pb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                    >
                      {item.answer}
                    </motion.div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>


          {/* ======== BOTTOM CTA ======== */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="glass-panel text-center p-8"
          >
            <h2 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Ready to create your first karaoke video?
            </h2>
            <p className={`mb-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Start free with 15 credits. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {user ? (
                <Link href="/dashboard" className="glass-button glass-button-primary">
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link href="/signup" className="glass-button glass-button-primary">
                    Create Free Account
                  </Link>
                  <Link href="/login" className="glass-button">
                    Sign In
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        </main>

        {/* Footer */}
        <footer className={`mt-16 py-8 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
          <div className="max-w-6xl mx-auto px-4 text-center">
            <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              &copy; {new Date().getFullYear()} Karatrack. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
