'use client';

/**
 * Terms of Service Page - Karatrack Studio
 * 
 * Place this at: frontend/src/pages/terms.jsx
 */

import { useTheme } from '../context/ThemeContext';
import Link from 'next/link';
import { Music, ArrowLeft } from 'lucide-react';

export default function TermsOfService() {
  const { isDark } = useTheme();

  return (
    <div className={`min-h-screen ${isDark ? 'bg-animated-dark' : 'bg-animated-light'}`}>
      {/* Navigation */}
      <nav className="border-b border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center">
              <Music className="w-6 h-6 text-white" />
            </div>
            <span className="font-display font-bold text-xl text-gradient">Karatrack Studio</span>
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <div className={`glass-panel p-8 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Terms of Service
          </h1>
          <p className="text-gray-500 mb-8">Last updated: December 2024</p>

          <div className="space-y-8 leading-relaxed">
            
            {/* Introduction */}
            <section>
              <h2 className={`text-xl font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                1. Introduction
              </h2>
              <p>
                Welcome to Karatrack Studio ("Service," "we," "us," or "our"). By accessing or using our 
                service, you agree to be bound by these Terms of Service ("Terms"). If you do not agree 
                to these Terms, please do not use our Service.
              </p>
              <p className="mt-3">
                Karatrack Studio is a tool that allows users to create karaoke-style videos by processing 
                audio files they upload. The Service separates vocals from instrumental tracks and 
                synchronizes lyrics for display.
              </p>
            </section>

            {/* User Representations */}
            <section>
              <h2 className={`text-xl font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                2. User Representations & Warranties
              </h2>
              <p className="mb-3">
                By uploading content to Karatrack Studio, you represent and warrant that:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>You <strong>own the copyright</strong> to the audio file you are uploading, OR</li>
                <li>You have obtained all <strong>necessary licenses or permissions</strong> from the copyright holder(s), OR</li>
                <li>The content is <strong>original work</strong> created and composed by you, OR</li>
                <li>The content is in the <strong>public domain</strong></li>
              </ul>
              <p className="mt-4">
                You expressly agree <strong>NOT</strong> to upload any content that infringes upon the 
                intellectual property rights of any third party, including but not limited to copyrights, 
                trademarks, or other proprietary rights.
              </p>
            </section>

            {/* Permitted Use */}
            <section>
              <h2 className={`text-xl font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                3. Permitted Use
              </h2>
              <p className="mb-3">
                Karatrack Studio is intended for <strong>personal, non-commercial use only</strong>. 
                You are solely responsible for ensuring you have the legal right to process any audio you upload. This may include:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Music you have created or composed yourself</li>
                <li>Music for which you have obtained explicit permission or a license from the copyright holder</li>
                <li>Music that is in the public domain</li>
                <li>Uses that qualify as fair use under applicable law (consult a legal professional if unsure)</li>
              </ul>
              <p className="mt-4">
                <strong>Prohibited uses include:</strong>
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Uploading copyrighted music without authorization from the copyright holder</li>
                <li>Distributing, selling, or commercially exploiting processed content without proper rights</li>
                <li>Using the Service to infringe upon any third party's intellectual property</li>
                <li>Circumventing any technological protection measures</li>
              </ul>
            </section>

            {/* Subscriptions & Credits */}
            <section>
              <h2 className={`text-xl font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                4. Subscriptions, Credits & Billing
              </h2>
              <p className="mb-3">
                Karatrack Studio operates on a credit-based subscription model. By subscribing to a paid plan, 
                you agree to the following terms:
              </p>
              
              <h3 className={`text-lg font-semibold mt-4 mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Credit Allocation
              </h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Credits are allocated to your account upon subscription purchase or renewal</li>
                <li>Each plan includes a specific number of credits per billing cycle</li>
                <li>Credits may be used to process audio files and generate karaoke videos</li>
              </ul>

              <h3 className={`text-lg font-semibold mt-4 mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Credit Expiration Policy
              </h3>
              <div className={`p-4 rounded-lg ${isDark ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-yellow-50 border border-yellow-200'}`}>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Credits expire 90 days after they are granted.</strong> This applies to both subscription credits and any bonus credits.</li>
                  <li>Credits roll over from month to month as long as they are less than 90 days old. Credits older than 90 days will automatically expire and be removed from your account.</li>
                  <li>We will send you an email notification before your credits expire to give you an opportunity to use them.</li>
                  <li><strong>No refunds or credit will be issued for expired credits.</strong></li>
                </ul>
              </div>

              <h3 className={`text-lg font-semibold mt-4 mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Subscription Cancellation
              </h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>You may cancel your subscription at any time through your account settings</li>
                <li>Upon cancellation, you will retain access to your remaining credits until they expire (90 days from when they were granted)</li>
                <li>No prorated refunds will be issued for partial billing periods</li>
              </ul>

              <h3 className={`text-lg font-semibold mt-4 mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Refund Policy
              </h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Subscription fees are generally non-refundable</li>
                <li>Refund requests for technical issues may be considered on a case-by-case basis</li>
                <li>To request a refund, contact support@karatrack.com within 7 days of purchase</li>
              </ul>
            </section>

            {/* Copyright Policy */}
            <section>
              <h2 className={`text-xl font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                5. Copyright Policy & DMCA Compliance
              </h2>
              <p>
                Karatrack Studio respects intellectual property rights and complies with the 
                Digital Millennium Copyright Act (DMCA) and other applicable copyright laws.
              </p>
              <p className="mt-3">
                <strong>Important:</strong> We do not monitor, pre-screen, or review the content of 
                files uploaded by users. Users are solely responsible for ensuring they have the 
                legal right to use, modify, and process any audio they upload to our Service.
              </p>
              <p className="mt-3">
                If you believe that content available through our Service infringes your copyright, 
                you may submit a DMCA takedown notice to:
              </p>
              <div className={`mt-3 p-4 rounded-lg ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
                <p><strong>DMCA Agent</strong></p>
                <p>Email: dmca@karatrack.com</p>
              </div>
            </section>

            {/* Indemnification */}
            <section>
              <h2 className={`text-xl font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                6. Indemnification
              </h2>
              <p>
                You agree to indemnify, defend, and hold harmless Karatrack Studio, its owners, 
                operators, affiliates, partners, and employees from and against any and all claims, 
                damages, losses, liabilities, costs, and expenses (including reasonable attorneys' fees) 
                arising out of or related to:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-3">
                <li>Your use of the Service</li>
                <li>Any content you upload, process, or create using the Service</li>
                <li>Your violation of these Terms</li>
                <li>Your violation of any third party's rights, including intellectual property rights</li>
                <li>Any claim that your use of the Service caused damage to a third party</li>
              </ul>
            </section>

            {/* Limitation of Liability */}
            <section>
              <h2 className={`text-xl font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                7. Limitation of Liability
              </h2>
              <p>
                Karatrack Studio provides a tool for audio processing. We act solely as a service 
                provider and do not host, distribute, publicly display, or claim any ownership over 
                user-uploaded content.
              </p>
              <p className="mt-3">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, KARATRACK STUDIO SHALL NOT BE LIABLE FOR 
                ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING 
                BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR OTHER INTANGIBLE LOSSES, ARISING OUT 
                OF OR RELATED TO YOUR USE OF THE SERVICE.
              </p>
              <p className="mt-3">
                We are not responsible for:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>How users obtain audio files they upload</li>
                <li>How users utilize processed content after download</li>
                <li>Any copyright infringement committed by users</li>
                <li>The accuracy or completeness of AI-generated lyrics synchronization</li>
              </ul>
            </section>

            {/* Disclaimer */}
            <section>
              <h2 className={`text-xl font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                8. Disclaimer of Warranties
              </h2>
              <p>
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, 
                EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF 
                MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
              </p>
              <p className="mt-3">
                We do not warrant that the Service will be uninterrupted, secure, or error-free, 
                or that any defects will be corrected.
              </p>
            </section>

            {/* Account Termination */}
            <section>
              <h2 className={`text-xl font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                9. Account Termination
              </h2>
              <p>
                We reserve the right to suspend or terminate your account and access to the Service 
                at our sole discretion, without notice, for conduct that we believe:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-3">
                <li>Violates these Terms</li>
                <li>Is harmful to other users, third parties, or our business interests</li>
                <li>Involves copyright infringement or other illegal activity</li>
              </ul>
            </section>

            {/* Modifications */}
            <section>
              <h2 className={`text-xl font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                10. Modifications to Terms
              </h2>
              <p>
                We reserve the right to modify these Terms at any time. We will notify users of 
                material changes by posting the updated Terms on our website with a new "Last updated" 
                date. Your continued use of the Service after changes are posted constitutes your 
                acceptance of the modified Terms.
              </p>
            </section>

            {/* Governing Law */}
            <section>
              <h2 className={`text-xl font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                11. Governing Law
              </h2>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the 
                United States, without regard to its conflict of law provisions. Any disputes 
                arising from these Terms or your use of the Service shall be resolved in the 
                courts located within the United States.
              </p>
            </section>

            {/* Contact */}
            <section>
              <h2 className={`text-xl font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                12. Contact Information
              </h2>
              <p>
                If you have any questions about these Terms, please contact us at:
              </p>
              <div className={`mt-3 p-4 rounded-lg ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
                <p><strong>Karatrack Studio</strong></p>
                <p>Email: support@karatrack.com</p>
              </div>
            </section>

            {/* Acknowledgment */}
            <section className={`p-6 rounded-xl ${isDark ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-cyan-50 border border-cyan-200'}`}>
              <h2 className={`text-xl font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Acknowledgment
              </h2>
              <p>
                By using Karatrack Studio, you acknowledge that you have read, understood, and agree 
                to be bound by these Terms of Service. You also acknowledge that you are solely 
                responsible for ensuring that your use of the Service complies with all applicable 
                laws, including copyright laws.
              </p>
            </section>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-8 mt-12">
        <div className="max-w-4xl mx-auto text-center text-gray-500 text-sm">
          <p>© 2025 Karatrack Studio. All rights reserved.</p>
          <div className="flex justify-center gap-6 mt-4">
            <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}