/**
 * MarketingLayout - shared nav + footer for SEO landing pages.
 * Used by: /karaoke-maker, /mp3-to-karaoke, /hard-to-find-karaoke-songs
 * Deliberately separate from the homepage's own Navigation/Footer so
 * nothing existing changes.
 */

import Link from 'next/link';
import { useTheme } from '../context/ThemeContext';
import { Moon, Sun } from 'lucide-react';

export default function MarketingLayout({ children }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className={isDark ? 'dark' : ''}>
      <div className={`min-h-screen ${isDark ? 'bg-animated-dark' : 'bg-animated-light'}`}>
        {/* Nav */}
        <nav className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 py-4">
          <div className="max-w-7xl mx-auto">
            <div className="glass-panel px-4 sm:px-6 py-4 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2 sm:gap-3">
                <img src="/logo.png" alt="Karatrack Studio - AI karaoke maker" className="h-8 sm:h-10 w-auto" />
                <span className="font-display font-bold text-lg sm:text-xl text-gradient">Karatrack Studio</span>
              </Link>
              <div className="flex items-center gap-2 sm:gap-4">
                <Link href="/pricing" className={`hidden sm:inline text-sm transition-colors ${isDark ? 'text-gray-300 hover:text-cyan-400' : 'text-gray-600 hover:text-cyan-600'}`}>
                  Pricing
                </Link>
                <button onClick={toggleTheme} className="glass-button p-3 rounded-full" aria-label="Toggle theme">
                  {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
                <Link href="/login" className={`hidden sm:inline text-sm font-medium transition-colors ${isDark ? 'text-gray-300 hover:text-cyan-400' : 'text-gray-600 hover:text-cyan-600'}`}>
                  Log In
                </Link>
                <Link href="/signup">
                  <button className="glass-button-primary glass-button text-sm sm:text-base">Start Free</button>
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Page content */}
        <main className="pt-32 sm:pt-36">{children}</main>

        {/* Footer */}
        <footer className={`py-8 sm:py-12 px-6 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6">
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="Karatrack Studio" className="h-8 w-auto" />
                <span className="font-display font-bold text-gradient">Karatrack Studio</span>
              </div>
              <div className={`flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                <Link href="/karaoke-maker" className="hover:text-cyan-500 transition-colors">Karaoke Maker</Link>
                <Link href="/mp3-to-karaoke" className="hover:text-cyan-500 transition-colors">MP3 to Karaoke</Link>
                <Link href="/hard-to-find-karaoke-songs" className="hover:text-cyan-500 transition-colors">Hard-to-Find Songs</Link>
                <Link href="/pricing" className="hover:text-cyan-500 transition-colors">Pricing</Link>
                <Link href="/privacy" className="hover:text-cyan-500 transition-colors">Privacy</Link>
                <Link href="/terms" className="hover:text-cyan-500 transition-colors">Terms</Link>
              </div>
              <div className={`text-xs sm:text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                &copy; {new Date().getFullYear()} Rush Monkey LLC. All rights reserved.
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
