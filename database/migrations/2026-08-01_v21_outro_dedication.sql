-- ============================================================
-- V21 MIGRATION: Outro dedication (2026-08-01)
-- Run this in Supabase -> SQL Editor -> New query -> paste -> Run
-- ============================================================
-- The outro is now a full "dedication" screen shown AFTER the track
-- ends: multi-paragraph text, 5-60 seconds, +5 credits at export.
-- These columns may already exist from V12 (the old 150-char outro);
-- IF NOT EXISTS makes this safe to run either way, and more than once.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS outro_text TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS outro_duration INTEGER DEFAULT 10;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS outro_font_size TEXT DEFAULT 'normal';

-- Optional sanity check (run after the ALTERs):
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'projects'
--   AND column_name IN ('outro_text', 'outro_duration', 'outro_font_size');
