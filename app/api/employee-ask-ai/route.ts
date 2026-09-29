import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/server/supabase-admin';
import { answerEmployeeQuestion, EmployeeAIError } from '@/lib/server/employee-ai';
import { answerLiveOffsetOrManpower } from '@/lib/server/employee-ai-live';
import { answerEmployeeProfileQuestion } from '@/lib/server/employee-ai-profile';
import { PAYSLIP_REAUTH_COOKIE, verifyPayslipReauthToken } from '@/lib/server/employee-ai-reauth';
import { isRecord, validateHistory } from '@/lib/employee/ask-ai';
import { answerKnownSystemQuestion } from '@/lib/employee/system-question-answer';

export const runtime = 'nodejs';
export const maxDuration = 120;
const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function cookieValue(jar: Awaited<ReturnType<typeof cookies>>, name: string) {
  return typeof jar.get === 'function' ? jar.get(name)?.value : jar.getAll().find(cookie => cookie.name === name)?.value;
}
async function authenticate() {
  const jar = await cookies();
  const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => jar.getAll(), setAll: values => values.forEach(({ name, value, options }) => jar.set(name, value, options)) },
  });
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new EmployeeAIError('Please sign in to use Ask AI.', 401);
  const { data: profile, error: profileError } = await client.from('profiles').select('role, is_active, full_name').eq('id', user.id).single();
  if (profileError || profile?.role !== 'employee' || profile?.is_active !== true) throw new EmployeeAIError('Only active employee accounts can use Ask AI.', 403);
  return { client, userId: user.id, fullName: profile.full_name ?? '' };
}
function failure(error: unknown) {
  const body = { success: false, error: error instanceof EmployeeAIError ? error.message : 'Ask AI is temporarily unavailable. Please try again later.', ...(error instanceof EmployeeAIError && error.code === 'payslip_reauth_required' ? { reauth_required: true } : {}) };
  return json(body, error instanceof EmployeeAIError ? error.status : 503);
}
export async function GET(request: Request) {
  try {
    const { client, userId } = await authenticate();
    if (new URL(request.url).searchParams.has('payslip_id')) return json({ success: false, error: 'PDF downloads are not available in Ask AI.' }, 410);
    const { data, error } = await client.from('payslips').select('id, cutoff_label, cutoff_period').eq('user_id', userId).eq('published', true).order('cutoff_period', { ascending: false }).order('uploaded_at', { ascending: false }).limit(100);
    if (error) throw new EmployeeAIError('Unable to load your payslip list.');
    return json({ success: true, payslips: data, configured: !!(process.env.N8N_EMPLOYEE_AI_CLASSIFIER_URL && process.env.N8N_EMPLOYEE_AI_WEBHOOK_SECRET), payslip_reader_configured: !!process.env.N8N_EMPLOYEE_AI_PAYSLIP_URL });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    // Re-verify the cookie session on every request, before reading chat input.
    // Only this user ID may scope private queries; the classifier provides intent only.
    const auth = await authenticate();
    // JSON-only endpoint: browsers cannot submit a cross-origin simple form POST.
    if (!request.headers.get('content-type')?.startsWith('application/json') || request.headers.get('sec-fetch-site') === 'cross-site') return json({ success: false, error: 'Invalid request.' }, 400);
    const reader = request.body?.getReader();
    if (!reader) return json({ success: false, error: 'A question is required.' }, 400);
    let length = 0; const chunks: Uint8Array[] = [];
    while (true) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > 65536) { await reader.cancel(); return json({ success: false, error: 'Request is too large.' }, 413); } chunks.push(value); }
    let body: unknown;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return json({ success: false, error: 'Invalid JSON.' }, 400); }
    if (!isRecord(body) || Object.keys(body).some(k => !['question', 'language', 'payslip_id', 'history'].includes(k)) || typeof body.question !== 'string' || !body.question.trim() || body.question.trim().length > 500 || (body.language !== undefined && !['auto', 'tl', 'en'].includes(String(body.language))) || (body.payslip_id !== undefined && (typeof body.payslip_id !== 'string' || !uuid.test(body.payslip_id)))) return json({ success: false, error: 'Use a question of 1–500 characters and a valid payslip selection.' }, 400);
    let history;
    try { history = validateHistory(body.history); } catch { return json({ success: false, error: 'Invalid conversation history.' }, 400); }
    const { data: allowed, error } = await createSupabaseAdminClient().rpc('consume_api_rate_limit', { p_scope: 'employee-ask-ai', p_user_id: auth.userId, p_limit: 5, p_window_seconds: 60 });
    if (error) throw new EmployeeAIError('Ask AI rate limiting is unavailable. Please try later.');
    if (allowed !== true) return NextResponse.json({ success: false, error: 'Too many questions. Please wait a minute.' }, { status: 429, headers: { ...headers, 'Retry-After': '60' } });
    const requestId = crypto.randomUUID();
    const language = String(body.language ?? 'auto') as 'auto' | 'tl' | 'en';
    const question = body.question.trim();

    // Self-profile and hierarchy questions are answered directly from the verified employee session.
    // This handles varied English/Tagalog wording without exposing another employee's private data.
    const profileAnswer = await answerEmployeeProfileQuestion({ client: auth.client, userId: auth.userId, question, language });
    if (profileAnswer) return json({ success: true, ...profileAnswer, request_id: requestId });

    // Fast path for known portal/workflow questions. This keeps system help current and
    // avoids an n8n/Gemini round-trip when no private/live employee data is needed.
    const localSystemAnswer = answerKnownSystemQuestion(question, language);
    if (localSystemAnswer) return json({ success: true, answer: localSystemAnswer, request_id: requestId, source: 'system_knowledge' });

    // Live Offset and Manpower questions use the updated n8n classifier, while private
    // values are queried only here with the verified Supabase session and user ID.
    const liveAnswer = await answerLiveOffsetOrManpower({
      client: auth.client,
      userId: auth.userId,
      question,
      history,
      language,
      requestId,
    });
    if (liveAnswer) return json({ success: true, ...liveAnswer, request_id: requestId });

    const payslipUnlocked = verifyPayslipReauthToken(cookieValue(await cookies(), PAYSLIP_REAUTH_COOKIE), auth.userId);
    const answer = await answerEmployeeQuestion({ ...auth, history, question, language, payslipId: body.payslip_id as string | undefined, payslipUnlocked, requestId });
    return json({ success: true, ...answer, request_id: requestId });
  } catch (error) { return failure(error); }
}
