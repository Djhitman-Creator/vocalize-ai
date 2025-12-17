-- VocalizeAI Database Schema for Supabase
-- Run this in the Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE (extends Supabase auth.users)
-- ============================================
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'starter', 'pro', 'studio')),
    credits_remaining INTEGER DEFAULT 3,
    credits_used_this_month INTEGER DEFAULT 0,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE public.subscriptions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    stripe_subscription_id TEXT NOT NULL,
    stripe_price_id TEXT NOT NULL,
    tier TEXT NOT NULL CHECK (tier IN ('starter', 'pro', 'studio')),
    status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- CREDIT TRANSACTIONS TABLE
-- ============================================
CREATE TABLE public.credit_transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('subscription_renewal', 'purchase', 'usage', 'refund', 'bonus')),
    description TEXT,
    project_id UUID,
    stripe_payment_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PROJECTS TABLE (user's processing jobs)
-- ============================================
CREATE TABLE public.projects (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'uploading', 'queued', 'processing', 'completed', 'failed')),
    original_file_url TEXT,
    original_file_name TEXT,
    original_file_size INTEGER,
    duration_seconds INTEGER,
    processing_type TEXT CHECK (processing_type IN ('remove_vocals', 'isolate_backing', 'both')),
    include_lyrics BOOLEAN DEFAULT TRUE,
    video_quality TEXT DEFAULT '720p' CHECK (video_quality IN ('720p', '1080p')),
    thumbnail_url TEXT,
    processed_audio_url TEXT,
    vocals_audio_url TEXT,
    lyrics_json JSONB,
    video_url TEXT,
    credits_used INTEGER DEFAULT 0,
    runpod_job_id TEXT,
    processing_started_at TIMESTAMP WITH TIME ZONE,
    processing_completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- CREDIT PACKAGES (for one-time purchases)
-- ============================================
CREATE TABLE public.credit_packages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    credits INTEGER NOT NULL,
    price_cents INTEGER NOT NULL,
    stripe_price_id TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO public.credit_packages (name, credits, price_cents, stripe_price_id) VALUES
    ('10 Credits', 10, 500, 'price_10_credits'),
    ('25 Credits', 25, 1000, 'price_25_credits'),
    ('50 Credits', 50, 1750, 'price_50_credits'),
    ('100 Credits', 100, 3000, 'price_100_credits');

-- ============================================
-- SUBSCRIPTION PLANS (reference table)
-- ============================================
CREATE TABLE public.subscription_plans (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tier TEXT NOT NULL UNIQUE CHECK (tier IN ('free', 'starter', 'pro', 'studio')),
    name TEXT NOT NULL,
    price_cents INTEGER NOT NULL,
    credits_per_month INTEGER NOT NULL,
    extra_credit_price_cents INTEGER NOT NULL,
    stripe_price_id TEXT,
    features JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO public.subscription_plans (tier, name, price_cents, credits_per_month, extra_credit_price_cents, stripe_price_id, features) VALUES
    ('free', 'Free', 0, 3, 0, NULL, '{"max_file_size_mb": 10, "video_quality": ["720p"], "support": "community"}'),
    ('starter', 'Starter', 999, 25, 50, 'price_starter', '{"max_file_size_mb": 50, "video_quality": ["720p", "1080p"], "support": "email"}'),
    ('pro', 'Pro', 2499, 75, 40, 'price_pro', '{"max_file_size_mb": 100, "video_quality": ["720p", "1080p"], "support": "priority"}'),
    ('studio', 'Studio', 4999, 200, 30, 'price_studio', '{"max_file_size_mb": 500, "video_quality": ["720p", "1080p", "4k"], "support": "dedicated"}');

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own transactions" ON public.credit_transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own projects" ON public.projects
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own projects" ON public.projects
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects" ON public.projects
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects" ON public.projects
    FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view subscription plans" ON public.subscription_plans
    FOR SELECT USING (true);

CREATE POLICY "Anyone can view credit packages" ON public.credit_packages
    FOR SELECT USING (true);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.deduct_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_project_id UUID,
    p_description TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_credits INTEGER;
    v_new_balance INTEGER;
BEGIN
    SELECT credits_remaining INTO v_current_credits
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE;
    
    IF v_current_credits < p_amount THEN
        RETURN FALSE;
    END IF;
    
    v_new_balance := v_current_credits - p_amount;
    
    UPDATE public.profiles
    SET credits_remaining = v_new_balance,
        credits_used_this_month = credits_used_this_month + p_amount
    WHERE id = p_user_id;
    
    INSERT INTO public.credit_transactions (user_id, amount, balance_after, transaction_type, description, project_id)
    VALUES (p_user_id, -p_amount, v_new_balance, 'usage', p_description, p_project_id);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.add_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_transaction_type TEXT,
    p_description TEXT,
    p_stripe_payment_id TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_new_balance INTEGER;
BEGIN
    UPDATE public.profiles
    SET credits_remaining = credits_remaining + p_amount
    WHERE id = p_user_id
    RETURNING credits_remaining INTO v_new_balance;
    
    INSERT INTO public.credit_transactions (user_id, amount, balance_after, transaction_type, description, stripe_payment_id)
    VALUES (p_user_id, p_amount, v_new_balance, p_transaction_type, p_description, p_stripe_payment_id);
    
    RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_projects_created_at ON public.projects(created_at DESC);
CREATE INDEX idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_created_at ON public.credit_transactions(created_at DESC);
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_id ON public.subscriptions(stripe_subscription_id);