import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createSupabaseAdminClient } from '@/lib/server/supabase-admin';

// Fallback values used only if app_settings is somehow unreachable or
// missing rows -- keeps time-in from hard-failing over a settings read
// hiccup, while normal operation always uses the configurable values
// from the database (editable via Super Admin -> App Settings).
const FALLBACK_LATE_CUTOFF_HOUR = 9;
const FALLBACK_LATE_CUTOFF_MINUTE = 15;

function getClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip');
}

export async function POST(request: Request) {
  try {
    // --- Step 1: Office network check (server-side, can't be spoofed
    // by editing client JS -- unlike a client-only "disable the button"
    // check, this is the one that actually matters). ---
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
            error: 'Time In is only available on the authorized office network.',
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

    // --- Step 2.5: Read the configurable late cutoff from app_settings
    // (Super Admin -> App Settings). Falls back to the hardcoded
    // defaults above only if the rows are missing/unreachable, so a
    // settings-table hiccup never blocks someone from timing in. ---
    const { data: settingsRows } = await supabaseServer
      .from('app_settings')
      .select('key, value')
      .in('key', ['late_cutoff_hour', 'late_cutoff_minute', 'attendance_recording_enabled']);

    const settingsMap = Object.fromEntries((settingsRows || []).map((r) => [r.key, r.value]));
    if (settingsMap.attendance_recording_enabled === false) {
      return NextResponse.json(
        { code: 'ATTENDANCE_RECORDING_DISABLED', error: 'Attendance recording is temporarily unavailable.' },
        { status: 503 }
      );
    }
    const lateCutoffHour = typeof settingsMap.late_cutoff_hour === 'number' ? settingsMap.late_cutoff_hour : FALLBACK_LATE_CUTOFF_HOUR;
    const lateCutoffMinute = typeof settingsMap.late_cutoff_minute === 'number' ? settingsMap.late_cutoff_minute : FALLBACK_LATE_CUTOFF_MINUTE;

    // --- Step 3: Compute today's date and Present/Late status using
    // the SERVER clock in Manila time, not anything the client sends.
    // This closes the same "spoofed device clock" gap we fixed earlier
    // for the timestamp itself. ---
    const now = new Date();
    const manilaParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .formatToParts(now)
      .reduce<Record<string, string>>((acc, p) => {
        acc[p.type] = p.value;
        return acc;
      }, {});

    const logDate = `${manilaParts.year}-${manilaParts.month}-${manilaParts.day}`;
    const hour = parseInt(manilaParts.hour, 10);
    const minute = parseInt(manilaParts.minute, 10);
    const status =
      hour > lateCutoffHour || (hour === lateCutoffHour && minute > lateCutoffMinute)
        ? 'Late'
        : 'Present';

    // --- Step 4: Prevent double time-in for today. ---
    const supabaseAdmin = createSupabaseAdminClient();
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('attendance_logs')
      .select('id')
      .eq('user_id', user.id)
      .eq('log_date', logDate)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing) {
      return NextResponse.json(
        { error: 'You have already timed in today.' },
        { status: 409 }
      );
    }

    // --- Step 5: Insert through the server-only service-role client.
    // Employee INSERT/UPDATE policies are deliberately removed by
    // 06_attendance_rls_hardening.sql, so direct browser/Supabase REST
    // writes cannot bypass the office-network check above. ---
    const { error: insertError } = await supabaseAdmin
      .from('attendance_logs')
      .insert([{
        user_id: user.id,
        log_date: logDate,
        time_in: now.toISOString(),
        time_out: null,
        status,
      }]);

    if (insertError?.code === '23505') {
      return NextResponse.json(
        { error: 'You have already timed in today.' },
        { status: 409 }
      );
    }
    if (insertError) throw insertError;

    return NextResponse.json({ success: true, status, logDate });
  } catch (err: unknown) {
    console.error('Error recording time-in:', err);
    return NextResponse.json(
      { error: 'Failed to record time-in.' },
      { status: 500 }
    );
  }
}
