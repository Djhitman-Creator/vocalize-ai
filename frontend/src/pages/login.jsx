'use client';

import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { useTheme } from '../context/ThemeContext';
import SEO, { getOrganizationSchema } from '../components/SEO';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function LoginPage() {
  const router = useRouter();
  const { isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Email/password login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      router.push('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Social OAuth login
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

  return (
    <>
      <SEO
        title="Sign In"
        description="Sign in to your Karatrack Studio account. Access your karaoke projects, credits, and continue creating professional karaoke videos."
        path="/login"
        structuredData={getOrganizationSchema()}
      />

      <div className={isDark ? 'dark' : ''}>
        <div
          className="login-page-wrapper"
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            position: 'relative',
            overflow: 'hidden',
            background: isDark
              ? '#0A0A0F'
              : '#F0F4F8',
          }}
        >
          {/* ── Animated background blobs ── */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              overflow: 'hidden',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          >
            {/* Top-left blob */}
            <div
              className="login-blob login-blob-1"
              style={{
                position: 'absolute',
                width: '600px',
                height: '600px',
                borderRadius: '50%',
                top: '-200px',
                left: '-150px',
                background: isDark
                  ? 'radial-gradient(circle, rgba(0,245,255,0.15) 0%, transparent 70%)'
                  : 'radial-gradient(circle, rgba(0,212,228,0.2) 0%, transparent 70%)',
                filter: 'blur(60px)',
              }}
            />
            {/* Bottom-right blob */}
            <div
              className="login-blob login-blob-2"
              style={{
                position: 'absolute',
                width: '500px',
                height: '500px',
                borderRadius: '50%',
                bottom: '-150px',
                right: '-100px',
                background: isDark
                  ? 'radial-gradient(circle, rgba(177,78,255,0.15) 0%, transparent 70%)'
                  : 'radial-gradient(circle, rgba(147,51,234,0.15) 0%, transparent 70%)',
                filter: 'blur(60px)',
              }}
            />
            {/* Center subtle blob */}
            <div
              className="login-blob login-blob-3"
              style={{
                position: 'absolute',
                width: '400px',
                height: '400px',
                borderRadius: '50%',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: isDark
                  ? 'radial-gradient(circle, rgba(0,245,255,0.05) 0%, transparent 70%)'
                  : 'radial-gradient(circle, rgba(0,212,228,0.08) 0%, transparent 70%)',
                filter: 'blur(80px)',
              }}
            />
          </div>

          {/* ── Main card ── */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'relative',
              zIndex: 1,
              width: '100%',
              maxWidth: '440px',
            }}
          >
            {/* Glass card */}
            <div
              style={{
                background: isDark
                  ? 'rgba(255,255,255,0.04)'
                  : 'rgba(255,255,255,0.75)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                borderRadius: '28px',
                padding: '40px 36px',
                boxShadow: isDark
                  ? '0 8px 40px rgba(0,0,0,0.4), 0 0 80px rgba(0,245,255,0.04)'
                  : '0 8px 40px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              {/* Logo */}
              <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
                  <img src="/logo.png" alt="Karatrack Studio" style={{ height: '40px', width: 'auto' }} />
                  <span
                    style={{
                      fontFamily: "'Orbitron', sans-serif",
                      fontWeight: 700,
                      fontSize: '20px',
                      background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    Karatrack Studio
                  </span>
                </Link>
              </div>

              {/* Heading */}
              <h1
                style={{
                  textAlign: 'center',
                  fontSize: '24px',
                  fontWeight: 700,
                  color: isDark ? '#F8FAFC' : '#0F172A',
                  marginBottom: '6px',
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                Welcome back
              </h1>
              <p
                style={{
                  textAlign: 'center',
                  fontSize: '14px',
                  color: isDark ? '#94A3B8' : '#64748B',
                  marginBottom: '28px',
                }}
              >
                Sign in to continue creating karaoke magic
              </p>

              {/* Error message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    background: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.08)',
                    border: `1px solid ${isDark ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.25)'}`,
                    borderRadius: '12px',
                    padding: '12px 16px',
                    marginBottom: '20px',
                  }}
                >
                  <p style={{ fontSize: '13px', color: isDark ? '#FCA5A5' : '#DC2626', margin: 0 }}>{error}</p>
                </motion.div>
              )}

              {/* ── Social login buttons ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                {/* Google */}
                <button
                  type="button"
                  onClick={() => handleSocialLogin('google')}
                  className="login-social-btn"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    width: '100%',
                    padding: '13px 20px',
                    borderRadius: '14px',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'}`,
                    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.9)',
                    color: isDark ? '#E2E8F0' : '#1E293B',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                    <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                  </svg>
                  Sign in with Google
                </button>

                {/* Microsoft */}
                <button
                  type="button"
                  onClick={() => handleSocialLogin('azure')}
                  className="login-social-btn"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    width: '100%',
                    padding: '13px 20px',
                    borderRadius: '14px',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'}`,
                    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.9)',
                    color: isDark ? '#E2E8F0' : '#1E293B',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
                    <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                    <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                    <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                    <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
                  </svg>
                  Sign in with Microsoft
                </button>
              </div>

              {/* ── Divider ── */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  marginBottom: '24px',
                }}
              >
                <div
                  style={{
                    flex: 1,
                    height: '1px',
                    background: isDark
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(0,0,0,0.08)',
                  }}
                />
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: isDark ? '#64748B' : '#94A3B8',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  or
                </span>
                <div
                  style={{
                    flex: 1,
                    height: '1px',
                    background: isDark
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(0,0,0,0.08)',
                  }}
                />
              </div>

              {/* ── Email / Password form ── */}
              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Email field */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: isDark ? '#CBD5E1' : '#475569',
                      marginBottom: '6px',
                    }}
                  >
                    Email
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail
                      style={{
                        position: 'absolute',
                        left: '14px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '18px',
                        height: '18px',
                        color: isDark ? '#64748B' : '#94A3B8',
                        pointerEvents: 'none',
                      }}
                    />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="login-input"
                      style={{
                        width: '100%',
                        padding: '12px 14px 12px 44px',
                        borderRadius: '12px',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'}`,
                        background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.6)',
                        color: isDark ? '#F8FAFC' : '#0F172A',
                        fontSize: '14px',
                        outline: 'none',
                        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                        fontFamily: "'Inter', sans-serif",
                      }}
                    />
                  </div>
                </div>

                {/* Password field */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label
                      style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        color: isDark ? '#CBD5E1' : '#475569',
                      }}
                    >
                      Password
                    </label>
                    <Link
                      href="/forgot-password"
                      style={{
                        fontSize: '12px',
                        color: isDark ? '#22D3EE' : '#0891B2',
                        textDecoration: 'none',
                        fontWeight: 500,
                        transition: 'color 0.2s ease',
                      }}
                      className="login-forgot-link"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <Lock
                      style={{
                        position: 'absolute',
                        left: '14px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '18px',
                        height: '18px',
                        color: isDark ? '#64748B' : '#94A3B8',
                        pointerEvents: 'none',
                      }}
                    />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      className="login-input"
                      style={{
                        width: '100%',
                        padding: '12px 44px 12px 44px',
                        borderRadius: '12px',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'}`,
                        background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.6)',
                        color: isDark ? '#F8FAFC' : '#0F172A',
                        fontSize: '14px',
                        outline: 'none',
                        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                        fontFamily: "'Inter', sans-serif",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '14px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px',
                        display: 'flex',
                        color: isDark ? '#64748B' : '#94A3B8',
                        transition: 'color 0.2s ease',
                      }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="login-submit-btn"
                  style={{
                    width: '100%',
                    padding: '14px 20px',
                    borderRadius: '14px',
                    border: 'none',
                    background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                    color: '#0A0A0F',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                    transition: 'all 0.3s ease',
                    fontFamily: "'Inter', sans-serif",
                    marginTop: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  {loading ? (
                    <>
                      <span className="login-spinner" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </button>
              </form>

              {/* Terms notice */}
              <p
                style={{
                  textAlign: 'center',
                  fontSize: '12px',
                  color: isDark ? '#64748B' : '#94A3B8',
                  marginTop: '20px',
                  lineHeight: '1.5',
                }}
              >
                By proceeding, you agree to our{' '}
                <Link
                  href="/terms"
                  style={{
                    color: isDark ? '#22D3EE' : '#0891B2',
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  Terms
                </Link>{' '}
                and{' '}
                <Link
                  href="/privacy"
                  style={{
                    color: isDark ? '#22D3EE' : '#0891B2',
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  Privacy Policy
                </Link>
              </p>

              {/* Signup link */}
              <div
                style={{
                  marginTop: '24px',
                  paddingTop: '20px',
                  borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  textAlign: 'center',
                }}
              >
                <p
                  style={{
                    fontSize: '14px',
                    color: isDark ? '#94A3B8' : '#64748B',
                    margin: 0,
                  }}
                >
                  Don't have an account?{' '}
                  <Link
                    href="/signup"
                    style={{
                      color: isDark ? '#22D3EE' : '#0891B2',
                      textDecoration: 'none',
                      fontWeight: 600,
                    }}
                    className="login-signup-link"
                  >
                    Sign up
                  </Link>
                </p>
              </div>
            </div>
          </motion.div>

          {/* ── Scoped styles ── */}
          <style jsx global>{`
            /* Blob floating animations */
            .login-blob-1 {
              animation: loginBlobFloat1 18s ease-in-out infinite;
            }
            .login-blob-2 {
              animation: loginBlobFloat2 22s ease-in-out infinite;
            }
            .login-blob-3 {
              animation: loginBlobFloat3 15s ease-in-out infinite;
            }

            @keyframes loginBlobFloat1 {
              0%, 100% { transform: translate(0, 0) scale(1); }
              33% { transform: translate(40px, 30px) scale(1.05); }
              66% { transform: translate(-20px, 15px) scale(0.97); }
            }
            @keyframes loginBlobFloat2 {
              0%, 100% { transform: translate(0, 0) scale(1); }
              33% { transform: translate(-30px, -25px) scale(1.03); }
              66% { transform: translate(25px, -10px) scale(0.98); }
            }
            @keyframes loginBlobFloat3 {
              0%, 100% { transform: translate(-50%, -50%) scale(1); }
              50% { transform: translate(-50%, -50%) scale(1.15); }
            }

            /* Social button hover */
            .login-social-btn:hover {
              border-color: ${isDark ? 'rgba(0,245,255,0.3)' : 'rgba(0,212,228,0.4)'} !important;
              box-shadow: ${isDark
                ? '0 0 20px rgba(0,245,255,0.08)'
                : '0 2px 12px rgba(0,0,0,0.06)'} !important;
              transform: translateY(-1px);
            }
            .login-social-btn:active {
              transform: translateY(0);
            }

            /* Input focus */
            .login-input:focus {
              border-color: ${isDark ? '#22D3EE' : '#0891B2'} !important;
              box-shadow: ${isDark
                ? '0 0 0 3px rgba(0,245,255,0.12)'
                : '0 0 0 3px rgba(0,212,228,0.15)'} !important;
            }
            .login-input::placeholder {
              color: ${isDark ? '#4B5563' : '#9CA3AF'};
            }

            /* Submit button hover */
            .login-submit-btn:hover:not(:disabled) {
              box-shadow: 0 0 30px ${isDark ? 'rgba(0,245,255,0.35)' : 'rgba(0,212,228,0.3)'};
              transform: translateY(-1px);
            }
            .login-submit-btn:active:not(:disabled) {
              transform: translateY(0);
            }

            /* Forgot link hover */
            .login-forgot-link:hover {
              color: ${isDark ? '#67E8F9' : '#0E7490'} !important;
            }

            /* Signup link hover */
            .login-signup-link:hover {
              color: ${isDark ? '#67E8F9' : '#0E7490'} !important;
            }

            /* Loading spinner */
            .login-spinner {
              display: inline-block;
              width: 16px;
              height: 16px;
              border: 2px solid rgba(10,10,15,0.2);
              border-top-color: #0A0A0F;
              border-radius: 50%;
              animation: loginSpin 0.6s linear infinite;
            }
            @keyframes loginSpin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    </>
  );
}
