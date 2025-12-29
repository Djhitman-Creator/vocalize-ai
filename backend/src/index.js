/**
 * Karatrack Studio Backend API Server
 * 
 * UPDATED: Added support for:
 * - lyrics_text (user-provided lyrics for 100% accuracy)
 * - display_mode (auto/scroll/page/overwrite)
 * - clean_version (profanity filter toggle)
 * - Style customization (colors, fonts, gradients)
 * - Email notifications via Brevo when processing completes
 * - Subscription tier passed to RunPod for watermark logic
 * 
 * Changes marked with "// NEW:" comments
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const { createClient } = require('@supabase/supabase-js');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const Stripe = require('stripe');
const axios = require('axios');

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
  process.env.SUPABASE_SERVICE_KEY
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
  console.log(`📧 Email notifications: enabled (API key: ${process.env.BREVO_API_KEY.substring(0, 10)}...)`);
} else {
  console.log('⚠️ Email notifications: DISABLED (no BREVO_API_KEY set)');
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const audioTypes = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/mp3', 'audio/x-wav'];
    const imageTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (audioTypes.includes(file.mimetype) || imageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type.'));
    }
  },
});

const projectUpload = upload.fields([
  { name: 'audio', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
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
  const profile = await getUserProfile(userId);
  return profile.credits_remaining >= required;
}

async function deductCredits(userId, amount, projectId, description) {
  const { data, error } = await supabase.rpc('deduct_credits', {
    p_user_id: userId,
    p_amount: amount,
    p_project_id: projectId,
    p_description: description,
  });
  if (error) throw error;
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

function calculateCreditsNeeded(options) {
  let credits = 0;
  
  // Base processing cost
  if (options.processing_type === 'both') {
    credits += 2;  // Both vocal versions
  } else {
    credits += 1;  // Single version
  }
  
  // Lyrics always included now
  credits += 1;
  
  // Quality-based pricing (480p=3, 720p=5, 1080p=7 total for basic track)
  if (options.video_quality === '480p') {
    credits += 1;   // Total: 1+1+1 = 3 credits
  } else if (options.video_quality === '720p') {
    credits += 3;   // Total: 1+1+3 = 5 credits
  } else if (options.video_quality === '1080p') {
    credits += 5;   // Total: 1+1+5 = 7 credits
  } else if (options.video_quality === '4k') {
    credits += 7;   // Total: 1+1+7 = 9 credits
  } else {
    credits += 1;   // Default to 480p pricing
  }
  
  return credits;
}

// UPDATED: Added subscription_tier to RunPod payload for watermark logic
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
        callback_url: `${process.env.API_URL}/api/webhooks/runpod`,
        
        // Lyrics and display options
        lyrics_text: options.lyrics_text || null,
        display_mode: options.display_mode || 'auto',
        clean_version: options.clean_version || false,
        
        // Style customization options
        bg_color_1: options.bg_color_1 || '#1a1a2e',
        bg_color_2: options.bg_color_2 || '#16213e',
        use_gradient: options.use_gradient !== false,
        gradient_direction: options.gradient_direction || 'to bottom',
        text_color: options.text_color || '#ffffff',
        outline_color: options.outline_color || '#000000',
        sung_color: options.sung_color || '#00d4ff',
        font: options.font || 'arial',
        
        // Processing mode for two-stage flow
        processing_mode: options.processing_mode || 'full',
        
        // NEW: Subscription tier for watermark logic
        subscription_tier: options.subscription_tier || 'free',
        
        // For render_only mode
        processed_audio_url: options.processed_audio_url || null,
        vocals_audio_url: options.vocals_audio_url || null,
        edited_lyrics: options.edited_lyrics || null,
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
    console.log(`📧 Attempting to send completion email for project ${project.id}`);
    
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
      console.error('❌ Could not get user email for notification - no email found');
      return;
    }

    console.log(`   Sending email to: ${userEmail}`);

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    
    sendSmtpEmail.subject = `🎵 Your karaoke track "${project.title}" is ready!`;
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
            <h1 style="color: #00d4ff; font-size: 28px; margin: 0;">🎵 Karatrack Studio</h1>
          </div>
          
          <!-- Main Content -->
          <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; padding: 40px; border: 1px solid rgba(0, 212, 255, 0.2);">
            <h2 style="color: #ffffff; font-size: 24px; margin: 0 0 20px 0;">
              Hey ${userName}! 👋
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
              © ${new Date().getFullYear()} Karatrack Studio. All rights reserved.
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
    console.log(`✅ Completion email sent to ${userEmail} for project ${project.id}`);
    
  } catch (error) {
    console.error('❌ Error sending completion email:');
    console.error('   Message:', error.message);
    console.error('   Status:', error.status);
    console.error('   Response:', JSON.stringify(error.response?.body || error.response?.text || 'No response body'));
    // Don't throw - email failure shouldn't break the webhook
  }
}

// NEW: Send failure notification email
async function sendFailureEmail(project, errorMessage) {
  try {
    console.log(`📧 Attempting to send failure email for project ${project.id}`);
    
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
      console.error('❌ Could not get user email for failure notification');
      return;
    }

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    
    sendSmtpEmail.subject = `⚠️ Issue processing "${project.title}"`;
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
            <h1 style="color: #00d4ff; font-size: 28px; margin: 0;">🎵 Karatrack Studio</h1>
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
              © ${new Date().getFullYear()} Karatrack Studio. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    await brevoEmailApi.sendTransacEmail(sendSmtpEmail);
    console.log(`✅ Failure email sent to ${userEmail} for project ${project.id}`);
    
  } catch (error) {
    console.error('Error sending failure email:', error);
  }
}

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
      // Email notification preference
      notify_on_complete,
      // Processing mode for lyrics review
      processing_mode
    } = req.body;
    
    const file = req.files?.audio?.[0];
    const thumbnailFile = req.files?.thumbnail?.[0];

    if (!file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Validate lyrics are provided (required for accurate sync)
    if (!lyrics_text || lyrics_text.trim().length < 50) {
      return res.status(400).json({ 
        error: 'Lyrics are required for accurate sync. Please paste the complete song lyrics (minimum 50 characters).' 
      });
    }

    const creditsNeeded = calculateCreditsNeeded({
      processing_type,
      include_lyrics: include_lyrics === 'true',
      video_quality,
      hd_quality: false,
    });

    const hasCredits = await checkCredits(req.user.id, creditsNeeded);
    if (!hasCredits) {
      return res.status(402).json({
        error: 'Insufficient credits',
        credits_needed: creditsNeeded,
      });
    }

    const fileKey = `uploads/${req.user.id}/${uuidv4()}-${file.originalname}`;
    const fileUrl = await uploadToR2(file.buffer, fileKey, file.mimetype);

    const projectId = uuidv4();

    // Upload thumbnail if provided
    let thumbnailUrl = null;
    if (thumbnailFile) {
      const thumbKey = `thumbnails/${req.user.id}/${projectId}-thumbnail${thumbnailFile.originalname.substring(thumbnailFile.originalname.lastIndexOf('.'))}`;
      thumbnailUrl = await uploadToR2(thumbnailFile.buffer, thumbKey, thumbnailFile.mimetype);
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
        credits_used: creditsNeeded,
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
        // Email notification preference
        notify_on_complete: notify_on_complete !== 'false' && notify_on_complete !== false,
      })
      .select()
      .single();

    if (error) throw error;

    await deductCredits(req.user.id, creditsNeeded, projectId, `Processing: ${title || file.originalname}`);

    // NEW: Get user's subscription tier for watermark logic
    const userProfile = await getUserProfile(req.user.id);

    // Send to RunPod with all options including subscription_tier
    const runpodJobId = await sendToRunPod(projectId, fileUrl, {
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
      // Processing mode
      processing_mode: processing_mode || 'full',
      // NEW: Subscription tier for watermark logic
      subscription_tier: userProfile.subscription_tier || 'free',
    });

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
      credits_used: creditsNeeded,
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

    const fileKey = `thumbnails/${req.user.id}/${req.params.id}-thumbnail${file.originalname.substring(file.originalname.lastIndexOf('.'))}`;
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
    if (!['awaiting_review', 'transcribed'].includes(project.status)) {
      return res.status(400).json({ 
        error: `Cannot render project with status: ${project.status}. Project must be awaiting review.` 
      });
    }

    // Check if processed audio exists
    if (!project.processed_audio_url) {
      return res.status(400).json({ error: 'Processed audio not available. Please re-upload the track.' });
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
      // Style options
      bg_color_1: project.bg_color_1 || '#1a1a2e',
      bg_color_2: project.bg_color_2 || '#16213e',
      use_gradient: project.use_gradient !== false,
      gradient_direction: project.gradient_direction || 'to bottom',
      text_color: project.text_color || '#ffffff',
      outline_color: project.outline_color || '#000000',
      sung_color: project.sung_color || '#00d4ff',
      font: project.font || 'arial',
      // Render-only specific
      processed_audio_url: project.processed_audio_url,
      vocals_audio_url: project.vocals_audio_url,
      edited_lyrics: edited_lyrics,
      // NEW: Subscription tier for watermark logic
      subscription_tier: userProfile.subscription_tier || 'free',
    });

    await supabase
      .from('projects')
      .update({
        runpod_job_id: runpodJobId,
      })
      .eq('id', project.id);

    res.json({
      message: 'Rendering started',
      project_id: project.id,
      runpod_job_id: runpodJobId,
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

app.post('/api/stripe/create-checkout', authMiddleware, async (req, res) => {
  try {
    const { price_id } = req.body;
    const profile = await getUserProfile(req.user.id);
    let isUpgrade = false;

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

    // If user has existing subscription, cancel it first (no proration - they keep credits)
    if (profile.stripe_subscription_id) {
      console.log(`📦 User has existing subscription: ${profile.stripe_subscription_id}`);
      
      try {
        // Cancel the old subscription immediately
        await stripe.subscriptions.cancel(profile.stripe_subscription_id);
        console.log(`   ✅ Old subscription canceled`);
        isUpgrade = true;
        
        // Clear the subscription ID in database
        await supabase
          .from('profiles')
          .update({ stripe_subscription_id: null })
          .eq('id', req.user.id);
      } catch (cancelError) {
        console.log(`   ⚠️ Could not cancel subscription: ${cancelError.message}`);
      }
    }

    // Create new checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: price_id, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing`,
      metadata: { 
        user_id: req.user.id,
        is_upgrade: isUpgrade ? 'true' : 'false'  // Track if this is an upgrade
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/stripe/buy-credits', authMiddleware, async (req, res) => {
  try {
    const { package_id } = req.body;

    const { data: pkg, error } = await supabase
      .from('credit_packages')
      .select('*')
      .eq('id', package_id)
      .single();

    if (error || !pkg) {
      return res.status(404).json({ error: 'Package not found' });
    }

    const profile = await getUserProfile(req.user.id);

    const session = await stripe.checkout.sessions.create({
      customer: profile.stripe_customer_id,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: pkg.stripe_price_id, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/dashboard?credits_purchased=true`,
      cancel_url: `${process.env.FRONTEND_URL}/dashboard`,
      metadata: {
        user_id: req.user.id,
        credits: pkg.credits,
        type: 'credit_purchase',
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
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

// WEBHOOKS
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  console.log('🔔 Stripe webhook received');
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    console.log(`✅ Webhook verified: ${event.type}`);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        
        // Handle credit purchases
        if (session.metadata.type === 'credit_purchase') {
          await supabase.rpc('add_credits', {
            p_user_id: session.metadata.user_id,
            p_amount: parseInt(session.metadata.credits),
            p_transaction_type: 'purchase',
            p_description: `Purchased ${session.metadata.credits} credits`,
            p_stripe_payment_id: session.payment_intent,
          });
        }
        
        // Handle subscription credits (both new signups AND upgrades get credits)
        if (session.mode === 'subscription') {
          const isUpgrade = session.metadata.is_upgrade === 'true';
          console.log(`🆕 Subscription checkout completed for user: ${session.metadata.user_id} (upgrade: ${isUpgrade})`);
          
          // Get the subscription to find the price/plan
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          const priceId = subscription.items.data[0].price.id;
          
          const { data: plan } = await supabase
            .from('subscription_plans')
            .select('tier, credits_per_month')
            .eq('stripe_price_id', priceId)
            .single();
          
          if (plan) {
            const description = isUpgrade 
              ? `Upgraded to ${plan.tier} - ${plan.credits_per_month} credits`
              : `${plan.tier} subscription - ${plan.credits_per_month} monthly credits`;
            
            console.log(`   Adding ${plan.credits_per_month} credits for ${plan.tier} subscription`);
            await supabase.rpc('add_credits', {
              p_user_id: session.metadata.user_id,
              p_amount: plan.credits_per_month,
              p_transaction_type: isUpgrade ? 'upgrade' : 'subscription_renewal',
              p_description: description,
            });
          }
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        console.log(`📦 Subscription ${event.type} for customer: ${customerId}`);

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (profileError) {
          console.error('❌ Error finding profile by stripe_customer_id:', profileError);
          console.log('   Looking for customer ID:', customerId);
        }

        if (profile) {
          console.log(`✅ Found profile: ${profile.id}`);
          const priceId = subscription.items.data[0].price.id;
          console.log(`   Price ID from subscription: ${priceId}`);
          
          const { data: plan, error: planError } = await supabase
            .from('subscription_plans')
            .select('tier, credits_per_month')
            .eq('stripe_price_id', priceId)
            .single();

          if (planError) {
            console.error('❌ Error finding plan by stripe_price_id:', planError);
            console.log('   Looking for price ID:', priceId);
          }

          if (plan) {
            console.log(`✅ Found plan: ${plan.tier} (${plan.credits_per_month} credits)`);
            
            const { error: updateError } = await supabase
              .from('profiles')
              .update({
                subscription_tier: plan.tier,
                stripe_subscription_id: subscription.id,
              })
              .eq('id', profile.id);

            if (updateError) {
              console.error('❌ Error updating profile:', updateError);
            } else {
              console.log(`✅ Profile updated to tier: ${plan.tier}`);
            }

            // Note: Credits are now added in checkout.session.completed handler
            // This allows us to check metadata and skip credits for upgrades
          } else {
            console.log('❌ No plan found for price ID:', priceId);
          }
        } else {
          console.log('❌ No profile found for customer ID:', customerId);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await supabase
          .from('profiles')
          .update({
            subscription_tier: 'free',
            stripe_subscription_id: null,
          })
          .eq('stripe_customer_id', subscription.customer);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object;
        if (invoice.billing_reason === 'subscription_cycle') {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, subscription_tier')
            .eq('stripe_customer_id', invoice.customer)
            .single();

          if (profile) {
            const { data: plan } = await supabase
              .from('subscription_plans')
              .select('credits_per_month')
              .eq('tier', profile.subscription_tier)
              .single();

            if (plan) {
              await supabase.rpc('add_credits', {
                p_user_id: profile.id,
                p_amount: plan.credits_per_month,
                p_transaction_type: 'subscription_renewal',
                p_description: `Monthly renewal - ${plan.credits_per_month} credits`,
              });

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
    const { project_id, status, results, error: processingError } = req.body;

    // Fetch the project to get notify preference
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', project_id)
      .single();

    // Handle transcription completed (two-stage processing)
    if (status === 'transcribed' && results) {
      console.log(`📋 Project ${project_id} transcription complete - awaiting review`);
      
      const { data: updateData, error: updateError } = await supabase
        .from('projects')
        .update({
          status: 'awaiting_review',
          processed_audio_url: results.processed_audio_url,
          vocals_audio_url: results.vocals_audio_url,
          lyrics_json: results.lyrics,
          transcription_completed_at: new Date().toISOString(),
        })
        .eq('id', project_id)
        .select();

      if (updateError) {
        console.error('❌ Failed to update project status:', updateError);
      } else {
        console.log('✅ Project status updated to awaiting_review:', updateData);
      }

      // Don't send email - user needs to review lyrics first
      
    } else if (status === 'completed' && results) {
      const { data: updateData, error: updateError } = await supabase
        .from('projects')
        .update({
          status: 'completed',
          processed_audio_url: results.processed_audio_url || project?.processed_audio_url,
          vocals_audio_url: results.vocals_audio_url || project?.vocals_audio_url,
          lyrics_json: results.lyrics || project?.lyrics_json,
          video_url: results.video_url,
          processing_completed_at: new Date().toISOString(),
        })
        .eq('id', project_id)
        .select();

      if (updateError) {
        console.error('❌ Failed to update project status:', updateError);
      } else {
        console.log('✅ Project status updated to completed:', updateData);
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
      const { error: updateError } = await supabase
        .from('projects')
        .update({
          status: 'failed',
          error_message: processingError || 'Processing failed',
          processing_completed_at: new Date().toISOString(),
        })
        .eq('id', project_id);

      if (updateError) {
        console.error('❌ Failed to update project status:', updateError);
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
  console.log(`🚀 Karatrack Studio API running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📧 Email notifications: ${process.env.BREVO_API_KEY ? 'enabled' : 'disabled'}`);
});

module.exports = app;