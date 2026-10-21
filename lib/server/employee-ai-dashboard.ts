import type { SupabaseClient } from '@supabase/supabase-js';
import { EmployeeAIError } from '@/lib/server/employee-ai';

type Language = 'auto' | 'tl' | 'en';
type DashboardQuestion = 'attendance_streak' | 'company_holiday' | 'offset_balance' | 'start_date' | 'project_start' | 'employment_status';

const normalize = (value: string) => value
  .normalize('NFKD')
  .replace(/\p{M}/gu, '')
  .toLowerCase()
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

function detectLanguage(question: string, requested: Language) {
  if (requested === 'tl' || requested === 'en') return requested;
  const q = normalize(question);
  return /\b(ako|ko|akin|ang|ano|sino|kanino|yung|ba|po|aking|meron|kailan|kelan|susunod|mga|ikatagal|katagal|nagsimula|nag simula|dito)\b/i.test(q) ? 'tl' : 'en';
}

// "How does X work?" style questions belong in the system-knowledge base;
// only personal "when/my/how much" questions get a local data answer.
const HOWTO = /\b(paano|how does|how do|how to|how can|bakit|why|ibig sabihin|gumagana)\b/;
const PROJECT_WORDS = /\b(project|manpower|tracker|tracking)\b/;
const START_WORDS = /\b(nagsimula|nag simula|sinimulan|umpisa|umpisahan|nagumpisa|nag umpisa|started|start date|start ko|nagsimula ako|hired|hire date|joining|joined|join|first day|unang araw|unang pumasok|unang time in|first time in|nag trabaho|nagtrabaho)\b/;
const START_LOOSE = /\b(start|began|simula)\b/;
const TENURE_WORDS = /\b(how long|gaano katagal|gaano na|katagal na|been working|been here)\b/;
const OFFSET_PERSONAL = /\b(ilan|mag kano|magkano|balance|natitira|matitira|tira|available|left|remaining|meron|mayroon|still|have left|leftover|hours? ko|time credit)\b/;
const STATUS_WORDS = /\b(employment status|status of employment|regular na ba|regular ba|contractual ba|probationary)\b/;

// Same-day dashboard alignment as the top cards: Ask AI answers streak,
// holiday, offset-balance, and start-date questions with the exact data
// and math the employee dashboard uses.
export function detectDashboardQuestion(question: string): DashboardQuestion | null {
  const q = normalize(question);
  if (!q) return null;

  if (
    /\b(attendance|work)\s+streak\b/.test(q) ||
    /\bstreak\b/.test(q) ||
    /\bconsecutive\s+(work\s+)?days?\b/.test(q)
  ) return 'attendance_streak';

  // Offset balance stays live even under the how-to guard below; only the
  // explanatory Offset questions fall through to system knowledge.
  if (
    /\boffset\b/.test(q) &&
    OFFSET_PERSONAL.test(q) &&
    !/\b(how does|paano gumagana|paano ang offset|what is offset|ano ang offset|how (do|can) i (use|apply|earn))\b/.test(q)
  ) return 'offset_balance';

  if (
    /\b(next|upcoming|susunod|kasunod)\b.*\b(holidays?|holiday ko)\b/.test(q) ||
    /\b(holidays?)\b.*\b(next|upcoming|susunod|kasunod|pagkatapos|after)\b/.test(q) ||
    /\b(when is|when does|kailan|kelan)\b.*\b(holidays?|walang pasok)\b/.test(q) ||
    /\bmga\s+((company\s+)?holidays?|non working)\b/.test(q)
  ) return 'company_holiday';

  // Shift-time questions ("What time do I start?") are schedule facts,
  // not hired-date questions.
  if (/\b(what time|anong oras|oras ng|shift (time|starts?))\b/.test(q)) return null;

  if (PROJECT_WORDS.test(q) && (START_WORDS.test(q) || START_LOOSE.test(q) || TENURE_WORDS.test(q)) && !HOWTO.test(q)) return 'project_start';

  if ((START_WORDS.test(q) || START_LOOSE.test(q) || TENURE_WORDS.test(q)) && !HOWTO.test(q)) return 'start_date';

  if (STATUS_WORDS.test(q)) return 'employment_status';

  return null;
}

export function manilaToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
}

export { detectLanguage as detectChatLanguage };

type LocalPayslipMetric = 'basic_pay' | 'gross_pay' | 'net_pay' | 'deductions' | 'payslip_summary';
export type LocalPayslipAsk = { metric: LocalPayslipMetric; cutoffMode: 'latest' | 'current_month' | 'explicit' };
const PAYSLIP_SUBJECT = /\b(payslips?|deductions?|kaltas|kaltasan|net pay|net income|gross pay|gross|basic pay|base pay|sweldo|sahod)\b/;
const PAYSLIP_EXCLUDE = /\b(where|saan|nasaan|password|security|secure|privacy|access|configure|meaning)\b/;
const PAYSLIP_PERSONAL = /\b(ko|my|akin|ako|latest)\b/;

// Payslip questions about the signed-in employee's own pay skip the n8n
// classifier and go straight to the verified payslip pipeline (password
// re-auth still applies). Explanatory and "where is" questions stay with
// system knowledge.
export function detectPayslipQuestion(question: string): LocalPayslipAsk | null {
  const q = normalize(question);
  if (!q) return null;
  if (!PAYSLIP_SUBJECT.test(q) || PAYSLIP_EXCLUDE.test(q) || !PAYSLIP_PERSONAL.test(q)) return null;
  if (/\b(paano|how does|how do|how to|how can|bakit|why|ibig sabihin|gumagana)\b/.test(q)) return null;

  let metric: LocalPayslipMetric = 'payslip_summary';
  if (/\b(net pay|net income|take home)\b/.test(q)) metric = 'net_pay';
  else if (/\bgross\b/.test(q)) metric = 'gross_pay';
  else if (/\b(basic pay|base pay)\b/.test(q)) metric = 'basic_pay';
  else if (/\b(deductions?|kaltas|kaltasan)\b/.test(q)) metric = 'deductions';

  let cutoffMode: LocalPayslipAsk['cutoffMode'] = 'explicit';
  if (/\b(ngayong (month|buwan|cutoff)|this (month|cutoff)|current (month|cutoff)|itong (month|buwan|cutoff))\b/.test(q)) cutoffMode = 'current_month';
  else if (/\b(latest|pinakabago|huling published|most recent)\b/.test(q)) cutoffMode = 'latest';

  return { metric, cutoffMode };
}

// Same streak math as the dashboard card: consecutive work days with no
// Late or Absent tag; approved Leave days are skipped, not counted or broken.
export function streakFromRows(rows: { log_date: string; status: string | null }[], today: string) {
  const sorted = rows
    .filter(row => row.log_date && row.log_date <= today)
    .sort((a, b) => (a.log_date < b.log_date ? 1 : -1));
  let streak = 0;
  for (const row of sorted) {
    const status = row.status?.toLowerCase() ?? '';
    if (status === 'late' || status === 'absent') break;
    if (status.includes('leave')) continue;
    streak += 1;
  }
  return streak;
}

function streakTone(streak: number, tl: boolean) {
  if (streak === 0) return tl ? 'Simulan mo ang streak ngayong araw!' : 'Start your streak today!';
  if (streak < 5) return tl ? 'Magandang simula!' : 'Nice start!';
  if (streak < 10) return tl ? 'Great job!' : 'Great job!';
  if (streak < 20) return tl ? 'Impressive!' : 'Impressive!';
  return tl ? 'Outstanding!' : 'Outstanding!';
}

// Same as the dashboard calendar helper: whole days between Manila today
// and the holiday date.
export function daysUntil(dateStr: string, today: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86_400_000);
}

function formatFullDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatHolidayDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function tenureBetween(startDate: string, today: string, tl: boolean) {
  const [y, m, d] = startDate.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  let months = (ty - y) * 12 + (tm - m);
  if (td < d) months -= 1;
  if (months <= 0) return tl ? 'pasong-buwan pa lang' : 'less than a month';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years && rest) return tl ? `${years} taon at ${rest} buwan` : `${years} year${years === 1 ? '' : 's'} and ${rest} month${rest === 1 ? '' : 's'}`;
  if (years) return tl ? `${years} taon` : `${years} year${years === 1 ? '' : 's'}`;
  return tl ? `${months} buwan` : `${months} month${months === 1 ? '' : 's'}`;
}

export async function answerEmployeeDashboardQuestion(params: {
  client: SupabaseClient;
  userId: string;
  question: string;
  language: Language;
}) {
  const metric = detectDashboardQuestion(params.question);
  if (!metric) return null;
  const tl = detectLanguage(params.question, params.language) === 'tl';
  const today = manilaToday();

  if (metric === 'attendance_streak') {
    // Bounded to the current year, matching the dashboard's history fetch.
    const year = today.slice(0, 4);
    const { data, error } = await params.client
      .from('attendance_logs')
      .select('log_date, status')
      .eq('user_id', params.userId)
      .gte('log_date', `${year}-01-01`)
      .lte('log_date', today)
      .order('log_date', { ascending: false })
      .limit(1000);
    if (error || (data?.length ?? 0) >= 1000) throw new EmployeeAIError('Unable to read your attendance streak.');
    const streak = streakFromRows(data ?? [], today);
    return {
      answer: tl
        ? `Ang attendance streak mo ngayong ${year} ay ${streak} magkasunod na work day${streak === 1 ? '' : 's'} nang walang Late o Absent tag (hindi binibilang ang approved Leave). ${streakTone(streak, tl)}`
        : `Your attendance streak for ${year} is ${streak} consecutive work day${streak === 1 ? '' : 's'} with no Late or Absent tag (approved Leave is not counted). ${streakTone(streak, tl)}`,
      source: 'dashboard_live',
    };
  }

  if (metric === 'offset_balance') {
    // Exactly the Offset Hours card math: earned minus used/converted
    // transactions, minus everything still held by pending requests.
    const [txRes, pendingUseRes, pendingEarlyOutRes, pendingLeaveRes] = await Promise.all([
      params.client.from('offset_transactions').select('kind, hours, minutes').eq('user_id', params.userId).limit(2000),
      params.client.from('offset_usage_requests').select('required_minutes, hours').eq('user_id', params.userId).eq('status', 'Pending').limit(1000),
      params.client.from('early_out_offset_requests').select('required_minutes').eq('user_id', params.userId).eq('status', 'Pending').limit(1000),
      params.client.from('leave_requests').select('offset_minutes_required').eq('user_id', params.userId).eq('status', 'Pending').eq('funding_source', 'offset').limit(1000),
    ]);
    if (txRes.error || pendingUseRes.error || pendingEarlyOutRes.error || pendingLeaveRes.error) throw new EmployeeAIError('Unable to read your offset information.');
    if ((txRes.data?.length ?? 0) >= 2000 || (pendingUseRes.data?.length ?? 0) >= 1000 || (pendingEarlyOutRes.data?.length ?? 0) >= 1000 || (pendingLeaveRes.data?.length ?? 0) >= 1000) throw new EmployeeAIError('Unable to read a complete offset summary.');
    const approvedMinutes = ((txRes.data ?? []) as { kind: string; hours: number; minutes: number }[]).reduce((total, tx) => {
      const amount = (tx.hours || 0) * 60 + (tx.minutes || 0);
      return total + (tx.kind === 'earned' ? amount : -amount);
    }, 0);
    const pendingUseMinutes = ((pendingUseRes.data ?? []) as { required_minutes?: number | null; hours?: number | null }[]).reduce(
      (total, req) => total + Number(req.required_minutes ?? (req.hours || 0) * 60), 0);
    const pendingEarlyMinutes = ((pendingEarlyOutRes.data ?? []) as { required_minutes?: number | null }[]).reduce(
      (total, req) => total + Number(req.required_minutes || 0), 0);
    const pendingLeaveMinutes = ((pendingLeaveRes.data ?? []) as { offset_minutes_required?: number | null }[]).reduce(
      (total, req) => total + Number(req.offset_minutes_required || 0), 0);
    const reserved = pendingUseMinutes + pendingEarlyMinutes + pendingLeaveMinutes;
    const available = Math.max(0, approvedMinutes - reserved);
    const fmt = (minutes: number) => {
      const safe = Math.max(0, Math.round(minutes));
      const hrs = Math.floor(safe / 60);
      const mins = safe % 60;
      if (hrs && mins) return `${hrs}h ${mins}m`;
      if (hrs) return `${hrs}h`;
      return `${mins}m`;
    };
    if (approvedMinutes === 0) {
      return {
        answer: tl
          ? 'Wala ka pang approved offset balance ngayon. Earned muna ang kailangan i-approve bago magamit. (Kontakin ang HR kung sa tingin mo ay may kulang.)'
          : 'You have no approved offset balance yet. Earned requests must be approved before they become usable. (Contact HR if you think something is missing.)',
        source: 'dashboard_live',
      };
    }
    return {
      answer: tl
        ? `May natitira kang ${fmt(available)} na available offset. Approved balance: ${fmt(approvedMinutes)}${reserved ? `; reserved: ${fmt(reserved)} sa mga pending requests` : ''}.`
        : `You have ${fmt(available)} of available offset left. Approved balance: ${fmt(approvedMinutes)}${reserved ? `; reserved: ${fmt(reserved)} by pending requests` : ''}.`,
      source: 'dashboard_live',
    };
  }

  if (metric === 'company_holiday') {
    const { data, error } = await params.client
      .from('holidays')
      .select('holiday_date, name')
      .gte('holiday_date', today)
      .order('holiday_date', { ascending: true })
      .limit(30);
    if (error) throw new EmployeeAIError('Unable to read the company calendar.');
    const upcoming = data ?? [];
    if (!upcoming.length) {
      return {
        answer: tl
          ? 'Wala pang naka-schedule na company holiday ngayon. Tingnan ang Company Calendar kapag may nag-set na ang HR.'
          : 'No company holiday is scheduled yet. Check the Company Calendar once HR sets one up.',
        source: 'dashboard_live',
      };
    }
    // "After Christmas"-style anchor: a named holiday in the question picks
    // that row, and the answer becomes the next holiday after it.
    const q = normalize(params.question);
    let anchorIndex = upcoming.findIndex((h) => {
      const name = normalize(String(h.name ?? ''));
      return name.split(' ').some((token) => token.length >= 5 && q.includes(token));
    });
    if (upcoming[0].name && q.includes(normalize(String(upcoming[0].name))) && anchorIndex < 0) anchorIndex = 0;
    if (anchorIndex >= 0) {
      const anchor = upcoming[anchorIndex];
      const next = upcoming[anchorIndex + 1];
      if (!next) {
        return {
          answer: tl
            ? `${anchor.name || 'Company holiday'} (${formatHolidayDate(anchor.holiday_date)}) ang huling naka-schedule na company holiday sa ngayon.`
            : `${anchor.name || 'Company holiday'} (${formatHolidayDate(anchor.holiday_date)}) is the last scheduled company holiday so far.`,
          source: 'dashboard_live',
        };
      }
      const nextDays = daysUntil(next.holiday_date, today);
      const nextWhen = nextDays === 0 ? (tl ? 'ngayong araw' : 'today') : nextDays === 1 ? (tl ? 'bukas' : 'tomorrow') : (tl ? `sa loob ng ${nextDays} araw` : `in ${nextDays} days`);
      return {
        answer: tl
          ? `Pagkatapos ng ${anchor.name || 'company holiday'} (${formatHolidayDate(anchor.holiday_date)}), ang susunod na holiday ay ${next.name || 'Company holiday'} — ${formatHolidayDate(next.holiday_date)} (${nextWhen}).`
          : `After ${anchor.name || 'the company holiday'} (${formatHolidayDate(anchor.holiday_date)}), the next holiday is ${next.name || 'Company holiday'} — ${formatHolidayDate(next.holiday_date)} (${nextWhen}).`,
        source: 'dashboard_live',
      };
    }
    const first = upcoming[0];
    const firstDays = daysUntil(first.holiday_date, today);
    const when = firstDays === 0 ? (tl ? 'ngayong araw' : 'today') : firstDays === 1 ? (tl ? 'bukas' : 'tomorrow') : (tl ? `sa loob ng ${firstDays} araw` : `in ${firstDays} days`);
    const lines = [`${tl ? 'Ang susunod na company holiday ay' : 'The next company holiday is'} ${first.name || 'Company holiday'} — ${formatHolidayDate(first.holiday_date)} (${when}).`];
    // Anything else scheduled nearby, same as what the Company Calendar shows.
    const more = upcoming.slice(1, 4).map(h => `${h.name || 'Company holiday'} — ${formatHolidayDate(h.holiday_date)}`);
    if (more.length) lines.push(`${tl ? 'Ang mga sumunod pa:' : 'Also coming up:'}\n${more.join('\n')}`);
    return { answer: lines.join('\n'), source: 'dashboard_live' };
  }

  if (metric === 'project_start') {
    // "The project I started here": the employee's most recent tracked
    // project, then the earliest session on that same project.
    const latestRes = await params.client
      .from('manpower_sessions')
      .select('project_id, started_at')
      .eq('user_id', params.userId)
      .order('started_at', { ascending: false })
      .limit(1);
    if (latestRes.error) throw new EmployeeAIError('Unable to read your Manpower Tracker history.');
    const latest = (latestRes.data ?? [])[0];
    if (!latest?.project_id) {
      return {
        answer: tl ? 'Wala ka pang naitalang project time sa Manpower Tracker.' : 'You have no tracked project time in the Manpower Tracker yet.',
        source: 'dashboard_live',
      };
    }
    const [firstRes, projectRes] = await Promise.all([
      params.client.from('manpower_sessions').select('started_at').eq('user_id', params.userId).eq('project_id', latest.project_id).order('started_at', { ascending: true }).limit(1),
      params.client.from('manpower_projects').select('name').eq('id', latest.project_id).limit(1),
    ]);
    if (firstRes.error || projectRes.error) throw new EmployeeAIError('Unable to read your Manpower Tracker history.');
    const firstAt = (firstRes.data ?? [])[0]?.started_at as string | undefined;
    const projectName = (projectRes.data ?? [])[0]?.name || (tl ? 'latest project' : 'your latest project');
    if (!firstAt) {
      return {
        answer: tl ? `Hindi ko mahanap ang unang session sa ${projectName}.` : `I could not find the first record for ${projectName}.`,
        source: 'dashboard_live',
      };
    }
    const startedDate = formatFullDate(firstAt.slice(0, 10));
    return {
      answer: tl
        ? `Sa ${projectName} ka unang nagsimula mag-track noong ${startedDate}. Ito ang pinakabagong project mo sa Manpower Tracker.`
        : `You first started tracking time on ${projectName} on ${startedDate}. It is your most recent project in the Manpower Tracker.`,
      source: 'dashboard_live',
    };
  }

  if (metric === 'start_date') {
    // Hired date comes from the same government-IDs record the employee
    // dashboard profile uses; fall back to the earliest attendance log.
    const govRes = await params.client
      .from('employee_government_ids')
      .select('hired_date, employment_status')
      .eq('user_id', params.userId)
      .maybeSingle();
    if (govRes.error) throw new EmployeeAIError('Unable to read your employment start details.');
    const hired = govRes.data?.hired_date as string | undefined;
    const tenure = hired ? tenureBetween(hired, today, tl) : null;
    if (!hired) {
      const earliestRes = await params.client
        .from('attendance_logs')
        .select('log_date')
        .eq('user_id', params.userId)
        .order('log_date', { ascending: true })
        .limit(1);
      if (earliestRes.error) throw new EmployeeAIError('Unable to read your attendance history.');
      const earliest = (earliestRes.data ?? [])[0]?.log_date as string | undefined;
      return {
        answer: earliest
          ? (tl
            ? `Walang naka-record na hired date sa profile mo, pero ang unang attendance record mo ay noong ${formatFullDate(earliest)}. Kontakin ang HR kung kailangan ang eksaktong hired date.`
            : `There is no hired date recorded on your profile yet, but your first attendance record is ${formatFullDate(earliest)}. Contact HR if you need your exact hired date.`)
          : (tl ? 'Wala pang naka-record na hired date o attendance record sa profile mo. Kontakin ang HR.' : 'There is no hired date or attendance record on your profile yet. Contact HR.'),
        source: 'dashboard_live',
      };
    }
    return {
      answer: tl
        ? `Nagsimula ka sa Hamdan noong ${formatFullDate(hired)} — ${tenure} na ngayon.`
        : `You started at the company on ${formatFullDate(hired)} — that is ${tenure} as of today.`,
      source: 'dashboard_live',
    };
  }

  // employment_status
  const govRes = await params.client
    .from('employee_government_ids')
    .select('employment_status')
    .eq('user_id', params.userId)
    .maybeSingle();
  if (govRes.error) throw new EmployeeAIError('Unable to read your employment status.');
  const status = govRes.data?.employment_status as string | undefined;
  return {
    answer: status
      ? (tl ? `Ang employment status mo ay ${status}.` : `Your employment status is ${status}.`)
      : (tl ? 'Hindi pa naka-configure ang employment status sa profile mo. Kontakin ang HR/Admin.' : 'Your employment status is not configured yet. Contact HR/Admin.'),
    source: 'dashboard_live',
  };
}
