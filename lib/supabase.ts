import { createBrowserClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

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
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'implicit',
  },
});

// SEPARATE client, used ONLY for Super Admin's "send password reset
// email" action (resetPasswordForEmail).
//
// createBrowserClient (@supabase/ssr) appears to force PKCE regardless
// of the flowType option we pass above -- which breaks this specific
// feature by design: PKCE stores a "code verifier" in whichever browser
// INITIATED the request (the admin's), but the employee opens the
// email link on their OWN device, which has no matching verifier
// ("PKCE code verifier not found in storage").
//
// This plain createClient (@supabase/supabase-js, no cookie syncing)
// respects flowType: 'implicit' properly, producing a self-contained
// hash-based recovery link that works from any device. persistSession
// is off since this client is only ever used for this one fire-and-
// forget call -- it must never interfere with the real logged-in
// admin session that `supabase` above manages.
export const supabaseAuthActions = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'implicit',
    persistSession: false,
    autoRefreshToken: false,
    // Distinct storage key so this throwaway client doesn't collide
    // with the main `supabase` client's storage key -- silences the
    // (harmless, but noisy) "Multiple GoTrueClient instances detected"
    // console warning. Since persistSession is false above, this key
    // is never actually written to; it just needs to be unique.
    storageKey: 'sb-auth-actions-throwaway',
  },
});