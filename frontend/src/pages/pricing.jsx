'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  Music, 
  Check, 
  X, 
  Zap, 
  ArrowLeft, 
  Sparkles,
  Palette,
  Edit3,
  MessageCircle,
  Mail,
  Headphones,
  Crown
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Updated plans with correct features from handover document
const plans = [
  {
    tier: 'free',
    name: 'Free',
    price: 0,
    credits: 5,
    description: 'Try it out',
    highlights: [
      { text: '5 credits/month', included: true },
      { text: '480p video quality', included: true },
      { text: 'Karatrack watermark', included: true, note: 'Logo + link' },
      { text: 'Chat support', included: true },
    ],
    features: {
      watermark: 'karatrack',
      maxQuality: '480p',
      editLyrics: false,
      colorCustomization: false,
      adjustLyricsStyle: false,
      emailSupport: false,
      prioritySupport: false,
    },
    popular: false,
  },
  {
    tier: 'starter',
    name: 'Starter',
    price: 9.99,
    credits: 25,
    description: 'For casual creators',
    highlights: [
      { text: '25 credits/month', included: true },
      { text: '1080p video quality', included: true },
      { text: 'No watermark', included: true },
      { text: 'Color customization', included: true },
      { text: 'Email support', included: true },
    ],
    features: {
      watermark: 'none',
      maxQuality: '1080p',
      editLyrics: false,
      colorCustomization: true,
      adjustLyricsStyle: false,
      emailSupport: true,
      prioritySupport: false,
    },
    popular: false,
  },
  {
    tier: 'pro',
    name: 'Pro',
    price: 24.99,
    credits: 75,
    description: 'For serious creators',
    highlights: [
      { text: '75 credits/month', included: true },
      { text: '1080p video quality', included: true },
      { text: 'No watermark', included: true },
      { text: 'Edit lyrics before render', included: true },
      { text: 'Email support', included: true },
    ],
    features: {
      watermark: 'none',
      maxQuality: '1080p',
      editLyrics: true,
      colorCustomization: true,
      adjustLyricsStyle: false,
      emailSupport: true,
      prioritySupport: false,
    },
    popular: true,
  },
  {
    tier: 'studio',
    name: 'Studio',
    price: 49.99,
    credits: 200,
    description: 'For professionals',
    highlights: [
      { text: '200 credits/month', included: true },
      { text: '4K video quality', included: true },
      { text: 'Custom logo watermark', included: true },
      { text: 'Edit lyrics before render', included: true },
      { text: 'Full style control', included: true },
      { text: 'Priority support', included: true },
    ],
    features: {
      watermark: 'custom',
      maxQuality: '4K',
      editLyrics: true,
      colorCustomization: true,
      adjustLyricsStyle: true,
      emailSupport: true,
      prioritySupport: true,
    },
    popular: false,
  },
];

// Feature comparison data for the table
const featureComparison = [
  {
    category: 'Credits & Quality',
    features: [
      { 
        name: 'Monthly credits', 
        free: '5', 
        starter: '25', 
        pro: '75', 
        studio: '200',
        type: 'text'
      },
      { 
        name: 'Max video quality', 
        free: '480p', 
        starter: '1080p', 
        pro: '1080p', 
        studio: '4K',
        type: 'text'
      },
    ]
  },
  {
    category: 'Branding',
    features: [
      { 
        name: 'Watermark', 
        free: 'Karatrack logo', 
        starter: 'None', 
        pro: 'None', 
        studio: 'Your logo',
        type: 'text'
      },
    ]
  },
  {
    category: 'Customization',
    features: [
      { 
        name: 'Color customization', 
        free: false, 
        starter: true, 
        pro: true, 
        studio: true,
        type: 'boolean'
      },
      { 
        name: 'Adjust lyrics color & outline', 
        free: false, 
        starter: false, 
        pro: false, 
        studio: true,
        type: 'boolean'
      },
      { 
        name: 'Edit lyrics before render', 
        free: false, 
        starter: false, 
        pro: true, 
        studio: true,
        type: 'boolean'
      },
    ]
  },
  {
    category: 'Support',
    features: [
      { 
        name: 'Chat support', 
        free: true, 
        starter: true, 
        pro: true, 
        studio: true,
        type: 'boolean'
      },
      { 
        name: 'Email support', 
        free: false, 
        starter: true, 
        pro: true, 
        studio: true,
        type: 'boolean'
      },
      { 
        name: 'Priority support', 
        free: false, 
        starter: false, 
        pro: false, 
        studio: true,
        type: 'boolean'
      },
    ]
  },
];

// Helper component to render feature value in comparison table
const FeatureValue = ({ value, type }) => {
  if (type === 'text') {
    return <span className="text-white font-medium">{value}</span>;
  }
  
  if (value === true) {
    return (
      <div className="flex justify-center">
        <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
          <Check className="w-4 h-4 text-green-400" />
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex justify-center">
      <div className="w-6 h-6 rounded-full bg-gray-500/20 flex items-center justify-center">
        <X className="w-4 h-4 text-gray-500" />
      </div>
    </div>
  );
};

export default function PricingPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(null);
  const [showComparison, setShowComparison] = useState(false);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setProfile(profileData);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (tier) => {
    // If not logged in, redirect to signup
    if (!user) {
      router.push('/signup?redirect=pricing');
      return;
    }

    // If already on this plan
    if (profile?.subscription_tier === tier) {
      return;
    }

    // Free tier doesn't need Stripe
    if (tier === 'free') {
      return;
    }

    setSubscribing(tier);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      // Get the Stripe price ID for this tier
      const { data: planData } = await supabase
        .from('subscription_plans')
        .select('stripe_price_id')
        .eq('tier', tier)
        .single();

      if (!planData?.stripe_price_id) {
        throw new Error('Plan not found');
      }

      // Create Stripe checkout session
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stripe/create-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          price_id: planData.stripe_price_id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout');
      }

      // Redirect to Stripe checkout
      window.location.href = data.url;

    } catch (err) {
      console.error('Subscribe error:', err);
      alert(err.message);
    } finally {
      setSubscribing(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stripe/portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to open portal');
      }

      window.location.href = data.url;

    } catch (err) {
      console.error('Portal error:', err);
      alert(err.message);
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
            <span className="font-display font-bold text-xl text-gradient">Karatrack Studio</span>
          </Link>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                <div className="credit-badge">
                  <div className="credit-badge-icon">
                    <Zap className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-sm text-white">{profile?.credits_remaining || 0} Credits</span>
                </div>
                <Link href="/dashboard">
                  <button className="glass-button">Dashboard</button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/login">
                  <button className="glass-button">Log In</button>
                </Link>
                <Link href="/signup">
                  <button className="glass-button-primary glass-button">Sign Up</button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-16">
        <Link href="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8">
          <ArrowLeft className="w-5 h-5" />
          Back to Home
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4 text-white">
            Simple <span className="text-gradient">Pricing</span>
          </h1>
          <p className="text-lg text-gray-400 max-w-xl mx-auto">
            Choose the plan that fits your needs. Upgrade or downgrade anytime.
          </p>

          {profile?.subscription_tier && profile.subscription_tier !== 'free' && (
            <div className="mt-6">
              <p className="text-gray-400 mb-2">
                Current plan: <span className="text-cyan-400 font-semibold capitalize">{profile.subscription_tier}</span>
              </p>
              <button
                onClick={handleManageSubscription}
                className="text-sm text-purple-400 hover:text-purple-300 underline"
              >
                Manage Subscription
              </button>
            </div>
          )}
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-12">
          {plans.map((plan, i) => {
            const isCurrentPlan = profile?.subscription_tier === plan.tier;
            const isUpgrade = profile && plans.findIndex(p => p.tier === profile.subscription_tier) < i;

            return (
              <motion.div
                key={plan.tier}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`feature-card relative ${plan.popular ? 'border-cyan-500/50 shadow-lg shadow-cyan-500/10' : ''} ${isCurrentPlan ? 'ring-2 ring-green-500/50' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-r from-cyan-400 to-purple-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      MOST POPULAR
                    </span>
                  </div>
                )}

                {isCurrentPlan && (
                  <div className="absolute -top-3 right-4">
                    <span className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                      CURRENT
                    </span>
                  </div>
                )}

                {/* Plan Header */}
                <div className="mb-6">
                  <h3 className="font-display text-xl font-semibold mb-1 text-white">{plan.name}</h3>
                  <p className="text-sm text-gray-400">{plan.description}</p>
                </div>

                {/* Price */}
                <div className="mb-6">
                  <span className="text-4xl font-bold text-white">${plan.price}</span>
                  <span className="text-gray-400">/month</span>
                </div>

                {/* Credits Badge */}
                <div className="mb-6 inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 rounded-full px-3 py-1.5">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-medium text-white">{plan.credits} credits/month</span>
                </div>

                {/* Features List */}
                <ul className="space-y-3 mb-8">
                  {plan.highlights.map((highlight, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-cyan-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-300">
                        {highlight.text}
                        {highlight.note && (
                          <span className="text-gray-500 ml-1">({highlight.note})</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Subscribe Button */}
                <button
                  onClick={() => handleSubscribe(plan.tier)}
                  disabled={isCurrentPlan || subscribing === plan.tier || loading}
                  className={`w-full glass-button py-3 ${
                    plan.popular ? 'glass-button-primary' : ''
                  } ${isCurrentPlan ? 'opacity-50 cursor-not-allowed' : ''} ${
                    !plan.popular && !isCurrentPlan ? 'text-white hover:bg-white/10' : ''
                  }`}
                >
                  {subscribing === plan.tier ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing...
                    </span>
                  ) : isCurrentPlan ? (
                    'Current Plan'
                  ) : plan.tier === 'free' ? (
                    'Get Started Free'
                  ) : isUpgrade ? (
                    'Upgrade Now'
                  ) : (
                    'Subscribe'
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>

        {/* Compare All Features Button */}
        <div className="text-center mb-8">
          <button
            onClick={() => setShowComparison(!showComparison)}
            className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            {showComparison ? 'Hide' : 'Compare all'} features
            <motion.span
              animate={{ rotate: showComparison ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              ▼
            </motion.span>
          </button>
        </div>

        {/* Feature Comparison Table */}
        <motion.div
          initial={false}
          animate={{ 
            height: showComparison ? 'auto' : 0,
            opacity: showComparison ? 1 : 0
          }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden"
        >
          <div className="glass-panel p-6 mb-16 overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-4 px-4 text-gray-400 font-medium">Feature</th>
                  <th className="text-center py-4 px-4 text-white font-semibold">Free</th>
                  <th className="text-center py-4 px-4 text-white font-semibold">Starter</th>
                  <th className="text-center py-4 px-4 text-white font-semibold relative">
                    Pro
                    <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-xs text-cyan-400">★</span>
                  </th>
                  <th className="text-center py-4 px-4 text-white font-semibold">Studio</th>
                </tr>
              </thead>
              <tbody>
                {featureComparison.map((category, catIndex) => (
                  <>
                    {/* Category Header */}
                    <tr key={`cat-${catIndex}`} className="bg-white/5">
                      <td colSpan={5} className="py-3 px-4 text-sm font-semibold text-cyan-400">
                        {category.category}
                      </td>
                    </tr>
                    {/* Features in Category */}
                    {category.features.map((feature, featIndex) => (
                      <tr 
                        key={`feat-${catIndex}-${featIndex}`}
                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                      >
                        <td className="py-3 px-4 text-gray-300">{feature.name}</td>
                        <td className="py-3 px-4 text-center">
                          <FeatureValue value={feature.free} type={feature.type} />
                        </td>
                        <td className="py-3 px-4 text-center">
                          <FeatureValue value={feature.starter} type={feature.type} />
                        </td>
                        <td className="py-3 px-4 text-center bg-cyan-500/5">
                          <FeatureValue value={feature.pro} type={feature.type} />
                        </td>
                        <td className="py-3 px-4 text-center">
                          <FeatureValue value={feature.studio} type={feature.type} />
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Credit Packages */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-20"
        >
          <h2 className="font-display text-3xl font-bold text-white text-center mb-4">
            Need More Credits?
          </h2>
          <p className="text-gray-400 text-center mb-4">
            Purchase additional credits anytime
          </p>
          <p className="text-sm text-gray-500 text-center mb-10">
            Credits cost: 480p = 3 credits • 720p = 5 credits • 1080p = 7 credits
          </p>

          <div className="grid md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {[
              { credits: 10, price: 4.99, perCredit: '0.50' },
              { credits: 25, price: 9.99, perCredit: '0.40' },
              { credits: 50, price: 17.99, perCredit: '0.36', popular: true },
              { credits: 100, price: 29.99, perCredit: '0.30' },
            ].map((pkg, i) => (
              <motion.div
                key={pkg.credits}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + i * 0.1 }}
                className={`glass-panel p-6 text-center relative ${pkg.popular ? 'border-purple-500/50' : ''}`}
              >
                {pkg.popular && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                    <span className="bg-purple-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      BEST VALUE
                    </span>
                  </div>
                )}
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400/20 to-purple-500/20 flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-6 h-6 text-cyan-400" />
                </div>
                <p className="text-2xl font-bold text-white">{pkg.credits}</p>
                <p className="text-gray-400 text-sm mb-2">credits</p>
                <p className="text-xs text-gray-500 mb-4">${pkg.perCredit}/credit</p>
                <p className="text-xl font-semibold text-gradient mb-4">${pkg.price}</p>
                <button
                  onClick={() => {
                    if (!user) {
                      router.push('/signup');
                    } else {
                      // TODO: Implement credit purchase
                      alert('Credit purchase coming soon!');
                    }
                  }}
                  className="w-full glass-button py-2 text-sm text-white hover:bg-white/10"
                >
                  Buy Credits
                </button>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* FAQ Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-20"
        >
          <h2 className="font-display text-3xl font-bold text-white text-center mb-10">
            Frequently Asked Questions
          </h2>
          
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="glass-panel p-6">
              <h3 className="font-semibold text-white mb-2">How do credits work?</h3>
              <p className="text-gray-400 text-sm">
                Each karaoke track costs credits based on video quality: 480p costs 3 credits, 
                720p costs 5 credits, and 1080p costs 7 credits. Credits reset monthly with your subscription.
              </p>
            </div>
            
            <div className="glass-panel p-6">
              <h3 className="font-semibold text-white mb-2">What is "Edit lyrics before render"?</h3>
              <p className="text-gray-400 text-sm">
                Pro and Studio users can review and edit the AI-transcribed lyrics before the final video is created. 
                This lets you fix any transcription errors for a perfect result.
              </p>
            </div>
            
            <div className="glass-panel p-6">
              <h3 className="font-semibold text-white mb-2">Can I change plans anytime?</h3>
              <p className="text-gray-400 text-sm">
                Yes! You can upgrade or downgrade your plan at any time. Changes take effect 
                immediately, and we'll prorate any differences.
              </p>
            </div>
            
            <div className="glass-panel p-6">
              <h3 className="font-semibold text-white mb-2">What's the watermark on Free tier?</h3>
              <p className="text-gray-400 text-sm">
                Free tier videos include a small Karatrack logo and link at the bottom. 
                Upgrade to Starter or higher to remove it, or go Studio to add your own logo!
              </p>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}