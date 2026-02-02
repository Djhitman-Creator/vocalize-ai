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
  Globe,
  Wand2,
  MonitorPlay,
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
// PAY-AS-YOU-GO CREDIT PACKS
// ============================================
const creditPacks = [
  { id: 'pack-10',   credits: 10,   price: 1.99,  perCredit: 0.199, savings: null },
  { id: 'pack-25',   credits: 25,   price: 3.99,  perCredit: 0.160, savings: null },
  { id: 'pack-50',   credits: 50,   price: 6.99,  perCredit: 0.140, savings: '10%' },
  { id: 'pack-100',  credits: 100,  price: 11.99, perCredit: 0.120, savings: '20%', popular: true },
  { id: 'pack-250',  credits: 250,  price: 27.99, perCredit: 0.112, savings: '25%' },
  { id: 'pack-500',  credits: 500,  price: 49.99, perCredit: 0.100, savings: '30%' },
  { id: 'pack-1000', credits: 1000, price: 89.99, perCredit: 0.090, savings: '35%' },
];

// ============================================
// SUBSCRIPTION PLANS
// ============================================
const subscriptionPlans = [
  { id: 'sub-50',   credits: 50,   monthlyPrice: 2.99,  annualMonthly: 2.49,  annualTotal: 29.88 },
  { id: 'sub-100',  credits: 100,  monthlyPrice: 4.99,  annualMonthly: 3.99,  annualTotal: 47.88 },
  { id: 'sub-250',  credits: 250,  monthlyPrice: 9.99,  annualMonthly: 7.99,  annualTotal: 95.88,  popular: true },
  { id: 'sub-500',  credits: 500,  monthlyPrice: 17.99, annualMonthly: 14.49, annualTotal: 173.88 },
  { id: 'sub-1000', credits: 1000, monthlyPrice: 29.99, annualMonthly: 23.99, annualTotal: 287.88 },
];

// ============================================
// QUALITY TIERS - credits per minute of audio
// ============================================
const qualityTiers = [
  { quality: '540p',  resolution: '960\u00d7540',  queueCr: 1, instantCr: 2, reRenderCr: 1, description: 'SD \u2014 Fast render' },
  { quality: '720p',  resolution: '1280\u00d7720', queueCr: 2, instantCr: 4, reRenderCr: 1, description: 'HD \u2014 Great quality' },
  { quality: '1080p', resolution: '1920\u00d71080',queueCr: 3, instantCr: 6, reRenderCr: 2, description: 'Full HD \u2014 YouTube ready' },
  { quality: '4K',    resolution: '3840\u00d72160',queueCr: 5, instantCr: 10,reRenderCr: 3, description: 'Ultra HD \u2014 Maximum quality' },
];

// ============================================
// ALL FEATURES
// ============================================
const allFeatures = [
  { category: 'AI-Powered Audio', items: [
    { icon: Music, text: 'AI vocal removal \u2014 isolate or remove vocals instantly' },
    { icon: Mic2, text: 'Backing vocal isolation \u2014 keep harmonies, remove lead' },
    { icon: Sparkles, text: 'Auto lyrics sync \u2014 word-level timing powered by AI' },
    { icon: Globe, text: '50+ language support for lyrics transcription' },
  ]},
  { category: 'Video Customization', items: [
    { icon: MonitorPlay, text: 'Multiple display modes \u2014 Scroll, Page, Overwrite' },
    { icon: Image, text: 'Custom backgrounds \u2014 images, videos, gradients' },
    { icon: Layers, text: 'Custom intro screen with thumbnail upload' },
    { icon: Shield, text: 'Logo & watermark branding overlay' },
  ]},
  { category: 'Styling & Effects', items: [
    { icon: Type, text: 'Custom font uploads \u2014 use any .ttf or .otf font' },
    { icon: Palette, text: 'Full color control \u2014 text, outline, sung/highlight' },
    { icon: Wand2, text: 'Word effects \u2014 glow, sweep highlight, shadow' },
    { icon: Star, text: 'Save & load presets \u2014 your style, one click' },
  ]},
  { category: 'Export & Output', items: [
    { icon: Download, text: 'Up to 4K MP4 export \u2014 crisp, professional output' },
    { icon: Users, text: 'Duet mode \u2014 color-coded parts for two singers' },
    { icon: Repeat, text: 'Reduced-cost re-renders \u2014 tweak and re-export for less' },
    { icon: Video, text: 'WYSIWYG editor \u2014 what you preview is what you get' },
  ]},
];

// ============================================
// FAQ
// ============================================
const faqItems = [
  {
    question: 'How do credits work?',
    answer: 'Credits are charged per minute of audio based on your chosen video quality. For example, a 4-minute song at 720p costs 8 credits in Queue mode (2 credits/min \u00d7 4 min). You can preview and customize your video unlimited times before spending credits on the final export.'
  },
  {
    question: "What's the difference between credit packs and a subscription?",
    answer: 'Credit packs are one-time purchases at regular price \u2014 buy what you need, when you need it. No commitment required. Subscriptions give you a monthly credit refill at a much lower per-credit cost, and annual billing saves you even more. Both unlock 100% of features.'
  },
  {
    question: 'Do credits expire?',
    answer: 'Credits from one-time packs are valid for 1 year. Subscription credits are valid for 90 days. Your free signup credits never expire \u2014 take your time!'
  },
  {
    question: 'What do I get with a free account?',
    answer: 'Every new account gets 15 free credits \u2014 enough to create a couple of karaoke videos and try every feature. No credit card required. Free exports include a small watermark which is removed with any purchase.'
  },
  {
    question: 'Can I cancel my subscription anytime?',
    answer: 'Absolutely. Cancel anytime from your dashboard. You keep your remaining credits until they expire. No cancellation fees.'
  },
  {
    question: 'Can I buy extra credits on top of my subscription?',
    answer: 'Yes! Subscribers can purchase credit packs at any time. Subscription credits and purchased credits are tracked separately so you always see what you have.'
  },
  {
    question: 'How much does a re-render cost?',
    answer: 'Re-renders cost roughly half the original export price. So if your first 1080p queue export was 3 cr/min, a re-render of the same project is about 2 cr/min. This lets you tweak colors, timing, or backgrounds without paying full price again.'
  },
  {
    question: "What's the difference between Queue and Instant?",
    answer: 'Queue mode processes your video in order with other users \u2014 more affordable, typically takes 5\u201315 minutes. Instant mode skips the queue and starts rendering immediately but costs 2\u00d7 the credits.'
  },
  {
    question: 'Is there a watermark on free videos?',
    answer: 'Free account exports include a small "Made with Karatrack" watermark. Any credit purchase or subscription removes it automatically on all future exports.'
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

  // Purchase mode: 'subscription' or 'credits'
  const [purchaseMode, setPurchaseMode] = useState('subscription');

  // Credit pack selection
  const [selectedPackIdx, setSelectedPackIdx] = useState(3); // default 100 credits

  // Subscription selection
  const [selectedSubIdx, setSelectedSubIdx] = useState(2); // default 250 credits
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

  const handlePurchaseCredits = async () => {
    if (!user) { router.push('/signup?redirect=pricing'); return; }
    const pack = creditPacks[selectedPackIdx];
    // TODO: Integrate with Stripe checkout
    console.log('TODO: Stripe checkout for credit pack:', pack);
  };

  const handleSubscribe = async () => {
    if (!user) { router.push('/signup?redirect=pricing'); return; }
    const sub = subscriptionPlans[selectedSubIdx];
    // TODO: Integrate with Stripe checkout
    console.log('TODO: Stripe checkout for subscription:', sub, billingCycle);
  };

  // Calculate savings vs pay-as-you-go for a subscription
  const getSubSavings = (sub) => {
    const paygoEquivalent = sub.credits * 0.12; // ~$0.12/credit at 100-pack rate
    const subPrice = billingCycle === 'annual' ? sub.annualMonthly : sub.monthlyPrice;
    return Math.round((1 - subPrice / paygoEquivalent) * 100);
  };

  const selectedPack = creditPacks[selectedPackIdx];
  const selectedSub = subscriptionPlans[selectedSubIdx];
  const subPrice = billingCycle === 'annual' ? selectedSub.annualMonthly : selectedSub.monthlyPrice;
  const subPerCredit = (subPrice / selectedSub.credits).toFixed(3);

  return (
    <>
      <SEO
        title="Pricing \u2014 Credits & Subscriptions | Karatrack Studio"
        description="Create professional karaoke videos with AI. Buy credits per minute or save with a subscription. All features included. Start free with 15 credits."
        canonical="https://studio.karatrack.com/pricing"
        additionalSchema={[getOrganizationSchema()]}
      />

      <div className={`min-h-screen ${isDark ? 'bg-[#0A0A0F]' : 'bg-[#F0F4F8]'}`}>
        <AppNavigation />

        <main className="max-w-6xl mx-auto px-4 py-12">

          {/* ======= HERO ======= */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 ${
              isDark ? 'bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30'
                     : 'bg-cyan-50 border border-cyan-200'
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
              AI-powered vocal removal, word-level lyrics sync, and a full video editor. Buy credits when you need them or subscribe and save.
            </p>
          </motion.div>


          {/* ======= FREE BANNER ======= */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="glass-panel mb-10 p-6"
          >
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${isDark ? 'bg-green-500/20' : 'bg-green-100'}`}>
                  <Gift className="w-8 h-8 text-green-500" />
                </div>
                <div>
                  <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
                    Start Free &mdash; 15 Credits Included
                  </h3>
                  <p className={isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}>
                    Enough to create a couple karaoke videos. Every feature unlocked. No credit card needed.
                  </p>
                </div>
              </div>
              {!user && (
                <Link href="/signup" className="glass-button glass-button-primary whitespace-nowrap">
                  <Sparkles className="w-4 h-4 inline mr-2" />
                  Create Free Account
                </Link>
              )}
            </div>
          </motion.div>


          {/* ======= MODE TOGGLE ======= */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="flex justify-center mb-8"
          >
            <div className={`inline-flex rounded-2xl p-1 ${
              isDark ? 'bg-white/5 border border-white/10' : 'bg-black/5 border border-black/10'
            }`}>
              {[
                { key: 'subscription', label: 'Subscribe & Save', icon: Crown },
                { key: 'credits', label: 'Buy Credits', icon: CreditCard },
              ].map((tab) => (
                <button key={tab.key} onClick={() => setPurchaseMode(tab.key)} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all ${
                  purchaseMode === tab.key
                    ? 'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-[#0A0A0F] shadow-lg'
                    : isDark ? 'text-[#94A3B8] hover:text-white' : 'text-[#475569] hover:text-[#0F172A]'
                }`}>
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </motion.div>


          {/* ======= SUBSCRIPTION MODE ======= */}
          {purchaseMode === 'subscription' && (
            <motion.div key="subscription" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-16">
              {/* Billing toggle */}
              <div className="flex justify-center mb-6">
                <div className={`inline-flex rounded-xl p-1 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-black/5 border border-black/10'}`}>
                  {['monthly', 'annual'].map((cycle) => (
                    <button key={cycle} onClick={() => setBillingCycle(cycle)} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                      billingCycle === cycle
                        ? isDark ? 'bg-white/10 text-white' : 'bg-white text-[#0F172A] shadow-sm'
                        : isDark ? 'text-[#64748B]' : 'text-[#94A3B8]'
                    }`}>
                      {cycle === 'monthly' ? 'Monthly' : 'Annual'}
                      {cycle === 'annual' && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-500/15 text-green-500">Save ~20%</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subscription Card */}
              <div className="max-w-lg mx-auto">
                <div className={`glass-panel p-8 relative overflow-hidden ${isDark ? 'ring-1 ring-[var(--accent-primary)]/30' : 'ring-1 ring-cyan-200'}`}>
                  <div className="absolute top-0 right-0 px-4 py-1.5 rounded-bl-xl bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-[#0A0A0F] text-xs font-bold">
                    BEST VALUE
                  </div>

                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-xl ${isDark ? 'bg-[var(--accent-primary)]/15' : 'bg-cyan-100'}`}>
                      <Crown className="w-6 h-6 text-[var(--accent-primary)]" />
                    </div>
                    <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>Monthly Credit Subscription</h2>
                  </div>
                  <p className={`text-sm mb-6 ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
                    Choose how many credits you get each {billingCycle === 'annual' ? 'month (billed annually)' : 'month'}. Change or cancel anytime.
                  </p>

                  {/* Dropdown */}
                  <div className="mb-6">
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-[#CBD5E1]' : 'text-[#475569]'}`}>Credits per month</label>
                    <div className="relative">
                      <select value={selectedSubIdx} onChange={(e) => setSelectedSubIdx(parseInt(e.target.value))}
                        className={`w-full appearance-none rounded-xl py-3 pl-4 pr-10 text-sm font-medium border outline-none transition-colors cursor-pointer ${
                          isDark ? 'bg-white/5 border-white/10 text-white focus:border-[var(--accent-primary)]'
                                 : 'bg-white border-black/10 text-[#0F172A] focus:border-cyan-500'
                        }`}>
                        {subscriptionPlans.map((opt, idx) => (
                          <option key={idx} value={idx}>
                            {opt.credits} credits/mo &mdash; ${billingCycle === 'annual' ? opt.annualMonthly.toFixed(2) : opt.monthlyPrice.toFixed(2)}/mo
                          </option>
                        ))}
                      </select>
                      <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isDark ? 'text-[#64748B]' : 'text-[#94A3B8]'}`} />
                    </div>
                  </div>

                  {/* Price display */}
                  <div className={`rounded-xl p-5 mb-6 ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
                    <div className="flex items-baseline justify-between mb-3">
                      <div>
                        <span className={`text-4xl font-bold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>${subPrice.toFixed(2)}</span>
                        <span className={`text-sm ml-1 ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>/month</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-green-500">Save {getSubSavings(selectedSub)}%</div>
                        <div className={`text-xs ${isDark ? 'text-[#64748B]' : 'text-[#94A3B8]'}`}>vs. pay-as-you-go</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
                        <span className="font-semibold text-[var(--accent-primary)]">{selectedSub.credits} credits</span> delivered monthly
                      </span>
                      <span className={`text-sm ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>${subPerCredit}/credit</span>
                    </div>
                    {billingCycle === 'annual' && (
                      <div className={`mt-3 pt-3 text-xs border-t ${isDark ? 'border-white/10 text-[#64748B]' : 'border-black/10 text-[#94A3B8]'}`}>
                        Billed as ${selectedSub.annualTotal.toFixed(2)}/year
                      </div>
                    )}
                  </div>

                  <button onClick={handleSubscribe} className="w-full glass-button glass-button-primary py-4 text-base font-bold">
                    {user ? 'Subscribe Now' : 'Create Account & Subscribe'}
                  </button>

                  <p className={`text-center text-xs mt-4 ${isDark ? 'text-[#64748B]' : 'text-[#94A3B8]'}`}>
                    Or{' '}
                    <button onClick={() => setPurchaseMode('credits')} className="text-[var(--accent-primary)] hover:underline font-medium">buy a credit pack</button>
                    {' '}with no commitment
                  </p>
                </div>
              </div>
            </motion.div>
          )}


          {/* ======= CREDIT PACK MODE ======= */}
          {purchaseMode === 'credits' && (
            <motion.div key="credits" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-16">
              <div className="max-w-lg mx-auto">
                <div className="glass-panel p-8">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-xl ${isDark ? 'bg-[var(--accent-secondary)]/15' : 'bg-purple-100'}`}>
                      <CreditCard className="w-6 h-6 text-[var(--accent-secondary)]" />
                    </div>
                    <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>Buy a Credit Pack</h2>
                  </div>
                  <p className={`text-sm mb-6 ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
                    One-time purchase. No subscription. Credits valid for 1 year.
                  </p>

                  <div className="mb-6">
                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-[#CBD5E1]' : 'text-[#475569]'}`}>Select a credit pack</label>
                    <div className="relative">
                      <select value={selectedPackIdx} onChange={(e) => setSelectedPackIdx(parseInt(e.target.value))}
                        className={`w-full appearance-none rounded-xl py-3 pl-4 pr-10 text-sm font-medium border outline-none transition-colors cursor-pointer ${
                          isDark ? 'bg-white/5 border-white/10 text-white focus:border-[var(--accent-primary)]'
                                 : 'bg-white border-black/10 text-[#0F172A] focus:border-cyan-500'
                        }`}>
                        {creditPacks.map((pack, idx) => (
                          <option key={idx} value={idx}>
                            {pack.credits} credits &mdash; ${pack.price.toFixed(2)}{pack.savings ? ` (Save ${pack.savings})` : ''}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isDark ? 'text-[#64748B]' : 'text-[#94A3B8]'}`} />
                    </div>
                  </div>

                  <div className={`rounded-xl p-5 mb-6 ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
                    <div className="flex items-baseline justify-between mb-3">
                      <span className={`text-4xl font-bold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>${selectedPack.price.toFixed(2)}</span>
                      {selectedPack.savings && (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-500/15 text-green-500">Save {selectedPack.savings}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
                        <span className="font-semibold text-[var(--accent-primary)]">{selectedPack.credits} credits</span>
                      </span>
                      <span className={`text-sm ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>${selectedPack.perCredit.toFixed(3)}/credit</span>
                    </div>
                  </div>

                  <button onClick={handlePurchaseCredits} className="w-full glass-button glass-button-primary py-4 text-base font-bold">
                    {user ? 'Buy Credits' : 'Create Account & Buy Credits'}
                  </button>

                  <p className={`text-center text-xs mt-4 ${isDark ? 'text-[#64748B]' : 'text-[#94A3B8]'}`}>
                    Want to save more?{' '}
                    <button onClick={() => setPurchaseMode('subscription')} className="text-[var(--accent-primary)] hover:underline font-medium">Check out subscriptions</button>
                    {' '}for up to 60% off
                  </p>
                </div>
              </div>
            </motion.div>
          )}


          {/* ======= CREDIT COST TABLE ======= */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-panel mb-16 p-6">
            <h2 className={`text-2xl font-bold text-center mb-2 ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
              Credit Cost per Minute
            </h2>
            <p className={`text-sm text-center mb-6 ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
              Costs scale with video length and quality. A 4-min song costs 4&times; the per-minute rate.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${isDark ? 'border-white/10' : 'border-black/10'}`}>
                    <th className={`text-left py-3 px-4 font-medium text-sm ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>Quality</th>
                    <th className={`text-left py-3 px-4 font-medium text-sm hidden sm:table-cell ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>Resolution</th>
                    <th className={`text-center py-3 px-4 font-medium text-sm ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
                      <div className="flex items-center justify-center gap-1"><Clock className="w-3.5 h-3.5" /> Queue</div>
                    </th>
                    <th className={`text-center py-3 px-4 font-medium text-sm ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
                      <div className="flex items-center justify-center gap-1"><Zap className="w-3.5 h-3.5 text-[var(--accent-secondary)]" /> Instant</div>
                    </th>
                    <th className={`text-center py-3 px-4 font-medium text-sm ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
                      <div className="flex items-center justify-center gap-1"><Repeat className="w-3.5 h-3.5 text-green-500" /> Re-render</div>
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
                          }`}>Exclusive</span>
                        )}
                      </td>
                      <td className={`py-4 px-4 text-sm hidden sm:table-cell ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>{tier.resolution}</td>
                      <td className="py-4 px-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${isDark ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]' : 'bg-cyan-100 text-cyan-700'}`}>
                          {tier.queueCr} cr/min
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${isDark ? 'bg-[var(--accent-secondary)]/15 text-[var(--accent-secondary)]' : 'bg-purple-100 text-purple-700'}`}>
                          {tier.instantCr} cr/min
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${isDark ? 'bg-green-500/15 text-green-400' : 'bg-green-100 text-green-700'}`}>
                          {tier.reRenderCr} cr/min
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={`mt-6 p-4 rounded-xl ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
              <p className={`text-sm ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
                <strong>Example:</strong> A 4-minute song at 1080p in Queue = 3 cr/min &times; 4 min = <strong className="text-[var(--accent-primary)]">12 credits</strong>.
                {' '}Re-rendering the same project = 2 cr/min &times; 4 min = <strong className="text-green-500">8 credits</strong>.
              </p>
            </div>
          </motion.div>


          {/* ======= ALL FEATURES ======= */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="mb-16">
            <h2 className={`text-2xl font-bold text-center mb-2 ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
              Everything Included for Everyone
            </h2>
            <p className={`text-sm text-center mb-8 ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
              No locked features. No tier gates. Free accounts get every tool &mdash; credits control the output, not the experience.
            </p>

            <div className="grid md:grid-cols-2 gap-6">
              {allFeatures.map((group, gIdx) => (
                <div key={gIdx} className="glass-panel p-5">
                  <h3 className={`text-sm font-bold uppercase tracking-wider mb-4 ${isDark ? 'text-[var(--accent-primary)]' : 'text-cyan-600'}`}>
                    {group.category}
                  </h3>
                  <div className="space-y-3">
                    {group.items.map((item, iIdx) => (
                      <div key={iIdx} className="flex items-start gap-3">
                        <div className={`p-1.5 rounded-lg flex-shrink-0 ${isDark ? 'bg-[var(--accent-primary)]/10' : 'bg-cyan-50'}`}>
                          <item.icon className="w-4 h-4 text-[var(--accent-primary)]" />
                        </div>
                        <span className={`text-sm ${isDark ? 'text-[#CBD5E1]' : 'text-[#374151]'}`}>{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>


          {/* ======= FAQ ======= */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mb-16">
            <h2 className={`text-2xl font-bold text-center mb-8 ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
              Frequently Asked Questions
            </h2>

            <div className="max-w-3xl mx-auto space-y-3">
              {faqItems.map((item, idx) => (
                <div key={idx} className="glass-panel overflow-hidden">
                  <button onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                    className={`w-full flex items-center justify-between p-4 text-left transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}>
                    <span className={`font-medium pr-4 ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>{item.question}</span>
                    {expandedFaq === idx
                      ? <ChevronUp className={`w-5 h-5 flex-shrink-0 ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`} />
                      : <ChevronDown className={`w-5 h-5 flex-shrink-0 ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`} />
                    }
                  </button>
                  {expandedFaq === idx && (
                    <div className={`px-4 pb-4 text-sm ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>{item.answer}</div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>


          {/* ======= CTA ======= */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="glass-panel text-center p-8">
            <h2 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
              Ready to create your first karaoke video?
            </h2>
            <p className={`mb-6 ${isDark ? 'text-[#94A3B8]' : 'text-[#475569]'}`}>
              Start free with 15 credits. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {user ? (
                <Link href="/dashboard" className="glass-button glass-button-primary">Go to Dashboard</Link>
              ) : (
                <>
                  <Link href="/signup" className="glass-button glass-button-primary">Create Free Account</Link>
                  <Link href="/login" className="glass-button">Sign In</Link>
                </>
              )}
            </div>
          </motion.div>
        </main>

        {/* Footer */}
        <footer className={`mt-16 py-8 border-t ${isDark ? 'border-white/10' : 'border-black/10'}`}>
          <div className="max-w-6xl mx-auto px-4 text-center">
            <p className={`text-sm ${isDark ? 'text-[#64748B]' : 'text-[#94A3B8]'}`}>
              &copy; {new Date().getFullYear()} Karatrack. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
