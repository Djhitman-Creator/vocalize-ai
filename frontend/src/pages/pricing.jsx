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
  Share2,
  Headphones
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
  { id: 'Starter Pack',  name: 'Starter',  credits: 50,   price: 4.99,  perCredit: 0.10,  savings: null,  description: 'Perfect to try it out',         popular: false },
  { id: 'Standard Pack', name: 'Standard', credits: 150,  price: 11.99, perCredit: 0.08,  savings: '20%', description: 'Great for casual creators',      popular: false },
  { id: 'Pro Pack',      name: 'Pro',      credits: 400,  price: 27.99, perCredit: 0.07,  savings: '30%', description: 'Best for regular use',           popular: true  },
  { id: 'Studio Pack',   name: 'Studio',   credits: 1000, price: 54.99, perCredit: 0.055, savings: '45%', description: 'Maximum value for power users',  popular: false },
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
// QUALITY TIERS â€” credits per minute
// Re-render = ~50% of original cost
// ============================================
const qualityTiers = [
  { quality: '540p',  resolution: '960\u00D7540',   queueCredits: 1, instantCredits: 2,  reRenderQueue: 1, reRenderInstant: 1, description: 'SD \u2014 Fast render' },
  { quality: '720p',  resolution: '1280\u00D7720',  queueCredits: 2, instantCredits: 4,  reRenderQueue: 1, reRenderInstant: 2, description: 'HD \u2014 Great quality' },
  { quality: '1080p', resolution: '1920\u00D71080', queueCredits: 3, instantCredits: 6,  reRenderQueue: 2, reRenderInstant: 3, description: 'Full HD \u2014 YouTube ready' },
  { quality: '4K',    resolution: '3840\u00D72160', queueCredits: 5, instantCredits: 10, reRenderQueue: 3, reRenderInstant: 5, description: 'Ultra HD \u2014 Maximum quality' },
];

// ============================================
// FEATURES â€” everything included
// ============================================
const includedFeatures = [
  { icon: Music,           text: 'AI vocal removal' },
  { icon: Headphones,      text: 'Listen to isolated original vocals to assist with adjustments' },
  { icon: Sparkles,        text: 'Auto lyrics sync (50+ languages)' },
  { icon: Video,           text: 'All display modes (Scroll, Page, Overwrite)' },
  { icon: Download,        text: 'Up to 4K MP4 export' },
  { icon: Image,           text: 'Custom backgrounds (images, video, gradients)' },
  { icon: Type,            text: 'Standard and Custom font uploads (.ttf / .otf)' },
  { icon: Palette,         text: 'Full color control & word highlight effects' },
  { icon: Shield,          text: 'Logo & watermark overlay' },
  { icon: Layers,          text: 'Customize your unique intro screen / add logo' },
  { icon: Users,           text: 'Duet mode (color-coded singer parts)' },
  { icon: Bookmark,        text: 'Save & load favorite style presets' },
  { icon: ClipboardCheck,  text: 'Readiness checklist before export' },
  { icon: Share2,          text: 'Share via link or QR code for team edits & client approval \u2014 before credit spend' },
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
  const [purchaseLoading, setPurchaseLoading] = useState(false);

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

  // ============================================
  // V15: Purchase credit pack
  // ============================================
  const handlePurchase = async (packId) => {
    if (!user) { 
      router.push('/signup?redirect=pricing'); 
      return; 
    }
    
    setPurchaseLoading(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stripe/buy-credits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ package_id: packId })
      });
      
      const data = await response.json();
      
      if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else if (data.error) {
        alert(data.error);
      }
    } catch (error) {
      console.error('Purchase error:', error);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setPurchaseLoading(false);
    }
  };

  // ============================================
  // V15: Subscribe with credits_per_month + billing_cycle
  // ============================================
  const handleSubscribe = async () => {
    if (!user) { 
      router.push('/signup?redirect=pricing'); 
      return; 
    }
    
    setPurchaseLoading(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const plan = subscriptionPlans[selectedSubIndex];
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stripe/create-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          credits_per_month: plan.credits,
          billing_cycle: billingCycle  // 'monthly' or 'annual'
        })
      });
      
      const data = await response.json();
      
      if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else if (data.redirect) {
        // For subscription changes (upgrade/downgrade), redirect to dashboard
        window.location.href = data.redirect;
      } else if (data.success) {
        // Show success message and redirect
        alert(data.message);
        router.push('/dashboard');
      } else if (data.error) {
        alert(data.error);
      }
    } catch (error) {
      console.error('Subscribe error:', error);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setPurchaseLoading(false);
    }
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

          {/* ======== BACK TO DASHBOARD - logged in users only ======== */}
          {user && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="mb-6"
            >
              <Link 
                href="/dashboard"
                className={`inline-flex items-center gap-2 text-sm font-medium transition-colors ${
                  isDark ? 'text-gray-400 hover:text-cyan-400' : 'text-gray-500 hover:text-cyan-600'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Dashboard
              </Link>
            </motion.div>
          )}

          {/* ======== FREE BANNER - only for logged out users ======== */}
          {!user && (
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
                <Link href="/signup" className="glass-button glass-button-primary whitespace-nowrap">
                  Create Free Account
                </Link>
              </div>
            </motion.div>
          )}

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
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-16"
            >
              {/* Billing cycle toggle */}
              <div className="flex justify-center mb-6">
                <div className={`inline-flex rounded-xl p-1 ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
                  {['monthly', 'annual'].map((cycle) => (
                    <button
                      key={cycle}
                      onClick={() => setBillingCycle(cycle)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        billingCycle === cycle
                          ? isDark ? 'bg-white/10 text-white' : 'bg-white text-gray-900 shadow'
                          : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      {cycle === 'annual' ? 'Annual (Save ~17%)' : 'Monthly'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subscription card */}
              <div className="glass-panel max-w-lg mx-auto p-8">
                <div className="text-center mb-6">
                  <Crown className="w-10 h-10 mx-auto mb-3 text-[var(--accent-secondary)]" />
                  <h3 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Subscribe & Save
                  </h3>
                  <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    Credits reload every month â€” save up to 75% vs pay-as-you-go
                  </p>
                </div>

                {/* Credits slider */}
                <div className="mb-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Credits per month</span>
                    <span className="text-[var(--accent-primary)] font-bold">{selectedSub.credits} credits</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={subscriptionPlans.length - 1}
                    value={selectedSubIndex}
                    onChange={(e) => setSelectedSubIndex(parseInt(e.target.value))}
                    className="w-full accent-[var(--accent-primary)]"
                  />
                  <div className="flex justify-between text-xs mt-1">
                    {subscriptionPlans.map((p, i) => (
                      <span key={i} className={selectedSubIndex === i ? 'text-[var(--accent-primary)] font-medium' : isDark ? 'text-gray-600' : 'text-gray-400'}>
                        {p.credits}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Price display */}
                <div className="text-center mb-6">
                  <div className={`text-4xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    ${subPrice.toFixed(2)}
                    <span className={`text-base font-normal ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>/mo</span>
                  </div>
                  {billingCycle === 'annual' && (
                    <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      Billed ${selectedSub.annualTotal.toFixed(2)}/year
                    </p>
                  )}
                  <div className="flex items-center justify-center gap-4 mt-3">
                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      ${subPerCredit.toFixed(3)}/credit
                    </span>
                    <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-500/20 text-green-400">
                      Save {getSubSavings(selectedSub)}%
                    </span>
                  </div>
                </div>

                {/* Subscribe button */}
                <button
                  onClick={handleSubscribe}
                  disabled={purchaseLoading}
                  className="w-full glass-button glass-button-primary py-4 text-lg font-semibold disabled:opacity-50"
                >
                  {purchaseLoading ? 'Processing...' : user ? 'Subscribe Now' : 'Sign Up to Subscribe'}
                </button>

                <p className={`text-center text-xs mt-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  Cancel anytime. Unused credits stay valid for 90 days.
                </p>
              </div>
            </motion.div>
          )}


          {/* ======== CREDIT PACKS MODE ======== */}
          {purchaseMode === 'credits' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-16"
            >
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {creditPacks.map((pack) => (
                  <div
                    key={pack.id}
                    onClick={() => setSelectedPack(pack.id)}
                    className={`glass-panel p-6 cursor-pointer transition-all relative ${
                      selectedPack === pack.id
                        ? 'ring-2 ring-[var(--accent-primary)] scale-[1.02]'
                        : 'hover:scale-[1.01]'
                    }`}
                  >
                    {pack.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-[#0A0A0F]">
                          Most Popular
                        </span>
                      </div>
                    )}

                    <div className="text-center">
                      <h3 className={`text-lg font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {pack.name}
                      </h3>
                      <p className={`text-sm mb-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {pack.description}
                      </p>

                      <div className={`text-3xl font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {pack.credits}
                        <span className={`text-sm font-normal ${isDark ? 'text-gray-400' : 'text-gray-500'}`}> credits</span>
                      </div>

                      <div className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        ${pack.price}
                      </div>

                      <div className="flex items-center justify-center gap-2">
                        <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          ${pack.perCredit.toFixed(2)}/credit
                        </span>
                        {pack.savings && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-500/20 text-green-400">
                            {pack.savings} off
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Buy button */}
              <div className="flex justify-center mt-8">
                <button
                  onClick={() => handlePurchase(selectedPack)}
                  disabled={purchaseLoading}
                  className="glass-button glass-button-primary px-12 py-4 text-lg font-semibold disabled:opacity-50"
                >
                  {purchaseLoading ? 'Processing...' : user ? `Buy ${creditPacks.find(p => p.id === selectedPack)?.credits} Credits` : 'Sign Up to Purchase'}
                </button>
              </div>

              <p className={`text-center text-sm mt-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                One-time purchase. Credits valid for 1 year.
              </p>
            </motion.div>
          )}


          {/* ======== CREDIT COST TABLE ======== */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-16"
          >
            <h2 className={`text-2xl font-bold text-center mb-8 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Credit Cost by Quality
            </h2>

            <div className="overflow-x-auto">
              <table className={`w-full ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                <thead>
                  <tr className={`border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                    <th className="py-4 px-4 text-left font-semibold">Quality</th>
                    <th className="py-4 px-4 text-left font-semibold">Resolution</th>
                    <th className="py-4 px-4 text-center font-semibold">
                      <div className="flex items-center justify-center gap-2">
                        <Clock className="w-4 h-4" />
                        Queue
                      </div>
                    </th>
                    <th className="py-4 px-4 text-center font-semibold">
                      <div className="flex items-center justify-center gap-2">
                        <Zap className="w-4 h-4" />
                        Instant
                      </div>
                    </th>
                    <th className="py-4 px-4 text-center font-semibold">
                      <div className="flex items-center justify-center gap-2">
                        <Repeat className="w-4 h-4" />
                        Re-render
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
