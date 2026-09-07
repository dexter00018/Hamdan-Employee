export const intentMetrics = {
  own_attendance: ['absent_count', 'last_absent_date', 'late_count', 'present_count', 'leave_day_count', 'attendance_summary', 'time_in', 'time_out'],
  own_leave_balance: ['remaining_credits', 'total_credits', 'used_credits', 'leave_balance_summary'],
  own_leave_history: ['leave_request_count', 'approved_count', 'pending_count', 'rejected_count', 'leave_history_summary'],
  own_payslip: ['basic_pay', 'gross_pay', 'net_pay', 'deductions', 'payslip_summary'],
  directory_lookup: ['company_email', 'designation', 'directory_profile'],
  directory_by_designation: ['company_email', 'directory_profile'],
  restricted_other_employee: ['none'], help: ['none'], unsupported: ['none'],
} as const;
export type Intent = keyof typeof intentMetrics;
export type Classification = { intent: Intent; metric: string; period: 'today' | 'current_month' | 'current_year' | 'all_time' | 'selected_payslip'; target_scope: 'self' | 'other' | 'none'; target_name: string; language: 'tl' | 'en' };
export const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export function validateClassification(v: unknown): Classification {
  if (!isRecord(v) || v.success !== true || typeof v.intent !== 'string' || !Object.hasOwn(intentMetrics, v.intent)) throw new Error('Invalid classification');
  const intent = v.intent as Intent;
  if (!(intentMetrics[intent] as readonly unknown[]).includes(v.metric) || !['today', 'current_month', 'current_year', 'all_time', 'selected_payslip'].includes(String(v.period)) ||
    !['tl', 'en'].includes(String(v.language)) || typeof v.target_name !== 'string' || !['self', 'other', 'none'].includes(String(v.target_scope))) throw new Error('Invalid classification');
  if (intent.startsWith('own_') && (v.target_scope !== 'self' || v.target_name !== '')) throw new Error('Invalid owner scope');
  if ((intent === 'own_payslip') !== (v.period === 'selected_payslip')) throw new Error('Invalid period');
  if (v.period === 'all_time' && !(intent === 'own_attendance' && v.metric === 'last_absent_date')) throw new Error('Invalid period');
  if (intent === 'directory_by_designation' && (v.target_scope !== 'other' || !/^[\p{L}\p{M}][\p{L}\p{M}\p{N} ()/'&.-]{1,79}$/u.test(v.target_name))) throw new Error('Invalid designation lookup');
  if (intent === 'directory_lookup' && (v.target_scope !== 'other' || !/^[\p{L}\p{M} .'-]{2,80}$/u.test(v.target_name))) throw new Error('Invalid directory lookup');
  return { intent, metric: v.metric as string, period: v.period as Classification['period'], target_scope: v.target_scope as Classification['target_scope'], target_name: v.target_name, language: v.language as 'tl' | 'en' };
}
export function periodDates(period: string, now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return { start: period === 'current_year' ? `${today.slice(0, 4)}-01-01` : period === 'current_month' ? `${today.slice(0, 7)}-01` : today, end: today, year: Number(today.slice(0, 4)) };
}
export function cutoffDates(cutoff: string) {
  const match = /^(\d{4})-(0[1-9]|1[0-2]):H([12])$/.exec(cutoff);
  if (!match) throw new Error('Invalid payslip period');
  const [, y, m, half] = match;
  return { start: `${y}-${m}-${half === '1' ? '01' : '16'}`, end: `${y}-${m}-${half === '1' ? '15' : new Date(Date.UTC(Number(y), Number(m), 0)).getUTCDate()}` };
}
/** Resolve only explicit supported payroll periods; never silently substitute latest. */
export function payslipCutoffFromQuestion(question: string, now = new Date()): string | null {
  const q = question.toLowerCase().replace(/[–—]/g, '-');
  const months = ['jan(?:uary)?|enero', 'feb(?:ruary)?|pebrero', 'mar(?:ch)?|marso', 'apr(?:il)?|abril', 'may|mayo', 'jun(?:e)?|hunyo', 'jul(?:y)?|hulyo', 'aug(?:ust)?|agosto', 'sep(?:t(?:ember)?)?|setyembre', 'oct(?:ober)?|oktubre', 'nov(?:ember)?|nobyembre', 'dec(?:ember)?|disyembre'];
  const monthMatches = months.map((pattern, index) => ({ index, match: new RegExp(index === 4 ? '\\b(?:may|mayo)\\b(?=\\s+(?:\\d|first|second|h[12]))|\\b(?:for|sa|noong|of)\\s+(?:may|mayo)\\b' : `\\b(?:${pattern})\\b`).exec(q) })).filter(item => item.match);
  if (new Set(q.match(/\b20\d{2}\b/g)).size > 1) throw new Error('Please ask about one cutoff at a time.');
  const iso = /\b(20\d{2})-(0[1-9]|1[0-2])\s*:?\s*h([12])\b/.exec(q);
  if (iso) return `${iso[1]}-${iso[2]}:H${iso[3]}`;
  if (monthMatches.length === 1) {
    const year = /\b(20\d{2})\b/.exec(q)?.[1] ?? String(periodDates('today', now).year);
    const month = monthMatches[0].index + 1;
    const lastDay = new Date(Date.UTC(Number(year), month, 0)).getUTCDate();
    const first = /\b1\s*(?:-|to|hanggang)\s*15\b|\b(?:first|1st)\s+(?:half|cutoff)\b|\bh1\b/.test(q);
    const second = new RegExp(`\\b16\\s*(?:-|to|hanggang)\\s*${lastDay}\\b|\\b(?:second|2nd)\\s+(?:half|cutoff)\\b|\\bh2\\b`).test(q);
    if (first === second) throw new Error('Please specify the cutoff, for example “August 1–15, 2026” or “August 16–31, 2026”.');
    return `${year}-${String(month).padStart(2, '0')}:H${first ? '1' : '2'}`;
  }
  if (monthMatches.length || /\b20\d{2}\b|\d\s*[-/]\s*\d|\b(?:month|year|previous|yesterday|buwan|taon|kahapon|nakaraan|noong|noon)\b/.test(q)) throw new Error('Which cutoff do you mean? Include the month, dates and year, for example “August 16–31, 2026”.');
  return null;
}
export type PayslipExtraction = {
  readable: boolean; employee_name: string; period_start: string; period_end: string; currency: string | null;
  basic_pay: number | null; gross_pay: number | null; net_pay: number | null; total_deductions: number | null;
  deductions: { label: string; amount: number | null }[];
};
export function validatePayslip(v: unknown, fullName: string, cutoff: string): PayslipExtraction {
  if (!isRecord(v) || v.readable !== true || typeof v.employee_name !== 'string') throw new Error('Unreadable payslip');
  // Order-independent but exact name tokens. No fuzzy identity guesses.
  const nameKey = (name: string) => name.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().match(/[\p{L}\p{N}]+/gu)?.sort().join(' ');
  if (!nameKey(fullName) || nameKey(v.employee_name) !== nameKey(fullName)) throw new Error('Payslip name mismatch');
  const period = cutoffDates(cutoff);
  if (v.period_start !== period.start || v.period_end !== period.end) throw new Error('Payslip period mismatch');
  const amount = (n: unknown) => n === null || (typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 1e9 && Math.abs(n * 100 - Math.round(n * 100)) < 0.001);
  for (const key of ['basic_pay', 'gross_pay', 'net_pay', 'total_deductions']) if (!amount(v[key])) throw new Error('Invalid amount');
  if (v.currency !== null && !['PHP', 'USD', 'AED', 'SAR', 'EUR'].includes(String(v.currency))) throw new Error('Invalid currency');
  if (!Array.isArray(v.deductions) || v.deductions.length > 40) throw new Error('Invalid deductions');
  const deductions = v.deductions.map(item => {
    if (!isRecord(item) || typeof item.label !== 'string' || !/^[\p{L}\p{N} .()/'&-]{1,80}$/u.test(item.label) || !amount(item.amount)) throw new Error('Invalid deduction');
    return { label: item.label, amount: item.amount as number | null };
  });
  if (v.gross_pay !== null && v.total_deductions !== null && v.net_pay !== null &&
    Math.abs(Math.round(Number(v.gross_pay) * 100) - Math.round(Number(v.total_deductions) * 100) - Math.round(Number(v.net_pay) * 100)) > 1) throw new Error('Payslip totals disagree');
  if (v.total_deductions !== null && deductions.length && deductions.every(d => d.amount !== null) &&
    Math.abs(deductions.reduce((sum, d) => sum + Math.round(d.amount! * 100), 0) - Math.round(Number(v.total_deductions) * 100)) > 1) throw new Error('Deduction totals disagree');
  return { readable: true, employee_name: v.employee_name, period_start: period.start, period_end: period.end, currency: v.currency as string | null,
    basic_pay: v.basic_pay as number | null, gross_pay: v.gross_pay as number | null, net_pay: v.net_pay as number | null, total_deductions: v.total_deductions as number | null, deductions };
}
export function payslipAnswer(p: PayslipExtraction, metric: string, label: string, tl: boolean) {
  const money = (n: number | null) => n === null ? (tl ? 'Hindi nakasaad / hindi malinaw' : 'Not stated / unclear') : `${p.currency ? `${p.currency} ` : ''}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const lines = [tl ? `Sa payslip mo para sa ${label}:` : `Your payslip for ${label}:`];
  if (metric === 'basic_pay' || metric === 'payslip_summary') lines.push(`Basic pay (${tl ? 'para sa cutoff' : 'for this cutoff'}): ${money(p.basic_pay)}`);
  if (metric === 'gross_pay' || metric === 'payslip_summary') lines.push(`Gross compensation: ${money(p.gross_pay)}`);
  if (metric === 'deductions' || metric === 'payslip_summary') {
    for (const d of p.deductions) lines.push(`${d.label}: ${money(d.amount)}`);
    lines.push(`Total deductions: ${money(p.total_deductions)}`);
  }
  if (metric === 'net_pay' || metric === 'payslip_summary') lines.push(`Net pay: ${money(p.net_pay)}`);
  lines.push(tl ? 'Binasa mula sa PDF. I-check ang original payslip para makumpirma.' : 'Read from the PDF. Check the original payslip to confirm.');
  return lines.join('\n');
}
