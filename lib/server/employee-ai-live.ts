import type { SupabaseClient } from '@supabase/supabase-js';
import { isRecord, periodDates, validateDateRange, type ChatTurn } from '@/lib/employee/ask-ai';
import { EmployeeAIError, workflowCall } from '@/lib/server/employee-ai';

type Language = 'auto' | 'tl' | 'en';
type LiveIntent = 'own_offset' | 'own_manpower';
export type LiveClassification = {
  intent: LiveIntent;
  metric: string;
  period: 'today' | 'yesterday' | 'current_month' | 'previous_month' | 'current_year' | 'previous_year' | 'custom';
  target_scope: 'self';
  target_name: '';
  language: 'tl' | 'en';
  date_start?: string;
  date_end?: string;
  request_id?: string;
};

const OFFSET_METRICS = new Set(['approved_balance', 'available_balance', 'reserved_balance', 'pending_offset', 'earned_offset', 'used_offset', 'offset_history', 'offset_summary']);
const MANPOWER_METRICS = new Set(['current_project', 'tracker_status', 'tracked_time', 'today_tracked_time', 'manpower_history', 'manpower_summary']);
const PERIODS = new Set(['today', 'yesterday', 'current_month', 'previous_month', 'current_year', 'previous_year', 'custom']);
const LIVE_HINT = /\b(offset|comp\s*time|compensatory\s*time|time\s*credit|manpower|tracker|tracking|tracked|track|project\s+(?:hours?|time)|hours?\s+tracked)\b/i;

export function mightNeedLiveOffsetOrManpower(question: string, history: ChatTurn[] = []) {
  return LIVE_HINT.test(question) || history.slice(-4).some(turn => LIVE_HINT.test(turn.content));
}

function normalizeLiveClassification(raw: Record<string, unknown>): LiveClassification {
  if (!['own_offset', 'own_manpower'].includes(String(raw.intent))) throw new EmployeeAIError('I could not safely understand that question. Please rephrase.', 422);
  const intent = raw.intent as LiveIntent;
  const metrics = intent === 'own_offset' ? OFFSET_METRICS : MANPOWER_METRICS;
  if (typeof raw.metric !== 'string' || !metrics.has(raw.metric) || typeof raw.period !== 'string' || !PERIODS.has(raw.period) || raw.target_scope !== 'self' || raw.target_name !== '' || !['tl', 'en'].includes(String(raw.language))) {
    throw new EmployeeAIError('I could not safely understand that question. Please rephrase.', 422);
  }
  const c: LiveClassification = {
    intent,
    metric: raw.metric,
    period: raw.period as LiveClassification['period'],
    target_scope: 'self',
    target_name: '',
    language: raw.language as 'tl' | 'en',
  };
  if (c.period === 'custom') {
    const range = validateDateRange(raw.date_start, raw.date_end);
    c.date_start = range.start;
    c.date_end = range.end;
  } else if (raw.date_start !== undefined || raw.date_end !== undefined) {
    throw new EmployeeAIError('I could not safely understand that question. Please rephrase.', 422);
  }
  return c;
}

function parseLiveClassification(raw: unknown, requestId: string): LiveClassification | null {
  if (!isRecord(raw) || raw.success !== true || raw.request_id !== requestId || !['own_offset', 'own_manpower'].includes(String(raw.intent))) return null;
  return normalizeLiveClassification(raw);
}

function rangeFor(c: LiveClassification) {
  if (c.period === 'custom') {
    const range = validateDateRange(c.date_start, c.date_end);
    return { start: range.start, end: range.end };
  }
  const range = periodDates(c.period);
  return { start: range.start, end: range.end };
}

function manilaRangeIso(start: string, end: string) {
  const startIso = new Date(`${start}T00:00:00+08:00`).toISOString();
  const endExclusive = new Date(new Date(`${end}T00:00:00+08:00`).getTime() + 86_400_000).toISOString();
  return { startIso, endExclusive };
}

function formatMinutes(value: number) {
  const total = Math.max(0, Math.round(value));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function formatDurationMs(ms: number) {
  return formatMinutes(ms / 60_000);
}

function transactionMinutes(row: { hours?: number | null; minutes?: number | null }) {
  return Math.max(0, Number(row.hours || 0) * 60 + Number(row.minutes || 0));
}

async function offsetAnswer(client: SupabaseClient, userId: string, c: LiveClassification, tl: boolean) {
  const balanceMetric = ['approved_balance', 'available_balance', 'reserved_balance', 'pending_offset', 'offset_summary'].includes(c.metric);
  const { start, end } = rangeFor(c);
  const { startIso, endExclusive } = manilaRangeIso(start, end);

  let txQuery = client.from('offset_transactions').select('kind,hours,minutes,created_at,note').eq('user_id', userId).order('created_at', { ascending: false }).limit(2000);
  if (!balanceMetric) txQuery = txQuery.gte('created_at', startIso).lt('created_at', endExclusive);
  const [txRes, pendingUseRes, pendingLeaveRes, pendingEarnRes] = await Promise.all([
    txQuery,
    client.from('offset_usage_requests').select('hours,status,created_at').eq('user_id', userId).eq('status', 'Pending').limit(1000),
    client.from('leave_requests').select('offset_minutes_required,status,created_at').eq('user_id', userId).eq('funding_source', 'offset').eq('status', 'Pending').limit(1000),
    client.from('offset_requests').select('eligible_hours,status,created_at').eq('user_id', userId).eq('status', 'Pending').limit(1000),
  ]);
  if (txRes.error || pendingUseRes.error || pendingLeaveRes.error || pendingEarnRes.error) throw new EmployeeAIError('Unable to read your offset information.');
  if ((txRes.data?.length ?? 0) >= 2000 || (pendingUseRes.data?.length ?? 0) >= 1000 || (pendingLeaveRes.data?.length ?? 0) >= 1000 || (pendingEarnRes.data?.length ?? 0) >= 1000) throw new EmployeeAIError('Unable to read a complete offset summary.');

  const txRows = txRes.data ?? [];
  let approvedMinutes = 0;
  if (balanceMetric) {
    for (const row of txRows) approvedMinutes += row.kind === 'earned' ? transactionMinutes(row) : -transactionMinutes(row);
  }
  const pendingUseMinutes = (pendingUseRes.data ?? []).reduce((sum, row) => sum + Number(row.hours || 0) * 60, 0);
  const pendingLeaveMinutes = (pendingLeaveRes.data ?? []).reduce((sum, row) => sum + Number(row.offset_minutes_required || 0), 0);
  const reservedMinutes = pendingUseMinutes + pendingLeaveMinutes;
  const availableMinutes = Math.max(0, approvedMinutes - reservedMinutes);
  const pendingEarnCount = pendingEarnRes.data?.length ?? 0;
  const pendingUseCount = pendingUseRes.data?.length ?? 0;
  const pendingLeaveCount = pendingLeaveRes.data?.length ?? 0;

  if (c.metric === 'approved_balance') return tl ? `May ${formatMinutes(approvedMinutes)} kang approved offset balance.` : `You have ${formatMinutes(approvedMinutes)} of approved offset balance.`;
  if (c.metric === 'available_balance') return tl ? `May ${formatMinutes(availableMinutes)} kang available offset. Approved balance: ${formatMinutes(approvedMinutes)}${reservedMinutes ? `; reserved: ${formatMinutes(reservedMinutes)}` : ''}.` : `You have ${formatMinutes(availableMinutes)} of available offset. Approved balance: ${formatMinutes(approvedMinutes)}${reservedMinutes ? `; reserved: ${formatMinutes(reservedMinutes)}` : ''}.`;
  if (c.metric === 'reserved_balance') return tl ? `${formatMinutes(reservedMinutes)} ang naka-reserve sa pending Offset requests mo.` : `${formatMinutes(reservedMinutes)} is reserved by your pending Offset requests.`;
  if (c.metric === 'pending_offset') return tl ? `Pending Offset: ${pendingEarnCount} earned request, ${pendingUseCount} Late-use request, at ${pendingLeaveCount} Offset Leave request.` : `Pending Offset: ${pendingEarnCount} earned request(s), ${pendingUseCount} Late-use request(s), and ${pendingLeaveCount} Offset Leave request(s).`;

  const earnedMinutes = txRows.filter(row => row.kind === 'earned').reduce((sum, row) => sum + transactionMinutes(row), 0);
  const usedMinutes = txRows.filter(row => row.kind !== 'earned').reduce((sum, row) => sum + transactionMinutes(row), 0);
  if (c.metric === 'earned_offset') return tl ? `Mula ${start} hanggang ${end}, ${formatMinutes(earnedMinutes)} ang approved offset na na-credit sa iyo.` : `From ${start} to ${end}, ${formatMinutes(earnedMinutes)} of approved offset was credited to you.`;
  if (c.metric === 'used_offset') return tl ? `Mula ${start} hanggang ${end}, ${formatMinutes(usedMinutes)} ang nagamit o na-convert mula sa offset mo.` : `From ${start} to ${end}, ${formatMinutes(usedMinutes)} of your offset was used or converted.`;
  if (c.metric === 'offset_history') {
    const items = txRows.slice(0, 20).map(row => {
      const label = row.kind === 'earned' ? 'Earned' : row.kind === 'converted' ? 'Converted' : 'Used';
      const date = new Date(row.created_at).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' });
      return `${date}: ${label} ${formatMinutes(transactionMinutes(row))}${row.note ? ` — ${String(row.note).slice(0, 80)}` : ''}`;
    });
    return `${tl ? 'Offset history mo' : 'Your Offset history'} (${start} – ${end}):\n${items.join('\n') || (tl ? 'Walang approved Offset transaction sa period na ito.' : 'No approved Offset transactions in this period.')}${txRows.length > 20 ? (tl ? '\nLatest 20 entries lang ang ipinapakita.' : '\nShowing the latest 20 entries.') : ''}`;
  }
  return tl
    ? `Offset summary: approved ${formatMinutes(approvedMinutes)}, reserved ${formatMinutes(reservedMinutes)}, available ${formatMinutes(availableMinutes)}. Pending: ${pendingEarnCount} earned, ${pendingUseCount} Late-use, ${pendingLeaveCount} Offset Leave.`
    : `Offset summary: ${formatMinutes(approvedMinutes)} approved, ${formatMinutes(reservedMinutes)} reserved, ${formatMinutes(availableMinutes)} available. Pending: ${pendingEarnCount} earned, ${pendingUseCount} Late-use, ${pendingLeaveCount} Offset Leave.`;
}

async function manpowerAnswer(client: SupabaseClient, userId: string, c: LiveClassification, tl: boolean) {
  const { start, end } = rangeFor(c);
  const { startIso, endExclusive } = manilaRangeIso(start, end);
  const activeRes = await client.from('manpower_sessions').select('id,project_id,started_at,ended_at').eq('user_id', userId).is('ended_at', null).order('started_at', { ascending: false }).limit(1).maybeSingle();
  if (activeRes.error) throw new EmployeeAIError('Unable to read your Manpower Tracker status.');
  const active = activeRes.data;
  let activeProjectName = '';
  if (active?.project_id) {
    const projectRes = await client.from('manpower_projects').select('id,name').eq('id', active.project_id).maybeSingle();
    if (!projectRes.error && projectRes.data) activeProjectName = projectRes.data.name;
  }
  if (c.metric === 'current_project') return active ? (tl ? `Kasalukuyan mong tine-track ang ${activeProjectName || 'active project'}.` : `You are currently tracking ${activeProjectName || 'an active project'}.`) : (tl ? 'Wala kang active Manpower project ngayon.' : 'You do not have an active Manpower project right now.');
  if (c.metric === 'tracker_status') return active ? (tl ? `Running ang tracker mo${activeProjectName ? ` sa ${activeProjectName}` : ''}.` : `Your tracker is running${activeProjectName ? ` on ${activeProjectName}` : ''}.`) : (tl ? 'Hindi running ang Manpower Tracker mo ngayon.' : 'Your Manpower Tracker is not running right now.');

  const sessionsRes = await client.from('manpower_sessions').select('id,project_id,started_at,ended_at').eq('user_id', userId).lt('started_at', endExclusive).or(`ended_at.is.null,ended_at.gte.${startIso}`).order('started_at', { ascending: false }).limit(2000);
  if (sessionsRes.error || (sessionsRes.data?.length ?? 0) >= 2000) throw new EmployeeAIError('Unable to read a complete Manpower Tracker summary.');
  const sessions = sessionsRes.data ?? [];
  const projectIds = [...new Set(sessions.map(row => row.project_id).filter(Boolean))];
  const projectNames = new Map<string, string>();
  if (projectIds.length) {
    const projectsRes = await client.from('manpower_projects').select('id,name').in('id', projectIds);
    if (!projectsRes.error) for (const project of projectsRes.data ?? []) projectNames.set(project.id, project.name);
  }
  const rangeStart = new Date(startIso).getTime();
  const rangeEnd = new Date(endExclusive).getTime();
  const now = Date.now();
  const durations = new Map<string, number>();
  let totalMs = 0;
  for (const row of sessions) {
    const s = Math.max(new Date(row.started_at).getTime(), rangeStart);
    const e = Math.min(row.ended_at ? new Date(row.ended_at).getTime() : now, rangeEnd);
    const duration = Math.max(0, e - s);
    totalMs += duration;
    durations.set(row.project_id, (durations.get(row.project_id) ?? 0) + duration);
  }
  if (c.metric === 'today_tracked_time' || c.metric === 'tracked_time') return tl ? `Na-track mo ang ${formatDurationMs(totalMs)} mula ${start} hanggang ${end}.` : `You tracked ${formatDurationMs(totalMs)} from ${start} to ${end}.`;
  const grouped = [...durations.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([projectId, ms]) => `${projectNames.get(projectId) || 'Inactive/unknown project'}: ${formatDurationMs(ms)}`);
  if (c.metric === 'manpower_history') return `${tl ? 'Manpower history mo' : 'Your Manpower history'} (${start} – ${end}):\n${grouped.join('\n') || (tl ? 'Walang tracked project time sa period na ito.' : 'No tracked project time in this period.')}`;
  return `${tl ? 'Manpower summary' : 'Manpower summary'} (${start} – ${end}): ${formatDurationMs(totalMs)} total tracked.${grouped.length ? `\n${grouped.join('\n')}` : ''}${active ? `\nCurrently tracking: ${activeProjectName || 'active project'}` : ''}`;
}

export async function answerValidatedLiveClassification(params: {
  client: SupabaseClient;
  userId: string;
  classification: Record<string, unknown>;
  language: Language;
}) {
  const c = normalizeLiveClassification(params.classification);
  const tl = params.language === 'tl' || (params.language !== 'en' && c.language === 'tl');
  const answer = c.intent === 'own_offset'
    ? await offsetAnswer(params.client, params.userId, c, tl)
    : await manpowerAnswer(params.client, params.userId, c, tl);
  return { answer, source: c.intent };
}

export async function answerLiveOffsetOrManpower(params: {
  client: SupabaseClient;
  userId: string;
  question: string;
  history: ChatTurn[];
  language: Language;
  requestId: string;
}) {
  if (!mightNeedLiveOffsetOrManpower(params.question, params.history)) return null;
  const raw = await workflowCall(process.env.N8N_EMPLOYEE_AI_CLASSIFIER_URL, {
    question: params.question,
    history: params.history,
    current_date: periodDates('today').today,
    language: params.language,
    request_id: params.requestId,
  });
  const c = parseLiveClassification(raw, params.requestId);
  if (!c) return null;
  return answerValidatedLiveClassification({ client: params.client, userId: params.userId, classification: c as unknown as Record<string, unknown>, language: params.language });
}
