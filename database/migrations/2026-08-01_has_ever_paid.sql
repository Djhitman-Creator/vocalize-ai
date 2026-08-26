-- ============================================================
-- Migration: 2026-08-01_has_ever_paid.sql
--
-- Why: The RunPod worker decides whether to burn the Karatrack
-- watermark into exported videos based on the job input flag
-- `has_ever_paid`. The backend reads this flag from
-- public.profiles, but (a) the column was never added by a
-- migration (schema.sql predates the V15 credit model and does
-- not include it), and (b) two payment paths (the
-- customer.subscription.created/updated webhook and the in-app
-- subscription upgrade in POST /api/stripe/create-checkout)
-- were not setting it. Backend fixes shipped alongside this
-- migration in backend/src/index.js; this migration adds the
-- column and backfills existing paying customers so their
-- exports stop being watermarked.
-- ============================================================

-- 1. Add the column (safe to re-run)
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS has_ever_paid BOOLEAN NOT NULL DEFAULT false;

-- 2. Backfill: mark anyone who has ever paid.
-- NOTE: schema.sql is known to be stale. The statements below use the
-- table/column names that exist in schema.sql (public.credit_transactions
-- with transaction_type IN ('purchase', 'subscription_renewal') and
-- stripe_payment_id, plus profiles.stripe_subscription_id). If your live
-- database uses different names (e.g. a newer credit_batches table for the
-- V15 FIFO/expiring credits), adapt the table and column names before
-- running, then uncomment.
--
-- UPDATE public.profiles p
-- SET has_ever_paid = true
-- WHERE has_ever_paid = false
--   AND (
--     -- Ever bought a credit pack or received a paid subscription renewal
--     EXISTS (
--       SELECT 1 FROM public.credit_transactions ct
--       WHERE ct.user_id = p.id
--         AND (
--           ct.transaction_type IN ('purchase', 'subscription_renewal')
--           OR ct.stripe_payment_id IS NOT NULL
--         )
--     )
--     -- Or has/had a Stripe subscription on their profile
--     OR p.stripe_subscription_id IS NOT NULL
--   );

-- 3. Owner/test convenience: flip a single account by email.
-- UPDATE public.profiles SET has_ever_paid = true WHERE email = 'you@example.com';
