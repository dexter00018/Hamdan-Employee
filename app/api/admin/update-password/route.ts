// app/api/admin/update-password/route.ts
//
// Utility/backup route: lets a verified admin directly set a new password
// for a user (e.g. if the user is locked out of their email and can't use
// the email-link reset flow). NOT wired into the main Super Admin UI —
// the dashboard uses supabase.auth.resetPasswordForEmail() instead, which
// is more secure since it requires the user to have access to their email.
//
// This route is safe to keep around for manual/edge-case use, since it now
// verifies the caller is an authenticated admin before doing anything.

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    // Kunin ang data mula sa frontend
    const { userId, newPassword } = await req.json();

    // Validation: Siguraduhin na may userId at newPassword
    if (!userId || !newPassword) {
      return NextResponse.json(
        { error: 'User ID and New Password are required' },
        { status: 400 }
      );
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // --- Step 1: Verify the caller is an authenticated admin ---
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

    if (callerProfileError || callerProfile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can reset passwords.' },
        { status: 403 }
      );
    }

    // --- Step 2: Use the service role client to update the password ---
    // Ligtas ito dahil nasa loob ng server-side route lang gagamitin
    // ang SERVICE_ROLE_KEY, hindi ito lalabas sa browser.
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

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, message: 'Password updated successfully' });
  } catch (error: any) {
    console.error('Error updating password:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
