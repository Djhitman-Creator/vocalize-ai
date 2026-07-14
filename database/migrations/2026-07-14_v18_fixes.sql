-- ============================================================
-- V18 fixes migration
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query).
-- Safe to run once. Each statement uses IF NOT EXISTS / defensive guards.
-- ============================================================

-- 1) Stripe webhook idempotency table
--    The backend now records every Stripe event id the first time it is seen,
--    so a retried event can never add credits twice. Without this table the
--    webhook still works (it logs a warning and processes anyway), but you get
--    NO double-charge protection until it exists.
CREATE TABLE IF NOT EXISTS processed_stripe_events (
  event_id     text PRIMARY KEY,
  event_type   text,
  processed_at timestamptz NOT NULL DEFAULT now()
);

-- Service role (the backend) needs to insert/select. RLS is typically bypassed
-- by the service key, but enable it in case you lock things down later.
ALTER TABLE processed_stripe_events ENABLE ROW LEVEL SECURITY;

-- 2) Make sure the credit ledger allows a 'refund' transaction type.
--    The failure-refund path adds credits back with source/type 'refund'.
--    If your credit_transactions table has a CHECK constraint on transaction_type
--    that does NOT include 'refund', the refund insert will fail. If you hit that,
--    drop and recreate the constraint to include 'refund'. Example (adjust the
--    constraint name and the full allowed list to match your schema):
--
--    ALTER TABLE credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_transaction_type_check;
--    ALTER TABLE credit_transactions ADD CONSTRAINT credit_transactions_transaction_type_check
--      CHECK (transaction_type IN (
--        'purchase','subscription','subscription_upgrade','usage','refund','bonus','expiration','signup'
--      ));

-- 3) NOTE (not run here): database/schema.sql is badly out of date vs the live
--    database and the backend code. Regenerate it from the LIVE Supabase schema
--    so it stops being misleading. From a machine with the Supabase connection
--    string:
--       pg_dump --schema-only --no-owner "$SUPABASE_DB_URL" > database/schema.sql
--    (Supabase: Project Settings > Database > Connection string > URI.)
