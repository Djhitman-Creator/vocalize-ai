import { createClient } from '@supabase/supabase-js';

// Create a single Supabase client instance to be shared across the app
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);