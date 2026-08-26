/**
 * SEO landing page: /hard-to-find-karaoke-songs
 * Target searches: "hard to find karaoke songs", "karaoke version of any song",
 * "song has no karaoke version", "make your own karaoke version"
 */

import Link from 'next/link';
import { useTheme } from '../context/ThemeContext';
import MarketingLayout from '../components/MarketingLayout';
import SEO, { getSoftwareAppSchema, getHowToSchema, getFAQSchema, getBreadcrumbSchema } from '../components/SEO';
import { Music, Globe, Heart, Sparkles, ChevronDown, Check } from 'lucide-react';

const faqs = [
  {
    question: 'What if a song has no karaoke version anywhere?',
    answer: 'Make your own. Upload the audio file to Karatrack Studio and the AI removes the vocals and adds word-synced scrolling lyrics, giving you a karaoke version of a song that simply does not exist on YouTube or in karaoke catalogs. Your first track is free.',
  },
  {
    question: 'What kinds of songs are hardest to find as karaoke?',
    answer: 'Indie and unsigned artists, regional and non-English hits, older or out-of-print recordings, deep album cuts, remixes, and brand-new releases. Karaoke catalogs only license popular titles - everything else is exactly what Karatrack Studio is for.',
  },
  {
    question: 'Can I make karaoke for songs in other languages?',
    answer: 'Yes - the AI transcribes and syncs lyrics in 50+ languages, so you can create karaoke for Spanish, Tagalog, Vietnamese, Japanese, Korean, Hindi, Arabic, and many other songs that rarely appear in English-focused karaoke catalogs.',
  },
  {
    question: 'Can I make a karaoke version of my own original song?',
    answer: 'Absolutely. Original music is the ultimate hard-to-find karaoke - no catalog will ever have it. Upload your recording and export a polished karaoke video of your own song, with custom fonts, colors, backgrounds, and your logo.',
  },
  {
    question: 'Do I need rights to the songs I upload?',
    answer: 'Yes. Karatrack Studio is for personal use with music you have the rights to - through ownership, license, or original creation. You upload your own audio files; nothing is downloaded from streaming services.',
  },
];

export default function HardToFindKaraokePage() {
  const { isDark } = useTheme();
  const text = isDark ? 'text-white' : 'text-gray-900';
  const sub = isDark ? 'text-gray-400' : 'text-gray-600';

  return (
    <>
      <SEO
        title="Hard to Find Karaoke Songs? Make Your Own Karaoke Version"
        description="Can't find a karaoke version of a song? Create your own: upload the track and AI removes the vocals and adds word-synced lyrics in 50+ languages. Indie, regional, oldies, and original songs - first track free."
        path="/hard-to-find-karaoke-songs"
        structuredData={[
          getSoftwareAppSchema(),
          getHowToSchema(),
          getFAQSchema(faqs),
          getBreadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Hard to Find Karaoke Songs', path: '/hard-to-find-karaoke-songs' },
          ]),
        ]}
      />
      <MarketingLayout>
        {/* Hero */}
        <section className="px-6 pb-16 sm:pb-24 text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className={`font-display text-4xl sm:text-5xl md:text-6xl font-bold mb-6 leading-tight ${text}`}>
              Can&apos;t Find the Karaoke Version? <span className="text-gradient">Make It.</span>
            </h1>
            <p className={`text-base sm:text-xl max-w-2xl mx-auto mb-10 ${sub}`}>
              Some songs never get a karaoke release - indie tracks, regional hits, oldies, deep
              cuts, and your own music. Upload the song and Karatrack Studio&apos;s AI builds the
              karaoke version for you: vocals removed, lyrics on screen, synced word-by-word.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup">
                <button className="glass-button-primary glass-button flex items-center gap-2 text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4">
                  <Sparkles className="w-5 h-5" />
                  Make Your Karaoke Version Free
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

        {/* Who this is for */}
        <section className="px-6 py-16 sm:py-24">
          <div className="max-w-5xl mx-auto">
            <h2 className={`font-display text-3xl sm:text-4xl font-bold text-center mb-12 ${text}`}>
              The Songs Karaoke Catalogs <span className="text-gradient">Never Have</span>
            </h2>
            <div className="grid sm:grid-cols-3 gap-6">
              {[
                { icon: <Music className="w-8 h-8" />, step: 'Indie & Deep Cuts', body: 'Unsigned artists, album tracks, remixes, and brand-new releases that licensing never reaches.' },
                { icon: <Globe className="w-8 h-8" />, step: 'Regional & Non-English Hits', body: 'Songs in 50+ languages that English-focused karaoke apps and bars simply do not carry.' },
                { icon: <Heart className="w-8 h-8" />, step: 'Your Own Music', body: 'Original songs, family recordings, wedding songs - karaoke versions no catalog could ever sell you.' },
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

        {/* Prose */}
        <section className="px-6 py-16 sm:py-24">
          <div className="max-w-3xl mx-auto">
            <h2 className={`font-display text-3xl sm:text-4xl font-bold mb-6 ${text}`}>
              Stop Searching. <span className="text-gradient">Start Singing.</span>
            </h2>
            <p className={`text-base sm:text-lg leading-relaxed mb-4 ${sub}`}>
              You have scrolled YouTube, checked every karaoke app, and asked the KJ - the song
              just is not there. With Karatrack Studio you upload the track you already have and
              get a real karaoke video back in minutes:
            </p>
            <ul className={`space-y-3 text-base sm:text-lg ${sub}`}>
              {[
                'AI vocal removal with studio-quality separation',
                'Lyrics transcribed and synced word-by-word automatically',
                'Editable lyrics for slang, ad-libs, and dialects',
                'HD or 4K MP4 export that plays on any karaoke setup',
                'First karaoke track free - 19 credits at signup',
              ].map((line, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-cyan-500 flex-shrink-0 mt-1" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <p className={`text-base sm:text-lg leading-relaxed mt-6 ${sub}`}>
              New here? See how the{' '}
              <Link href="/karaoke-maker" className="text-cyan-500 hover:text-cyan-400 underline">free karaoke maker</Link>{' '}
              works, or jump straight to{' '}
              <Link href="/mp3-to-karaoke" className="text-cyan-500 hover:text-cyan-400 underline">converting an MP3 to karaoke</Link>.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="px-6 py-16 sm:py-24">
          <div className="max-w-3xl mx-auto">
            <h2 className={`font-display text-3xl sm:text-4xl font-bold text-center mb-10 ${text}`}>
              Hard-to-Find Karaoke <span className="text-gradient">Questions</span>
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
              That Song You Can&apos;t Find? <span className="text-gradient">Sing It Tonight.</span>
            </h2>
            <Link href="/signup">
              <button className="glass-button-primary glass-button text-base sm:text-lg px-8 py-4">
                Create Your Karaoke Version
              </button>
            </Link>
          </div>
        </section>
      </MarketingLayout>
    </>
  );
}
