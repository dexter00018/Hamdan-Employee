import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Same ngrok-tunnel setup as publish-payslip. Set N8N_BACKUP_WEBHOOK_URL in
// Vercel's env vars. Path matches the "Backup Webhook" node's configured
// path in the "Supabase Backup Notification" n8n workflow.
//
// SECURITY: no hardcoded fallback here anymore. This repo is public, and a
// hardcoded secret/URL in a public repo is effectively a public secret.
// Both N8N_BACKUP_WEBHOOK_URL and N8N_BACKUP_WEBHOOK_SECRET are REQUIRED
// env vars in Vercel now -- the route fails closed (503) if either is
// missing, rather than silently falling back to a leaked value.
// IMPORTANT: rotate N8N_BACKUP_WEBHOOK_SECRET's value in the n8n workflow's
// "Valid Secret?" node -- the old hardcoded value must be treated as
// compromised since it was committed to this public repo.
const N8N_WEBHOOK_URL = process.env.N8N_BACKUP_WEBHOOK_URL;
const N8N_WEBHOOK_SECRET = process.env.N8N_BACKUP_WEBHOOK_SECRET;

async function getAuthedSuperAdmin() {
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
          // No-op: read-only, this route doesn't refresh auth cookies.
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, isSuperAdmin: false };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  // Backup includes the full DB (incl. auth schema), so this is gated to
  // super_admin only -- stricter than the publish-payslip route, which
  // allows 'admin' too. Change to ['admin','super_admin'].includes(...)
  // if your profiles.role column doesn't actually use 'super_admin'.
  const isSuperAdmin = profile?.role === 'super_admin';
  return { user, isSuperAdmin };
}

export async function POST() {
  const { user, isSuperAdmin } = await getAuthedSuperAdmin();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }
  if (!isSuperAdmin) {
    return NextResponse.json(
      { error: 'Only super admins can trigger a database backup.' },
      { status: 403 }
    );
  }

  if (!N8N_WEBHOOK_URL || !N8N_WEBHOOK_SECRET) {
    console.error('N8N_BACKUP_WEBHOOK_URL or N8N_BACKUP_WEBHOOK_SECRET is not configured.');
    return NextResponse.json(
      { error: 'Database backup is not configured. Set N8N_BACKUP_WEBHOOK_URL and N8N_BACKUP_WEBHOOK_SECRET in Vercel.' },
      { status: 503 }
    );
  }

  try {
    const webhookRes = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Skips ngrok's free-tier interstitial warning page.
        'ngrok-skip-browser-warning': 'true',
        // Required by the workflow's "Valid Secret?" gate.
        'x-backup-secret': N8N_WEBHOOK_SECRET,
      },
      body: JSON.stringify({
        triggeredBy: user.email,
        triggeredAt: new Date().toISOString(),
      }),
    });

    if (!webhookRes.ok) {
      console.error('n8n backup webhook returned non-OK status:', webhookRes.status);
      return NextResponse.json(
        { error: 'Failed to reach the backup workflow. Check that the n8n tunnel and local listener are running.' },
        { status: 502 }
      );
    }
  } catch (err) {
    console.error('Error calling n8n backup webhook:', err);
    return NextResponse.json(
      { error: 'Failed to reach the backup workflow. Check that the n8n tunnel and local listener are running.' },
      { status: 502 }
    );
  }

  return NextResponse.json({ started: true });
}