import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

    if (!userId || typeof deactivate !== 'boolean') {
      return NextResponse.json({ error: 'Missing userId or deactivate flag.' }, { status: 400 });
    }

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
      return NextResponse.json({ error: banError.message }, { status: 500 });
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
      return NextResponse.json({ error: profileUpdateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: deactivate
        ? `${targetProfile.full_name ?? 'Account'} has been deactivated.`
        : `${targetProfile.full_name ?? 'Account'} has been reactivated.`,
    });
  } catch (err: any) {
    console.error('Error in deactivate-employee route:', err);
    return NextResponse.json({ error: err?.message ?? 'Something went wrong.' }, { status: 500 });
  }
}