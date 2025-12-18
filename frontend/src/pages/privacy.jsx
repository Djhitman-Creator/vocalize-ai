'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Music, ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-animated-dark">
      {/* Navigation */}
      <nav className="border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center">
              <Music className="w-6 h-6 text-white" />
            </div>
            <span className="font-display font-bold text-xl text-gradient">VocalizeAI</span>
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8">
          <ArrowLeft className="w-5 h-5" />
          Back to Home
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-8 md:p-12"
        >
          <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
          <p className="text-gray-400 mb-8">Last Updated: December 18, 2025</p>

          <div className="prose prose-invert max-w-none space-y-6 text-gray-300">
            <p>
              This Privacy Policy describes how VocalizeAI LLC ("Company," "we," "us," or "our") collects, uses, and discloses information about you when you access or use VocalizeAI ("Service"). By accessing or using the Service, you agree to the collection, use, and disclosure of your information in accordance with this Privacy Policy.
            </p>

            <h2 className="text-xl font-semibold text-white mt-8 mb-4">1. Information We Collect</h2>
            <p>We collect the following types of information:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong className="text-white">Account Information:</strong> Email address and name provided during the signup process.</li>
              <li><strong className="text-white">Payment Information:</strong> Payment and billing information is processed and stored exclusively by Stripe, Inc. We do not store any payment card information on our servers.</li>
              <li><strong className="text-white">Usage Data:</strong> We collect non-personal information for analytics purposes, including browser type, device information, operating system, and how you interact with the Service.</li>
              <li><strong className="text-white">Uploaded Content:</strong> Audio files and images you upload for processing. These are stored temporarily for processing purposes and are subject to our data retention policies.</li>
            </ul>

            <h2 className="text-xl font-semibold text-white mt-8 mb-4">2. How We Use Your Information</h2>
            <p>The information we collect is used to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Operate, maintain, and improve the Service</li>
              <li>Process your audio files and generate requested outputs</li>
              <li>Manage your account and provide customer support</li>
              <li>Send you service-related communications</li>
              <li>Analyze usage patterns to enhance user experience</li>
            </ul>
            <p className="mt-4">
              We do not sell, rent, or lease your personal information to third parties.
            </p>

            <h2 className="text-xl font-semibold text-white mt-8 mb-4">3. Information Sharing</h2>
            <p>We may share your information with the following third parties:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong className="text-white">Stripe:</strong> For payment processing and subscription management</li>
              <li><strong className="text-white">Supabase:</strong> For secure data storage and authentication</li>
              <li><strong className="text-white">Cloud Service Providers:</strong> For file storage and AI processing infrastructure</li>
            </ul>
            <p className="mt-4">
              These third parties are bound by their own privacy policies and are prohibited from using your information for purposes other than providing services to us.
            </p>

            <h2 className="text-xl font-semibold text-white mt-8 mb-4">4. Data Storage and Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect the security of your personal information. Your data is securely stored in encrypted databases located in the United States. While we strive to protect your information, no method of transmission over the Internet or electronic storage is 100% secure.
            </p>

            <h2 className="text-xl font-semibold text-white mt-8 mb-4">5. Data Retention</h2>
            <p>
              We retain your account information for as long as your account remains active. Uploaded audio files and processed outputs are retained for a limited period to allow you to download your content, after which they may be automatically deleted. You may request deletion of your data at any time by contacting us.
            </p>

            <h2 className="text-xl font-semibold text-white mt-8 mb-4">6. Cookies and Tracking Technologies</h2>
            <p>
              We use cookies and similar technologies solely for authentication and session management purposes to enhance your user experience. We do not use cookies for advertising or cross-site tracking.
            </p>

            <h2 className="text-xl font-semibold text-white mt-8 mb-4">7. International Data Transfers</h2>
            <p>
              Our Service is operated in the United States. If you are accessing the Service from outside the United States, please be aware that your information may be transferred to, stored, and processed in the United States where our servers are located.
            </p>

            <h2 className="text-xl font-semibold text-white mt-8 mb-4">8. Children's Privacy</h2>
            <p>
              Our Service is not directed to children under the age of 13. We do not knowingly collect personal information from children under 13. If we learn that we have collected personal information from a child under 13, we will take steps to delete such information promptly.
            </p>

            <h2 className="text-xl font-semibold text-white mt-8 mb-4">9. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your personal information</li>
              <li>Opt-out of marketing communications</li>
              <li>Export your data in a portable format</li>
            </ul>
            <p className="mt-4">
              To exercise these rights, please contact us using the information below.
            </p>

            <h2 className="text-xl font-semibold text-white mt-8 mb-4">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify users of any material changes by email and will update the "Last Updated" date at the top of this Privacy Policy. Your continued use of the Service after changes become effective constitutes acceptance of the revised policy.
            </p>

            <h2 className="text-xl font-semibold text-white mt-8 mb-4">11. Contact Us</h2>
            <p>
              If you have any questions or concerns about this Privacy Policy or our data practices, please contact us at: <a href="mailto:privacy@vocalize-ai.com" className="text-cyan-400 hover:text-cyan-300">privacy@vocalize-ai.com</a>
            </p>

            <div className="mt-8 p-4 bg-white/5 rounded-xl">
              <p className="text-gray-400">
                By using VocalizeAI, you acknowledge that you have read, understood, and agreed to the terms of this Privacy Policy.
              </p>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}