-- ============================================================
-- Pricing v2: flat per-track charging + $0.06 credit floor
-- Run in Supabase SQL Editor. Safe to run once. No customers yet,
-- so there are no balances/subscriptions to migrate.
--
-- Context: credits are now charged at RENDER time by resolution:
--   540p/720p = 19, 1080p = 28, 4K = 46 credits (Instant = 2x).
-- Uploading and previewing are free. This SQL only resizes the plans
-- and the free signup grant so the economics line up.
-- ============================================================

-- 1) Subscription plans: reduce monthly credits so the cheapest credit
--    (biggest annual plan) is ~$0.06. Prices are unchanged (in Stripe).
--    Matched by the OLD credits_per_month value.
UPDATE subscription_plans SET credits_per_month = 30  WHERE credits_per_month = 50;
UPDATE subscription_plans SET credits_per_month = 60  WHERE credits_per_month = 100;
UPDATE subscription_plans SET credits_per_month = 120 WHERE credits_per_month = 250;
UPDATE subscription_plans SET credits_per_month = 240 WHERE credits_per_month = 500;
UPDATE subscription_plans SET credits_per_month = 400 WHERE credits_per_month = 1000;

-- 2) Credit packs: reduce credits (prices unchanged). Matched by name.
UPDATE credit_packages SET credits = 40  WHERE name = 'Starter Pack';
UPDATE credit_packages SET credits = 110 WHERE name = 'Standard Pack';
UPDATE credit_packages SET credits = 280 WHERE name = 'Pro Pack';
UPDATE credit_packages SET credits = 600 WHERE name = 'Studio Pack';

-- 3) Free signup grant: 15 -> 19 credits (enough for one 720p track).
--    This grant is set by your signup trigger/function, NOT by app code.
--    Do BOTH of the following:
--
--    (a) If profiles.credits_remaining has a DEFAULT of 15, bump it:
--        ALTER TABLE profiles ALTER COLUMN credits_remaining SET DEFAULT 19;
--
--    (b) Open your "Free Signup Trigger" (Supabase > Database > Functions,
--        or your saved SQL query that creates the profile on signup) and
--        change the granted amount from 15 to 19. It usually looks like:
--            INSERT INTO profiles (id, credits_remaining, ...) VALUES (new.id, 15, ...);
--        or a call like add_credits(new.id, 15, ...). Change the 15 to 19.
--
--    (No existing users to backfill yet.)

-- 4) Sanity check (optional): confirm the new numbers.
-- SELECT credits_per_month, monthly_price, annual_price FROM subscription_plans ORDER BY credits_per_month;
-- SELECT name, credits, price FROM credit_packages ORDER BY credits;
