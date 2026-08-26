/**
 * SEO landing page: /karaoke-maker
 * Target searches: "karaoke maker", "free karaoke maker", "karaoke creator",
 * "make karaoke tracks online"
 */

import Link from 'next/link';
import { useTheme } from '../context/ThemeContext';
import MarketingLayout from '../components/MarketingLayout';
import SEO, { getSoftwareAppSchema, getHowToSchema, getFAQSchema, getBreadcrumbSchema } from '../components/SEO';
import { Upload, Mic2, FileVideo, Sparkles, ChevronDown, Check } from 'lucide-react';

const faqs = [
  {
    question: 'Is this karaoke maker really free?',
    answer: 'Yes. Every new account gets 19 free credits - enough to create your first HD karaoke video completely free, no credit card required. Free exports carry a small watermark that is removed with any purchase, and your free signup credits never expire.',
  },
  {
    question: 'What files can I turn into karaoke tracks?',
    answer: 'Upload MP3, WAV, or FLAC audio files. The AI removes the lead vocals, transcribes the lyrics, and syncs them word-by-word automatically. You can fine-tune timing and wording before you export.',
  },
  {
    question: 'How long does it take to make a karaoke video?',
    answer: 'Most karaoke tracks are ready in minutes. Queue mode renders your video in order with other users (usually 5-15 minutes at peak); Instant mode starts rendering immediately and finishes in under 2 minutes.',
  },
  {
    question: 'Do I need to install any karaoke software?',
    answer: 'No. Karatrack Studio runs entirely in your web browser on Windows, Mac, phones, and tablets. There is nothing to download or install - just upload a song and start creating.',
  },
  {
    question: 'Can I use the karaoke videos I make anywhere?',
    answer: 'You download a standard MP4 video with the music and synced scrolling lyrics baked in, so it plays on any TV, laptop, projector, or karaoke setup. Karatrack Studio is for personal use with music you have the rights to - through ownership, license, or original creation.',
  },
];

export default function KaraokeMakerPage() {
  const { isDark } = useTheme();
  const text = isDark ? 'text-white' : 'text-gray-900';
  const sub = isDark ? 'text-gray-400' : 'text-gray-600';

  return (
    <>
      <SEO
        title="Free Karaoke Maker - Create Karaoke Tracks Online"
        description="Make karaoke tracks online with AI: upload any song, remove the vocals, and get word-synced scrolling lyrics in an HD karaoke video. Your first karaoke track is free - no credit card required."
        path="/karaoke-maker"
        structuredData={[
          getSoftwareAppSchema(),
          getHowToSchema(),
          getFAQSchema(faqs),
          getBreadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Karaoke Maker', path: '/karaoke-maker' },
          ]),
        ]}
      />
      <MarketingLayout>
        {/* Hero */}
        <section className="px-6 pb-16 sm:pb-24 text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className={`font-display text-4xl sm:text-5xl md:text-6xl font-bold mb-6 leading-tight ${text}`}>
              The Free Online <span className="text-gradient">Karaoke Maker</span>
            </h1>
            <p className={`text-base sm:text-xl max-w-2xl mx-auto mb-10 ${sub}`}>
              Turn any song into a karaoke track in minutes. Upload your audio, let AI remove the
              vocals and sync the lyrics word-by-word, and export a professional karaoke video in
              HD or 4K. Your first track is free.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup">
                <button className="glass-button-primary glass-button flex items-center gap-2 text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4">
                  <Sparkles className="w-5 h-5" />
                  Make a Karaoke Track Free
                </button>
              </Link>
              <Link href="/pricing">
                <button className={`glass-button text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 ${text}`}>
                  See Pricing
                </button>
              </Link>
            </div>
            <p className={`mt-4 text-sm ${sub}`}>19 free credits at signup &mdash; no credit card required.</p>
          </div>
        </section>

        {/* How it works */}
        <section className="px-6 py-16 sm:py-24">
          <div className="max-w-5xl mx-auto">
            <h2 className={`font-display text-3xl sm:text-4xl font-bold text-center mb-12 ${text}`}>
              How the Karaoke Maker <span className="text-gradient">Works</span>
            </h2>
            <div className="grid sm:grid-cols-3 gap-6">
              {[
                { icon: <Upload className="w-8 h-8" />, step: '1. Upload Your Song', body: 'Drop in an MP3, WAV, or FLAC file of the song you want a karaoke version of.' },
                { icon: <Mic2 className="w-8 h-8" />, step: '2. AI Does the Work', body: 'The AI removes the lead vocals and syncs scrolling lyrics with word-level timing, in 50+ languages.' },
                { icon: <FileVideo className="w-8 h-8" />, step: '3. Export Your Video', body: 'Customize colors, fonts, and backgrounds, then export an MP4 karaoke video in up to 4K.' },
              ].map((item, i) => (
                <div key={i} className="feature-card text-center">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-cyan-400/20 to-purple-500/20 flex items-center justify-center mb-4">
                    <span className="text-cyan-500">{item.icon}</span>
                  </div>
                  <h3 className={`font-display text-lg font-semibold mb-2 ${text}`}>{item.step}</h3>
                  <p className={`text-sm sm:text-base ${sub}`}>{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why section - keyword-rich prose */}
        <section className="px-6 py-16 sm:py-24">
          <div className="max-w-3xl mx-auto">
            <h2 className={`font-display text-3xl sm:text-4xl font-bold mb-6 ${text}`}>
              A Karaoke Creator That <span className="text-gradient">Does It All</span>
            </h2>
            <p className={`text-base sm:text-lg leading-relaxed mb-4 ${sub}`}>
              Most karaoke maker tools stop at removing vocals. Karatrack Studio creates the whole
              karaoke experience: studio-quality AI vocal removal, automatic lyric transcription,
              word-by-word highlighting synced to the music, and a fully customizable video export
              with your own fonts, colors, backgrounds, intro screens, and logos.
            </p>
            <ul className={`space-y-3 text-base sm:text-lg ${sub}`}>
              {[
                'Make a karaoke track from any MP3, WAV, or FLAC',
                'Word-level lyric sync with 98%+ transcription accuracy',
                'Karaoke videos in 540p, 720p HD, 1080p Full HD, or 4K',
                'Lyrics in 50+ languages - every feature included for everyone',
                'Preview and tweak unlimited times before you spend credits',
              ].map((line, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-cyan-500 flex-shrink-0 mt-1" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <p className={`text-base sm:text-lg leading-relaxed mt-6 ${sub}`}>
              Converting a specific file? See{' '}
              <Link href="/mp3-to-karaoke" className="text-cyan-500 hover:text-cyan-400 underline">MP3 to karaoke</Link>.
              Chasing a song no one has a karaoke version of? Read{' '}
              <Link href="/hard-to-find-karaoke-songs" className="text-cyan-500 hover:text-cyan-400 underline">hard-to-find karaoke songs</Link>.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="px-6 py-16 sm:py-24">
          <div className="max-w-3xl mx-auto">
            <h2 className={`font-display text-3xl sm:text-4xl font-bold text-center mb-10 ${text}`}>
              Karaoke Maker <span className="text-gradient">Questions</span>
            </h2>
            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <details key={i} className={`group rounded-2xl border px-5 py-4 ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'}`}>
                  <summary className={`flex items-center justify-between cursor-pointer list-none font-semibold text-sm sm:text-base ${text}`}>
                    {faq.question}
                    <ChevronDown className="w-5 h-5 flex-shrink-0 ml-3 text-cyan-500 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className={`mt-3 text-sm sm:text-base leading-relaxed ${sub}`}>{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-6 py-16 sm:py-24 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className={`font-display text-3xl sm:text-4xl font-bold mb-6 ${text}`}>
              Make Your First Karaoke Track <span className="text-gradient">Free</span>
            </h2>
            <Link href="/signup">
              <button className="glass-button-primary glass-button text-base sm:text-lg px-8 py-4">
                Start Creating Now
              </button>
            </Link>
          </div>
        </section>
      </MarketingLayout>
    </>
  );
}
