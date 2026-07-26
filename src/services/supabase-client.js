import { createClient } from '@supabase/supabase-js';

const supabaseUrl = __SUPABASE_URL__;
const supabaseAnonKey = __SUPABASE_ANON_KEY__;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
      },
    })
  : null;