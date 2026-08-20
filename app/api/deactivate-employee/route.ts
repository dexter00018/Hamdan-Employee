import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Service-role client -- same pattern as /api/create-employee. Needed
// because banning/unbanning a login (auth.users.banned_until) requires
// the Supabase Admin API, which only works with the service_role key,
// never the anon/publishable key used on the client.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: Request) {
  try {
    const { userId, deactivate } = await request.json();

    if (!userId || typeof userId !== 'string' || typeof deactivate !== 'boolean') {
      return NextResponse.json({ error: 'Missing userId or deactivate flag.' }, { status: 400 });
    }

    // --- Step 1: Verify the caller is an authenticated super_admin ---
    // Without this, anyone who discovers this URL could POST to it and
    // deactivate/reactivate any non-super-admin account with no login
    // at all. This mirrors the same verification pattern already used
    // in app/api/create-employee/route.ts, app/api/check-email/route.ts,
    // and app/api/admin/update-password/route.ts -- except this route is
    // scoped tighter to super_admin only, since deactivating a coworker's
    // login is more sensitive than the actions those routes gate.
    const cookieStore = await cookies();

    const supabaseServer = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            // no-op: we don't need to set cookies in this API route
          },
        },
      }
    );

    const {
      data: { user: callerUser },
      error: callerError,
    } = await supabaseServer.auth.getUser();

    if (callerError || !callerUser) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const { data: callerProfile, error: callerProfileError } = await supabaseServer
      .from('profiles')
      .select('role')
      .eq('id', callerUser.id)
      .single();

    if (callerProfileError || callerProfile?.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Only Super Admins can deactivate or reactivate accounts.' },
        { status: 403 }
      );
    }

    // --- Step 2: Caller is confirmed super_admin -- safe to use the
    // service-role client for the privileged operation below. ---

    // Guard: never let a super_admin account get deactivated through
    // this route -- prevents accidentally locking yourself (or another
    // super admin) out of the system.
    const { data: targetProfile, error: profileFetchError } = await supabaseAdmin
      .from('profiles')
      .select('role, full_name')
      .eq('id', userId)
      .single();

    if (profileFetchError || !targetProfile) {
      return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });
    }

    if (targetProfile.role === 'super_admin') {
      return NextResponse.json({ error: 'Super Admin accounts cannot be deactivated from here.' }, { status: 403 });
    }

    // Ban (or unban) the actual login. ban_duration accepts a Go
    // duration string -- there's no literal "forever", so 10 years
    // ("87600h") is used as a practical permanent ban. Passing "none"
    // clears any existing ban.
    const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: deactivate ? '87600h' : 'none',
    });

    if (banError) {
      console.error('Error updating ban status:', banError);
      return NextResponse.json({ error: 'Failed to update account status.' }, { status: 500 });
    }

    // Mirror the state in profiles.is_active so the rest of the app
    // (employee lists, dashboards) can just read this column instead of
    // needing admin-level access to check auth.users directly.
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({ is_active: !deactivate })
      .eq('id', userId);

    if (profileUpdateError) {
      console.error('Error updating profile is_active:', profileUpdateError);
      return NextResponse.json({ error: 'Failed to update account status.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: deactivate
        ? `${targetProfile.full_name ?? 'Account'} has been deactivated.`
        : `${targetProfile.full_name ?? 'Account'} has been reactivated.`,
    });
  } catch (err: any) {
    console.error('Error in deactivate-employee route:', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}