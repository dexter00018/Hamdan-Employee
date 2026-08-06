import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// The n8n workflow is exposed through an ngrok tunnel, which rotates its URL
// whenever the local ngrok process restarts. Set N8N_PUBLISH_PAYSLIP_WEBHOOK_URL
// in Vercel's project environment variables so updating it doesn't require a
// redeploy -- the hardcoded value below is only a fallback for local dev.
//
// IMPORTANT: this is the custom "path" configured on the webhook node itself
// (no ID segment needed) -- confirmed directly via the n8n editor's
// Production URL tab. Do not add an ID segment back in here.
const N8N_WEBHOOK_URL =
  process.env.N8N_PUBLISH_PAYSLIP_WEBHOOK_URL ||
  'https://yearly-goggles-proved.ngrok-free.dev/webhook/publish-payslip';

// Shared secret the n8n workflow checks before processing a publish request --
// without this, anyone who discovered the webhook URL could re-trigger a
// payslip email send. MUST match the value configured in the workflow's
// "Valid Secret?" node exactly. Set N8N_PUBLISH_WEBHOOK_SECRET in Vercel's
// env vars; the hardcoded value below is only a fallback for local dev.
const N8N_WEBHOOK_SECRET =
  process.env.N8N_PUBLISH_WEBHOOK_SECRET ||
  'pSMtRV9A5bu29SYbXJ2G2zUCviXmQcBX9SYYrmvWXZk';

// NOTE: This route builds its own Supabase server client inline using
// @supabase/ssr, since the exact server-side auth helper already living in
// lib/supabase.ts wasn't available when this file was written. If your other
// API routes (e.g. app/api/time-in/route.ts) already export a shared
// "createServerSupabaseClient()" or similar helper, swap the block below for
// that instead, so auth handling stays consistent across all API routes.
async function getAuthedAdminUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // No-op: this route doesn't need to refresh/write auth cookies,
          // only read the existing session to verify who's calling it.
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, isAdmin: false };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const isAdmin = !!profile && ['admin', 'super_admin'].includes(profile.role);
  return { supabase, user, isAdmin };
}

export async function POST(request: Request) {
  let payslip_id: string | undefined;
  try {
    const body = await request.json();
    payslip_id = body?.payslip_id;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!payslip_id) {
    return NextResponse.json({ error: 'payslip_id is required.' }, { status: 400 });
  }

  const { supabase, user, isAdmin } = await getAuthedAdminUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }
  if (!isAdmin) {
    return NextResponse.json({ error: 'Only HR/admins can publish payslips.' }, { status: 403 });
  }

  const { error: updateError } = await supabase
    .from('payslips')
    .update({ published: true, published_at: new Date().toISOString() })
    .eq('id', payslip_id);

  if (updateError) {
    console.error('Error marking payslip published:', updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Fire the n8n webhook so the email goes out immediately. If this call
  // fails (tunnel down, network hiccup, etc.), the payslip is still marked
  // published -- the workflow's 10-minute polling fetch (also filtered to
  // published=true) will pick it up as a fallback, just not instantly.
  try {
    const webhookRes = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Skips ngrok's free-tier browser-warning interstitial page, which
        // would otherwise get returned instead of reaching the workflow.
        'ngrok-skip-browser-warning': 'true',
        // Required by the workflow's "Valid Secret?" gate -- requests
        // without a matching header are silently dropped there.
        'x-publish-secret': N8N_WEBHOOK_SECRET,
      },
      body: JSON.stringify({ payslip_id }),
    });

    if (!webhookRes.ok) {
      console.error('n8n publish webhook returned non-OK status:', webhookRes.status);
      return NextResponse.json({ published: true, emailTriggered: false });
    }
  } catch (err) {
    console.error('Error calling n8n publish webhook:', err);
    return NextResponse.json({ published: true, emailTriggered: false });
  }

  return NextResponse.json({ published: true, emailTriggered: true });
}