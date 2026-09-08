import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { PAYSLIP_REAUTH_COOKIE, PAYSLIP_REAUTH_SECONDS, createPayslipReauthToken } from '@/lib/server/employee-ai-reauth';
import { EmployeeAIError } from '@/lib/server/employee-ai';
import { isRecord } from '@/lib/employee/ask-ai';

export const runtime = 'nodejs';

const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });

async function authenticate() {
  const jar = await cookies();
  const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => jar.getAll(), setAll: values => values.forEach(({ name, value, options }) => jar.set(name, value, options)) },
  });
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user?.email) throw new EmployeeAIError('Please sign in again before confirming payslip access.', 401);
  const { data: profile, error: profileError } = await client.from('profiles').select('role, is_active').eq('id', user.id).single();
  if (profileError || profile?.role !== 'employee' || profile?.is_active !== true) throw new EmployeeAIError('Only active employee accounts can confirm payslip access.', 403);
  return { userId: user.id, email: user.email };
}

function failure(error: unknown) {
  return json({ success: false, error: error instanceof EmployeeAIError ? error.message : 'Unable to confirm payslip access.' }, error instanceof EmployeeAIError ? error.status : 503);
}

export async function POST(request: Request) {
  try {
    const auth = await authenticate();
    if (!request.headers.get('content-type')?.startsWith('application/json') || request.headers.get('sec-fetch-site') === 'cross-site') return json({ success: false, error: 'Invalid request.' }, 400);
    let body: unknown;
    try { body = await request.json(); } catch { return json({ success: false, error: 'Invalid JSON.' }, 400); }
    if (!isRecord(body) || Object.keys(body).some(k => k !== 'password') || typeof body.password !== 'string' || body.password.length < 1 || body.password.length > 200) return json({ success: false, error: 'Password is required.' }, 400);

    const verifier = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await verifier.auth.signInWithPassword({ email: auth.email, password: body.password });
    if (error || data.user?.id !== auth.userId) throw new EmployeeAIError('Incorrect password.', 401);

    const response = json({ success: true, expires_in: PAYSLIP_REAUTH_SECONDS });
    response.cookies.set(PAYSLIP_REAUTH_COOKIE, createPayslipReauthToken(auth.userId), {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: PAYSLIP_REAUTH_SECONDS,
      path: '/',
    });
    return response;
  } catch (error) {
    return failure(error);
  }
}
