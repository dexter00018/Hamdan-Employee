import { createBrowserClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'implicit',
  },
});

export const supabaseAuthActions = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'implicit',
    persistSession: false,
    autoRefreshToken: false,
  },
});