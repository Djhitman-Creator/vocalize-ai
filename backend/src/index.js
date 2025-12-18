/**
 * VocalizeAI Backend API Server
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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/mp3', 'audio/x-wav'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only MP3, WAV, and FLAC are allowed.'));
    }
  },
});

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

async function getSignedDownloadUrl(key) {
  const command = new GetObjectCommand({
    Bucket: process.env.CLOUDFLARE_R2_BUCKET,
    Key: key,
  });
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
        callback_url: `${process.env.API_URL}/api/webhooks/runpod`,
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
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/projects', authMiddleware, upload.single('audio'), async (req, res) => {
  try {
    const { title, processing_type, include_lyrics, video_quality } = req.body;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: 'No audio file provided' });
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
    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        id: projectId,
        user_id: req.user.id,
        title: title || file.originalname,
        status: 'queued',
        original_file_url: fileUrl,
        original_file_name: file.originalname,
        original_file_size: file.size,
        processing_type,
        include_lyrics: include_lyrics === 'true',
        video_quality,
        credits_used: creditsNeeded,
      })
      .select()
      .single();
    
    if (error) throw error;
    
    await deductCredits(req.user.id, creditsNeeded, projectId, `Processing: ${title || file.originalname}`);
    
    const runpodJobId = await sendToRunPod(projectId, fileUrl, {
      processing_type,
      include_lyrics: include_lyrics === 'true',
      video_quality,
      thumbnail_url: null,
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
    
    const urls = {
      video: project.video_url ? await getSignedDownloadUrl(project.video_url) : null,
      processed_audio: project.processed_audio_url ? await getSignedDownloadUrl(project.processed_audio_url) : null,
      vocals: project.vocals_audio_url ? await getSignedDownloadUrl(project.vocals_audio_url) : null,
    };
    
    res.json(urls);
  } catch (error) {
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

app.post('/api/webhooks/runpod', express.json(), async (req, res) => {
  try {
    const { project_id, status, results, error: processingError } = req.body;
    
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
    } else if (status === 'failed') {
      await supabase
        .from('projects')
        .update({
          status: 'failed',
          error_message: processingError || 'Processing failed',
          processing_completed_at: new Date().toISOString(),
        })
        .eq('id', project_id);
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
  console.log(`🚀 VocalizeAI API running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;