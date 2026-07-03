import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

// IMPORTANT: We use createBrowserClient from @supabase/ssr instead of the
// plain createClient from @supabase/supabase-js.
//
// The plain client stores the session ONLY in localStorage. Our proxy.ts
// (route protection) runs on the SERVER and can only read the session from
// COOKIES — it has no access to the browser's localStorage. If the client
// only writes to localStorage, proxy.ts will always see "not logged in"
// and bounce the user straight back to the login page, even right after a
// successful login.
//
// createBrowserClient keeps localStorage AND cookies in sync, so both the
// client-side app and proxy.ts see the same session.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);