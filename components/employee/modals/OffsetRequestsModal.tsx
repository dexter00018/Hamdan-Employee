'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CalendarPlus, CalendarX2, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, Clock3, Eraser, FileText, Info, LogOut, Send } from 'lucide-react';
import ModalShell from '@/components/shared/ModalShell';
import { supabase } from '@/lib/supabase';

type Props = { open: boolean; onClose: () => void; userId: string | null };
type Request = { id: string; eligible_hours: number; status: string; time_out_at: string; scheduled_end_at: string; created_at: string; reviewed_at: string | null; hr_notes: string | null };
type Transaction = { kind: 'earned' | 'used' | 'converted'; hours: number; minutes: number };
type LateRecord = { id: string; log_date: string; time_in: string | null; status: string };
type EarlyOutRecord = { id: string; log_date: string; time_out: string | null; early_out_offset_minutes: number };
type UsageRequest = { id: string; attendance_log_id: string; hours: number; required_minutes: number | null; usage_type: 'late' | 'absent'; status: string; created_at: string; reviewed_at: string | null; hr_notes: string | null };
type EarlyOutRequest = { id: string; attendance_log_id: string; required_minutes: number; status: string; created_at: string; reviewed_at: string | null; hr_notes: string | null };
type OffsetLeave = { id: string; leave_type: string; start_date: string; status: string; offset_minutes_required: number; offset_charged_at: string | null; offset_refunded_at: string | null; reviewed_at: string | null; created_at: string };
type HistoryItem = { id: string; createdAt: string; title: string; detail: string; status: string; workDate: string; reviewedAt: string | null };
type UsePanel = 'late' | 'early' | 'absent' | null;

const REQUIRED_LEAVE_MINUTES = 9 * 60;
const LIST_PAGE_SIZE = 5;
const HISTORY_PAGE_SIZE = 6;

const statusClass = (status: string) => {
  if (status === 'Approved') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300';
  if (status === 'Rejected' || status === 'Cancelled') return 'bg-rose-50 text-rose-700 dark:bg-rose-950/35 dark:text-rose-300';
  return 'bg-amber-50 text-amber-700 dark:bg-amber-950/35 dark:text-amber-300';
};

function formatOffsetMinutes(totalMinutes: number) {
  const safe = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
}

function submittedLabel(value: string) {
  return new Date(value).toLocaleString('en-US', {
    timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function timeLabel(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('en-US', {
    timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit',
  });
}

function dateLabel(value: string) {
  return new Date(`${value}T00:00:00+08:00`).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

function eventDateLabel(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', {
    timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric',
  });
}

function dateTile(value: string) {
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00+08:00` : value);
  if (!Number.isFinite(date.getTime())) return { month: '—', day: '—' };
  return {
    month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: date.toLocaleDateString('en-US', { day: '2-digit' }),
  };
}

function historyReviewLabel(item: HistoryItem) {
  if (!item.reviewedAt) return item.status === 'Pending' ? 'Awaiting HR approval' : 'Review date unavailable';
  const action = item.status === 'Approved' ? 'Approved' : item.status === 'Rejected' ? 'Rejected' : 'Reviewed';
  return `${action}: ${submittedLabel(item.reviewedAt)}`;
}

function earnedOffsetDetail(request: Request) {
  const rawMinutes = Math.max(0, Math.floor((Date.parse(request.time_out_at) - Date.parse(request.scheduled_end_at)) / 60000));
  const credit = request.status === 'Approved' ? `${request.eligible_hours}h credited` : request.status === 'Pending' ? `${request.eligible_hours}h pending HR approval` : `${request.eligible_hours}h not credited`;
  const decision = request.reviewed_at ? ` · ${request.status} ${submittedLabel(request.reviewed_at)}` : '';
  const note = request.hr_notes ? ` · ${request.hr_notes}` : '';
  return `Out ${timeLabel(request.time_out_at)} · ${formatOffsetMinutes(rawMinutes)} after 7:00 PM · ${credit}${decision}${note}`;
}

function currentPayrollCutoff() {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const day = Number(today.slice(8, 10));
  const startDay = day <= 15 ? 1 : 16;
  const endDay = day <= 15 ? 15 : new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthText = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'Asia/Manila' })
    .format(new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00+08:00`));
  return {
    start: `${year}-${String(month).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`,
    end: `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`,
    label: `${monthText} ${startDay} – ${endDay}, ${year}`,
  };
}

function earlyOutMinutes(record: EarlyOutRecord, cutoffHour: number) {
  if (!record.time_out) return 0;
  const actual = Date.parse(record.time_out);
  const cutoff = Date.parse(`${record.log_date}T${String(cutoffHour).padStart(2, '0')}:00:00+08:00`);
  if (!Number.isFinite(actual) || !Number.isFinite(cutoff) || actual >= cutoff) return 0;
  return Math.max(0, Math.ceil((cutoff - actual) / 60000));
}

function lateMinutes(record: LateRecord) {
  if (!record.time_in) return 0;
  const actual = Date.parse(record.time_in);
  const scheduled = Date.parse(`${record.log_date}T09:00:00+08:00`);
  if (!Number.isFinite(actual) || !Number.isFinite(scheduled) || actual <= scheduled) return 1;
  return Math.max(1, Math.floor((actual - scheduled) / 60000));
}

export default function OffsetRequestsModal({ open, onClose, userId }: Props) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [lateRecords, setLateRecords] = useState<LateRecord[]>([]);
  const [earlyOutRecords, setEarlyOutRecords] = useState<EarlyOutRecord[]>([]);
  const [usageRequests, setUsageRequests] = useState<UsageRequest[]>([]);
  const [earlyOutRequests, setEarlyOutRequests] = useState<EarlyOutRequest[]>([]);
  const [offsetLeaves, setOffsetLeaves] = useState<OffsetLeave[]>([]);
  const [cutoffHour, setCutoffHour] = useState(19);
  const [loading, setLoading] = useState(true);
  const [usePanel, setUsePanel] = useState<UsePanel>(null);
  const [listPage, setListPage] = useState(0);
  const [historyPage, setHistoryPage] = useState(0);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const cutoff = useMemo(() => currentPayrollCutoff(), []);

  const fetchOffsetData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    const [requestRes, transactionRes, lateRes, earlyRecordsRes, usageRes, earlyOutRes, leaveRes, settingRes] = await Promise.all([
      supabase.from('offset_requests').select('id,eligible_hours,status,time_out_at,scheduled_end_at,created_at,reviewed_at,hr_notes').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('offset_transactions').select('kind,hours,minutes').eq('user_id', userId),
      // Keep the linked attendance row for history even after an approved Offset
      // changes its status away from "Late". The Late button filters below.
      supabase.from('attendance_logs').select('id,log_date,time_in,status').eq('user_id', userId).gte('log_date', cutoff.start).lte('log_date', cutoff.end).order('log_date', { ascending: false }),
      supabase.from('attendance_logs').select('id,log_date,time_out,early_out_offset_minutes').eq('user_id', userId).gte('log_date', cutoff.start).lte('log_date', cutoff.end).not('time_out', 'is', null).order('log_date', { ascending: false }),
      supabase.from('offset_usage_requests').select('id,attendance_log_id,hours,required_minutes,usage_type,status,created_at,reviewed_at,hr_notes').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('early_out_offset_requests').select('id,attendance_log_id,required_minutes,status,created_at,reviewed_at,hr_notes').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('leave_requests').select('id,leave_type,start_date,status,offset_minutes_required,offset_charged_at,offset_refunded_at,reviewed_at,created_at').eq('user_id', userId).eq('funding_source', 'offset').order('created_at', { ascending: false }),
      supabase.from('app_settings').select('value').eq('key', 'time_out_reminder_hour').maybeSingle(),
    ]);

    if (requestRes.error) console.error('Error fetching offset requests:', requestRes.error);
    if (transactionRes.error) console.error('Error fetching offset balance:', transactionRes.error);
    if (lateRes.error) console.error('Error fetching Late records:', lateRes.error);
    if (earlyRecordsRes.error) console.error('Error fetching Early Out records:', earlyRecordsRes.error);
    if (usageRes.error) console.error('Error fetching Late Offset requests:', usageRes.error);
    if (earlyOutRes.error) console.error('Error fetching Early Out Offset requests:', earlyOutRes.error);
    if (leaveRes.error) console.error('Error fetching offset leave requests:', leaveRes.error);

    setRequests((requestRes.data || []) as Request[]);
    setTransactions((transactionRes.data || []) as Transaction[]);
    const usageRows = (usageRes.data || []) as any[];
    const lateHistoryLogIds = [...new Set(usageRows.map((row) => Number(row.attendance_log_id)).filter(Number.isFinite))];
    const lateHistoryRes = lateHistoryLogIds.length
      ? await supabase.from('attendance_logs').select('id,log_date,time_in,status').eq('user_id', userId).in('id', lateHistoryLogIds)
      : { data: [], error: null };
    if (lateHistoryRes.error) console.error('Error fetching Late history records:', lateHistoryRes.error);

    const lateRecordById = new Map(
      [...((lateRes.data || []) as any[]), ...((lateHistoryRes.data || []) as any[])]
        .map((row) => [String(row.id), { ...row, id: String(row.id) }])
    );
    setLateRecords([...lateRecordById.values()] as LateRecord[]);
    setEarlyOutRecords(((earlyRecordsRes.data || []) as any[]).map((row) => ({ ...row, id: String(row.id), early_out_offset_minutes: Number(row.early_out_offset_minutes || 0) })) as EarlyOutRecord[]);
    setUsageRequests(usageRows.map((row) => ({ ...row, attendance_log_id: String(row.attendance_log_id), usage_type: row.usage_type === 'absent' ? 'absent' : 'late' })) as UsageRequest[]);
    setEarlyOutRequests(((earlyOutRes.data || []) as any[]).map((row) => ({ ...row, attendance_log_id: String(row.attendance_log_id) })) as EarlyOutRequest[]);
    setOffsetLeaves((leaveRes.data || []) as OffsetLeave[]);
    if (typeof settingRes.data?.value === 'number') setCutoffHour(settingRes.data.value);
    setLoading(false);
  }, [userId, cutoff.start, cutoff.end]);

  useEffect(() => {
    if (!open || !userId) return;
    void fetchOffsetData();
  }, [open, userId, fetchOffsetData]);

  useEffect(() => {
    const refresh = () => { if (open) void fetchOffsetData(); };
    window.addEventListener('employee:offset-data-changed', refresh);
    return () => window.removeEventListener('employee:offset-data-changed', refresh);
  }, [open, fetchOffsetData]);

  useEffect(() => { setListPage(0); }, [usePanel]);

  const approvedBalanceMinutes = useMemo(
    () => transactions.reduce((total, transaction) => {
      const amount = transaction.hours * 60 + (transaction.minutes || 0);
      return total + (transaction.kind === 'earned' ? amount : -amount);
    }, 0),
    [transactions]
  );

  const pendingUseMinutes = useMemo(() => usageRequests.filter((request) => request.status === 'Pending').reduce((total, request) => total + Number(request.required_minutes ?? request.hours * 60), 0), [usageRequests]);
  const pendingEarlyOutMinutes = useMemo(() => earlyOutRequests.filter((request) => request.status === 'Pending').reduce((total, request) => total + Number(request.required_minutes || 0), 0), [earlyOutRequests]);
  const pendingLeaveMinutes = useMemo(() => offsetLeaves.filter((request) => request.status === 'Pending').reduce((total, request) => total + Number(request.offset_minutes_required || 0), 0), [offsetLeaves]);
  const reservedMinutes = pendingUseMinutes + pendingEarlyOutMinutes + pendingLeaveMinutes;
  const availableToRequestMinutes = Math.max(0, approvedBalanceMinutes - reservedMinutes);

  const requestedUsageLogIds = useMemo(() => new Set(usageRequests.map((request) => request.attendance_log_id)), [usageRequests]);
  const requestedEarlyLogIds = useMemo(() => new Set(earlyOutRequests.map((request) => request.attendance_log_id)), [earlyOutRequests]);
  const eligibleLateRecords = useMemo(() => lateRecords.filter((record) => record.status.toLowerCase() === 'late' && !requestedUsageLogIds.has(record.id)), [lateRecords, requestedUsageLogIds]);
  const eligibleAbsentRecords = useMemo(() => lateRecords.filter((record) => record.status.toLowerCase() === 'absent' && !requestedUsageLogIds.has(record.id)), [lateRecords, requestedUsageLogIds]);
  const eligibleEarlyRecords = useMemo(() => earlyOutRecords
    .map((record) => ({ ...record, requiredMinutes: earlyOutMinutes(record, cutoffHour) }))
    .filter((record) => record.requiredMinutes > 0 && record.early_out_offset_minutes <= 0 && !requestedEarlyLogIds.has(record.id)),
    [earlyOutRecords, cutoffHour, requestedEarlyLogIds]
  );

  const lateRecordMap = useMemo(() => new Map(lateRecords.map((record) => [record.id, record])), [lateRecords]);
  const earlyRecordMap = useMemo(() => new Map(earlyOutRecords.map((record) => [record.id, record])), [earlyOutRecords]);
  const canFileOffsetLeave = availableToRequestMinutes >= REQUIRED_LEAVE_MINUTES;

  const historyItems = useMemo<HistoryItem[]>(() => {
    const leaveItems = offsetLeaves.map((leave) => ({
      id: `leave-${leave.id}`, createdAt: leave.created_at, title: `${leave.leave_type} Leave · ${leave.start_date}`,
      detail: leave.offset_refunded_at ? '9h refunded' : leave.offset_charged_at ? '9h deducted' : '9h reserved', status: leave.status,
      workDate: dateLabel(leave.start_date), reviewedAt: leave.reviewed_at,
    }));
    const lateItems = usageRequests.map((request) => {
      const record = lateRecordMap.get(request.attendance_log_id);
      const minutes = Number(request.required_minutes ?? request.hours * 60);
      const usageText = request.status === 'Approved' ? `Used ${formatOffsetMinutes(minutes)}` : request.status === 'Pending' ? `Reserves ${formatOffsetMinutes(minutes)}` : 'No deduction';
      const isAbsent = request.usage_type === 'absent';
      return {
        id: `${request.usage_type}-${request.id}`, createdAt: request.created_at, title: `${isAbsent ? 'Absent' : 'Late'}${record?.log_date ? ` · ${record.log_date}` : ''}`,
        detail: isAbsent ? `Full day · ${usageText}` : `Original ${timeLabel(record?.time_in)} · ${usageText}`, status: request.status,
        workDate: record?.log_date ? dateLabel(record.log_date) : '—', reviewedAt: request.reviewed_at,
      };
    });
    const earlyItems = earlyOutRequests.map((request) => {
      const record = earlyRecordMap.get(request.attendance_log_id);
      const usageText = request.status === 'Approved' ? `Used ${formatOffsetMinutes(request.required_minutes)}` : request.status === 'Pending' ? `Reserves ${formatOffsetMinutes(request.required_minutes)}` : 'No deduction';
      return {
        id: `early-${request.id}`, createdAt: request.created_at, title: `Early Out${record?.log_date ? ` · ${record.log_date}` : ''}`,
        detail: `Original out ${timeLabel(record?.time_out)} · ${usageText}`, status: request.status,
        workDate: record?.log_date ? dateLabel(record.log_date) : '—', reviewedAt: request.reviewed_at,
      };
    });
    const earnedItems = requests.map((request) => ({
      id: `earned-${request.id}`, createdAt: request.created_at, title: `OT / Earned Offset · ${request.eligible_hours}h`,
      detail: earnedOffsetDetail(request), status: request.status, workDate: eventDateLabel(request.scheduled_end_at), reviewedAt: request.reviewed_at,
    }));
    return [...leaveItems, ...lateItems, ...earlyItems, ...earnedItems].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [offsetLeaves, usageRequests, earlyOutRequests, requests, lateRecordMap, earlyRecordMap]);

  const submitAttendanceOffset = async (attendanceLogId: string, usageType: 'late' | 'absent') => {
    const label = usageType === 'absent' ? 'Absent' : 'Late';
    setSubmittingId(`${usageType}-${attendanceLogId}`);
    setMessage(null);
    const { error } = await supabase.rpc('submit_offset_usage_request', { p_attendance_log_id: Number(attendanceLogId) });
    if (error) setMessage({ type: 'error', text: error.message || `Unable to submit ${label} Offset.` });
    else { setMessage({ type: 'success', text: `${label} Offset sent to HR.` }); setUsePanel(null); }
    setSubmittingId(null);
    await fetchOffsetData();
  };

  const submitEarly = async (attendanceLogId: string) => {
    setSubmittingId(`early-${attendanceLogId}`);
    setMessage(null);
    const { error } = await supabase.rpc('submit_early_out_offset_request', { p_attendance_log_id: Number(attendanceLogId) });
    if (error) setMessage({ type: 'error', text: error.message || 'Unable to submit Early Out Offset.' });
    else { setMessage({ type: 'success', text: 'Early Out Offset sent to HR.' }); setUsePanel(null); }
    setSubmittingId(null);
    await fetchOffsetData();
  };

  const openOffsetLeave = () => {
    if (!canFileOffsetLeave) return;
    onClose();
    window.dispatchEvent(new Event('employee:open-offset-leave'));
  };

  const activeRecords = usePanel === 'early' ? eligibleEarlyRecords : usePanel === 'absent' ? eligibleAbsentRecords : eligibleLateRecords;
  const listPages = Math.max(1, Math.ceil(activeRecords.length / LIST_PAGE_SIZE));
  const safeListPage = Math.min(listPage, listPages - 1);
  const visibleLate = eligibleLateRecords.slice(safeListPage * LIST_PAGE_SIZE, (safeListPage + 1) * LIST_PAGE_SIZE);
  const visibleAbsent = eligibleAbsentRecords.slice(safeListPage * LIST_PAGE_SIZE, (safeListPage + 1) * LIST_PAGE_SIZE);
  const visibleEarly = eligibleEarlyRecords.slice(safeListPage * LIST_PAGE_SIZE, (safeListPage + 1) * LIST_PAGE_SIZE);
  const historyPages = Math.max(1, Math.ceil(historyItems.length / HISTORY_PAGE_SIZE));
  const safeHistoryPage = Math.min(historyPage, historyPages - 1);
  const visibleHistory = historyItems.slice(safeHistoryPage * HISTORY_PAGE_SIZE, (safeHistoryPage + 1) * HISTORY_PAGE_SIZE);

  return (
    <ModalShell open={open} onClose={onClose} title="Offset Request" description="Late · Early Out · Absent · Leave" icon={<Clock3 size={20} />} size="lg">
      <div className="space-y-5">
        {message && <div className={`rounded-2xl border px-4 py-3 text-xs font-semibold ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>{message.text}</div>}

        <section className="relative overflow-hidden rounded-[26px] border border-sky-100 bg-gradient-to-br from-cyan-50 via-white to-sky-100/80 p-5 shadow-sm dark:border-cyan-900/40 dark:from-cyan-950/50 dark:via-[#27312e] dark:to-slate-900">
          <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-sky-200/40 dark:bg-sky-500/10" />
          <div className="pointer-events-none absolute -bottom-24 right-24 h-44 w-44 rounded-full border-[28px] border-cyan-100/60 dark:border-cyan-900/20" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300">Approved Offset</p>
              <div className="mt-1 flex items-end gap-2"><p className="text-5xl font-black leading-none tracking-tight text-cyan-900 dark:text-cyan-100">{formatOffsetMinutes(approvedBalanceMinutes)}</p><Info className="mb-1 text-slate-400" size={20} /></div>
              <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">{formatOffsetMinutes(reservedMinutes)} reserved · {formatOffsetMinutes(availableToRequestMinutes)} available</p>
              <p className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-300"><CalendarDays size={17} className="text-sky-600 dark:text-cyan-300" /> Current payroll cutoff: {cutoff.label}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-sky-100 pt-4 sm:grid-cols-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0 dark:border-slate-600">
              <button type="button" onClick={openOffsetLeave} disabled={!canFileOffsetLeave} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-emerald-100 px-4 text-xs font-extrabold text-emerald-800 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:opacity-100 dark:bg-emerald-900/30 dark:text-emerald-200 dark:hover:bg-emerald-900/45 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"><CalendarPlus size={17} /> Leave</button>
              <button type="button" onClick={() => setUsePanel((value) => value === 'early' ? null : 'early')} disabled={eligibleEarlyRecords.length === 0} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-orange-100 px-4 text-xs font-extrabold text-orange-700 transition hover:bg-orange-200 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:opacity-100 dark:bg-orange-900/30 dark:text-orange-200 dark:hover:bg-orange-900/45 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"><LogOut size={17} /> Early Out</button>
              <button type="button" onClick={() => setUsePanel((value) => value === 'absent' ? null : 'absent')} disabled={eligibleAbsentRecords.length === 0} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-rose-100 px-4 text-xs font-extrabold text-rose-700 transition hover:bg-rose-200 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:opacity-100 dark:bg-rose-900/30 dark:text-rose-200 dark:hover:bg-rose-900/45 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"><CalendarX2 size={17} /> Absent</button>
              <button type="button" onClick={() => setUsePanel((value) => value === 'late' ? null : 'late')} disabled={eligibleLateRecords.length === 0} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-sky-600 bg-white/80 px-4 text-xs font-extrabold text-sky-700 shadow-sm transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-400 disabled:opacity-100 dark:border-cyan-400 dark:bg-slate-800/60 dark:text-cyan-200 dark:hover:bg-slate-800 dark:disabled:border-slate-700 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"><Eraser size={17} /> Late</button>
            </div>
          </div>
        </section>

        {usePanel === 'early' && (
          <section className="rounded-[26px] border border-orange-100 bg-gradient-to-br from-orange-50/80 to-white p-4 shadow-sm dark:border-orange-950/50 dark:from-orange-950/20 dark:to-[#27312e]">
            <div className="mb-4 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-orange-100 text-orange-600 dark:bg-orange-900/35 dark:text-orange-300"><LogOut size={21} /></span><div><h3 className="text-base font-extrabold text-slate-900 dark:text-white">Early Out · Current payroll cutoff</h3><p className="text-xs text-slate-500 dark:text-slate-300">Exact minutes to {cutoffHour}:00</p></div></div>
            <div className="space-y-2.5">
              {visibleEarly.map((record) => {
                const busy = submittingId === `early-${record.id}`;
                const enough = availableToRequestMinutes >= record.requiredMinutes;
                const tile = dateTile(record.log_date);
                return <div key={record.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white bg-white/90 px-3 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800/80">
                  <div className="flex min-w-0 items-center gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-orange-50 text-center leading-none dark:bg-orange-900/25"><span className="block text-[9px] font-extrabold tracking-wide text-orange-600 dark:text-orange-300">{tile.month}</span><span className="block text-lg font-black text-slate-700 dark:text-white">{tile.day}</span></span><div className="min-w-0"><p className="text-sm font-extrabold text-slate-900 dark:text-white">{dateLabel(record.log_date)}</p><p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-300"><Clock3 className="mr-1 inline" size={14} /> Out {timeLabel(record.time_out)} <span className="mx-1.5 text-slate-300">•</span> Uses {formatOffsetMinutes(record.requiredMinutes)}</p></div></div>
                  <button type="button" disabled={busy || !enough} onClick={() => submitEarly(record.id)} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-orange-600 px-3.5 text-[11px] font-extrabold text-white shadow-sm transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:opacity-100 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"><Send size={15} /> {busy ? 'Submitting…' : enough ? 'Submit to HR' : `Need ${formatOffsetMinutes(record.requiredMinutes)}`}</button>
                </div>;
              })}
            </div>
            {listPages > 1 && <div className="mt-3 flex items-center justify-between"><button onClick={() => setListPage((p) => Math.max(0, p - 1))} disabled={safeListPage === 0} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 disabled:opacity-35 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"><ChevronLeft size={15} /> Previous</button><span className="text-xs font-semibold text-slate-400">Page {safeListPage + 1} of {listPages}</span><button onClick={() => setListPage((p) => Math.min(listPages - 1, p + 1))} disabled={safeListPage >= listPages - 1} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 disabled:opacity-35 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">Next <ChevronRight size={15} /></button></div>}
          </section>
        )}

        {usePanel === 'late' && (
          <section className="rounded-[26px] border border-sky-100 bg-gradient-to-br from-slate-50 to-sky-50/60 p-4 shadow-sm dark:border-slate-700 dark:from-[#303632] dark:to-[#27312e]">
            <div className="mb-4 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-900/35 dark:text-cyan-300"><Clock3 size={21} /></span><div><h3 className="text-base font-extrabold text-slate-900 dark:text-white">Late · Current payroll cutoff</h3><p className="text-xs text-slate-500 dark:text-slate-300">Exact late minutes after 9:00 AM</p></div></div>
            <div className="space-y-2.5">
              {visibleLate.map((record) => {
                const busy = submittingId === `late-${record.id}`;
                const requiredMinutes = lateMinutes(record);
                const enough = availableToRequestMinutes >= requiredMinutes;
                const tile = dateTile(record.log_date);
                return <div key={record.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white bg-white/90 px-3 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800/80">
                  <div className="flex min-w-0 items-center gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-sky-50 text-center leading-none dark:bg-sky-900/25"><span className="block text-[9px] font-extrabold tracking-wide text-sky-700 dark:text-cyan-300">{tile.month}</span><span className="block text-lg font-black text-slate-700 dark:text-white">{tile.day}</span></span><div className="min-w-0"><p className="text-sm font-extrabold text-slate-900 dark:text-white">{dateLabel(record.log_date)}</p><p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-300"><Clock3 className="mr-1 inline" size={14} /> In {timeLabel(record.time_in)} <span className="mx-1.5 text-slate-300">•</span> Uses {formatOffsetMinutes(requiredMinutes)}</p></div></div>
                  <button type="button" disabled={busy || !enough} onClick={() => submitAttendanceOffset(record.id, 'late')} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-800 to-sky-700 px-3.5 text-[11px] font-extrabold text-white shadow-sm transition hover:from-cyan-900 hover:to-sky-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:bg-none disabled:text-slate-400 disabled:shadow-none disabled:opacity-100 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"><Send size={15} /> {busy ? 'Submitting…' : enough ? 'Submit to HR' : `Need ${formatOffsetMinutes(requiredMinutes)}`}</button>
                </div>;
              })}
            </div>
            {listPages > 1 && <div className="mt-3 flex items-center justify-between"><button onClick={() => setListPage((p) => Math.max(0, p - 1))} disabled={safeListPage === 0} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 disabled:opacity-35 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"><ChevronLeft size={15} /> Previous</button><span className="text-xs font-semibold text-slate-400">Page {safeListPage + 1} of {listPages}</span><button onClick={() => setListPage((p) => Math.min(listPages - 1, p + 1))} disabled={safeListPage >= listPages - 1} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 disabled:opacity-35 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">Next <ChevronRight size={15} /></button></div>}
          </section>
        )}

        {usePanel === 'absent' && (
          <section className="rounded-[26px] border border-rose-100 bg-gradient-to-br from-rose-50/80 to-white p-4 shadow-sm dark:border-rose-950/50 dark:from-rose-950/20 dark:to-[#27312e]">
            <div className="mb-4 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-rose-100 text-rose-700 dark:bg-rose-900/35 dark:text-rose-300"><CalendarX2 size={21} /></span><div><h3 className="text-base font-extrabold text-slate-900 dark:text-white">Absent · Current payroll cutoff</h3><p className="text-xs text-slate-500 dark:text-slate-300">One full absence uses 9h of approved Offset</p></div></div>
            <div className="space-y-2.5">
              {visibleAbsent.map((record) => {
                const busy = submittingId === `absent-${record.id}`;
                const enough = availableToRequestMinutes >= REQUIRED_LEAVE_MINUTES;
                const tile = dateTile(record.log_date);
                return <div key={record.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white bg-white/90 px-3 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800/80">
                  <div className="flex min-w-0 items-center gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-rose-50 text-center leading-none dark:bg-rose-900/25"><span className="block text-[9px] font-extrabold tracking-wide text-rose-700 dark:text-rose-300">{tile.month}</span><span className="block text-lg font-black text-slate-700 dark:text-white">{tile.day}</span></span><div className="min-w-0"><p className="text-sm font-extrabold text-slate-900 dark:text-white">{dateLabel(record.log_date)}</p><p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-300">Full day <span className="mx-1.5 text-slate-300">•</span> Uses 9h</p></div></div>
                  <button type="button" disabled={busy || !enough} onClick={() => submitAttendanceOffset(record.id, 'absent')} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-rose-700 px-3.5 text-[11px] font-extrabold text-white shadow-sm transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:opacity-100 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"><Send size={15} /> {busy ? 'Submitting…' : enough ? 'Submit to HR' : 'Need 9h'}</button>
                </div>;
              })}
            </div>
            {listPages > 1 && <div className="mt-3 flex items-center justify-between"><button onClick={() => setListPage((p) => Math.max(0, p - 1))} disabled={safeListPage === 0} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 disabled:opacity-35 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"><ChevronLeft size={15} /> Previous</button><span className="text-xs font-semibold text-slate-400">Page {safeListPage + 1} of {listPages}</span><button onClick={() => setListPage((p) => Math.min(listPages - 1, p + 1))} disabled={safeListPage >= listPages - 1} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 disabled:opacity-35 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">Next <ChevronRight size={15} /></button></div>}
          </section>
        )}

        {!canFileOffsetLeave && !loading && <div className="flex items-center gap-3 rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-3 text-xs font-bold text-orange-700 dark:border-orange-900/50 dark:from-orange-950/25 dark:to-amber-950/20 dark:text-orange-200"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-orange-600 text-white"><CircleAlert size={16} /></span>Offset Leave needs 9h available.</div>}

        <section className="rounded-[26px] border border-slate-100 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm dark:border-slate-700 dark:from-[#303632] dark:to-[#27312e]">
          <div className="mb-4 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/35 dark:text-emerald-300"><FileText size={21} /></span><div><h3 className="text-base font-extrabold text-slate-900 dark:text-white">Offset History</h3><p className="text-xs text-slate-500 dark:text-slate-300">Earned and used Offset</p></div></div>
          {loading ? <p className="py-4 text-center text-xs text-slate-500">Loading…</p> : visibleHistory.length ? (
            <div className="space-y-2.5">{visibleHistory.map((item) => {
              const tile = dateTile(item.workDate);
              return <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white bg-emerald-50/55 px-3 py-3 shadow-sm dark:border-slate-700 dark:bg-emerald-950/15"><div className="flex min-w-0 items-center gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white text-center leading-none shadow-sm dark:bg-slate-800"><span className="block text-[9px] font-extrabold tracking-wide text-emerald-600 dark:text-emerald-300">{tile.month}</span><span className="block text-lg font-black text-slate-700 dark:text-white">{tile.day}</span></span><div className="min-w-0"><p className="text-sm font-extrabold text-slate-900 dark:text-white">{item.title}</p><p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">Work date: {item.workDate} <span className="mx-1 text-slate-300">•</span> {historyReviewLabel(item)}</p><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{item.detail}</p></div></div><span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[10px] font-extrabold ${statusClass(item.status)}`}>{item.status === 'Approved' && <CheckCircle2 size={13} />}{item.status}</span></div>;
            })}</div>
          ) : <p className="rounded-2xl bg-slate-50 px-3 py-5 text-center text-xs font-medium text-slate-500 dark:bg-slate-800/60">No offset history.</p>}
          {historyPages > 1 && <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-700"><button onClick={() => setHistoryPage((p) => Math.max(0, p - 1))} disabled={safeHistoryPage === 0} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 disabled:opacity-35 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"><ChevronLeft size={15} /> Previous</button><span className="text-xs font-semibold text-slate-400">Page {safeHistoryPage + 1} of {historyPages}</span><button onClick={() => setHistoryPage((p) => Math.min(historyPages - 1, p + 1))} disabled={safeHistoryPage >= historyPages - 1} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 disabled:opacity-35 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">Next <ChevronRight size={15} /></button></div>}
        </section>
      </div>
    </ModalShell>
  );
}
