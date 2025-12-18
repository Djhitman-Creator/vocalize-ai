'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Music, Check, Zap, ArrowLeft } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const plans = [
  {
    tier: 'free',
    name: 'Free',
    price: 0,
    credits: 3,
    features: ['3 credits/month', '10MB max file size', '720p video export', 'Community support'],
    popular: false,
  },
  {
    tier: 'starter',
    name: 'Starter',
    price: 9.99,
    credits: 25,
    features: ['25 credits/month', '50MB max file size', '1080p video export', 'Email support'],
    popular: false,
  },
  {
    tier: 'pro',
    name: 'Pro',
    price: 24.99,
    credits: 75,
    features: ['75 credits/month', '100MB max file size', '1080p video export', 'Priority support'],
    popular: true,
  },
  {
    tier: 'studio',
    name: 'Studio',
    price: 49.99,
    credits: 200,
    features: ['200 credits/month', '500MB max file size', '4K video export', 'Dedicated support'],
    popular: false,
  },
];

export default function PricingPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(null);

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
        <div className="grid md:grid-cols-4 gap-6">
          {plans.map((plan, i) => {
            const isCurrentPlan = profile?.subscription_tier === plan.tier;
            const isUpgrade = profile && plans.findIndex(p => p.tier === profile.subscription_tier) < i;

            return (
              <motion.div
                key={plan.tier}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`feature-card relative ${plan.popular ? 'border-cyan-500/50' : ''} ${isCurrentPlan ? 'ring-2 ring-green-500/50' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-r from-cyan-400 to-purple-500 text-white text-xs font-bold px-3 py-1 rounded-full">
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

                <h3 className="font-display text-xl font-semibold mb-2 text-white">{plan.name}</h3>

                <div className="mb-6">
                  <span className="text-4xl font-bold text-white">${plan.price}</span>
                  <span className="text-gray-400">/month</span>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-gray-300">
                      <Check className="w-4 h-4 text-cyan-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSubscribe(plan.tier)}
                  disabled={isCurrentPlan || subscribing === plan.tier || loading}
                  className={`w-full glass-button py-3 ${
                    plan.popular ? 'glass-button-primary' : ''
                  } ${isCurrentPlan ? 'opacity-50 cursor-not-allowed' : ''} ${
                    !plan.popular && !isCurrentPlan ? 'text-white' : ''
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
                    'Get Started'
                  ) : (
                    'Subscribe'
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>

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
          <p className="text-gray-400 text-center mb-10">
            Purchase additional credits anytime
          </p>

          <div className="grid md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {[
              { credits: 10, price: 4.99 },
              { credits: 25, price: 9.99 },
              { credits: 50, price: 17.99 },
              { credits: 100, price: 29.99 },
            ].map((pkg, i) => (
              <motion.div
                key={pkg.credits}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + i * 0.1 }}
                className="glass-panel p-6 text-center"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400/20 to-purple-500/20 flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-6 h-6 text-cyan-400" />
                </div>
                <p className="text-2xl font-bold text-white">{pkg.credits}</p>
                <p className="text-gray-400 text-sm mb-4">credits</p>
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
                  className="w-full glass-button py-2 text-sm text-white"
                >
                  Buy Credits
                </button>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
}