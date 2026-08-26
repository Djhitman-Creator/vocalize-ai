-- ============================================================
-- MIGRATION: Custom instrumental swap (2026-08-01)
-- Run this in Supabase -> SQL Editor -> New query -> paste -> Run
-- ============================================================
-- Lets a user upload a clean instrumental-only version of their
-- track (e.g. exported from Suno) in the editor. At render time
-- the worker uses it as the audio bed instead of the AI-separated
-- instrumental. custom_instrumental_name stores the original
-- filename for display in the editor UI.
-- Safe to run more than once (IF NOT EXISTS).

ALTER TABLE projects ADD COLUMN IF NOT EXISTS custom_instrumental_url TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS custom_instrumental_name TEXT;

-- Optional sanity check (run after the ALTERs):
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'projects'
--   AND column_name IN ('custom_instrumental_url', 'custom_instrumental_name');
