/**
 * Karatrack Studio Backend API Server
 * 
 * V15 UPDATE: Migrated to credit-based pricing model
 * - Removed tier-locked features (all features available to everyone)
 * - New subscription model: credits_per_month + billing_cycle
 * - New credit packs with 365-day validity
 * - Watermark based on has_ever_paid (not tier)
 * 
 * Previous features:
 * - lyrics_text (user-provided lyrics for 100% accuracy)
 * - display_mode (auto/scroll/page/overwrite)
 * - clean_version (profanity filter toggle)
 * - Style customization (colors, fonts, gradients)
 * - Email notifications via Brevo when processing completes
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const Stripe = require('stripe');
const axios = require('axios');
// OpenAI for chatbot
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// NEW: Import Brevo SDK
const SibApiV3Sdk = require('sib-api-v3-sdk');

// ============================================
// CONFIGURATION
// ============================================

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    realtime: {
      transport: WebSocket,
    },
  }
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY,
  },
});

// NEW: Configure Brevo
const brevoClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = brevoClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;
const brevoEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();

// Log Brevo configuration
if (process.env.BREVO_API_KEY) {
  console.log(`Email notifications: enabled (API key: ${process.env.BREVO_API_KEY.substring(0, 10)}...)`);
} else {
  console.log('Email notifications: DISABLED (no BREVO_API_KEY set)');
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const audioTypes = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/mp3', 'audio/x-wav', 'audio/mp4', 'audio/aac', 'audio/x-m4a', 'audio/ogg'];
    const imageTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    const videoTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    const fontTypes = ['font/ttf', 'font/otf', 'application/x-font-ttf', 'application/x-font-opentype', 'application/octet-stream'];
    if (audioTypes.includes(file.mimetype) || imageTypes.includes(file.mimetype) || videoTypes.includes(file.mimetype) || fontTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type.'));
    }
  },
});

const projectUpload = upload.fields([
  { name: 'audio', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
  { name: 'custom_watermark', maxCount: 1 },
  { name: 'bg_image', maxCount: 1 },
  { name: 'bg_video', maxCount: 1 },
  { name: 'custom_font', maxCount: 1 }
]);

// ============================================
// MIDDLEWARE
// ============================================

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  // V20: Exempt machine-to-machine webhook/cron routes from the user rate limit.
  // A burst of user traffic must never cause a RunPod or Stripe callback to be
  // dropped (a dropped RunPod callback strands a finished project on "processing").
  skip: (req) => req.originalUrl.startsWith('/api/webhooks/') || req.originalUrl.startsWith('/api/cron/'),
});
app.use(limiter);

app.use((req, res, next) => {
  if (req.originalUrl === '/api/webhooks/stripe') {
    next();
  } else {
    express.json()(req, res, next);
  }
});

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

async function checkCredits(userId, required) {
  // Check available (non-expired) credits
  const { data, error } = await supabase.rpc('get_available_credits', {
    p_user_id: userId
  });
  if (error) {
    // Fallback to profile credits if function not available yet
    const profile = await getUserProfile(userId);
    return profile.credits_remaining >= required;
  }
  return data >= required;
}

async function deductCredits(userId, amount, projectId, description) {
  // Use FIFO deduction - oldest non-expired credits first
  const { data, error } = await supabase.rpc('deduct_credits_fifo', {
    p_user_id: userId,
    p_amount: amount,
    p_project_id: projectId,
    p_description: description,
  });
  if (error) throw error;
  if (!data) throw new Error('Insufficient credits or credits expired');
  return data;
}

async function uploadToR2(buffer, key, contentType) {
  const command = new PutObjectCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });
  await r2Client.send(command);
  return `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${key}`;
}

// Extract the R2 key from a full URL
function extractR2Key(url) {
  if (!url) return null;
  // Remove the public URL prefix to get just the key
  const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL;
  if (publicUrl && url.startsWith(publicUrl)) {
    return url.replace(publicUrl + '/', '');
  }
  // If it's already just a key (no http), return as-is
  if (!url.startsWith('http')) {
    return url;
  }
  // Fallback: try to extract path after the domain
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.substring(1); // Remove leading slash
  } catch {
    return url;
  }
}

async function getSignedDownloadUrl(url, filename = null) {
  const key = extractR2Key(url);
  if (!key) return null;

  const commandOptions = {
    Bucket: process.env.CLOUDFLARE_R2_BUCKET,
    Key: key,
  };

  // Add Content-Disposition to force download with custom filename
  if (filename) {
    commandOptions.ResponseContentDisposition = `attachment; filename="${filename}"`;
  }

  const command = new GetObjectCommand(commandOptions);
  return getSignedUrl(r2Client, command, { expiresIn: 3600 });
}

// V21: Outro dedication surcharge, charged at render time when the project
// has outro text. Pricing math: the cheapest credit we ever sell is ~$0.06
// (biggest annual plan). 5 credits = $0.30+ revenue, covering the extra GPU
// render/encode time for up to 60s of additional footage (~$0.02-0.05) while
// keeping at least $0.25 profit even at the floor credit price.
const OUTRO_CREDIT_COST = 5;
const OUTRO_MAX_DURATION = 60; // seconds

function clampOutroDuration(value) {
  const d = parseInt(value, 10);
  if (isNaN(d)) return 10;
  return Math.max(3, Math.min(OUTRO_MAX_DURATION, d));
}

function calculateCreditsNeeded(options) {
  // Flat per-track pricing by resolution, charged at render time.
  // 540p/720p = 19, 1080p = 28, 4K = 46. Instant mode doubles the charge.
  const q = String(options.video_quality || '720p').toLowerCase();
  let credits;
  if (q === '480p' || q === '540p' || q === '720p') {
    credits = 19;
  } else if (q === '1080p') {
    credits = 28;
  } else if (q === '4k') {
    credits = 46;
  } else {
    credits = 19; // default to SD/HD
  }
  const mode = String(options.export_mode || 'queue').toLowerCase();
  if (mode === 'instant') credits *= 2;
  return credits;
}

// UPDATED: Added all layout, branding, and display parameters to RunPod payload
async function sendToRunPod(projectId, audioUrl, options) {
  const response = await axios.post(
    `https://api.runpod.ai/v2/${process.env.RUNPOD_ENDPOINT_ID}/run`,
    {
      input: {
        project_id: projectId,
        audio_url: audioUrl,
        processing_type: options.processing_type,
        include_lyrics: options.include_lyrics,
        video_quality: options.video_quality,
        thumbnail_url: options.thumbnail_url,
        artist_name: options.artist_name,
        song_title: options.song_title,
        track_number: options.track_number,
        callback_url: `${process.env.API_URL}/api/webhooks/runpod${process.env.RUNPOD_WEBHOOK_SECRET ? `?secret=${encodeURIComponent(process.env.RUNPOD_WEBHOOK_SECRET)}` : ''}`,

        // Lyrics and display options
        lyrics_text: options.lyrics_text || null,
        display_mode: options.display_mode || 'auto',
        clean_version: options.clean_version || false,

        // Layout options (V12 - these were missing!)
        aspect_ratio: options.aspect_ratio || '16:9',
        lines_per_scroll: options.lines_per_scroll || 5,
        lines_per_page: options.lines_per_page || 4,
        lines_per_overwrite: options.lines_per_overwrite || 4,
        emphasize_current_line: options.emphasize_current_line || false,
        show_progress_bar: options.show_progress_bar !== false,
        show_countdown: options.show_countdown !== false,
        show_lead_in_bars: options.show_lead_in_bars !== false,

        // Style customization options
        bg_color_1: options.bg_color_1 || '#1a1a2e',
        bg_color_2: options.bg_color_2 || '#16213e',
        use_gradient: options.use_gradient !== false,
        gradient_direction: options.gradient_direction || 'to bottom',
        text_color: options.text_color || '#ffffff',
        outline_color: options.outline_color || '#000000',
        sung_color: options.sung_color || '#00d4ff',
        font: options.font || 'arial',
        font_size: options.font_size || 'normal',
        custom_font_url: options.custom_font_url || null,
        custom_font_name: options.custom_font_name || null,

        // Video background options
        bg_type: options.bg_type || 'gradient',
        bg_video_preset: options.bg_video_preset || null,
        bg_video_url: options.bg_video_url || null,
        bg_image_url: options.bg_image_url || null,
        bg_image_fit: options.bg_image_fit || 'fill',
        bg_image_opacity: options.bg_image_opacity ?? 100,
        bg_image_overlay_color: options.bg_image_overlay_color || '#000000',
        bg_image_overlay_type: options.bg_image_overlay_type || 'none',
        bg_vignette_strength: options.bg_vignette_strength ?? 0,

        // Processing mode for two-stage flow
        processing_mode: options.processing_mode || 'full',

        // Subscription tier for watermark logic
        subscription_tier: options.subscription_tier || 'free',
        has_ever_paid: options.has_ever_paid || false,

        // Studio branding - Logo settings (V12)
        logo_url: options.logo_url || null,
        logo_position: options.logo_position || 'bottom-right',
        logo_size: options.logo_size || 50,
        logo_opacity: options.logo_opacity || 80,

        // Legacy custom watermark (kept for backward compatibility)
        custom_watermark_url: options.custom_watermark_url || null,

        // Intro/Start image settings (V12 - these were missing!)
        start_image_url: options.start_image_url || null,
        start_image_fit: options.start_image_fit || 'fill',
        start_image_opacity: options.start_image_opacity || 100,
        start_image_show_title: options.start_image_show_title !== false,

        // Outro dedication settings (V21: shown after the track ends, 5-60s)
        outro_text: options.outro_text || null,
        outro_duration: clampOutroDuration(options.outro_duration),
        outro_font_size: options.outro_font_size || 'normal',

        // For render_only mode
        processed_audio_url: options.processed_audio_url || null,
        vocals_audio_url: options.vocals_audio_url || null,
        edited_lyrics: options.edited_lyrics || null,

        // Editor-chosen vocal mode ('instrumental' | 'guide' | 'original') — was missing, worker always defaulted
        audio_track: options.audio_track || 'instrumental',
        // Customer-supplied clean instrumental (e.g. from Suno) replaces the AI-separated bed at render
        custom_instrumental_url: options.custom_instrumental_url || null,

        // V20: Key change (half steps, -6..+6) and speed (0.75..1.25).
        // Pitch preserves duration (lyric timing unaffected); speed scales
        // all word timestamps in the worker by 1/speed_rate.
        pitch_semitones: options.pitch_semitones ?? 0,
        speed_rate: options.speed_rate ?? 1.0,
      },
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.RUNPOD_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return response.data.id;
}

// NEW: Send completion email via Brevo
async function sendCompletionEmail(project, downloadUrl) {
  try {
    console.log(`Attempting to send completion email for project ${project.id}`);

    // Method 1: Try to get email from profiles table
    let userEmail = null;
    let userName = null;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', project.user_id)
      .single();

    if (profile?.email) {
      userEmail = profile.email;
      userName = profile.full_name || userEmail.split('@')[0];
      console.log(`   Found email in profiles: ${userEmail}`);
    }

    // Method 2: If not in profiles, try auth.users via SQL
    if (!userEmail) {
      const { data: authData, error: authError } = await supabase
        .rpc('get_user_email', { user_id: project.user_id });

      if (authData) {
        userEmail = authData;
        userName = userEmail.split('@')[0];
        console.log(`   Found email via RPC: ${userEmail}`);
      }
    }

    // Method 3: Try the admin API
    if (!userEmail) {
      try {
        const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(project.user_id);
        if (authUser?.user?.email) {
          userEmail = authUser.user.email;
          userName = authUser.user.user_metadata?.full_name || userEmail.split('@')[0];
          console.log(`   Found email via admin API: ${userEmail}`);
        }
      } catch (adminErr) {
        console.log(`   Admin API failed: ${adminErr.message}`);
      }
    }

    if (!userEmail) {
      console.error('Could not get user email for notification - no email found');
      return;
    }

    console.log(`   Sending email to: ${userEmail}`);

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

    sendSmtpEmail.subject = `Your karaoke track "${project.title}" is ready!`;
    sendSmtpEmail.sender = {
      name: 'Karatrack Studio',
      email: 'notifications@karatrack.com'
    };
    sendSmtpEmail.to = [{
      email: userEmail,
      name: userName
    }];

    sendSmtpEmail.htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f0f1a;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 40px;">
            <h1 style="color: #00d4ff; font-size: 28px; margin: 0;">Karatrack Studio</h1>
          </div>
          
          <!-- Main Content -->
          <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; padding: 40px; border: 1px solid rgba(0, 212, 255, 0.2);">
            <h2 style="color: #ffffff; font-size: 24px; margin: 0 0 20px 0;">
              Hey ${userName}!
            </h2>
            
            <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
              Great news! Your karaoke track is ready for download.
            </p>
            
            <!-- Track Info -->
            <div style="background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 20px; margin-bottom: 30px;">
              <p style="color: #00d4ff; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0;">
                ${project.track_number || 'KT-01'}
              </p>
              <p style="color: #ffffff; font-size: 20px; font-weight: bold; margin: 0 0 4px 0;">
                ${project.song_title || project.title}
              </p>
              <p style="color: #a0a0a0; font-size: 14px; margin: 0;">
                by ${project.artist_name || 'Unknown Artist'}
              </p>
            </div>
            
            <!-- Download Button -->
            <div style="text-align: center;">
              <a href="${downloadUrl}" 
                 style="display: inline-block; background: linear-gradient(90deg, #00d4ff 0%, #a855f7 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-weight: bold; font-size: 16px;">
                Download Your Track
              </a>
            </div>
            
            <p style="color: #666; font-size: 12px; text-align: center; margin: 30px 0 0 0;">
              This download link expires in 1 hour. You can always download again from your dashboard.
            </p>
          </div>
          
          <!-- Footer -->
          <div style="text-align: center; margin-top: 40px;">
            <p style="color: #666; font-size: 14px; margin: 0 0 10px 0;">
              <a href="${process.env.FRONTEND_URL}/dashboard" style="color: #00d4ff; text-decoration: none;">
                Go to Dashboard
              </a>
            </p>
            <p style="color: #444; font-size: 12px; margin: 0;">
              ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© ${new Date().getFullYear()} Karatrack Studio. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    sendSmtpEmail.textContent = `
Hey ${userName}!

Great news! Your karaoke track "${project.song_title || project.title}" by ${project.artist_name || 'Unknown Artist'} is ready for download.

Download your track here: ${downloadUrl}

This link expires in 1 hour. You can always download again from your dashboard at ${process.env.FRONTEND_URL}/dashboard

- Karatrack Studio
    `;

    await brevoEmailApi.sendTransacEmail(sendSmtpEmail);
    console.log(`Completion email sent to ${userEmail} for project ${project.id}`);

  } catch (error) {
    console.error('Error sending completion email:');
    console.error('   Message:', error.message);
    console.error('   Status:', error.status);
    console.error('   Response:', JSON.stringify(error.response?.body || error.response?.text || 'No response body'));
    // Don't throw - email failure shouldn't break the webhook
  }
}

// NEW: Send failure notification email
async function sendFailureEmail(project, errorMessage) {
  try {
    console.log(`Attempting to send failure email for project ${project.id}`);

    // Get user email (same method as sendCompletionEmail)
    let userEmail = null;
    let userName = null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', project.user_id)
      .single();

    if (profile?.email) {
      userEmail = profile.email;
      userName = profile.full_name || userEmail.split('@')[0];
    }

    if (!userEmail) {
      try {
        const { data: authUser } = await supabase.auth.admin.getUserById(project.user_id);
        if (authUser?.user?.email) {
          userEmail = authUser.user.email;
          userName = authUser.user.user_metadata?.full_name || userEmail.split('@')[0];
        }
      } catch (adminErr) {
        console.log(`   Admin API failed: ${adminErr.message}`);
      }
    }

    if (!userEmail) {
      console.error('Could not get user email for failure notification');
      return;
    }

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

    sendSmtpEmail.subject = `Issue processing "${project.title}"`;
    sendSmtpEmail.sender = {
      name: 'Karatrack Studio',
      email: 'notifications@karatrack.com'
    };
    sendSmtpEmail.to = [{
      email: userEmail,
      name: userName
    }];

    sendSmtpEmail.htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f0f1a;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 40px;">
            <h1 style="color: #00d4ff; font-size: 28px; margin: 0;">Karatrack Studio</h1>
          </div>
          
          <!-- Main Content -->
          <div style="background: linear-gradient(135deg, #2e1a1a 0%, #3e1616 100%); border-radius: 16px; padding: 40px; border: 1px solid rgba(255, 100, 100, 0.2);">
            <h2 style="color: #ffffff; font-size: 24px; margin: 0 0 20px 0;">
              Processing Issue
            </h2>
            
            <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
              Unfortunately, there was an issue processing your track "${project.song_title || project.title}".
            </p>
            
            <p style="color: #ff6b6b; font-size: 14px; margin: 0 0 30px 0;">
              ${errorMessage || 'An unexpected error occurred during processing.'}
            </p>
            
            <p style="color: #a0a0a0; font-size: 14px; line-height: 1.6; margin: 0 0 30px 0;">
              Your credits have not been deducted. Please try uploading again, or contact support if the issue persists.
            </p>
            
            <!-- Retry Button -->
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/upload" 
                 style="display: inline-block; background: linear-gradient(90deg, #00d4ff 0%, #a855f7 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-weight: bold; font-size: 16px;">
                Try Again
              </a>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="text-align: center; margin-top: 40px;">
            <p style="color: #666; font-size: 14px; margin: 0 0 10px 0;">
              Need help? <a href="mailto:support@karatrack.com" style="color: #00d4ff; text-decoration: none;">Contact Support</a>
            </p>
            <p style="color: #444; font-size: 12px; margin: 0;">
              ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© ${new Date().getFullYear()} Karatrack Studio. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    await brevoEmailApi.sendTransacEmail(sendSmtpEmail);
    console.log(`Failure email sent to ${userEmail} for project ${project.id}`);

  } catch (error) {
    console.error('Error sending failure email:', error);
  }
}

// NEW: Send downgrade scheduled confirmation email
async function sendDowngradeScheduledEmail(userEmail, userName, currentTier, newTier, effectiveDate) {
  if (!process.env.BREVO_API_KEY) {
    console.log('Brevo not configured, skipping downgrade email');
    return;
  }

  try {
    const formattedDate = new Date(effectiveDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

    sendSmtpEmail.subject = `Your plan change is scheduled`;
    sendSmtpEmail.sender = {
      name: 'Karatrack Studio',
      email: 'notifications@karatrack.com'
    };
    sendSmtpEmail.to = [{
      email: userEmail,
      name: userName
    }];

    sendSmtpEmail.htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f0f1a;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 40px;">
            <h1 style="color: #00d4ff; font-size: 28px; margin: 0;">Karatrack Studio</h1>
          </div>
          
          <!-- Main Content -->
          <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; padding: 40px; border: 1px solid rgba(0, 212, 255, 0.2);">
            <h2 style="color: #ffffff; font-size: 24px; margin: 0 0 20px 0;">
              Plan Change Confirmed
            </h2>
            
            <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
              Hey ${userName}, your subscription change has been scheduled.
            </p>
            
            <!-- Plan Change Info -->
            <div style="background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 20px; margin-bottom: 30px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0;">
                    <p style="color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px 0;">Current Plan</p>
                    <p style="color: #00d4ff; font-size: 18px; font-weight: bold; margin: 0; text-transform: capitalize;">${currentTier}</p>
                  </td>
                  <td style="text-align: center; color: #666; font-size: 24px;">to</td>
                  <td style="text-align: right; padding: 10px 0;">
                    <p style="color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px 0;">New Plan</p>
                    <p style="color: #a855f7; font-size: 18px; font-weight: bold; margin: 0; text-transform: capitalize;">${newTier}</p>
                  </td>
                </tr>
              </table>
              <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px; margin-top: 15px;">
                <p style="color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px 0;">Effective Date</p>
                <p style="color: #ffffff; font-size: 16px; margin: 0;">${formattedDate}</p>
              </div>
            </div>
            
            <div style="background: rgba(0, 212, 255, 0.1); border-left: 4px solid #00d4ff; padding: 15px; border-radius: 0 8px 8px 0; margin-bottom: 30px;">
              <p style="color: #ffffff; font-size: 14px; margin: 0;">
                <strong>What this means:</strong><br><br>
                - You'll keep all ${currentTier} benefits until ${formattedDate}<br>
                - Your existing credits remain valid until they expire<br>
                - No action needed - the change happens automatically
              </p>
            </div>
            
            <p style="color: #666; font-size: 14px; margin: 0;">
              Changed your mind? You can cancel this scheduled change from your 
              <a href="${process.env.FRONTEND_URL}/settings" style="color: #00d4ff; text-decoration: none;">account settings</a>
              before the effective date.
            </p>
          </div>
          
          <!-- Footer -->
          <div style="text-align: center; margin-top: 40px;">
            <p style="color: #666; font-size: 14px; margin: 0 0 10px 0;">
              <a href="${process.env.FRONTEND_URL}/dashboard" style="color: #00d4ff; text-decoration: none;">
                Go to Dashboard
              </a>
            </p>
            <p style="color: #444; font-size: 12px; margin: 0;">
              ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© ${new Date().getFullYear()} Karatrack Studio. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    sendSmtpEmail.textContent = `
Hey ${userName},

Your subscription change has been scheduled.

Current Plan: ${currentTier}
New Plan: ${newTier}
Effective Date: ${formattedDate}

What this means:
- You'll keep all ${currentTier} benefits until ${formattedDate}
- Your existing credits remain valid until they expire
- No action needed - the change happens automatically

Changed your mind? You can cancel this scheduled change from your account settings before the effective date.

Visit your dashboard: ${process.env.FRONTEND_URL}/dashboard

- Karatrack Studio
    `;

    await brevoEmailApi.sendTransacEmail(sendSmtpEmail);
    console.log(`Downgrade scheduled email sent to ${userEmail}`);

  } catch (error) {
    console.error('Error sending downgrade email:', error);
    // Don't throw - email failure shouldn't break the flow
  }
}

// ============================================
// AI CHATBOT ENDPOINT
// ============================================

app.post('/api/chat', authMiddleware, async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (message.length > 1000) {
      return res.status(400).json({ error: 'Message too long. Please keep it under 1000 characters.' });
    }

    const profile = await getUserProfile(req.user.id);
    
    const { data: recentProjects } = await supabase
      .from('projects')
      .select('id, title, status, created_at, video_quality')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    const projectContext = recentProjects && recentProjects.length > 0
      ? recentProjects.map(p => `- "${p.title}" (${p.status})`).join('\n')
      : 'No projects yet';

    // V15: User is "paid" if they have ever paid (subscription or credit pack)
    const isPaidUser = profile.has_ever_paid || profile.subscription_credits_per_month > 0;

    const systemPrompt = `You are a friendly, helpful assistant for Karatrack Studio - an AI-powered karaoke video creation platform. Your job is to help users understand how to use the software and solve any confusion they have.

## HOW KARATRACK WORKS
1. User uploads an audio file (MP3, WAV, or FLAC)
2. User pastes the song lyrics into the lyrics box
3. User selects video quality and style options (colors, fonts, background)
4. AI removes vocals from the audio using Demucs technology
5. AI syncs the lyrics to the music using AssemblyAI word-level timing
6. A karaoke video is generated with scrolling lyrics
7. User downloads the finished MP4 video

In the editor's Export tab, users can also change the song's KEY (up to 6 half steps up or down) and SPEED (75% to 125%) before rendering. Lyric timing adjusts automatically.

## PRICING MODEL
Karatrack uses a universal credit system - all features are available to everyone!

### Subscriptions (credits/month with recurring billing)
- 50 credits/mo: $2.99/mo or $2.49/mo (annual)
- 100 credits/mo: $4.99/mo or $3.99/mo (annual)
- 250 credits/mo: $9.99/mo or $7.99/mo (annual)
- 500 credits/mo: $17.99/mo or $14.49/mo (annual)
- 1,000 credits/mo: $29.99/mo or $23.99/mo (annual)

### Credit Packs (one-time purchase, valid 1 year)
- 50 credits: $4.99
- 150 credits: $11.99
- 400 credits: $27.99
- 1,000 credits: $54.99

### Credit Costs Per Minute of Audio
- 540p: 1 credit/min (queue) or 2 credits/min (instant)
- 720p: 2 credits/min (queue) or 4 credits/min (instant)
- 1080p: 3 credits/min (queue) or 6 credits/min (instant)
- 4K: 5 credits/min (queue) or 10 credits/min (instant)

Re-renders cost ~50% of original price.

Free accounts get 19 credits to try everything (enough for one 720p track). No credit card required.
Watermarks only appear on free account exports - any purchase removes them.

## CURRENT USER INFO
- Subscription: ${profile.subscription_credits_per_month || 0} credits/month
- Credits: ${profile.credits_remaining || 0}
- Recent projects:
${projectContext}

## COMMON QUESTIONS

**"How long does processing take?"**
Usually 5-15 minutes depending on song length and server load. You'll get an email when it's done (if notifications are enabled).

**"Why are my lyrics not syncing correctly?"**
Make sure you paste the complete, accurate lyrics when uploading. The AI matches what you provide to the audio. Pro/Studio users can edit timing before the final render.

**"How do I remove the watermark?"**
Upgrade to Starter ($9.99/mo) or higher to remove the Karatrack watermark from your videos.

**"Can I edit the lyrics after uploading?"**
Pro and Studio subscribers can review and edit lyrics timing before the final video is rendered.

**"Can I change the key of the song?"**
Yes! Open your project in the editor, then click the Export tab. Use the Key Change control to move the song up or down by up to 6 half steps - great for matching your vocal range. The key change is applied when the video is exported (the editor preview plays in the original key). Lyric timing is not affected.

**"Can I change the speed / tempo of the song?"**
Yes! In the editor's Export tab, drag the Speed slider anywhere from 75% to 125%. The editor preview plays at the new speed right away so you can hear it, and the pitch is NOT affected (no chipmunk effect). Lyric timing automatically adjusts to match the new speed when the video is exported. Key and speed can be combined, and you can re-render an existing track with a new key or speed (re-renders cost ~50%).

**"What audio formats are supported?"**
MP3, WAV, and FLAC files up to 500MB.

**"Why did my project fail?"**
This can happen with very low quality audio or unusual formats. Try a different audio file. Failed projects don't use credits.

**"How do I get a refund?"**
Billing questions should be handled through the Priority Support form on the dashboard (paid users only).

## YOUR GUIDELINES
- Be friendly, concise, and helpful
- Focus on explaining how to use Karatrack features
- Keep responses under 150 words unless the user needs detailed instructions
- If a user has a complex account/billing issue, ${isPaidUser ? 'direct them to use the Priority Support button on their dashboard' : 'let them know that support is available to paid subscribers'}
- If you do not know something, be honest and say so
- Never make up features that do not exist
- Do not provide legal advice - if users need legal guidance, suggest they consult a legal professional

## LEGAL GUIDANCE FOR KARAOKE CREATION
When users ask about legality of converting music to karaoke, explain:

**What is generally legal (private/personal use):**
- You legally purchased the track (CD, MP3, iTunes, Amazon, etc.)
- You remove vocals or edit it yourself
- You use it ONLY in your home for personal practice
- You do NOT share, upload, sell, or perform it publicly
This falls under personal use and is typically protected.

**What is NOT legal:**
- Uploading to YouTube, Facebook, TikTok, SoundCloud, etc.
- Sharing the file with others
- Selling or giving it away
- Using it at karaoke shows, bars, livestreams, or public venues
- Monetizing it in any way
- Distributing karaoke tracks made from commercial songs

**Key points:**
- Streaming services (Spotify, Apple Music) do NOT equal ownership - you cannot use streamed music
- Only use music you actually OWN (purchased MP3s, CDs, WAVs)
- Once it leaves private home use, copyright law applies fully
- Commercial karaoke companies pay for proper licenses - that is why they can sell their tracks

**Bottom line:** Karatrack is designed for personal, private use with music you own. Users are responsible for ensuring they have the rights to any music they upload.

## MUSIC SOURCES - IMPORTANT
If asked where to get music, ONLY suggest these legitimate sources:
- Music you have purchased and own (iTunes, Amazon, Bandcamp, CD rips)
- Royalty-free music libraries (Epidemic Sound, Artlist, Uppbeat, Pixabay Music)
- Music you created yourself (original compositions)
- Public domain music
- Music you have proper licensing agreements for

NEVER recommend or suggest:
- Downloading from YouTube, Spotify, or any streaming service
- Converting streaming audio to files
- YouTube to MP3 converters or similar tools
- Any method that could involve piracy`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-10),
      { role: 'user', content: message }
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      max_tokens: 400,
      temperature: 0.7
    });

    res.json({ 
      response: completion.choices[0].message.content
    });

  } catch (error) {
    console.error('Chat error:', error);
    
    if (error.code === 'insufficient_quota') {
      return res.status(503).json({ error: 'Chat service temporarily unavailable. Please try again later.' });
    }
    
    res.status(500).json({ error: 'Failed to get response. Please try again.' });
  }
});

// Guest chat endpoint (not logged in)
app.post('/api/chat/guest', async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (message.length > 500) {
      return res.status(400).json({ error: 'Message too long. Please keep it under 500 characters.' });
    }

    const systemPrompt = `You are a friendly, helpful assistant for Karatrack Studio - an AI-powered karaoke video creation platform.

## HOW KARATRACK WORKS
1. Upload an audio file (MP3, WAV, or FLAC)
2. Paste the song lyrics
3. Choose video quality and style options
4. AI removes vocals and syncs lyrics automatically
5. Download your finished karaoke video (MP4)

Extras: in the editor's Export tab you can change the song's key (up to 6 half steps up or down) and speed (75% to 125%) before rendering - lyric timing adjusts automatically.

## PRICING
Karatrack uses a simple credit system - all features available to everyone!
- Free: 19 credits to try everything
- Subscriptions: 50-1000 credits/month from $2.99/mo
- Credit packs: 50-1000 credits from $4.99 (one-time, valid 1 year)
- Credits per minute: 1-5 depending on video quality (540p to 4K)

## YOUR GUIDELINES
- Be friendly and concise (under 100 words)
- Help users understand what Karatrack does
- Encourage them to sign up for a free account to try it out
- If they have detailed questions, suggest creating an account for personalized help

## LEGAL & MUSIC SOURCES
- Karatrack is for personal, private use with music you OWN (purchased MP3s, CDs)
- Legal for: home practice with music you bought
- NOT legal: uploading, sharing, public performance, or using streamed music
- For music sources, only suggest: purchased music, royalty-free libraries (Uppbeat, Artlist), or original creations
- NEVER mention YouTube, Spotify, or streaming downloads`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-6),
      { role: 'user', content: message }
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      max_tokens: 250,
      temperature: 0.7
    });

    res.json({ 
      response: completion.choices[0].message.content
    });

  } catch (error) {
    console.error('Guest chat error:', error);
    res.status(500).json({ error: 'Failed to get response. Please try again.' });
  }
});

// ============================================
// API ROUTES
// ============================================

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// USER & CREDITS
app.get('/api/user/profile', authMiddleware, async (req, res) => {
  try {
    const profile = await getUserProfile(req.user.id);
    res.json(profile);
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// DEFAULT WATERMARK MANAGEMENT
// V15: All features available to everyone
// ============================================

// Upload/save default watermark
app.post('/api/profile/watermark', authMiddleware, upload.single('watermark'), async (req, res) => {
  try {
    // V15: All features available to everyone - no tier check needed

    if (!req.file) {
      return res.status(400).json({ error: 'No watermark file provided' });
    }

    // Upload watermark to R2
    // Unique filename per upload (timestamp) so browsers/CDN never show a stale cached image
    const watermarkExt = req.file.originalname.substring(req.file.originalname.lastIndexOf('.'));
    const watermarkKey = `watermarks/${req.user.id}/default-watermark-${Date.now()}${watermarkExt}`;
    const watermarkUrl = await uploadToR2(req.file.buffer, watermarkKey, req.file.mimetype);
    console.log(`Default watermark uploaded for user ${req.user.id}: ${watermarkUrl}`);

    // Save URL to user's profile
    const { error } = await supabase
      .from('profiles')
      .update({ default_watermark_url: watermarkUrl })
      .eq('id', req.user.id);

    if (error) throw error;

    res.json({ 
      success: true, 
      watermark_url: watermarkUrl,
      message: 'Default watermark saved successfully' 
    });
  } catch (error) {
    console.error('Watermark upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete default watermark
app.delete('/api/profile/watermark', authMiddleware, async (req, res) => {
  try {
    // Clear watermark URL from profile
    const { error } = await supabase
      .from('profiles')
      .update({ default_watermark_url: null })
      .eq('id', req.user.id);

    if (error) throw error;

    console.log(`Default watermark cleared for user ${req.user.id}`);
    res.json({ success: true, message: 'Default watermark removed' });
  } catch (error) {
    console.error('Watermark delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/user/credits/history', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Credits history error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PROJECTS
app.get('/api/projects', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Projects fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/projects/:id', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Project not found' });
    res.json(data);
  } catch (error) {
    console.error('Project fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE project endpoint
app.delete('/api/projects/:id', authMiddleware, async (req, res) => {
  try {
    const projectId = req.params.id;
    
    // First, verify the project exists and belongs to this user
    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', req.user.id)
      .single();
    
    if (fetchError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Delete associated render history first (if table exists)
    // Also collect their R2 video URLs for file cleanup
    let renderVideoUrls = [];
    try {
      const { data: renderRows } = await supabase
        .from('project_renders')
        .select('video_url')
        .eq('project_id', projectId);

      if (renderRows) {
        renderVideoUrls = renderRows.map(r => r.video_url).filter(Boolean);
      }

      await supabase
        .from('project_renders')
        .delete()
        .eq('project_id', projectId);
    } catch (e) {
      // Table might not exist, ignore error
      console.log('No render history to delete or table does not exist');
    }
    
    // Delete the project from the database
    const { error: deleteError } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)
      .eq('user_id', req.user.id);
    
    if (deleteError) {
      throw deleteError;
    }
    
    // Optionally: Delete files from R2 storage
    // Note: This is optional - files will eventually be cleaned up
    // or you can set up a cleanup job
    try {
      const keysToDelete = [];
      
      if (project.original_file_url) {
        // Derive the R2 key from the stored URL path (uploads are keyed by user id,
        // e.g. uploads/{userId}/{uuid}-name, so do NOT rebuild from projectId).
        try {
          const urlPath = new URL(project.original_file_url).pathname;
          const originalKey = urlPath.startsWith('/') ? urlPath.substring(1) : urlPath;
          if (originalKey) keysToDelete.push(originalKey);
        } catch (e) {
          console.log(`Could not parse original file URL: ${project.original_file_url}`);
        }
      }
      
      // Add processed files (legacy key + current project video_url)
      keysToDelete.push(`processed/${projectId}/video.mp4`);
      keysToDelete.push(`processed/${projectId}/instrumental.mp3`);
      keysToDelete.push(`processed/${projectId}/vocals.mp3`);

      // Add all versioned render video files from render history
      for (const videoUrl of renderVideoUrls) {
        // Extract R2 key from the full URL
        // URL format: https://pub-xxx.r2.dev/processed/{id}/video_20260131_190000.mp4
        try {
          const urlPath = new URL(videoUrl).pathname;
          // Remove leading slash to get the R2 key
          const r2Key = urlPath.startsWith('/') ? urlPath.substring(1) : urlPath;
          if (r2Key && !keysToDelete.includes(r2Key)) {
            keysToDelete.push(r2Key);
          }
        } catch (e) {
          console.log(`Could not parse render video URL: ${videoUrl}`);
        }
      }
      
      // Delete from R2 (fire and forget - don't wait)
      for (const key of keysToDelete) {
        r2Client.send(new DeleteObjectCommand({
          Bucket: process.env.CLOUDFLARE_R2_BUCKET,
          Key: key,
        })).catch(e => console.log(`Could not delete ${key}:`, e.message));
      }
    } catch (e) {
      console.log('Error cleaning up R2 files:', e.message);
      // Don't fail the request if file cleanup fails
    }
    
    console.log(`Project ${projectId} deleted by user ${req.user.id}`);
    
    res.json({ 
      success: true, 
      message: 'Project deleted successfully',
      project_id: projectId
    });
    
  } catch (error) {
    console.error('Project delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// UPDATED: Project creation with subscription_tier for watermark logic
app.post('/api/projects', authMiddleware, projectUpload, async (req, res) => {
  try {
    const {
      title,
      processing_type,
      include_lyrics,
      video_quality,
      artist_name,
      song_title,
      track_number,
      // Lyrics and display options
      lyrics_text,
      display_mode,
      clean_version,
      // Style customization
      bg_color_1,
      bg_color_2,
      use_gradient,
      gradient_direction,
      text_color,
      outline_color,
      sung_color,
      font,
      font_size,
      // Video background options (NEW)
      bg_type,
      bg_video_preset,
      bg_video_preset_filename,
      // Email notification preference
      notify_on_complete,
      // Processing mode for lyrics review
      processing_mode,
      // Custom font name
      custom_font_name
    } = req.body;

    const file = req.files?.audio?.[0];
    const thumbnailFile = req.files?.thumbnail?.[0];
    const customWatermarkFile = req.files?.custom_watermark?.[0];
    const bgImageFile = req.files?.bg_image?.[0];
    const bgVideoFile = req.files?.bg_video?.[0];
    const customFontFile = req.files?.custom_font?.[0];

    if (!file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Validate lyrics are provided (required for accurate sync)
    if (!lyrics_text || lyrics_text.trim().length < 50) {
      return res.status(400).json({
        error: 'Lyrics are required for accurate sync. Please paste the complete song lyrics (minimum 50 characters).'
      });
    }

    // Uploading and previewing are FREE. Credits are charged at render time
    // (see /api/projects/:id/render), where the chosen resolution and
    // Queue/Instant mode are known.

    const fileKey = `uploads/${req.user.id}/${uuidv4()}-${file.originalname}`;
    const fileUrl = await uploadToR2(file.buffer, fileKey, file.mimetype);

    const projectId = uuidv4();

    // Upload thumbnail if provided
    let thumbnailUrl = null;
    if (thumbnailFile) {
      const thumbKey = `thumbnails/${req.user.id}/${projectId}-thumbnail${thumbnailFile.originalname.substring(thumbnailFile.originalname.lastIndexOf('.'))}`;
      thumbnailUrl = await uploadToR2(thumbnailFile.buffer, thumbKey, thumbnailFile.mimetype);
    }

    // V15: Upload custom watermark if provided (available to all users)
    let customWatermarkUrl = null;
    const userProfileForWatermark = await getUserProfile(req.user.id);
    
    if (customWatermarkFile) {
      // New watermark file uploaded this session
      const watermarkKey = `watermarks/${req.user.id}/${projectId}-watermark${customWatermarkFile.originalname.substring(customWatermarkFile.originalname.lastIndexOf('.'))}`;
      customWatermarkUrl = await uploadToR2(customWatermarkFile.buffer, watermarkKey, customWatermarkFile.mimetype);
      console.log(`Custom watermark uploaded: ${customWatermarkUrl}`);
    } else if (req.body.custom_watermark_url) {
      // Use saved default watermark URL from profile
      customWatermarkUrl = req.body.custom_watermark_url;
      console.log(`Using saved default watermark: ${customWatermarkUrl}`);
    }

    // V15: Upload background image if provided (available to all users)
    let bgImageUrl = null;
    if (bgImageFile && bg_type === 'image') {
      const bgImageKey = `backgrounds/${req.user.id}/${projectId}-bg-image${bgImageFile.originalname.substring(bgImageFile.originalname.lastIndexOf('.'))}`;
      bgImageUrl = await uploadToR2(bgImageFile.buffer, bgImageKey, bgImageFile.mimetype);
      console.log(`Background image uploaded: ${bgImageUrl}`);
    }

    // V15: Upload custom background video if provided (available to all users)
    let bgVideoUrl = null;
    if (bgVideoFile && bg_type === 'video') {
      const bgVideoKey = `backgrounds/${req.user.id}/${projectId}-bg-video${bgVideoFile.originalname.substring(bgVideoFile.originalname.lastIndexOf('.'))}`;
      bgVideoUrl = await uploadToR2(bgVideoFile.buffer, bgVideoKey, bgVideoFile.mimetype);
      console.log(`Custom background video uploaded: ${bgVideoUrl}`);
    }

    // Upload custom font if provided
    let customFontUrl = null;
    if (customFontFile) {
      const fontExtension = customFontFile.originalname.substring(customFontFile.originalname.lastIndexOf('.'));
      const fontKey = `fonts/${req.user.id}/${projectId}-font${fontExtension}`;
      customFontUrl = await uploadToR2(customFontFile.buffer, fontKey, customFontFile.mimetype);
      console.log(`Custom font uploaded: ${customFontUrl}`);
    }

    // Update user's track count
    await supabase
      .from('profiles')
      .update({ track_count: supabase.rpc('increment_track_count') })
      .eq('id', req.user.id);

    // Insert project with all fields including style options
    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        id: projectId,
        user_id: req.user.id,
        title: title || file.originalname,
        artist_name: artist_name || 'Unknown Artist',
        song_title: song_title || file.originalname.replace(/\.[^/.]+$/, ''),
        track_number: track_number || 'KT-01',
        status: 'queued',
        original_file_url: fileUrl,
        original_file_name: file.originalname,
        original_file_size: file.size,
        processing_type,
        include_lyrics: include_lyrics === 'true',
        video_quality,
        credits_used: 0,
        thumbnail_url: thumbnailUrl,
        // Lyrics and display
        lyrics_text: lyrics_text ? lyrics_text.trim() : null,
        display_mode: display_mode || 'auto',
        clean_version: clean_version === 'true' || clean_version === true,
        // Style options
        bg_color_1: bg_color_1 || '#1a1a2e',
        bg_color_2: bg_color_2 || '#16213e',
        use_gradient: use_gradient !== 'false' && use_gradient !== false,
        gradient_direction: gradient_direction || 'to bottom',
        text_color: text_color || '#ffffff',
        outline_color: outline_color || '#000000',
        sung_color: sung_color || '#00d4ff',
        font: font || 'arial',
        font_size: font_size || 'normal',
        // Custom font
        custom_font_url: customFontUrl || null,
        custom_font_name: custom_font_name || null,
        // Video background options (NEW)
        bg_type: bg_type || 'gradient',
        bg_video_preset: bg_video_preset || null,
        bg_video_preset_filename: bg_video_preset_filename || null,
        bg_video_url: bgVideoUrl || null,
        bg_image_url: bgImageUrl || null,
        // Email notification preference
        notify_on_complete: notify_on_complete !== 'false' && notify_on_complete !== false,
        // Custom watermark for Studio users
        custom_watermark_url: customWatermarkUrl,
        // Outro text for Studio users
        outro_text: req.body.outro_text || null,
      })
      .select()
      .single();

    if (error) throw error;

    // No upload-time charge - credits are deducted at render.

    // NEW: Get user's subscription tier for watermark logic
    const userProfile = await getUserProfile(req.user.id);

    // Send to RunPod with all options including subscription_tier.
    // If enqueue fails after we've deducted credits, refund and fail cleanly.
    let runpodJobId;
    try {
    runpodJobId = await sendToRunPod(projectId, fileUrl, {
      processing_type,
      include_lyrics: include_lyrics === 'true',
      video_quality,
      thumbnail_url: thumbnailUrl,
      artist_name: artist_name || 'Unknown Artist',
      song_title: song_title || file.originalname.replace(/\.[^/.]+$/, ''),
      track_number: track_number || 'KT-01',
      lyrics_text: lyrics_text ? lyrics_text.trim() : null,
      display_mode: display_mode || 'auto',
      clean_version: clean_version === 'true' || clean_version === true,
      // Style options
      bg_color_1: bg_color_1 || '#1a1a2e',
      bg_color_2: bg_color_2 || '#16213e',
      use_gradient: use_gradient !== 'false' && use_gradient !== false,
      gradient_direction: gradient_direction || 'to bottom',
      text_color: text_color || '#ffffff',
      outline_color: outline_color || '#000000',
      sung_color: sung_color || '#00d4ff',
      font: font || 'arial',
      font_size: font_size || 'normal',
      // Custom font
      custom_font_url: customFontUrl || null,
      custom_font_name: custom_font_name || null,
      // Video background options (NEW)
      bg_type: bg_type || 'gradient',
      bg_video_preset: bg_video_preset_filename || null,
      bg_video_url: bgVideoUrl || null,
      bg_image_url: bgImageUrl || null,
      bg_image_fit: req.body.bg_image_fit || 'fill',
      bg_image_opacity: parseInt(req.body.bg_image_opacity) || 100,
      bg_image_overlay_color: req.body.bg_image_overlay_color || '#000000',
      bg_image_overlay_type: req.body.bg_image_overlay_type || 'none',
      bg_vignette_strength: parseInt(req.body.bg_vignette_strength) || 0,
      // Processing mode
      processing_mode: processing_mode || 'full',
      // NEW: Subscription tier (logging) + purchase flag for watermark logic
      subscription_tier: userProfile.subscription_tier || 'free',
      has_ever_paid: userProfile.has_ever_paid || false,
      // Custom watermark URL (available to all users)
      custom_watermark_url: customWatermarkUrl,
      // Outro text for Studio users
        outro_text: req.body.outro_text || null,
    });
    } catch (sendErr) {
      // Upload is free (credits are charged at render), so nothing to refund here.
      await supabase
        .from('projects')
        .update({ status: 'failed', error_message: 'Failed to start processing.' })
        .eq('id', projectId);
      throw sendErr;
    }

    // Set appropriate status based on processing mode
    const initialStatus = processing_mode === 'transcribe_only' ? 'transcribing' : 'processing';

    await supabase
      .from('projects')
      .update({
        runpod_job_id: runpodJobId,
        status: initialStatus,
        processing_started_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    res.status(201).json({
      ...project,
      runpod_job_id: runpodJobId,
      credits_used: 0,
    });

  } catch (error) {
    console.error('Project creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/projects/:id/thumbnail', authMiddleware, upload.single('thumbnail'), async (req, res) => {
  try {
    const file = req.file;
    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Unique filename per upload (timestamp) so browsers/CDN never show a stale cached image
    const thumbExt = file.originalname.substring(file.originalname.lastIndexOf('.'));
    const fileKey = `thumbnails/${req.user.id}/${req.params.id}-thumbnail-${Date.now()}${thumbExt}`;
    const fileUrl = await uploadToR2(file.buffer, fileKey, file.mimetype);

    const { data: updated, updateError } = await supabase
      .from('projects')
      .update({ thumbnail_url: fileUrl })
      .eq('id', req.params.id)
      .select()
      .single();

    if (updateError) throw updateError;
    res.json(updated);
  } catch (error) {
    console.error('Thumbnail upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload logo/watermark for a specific project (Studio tier feature)
app.post('/api/upload-logo', authMiddleware, upload.single('logo'), async (req, res) => {
  try {
    const projectId = req.body.projectId;
    
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    // Check if user owns this project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', req.user.id)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No logo file provided' });
    }

    // V15: All features available to everyone - no tier check needed

    // Upload logo to R2
    // Unique filename per upload (timestamp) so browsers/CDN never show a stale cached image
    const logoExt = req.file.originalname.substring(req.file.originalname.lastIndexOf('.'));
    const logoKey = `logos/${req.user.id}/${projectId}-logo-${Date.now()}${logoExt}`;
    const logoUrl = await uploadToR2(req.file.buffer, logoKey, req.file.mimetype);
    console.log(`Logo uploaded for project ${projectId}: ${logoUrl}`);

    // Save URL to project
    const { error: updateError } = await supabase
      .from('projects')
      .update({ logo_url: logoUrl })
      .eq('id', projectId);

    if (updateError) throw updateError;

    res.json({ 
      success: true, 
      logoUrl: logoUrl,
      message: 'Logo uploaded successfully' 
    });
  } catch (error) {
    console.error('Logo upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload custom background image for a specific project (available to all users)
app.post('/api/upload-background-image', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    const projectId = req.body.projectId;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    // Check if user owns this project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', req.user.id)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Unique filename per upload (timestamp) so browsers/CDN never show a stale cached image
    const ext = req.file.originalname.substring(req.file.originalname.lastIndexOf('.'));
    const imageKey = `backgrounds/${req.user.id}/${projectId}-bg-image-${Date.now()}${ext}`;
    const imageUrl = await uploadToR2(req.file.buffer, imageKey, req.file.mimetype);
    console.log(`Background image uploaded for project ${projectId}: ${imageUrl}`);

    const { error: updateError } = await supabase
      .from('projects')
      .update({ bg_image_url: imageUrl, bg_type: 'image' })
      .eq('id', projectId);

    if (updateError) throw updateError;

    res.json({ success: true, imageUrl, message: 'Background image uploaded successfully' });
  } catch (error) {
    console.error('Background image upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload custom background video for a specific project (available to all users)
app.post('/api/upload-background-video', authMiddleware, upload.single('video'), async (req, res) => {
  try {
    const projectId = req.body.projectId;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    // Check if user owns this project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', req.user.id)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    // Unique filename per upload (timestamp) so browsers/CDN never show a stale cached video
    const ext = req.file.originalname.substring(req.file.originalname.lastIndexOf('.'));
    const videoKey = `backgrounds/${req.user.id}/${projectId}-bg-video-${Date.now()}${ext}`;
    const videoUrl = await uploadToR2(req.file.buffer, videoKey, req.file.mimetype);
    console.log(`Background video uploaded for project ${projectId}: ${videoUrl}`);

    const { error: updateError } = await supabase
      .from('projects')
      .update({ bg_video_url: videoUrl, bg_type: 'video' })
      .eq('id', projectId);

    if (updateError) throw updateError;

    res.json({ success: true, videoUrl, message: 'Background video uploaded successfully' });
  } catch (error) {
    console.error('Background video upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload start image / intro overlay for a specific project (Studio tier feature)
app.post('/api/upload-start-image', authMiddleware, upload.single('startImage'), async (req, res) => {
  try {
    const projectId = req.body.projectId;
    
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    // Check if user owns this project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', req.user.id)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // V15: All features available to everyone - no tier check needed

    if (!req.file) {
      return res.status(400).json({ error: 'No start image file provided' });
    }

    // Upload start image to R2
    // Unique filename per upload (timestamp) so browsers/CDN never show a stale cached image
    const startExt = req.file.originalname.substring(req.file.originalname.lastIndexOf('.'));
    const imageKey = `start-images/${req.user.id}/${projectId}-start-${Date.now()}${startExt}`;
    const imageUrl = await uploadToR2(req.file.buffer, imageKey, req.file.mimetype);
    console.log(`Start image uploaded for project ${projectId}: ${imageUrl}`);

    // Save URL to project
    const { error: updateError } = await supabase
      .from('projects')
      .update({ start_image_url: imageUrl })
      .eq('id', projectId);

    if (updateError) throw updateError;

    res.json({ 
      success: true, 
      startImageUrl: imageUrl,
      message: 'Start image uploaded successfully' 
    });
  } catch (error) {
    console.error('Start image upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload a customer-supplied clean instrumental (e.g. exported from Suno).
// At render time it replaces the AI-separated instrumental as the audio bed.
app.post('/api/upload-custom-instrumental', authMiddleware, upload.single('instrumental'), async (req, res) => {
  try {
    const projectId = req.body.projectId;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    // Check if user owns this project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', req.user.id)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No instrumental file provided' });
    }

    if (!req.file.mimetype || !req.file.mimetype.startsWith('audio/')) {
      return res.status(400).json({ error: 'Instrumental must be an audio file' });
    }

    // If replacing an existing custom instrumental, delete the old R2 object (fire and forget)
    if (project.custom_instrumental_url) {
      const oldKey = extractR2Key(project.custom_instrumental_url);
      if (oldKey) {
        r2Client.send(new DeleteObjectCommand({
          Bucket: process.env.CLOUDFLARE_R2_BUCKET,
          Key: oldKey,
        })).catch(e => console.log(`Could not delete old custom instrumental ${oldKey}:`, e.message));
      }
    }

    // Upload to R2 (unique key per upload so caches never serve a stale file)
    const ext = req.file.originalname.substring(req.file.originalname.lastIndexOf('.'));
    const key = `custom-instrumentals/${req.user.id}/${projectId}-instrumental-${Date.now()}${ext}`;
    const url = await uploadToR2(req.file.buffer, key, req.file.mimetype);
    console.log(`Custom instrumental uploaded for project ${projectId}: ${url}`);

    // Save URL + original filename to project
    const { error: updateError } = await supabase
      .from('projects')
      .update({
        custom_instrumental_url: url,
        custom_instrumental_name: req.file.originalname,
      })
      .eq('id', projectId);

    if (updateError) throw updateError;

    res.json({
      success: true,
      customInstrumentalUrl: url,
      customInstrumentalName: req.file.originalname,
    });
  } catch (error) {
    console.error('Custom instrumental upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Remove a project's custom instrumental (revert to the AI-separated bed)
app.post('/api/remove-custom-instrumental', authMiddleware, async (req, res) => {
  try {
    const projectId = req.body.projectId;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    // Check if user owns this project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', req.user.id)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Best-effort delete of the R2 object - don't fail the request if it throws
    if (project.custom_instrumental_url) {
      try {
        const oldKey = extractR2Key(project.custom_instrumental_url);
        if (oldKey) {
          r2Client.send(new DeleteObjectCommand({
            Bucket: process.env.CLOUDFLARE_R2_BUCKET,
            Key: oldKey,
          })).catch(e => console.log(`Could not delete custom instrumental ${oldKey}:`, e.message));
        }
      } catch (e) {
        console.log('Error deleting custom instrumental from R2:', e.message);
      }
    }

    const { error: updateError } = await supabase
      .from('projects')
      .update({
        custom_instrumental_url: null,
        custom_instrumental_name: null,
      })
      .eq('id', projectId);

    if (updateError) throw updateError;

    res.json({ success: true });
  } catch (error) {
    console.error('Remove custom instrumental error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload custom font for a specific project
app.post('/api/upload-font', authMiddleware, upload.single('font'), async (req, res) => {
  try {
    const projectId = req.body.projectId;
    
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    // Check if user owns this project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', req.user.id)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No font file provided' });
    }

    // Validate font file type
    const validExtensions = ['.ttf', '.otf', '.woff', '.woff2'];
    const ext = req.file.originalname.toLowerCase().substring(req.file.originalname.lastIndexOf('.'));
    if (!validExtensions.includes(ext)) {
      return res.status(400).json({ error: 'Invalid font file type. Please upload a .ttf, .otf, .woff, or .woff2 file' });
    }

    // Determine content type
    const contentTypes = {
      '.ttf': 'font/ttf',
      '.otf': 'font/otf',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2'
    };
    const contentType = contentTypes[ext] || 'application/octet-stream';

    // Upload font to R2
    // Unique filename per upload (timestamp) so browsers/CDN never serve a stale cached font
    const fontKey = `fonts/${req.user.id}/${projectId}-font-${Date.now()}${ext}`;
    const fontUrl = await uploadToR2(req.file.buffer, fontKey, contentType);
    console.log(`Font uploaded for project ${projectId}: ${fontUrl}`);

    // Save URL to project
    const fontName = req.file.originalname.replace(/\.[^/.]+$/, '');
    const { error: updateError } = await supabase
      .from('projects')
      .update({ 
        custom_font_url: fontUrl,
        custom_font_name: fontName
      })
      .eq('id', projectId);

    if (updateError) throw updateError;

    res.json({ 
      success: true, 
      fontUrl: fontUrl,
      fontName: fontName,
      message: 'Font uploaded successfully' 
    });
  } catch (error) {
    console.error('Font upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// AI BACKGROUND IMAGE GENERATION
// ============================================

const AI_BG_CREDIT_COST = 3; // 3 credit per AI-generated background

app.post('/api/generate-ai-background', authMiddleware, async (req, res) => {
  try {
    const { projectId, prompt } = req.body;

    if (!projectId || !prompt) {
      return res.status(400).json({ error: 'Project ID and prompt are required' });
    }

    if (prompt.length < 10) {
      return res.status(400).json({ error: 'Please provide a more detailed description (at least 10 characters)' });
    }

    if (prompt.length > 1000) {
      return res.status(400).json({ error: 'Description is too long (max 1000 characters)' });
    }

    // Check if user owns this project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', req.user.id)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check user has enough credits
    const { data: profile } = await supabase
      .from('profiles')
      .select('credits_remaining')
      .eq('id', req.user.id)
      .single();

    if (!profile || (profile.credits_remaining || 0) < AI_BG_CREDIT_COST) {
      return res.status(402).json({ 
        error: 'Insufficient credits', 
        required: AI_BG_CREDIT_COST,
        available: profile?.credits_remaining || 0 
      });
    }

    console.log(`AI Background generation requested for project ${projectId} by user ${req.user.id}`);
    console.log(`Prompt: ${prompt.substring(0, 100)}...`);

    // Generate image with OpenAI
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: `Create a visually stunning full-bleed background image for a karaoke music video. The image must fill the entire frame edge-to-edge with no borders, margins, bars, or empty space on any side. The image should be atmospheric, cinematic, and suitable as a background behind scrolling lyrics text. Style: ${prompt}. Important: Do NOT include any text, words, letters, or numbers in the image. The artwork must extend fully to all edges with no padding or framing.`,
      n: 1,
      size: '1792x1024', // Wide format for 16:9 video
      quality: 'standard',
    });

    const imageUrl = response.data[0]?.url;
    if (!imageUrl) {
      throw new Error('No image generated from AI');
    }

    // Download the image from OpenAI (temporary URL)
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(imageResponse.data);

    // Upload to R2 for permanent storage
    const imageKey = `backgrounds/${req.user.id}/${projectId}-ai-bg-${Date.now()}.png`;
    const permanentUrl = await uploadToR2(imageBuffer, imageKey, 'image/png');
    console.log(`AI background uploaded to R2: ${permanentUrl}`);

    // Deduct credits
    await deductCredits(req.user.id, AI_BG_CREDIT_COST, projectId, 'AI Background Image Generation');

    // Update project with the new background
    const { error: updateError } = await supabase
      .from('projects')
      .update({ bg_image_url: permanentUrl })
      .eq('id', projectId);

    if (updateError) {
      console.error('Failed to update project bg_image_url:', updateError);
    }

    // Get updated credit balance
    const { data: updatedProfile } = await supabase
      .from('profiles')
      .select('credits_remaining')
      .eq('id', req.user.id)
      .single();

      // Save AI image to gallery for reuse
    try {
      await supabase.from('ai_generated_images').insert({
        user_id: req.user.id,
        project_id: projectId,
        image_url: permanentUrl,
        prompt: prompt,
      });
    } catch (galleryErr) {
      console.error('Failed to save AI image to gallery:', galleryErr);
    }

    res.json({
      success: true,
      imageUrl: permanentUrl,
      creditsUsed: AI_BG_CREDIT_COST,
      creditsRemaining: updatedProfile?.credits_remaining || 0,
      message: 'AI background generated successfully'
    });

  } catch (error) {
    console.error('AI background generation error:', error);
    
    // Handle specific OpenAI errors
    if (error?.status === 400 || error?.code === 'content_policy_violation') {
      return res.status(400).json({ 
        error: 'Your description was flagged by our content policy. Please try a different description.' 
      });
    }
    
    res.status(500).json({ error: error.message || 'Failed to generate AI background' });
  }
});

// GET /api/ai-images - Fetch user's AI generated image gallery
app.get('/api/ai-images', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ai_generated_images')
      .select('id, image_url, prompt, created_at, project_id')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json({ images: data || [] });
  } catch (err) {
    console.error('Failed to fetch AI images:', err);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

// Get render history for a project
app.get('/api/projects/:id/renders', authMiddleware, async (req, res) => {
  try {
    const projectId = req.params.id;

    // Verify project belongs to user
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', req.user.id)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Fetch all renders for this project, newest first
    const { data: renders, error: renderError } = await supabase
      .from('project_renders')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (renderError) {
      console.error('Error fetching renders:', renderError);
      return res.status(500).json({ error: 'Failed to fetch render history' });
    }

    // Generate signed download URLs and check expiration for each render
    const rendersWithUrls = await Promise.all((renders || []).map(async (render) => {
      const isExpired = new Date(render.expires_at) < new Date();
      let downloadUrl = null;

      if (!isExpired && render.video_url) {
        try {
          downloadUrl = await getSignedDownloadUrl(render.video_url, `render-v${render.render_number}.mp4`);
        } catch (e) {
          console.error('Failed to generate signed URL for render:', e);
        }
      }

      return {
        id: render.id,
        video_url: render.video_url,
        video_quality: render.video_quality,
        render_number: render.render_number,
        created_at: render.created_at,
        expires_at: render.expires_at,
        download_url: downloadUrl,
        is_expired: isExpired,
        settings_snapshot: render.settings_snapshot || {},
      };
    }));

    res.json({
      project_id: projectId,
      renders: rendersWithUrls,
      total: rendersWithUrls.length,
    });

  } catch (error) {
    console.error('Render history error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Retry a failed project
app.post('/api/projects/:id/retry', authMiddleware, async (req, res) => {
  try {
    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.status !== 'failed') {
      return res.status(400).json({ error: 'Only failed projects can be retried' });
    }

    // Update status to processing
    await supabase
      .from('projects')
      .update({
        status: 'processing',
        error_message: null,
        processing_started_at: new Date().toISOString()
      })
      .eq('id', project.id);

    // Get user's subscription tier
    const userProfile = await getUserProfile(req.user.id);

    // Resubmit to RunPod
    const runpodJobId = await sendToRunPod(project.id, project.original_file_url, {
      processing_type: project.processing_type,
      include_lyrics: project.include_lyrics,
      video_quality: project.video_quality,
      thumbnail_url: project.thumbnail_url,
      artist_name: project.artist_name,
      song_title: project.song_title,
      track_number: project.track_number,
      lyrics_text: project.lyrics_text,
      display_mode: project.display_mode || 'auto',
      clean_version: project.clean_version || false,
      // Layout
      aspect_ratio: project.aspect_ratio || '16:9',
      // Style
      bg_color_1: project.bg_color_1,
      bg_color_2: project.bg_color_2,
      use_gradient: project.use_gradient,
      gradient_direction: project.gradient_direction,
      text_color: project.text_color,
      outline_color: project.outline_color,
      sung_color: project.sung_color,
      font: project.font,
      font_size: project.font_size || 'normal',
      processing_mode: 'full',
      subscription_tier: userProfile.subscription_tier || 'free',
      // Studio branding - Logo settings
      logo_url: project.logo_url || null,
      logo_position: project.logo_position || 'bottom-right',
      logo_size: project.logo_size || 50,
      logo_opacity: project.logo_opacity || 80,
      custom_watermark_url: project.custom_watermark_url || project.logo_url || null,
      outro_text: project.outro_text || null,
      outro_duration: project.outro_duration || 10,
      outro_font_size: project.outro_font_size || 'normal',
      // Video background
      bg_type: project.bg_type || 'gradient',
      bg_video_preset: project.bg_video_preset_filename || null,
      bg_video_url: project.bg_video_url || null,
      bg_image_url: project.bg_image_url || null,
      bg_image_fit: project.bg_image_fit || 'fill',
      bg_image_opacity: project.bg_image_opacity ?? 100,
      bg_image_overlay_color: project.bg_image_overlay_color || '#000000',
      bg_image_overlay_type: project.bg_image_overlay_type || 'none',
      bg_vignette_strength: project.bg_vignette_strength ?? 0,
    });

    await supabase
      .from('projects')
      .update({ runpod_job_id: runpodJobId })
      .eq('id', project.id);

    res.json({
      success: true,
      message: 'Project resubmitted',

      runpod_job_id: runpodJobId
    });

  } catch (error) {
    console.error('Retry error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/projects/:id/download', authMiddleware, async (req, res) => {
  try {
    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.status !== 'completed') {
      return res.status(400).json({ error: 'Project not ready for download' });
    }

    // Build filename from project metadata: "KT-01 - Artist Name - Song Title"
    const baseFilename = `${project.track_number || 'KT-01'} - ${project.artist_name || 'Unknown Artist'} - ${project.song_title || 'Untitled'}`;
    // Sanitize filename (remove invalid characters)
    const sanitizedFilename = baseFilename.replace(/[<>:"/\\|?*]/g, '');

    const urls = {
      video: project.video_url ? await getSignedDownloadUrl(project.video_url, `${sanitizedFilename}.mp4`) : null,
      processed_audio: project.processed_audio_url ? await getSignedDownloadUrl(project.processed_audio_url, `${sanitizedFilename} - Instrumental.wav`) : null,
      vocals: project.vocals_audio_url ? await getSignedDownloadUrl(project.vocals_audio_url, `${sanitizedFilename} - Vocals.wav`) : null,
    };

    res.json(urls);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// LYRICS REVIEW & EDIT ENDPOINTS (Pro/Studio Feature)
// ============================================

// Get lyrics for review/editing
app.get('/api/projects/:id/lyrics', authMiddleware, async (req, res) => {
  try {
    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if lyrics are available
    if (!project.lyrics_json) {
      return res.status(400).json({ error: 'Lyrics not yet available. Project may still be processing.' });
    }

    res.json({
      project_id: project.id,
      title: project.title,
      artist_name: project.artist_name,
      song_title: project.song_title,
      status: project.status,
      lyrics: project.lyrics_json,
      original_lyrics: project.lyrics_text || '', // User's pasted lyrics for comparison
      processed_audio_url: project.processed_audio_url,
      vocals_audio_url: project.vocals_audio_url,
    });
  } catch (error) {
    console.error('Get lyrics error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Submit edited lyrics and start video rendering
app.post('/api/projects/:id/render', authMiddleware, async (req, res) => {
  try {
    const { edited_lyrics } = req.body;

    if (!edited_lyrics || !Array.isArray(edited_lyrics)) {
      return res.status(400).json({ error: 'edited_lyrics array is required' });
    }

    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if project is in a state where we can render
    // Allow: awaiting_review, transcribed, AND completed (for re-renders)
    if (!['awaiting_review', 'transcribed', 'completed'].includes(project.status)) {
      return res.status(400).json({
        error: `Cannot render project with status: ${project.status}. Project must be awaiting review or completed.`
      });
    }

    // Check if processed audio exists
    if (!project.processed_audio_url) {
      return res.status(400).json({ error: 'Processed audio not available. Please re-upload the track.' });
    }

    // Credits are charged here at render time (that's when we know the chosen
    // resolution and Queue/Instant mode). First render pays the full per-track
    // cost; re-rendering a completed project costs ~50%.
    const exportMode = String(req.body.export_mode || 'queue').toLowerCase();

    // V20: Key / speed adjustments from the editor, clamped server-side.
    // Falls back to the last values saved on the project, then to neutral.
    let pitchSemitones = parseInt(req.body.pitch_semitones, 10);
    if (isNaN(pitchSemitones)) pitchSemitones = project.pitch_semitones || 0;
    pitchSemitones = Math.max(-6, Math.min(6, pitchSemitones));

    let speedRate = parseFloat(req.body.speed_rate);
    if (isNaN(speedRate)) speedRate = project.speed_rate || 1.0;
    speedRate = Math.max(0.75, Math.min(1.25, Math.round(speedRate * 100) / 100));

    const isReRender = project.status === 'completed';
    const fullCost = calculateCreditsNeeded({
      video_quality: project.video_quality,
      export_mode: exportMode,
    });
    // V21: Outro dedication surcharge - flat +5 credits whenever the project
    // has dedication text (extra footage is rendered after the track ends).
    // Charged in full on re-renders too, since the extra GPU time recurs.
    const hasOutro = !!(project.outro_text && String(project.outro_text).trim());
    const outroCost = hasOutro ? OUTRO_CREDIT_COST : 0;
    const renderCost = (isReRender ? Math.max(1, Math.ceil(fullCost / 2)) : fullCost) + outroCost;
    const hasCredits = await checkCredits(req.user.id, renderCost);
    if (!hasCredits) {
      return res.status(402).json({
        error: isReRender ? 'Insufficient credits for re-render' : 'Insufficient credits to export',
        credits_needed: renderCost,
      });
    }

    // Update project with edited lyrics
    await supabase
      .from('projects')
      .update({
        edited_lyrics_json: edited_lyrics,
        status: 'rendering',
        render_started_at: new Date().toISOString(),
      })
      .eq('id', project.id);

    // V20: Persist chosen key/speed as a separate best-effort update so a
    // missing column (migration not yet run) can never block the render itself.
    const { error: pitchSaveError } = await supabase
      .from('projects')
      .update({ pitch_semitones: pitchSemitones, speed_rate: speedRate })
      .eq('id', project.id);
    if (pitchSaveError) {
      console.error('Could not persist pitch/speed (run the V20 migration?):', pitchSaveError.message);
    }

    // NEW: Get user's subscription tier for watermark logic
    const userProfile = await getUserProfile(req.user.id);

    // Send to RunPod in render_only mode
    const runpodJobId = await sendToRunPod(project.id, project.original_file_url, {
      processing_mode: 'render_only',
      processing_type: project.processing_type,
      include_lyrics: true,
      video_quality: project.video_quality,
      thumbnail_url: project.thumbnail_url,
      artist_name: project.artist_name,
      song_title: project.song_title,
      track_number: project.track_number,
      display_mode: project.display_mode || 'auto',
      clean_version: project.clean_version || false,
      
      // Layout options (V12)
      aspect_ratio: project.aspect_ratio || '16:9',
      lines_per_scroll: project.lines_per_scroll || 5,
      lines_per_page: project.lines_per_page || 4,
      lines_per_overwrite: project.lines_per_overwrite || 4,
      emphasize_current_line: project.emphasize_current_line || false,
      show_progress_bar: project.show_progress_bar !== false,
      show_countdown: project.show_countdown !== false,
      show_lead_in_bars: project.show_lead_in_bars !== false,
      
      // Style options
      bg_color_1: project.bg_color_1 || '#1a1a2e',
      bg_color_2: project.bg_color_2 || '#16213e',
      use_gradient: project.use_gradient !== false,
      gradient_direction: project.gradient_direction || 'to bottom',
      text_color: project.text_color || '#ffffff',
      outline_color: project.outline_color || '#000000',
      sung_color: project.sung_color || '#F4E409',
      font: project.font || 'arial',
      font_size: project.font_size || 'normal',
      // Custom font
      custom_font_url: project.custom_font_url || null,
      custom_font_name: project.custom_font_name || null,
      // Render-only specific
      processed_audio_url: project.processed_audio_url,
      vocals_audio_url: project.vocals_audio_url,
      edited_lyrics: edited_lyrics,
      // V20: Key / speed adjustments
      pitch_semitones: pitchSemitones,
      speed_rate: speedRate,
      // Audio track the user chose in the editor: 'instrumental' | 'guide' | 'original'
      audio_track: project.audio_track || 'instrumental',
      // Customer-supplied clean instrumental (optional)
      custom_instrumental_url: project.custom_instrumental_url || null,
      // Subscription tier (logging) + purchase flag for watermark logic
      subscription_tier: userProfile.subscription_tier || 'free',
      has_ever_paid: userProfile.has_ever_paid || false,
      // Branding - Logo settings (with size, position, opacity)
      logo_url: project.logo_url || null,
      logo_position: project.logo_position || 'bottom-right',
      logo_size: project.logo_size || 50,
      logo_opacity: project.logo_opacity || 80,
      // Legacy custom watermark (kept for backward compatibility)
      custom_watermark_url: project.custom_watermark_url || project.logo_url || null,
      
      // Intro/Start image settings (V12)
      start_image_url: project.start_image_url || null,
      start_image_fit: project.start_image_fit || 'fill',
      start_image_opacity: project.start_image_opacity || 100,
      start_image_show_title: project.start_image_show_title !== false,
      
      // Outro settings
      outro_text: project.outro_text || null,
      outro_duration: project.outro_duration || 3,
      outro_font_size: project.outro_font_size || 'normal',
      
      // Video background options
      bg_type: project.bg_type || 'gradient',
      bg_video_preset: project.bg_video_preset_filename || null,
      bg_video_url: project.bg_video_url || null,
      bg_image_url: project.bg_image_url || null,
      bg_image_fit: project.bg_image_fit || 'fill',
      bg_image_opacity: project.bg_image_opacity ?? 100,
      bg_image_overlay_color: project.bg_image_overlay_color || '#000000',
      bg_image_overlay_type: project.bg_image_overlay_type || 'none',
      bg_vignette_strength: project.bg_vignette_strength ?? 0,
    });

    await supabase
      .from('projects')
      .update({
        runpod_job_id: runpodJobId,
      })
      .eq('id', project.id);

    // Charge for this render now that the job is safely enqueued, and record the
    // amount on the project so a failed render can be refunded correctly.
    if (renderCost > 0) {
      try {
        await deductCredits(
          req.user.id,
          renderCost,
          project.id,
          (isReRender
            ? `Re-render (50%): ${project.song_title || project.title || 'project'}`
            : `Export ${project.video_quality || '720p'} ${exportMode}: ${project.song_title || project.title || 'project'}`)
          + (outroCost > 0 ? ` (+${outroCost} outro dedication)` : '')
        );
        await supabase.from('projects').update({ credits_used: renderCost }).eq('id', project.id);
      } catch (deductErr) {
        console.error('Failed to deduct render credits:', deductErr.message);
      }
    }

    res.json({
      message: 'Rendering started',
      project_id: project.id,
      runpod_job_id: runpodJobId,
      credits_used: renderCost,
    });

  } catch (error) {
    console.error('Render error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start transcription only (for Pro/Studio users who want to review)
app.post('/api/projects/:id/transcribe', authMiddleware, async (req, res) => {
  try {
    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if project is in a state where we can start transcription
    if (project.status !== 'queued') {
      return res.status(400).json({
        error: `Cannot transcribe project with status: ${project.status}`
      });
    }

    // Update status to transcribing
    await supabase
      .from('projects')
      .update({
        status: 'transcribing',
        processing_started_at: new Date().toISOString(),
      })
      .eq('id', project.id);

    // Send to RunPod in transcribe_only mode
    const runpodJobId = await sendToRunPod(project.id, project.original_file_url, {
      processing_mode: 'transcribe_only',
      processing_type: project.processing_type,
      include_lyrics: true,
      video_quality: project.video_quality,
      artist_name: project.artist_name,
      song_title: project.song_title,
      track_number: project.track_number,
      lyrics_text: project.lyrics_text,
      display_mode: project.display_mode || 'auto',
      clean_version: project.clean_version || false,
    });

    await supabase
      .from('projects')
      .update({
        runpod_job_id: runpodJobId,
      })
      .eq('id', project.id);

    res.json({
      message: 'Transcription started',
      project_id: project.id,
      runpod_job_id: runpodJobId,
    });

  } catch (error) {
    console.error('Transcribe error:', error);
    res.status(500).json({ error: error.message });
  }
});

// STRIPE PAYMENTS
app.get('/api/plans', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true);
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Plans fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// V15: Upgrade discounts are built into subscription pricing now
app.get('/api/stripe/upgrade-discount', authMiddleware, async (req, res) => {
  try {
    const profile = await getUserProfile(req.user.id);

    // V15: No more tier-based upgrade discounts - savings are built into subscription vs PAYG pricing
    res.json({
      has_discount: false,
      discount_percent: 0,
      current_credits_per_month: profile.subscription_credits_per_month || 0,
      message: 'Savings are built into subscription pricing - subscriptions save 50-75% vs pay-as-you-go!'
    });
  } catch (error) {
    console.error('Upgrade discount check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// V15: Credit-based subscription checkout
// Accepts credits_per_month and billing_cycle instead of price_id
app.post('/api/stripe/create-checkout', authMiddleware, async (req, res) => {
  try {
    const { credits_per_month, billing_cycle } = req.body;
    
    // Validate input
    if (!credits_per_month || !billing_cycle) {
      return res.status(400).json({ error: 'Missing credits_per_month or billing_cycle' });
    }
    
    const validCredits = [30, 60, 120, 240, 400];
    if (!validCredits.includes(credits_per_month)) {
      return res.status(400).json({ error: 'Invalid credits_per_month value' });
    }
    
    if (!['monthly', 'annual'].includes(billing_cycle)) {
      return res.status(400).json({ error: 'Invalid billing_cycle. Must be "monthly" or "annual"' });
    }
    
    const profile = await getUserProfile(req.user.id);
    
    // Get or create Stripe customer
    let customerId = profile.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        metadata: { supabase_user_id: req.user.id },
      });
      customerId = customer.id;
      
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', req.user.id);
    }
    
    // Find the subscription plan
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('credits_per_month', credits_per_month)
      .eq('is_active', true)
      .single();
    
    if (planError || !plan) {
      return res.status(400).json({ error: 'Subscription plan not found' });
    }
    
    // Get the correct price ID based on billing cycle
    const priceId = billing_cycle === 'annual' 
      ? plan.stripe_annual_price_id 
      : plan.stripe_monthly_price_id;
    
    if (!priceId) {
      return res.status(400).json({ error: `No ${billing_cycle} price configured for this plan` });
    }
    
    console.log(`Creating checkout for ${credits_per_month} credits/mo, ${billing_cycle} billing`);
    console.log(`   Price ID: ${priceId}`);
    
    // If user has existing subscription, handle change
    if (profile.stripe_subscription_id) {
      try {
        const existingSubscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
        
        if (existingSubscription.status === 'active' || existingSubscription.status === 'trialing') {
          const subscriptionItemId = existingSubscription.items.data[0].id;
          const currentCredits = profile.subscription_credits_per_month || 0;
          
          if (credits_per_month > currentCredits) {
            // INCREASE: Update immediately with proration
            console.log(`   Increasing credits: ${currentCredits} -> ${credits_per_month}`);
            
            const updatedSubscription = await stripe.subscriptions.update(
              profile.stripe_subscription_id,
              {
                items: [{ id: subscriptionItemId, price: priceId }],
                proration_behavior: 'create_prorations',
                metadata: {
                  previous_credits: currentCredits,
                  new_credits: credits_per_month,
                  change_type: 'increase'
                }
              }
            );
            
            // Update profile - tier will be set by webhook based on price_id
            await supabase
              .from('profiles')
              .update({
                subscription_credits_per_month: credits_per_month,
                subscription_billing_cycle: billing_cycle,
                has_ever_paid: true
              })
              .eq('id', req.user.id);
            
            // Add bonus credits for the increase
            const bonusCredits = credits_per_month - currentCredits;
            await addCreditsWithExpiration(
              req.user.id,
              bonusCredits,
              'subscription_upgrade',
              `Subscription increased to ${credits_per_month} credits/mo (+${bonusCredits} bonus)`
            );
            
            return res.json({
              success: true,
              message: `Subscription updated to ${credits_per_month} credits/month! You've received ${bonusCredits} bonus credits.`,
              redirect: `${process.env.FRONTEND_URL}/dashboard?subscription_updated=true`
            });
            
          } else if (credits_per_month < currentCredits) {
            // DECREASE: Schedule for end of billing period
            console.log(`   Decreasing credits: ${currentCredits} -> ${credits_per_month} (scheduled)`);
            
            // Create or update subscription schedule
            let schedule;
            if (existingSubscription.schedule) {
              const existingSchedule = await stripe.subscriptionSchedules.retrieve(existingSubscription.schedule);
              schedule = await stripe.subscriptionSchedules.update(existingSubscription.schedule, {
                end_behavior: 'release',
                phases: [
                  {
                    items: [{ price: existingSubscription.items.data[0].price.id, quantity: 1 }],
                    start_date: existingSchedule.phases[0].start_date,
                    end_date: existingSubscription.current_period_end,
                  },
                  {
                    items: [{ price: priceId, quantity: 1 }],
                    start_date: existingSubscription.current_period_end,
                  }
                ],
                metadata: {
                  previous_credits: currentCredits,
                  new_credits: credits_per_month,
                  change_type: 'decrease'
                }
              });
            } else {
              schedule = await stripe.subscriptionSchedules.create({
                from_subscription: profile.stripe_subscription_id,
              });
              
              schedule = await stripe.subscriptionSchedules.update(schedule.id, {
                end_behavior: 'release',
                phases: [
                  {
                    items: [{ price: existingSubscription.items.data[0].price.id, quantity: 1 }],
                    start_date: schedule.phases[0].start_date,
                    end_date: existingSubscription.current_period_end,
                  },
                  {
                    items: [{ price: priceId, quantity: 1 }],
                    start_date: existingSubscription.current_period_end,
                  }
                ],
                metadata: {
                  previous_credits: currentCredits,
                  new_credits: credits_per_month,
                  change_type: 'decrease'
                }
              });
            }
            
            const periodEnd = new Date(existingSubscription.current_period_end * 1000);
            const formattedDate = periodEnd.toLocaleDateString('en-US', {
              month: 'long', day: 'numeric', year: 'numeric'
            });
            
            // Store scheduled change
            await supabase
              .from('profiles')
              .update({
                scheduled_tier: `sub-${credits_per_month}`,
                scheduled_tier_date: periodEnd.toISOString()
              })
              .eq('id', req.user.id);
            
            // Send confirmation email
            const userEmail = req.user.email;
            const userName = profile.full_name || userEmail.split('@')[0];
            sendDowngradeScheduledEmail(
              userEmail,
              userName,
              `${currentCredits} credits/mo`,
              `${credits_per_month} credits/mo`,
              periodEnd.toISOString()
            ).catch(err => console.error('Downgrade email error:', err));
            
            return res.json({
              success: true,
              message: `Your subscription will change to ${credits_per_month} credits/month on ${formattedDate}.`,
              redirect: `${process.env.FRONTEND_URL}/dashboard?change_scheduled=true`,
              effective_date: periodEnd.toISOString()
            });
          }
        }
      } catch (subError) {
        console.log(`   Could not process subscription change: ${subError.message}`);
        // Fall through to create new checkout session
      }
    }
    
    // No existing subscription - create new checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing`,
      metadata: {
        user_id: req.user.id,
        credits_per_month: credits_per_month,
        billing_cycle: billing_cycle
      },
    });
    
    res.json({ url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    res.status(500).json({ error: error.message });
  }
});

// V15: Credit pack purchase with configurable validity
app.post('/api/stripe/buy-credits', authMiddleware, async (req, res) => {
  try {
    const { package_id } = req.body;
    
    if (!package_id) {
      return res.status(400).json({ error: 'Missing package_id' });
    }

    const { data: pkg, error } = await supabase
      .from('credit_packages')
      .select('*')
      .eq('name', package_id)
      .single();

    if (error || !pkg) {
      return res.status(404).json({ error: 'Package not found' });
    }

    const profile = await getUserProfile(req.user.id);
    
    // Get or create Stripe customer
    let customerId = profile.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        metadata: { supabase_user_id: req.user.id },
      });
      customerId = customer.id;
      
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', req.user.id);
    }
    
    console.log(`Creating credit pack checkout: ${pkg.name} (${pkg.credits} credits, valid ${pkg.validity_days || 365} days)`);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: pkg.stripe_price_id, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/dashboard?credits_purchased=true`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing`,
      metadata: {
        user_id: req.user.id,
        package_id: package_id,
        credits: pkg.credits,
        validity_days: pkg.validity_days || 365,
        type: 'credit_purchase',
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Stripe buy-credits error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/stripe/portal', authMiddleware, async (req, res) => {
  try {
    const profile = await getUserProfile(req.user.id);

    if (!profile.stripe_customer_id) {
      return res.status(400).json({ error: 'No active subscription' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL}/dashboard`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Stripe portal error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get subscription status including scheduled changes
app.get('/api/stripe/subscription-status', authMiddleware, async (req, res) => {
  try {
    const profile = await getUserProfile(req.user.id);

    if (!profile.stripe_subscription_id) {
      return res.json({
        has_subscription: false,
        tier: profile.subscription_tier || 'free'
      });
    }

    const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);

    let scheduledChange = null;
    if (subscription.schedule) {
      const schedule = await stripe.subscriptionSchedules.retrieve(subscription.schedule);
      if (schedule.phases && schedule.phases.length > 1) {
        const nextPhase = schedule.phases[1];
        const nextPriceId = nextPhase.items[0].price;

        const { data: nextPlan } = await supabase
          .from('subscription_plans')
          .select('tier')
          .or(`stripe_monthly_price_id.eq.${nextPriceId},stripe_annual_price_id.eq.${nextPriceId}`)
          .single();

        if (nextPlan) {
          scheduledChange = {
            new_tier: nextPlan.tier,
            effective_date: new Date(nextPhase.start_date * 1000).toISOString()
          };
        }
      }
    }

    res.json({
      has_subscription: true,
      tier: profile.subscription_tier,
      status: subscription.status,
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      scheduled_change: scheduledChange
    });
  } catch (error) {
    console.error('Subscription status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cancel a scheduled downgrade
app.post('/api/stripe/cancel-scheduled-change', authMiddleware, async (req, res) => {
  try {
    const profile = await getUserProfile(req.user.id);

    if (!profile.stripe_subscription_id) {
      return res.status(400).json({ error: 'No active subscription' });
    }

    const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);

    if (!subscription.schedule) {
      return res.status(400).json({ error: 'No scheduled change to cancel' });
    }

    // Release the schedule, keeping the current subscription as-is
    await stripe.subscriptionSchedules.release(subscription.schedule);

    // Clear the scheduled tier from our database
    await supabase
      .from('profiles')
      .update({
        scheduled_tier: null,
        scheduled_tier_date: null
      })
      .eq('id', req.user.id);

    console.log(`Scheduled change cancelled for user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Scheduled plan change has been cancelled. You will stay on your current plan.'
    });
  } catch (error) {
    console.error('Cancel scheduled change error:', error);
    res.status(500).json({ error: error.message });
  }
});

// WEBHOOKS
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  console.log('Stripe webhook received');
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    console.log(`Webhook verified: ${event.type}`);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // Idempotency guard: Stripe retries events on any non-2xx response, and this
    // handler can add credits. Record each event id the first time we see it; if
    // it's already recorded, skip re-processing so credits are never added twice.
    const { error: idempotencyError } = await supabase
      .from('processed_stripe_events')
      .insert({ event_id: event.id, event_type: event.type });
    if (idempotencyError) {
      // 23505 = unique_violation -> we've already handled this event
      if (idempotencyError.code === '23505') {
        console.log(`Duplicate Stripe event ${event.id} ignored`);
        return res.json({ received: true, duplicate: true });
      }
      // Any other error (e.g. table missing): log and continue processing rather
      // than blocking legitimate events. Create the table to enable protection.
      console.error('Stripe idempotency check failed (processing anyway):', idempotencyError.message);
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;

        // V15: Handle credit pack purchases with configurable validity
        if (session.metadata.type === 'credit_purchase') {
          const credits = parseInt(session.metadata.credits);
          const validityDays = parseInt(session.metadata.validity_days) || 365;
          
          console.log(`Credit pack purchased: ${credits} credits (valid for ${validityDays} days)`);
          
          await addCreditsWithExpiration(
            session.metadata.user_id,
            credits,
            'purchase',
            `Purchased ${credits} credits pack`,
            validityDays
          );
          
          // Mark user as has_ever_paid (removes watermark)
          await supabase
            .from('profiles')
            .update({ has_ever_paid: true })
            .eq('id', session.metadata.user_id);
        }

        // V15: Handle new subscription signup with credit-based model
        if (session.mode === 'subscription' && session.subscription) {
          console.log(`Subscription checkout completed for user: ${session.metadata.user_id}`);

          // Get the subscription to find the price/plan
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          const priceId = subscription.items.data[0].price.id;

          // V15: Find plan by price ID (checks both monthly and annual columns)
          const { data: planResult } = await supabase.rpc('get_plan_by_price_id', { p_price_id: priceId });

          if (planResult && planResult.length > 0) {
            const plan = planResult[0];
            console.log(`   Plan found: ${plan.tier} - ${plan.credits_per_month} credits/mo, ${plan.billing_cycle}`);

            // Add initial subscription credits (90 day expiration)
            await addCreditsWithExpiration(
              session.metadata.user_id,
              plan.credits_per_month,
              'subscription',
              `${plan.name} subscription - ${plan.credits_per_month} monthly credits`,
              90
            );

            // Update profile with new credit-based fields
            // Use tier from database (starter, basic, pro, plus, studio)
            await supabase
              .from('profiles')
              .update({
                subscription_credits_per_month: plan.credits_per_month,
                subscription_billing_cycle: plan.billing_cycle,
                subscription_tier: plan.tier,
                stripe_subscription_id: subscription.id,
                has_ever_paid: true
              })
              .eq('id', session.metadata.user_id);

            // Update subscriptions table
            await supabase
              .from('subscriptions')
              .upsert({
                user_id: session.metadata.user_id,
                stripe_subscription_id: subscription.id,
                stripe_price_id: priceId,
                tier: plan.tier,
                status: subscription.status
              }, { onConflict: 'user_id' });
          } else {
            console.log('   No plan found for price ID:', priceId);
          }
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        console.log(`Subscription ${event.type} for customer: ${customerId}`);

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, subscription_credits_per_month')
          .eq('stripe_customer_id', customerId)
          .single();

        if (profileError) {
          console.error('Error finding profile by stripe_customer_id:', profileError);
          console.log('   Looking for customer ID:', customerId);
        }

        if (profile) {
          console.log(`Found profile: ${profile.id}`);
          const priceId = subscription.items.data[0].price.id;
          console.log(`   Price ID from subscription: ${priceId}`);

          // V15: Find plan by price ID (checks both monthly and annual columns)
          const { data: planResult } = await supabase.rpc('get_plan_by_price_id', { p_price_id: priceId });

          if (planResult && planResult.length > 0) {
            const plan = planResult[0];
            console.log(`   Plan: ${plan.tier} - ${plan.credits_per_month} credits/mo, ${plan.billing_cycle}`);

            const { error: updateError } = await supabase
              .from('profiles')
              .update({
                subscription_tier: plan.tier,
                subscription_credits_per_month: plan.credits_per_month,
                subscription_billing_cycle: plan.billing_cycle,
                stripe_subscription_id: subscription.id,
                has_ever_paid: true,
              })
              .eq('id', profile.id);

            if (updateError) {
              console.error('Error updating profile:', updateError);
            } else {
              console.log(`   Profile updated: ${plan.tier} (${plan.credits_per_month} credits/mo)`);
            }

            // Update subscriptions table
            const { error: subError } = await supabase
              .from('subscriptions')
              .upsert({
                user_id: profile.id,
                stripe_subscription_id: subscription.id,
                stripe_price_id: priceId,
                tier: plan.tier,
                status: subscription.status
              }, { onConflict: 'user_id' });

            if (subError) {
              console.error('Error upserting subscription record:', subError);
            } else {
              console.log(`   Subscription record created/updated in subscriptions table`);
            }
          } else {
            console.log('   No plan found for price ID:', priceId);
          }
        } else {
          console.log('No profile found for customer ID:', customerId);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        console.log(`Subscription deleted for customer: ${subscription.customer}`);

        // V15: Reset to free but keep has_ever_paid status
        await supabase
          .from('profiles')
          .update({
            subscription_tier: 'free',
            subscription_credits_per_month: 0,
            subscription_billing_cycle: 'none',
            stripe_subscription_id: null,
            scheduled_tier: null,
            scheduled_tier_date: null,
            // Note: has_ever_paid stays true - they keep their "paid user" status for watermark
          })
          .eq('stripe_customer_id', subscription.customer);

        // Also delete from subscriptions table
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', subscription.customer)
          .single();

        if (profile) {
          await supabase
            .from('subscriptions')
            .delete()
            .eq('user_id', profile.id);
          console.log(`   Subscription record deleted from subscriptions table`);
        }
        break;
      }

      // Handle subscription schedule updates (for scheduled downgrades)
      case 'subscription_schedule.updated':
      case 'subscription_schedule.completed': {
        const schedule = event.data.object;
        console.log(`Subscription schedule ${event.type}: ${schedule.id}`);

        // When a schedule completes, the subscription has moved to the next phase
        // Update the user's tier to match the new plan
        if (event.type === 'subscription_schedule.completed' && schedule.subscription) {
          try {
            const subscription = await stripe.subscriptions.retrieve(schedule.subscription);
            const customerId = subscription.customer;
            const priceId = subscription.items.data[0].price.id;

            const { data: profile } = await supabase
              .from('profiles')
              .select('id')
              .eq('stripe_customer_id', customerId)
              .single();

            if (profile) {
              const { data: plan } = await supabase
                .from('subscription_plans')
                .select('tier, credits_per_month')
                .or(`stripe_monthly_price_id.eq.${priceId},stripe_annual_price_id.eq.${priceId}`)
                .single();

              if (plan) {
                console.log(`   Schedule completed - updating tier to ${plan.tier}`);

                await supabase
                  .from('profiles')
                  .update({
                    subscription_tier: plan.tier,
                    scheduled_tier: null,
                    scheduled_tier_date: null,
                  })
                  .eq('id', profile.id);

                await supabase
                  .from('subscriptions')
                  .upsert({
                    user_id: profile.id,
                    stripe_subscription_id: subscription.id,
                    stripe_price_id: priceId,
                    tier: plan.tier,
                    status: subscription.status
                  }, { onConflict: 'user_id' });

                console.log(`   User ${profile.id} downgraded to ${plan.tier}`);
              }
            }
          } catch (scheduleError) {
            console.error('   Error processing schedule completion:', scheduleError);
          }
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object;
        
        // V15: Handle subscription renewal with credit-based model
        if (invoice.billing_reason === 'subscription_cycle') {
          console.log(`Subscription renewal invoice paid: ${invoice.id}`);
          
          // Get the subscription to find the price
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
          const priceId = subscription.items.data[0].price.id;
          
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, subscription_credits_per_month')
            .eq('stripe_customer_id', invoice.customer)
            .single();

          if (profile) {
            // V15: Find plan by price ID to get credits_per_month
            const { data: planResult } = await supabase.rpc('get_plan_by_price_id', { p_price_id: priceId });
            
            const creditsToAdd = planResult && planResult.length > 0 
              ? planResult[0].credits_per_month 
              : profile.subscription_credits_per_month;

            if (creditsToAdd > 0) {
              console.log(`   Adding ${creditsToAdd} renewal credits`);
              await addCreditsWithExpiration(
                profile.id,
                creditsToAdd,
                'subscription',
                `Monthly renewal - ${creditsToAdd} credits`,
                90  // Subscription credits expire in 90 days
              );

              await supabase
                .from('profiles')
                .update({ credits_used_this_month: 0 })
                .eq('id', profile.id);
            }
          }
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// RunPod webhook with email notifications
app.post('/api/webhooks/runpod', express.json(), async (req, res) => {
  try {
    // Security: verify the shared secret when one is configured.
    // The backend embeds this secret in callback_url, so the RunPod worker
    // echoes it back automatically. Set RUNPOD_WEBHOOK_SECRET in Railway to enforce.
    if (process.env.RUNPOD_WEBHOOK_SECRET) {
      if (req.query.secret !== process.env.RUNPOD_WEBHOOK_SECRET) {
        console.warn('Rejected RunPod webhook: invalid or missing secret');
        return res.status(401).json({ error: 'Unauthorized' });
      }
    } else {
      console.warn('RUNPOD_WEBHOOK_SECRET is not set - webhook is UNAUTHENTICATED. Set it in Railway to secure this endpoint.');
    }

    const { project_id, status, results, error: processingError } = req.body;

    // Fetch the project to get notify preference
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', project_id)
      .single();

    // Handle transcription completed (two-stage processing)
    if (status === 'transcribed' && results) {
      console.log(`Project ${project_id} transcription complete - awaiting review`);

      const { data: updateData, error: updateError } = await supabase
        .from('projects')
        .update({
          status: 'awaiting_review',
          processed_audio_url: results.processed_audio_url,
          vocals_audio_url: results.vocals_audio_url,
          waveform_url: results.waveform_url,
          lyrics_json: results.lyrics,
          transcription_completed_at: new Date().toISOString(),
        })
        .eq('id', project_id)
        .select();

      if (updateError) {
        console.error('Failed to update project status:', updateError);
      } else {
        console.log('Project status updated to awaiting_review:', updateData);
      }

      // Don't send email - user needs to review lyrics first

    } else if (status === 'completed' && results) {
      const { data: updateData, error: updateError } = await supabase
        .from('projects')
        .update({
          status: 'completed',
          processed_audio_url: results.processed_audio_url || project?.processed_audio_url,
          vocals_audio_url: results.vocals_audio_url || project?.vocals_audio_url,
          waveform_url: results.waveform_url || project?.waveform_url,
          lyrics_json: results.lyrics || project?.lyrics_json,
          video_url: results.video_url,
          processing_completed_at: new Date().toISOString(),
        })
        .eq('id', project_id)
        .select();

      if (updateError) {
        console.error('Failed to update project status:', updateError);
      } else {
        console.log('Project status updated to completed:', updateData);
      }

      // Save this render to project_renders history table
      if (results.video_url) {
        try {
          // Get the next render number for this project
          const { data: existingRenders } = await supabase
            .from('project_renders')
            .select('render_number')
            .eq('project_id', project_id)
            .order('render_number', { ascending: false })
            .limit(1);

          const nextRenderNumber = (existingRenders && existingRenders.length > 0)
            ? existingRenders[0].render_number + 1
            : 1;

          await supabase
            .from('project_renders')
            .insert({
              project_id: project_id,
              user_id: project.user_id,
              video_url: results.video_url,
              video_quality: project.video_quality || '720p',
              render_number: nextRenderNumber,
              settings_snapshot: {
                font: project.font,
                text_color: project.text_color,
                sung_color: project.sung_color,
                bg_type: project.bg_type,
                aspect_ratio: project.aspect_ratio,
                display_mode: project.display_mode,
                audio_track: project.audio_track || 'instrumental',
              },
            });

          console.log(`Saved render v${nextRenderNumber} to project_renders for project ${project_id}`);
        } catch (renderSaveError) {
          // Don't fail the webhook if render history save fails
          console.error('Failed to save render history (table may not exist yet):', renderSaveError.message);
        }
      }

      // Send completion email if enabled
      if (project && project.notify_on_complete !== false) {
        // Generate download URL for email
        const baseFilename = `${project.track_number || 'KT-01'} - ${project.artist_name || 'Unknown Artist'} - ${project.song_title || 'Untitled'}`;
        const sanitizedFilename = baseFilename.replace(/[<>:"/\\|?*]/g, '');

        let downloadUrl = `${process.env.FRONTEND_URL}/dashboard`;
        if (results.video_url) {
          downloadUrl = await getSignedDownloadUrl(results.video_url, `${sanitizedFilename}.mp4`);
        }

        await sendCompletionEmail(project, downloadUrl);
      }

    } else if (status === 'failed') {
      // Refund credits on failure (guarded against double-refund by the prior status).
      // We only refund the first time we see a non-failed project transition to failed.
      if (project && project.status !== 'failed' && (project.credits_used || 0) > 0) {
        try {
          await addCreditsWithExpiration(
            project.user_id,
            project.credits_used,
            'refund',
            `Refund for failed project ${project_id}`
          );
          console.log(`Refunded ${project.credits_used} credits to user ${project.user_id} for failed project ${project_id}`);
        } catch (refundError) {
          console.error('Failed to refund credits for failed project:', refundError.message);
        }
      }

      const { error: updateError } = await supabase
        .from('projects')
        .update({
          status: 'failed',
          error_message: processingError || 'Processing failed',
          processing_completed_at: new Date().toISOString(),
        })
        .eq('id', project_id);

      if (updateError) {
        console.error('Failed to update project status:', updateError);
      }

      // Send failure email if enabled
      if (project && project.notify_on_complete !== false) {
        await sendFailureEmail(project, processingError);
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('RunPod webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SUPPORT CONTACT FORM ENDPOINT
// ============================================

// Support contact form - sends email to admin
// V15: Available to any user who has ever paid (subscription or credit pack)
// Higher subscription = "Priority Support", others get "Standard Support"
app.post('/api/support/contact', authMiddleware, async (req, res) => {
  try {
    // Get user profile to check subscription tier
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // V15: Check if user has ever paid (subscription or credit pack purchase)
    const isPaidUser = profile.has_ever_paid || profile.subscription_credits_per_month > 0;
    
    if (!isPaidUser) {
      return res.status(403).json({ 
        error: 'Support is available to customers who have made a purchase. Get credits to unlock support.' 
      });
    }

    // Get form data
    const { subject, message } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ error: 'Subject and message are required' });
    }

    if (subject.length > 100) {
      return res.status(400).json({ error: 'Subject must be 100 characters or less' });
    }

    if (message.length > 2000) {
      return res.status(400).json({ error: 'Message must be 2000 characters or less' });
    }

    // Determine support level based on subscription credits
    // V15: 500+ credits/month = Priority Support, others = Standard Support
    const isPriority = profile.subscription_credits_per_month >= 500;
    const supportLevel = isPriority ? 'Priority Support' : 'Standard Support';
    const emailSubject = isPriority 
      ? `[Priority Support] Karatrack Studio: ${subject}`
      : `[Standard Support] Karatrack Studio: ${subject}`;

    // Get user email
    const userEmail = profile.email || req.user.email;
    const userName = profile.full_name || userEmail.split('@')[0];

    // Send email to admin via Brevo
    if (!process.env.BREVO_API_KEY) {
      console.error('Brevo not configured');
      return res.status(500).json({ error: 'Email service not configured' });
    }

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

    sendSmtpEmail.to = [{
      email: process.env.ADMIN_EMAIL || 'kssupport@karatrack.com',
      name: 'Karatrack Studio Support'
    }];

    sendSmtpEmail.replyTo = {
      email: userEmail,
      name: userName
    };

    sendSmtpEmail.sender = {
      name: 'Karatrack Studio Support',
      email: 'support@karatrack.com'
    };

    sendSmtpEmail.subject = emailSubject;

    sendSmtpEmail.htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f0f1a;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 40px;">
            <h1 style="color: #00d4ff; font-size: 28px; margin: 0;">Karatrack Support Request</h1>
            <p style="color: ${isPriority ? '#a855f7' : '#00d4ff'}; font-size: 14px; margin: 10px 0 0 0;">
              ${supportLevel}
            </p>
          </div>
          
          <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; padding: 40px; border: 1px solid rgba(0, 212, 255, 0.2);">
            <div style="margin-bottom: 30px;">
              <h3 style="color: #00d4ff; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0;">From</h3>
              <p style="color: #ffffff; font-size: 16px; margin: 0;">${userName}</p>
              <p style="color: #a0a0a0; font-size: 14px; margin: 4px 0 0 0;">${userEmail}</p>
            </div>
            
            <div style="margin-bottom: 30px;">
              <h3 style="color: #00d4ff; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0;">Account Details</h3>
              <p style="color: #a0a0a0; font-size: 14px; margin: 0;">
                Support Level: <span style="color: #ffffff; text-transform: capitalize;">${supportLevel}</span><br>
                Credits: <span style="color: #ffffff;">${profile.credits_remaining || 0}</span><br>
                User ID: <span style="color: #666; font-size: 12px;">${req.user.id}</span>
              </p>
            </div>
            
            <div style="margin-bottom: 30px;">
              <h3 style="color: #00d4ff; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0;">Subject</h3>
              <p style="color: #ffffff; font-size: 18px; margin: 0;">${subject}</p>
            </div>
            
            <div>
              <h3 style="color: #00d4ff; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0;">Message</h3>
              <div style="background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 20px;">
                <p style="color: #ffffff; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${message}</p>
              </div>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 40px;">
            <p style="color: #444; font-size: 12px; margin: 0;">
              Reply directly to this email to respond to the user.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    sendSmtpEmail.textContent = `
KARATRACK SUPPORT REQUEST
${supportLevel}
========================

From: ${userName} (${userEmail})
Support Level: ${supportLevel}
Credits: ${profile.credits_remaining || 0}
User ID: ${req.user.id}

Subject: ${subject}

Message:
${message}

---
Reply directly to this email to respond to the user.
    `;

    await brevoEmailApi.sendTransacEmail(sendSmtpEmail);
    
    console.log(`Support request sent from ${userEmail} - ${supportLevel}`);

    res.json({ 
      success: true, 
      message: 'Your message has been sent. We will respond as soon as possible.' 
    });

  } catch (error) {
    console.error('Support contact error:', error);
    res.status(500).json({ error: 'Failed to send message. Please try again.' });
  }
});

// ============================================
// CREDIT EXPIRATION SYSTEM
// ============================================

// Helper: Add credits with expiration (90 days default)
async function addCreditsWithExpiration(userId, amount, source, description, daysUntilExpiry = 90) {
  const { data, error } = await supabase.rpc('add_credits_with_expiration', {
    p_user_id: userId,
    p_amount: amount,
    p_source: source,
    p_description: description,
    p_days_until_expiry: daysUntilExpiry
  });

  if (error) {
    console.error('Error adding credits with expiration:', error);
    throw error;
  }

  return data;
}

// Helper: Send expiration warning email
async function sendExpirationWarningEmail(email, creditsExpiring, daysLeft, expirationDate) {
  if (!process.env.BREVO_API_KEY) {
    console.log('Brevo not configured, skipping expiration email');
    return;
  }

  try {
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

    sendSmtpEmail.to = [{ email }];
    sendSmtpEmail.sender = {
      name: 'Karatrack Studio',
      email: process.env.BREVO_SENDER_EMAIL || 'noreply@karatrack.com'
    };

    if (daysLeft <= 1) {
      sendSmtpEmail.subject = 'Your Karatrack credits expire TOMORROW!';
    } else if (daysLeft <= 7) {
      sendSmtpEmail.subject = `${creditsExpiring} credits expiring in ${daysLeft} days`;
    } else {
      sendSmtpEmail.subject = `${creditsExpiring} credits expiring in ${daysLeft} days`;
    }

    const formattedDate = new Date(expirationDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    sendSmtpEmail.htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .warning-box { background: ${daysLeft <= 7 ? '#fee2e2' : '#fef3c7'}; border-left: 4px solid ${daysLeft <= 7 ? '#ef4444' : '#f59e0b'}; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; }
          .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Karatrack Studio</h1>
          </div>
          <div class="content">
            <h2>Your credits are expiring soon!</h2>
            
            <div class="warning-box">
              <strong>${creditsExpiring} credits</strong> will expire on <strong>${formattedDate}</strong>
              ${daysLeft <= 1 ? '<br><br>This is your final reminder!' : ''}
            </div>
            
            <p>Don't let your credits go to waste! Use them to create amazing karaoke tracks before they expire.</p>
            
            <p>Each credit can be used to:</p>
            <ul>
              <li>Remove vocals from any song</li>
              <li>Generate synced scrolling lyrics</li>
              <li>Export professional karaoke videos</li>
            </ul>
            
            <center>
              <a href="${process.env.FRONTEND_URL}/upload" class="cta-button">
                Create a Karaoke Track Now
              </a>
            </center>
            
            <p style="color: #666; font-size: 14px;">
              Need more time? Upgrade your subscription to get fresh credits with a new 90-day expiration window.
            </p>
          </div>
          <div class="footer">
            <p>ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© ${new Date().getFullYear()} Karatrack Studio. All rights reserved.</p>
            <p>Questions? Reply to this email or visit our support page.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await brevoEmailApi.sendTransacEmail(sendSmtpEmail);
    console.log(`Expiration warning sent to ${email} (${daysLeft} days left)`);
  } catch (error) {
    console.error('Failed to send expiration email:', error);
  }
}

// Helper: Send credits expired notification
async function sendCreditsExpiredEmail(email, expiredAmount) {
  if (!process.env.BREVO_API_KEY) return;

  try {
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

    sendSmtpEmail.to = [{ email }];
    sendSmtpEmail.sender = {
      name: 'Karatrack Studio',
      email: process.env.BREVO_SENDER_EMAIL || 'noreply@karatrack.com'
    };
    sendSmtpEmail.subject = `${expiredAmount} credits have expired`;

    sendSmtpEmail.htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Karatrack Studio</h1>
          </div>
          <div class="content">
            <h2>Your credits have expired</h2>
            
            <p>Unfortunately, <strong>${expiredAmount} credits</strong> have expired and been removed from your account.</p>
            
            <p>Remember, credits expire 90 days after being added to encourage you to create awesome karaoke content!</p>
            
            <center>
              <a href="${process.env.FRONTEND_URL}/pricing" class="cta-button">
                Get More Credits
              </a>
            </center>
          </div>
        </div>
      </body>
      </html>
    `;

    await brevoEmailApi.sendTransacEmail(sendSmtpEmail);
    console.log(`Credits expired notification sent to ${email}`);
  } catch (error) {
    console.error('Failed to send expired email:', error);
  }
}

// CRON ENDPOINT: Check for expiring credits and send notifications
// Call this daily via external cron service (e.g., cron-job.org, Railway cron)
// URL: POST /api/cron/check-credit-expiration
// Header: x-cron-secret: YOUR_CRON_SECRET
app.post('/api/cron/check-credit-expiration', async (req, res) => {
  // Verify cron secret to prevent unauthorized access.
  // Fail closed: if CRON_SECRET is not configured, reject all requests
  // (otherwise `undefined !== undefined` would let unauthenticated calls through).
  const cronSecret = req.headers['x-cron-secret'];
  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('Running credit expiration check...');

  try {
    const results = {
      expired: 0,
      warnings_14d: 0,
      warnings_7d: 0,
      warnings_1d: 0
    };

    // 1. Expire old credits
    const { data: expiredUsers, error: expireError } = await supabase.rpc('expire_old_credits');

    if (expireError) {
      console.error('Error expiring credits:', expireError);
    } else if (expiredUsers && expiredUsers.length > 0) {
      for (const user of expiredUsers) {
        results.expired += user.expired_amount;

        // Get user email and send notification
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', user.user_id)
          .single();

        if (profile?.email) {
          await sendCreditsExpiredEmail(profile.email, user.expired_amount);
        }
      }
      console.log(`Expired ${results.expired} credits for ${expiredUsers.length} users`);
    }

    // 2. Send 14-day warnings
    const { data: expiring14d } = await supabase
      .from('credit_batches')
      .select('id, user_id, remaining_amount, expires_at, profiles(email)')
      .gt('remaining_amount', 0)
      .gt('expires_at', new Date().toISOString())
      .lte('expires_at', new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString())
      .gt('expires_at', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
      .eq('expired_notified_14d', false);

    if (expiring14d) {
      for (const batch of expiring14d) {
        const daysLeft = Math.ceil((new Date(batch.expires_at) - new Date()) / (24 * 60 * 60 * 1000));
        await sendExpirationWarningEmail(
          batch.profiles?.email,
          batch.remaining_amount,
          daysLeft,
          batch.expires_at
        );

        await supabase
          .from('credit_batches')
          .update({ expired_notified_14d: true })
          .eq('id', batch.id);

        results.warnings_14d++;
      }
    }

    // 3. Send 7-day warnings
    const { data: expiring7d } = await supabase
      .from('credit_batches')
      .select('id, user_id, remaining_amount, expires_at, profiles(email)')
      .gt('remaining_amount', 0)
      .gt('expires_at', new Date().toISOString())
      .lte('expires_at', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
      .gt('expires_at', new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString())
      .eq('expired_notified_7d', false);

    if (expiring7d) {
      for (const batch of expiring7d) {
        const daysLeft = Math.ceil((new Date(batch.expires_at) - new Date()) / (24 * 60 * 60 * 1000));
        await sendExpirationWarningEmail(
          batch.profiles?.email,
          batch.remaining_amount,
          daysLeft,
          batch.expires_at
        );

        await supabase
          .from('credit_batches')
          .update({ expired_notified_7d: true })
          .eq('id', batch.id);

        results.warnings_7d++;
      }
    }

    // 4. Send 1-day (final) warnings
    const { data: expiring1d } = await supabase
      .from('credit_batches')
      .select('id, user_id, remaining_amount, expires_at, profiles(email)')
      .gt('remaining_amount', 0)
      .gt('expires_at', new Date().toISOString())
      .lte('expires_at', new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString())
      .eq('expired_notified_1d', false);

    if (expiring1d) {
      for (const batch of expiring1d) {
        await sendExpirationWarningEmail(
          batch.profiles?.email,
          batch.remaining_amount,
          1,
          batch.expires_at
        );

        await supabase
          .from('credit_batches')
          .update({ expired_notified_1d: true })
          .eq('id', batch.id);

        results.warnings_1d++;
      }
    }

    console.log('Credit expiration check complete:', results);
    res.json({ success: true, results });

  } catch (error) {
    console.error('Credit expiration check failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// ERROR HANDLING
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// START SERVER
app.listen(PORT, () => {
  console.log(`Karatrack Studio API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Email notifications: ${process.env.BREVO_API_KEY ? 'enabled' : 'disabled'}`);
});

module.exports = app;