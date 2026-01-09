'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, User, RefreshCw, CheckCircle, Sparkles } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import SEO, { getOrganizationSchema } from '../components/SEO';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Plan details for display
const planDetails = {
  free: { name: 'Free', price: 0, credits: 5 },
  starter: { name: 'Starter', price: 9.99, credits: 25 },
  pro: { name: 'Pro', price: 24.99, credits: 75 },
  studio: { name: 'Studio', price: 49.99, credits: 200 },
};

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  
  // Selected plan from URL
  const [selectedPlan, setSelectedPlan] = useState(null);
  
  // Resend email state
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState('');
  
  // Track if email was confirmed (detected from other tab)
  const [emailConfirmed, setEmailConfirmed] = useState(false);

  // Read plan from URL on mount
  useEffect(() => {
    if (router.isReady) {
      const { plan } = router.query;
      if (plan && planDetails[plan]) {
        setSelectedPlan(plan);
      }
    }
  }, [router.isReady, router.query]);

  // Listen for auth state changes to detect when email is confirmed in another tab
  useEffect(() => {
    if (!success) return; // Only listen when showing the "check email" screen
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event);
      
      // If user signed in (confirmed email in other tab), update this tab
      if (event === 'SIGNED_IN' && session?.user?.email_confirmed_at) {
        setEmailConfirmed(true);
      }
    });
    
    // Also check periodically if the user is now confirmed
    const checkInterval = setInterval(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email_confirmed_at) {
        setEmailConfirmed(true);
        clearInterval(checkInterval);
      }
    }, 3000); // Check every 3 seconds
    
    return () => {
      subscription.unsubscribe();
      clearInterval(checkInterval);
    };
  }, [success]);

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    if (!acceptedTerms) {
      setError('You must accept the Terms of Service and Privacy Policy');
      setLoading(false);
      return;
    }

    try {
      // Store selected plan in localStorage for after email verification
      // Only store if it's a paid plan
      if (selectedPlan && selectedPlan !== 'free') {
        localStorage.setItem('karatrack_pending_plan', selectedPlan);
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            pending_plan: selectedPlan || 'free', // Also store in user metadata
          },
        },
      });

      if (error) throw error;

      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Resend confirmation email
  const handleResendEmail = async () => {
    setResending(true);
    setResendError('');
    setResendSuccess(false);

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });

      if (error) throw error;

      setResendSuccess(true);
      // Reset success message after 5 seconds
      setTimeout(() => setResendSuccess(false), 5000);
    } catch (err) {
      setResendError(err.message);
    } finally {
      setResending(false);
    }
  };

  // Get the display info for selected plan
  const planInfo = selectedPlan ? planDetails[selectedPlan] : null;
  const isPaidPlan = planInfo && planInfo.price > 0;

  if (success) {
    // If email was confirmed in another tab, show a different message
    if (emailConfirmed) {
      return (
        <>
          <SEO 
            title="Email Confirmed!"
            description="Your email has been verified. You can close this tab."
            path="/signup"
          />
          <div className="min-h-screen bg-animated-dark flex items-center justify-center px-6 py-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-md"
            >
              <div className="glass-panel p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Email Confirmed! ✓</h1>
                <p className="text-gray-400 mb-6">
                  Your account has been verified. You can safely close this tab.
                </p>
                
                <div className="mb-6 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                  <p className="text-sm text-green-300">
                    {isPaidPlan 
                      ? 'Continue in the other tab to complete your subscription checkout.'
                      : 'Continue in the other tab to access your dashboard.'}
                  </p>
                </div>
                
                <Link href="/dashboard" className="glass-button glass-button-primary px-6 py-3 inline-block">
                  Or continue here →
                </Link>
              </div>
            </motion.div>
          </div>
        </>
      );
    }
    
    return (
      <>
        <SEO 
          title="Check Your Email"
          description="Please verify your email address to complete your Karatrack Studio registration."
          path="/signup"
        />
        <div className="min-h-screen bg-animated-dark flex items-center justify-center px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md"
          >
            <div className="glass-panel p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
                <Mail className="w-8 h-8 text-green-400" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Check Your Email</h1>
              <p className="text-gray-400 mb-6">
                We've sent a confirmation link to <span className="text-cyan-400">{email}</span>
              </p>
              
              {/* Show selected plan reminder for paid plans */}
              {isPaidPlan && (
                <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/30">
                  <p className="text-sm text-gray-300">
                    After confirming your email, you'll be redirected to complete your{' '}
                    <span className="text-cyan-400 font-semibold">{planInfo.name}</span> subscription.
                  </p>
                </div>
              )}
              
              {/* Resend Email Section */}
              <div className="mb-6 p-4 rounded-lg bg-white/5 border border-white/10">
                <p className="text-sm text-gray-400 mb-3">
                  Didn't receive the email? Check your spam folder or resend it.
                </p>
                
                {resendSuccess && (
                  <div className="flex items-center justify-center gap-2 text-green-400 text-sm mb-3">
                    <CheckCircle className="w-4 h-4" />
                    <span>Confirmation email sent!</span>
                  </div>
                )}
                
                {resendError && (
                  <div className="text-red-400 text-sm mb-3">
                    {resendError}
                  </div>
                )}
                
                <button
                  onClick={handleResendEmail}
                  disabled={resending}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 rounded-lg text-cyan-400 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-4 h-4 ${resending ? 'animate-spin' : ''}`} />
                  {resending ? 'Sending...' : 'Resend Confirmation Email'}
                </button>
              </div>
              
              <Link href="/login" className="text-cyan-400 hover:text-cyan-300 font-medium">
                Back to Sign In
              </Link>
            </div>
          </motion.div>
        </div>
      </>
    );
  }

  return (
    <>
      <SEO 
        title="Create Account"
        description="Sign up for Karatrack Studio and start creating professional karaoke videos with AI-powered vocal removal and synchronized lyrics. Free tier available."
        path="/signup"
        structuredData={getOrganizationSchema()}
      />
      <div className="min-h-screen bg-animated-dark flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          {/* Logo */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-3">
              <img src="/logo.png" alt="Karatrack Studio" className="h-12 w-auto" />
              <span className="font-display font-bold text-2xl text-gradient">Karatrack Studio</span>
            </Link>
          </div>

          {/* Selected Plan Banner - Shows for paid plans */}
          {isPaidPlan && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 rounded-xl bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Selected plan</p>
                    <p className="text-white font-semibold">{planInfo.name} - ${planInfo.price}/mo</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-cyan-400 font-bold">{planInfo.credits}</p>
                  <p className="text-xs text-gray-400">credits/mo</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3">
                You'll complete payment after verifying your email.
              </p>
            </motion.div>
          )}

          {/* Signup Form */}
          <div className="glass-panel p-8">
            <h1 className="text-2xl font-bold text-white text-center mb-2">Create Account</h1>
            <p className="text-gray-400 text-center mb-8">
              {isPaidPlan 
                ? `Get started with ${planInfo.name}` 
                : 'Start transforming your music today'}
            </p>

            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mb-6">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSignup} className="space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
                    placeholder="John Doe"
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-12 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
                    placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
                    placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                    required
                  />
                </div>
              </div>

              {/* Terms Checkbox */}
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="terms"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0 cursor-pointer"
                />
                <label htmlFor="terms" className="text-sm text-gray-400 cursor-pointer">
                  I agree to the{' '}
                  <Link href="/terms" className="text-cyan-400 hover:text-cyan-300">Terms of Service</Link>
                  {' '}and{' '}
                  <Link href="/privacy" className="text-cyan-400 hover:text-cyan-300">Privacy Policy</Link>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full glass-button-primary glass-button py-4 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating account...' : isPaidPlan ? `Continue with ${planInfo.name}` : 'Create Account'}
              </button>
            </form>

            {/* Change Plan Link - for paid plans */}
            {isPaidPlan && (
              <p className="text-center text-gray-500 text-sm mt-4">
                <Link href="/pricing" className="text-gray-400 hover:text-cyan-300">
                  Change plan
                </Link>
              </p>
            )}

            {/* Sign In Link */}
            <p className="text-center text-gray-400 mt-6">
              Already have an account?{' '}
              <Link href="/login" className="text-cyan-400 hover:text-cyan-300 font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </>
  );
}