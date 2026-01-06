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
const DEFAULT_TITLE = 'Karatrack Studio - AI-Powered Karaoke Video Creator';
const DEFAULT_DESCRIPTION = 'Transform any song into a professional karaoke video with AI. Remove vocals, add synchronized scrolling lyrics, and export stunning MP4 videos in minutes.';
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`; // You'll need to create this image
const TWITTER_HANDLE = '@karatrack'; // Update if you have a Twitter account

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
      
      {/* Favicon - make sure these files exist in /public */}
      <link rel="icon" href="/favicon.ico" />
      <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
      <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      
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
    description: 'AI-powered karaoke video creator that removes vocals and adds synchronized scrolling lyrics.',
    offers: {
      '@type': 'AggregateOffer',
      lowPrice: '0',
      highPrice: '49.99',
      priceCurrency: 'USD',
      offerCount: 4,
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '150', // Update with real numbers when you have them
    },
    featureList: [
      'AI Vocal Removal',
      'Automatic Lyrics Sync',
      'Karaoke Video Export',
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
    description: 'Create professional karaoke videos with AI-powered vocal removal and lyrics sync.',
    brand: {
      '@type': 'Brand',
      name: 'Karatrack Studio',
    },
    offers: [
      {
        '@type': 'Offer',
        name: 'Free Plan',
        price: '0',
        priceCurrency: 'USD',
        description: '5 credits/month, 480p quality',
      },
      {
        '@type': 'Offer',
        name: 'Starter Plan',
        price: '9.99',
        priceCurrency: 'USD',
        priceValidUntil: '2026-12-31',
        description: '25 credits/month, 1080p quality, no watermark',
      },
      {
        '@type': 'Offer',
        name: 'Pro Plan',
        price: '24.99',
        priceCurrency: 'USD',
        priceValidUntil: '2026-12-31',
        description: '75 credits/month, 1080p quality, edit lyrics',
      },
      {
        '@type': 'Offer',
        name: 'Studio Plan',
        price: '49.99',
        priceCurrency: 'USD',
        priceValidUntil: '2026-12-31',
        description: '200 credits/month, 4K quality, custom branding',
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