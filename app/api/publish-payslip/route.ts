import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// The n8n workflow is exposed through an ngrok tunnel, which rotates its URL
// whenever the local ngrok process restarts. Set N8N_PUBLISH_PAYSLIP_WEBHOOK_URL
// in Vercel's project environment variables so updating it doesn't require a
// redeploy.
//
// SECURITY: no hardcoded fallback here anymore. This repo is public, and a
// hardcoded secret/URL in a public repo is effectively a public secret. Both
// env vars below are now REQUIRED -- if either is missing, publishing still
// marks the payslip published (see below) but skips the webhook call rather
// than silently using a leaked value.
// IMPORTANT: rotate N8N_PUBLISH_WEBHOOK_SECRET's value in the n8n workflow's
// "Valid Secret?" node -- the old hardcoded value must be treated as
// compromised since it was committed to this public repo.
const N8N_WEBHOOK_URL = process.env.N8N_PUBLISH_PAYSLIP_WEBHOOK_URL;
const N8N_WEBHOOK_SECRET = process.env.N8N_PUBLISH_WEBHOOK_SECRET;

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
  // fails (tunnel down, network hiccup, etc.) -- or the env vars are simply
  // not configured -- the payslip is still marked published; the workflow's
  // 10-minute polling fetch (also filtered to published=true) picks it up
  // as a fallback, just not instantly.
  if (!N8N_WEBHOOK_URL || !N8N_WEBHOOK_SECRET) {
    console.error('N8N_PUBLISH_PAYSLIP_WEBHOOK_URL or N8N_PUBLISH_WEBHOOK_SECRET is not configured.');
    return NextResponse.json({ published: true, emailTriggered: false });
  }

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