import type { SupabaseClient } from '@supabase/supabase-js';
import { cutoffDates, isRecord, payslipAnswer, payslipCutoffFromQuestion, periodDates, validateClassification, validatePayslip, type Classification } from '@/lib/employee/ask-ai';

export class EmployeeAIError extends Error {
  constructor(message: string, public status = 503) { super(message); }
}
export const MAX_PDF_BYTES = 4 * 1024 * 1024;
export async function workflowCall(url: string | undefined, payload: unknown, timeout = 20_000): Promise<unknown> {
  const secret = process.env.N8N_EMPLOYEE_AI_WEBHOOK_SECRET;
  if (!url || !secret) throw new EmployeeAIError('Ask AI is not configured yet. Please contact HR.');
  const endpoint = new URL(url);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password) throw new EmployeeAIError('Ask AI configuration is invalid.');
  const response = await fetch(endpoint, {
    method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(timeout),
    headers: { 'Content-Type': 'application/json', 'x-employee-ai-secret': secret, 'ngrok-skip-browser-warning': 'true' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new EmployeeAIError('The AI service is unavailable. Please try again later.');
  // Bound upstream output before parsing. Never return raw workflow errors/data.
  const reader = response.body?.getReader();
  if (!reader) throw new EmployeeAIError('Empty AI response.');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 32_768) { await reader.cancel(); throw new EmployeeAIError('Invalid AI response.'); }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export async function ownedPayslip(client: SupabaseClient, userId: string, id?: string, cutoff?: string) {
  let query = client.from('payslips').select('id, user_id, cutoff_period, cutoff_label, file_path, published').eq('user_id', userId).eq('published', true);
  if (id) query = query.eq('id', id);
  if (cutoff) query = query.eq('cutoff_period', cutoff);
  const { data, error } = await query.order('cutoff_period', { ascending: false }).order('uploaded_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new EmployeeAIError('Unable to read your payslip.');
  if (!data) throw new EmployeeAIError('No matching published payslip is available for your account.', 404);
  // Defense in depth even if an upstream policy is accidentally broadened.
  if (data.user_id !== userId || data.published !== true || typeof data.file_path !== 'string' || !data.file_path.startsWith(`${userId}/`) || data.file_path.includes('..') || !data.file_path.toLowerCase().endsWith('.pdf')) throw new EmployeeAIError('Payslip access denied.', 403);
  cutoffDates(data.cutoff_period);
  return data;
}
export async function downloadOwnedPdf(client: SupabaseClient, path: string) {
  const { data, error } = await client.storage.from('payslips').download(path);
  if (error || !data) throw new EmployeeAIError('Unable to download your payslip.');
  if (data.size > MAX_PDF_BYTES) throw new EmployeeAIError('This PDF is too large for Ask AI (maximum 4 MB). Please open My Payslips.', 422);
  const bytes = Buffer.from(await data.arrayBuffer());
  if (bytes.subarray(0, 5).toString() !== '%PDF-') throw new EmployeeAIError('The payslip is not a valid PDF.', 422);
  return bytes;
}
type Context = { client: SupabaseClient; userId: string; fullName: string; question: string; language: string; payslipId?: string; requestId: string };
export async function answerEmployeeQuestion(ctx: Context, call = workflowCall) {
  const { client, userId, question, payslipId, requestId } = ctx;
  const raw = await call(process.env.N8N_EMPLOYEE_AI_CLASSIFIER_URL, { question, language: ctx.language, request_id: requestId });
  let c: Classification;
  try { c = validateClassification(raw); } catch { throw new EmployeeAIError('I could not safely understand that question. Please rephrase.', 422); }
  const tl = ctx.language === 'tl' || (ctx.language !== 'en' && c.language === 'tl');
  if (c.intent === 'restricted_other_employee') return { answer: tl ? 'Sorry, hindi puwedeng ibahagi ang private information ng ibang employee.' : 'Sorry, we cannot share another employee’s private information.' };
  if (c.intent === 'help' || c.intent === 'unsupported') return { answer: tl ? 'Puwede kitang tulungan sa sarili mong attendance, leave, at payslip, o work email ng employee o mga employee ayon sa designation. Itanong lang, halimbawa: “Ano ang deductions ko sa August 16–31, 2026?”' : 'I can help with your attendance, leave, and payslip, or an employee’s work email. Just ask, for example: “What are my deductions for August 16–31, 2026?”' };
  if (c.intent === 'own_payslip') {
    let cutoff: string | null;
    try { cutoff = payslipCutoffFromQuestion(question); }
    catch (error) { return { answer: tl ? 'Anong cutoff ang gusto mong basahin? Isama ang buwan, dates at taon sa tanong, halimbawa: “Ano ang deductions ko sa August 16–31, 2026?”' : (error as Error).message }; }
    const slip = await ownedPayslip(client, userId, payslipId, cutoff ?? undefined);
    const pdf = await downloadOwnedPdf(client, slip.file_path);
    const result = await call(process.env.N8N_EMPLOYEE_AI_PAYSLIP_URL, { pdf_base64: pdf.toString('base64'), request_id: requestId }, 60_000);
    try {
      if (!isRecord(result) || result.success !== true || result.request_id !== requestId) throw new Error('Invalid extraction');
      const extraction = validatePayslip(result.extraction, ctx.fullName, slip.cutoff_period);
      return { answer: payslipAnswer(extraction, c.metric, slip.cutoff_label, tl) };
    } catch { throw new EmployeeAIError(tl ? 'Hindi ko makumpirma ang pangalan, cutoff, o amounts sa PDF. Buksan ang original payslip o kontakin ang HR.' : 'I could not verify the name, cutoff, or amounts in this PDF. Please open the original payslip or contact HR.', 422); }
  }
  if (c.intent === 'directory_by_designation') {
    // Only approved directory fields, with literal designation text (no caller wildcards).
    const { data, error } = await client.from('profiles').select('full_name, employee_email, designation').eq('role', 'employee').eq('is_active', true).ilike('designation', `%${c.target_name}%`).order('full_name').limit(101);
    if (error) throw new EmployeeAIError('Unable to read the employee directory.');
    if (!data?.length) return { answer: tl ? `Walang active employee na may matching designation: ${c.target_name}.` : `No active employees match the designation: ${c.target_name}.` };
    const entries = data.slice(0, 100).map(p => `${p.full_name}\nDesignation: ${p.designation}\nWork email: ${p.employee_email || (tl ? 'Hindi nakalista' : 'Not listed')}`);
    return { answer: `${tl ? 'Mga active employee na may designation na tumutugma sa' : 'Active employees with a designation matching'} "${c.target_name}":\n\n${entries.join('\n\n')}${data.length > 100 ? (tl ? '\n\nUnang 100 matches lang ang ipinapakita. Gumamit ng mas specific na designation.' : '\n\nShowing the first 100 matches. Use a more specific designation.') : ''}` };
  }
  if (c.intent === 'directory_lookup') {
    const { data, error } = await client.from('profiles').select('full_name, employee_email, designation').eq('role', 'employee').eq('is_active', true).ilike('full_name', `%${c.target_name}%`).limit(2);
    if (error) throw new EmployeeAIError('Unable to read the employee directory.');
    if (!data?.length) return { answer: tl ? 'Walang matching active employee sa directory.' : 'No matching active employee in the directory.' };
    if (data.length > 1) return { answer: tl ? 'May higit sa isang match. Pakibigay ang buong pangalan.' : 'More than one match. Please use the full name.' };
    const p = data[0]; const parts = [p.full_name];
    if (c.metric !== 'designation') parts.push(`Work email: ${p.employee_email || 'Not listed'}`);
    if (c.metric !== 'company_email') parts.push(`Designation: ${p.designation || 'Not listed'}`);
    return { answer: parts.join('\n') };
  }
  const { start, end, year } = periodDates(c.period);
  if (c.intent === 'own_leave_balance') {
    const { data, error } = await client.from('leave_credits').select('total_credits, used_credits').eq('user_id', userId).eq('year', year).maybeSingle();
    if (error) throw new EmployeeAIError('Unable to read your leave balance.');
    if (!data) return { answer: tl ? `Wala pang recorded leave balance para sa ${year}. Kontakin ang HR.` : `No recorded leave balance for ${year}. Please contact HR.` };
    const values: Record<string, string> = { remaining_credits: `Remaining: ${data.total_credits - data.used_credits}`, total_credits: `Total: ${data.total_credits}`, used_credits: `Used: ${data.used_credits}`, leave_balance_summary: `Total: ${data.total_credits}; Used: ${data.used_credits}; Remaining: ${data.total_credits - data.used_credits}` };
    return { answer: `${tl ? 'Sarili mong annual leave credits' : 'Your annual leave credits'} (${year}): ${values[c.metric]}` };
  }
  // Fetch only allowed columns, scoped by the verified session, never classifier identity.
  if (c.intent === 'own_attendance') {
    if (c.metric === 'last_absent_date') {
      let query = client.from('attendance_logs').select('log_date').eq('user_id', userId).eq('status', 'Absent').lte('log_date', end);
      if (c.period !== 'all_time') query = query.gte('log_date', start);
      const { data, error } = await query.order('log_date', { ascending: false }).limit(1).maybeSingle();
      if (error) throw new EmployeeAIError('Unable to read your last recorded absence.');
      const range = c.period === 'all_time' ? '' : ` (${start} – ${end})`;
      if (!data) return { answer: tl ? `Wala kang recorded na may status na Absent${range}.` : `You have no records tagged Absent${range}.` };
      return { answer: tl ? `Huli kang naka-tag na Absent noong ${data.log_date}${range}. Batay ito sa attendance status, hindi sa kawalan ng time-in.` : `Your most recent record tagged Absent was ${data.log_date}${range}. This uses the attendance status, not a missing time-in.` };
    }
    const { data, error } = await client.from('attendance_logs').select('log_date, status, time_in, time_out').eq('user_id', userId).gte('log_date', start).lte('log_date', end).order('log_date').limit(1000);
    if (error || (data?.length ?? 0) >= 1000) throw new EmployeeAIError('Unable to read a complete attendance summary.');
    const rows = data ?? [];
    if (c.metric === 'time_in' || c.metric === 'time_out') {
      const time = (v: string | null) => v ? new Date(v).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila' }) : 'Not recorded';
      return { answer: `${tl ? 'Sarili mong attendance' : 'Your attendance'} (${start} – ${end}, Asia/Manila):\n${rows.slice(-31).map(r => `${r.log_date}: ${time(r[c.metric as 'time_in' | 'time_out'])}`).join('\n') || 'No recorded logs.'}${rows.length > 31 ? '\nShowing the latest 31 recorded days.' : ''}` };
    }
    const counts = { absent_count: 0, late_count: 0, present_count: 0, leave_day_count: 0 };
    for (const r of rows) {
      const s = r.status?.toLowerCase() ?? '';
      if (s === 'absent') counts.absent_count++;
      else if (s.includes('leave')) counts.leave_day_count++;
      else if (s === 'present' || s === 'late' || s === 'excused') counts.present_count++;
      if (s === 'late') counts.late_count++;
    }
    const labels = { absent_count: 'Absent', late_count: 'Late', present_count: 'Present (includes late)', leave_day_count: 'Leave days' };
    const keys = c.metric === 'attendance_summary' ? Object.keys(counts) : [c.metric];
    return { answer: `${tl ? 'Sarili mong recorded attendance' : 'Your recorded attendance'} (${start} – ${end}):\n${keys.map(k => `${labels[k as keyof typeof labels]}: ${counts[k as keyof typeof counts]}`).join('\n')}\n${tl ? 'Hindi binibilang na absent ang araw na walang log.' : 'Days without a log are not counted as absences.'}` };
  }
  const { data, error } = await client.from('leave_requests').select('status').eq('user_id', userId).gte('start_date', start).lte('start_date', end).limit(1000);
  if (error || (data?.length ?? 0) >= 1000) throw new EmployeeAIError('Unable to read your complete leave history.');
  const rows = data ?? [];
  const counts: Record<string, number> = { leave_request_count: rows.length, approved_count: rows.filter(r => r.status === 'Approved').length, pending_count: rows.filter(r => r.status === 'Pending').length, rejected_count: rows.filter(r => r.status === 'Rejected').length };
  return { answer: `${tl ? 'Sarili mong leave requests na nagsisimula' : 'Your leave requests starting'} ${start} – ${end}:\n${(c.metric === 'leave_history_summary' ? Object.keys(counts) : [c.metric]).map(k => `${k.replaceAll('_', ' ')}: ${counts[k]}`).join('\n')}` };
}
