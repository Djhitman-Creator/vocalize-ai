/**
 * SEO landing page: /mp3-to-karaoke
 * Target searches: "mp3 to karaoke", "convert mp3 to karaoke", "create karaoke from mp3",
 * "karaoke converter"
 */

import Link from 'next/link';
import { useTheme } from '../context/ThemeContext';
import MarketingLayout from '../components/MarketingLayout';
import SEO, { getSoftwareAppSchema, getHowToSchema, getFAQSchema, getBreadcrumbSchema } from '../components/SEO';
import { Upload, Mic2, FileVideo, Sparkles, ChevronDown, Check } from 'lucide-react';

const faqs = [
  {
    question: 'How do I convert an MP3 to a karaoke track?',
    answer: 'Create a free account, upload your MP3, and the AI does the rest: it removes the lead vocals, transcribes the lyrics, and syncs them word-by-word. Then you customize the look and export a karaoke video as an MP4. Your first conversion is free with your 19 signup credits.',
  },
  {
    question: 'Does MP3 to karaoke conversion remove vocals completely?',
    answer: 'The AI separates the lead vocal from the instrumental with studio-quality precision on most commercially mixed tracks. You can also play back the isolated vocals on their own to check timing and lyric accuracy.',
  },
  {
    question: 'What formats besides MP3 can I convert to karaoke?',
    answer: 'WAV and FLAC files work exactly the same way as MP3. Whatever you upload, the export is a standard MP4 karaoke video with the instrumental and synced scrolling lyrics baked in.',
  },
  {
    question: 'Can I edit the lyrics after converting my MP3?',
    answer: 'Yes. The AI transcription is 98%+ accurate, and you can correct any word, adjust timing, and preview the result unlimited times before spending credits on the export.',
  },
  {
    question: 'Is converting MP3 to karaoke legal?',
    answer: 'Karatrack Studio is for personal use with music you have the rights to - through ownership, license, or original creation. Converting your own tracks, licensed music, or original recordings for personal karaoke use is exactly what it is built for.',
  },
];

export default function Mp3ToKaraokePage() {
  const { isDark } = useTheme();
  const text = isDark ? 'text-white' : 'text-gray-900';
  const sub = isDark ? 'text-gray-400' : 'text-gray-600';

  return (
    <>
      <SEO
        title="MP3 to Karaoke - Convert Any Song Into a Karaoke Video"
        description="Convert MP3 to karaoke online: AI removes the vocals and adds word-synced scrolling lyrics, then exports an HD karaoke video. WAV and FLAC supported. First conversion free - no credit card required."
        path="/mp3-to-karaoke"
        structuredData={[
          getSoftwareAppSchema(),
          getHowToSchema(),
          getFAQSchema(faqs),
          getBreadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'MP3 to Karaoke', path: '/mp3-to-karaoke' },
          ]),
        ]}
      />
      <MarketingLayout>
        {/* Hero */}
        <section className="px-6 pb-16 sm:pb-24 text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className={`font-display text-4xl sm:text-5xl md:text-6xl font-bold mb-6 leading-tight ${text}`}>
              MP3 to Karaoke, <span className="text-gradient">In Minutes</span>
            </h1>
            <p className={`text-base sm:text-xl max-w-2xl mx-auto mb-10 ${sub}`}>
              Convert any MP3 into a full karaoke video: AI strips the vocals, syncs scrolling
              lyrics to every word, and exports an HD MP4 ready for your next karaoke night.
              WAV and FLAC work too.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup">
                <button className="glass-button-primary glass-button flex items-center gap-2 text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4">
                  <Sparkles className="w-5 h-5" />
                  Convert Your First MP3 Free
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

        {/* Steps */}
        <section className="px-6 py-16 sm:py-24">
          <div className="max-w-5xl mx-auto">
            <h2 className={`font-display text-3xl sm:text-4xl font-bold text-center mb-12 ${text}`}>
              From MP3 to Karaoke Video in <span className="text-gradient">3 Steps</span>
            </h2>
            <div className="grid sm:grid-cols-3 gap-6">
              {[
                { icon: <Upload className="w-8 h-8" />, step: '1. Upload the MP3', body: 'Drag and drop your MP3, WAV, or FLAC. Any song length - credits are charged per track, not per minute.' },
                { icon: <Mic2 className="w-8 h-8" />, step: '2. AI Converts It', body: 'Vocals are removed and lyrics are transcribed and synced word-by-word, in 50+ languages.' },
                { icon: <FileVideo className="w-8 h-8" />, step: '3. Download the Video', body: 'Export a karaoke MP4 in up to 4K that plays on any TV, laptop, projector, or karaoke rig.' },
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

        {/* Detail prose */}
        <section className="px-6 py-16 sm:py-24">
          <div className="max-w-3xl mx-auto">
            <h2 className={`font-display text-3xl sm:text-4xl font-bold mb-6 ${text}`}>
              More Than a <span className="text-gradient">Vocal Remover</span>
            </h2>
            <p className={`text-base sm:text-lg leading-relaxed mb-4 ${sub}`}>
              A vocal remover gives you an instrumental. An MP3 to karaoke converter should give
              you the whole package: the instrumental, the lyrics on screen, and the timing that
              makes it singable. Karatrack Studio does all three in one pass, then lets you
              customize fonts, colors, backgrounds, intro screens, and logos before export.
            </p>
            <ul className={`space-y-3 text-base sm:text-lg ${sub}`}>
              {[
                'Studio-quality AI vocal separation',
                'Automatic transcription with word-level karaoke highlighting',
                'Listen to the isolated vocals to verify timing',
                'Unlimited free previews before you export',
                'MP4 export in 540p, 720p, 1080p, or 4K',
              ].map((line, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-cyan-500 flex-shrink-0 mt-1" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <p className={`text-base sm:text-lg leading-relaxed mt-6 ${sub}`}>
              Want the full feature tour? Start at the{' '}
              <Link href="/karaoke-maker" className="text-cyan-500 hover:text-cyan-400 underline">karaoke maker</Link> page.
              Looking for a song that has no karaoke version anywhere? See{' '}
              <Link href="/hard-to-find-karaoke-songs" className="text-cyan-500 hover:text-cyan-400 underline">hard-to-find karaoke songs</Link>.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="px-6 py-16 sm:py-24">
          <div className="max-w-3xl mx-auto">
            <h2 className={`font-display text-3xl sm:text-4xl font-bold text-center mb-10 ${text}`}>
              MP3 to Karaoke <span className="text-gradient">Questions</span>
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
              Your First MP3 to Karaoke Conversion Is <span className="text-gradient">Free</span>
            </h2>
            <Link href="/signup">
              <button className="glass-button-primary glass-button text-base sm:text-lg px-8 py-4">
                Convert an MP3 Now
              </button>
            </Link>
          </div>
        </section>
      </MarketingLayout>
    </>
  );
}
