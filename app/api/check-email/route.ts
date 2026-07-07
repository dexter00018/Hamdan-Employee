import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
    }

    // Verify the caller is an authenticated admin/super_admin -- same
    // pattern as create-employee and update-password routes.
    const cookieStore = await cookies();

    const supabaseServer = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
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

    const { data: callerProfile } = await supabaseServer
      .from('profiles')
      .select('role')
      .eq('id', callerUser.id)
      .single();

    if (!['admin', 'super_admin'].includes(callerProfile?.role ?? '')) {
      return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });
    }

    // Use the service role client to call the email_exists() Postgres
    // function (see email_exists_function.sql) -- returns a boolean
    // only, never the actual list of registered emails.
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: exists, error } = await supabaseAdmin.rpc('email_exists', {
      check_email: email,
    });

    if (error) throw error;

    return NextResponse.json({ exists: !!exists });
  } catch (err: any) {
    console.error('Error checking email:', err);
    return NextResponse.json({ error: 'Failed to check email.' }, { status: 500 });
  }
}