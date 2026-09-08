import type { SupabaseClient } from '@supabase/supabase-js';
import { classificationDates, designationPattern, cutoffDates, isRecord, payslipAnswer, payslipCutoffFromQuestion, periodDates, validateClassification, validatePayslip, type Classification, type ChatTurn } from '@/lib/employee/ask-ai';
import { SYSTEM_KNOWLEDGE, type SystemKnowledgeMetric } from '@/lib/employee/system-knowledge';

export class EmployeeAIError extends Error {
  constructor(message: string, public status = 503, public code?: string) { super(message); }
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
  let query = client.from('payslips').select('id, user_id, cutoff_period, cutoff_label, file_path, published, uploaded_at').eq('user_id', userId).eq('published', true);
  if (id) query = query.eq('id', id);
  if (cutoff) query = query.eq('cutoff_period', cutoff);
  if (cutoff || id) query = query.order('uploaded_at', { ascending: false }).order('cutoff_period', { ascending: false });
  else query = query.order('uploaded_at', { ascending: false });
  const { data, error } = await query.limit(1).maybeSingle();
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
type Context = { history?: ChatTurn[]; client: SupabaseClient; userId: string; fullName: string; question: string; language: string; payslipId?: string; payslipUnlocked?: boolean; requestId: string };
export async function answerEmployeeQuestion(ctx: Context, call = workflowCall) {
  const { client, userId, question, payslipId, requestId } = ctx;
  const raw = await call(process.env.N8N_EMPLOYEE_AI_CLASSIFIER_URL, { question, history: ctx.history ?? [], current_date: periodDates('today').today, language: ctx.language, request_id: requestId });
  let c: Classification;
  try { c = validateClassification(raw); } catch { throw new EmployeeAIError('I could not safely understand that question. Please rephrase.', 422); }
  const tl = ctx.language === 'tl' || (ctx.language !== 'en' && c.language === 'tl');
  if (c.intent === 'restricted_other_employee') return { answer: tl ? 'Sorry, hindi puwedeng ibahagi ang private information ng ibang employee.' : 'Sorry, we cannot share another employee’s private information.' };
  if (c.intent === 'how_to') {
    const entry = SYSTEM_KNOWLEDGE[c.metric as SystemKnowledgeMetric];
    return { answer: entry ? (tl ? entry.tl : entry.en) : (tl ? 'Hindi ko mahanap ang system guide para dito.' : 'I could not find a system guide for that.') };
  }
  if (c.intent === 'own_profile') {
    const { data, error } = await client.from('profiles').select('full_name, designation, employee_email').eq('id', userId).maybeSingle();
    if (error || !data) throw new EmployeeAIError('Unable to read your profile.');
    const missing = tl ? 'Hindi nakalista' : 'Not listed';
    const values: Record<string, string> = {
      full_name: `${tl ? 'Ang pangalan mo ay' : 'Your name is'} ${data.full_name || missing}.`,
      designation: `${tl ? 'Ang designation mo ay' : 'Your designation is'} ${data.designation || missing}.`,
      company_email: `${tl ? 'Ang work email mo ay' : 'Your work email is'} ${data.employee_email || missing}.`,
      profile_info: `${tl ? 'Ang pangalan mo ay' : 'Your name is'} ${data.full_name || missing}, ${tl ? 'at ang designation mo ay' : 'and your designation is'} ${data.designation || missing}.`,
    };
    return { answer: c.metric === 'profile_summary' ? [values.full_name, values.designation, values.company_email].join('\n') : values[c.metric] };
  }
  if (c.intent === 'clarification') {
    const prompts: Record<string, string> = tl
      ? { period: 'Anong buwan o taon ang tinutukoy mo? Maaari ring magbigay ng eksaktong date range.', topic: 'Ano ang gusto mong malaman sa period na iyon: attendance, leave requests, o payslip?', payroll_cutoff: 'Unang cutoff (1?15) o pangalawang cutoff (16?end of month)? Isama ang buwan at taon.', designation: 'Anong designation o team ang hinahanap mo, halimbawa IT, HR, o Architect?' }
      : { period: 'Which month or year do you mean? You can also give an exact date range.', topic: 'What would you like to check for that period: attendance, leave requests, or payslip?', payroll_cutoff: 'First cutoff (1?15) or second cutoff (16?end of month)? Include the month and year.', designation: 'Which designation or team do you mean, such as IT, HR, or Architect?' };
    return { answer: prompts[c.metric] };
  }
  if (c.intent === 'unsupported') return { answer: tl ? 'Hindi ko matukoy ang supported na request sa tanong mo. Pakilinaw kung profile, attendance, leave, payslip, o work directory ang tinutukoy mo.' : 'I could not identify a supported request in your question. Please clarify whether you mean your profile, attendance, leave, payslip, or the work directory.' };
  if (c.intent === 'help') return { answer: tl ? 'Puwede kitang tulungan sa sarili mong attendance, leave, at payslip, o work email ng employee o mga employee ayon sa designation. Itanong lang, halimbawa: “Ano ang deductions ko sa August 16–31, 2026?”' : 'I can help with your attendance, leave, and payslip, or an employee’s work email. Just ask, for example: “What are my deductions for August 16–31, 2026?”' };
  if (c.intent === 'own_payslip') {
    if (ctx.payslipUnlocked !== true) throw new EmployeeAIError(tl ? 'Kailangan munang i-confirm ang password bago ko basahin ang payslip details mo.' : 'Please confirm your password before I read your payslip details.', 403, 'payslip_reauth_required');
    let cutoff: string | null;
    try { cutoff = payslipCutoffFromQuestion(c.resolved_question ?? question); }
    catch (error) { return { answer: tl ? 'Anong cutoff ang gusto mong basahin? Isama ang buwan, dates at taon sa tanong, halimbawa: “Ano ang deductions ko sa August 16–31, 2026?”' : (error as Error).message }; }
    const slip = await ownedPayslip(client, userId, payslipId, cutoff ?? undefined);
    const pdf = await downloadOwnedPdf(client, slip.file_path);
    const result = await call(process.env.N8N_EMPLOYEE_AI_PAYSLIP_URL, { pdf_base64: pdf.toString('base64'), request_id: requestId }, 60_000);
    try {
      if (!isRecord(result) || result.success !== true || result.request_id !== requestId) throw new Error('Invalid extraction');
      const extraction = validatePayslip(result.extraction, ctx.fullName, slip.cutoff_period, { requirePeriod: cutoff !== null, requireName: cutoff !== null });
      return { answer: payslipAnswer(extraction, c.metric, slip.cutoff_label, tl) };
    } catch { throw new EmployeeAIError(tl ? 'Hindi ko makumpirma ang pangalan, cutoff, o amounts sa PDF. Buksan ang original payslip o kontakin ang HR.' : 'I could not verify the name, cutoff, or amounts in this PDF. Please open the original payslip or contact HR.', 422); }
  }
  if (c.intent === 'directory_by_designation') {
    // Only approved directory fields, with literal designation text (no caller wildcards).
    const { data, error } = await client.from('profiles').select('full_name, employee_email, designation').eq('role', 'employee').eq('is_active', true).ilike('designation', designationPattern(c.target_name)).order('full_name').limit(101);
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
  const dates = classificationDates(c);
  const { start, year } = dates;
  const end = c.intent === 'own_attendance' && dates.end > dates.today ? dates.today : dates.end;
  if (c.intent === 'own_attendance' && start > end) return { answer: tl ? 'Future pa ang period na iyon. Wala pang recorded attendance para rito.' : 'That period is in the future; there is no recorded attendance to summarize yet.' };
  if (c.intent === 'own_leave_balance') {
    if (start.slice(0, 4) !== end.slice(0, 4)) return { answer: tl ? 'Anong taon ng leave credits ang gusto mong tingnan? Isang taon bawat balance.' : 'Which year of leave credits would you like? Balances are recorded per year.' };
    const { data, error } = await client.from('leave_credits').select('total_credits, used_credits').eq('user_id', userId).eq('year', year).maybeSingle();
    if (error) throw new EmployeeAIError('Unable to read your leave balance.');
    if (!data) return { answer: tl ? `Wala pang recorded leave balance para sa ${year}. Kontakin ang HR.` : `No recorded leave balance for ${year}. Please contact HR.` };
    const remaining = data.total_credits - data.used_credits;
    const values: Record<string, string> = tl ? {
      remaining_credits: `May ${remaining} araw ka pang leave credits para sa ${year}.`,
      total_credits: `Ang kabuuang leave allocation mo para sa ${year} ay ${data.total_credits} araw.`,
      used_credits: `Nagamit mo na ang ${data.used_credits} araw ng leave credits mo para sa ${year}.`,
      leave_balance_summary: `Para sa ${year}: ${data.total_credits} araw ang allocation mo, ${data.used_credits} ang nagamit, at ${remaining} ang natitira.`,
    } : {
      remaining_credits: `You have ${remaining} days of leave credits remaining for ${year}.`,
      total_credits: `Your leave allocation for ${year} is ${data.total_credits} days.`,
      used_credits: `You have used ${data.used_credits} days of leave credits for ${year}.`,
      leave_balance_summary: `For ${year}, you have ${data.total_credits} allocated leave days, ${data.used_credits} used, and ${remaining} remaining.`,
    };
    return { answer: values[c.metric] };
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
    if (['absence_dates', 'late_dates', 'attendance_history'].includes(c.metric)) {
      const matching = rows.filter(r => c.metric === 'attendance_history' || r.status?.trim().toLowerCase() === (c.metric === 'absence_dates' ? 'absent' : 'late'));
      const entries = matching.slice(-100).map(r => `${r.log_date}: ${r.status}`).join('\n');
      return { answer: `${tl ? 'Sarili mong attendance records' : 'Your attendance records'} (${start} ? ${end}):\n${entries || (tl ? 'Walang matching record.' : 'No matching records.')}${matching.length > 100 ? '\nShowing the latest 100 matches.' : ''}` };
    }
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
    if (c.metric !== 'attendance_summary') {
      const count = counts[c.metric as keyof typeof counts];
      const descriptions: Record<string, string> = tl
        ? { absent_count: 'record na naka-tag na Absent', late_count: 'record na naka-tag na Late', present_count: 'present record (kasama ang Late)', leave_day_count: 'record na naka-tag na leave' }
        : { absent_count: 'records tagged Absent', late_count: 'records tagged Late', present_count: 'present records (including Late)', leave_day_count: 'records tagged as leave' };
      return { answer: tl ? `May ${count} kang ${descriptions[c.metric]} mula ${start} hanggang ${end}.` : `You have ${count} ${descriptions[c.metric]} from ${start} to ${end}.` };
    }
    const keys = Object.keys(counts);
    return { answer: `${tl ? 'Sarili mong recorded attendance' : 'Your recorded attendance'} (${start} – ${end}):\n${keys.map(k => `${labels[k as keyof typeof labels]}: ${counts[k as keyof typeof counts]}`).join('\n')}\n${tl ? 'Hindi binibilang na absent ang araw na walang log.' : 'Days without a log are not counted as absences.'}` };
  }
  const { data, error } = await client.from('leave_requests').select('status, start_date, end_date').eq('user_id', userId).gte('start_date', start).lte('start_date', end).order('start_date').limit(1000);
  if (error || (data?.length ?? 0) >= 1000) throw new EmployeeAIError('Unable to read your complete leave history.');
  const rows = data ?? [];
  const counts: Record<string, number> = { leave_request_count: rows.length, approved_count: rows.filter(r => r.status === 'Approved').length, pending_count: rows.filter(r => r.status === 'Pending').length, rejected_count: rows.filter(r => r.status === 'Rejected').length };
  const status = ({ approved_count: 'Approved', pending_count: 'Pending', rejected_count: 'Rejected' } as Record<string, string>)[c.metric];
  const matching = status ? rows.filter(r => r.status === status) : rows;
  const total = c.metric === 'leave_history_summary' ? rows.length : counts[c.metric];
  const heading = tl ? `May ${total} kang ${status ? status.toLowerCase() + ' ' : ''}leave request na nagsisimula sa ${start} hanggang ${end}.` : `You have ${total} ${status ? status.toLowerCase() + ' ' : ''}leave request${total === 1 ? '' : 's'} starting between ${start} and ${end}.`;
  const summary = c.metric === 'leave_history_summary' ? `\nApproved: ${counts.approved_count}; Pending: ${counts.pending_count}; Rejected: ${counts.rejected_count}` : '';
  const details = matching.slice(0, 20).map(r => `${r.start_date} ? ${r.end_date}: ${r.status}`).join('\n');
  return { answer: heading + summary + (details ? '\n' + details : '') + (matching.length > 20 ? (tl ? '\nUnang 20 requests ang ipinapakita.' : '\nShowing the first 20 requests.') : '') };
}
