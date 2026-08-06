import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Same ngrok-tunnel setup as publish-payslip. Set N8N_BACKUP_WEBHOOK_URL in
// Vercel's env vars; this hardcoded value is only a local-dev fallback.
// Path matches the "Backup Webhook" node's configured path in the
// "Supabase Backup Notification" n8n workflow.
const N8N_WEBHOOK_URL =
  process.env.N8N_BACKUP_WEBHOOK_URL ||
  'https://yearly-goggles-proved.ngrok-free.dev/webhook/backup-notification';

// Must match the value in the workflow's "Valid Secret?" node exactly.
// Set N8N_BACKUP_WEBHOOK_SECRET in Vercel's env vars.
const N8N_WEBHOOK_SECRET =
  process.env.N8N_BACKUP_WEBHOOK_SECRET ||
  's_oVQRRvyqMX-XG63ZRYiriZ0xSUkoz681MpxCdNiMc';

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