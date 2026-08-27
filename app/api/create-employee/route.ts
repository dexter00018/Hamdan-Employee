import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { email, password, fullName, employeeId, designation, role } =
      await request.json();

    if (!email || !password || !fullName) {
      return NextResponse.json(
        { error: 'Email, password, and full name are required.' },
        { status: 400 }
      );
    }

    if (typeof password !== 'string' || password.length < 12) {
      return NextResponse.json(
        { error: 'Password must be at least 12 characters.' },
        { status: 400 }
      );
    }

    // --- Step 1: Verify the caller is an authenticated admin/super_admin ---
    // Without this check, anyone who discovers this URL could POST to it
    // and create accounts (including admin accounts) with no login at
    // all. This mirrors the same verification pattern already used in
    // app/api/admin/update-password/route.ts.
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

    if (
      callerProfileError ||
      !['admin', 'super_admin'].includes(callerProfile?.role ?? '')
    ) {
      return NextResponse.json(
        { error: 'Only admins can create accounts.' },
        { status: 403 }
      );
    }

    // --- Step 1.5: Server-side role allowlist ---
    // The UI only ever offers "Employee" or "HR Admin", but this is an
    // API endpoint -- a crafted request could send role: "super_admin"
    // (or anything else) directly. Never trust the role value coming
    // from the browser; only these two roles are ever creatable here,
    // and there is intentionally no path in this app that lets an
    // ordinary admin create or promote someone to super_admin.
    const requestedRole = role || 'employee';
    const allowedCreateRoles: readonly string[] = callerProfile.role === 'super_admin'
      ? ['employee', 'admin']
      : ['employee'];

    if (!allowedCreateRoles.includes(requestedRole)) {
      return NextResponse.json(
        {
          error: callerProfile.role === 'admin' && requestedRole === 'admin'
            ? 'Only a Super Admin can create another admin account.'
            : 'Invalid account role.',
        },
        { status: callerProfile.role === 'admin' ? 403 : 400 }
      );
    }

    // --- Step 2: Use the service role client to create the account ---
    // This runs ONLY on the server (never shipped to the browser), so
    // it's safe to use the service_role key here — it bypasses RLS and
    // can create auth users directly. NEVER use this key in any
    // client-side code or NEXT_PUBLIC_ env var.
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Create the auth user directly via the admin API. This does NOT
    // sign them in on this browser (unlike supabase.auth.signUp), so the
    // Super Admin's own session stays untouched.
    const { data: userData, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // skip email verification, admin-created account
      });

    if (createError) {
      throw new Error(createError.message);
    }

    const newUserId = userData.user.id;

    // Create/update their profile row with role, designation, etc.
    // (Use upsert in case a DB trigger already auto-inserted a bare
    // profile row on auth user creation.)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: newUserId,
        full_name: fullName,
        employee_id: employeeId || null,
        designation: designation || null,
        role: requestedRole,
      });

    if (profileError) {
      // Roll back the auth user so we don't end up with an orphaned
      // login that has no profile / role.
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error(profileError.message);
    }

    return NextResponse.json({ success: true, userId: newUserId });
  } catch (err: unknown) {
    console.error('Error creating employee:', err);
    const message = err instanceof Error ? err.message : 'Failed to create account.';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
