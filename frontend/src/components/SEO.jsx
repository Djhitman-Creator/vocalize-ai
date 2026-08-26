/**
 * SEO Component for Karatrack Studio
 * 
 * Place this file at: frontend/src/components/SEO.jsx
 * 
 * This component handles:
 * - Page titles
 * - Meta descriptions
 * - Open Graph tags (Facebook, LinkedIn)
 * - Twitter Card tags
 * - Canonical URLs
 * - JSON-LD structured data
 * 
 * Usage in any page:
 *   import SEO from '../components/SEO';
 *   
 *   export default function MyPage() {
 *     return (
 *       <>
 *         <SEO 
 *           title="Page Title"
 *           description="Page description here"
 *           path="/page-path"
 *         />
 *         ... rest of your page
 *       </>
 *     );
 *   }
 */

import Head from 'next/head';

// Site-wide defaults
const SITE_NAME = 'Karatrack Studio';
const SITE_URL = 'https://studio.karatrack.com';
const DEFAULT_TITLE = 'AI Karaoke Maker - Turn Any MP3 Into a Karaoke Video | Karatrack Studio';
const DEFAULT_DESCRIPTION = 'Online AI karaoke maker: upload any MP3 and our AI removes the vocals, syncs scrolling lyrics word-by-word, and exports an HD karaoke video. Try it free - your first karaoke track is on us.';
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;
const TWITTER_HANDLE = '@karatrack';

export default function SEO({
  title,
  description,
  path = '',
  image,
  type = 'website',
  noindex = false,
  structuredData,
}) {
  // Build full title: "Page Title | Karatrack Studio" or just default
  const fullTitle = title 
    ? `${title} | ${SITE_NAME}`
    : DEFAULT_TITLE;
  
  // Use provided description or default
  const metaDescription = description || DEFAULT_DESCRIPTION;
  
  // Build canonical URL
  const canonicalUrl = `${SITE_URL}${path}`;
  
  // Use provided image or default
  const ogImage = image || DEFAULT_IMAGE;

  return (
    <Head>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={metaDescription} />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <link rel="canonical" href={canonicalUrl} />
      
      {/* Robots */}
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow" />
      )}
      
      {/* Open Graph (Facebook, LinkedIn, etc.) */}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:locale" content="en_US" />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={TWITTER_HANDLE} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={ogImage} />
      
      {/* Favicon */}
      <link rel="icon" href="/favicon.ico" />
      <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
      <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      
      {/* Theme Color (browser UI color on mobile) */}
      <meta name="theme-color" content="#0a0a14" />
      
      {/* Structured Data (JSON-LD) */}
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      )}
    </Head>
  );
}

// ============================================
// Pre-built structured data generators
// ============================================

/**
 * Generate Organization structured data
 * Use on homepage
 */
export function getOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Karatrack Studio',
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    description: DEFAULT_DESCRIPTION,
    sameAs: [
      // Add your social media URLs here
      // 'https://twitter.com/karatrack',
      // 'https://facebook.com/karatrack',
      // 'https://instagram.com/karatrack',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'support@karatrack.com',
      contactType: 'customer support',
    },
  };
}

/**
 * Generate SoftwareApplication structured data
 * Use on homepage or features page
 */
export function getSoftwareAppSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Karatrack Studio',
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web',
    description: 'Free AI karaoke maker that turns any MP3, WAV, or FLAC into a karaoke video: automatic vocal removal, word-level synced scrolling lyrics, and HD/4K MP4 export.',
    offers: {
      '@type': 'AggregateOffer',
      lowPrice: '0',
      highPrice: '54.99',
      priceCurrency: 'USD',
      offerCount: 4,
    },
    featureList: [
      'AI Vocal Removal',
      'Automatic Lyrics Sync in 50+ Languages',
      'MP3 to Karaoke Video Conversion',
      'Karaoke Video Export up to 4K',
      'Multiple Display Modes',
      'Custom Styling',
    ],
  };
}

/**
 * Generate FAQ structured data
 * Use on pricing page or FAQ page
 */
export function getFAQSchema(faqs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

/**
 * Generate Pricing/Product structured data
 * Use on pricing page
 */
export function getPricingSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Karatrack Studio Subscription',
    description: 'Make karaoke tracks from your own songs with AI vocal removal and synced lyrics. Start free, then buy credit packs or subscribe.',
    brand: {
      '@type': 'Brand',
      name: 'Karatrack Studio',
    },
    offers: [
      {
        '@type': 'Offer',
        name: 'Free Signup Credits',
        price: '0',
        priceCurrency: 'USD',
        description: '19 free credits - enough to make your first karaoke video free',
      },
      {
        '@type': 'Offer',
        name: 'Starter Pack',
        price: '4.99',
        priceCurrency: 'USD',
        description: '40 credits, one-time purchase',
      },
      {
        '@type': 'Offer',
        name: 'Pro Pack',
        price: '27.99',
        priceCurrency: 'USD',
        description: '280 credits, one-time purchase',
      },
      {
        '@type': 'Offer',
        name: 'Studio Pack',
        price: '54.99',
        priceCurrency: 'USD',
        description: '600 credits, one-time purchase',
      },
    ],
  };
}

/**
 * Generate BreadcrumbList structured data
 * Use on any page with navigation hierarchy
 */
export function getBreadcrumbSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

/**
 * Generate HowTo structured data
 * Great for "How It Works" section
 */
export function getHowToSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to Create a Karaoke Video with Karatrack Studio',
    description: 'Transform any song into a professional karaoke video in 3 simple steps.',
    totalTime: 'PT5M',
    step: [
      {
        '@type': 'HowToStep',
        position: 1,
        name: 'Upload Your Audio',
        text: 'Upload your MP3, WAV, or FLAC audio file and paste the song lyrics.',
        url: `${SITE_URL}/upload`,
      },
      {
        '@type': 'HowToStep',
        position: 2,
        name: 'AI Processing',
        text: 'Our AI removes vocals and synchronizes your lyrics with precise word-level timing.',
      },
      {
        '@type': 'HowToStep',
        position: 3,
        name: 'Download Your Video',
        text: 'Download your finished karaoke video in MP4 format, ready to use.',
      },
    ],
  };
}