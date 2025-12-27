/**
 * Karatrack Studio Backend API Server
 * 
 * UPDATED: Added support for:
 * - lyrics_text (user-provided lyrics for 100% accuracy)
 * - display_mode (auto/scroll/page/overwrite)
 * - clean_version (profanity filter toggle)
 * - Style customization (colors, fonts, gradients)
 * - Email notifications via Brevo when processing completes
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
  if (options.processing_type === 'both') {
    credits += 3;
  } else {
    credits += options.hd_quality ? 2 : 1;
  }
  if (options.include_lyrics) {
    credits += 1;
  }
  if (options.video_quality === '1080p') {
    credits += 2;
  } else if (options.video_quality === '4k') {
    credits += 3;
  } else {
    credits += 1;
  }
  return credits;
}

// UPDATED: Added new fields to RunPod payload including style options
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
        
        // NEW: Style customization options
        bg_color_1: options.bg_color_1 || '#1a1a2e',
        bg_color_2: options.bg_color_2 || '#16213e',
        use_gradient: options.use_gradient !== false,
        gradient_direction: options.gradient_direction || 'to bottom',
        text_color: options.text_color || '#ffffff',
        outline_color: options.outline_color || '#000000',
        sung_color: options.sung_color || '#00d4ff',
        font: options.font || 'arial',
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
    // Get user email from auth
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(project.user_id);
    
    if (authError || !authUser?.user?.email) {
      console.error('Could not get user email for notification:', authError);
      return;
    }

    const userEmail = authUser.user.email;
    const userName = authUser.user.user_metadata?.full_name || userEmail.split('@')[0];

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
    console.error('Error sending completion email:', error);
    // Don't throw - email failure shouldn't break the webhook
  }
}

// NEW: Send failure notification email
async function sendFailureEmail(project, errorMessage) {
  try {
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(project.user_id);
    
    if (authError || !authUser?.user?.email) {
      console.error('Could not get user email for failure notification:', authError);
      return;
    }

    const userEmail = authUser.user.email;
    const userName = authUser.user.user_metadata?.full_name || userEmail.split('@')[0];

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

// UPDATED: Project creation with style options and email notification preference
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
      // NEW: Style customization
      bg_color_1,
      bg_color_2,
      use_gradient,
      gradient_direction,
      text_color,
      outline_color,
      sung_color,
      font,
      // NEW: Email notification preference
      notify_on_complete
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
        // NEW: Style options
        bg_color_1: bg_color_1 || '#1a1a2e',
        bg_color_2: bg_color_2 || '#16213e',
        use_gradient: use_gradient !== 'false' && use_gradient !== false,
        gradient_direction: gradient_direction || 'to bottom',
        text_color: text_color || '#ffffff',
        outline_color: outline_color || '#000000',
        sung_color: sung_color || '#00d4ff',
        font: font || 'arial',
        // NEW: Email notification preference
        notify_on_complete: notify_on_complete !== 'false' && notify_on_complete !== false,
      })
      .select()
      .single();

    if (error) throw error;

    await deductCredits(req.user.id, creditsNeeded, projectId, `Processing: ${title || file.originalname}`);

    // Send to RunPod with all options
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
    });

    await supabase
      .from('projects')
      .update({
        runpod_job_id: runpodJobId,
        status: 'processing',
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

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: price_id, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing`,
      metadata: { user_id: req.user.id },
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
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.metadata.type === 'credit_purchase') {
          await supabase.rpc('add_credits', {
            p_user_id: session.metadata.user_id,
            p_amount: parseInt(session.metadata.credits),
            p_transaction_type: 'purchase',
            p_description: `Purchased ${session.metadata.credits} credits`,
            p_stripe_payment_id: session.payment_intent,
          });
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (profile) {
          const priceId = subscription.items.data[0].price.id;
          const { data: plan } = await supabase
            .from('subscription_plans')
            .select('tier, credits_per_month')
            .eq('stripe_price_id', priceId)
            .single();

          if (plan) {
            await supabase
              .from('profiles')
              .update({
                subscription_tier: plan.tier,
                stripe_subscription_id: subscription.id,
              })
              .eq('id', profile.id);

            if (event.type === 'customer.subscription.created') {
              await supabase.rpc('add_credits', {
                p_user_id: profile.id,
                p_amount: plan.credits_per_month,
                p_transaction_type: 'subscription_renewal',
                p_description: `${plan.tier} subscription - ${plan.credits_per_month} monthly credits`,
              });
            }
          }
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

// UPDATED: RunPod webhook with email notifications
app.post('/api/webhooks/runpod', express.json(), async (req, res) => {
  try {
    const { project_id, status, results, error: processingError } = req.body;

    // Fetch the project to get notify preference
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', project_id)
      .single();

    if (status === 'completed' && results) {
      await supabase
        .from('projects')
        .update({
          status: 'completed',
          processed_audio_url: results.processed_audio_url,
          vocals_audio_url: results.vocals_audio_url,
          lyrics_json: results.lyrics,
          video_url: results.video_url,
          processing_completed_at: new Date().toISOString(),
        })
        .eq('id', project_id);

      // NEW: Send completion email if enabled
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
      await supabase
        .from('projects')
        .update({
          status: 'failed',
          error_message: processingError || 'Processing failed',
          processing_completed_at: new Date().toISOString(),
        })
        .eq('id', project_id);

      // NEW: Send failure email if enabled
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