import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createSupabaseAdminClient } from '@/lib/server/supabase-admin';

function getClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip');
}

export async function POST(request: Request) {
  try {
    // --- Step 1: Office network check, same as time-in. ---
    if (process.env.NODE_ENV === 'production') {
      const allowedIps = (process.env.OFFICE_ALLOWED_IPS || '')
        .split(',')
        .map((ip) => ip.trim())
        .filter(Boolean);

      if (allowedIps.length === 0) {
        return NextResponse.json(
          {
            code: 'ATTENDANCE_NETWORK_UNAVAILABLE',
            error: 'Attendance recording is temporarily unavailable. Please contact HR or IT.',
          },
          { status: 503 }
        );
      }

      const clientIp = getClientIp(request);
      if (!clientIp || !allowedIps.includes(clientIp)) {
        return NextResponse.json(
          {
            code: 'OUTSIDE_OFFICE_NETWORK',
            error: 'Time Out is only available on the authorized office network.',
          },
          { status: 403 }
        );
      }
    }

    // --- Step 2: Verify the caller is an authenticated employee. ---
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
      data: { user },
      error: userError,
    } = await supabaseServer.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const { data: callerProfile, error: profileError } = await supabaseServer
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single();

    if (profileError || callerProfile?.role !== 'employee' || callerProfile.is_active === false) {
      return NextResponse.json(
        { error: 'Only active employee accounts can record attendance.' },
        { status: 403 }
      );
    }

    const { data: recordingSetting } = await supabaseServer
      .from('app_settings')
      .select('value')
      .eq('key', 'attendance_recording_enabled')
      .maybeSingle();

    if (recordingSetting?.value === false) {
      return NextResponse.json(
        { code: 'ATTENDANCE_RECORDING_DISABLED', error: 'Attendance recording is temporarily unavailable.' },
        { status: 503 }
      );
    }

    // --- Step 3: Find today's log (Manila calendar day) for this user. ---
    const now = new Date();
    const logDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(now);

    const supabaseAdmin = createSupabaseAdminClient();
    const { data: todayLog, error: fetchError } = await supabaseAdmin
      .from('attendance_logs')
      .select('id, time_out')
      .eq('user_id', user.id)
      .eq('log_date', logDate)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!todayLog) {
      return NextResponse.json(
        { error: "You haven't timed in today yet." },
        { status: 400 }
      );
    }

    if (todayLog.time_out) {
      return NextResponse.json(
        { error: 'You have already timed out today.' },
        { status: 409 }
      );
    }

    // --- Step 4: Set time_out to the server clock (can't be spoofed by
    // the client), same tamper-resistance approach as time_in. ---
    const { data: updatedLog, error: updateError } = await supabaseAdmin
      .from('attendance_logs')
      .update({ time_out: now.toISOString() })
      .eq('id', todayLog.id)
      .is('time_out', null)
      .select('time_out')
      .maybeSingle();

    if (updateError) throw updateError;

    if (!updatedLog) {
      return NextResponse.json(
        { error: 'You have already timed out today.' },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, timeOut: updatedLog.time_out });
  } catch (err: unknown) {
    console.error('Error recording time-out:', err);
    return NextResponse.json(
      { error: 'Failed to record time-out.' },
      { status: 500 }
    );
  }
}
