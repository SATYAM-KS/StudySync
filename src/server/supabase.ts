import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    console.log('[Database] Connected to Supabase PostgreSQL at:', supabaseUrl);
  } catch (err) {
    console.warn('[Database] Failed to initialize Supabase client:', err);
  }
} else {
  console.log('[Database] Supabase credentials not found in env, using local resilient JSON DB.');
}

export { supabase };
