-- ============================================================
-- V20 MIGRATION: Key change + speed adjustment (2026-07-28)
-- Run this in Supabase -> SQL Editor -> New query -> paste -> Run
-- ============================================================
-- Adds the two columns the render endpoint saves so a project's
-- last-used key/speed is restored when the editor reopens.
-- Safe to run more than once (IF NOT EXISTS).

ALTER TABLE projects ADD COLUMN IF NOT EXISTS pitch_semitones INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS speed_rate NUMERIC DEFAULT 1.0;

-- Optional sanity check (run after the ALTERs):
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'projects'
--   AND column_name IN ('pitch_semitones', 'speed_rate');
