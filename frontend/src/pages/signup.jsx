'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, User, RefreshCw, CheckCircle, Sparkles } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { useTheme } from '../context/ThemeContext';
import SEO, { getOrganizationSchema } from '../components/SEO';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function SignupPage() {
  const router = useRouter();
  const { isDark } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Resend email state
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState('');

  // Track if email was confirmed (detected from other tab)
  const [emailConfirmed, setEmailConfirmed] = useState(false);

  // Listen for auth state changes to detect when email is confirmed in another tab
  useEffect(() => {
    if (!success) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user?.email_confirmed_at) {
        setEmailConfirmed(true);
      }
    });

    const checkInterval = setInterval(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email_confirmed_at) {
        setEmailConfirmed(true);
        clearInterval(checkInterval);
      }
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearInterval(checkInterval);
    };
  }, [success]);

  // Email/password signup
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
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
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

  // Social OAuth signup (same as login page)
  const handleSocialLogin = async (provider) => {
    setError('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
    } catch (err) {
      setError(err.message);
    }
  };

  // Resend confirmation email
  const handleResendEmail = async () => {
    setResending(true);
    setResendError('');
    setResendSuccess(false);

    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) throw error;
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 5000);
    } catch (err) {
      setResendError(err.message);
    } finally {
      setResending(false);
    }
  };

  // ── Email confirmed screen ──
  if (success && emailConfirmed) {
    return (
      <>
        <SEO title="Email Confirmed!" description="Your email has been verified." path="/signup" />
        <div className={isDark ? 'dark' : ''}>
          <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: isDark ? '#0A0A0F' : '#F0F4F8' }}>
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} style={{ width: '100%', maxWidth: '440px' }}>
              <div style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.75)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, borderRadius: '28px', padding: '40px 36px', textAlign: 'center', boxShadow: isDark ? '0 8px 40px rgba(0,0,0,0.4)' : '0 8px 40px rgba(0,0,0,0.06)' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(16,185,129,0.15)' }}>
                  <CheckCircle style={{ width: '32px', height: '32px', color: '#10B981' }} />
                </div>
                <h1 style={{ fontSize: '24px', fontWeight: 700, color: isDark ? '#F8FAFC' : '#0F172A', marginBottom: '8px' }}>Email Confirmed!</h1>
                <p style={{ fontSize: '14px', color: isDark ? '#94A3B8' : '#64748B', marginBottom: '24px' }}>Your account has been verified. You can safely close this tab or continue below.</p>
                <Link href="/dashboard" style={{ display: 'inline-block', padding: '14px 28px', borderRadius: '14px', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', color: '#0A0A0F', fontSize: '15px', fontWeight: 600, textDecoration: 'none' }}>
                  Go to Dashboard &rarr;
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </>
    );
  }

  // ── Check your email screen ──
  if (success) {
    return (
      <>
        <SEO title="Check Your Email" description="Verify your email to complete signup." path="/signup" />
        <div className={isDark ? 'dark' : ''}>
          <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: isDark ? '#0A0A0F' : '#F0F4F8' }}>
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} style={{ width: '100%', maxWidth: '440px' }}>
              <div style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.75)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, borderRadius: '28px', padding: '40px 36px', textAlign: 'center', boxShadow: isDark ? '0 8px 40px rgba(0,0,0,0.4)' : '0 8px 40px rgba(0,0,0,0.06)' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? 'rgba(0,245,255,0.1)' : 'rgba(0,212,228,0.1)' }}>
                  <Mail style={{ width: '32px', height: '32px', color: isDark ? '#22D3EE' : '#0891B2' }} />
                </div>
                <h1 style={{ fontSize: '24px', fontWeight: 700, color: isDark ? '#F8FAFC' : '#0F172A', marginBottom: '8px' }}>Check your email</h1>
                <p style={{ fontSize: '14px', color: isDark ? '#94A3B8' : '#64748B', marginBottom: '8px' }}>We sent a confirmation link to:</p>
                <p style={{ fontSize: '15px', fontWeight: 600, color: isDark ? '#22D3EE' : '#0891B2', marginBottom: '24px' }}>{email}</p>
                <p style={{ fontSize: '13px', color: isDark ? '#64748B' : '#94A3B8', marginBottom: '24px' }}>Click the link in the email to verify your account. This page will update automatically once confirmed.</p>

                <div style={{ marginBottom: '16px' }}>
                  {resendSuccess && <p style={{ fontSize: '13px', color: '#10B981', marginBottom: '8px' }}>Confirmation email resent!</p>}
                  {resendError && <p style={{ fontSize: '13px', color: '#EF4444', marginBottom: '8px' }}>{resendError}</p>}
                  <button onClick={handleResendEmail} disabled={resending} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '12px', border: 'none', cursor: resending ? 'not-allowed' : 'pointer', background: isDark ? 'rgba(0,245,255,0.1)' : 'rgba(0,212,228,0.1)', color: isDark ? '#22D3EE' : '#0891B2', fontSize: '13px', fontWeight: 600, opacity: resending ? 0.6 : 1 }}>
                    <RefreshCw style={{ width: '14px', height: '14px', animation: resending ? 'spin 1s linear infinite' : 'none' }} />
                    {resending ? 'Sending...' : 'Resend Confirmation Email'}
                  </button>
                </div>

                <Link href="/login" style={{ fontSize: '14px', fontWeight: 600, color: isDark ? '#22D3EE' : '#0891B2', textDecoration: 'none' }}>Back to Sign In</Link>
              </div>
            </motion.div>
          </div>
        </div>
      </>
    );
  }

  // ── Main signup form ──
  return (
    <>
      <SEO title="Create Account" description="Sign up for Karatrack Studio and start creating professional karaoke videos with AI-powered vocal removal and synchronized lyrics. Start free with 19 credits." path="/signup" structuredData={getOrganizationSchema()} />

      <div className={isDark ? 'dark' : ''}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative', overflow: 'hidden', background: isDark ? '#0A0A0F' : '#F0F4F8' }}>

          {/* Animated background blobs (matches login.jsx) */}
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
            <div className="signup-blob signup-blob-1" style={{ position: 'absolute', width: '600px', height: '600px', borderRadius: '50%', top: '-200px', left: '-150px', background: isDark ? 'radial-gradient(circle, rgba(0,245,255,0.15) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(0,212,228,0.2) 0%, transparent 70%)', filter: 'blur(60px)' }} />
            <div className="signup-blob signup-blob-2" style={{ position: 'absolute', width: '500px', height: '500px', borderRadius: '50%', bottom: '-150px', right: '-100px', background: isDark ? 'radial-gradient(circle, rgba(177,78,255,0.15) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(147,51,234,0.15) 0%, transparent 70%)', filter: 'blur(60px)' }} />
            <div className="signup-blob signup-blob-3" style={{ position: 'absolute', width: '400px', height: '400px', borderRadius: '50%', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: isDark ? 'radial-gradient(circle, rgba(0,245,255,0.05) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(0,212,228,0.08) 0%, transparent 70%)', filter: 'blur(80px)' }} />
          </div>

          {/* Main card */}
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '440px' }}>
            <div style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.75)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, borderRadius: '28px', padding: '40px 36px', boxShadow: isDark ? '0 8px 40px rgba(0,0,0,0.4), 0 0 80px rgba(0,245,255,0.04)' : '0 8px 40px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)' }}>

              {/* Logo */}
              <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
                  <img src="/logo.png" alt="Karatrack Studio" style={{ height: '40px', width: 'auto' }} />
                  <span style={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: '20px', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Karatrack Studio</span>
                </Link>
              </div>

              <h1 style={{ textAlign: 'center', fontSize: '24px', fontWeight: 700, color: isDark ? '#F8FAFC' : '#0F172A', marginBottom: '6px' }}>Create your account</h1>
              <p style={{ textAlign: 'center', fontSize: '14px', color: isDark ? '#94A3B8' : '#64748B', marginBottom: '28px' }}>Start free with 19 credits &mdash; no card required</p>

              {/* Error */}
              {error && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ background: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.08)', border: `1px solid ${isDark ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.25)'}`, borderRadius: '12px', padding: '12px 16px', marginBottom: '20px' }}>
                  <p style={{ fontSize: '13px', color: isDark ? '#FCA5A5' : '#DC2626', margin: 0 }}>{error}</p>
                </motion.div>
              )}

              {/* Social login buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                <button type="button" onClick={() => handleSocialLogin('google')} className="signup-social-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', width: '100%', padding: '13px 20px', borderRadius: '14px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'}`, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.9)', color: isDark ? '#E2E8F0' : '#1E293B', fontSize: '14px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s ease', fontFamily: "'Inter', sans-serif" }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/><path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/></svg>
                  Sign up with Google
                </button>
                <button type="button" onClick={() => handleSocialLogin('azure')} className="signup-social-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', width: '100%', padding: '13px 20px', borderRadius: '14px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'}`, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.9)', color: isDark ? '#E2E8F0' : '#1E293B', fontSize: '14px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s ease', fontFamily: "'Inter', sans-serif" }}>
                  <svg width="18" height="18" viewBox="0 0 21 21" fill="none"><rect x="1" y="1" width="9" height="9" fill="#F25022"/><rect x="11" y="1" width="9" height="9" fill="#7FBA00"/><rect x="1" y="11" width="9" height="9" fill="#00A4EF"/><rect x="11" y="11" width="9" height="9" fill="#FFB900"/></svg>
                  Sign up with Microsoft
                </button>
              </div>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                <div style={{ flex: 1, height: '1px', background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }} />
                <span style={{ fontSize: '12px', fontWeight: 500, color: isDark ? '#64748B' : '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>or</span>
                <div style={{ flex: 1, height: '1px', background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }} />
              </div>

              {/* Form */}
              <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: isDark ? '#CBD5E1' : '#475569', marginBottom: '6px' }}>Full Name</label>
                  <div style={{ position: 'relative' }}>
                    <User style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: isDark ? '#64748B' : '#94A3B8', pointerEvents: 'none' }} />
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" required className="signup-input" style={{ width: '100%', padding: '12px 14px 12px 44px', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'}`, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.6)', color: isDark ? '#F8FAFC' : '#0F172A', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s ease, box-shadow 0.2s ease', fontFamily: "'Inter', sans-serif" }} />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: isDark ? '#CBD5E1' : '#475569', marginBottom: '6px' }}>Email</label>
                  <div style={{ position: 'relative' }}>
                    <Mail style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: isDark ? '#64748B' : '#94A3B8', pointerEvents: 'none' }} />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required className="signup-input" style={{ width: '100%', padding: '12px 14px 12px 44px', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'}`, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.6)', color: isDark ? '#F8FAFC' : '#0F172A', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s ease, box-shadow 0.2s ease', fontFamily: "'Inter', sans-serif" }} />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: isDark ? '#CBD5E1' : '#475569', marginBottom: '6px' }}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: isDark ? '#64748B' : '#94A3B8', pointerEvents: 'none' }} />
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 characters" required className="signup-input" style={{ width: '100%', padding: '12px 44px 12px 44px', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'}`, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.6)', color: isDark ? '#F8FAFC' : '#0F172A', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s ease, box-shadow 0.2s ease', fontFamily: "'Inter', sans-serif" }} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', color: isDark ? '#64748B' : '#94A3B8' }}>
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: isDark ? '#CBD5E1' : '#475569', marginBottom: '6px' }}>Confirm Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: isDark ? '#64748B' : '#94A3B8', pointerEvents: 'none' }} />
                    <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat password" required className="signup-input" style={{ width: '100%', padding: '12px 14px 12px 44px', borderRadius: '12px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'}`, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.6)', color: isDark ? '#F8FAFC' : '#0F172A', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s ease, box-shadow 0.2s ease', fontFamily: "'Inter', sans-serif" }} />
                  </div>
                </div>

                {/* Terms */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <input type="checkbox" id="terms" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} style={{ marginTop: '3px', width: '16px', height: '16px', cursor: 'pointer', accentColor: isDark ? '#22D3EE' : '#0891B2' }} />
                  <label htmlFor="terms" style={{ fontSize: '13px', color: isDark ? '#94A3B8' : '#64748B', cursor: 'pointer', lineHeight: '1.5' }}>
                    I agree to the{' '}
                    <Link href="/terms" style={{ color: isDark ? '#22D3EE' : '#0891B2', textDecoration: 'none', fontWeight: 500 }}>Terms of Service</Link>
                    {' '}and{' '}
                    <Link href="/privacy" style={{ color: isDark ? '#22D3EE' : '#0891B2', textDecoration: 'none', fontWeight: 500 }}>Privacy Policy</Link>
                  </label>
                </div>

                {/* Submit */}
                <button type="submit" disabled={loading} className="signup-submit-btn" style={{ width: '100%', padding: '14px 20px', borderRadius: '14px', border: 'none', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', color: '#0A0A0F', fontSize: '15px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, transition: 'all 0.3s ease', fontFamily: "'Inter', sans-serif", marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  {loading ? (<><span className="signup-spinner" /> Creating account...</>) : 'Create Account'}
                </button>
              </form>

              {/* Terms notice */}
              <p style={{ textAlign: 'center', fontSize: '12px', color: isDark ? '#64748B' : '#94A3B8', marginTop: '20px', lineHeight: '1.5' }}>
                By proceeding, you agree to our{' '}
                <Link href="/terms" style={{ color: isDark ? '#22D3EE' : '#0891B2', textDecoration: 'none', fontWeight: 500 }}>Terms</Link>{' '}and{' '}
                <Link href="/privacy" style={{ color: isDark ? '#22D3EE' : '#0891B2', textDecoration: 'none', fontWeight: 500 }}>Privacy Policy</Link>
              </p>

              {/* Sign in link */}
              <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, textAlign: 'center' }}>
                <p style={{ fontSize: '14px', color: isDark ? '#94A3B8' : '#64748B', margin: 0 }}>
                  Already have an account?{' '}
                  <Link href="/login" style={{ color: isDark ? '#22D3EE' : '#0891B2', textDecoration: 'none', fontWeight: 600 }} className="signup-signin-link">Sign in</Link>
                </p>
              </div>
            </div>
          </motion.div>

          {/* Scoped styles */}
          <style jsx global>{`
            .signup-blob-1 { animation: signupBlobFloat1 18s ease-in-out infinite; }
            .signup-blob-2 { animation: signupBlobFloat2 22s ease-in-out infinite; }
            .signup-blob-3 { animation: signupBlobFloat3 15s ease-in-out infinite; }
            @keyframes signupBlobFloat1 { 0%, 100% { transform: translate(0, 0) scale(1); } 33% { transform: translate(40px, 30px) scale(1.05); } 66% { transform: translate(-20px, 15px) scale(0.97); } }
            @keyframes signupBlobFloat2 { 0%, 100% { transform: translate(0, 0) scale(1); } 33% { transform: translate(-30px, -25px) scale(1.03); } 66% { transform: translate(25px, -10px) scale(0.98); } }
            @keyframes signupBlobFloat3 { 0%, 100% { transform: translate(-50%, -50%) scale(1); } 50% { transform: translate(-50%, -50%) scale(1.15); } }
            .signup-social-btn:hover { border-color: ${isDark ? 'rgba(0,245,255,0.3)' : 'rgba(0,212,228,0.4)'} !important; box-shadow: ${isDark ? '0 0 20px rgba(0,245,255,0.08)' : '0 2px 12px rgba(0,0,0,0.06)'} !important; transform: translateY(-1px); }
            .signup-social-btn:active { transform: translateY(0); }
            .signup-input:focus { border-color: ${isDark ? '#22D3EE' : '#0891B2'} !important; box-shadow: ${isDark ? '0 0 0 3px rgba(0,245,255,0.12)' : '0 0 0 3px rgba(0,212,228,0.15)'} !important; }
            .signup-input::placeholder { color: ${isDark ? '#4B5563' : '#9CA3AF'}; }
            .signup-submit-btn:hover:not(:disabled) { box-shadow: 0 0 30px ${isDark ? 'rgba(0,245,255,0.35)' : 'rgba(0,212,228,0.3)'}; transform: translateY(-1px); }
            .signup-submit-btn:active:not(:disabled) { transform: translateY(0); }
            .signup-signin-link:hover { color: ${isDark ? '#67E8F9' : '#0E7490'} !important; }
            .signup-spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(10,10,15,0.2); border-top-color: #0A0A0F; border-radius: 50%; animation: signupSpin 0.6s linear infinite; }
            @keyframes signupSpin { to { transform: rotate(360deg); } }
          `}</style>
        </div>
      </div>
    </>
  );
}
