'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Clock3, Eraser, LogOut } from 'lucide-react';
import ModalShell from '@/components/shared/ModalShell';
import { supabase } from '@/lib/supabase';

type Props = { open: boolean; onClose: () => void; userId: string | null };
type Request = { id: string; eligible_hours: number; status: string; time_out_at: string; created_at: string };
type Transaction = { kind: 'earned' | 'used' | 'converted'; hours: number; minutes: number };
type LateRecord = { id: string; log_date: string; time_in: string | null };
type EarlyOutRecord = { id: string; log_date: string; time_out: string | null; early_out_offset_minutes: number };
type UsageRequest = { id: string; attendance_log_id: string; hours: number; required_minutes: number | null; status: string; created_at: string; reviewed_at: string | null; hr_notes: string | null };
type EarlyOutRequest = { id: string; attendance_log_id: string; required_minutes: number; status: string; created_at: string; reviewed_at: string | null; hr_notes: string | null };
type OffsetLeave = { id: string; leave_type: string; start_date: string; status: string; offset_minutes_required: number; offset_charged_at: string | null; offset_refunded_at: string | null; created_at: string };
type HistoryItem = { id: string; createdAt: string; title: string; detail: string; status: string };
type UsePanel = 'late' | 'early' | null;

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

function currentAndPreviousCalendarMonths() {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const previousMonthStart = new Date(Date.UTC(year, month - 2, 1));
  const endDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const previousMonthText = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'Asia/Manila' }).format(previousMonthStart);
  const currentMonthText = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'Asia/Manila' })
    .format(new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00+08:00`));
  return {
    start: `${previousMonthStart.getUTCFullYear()}-${String(previousMonthStart.getUTCMonth() + 1).padStart(2, '0')}-01`,
    end: `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`,
    label: `${previousMonthText} 1 – ${currentMonthText} ${endDay}, ${year}`,
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

  const cutoff = useMemo(() => currentAndPreviousCalendarMonths(), []);

  const fetchOffsetData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    const [requestRes, transactionRes, lateRes, earlyRecordsRes, usageRes, earlyOutRes, leaveRes, settingRes] = await Promise.all([
      supabase.from('offset_requests').select('id,eligible_hours,status,time_out_at,created_at').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('offset_transactions').select('kind,hours,minutes').eq('user_id', userId),
      supabase.from('attendance_logs').select('id,log_date,time_in').eq('user_id', userId).eq('status', 'Late').gte('log_date', cutoff.start).lte('log_date', cutoff.end).order('log_date', { ascending: false }),
      supabase.from('attendance_logs').select('id,log_date,time_out,early_out_offset_minutes').eq('user_id', userId).gte('log_date', cutoff.start).lte('log_date', cutoff.end).not('time_out', 'is', null).order('log_date', { ascending: false }),
      supabase.from('offset_usage_requests').select('id,attendance_log_id,hours,required_minutes,status,created_at,reviewed_at,hr_notes').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('early_out_offset_requests').select('id,attendance_log_id,required_minutes,status,created_at,reviewed_at,hr_notes').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('leave_requests').select('id,leave_type,start_date,status,offset_minutes_required,offset_charged_at,offset_refunded_at,created_at').eq('user_id', userId).eq('funding_source', 'offset').order('created_at', { ascending: false }),
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
    setLateRecords(((lateRes.data || []) as any[]).map((row) => ({ ...row, id: String(row.id) })) as LateRecord[]);
    setEarlyOutRecords(((earlyRecordsRes.data || []) as any[]).map((row) => ({ ...row, id: String(row.id), early_out_offset_minutes: Number(row.early_out_offset_minutes || 0) })) as EarlyOutRecord[]);
    setUsageRequests(((usageRes.data || []) as any[]).map((row) => ({ ...row, attendance_log_id: String(row.attendance_log_id) })) as UsageRequest[]);
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

  const requestedLateLogIds = useMemo(() => new Set(usageRequests.map((request) => request.attendance_log_id)), [usageRequests]);
  const requestedEarlyLogIds = useMemo(() => new Set(earlyOutRequests.map((request) => request.attendance_log_id)), [earlyOutRequests]);
  const eligibleLateRecords = useMemo(() => lateRecords.filter((record) => !requestedLateLogIds.has(record.id)), [lateRecords, requestedLateLogIds]);
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
    }));
    const lateItems = usageRequests.map((request) => {
      const record = lateRecordMap.get(request.attendance_log_id);
      const minutes = Number(request.required_minutes ?? request.hours * 60);
      const usageText = request.status === 'Approved' ? `Used ${formatOffsetMinutes(minutes)}` : request.status === 'Pending' ? `Reserves ${formatOffsetMinutes(minutes)}` : 'No deduction';
      return { id: `late-${request.id}`, createdAt: request.created_at, title: `Late${record?.log_date ? ` · ${record.log_date}` : ''}`, detail: `Original ${timeLabel(record?.time_in)} · ${usageText}`, status: request.status };
    });
    const earlyItems = earlyOutRequests.map((request) => {
      const record = earlyRecordMap.get(request.attendance_log_id);
      const usageText = request.status === 'Approved' ? `Used ${formatOffsetMinutes(request.required_minutes)}` : request.status === 'Pending' ? `Reserves ${formatOffsetMinutes(request.required_minutes)}` : 'No deduction';
      return { id: `early-${request.id}`, createdAt: request.created_at, title: `Early Out${record?.log_date ? ` · ${record.log_date}` : ''}`, detail: `Original out ${timeLabel(record?.time_out)} · ${usageText}`, status: request.status };
    });
    const earnedItems = requests.map((request) => ({ id: `earned-${request.id}`, createdAt: request.created_at, title: `Earned ${request.eligible_hours}h Offset`, detail: `Time Out ${submittedLabel(request.time_out_at)}`, status: request.status }));
    return [...leaveItems, ...lateItems, ...earlyItems, ...earnedItems].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [offsetLeaves, usageRequests, earlyOutRequests, requests, lateRecordMap, earlyRecordMap]);

  const submitLate = async (attendanceLogId: string) => {
    setSubmittingId(`late-${attendanceLogId}`);
    setMessage(null);
    const { error } = await supabase.rpc('submit_offset_usage_request', { p_attendance_log_id: Number(attendanceLogId) });
    if (error) setMessage({ type: 'error', text: error.message || 'Unable to submit Late Offset.' });
    else { setMessage({ type: 'success', text: 'Late Offset sent to HR.' }); setUsePanel(null); }
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

  const activeRecords = usePanel === 'late' ? eligibleLateRecords : eligibleEarlyRecords;
  const listPages = Math.max(1, Math.ceil(activeRecords.length / LIST_PAGE_SIZE));
  const safeListPage = Math.min(listPage, listPages - 1);
  const visibleLate = eligibleLateRecords.slice(safeListPage * LIST_PAGE_SIZE, (safeListPage + 1) * LIST_PAGE_SIZE);
  const visibleEarly = eligibleEarlyRecords.slice(safeListPage * LIST_PAGE_SIZE, (safeListPage + 1) * LIST_PAGE_SIZE);
  const historyPages = Math.max(1, Math.ceil(historyItems.length / HISTORY_PAGE_SIZE));
  const safeHistoryPage = Math.min(historyPage, historyPages - 1);
  const visibleHistory = historyItems.slice(safeHistoryPage * HISTORY_PAGE_SIZE, (safeHistoryPage + 1) * HISTORY_PAGE_SIZE);

  return (
    <ModalShell open={open} onClose={onClose} title="Offset Request" description="Late · Early Out · Leave" icon={<Clock3 size={20} />} size="lg">
      <div className="space-y-4">
        {message && <div className={`rounded-xl px-3 py-2 text-xs font-medium ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{message.text}</div>}

        <section className="rounded-2xl bg-cyan-50/80 p-4 dark:bg-cyan-950/25">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-700/80">Approved Offset</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-cyan-800 dark:text-cyan-200">{formatOffsetMinutes(approvedBalanceMinutes)}</p>
              <p className="mt-1 text-[11px] text-slate-500">{formatOffsetMinutes(reservedMinutes)} reserved · {formatOffsetMinutes(availableToRequestMinutes)} available</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button type="button" onClick={openOffsetLeave} disabled={!canFileOffsetLeave} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-3 text-[11px] font-bold text-white disabled:opacity-40"><CalendarPlus size={14} /> Leave</button>
              <button type="button" onClick={() => setUsePanel((value) => value === 'early' ? null : 'early')} disabled={eligibleEarlyRecords.length === 0} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-3 text-[11px] font-bold text-white disabled:opacity-40"><LogOut size={14} /> Early Out</button>
              <button type="button" onClick={() => setUsePanel((value) => value === 'late' ? null : 'late')} disabled={eligibleLateRecords.length === 0} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-cyan-700 px-3 text-[11px] font-bold text-white disabled:opacity-40"><Eraser size={14} /> Late</button>
            </div>
          </div>
          <p className="mt-2 text-[10px] text-slate-500">Current & previous month {cutoff.label}</p>
        </section>

        {usePanel === 'early' && (
          <section className="rounded-2xl bg-amber-50/60 p-3 dark:bg-amber-950/15">
            <div className="mb-2"><h3 className="text-sm font-bold text-slate-900 dark:text-white">Early Out · Current & previous month</h3><p className="text-[10px] text-slate-500">Exact minutes to {cutoffHour}:00</p></div>
            <div className="space-y-2">
              {visibleEarly.map((record) => {
                const busy = submittingId === `early-${record.id}`;
                const enough = availableToRequestMinutes >= record.requiredMinutes;
                return <div key={record.id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5 dark:bg-[#292f2b]">
                  <div className="min-w-0"><p className="text-xs font-bold text-slate-900 dark:text-white">{dateLabel(record.log_date)}</p><p className="mt-0.5 text-[10px] text-slate-500">Out {timeLabel(record.time_out)} · Uses {formatOffsetMinutes(record.requiredMinutes)}</p></div>
                  <button type="button" disabled={busy || !enough} onClick={() => submitEarly(record.id)} className="min-h-8 shrink-0 rounded-lg bg-slate-900 px-3 text-[10px] font-bold text-white disabled:opacity-40 dark:bg-white dark:text-slate-900">{busy ? 'Submitting…' : enough ? 'Submit to HR' : `Need ${formatOffsetMinutes(record.requiredMinutes)}`}</button>
                </div>;
              })}
            </div>
            {listPages > 1 && <div className="mt-2 flex items-center justify-between"><button onClick={() => setListPage((p) => Math.max(0, p - 1))} disabled={safeListPage === 0} className="text-[10px] font-bold disabled:opacity-30">Previous</button><span className="text-[10px] text-slate-400">{safeListPage + 1}/{listPages}</span><button onClick={() => setListPage((p) => Math.min(listPages - 1, p + 1))} disabled={safeListPage >= listPages - 1} className="text-[10px] font-bold disabled:opacity-30">Next</button></div>}
          </section>
        )}

        {usePanel === 'late' && (
          <section className="rounded-2xl bg-slate-50 p-3 dark:bg-[#303632]">
            <div className="mb-2"><h3 className="text-sm font-bold text-slate-900 dark:text-white">Late · Current & previous month</h3><p className="text-[10px] text-slate-500">Exact late minutes after 9:00 AM</p></div>
            <div className="space-y-2">
              {visibleLate.map((record) => {
                const busy = submittingId === `late-${record.id}`;
                const requiredMinutes = lateMinutes(record);
                const enough = availableToRequestMinutes >= requiredMinutes;
                return <div key={record.id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5 dark:bg-[#292f2b]">
                  <div className="min-w-0"><p className="text-xs font-bold text-slate-900 dark:text-white">{dateLabel(record.log_date)}</p><p className="mt-0.5 text-[10px] text-slate-500">In {timeLabel(record.time_in)} · Uses {formatOffsetMinutes(requiredMinutes)}</p></div>
                  <button type="button" disabled={busy || !enough} onClick={() => submitLate(record.id)} className="min-h-8 shrink-0 rounded-lg bg-slate-900 px-3 text-[10px] font-bold text-white disabled:opacity-40 dark:bg-white dark:text-slate-900">{busy ? 'Submitting…' : enough ? 'Submit to HR' : `Need ${formatOffsetMinutes(requiredMinutes)}`}</button>
                </div>;
              })}
            </div>
            {listPages > 1 && <div className="mt-2 flex items-center justify-between"><button onClick={() => setListPage((p) => Math.max(0, p - 1))} disabled={safeListPage === 0} className="text-[10px] font-bold disabled:opacity-30">Previous</button><span className="text-[10px] text-slate-400">{safeListPage + 1}/{listPages}</span><button onClick={() => setListPage((p) => Math.min(listPages - 1, p + 1))} disabled={safeListPage >= listPages - 1} className="text-[10px] font-bold disabled:opacity-30">Next</button></div>}
          </section>
        )}

        {!canFileOffsetLeave && !loading && <div className="rounded-xl bg-amber-50 px-3 py-2 text-[10px] font-medium text-amber-800">Offset Leave needs 9h available.</div>}

        <section>
          <div className="mb-2"><h3 className="text-sm font-bold text-slate-900 dark:text-white">Offset History</h3><p className="text-[10px] text-slate-500">Earned and used Offset</p></div>
          {loading ? <p className="py-4 text-center text-xs text-slate-500">Loading…</p> : visibleHistory.length ? (
            <div className="space-y-1.5">{visibleHistory.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-[#303632]"><div className="min-w-0"><p className="text-xs font-semibold text-slate-900 dark:text-white">{item.title}</p><p className="mt-0.5 text-[10px] text-slate-500">{item.detail}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold ${statusClass(item.status)}`}>{item.status}</span></div>)}</div>
          ) : <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">No offset history.</p>}
          {historyPages > 1 && <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2"><button onClick={() => setHistoryPage((p) => Math.max(0, p - 1))} disabled={safeHistoryPage === 0} className="text-[10px] font-bold disabled:opacity-30">Previous</button><span className="text-[10px] text-slate-400">{safeHistoryPage + 1}/{historyPages}</span><button onClick={() => setHistoryPage((p) => Math.min(historyPages - 1, p + 1))} disabled={safeHistoryPage >= historyPages - 1} className="text-[10px] font-bold disabled:opacity-30">Next</button></div>}
        </section>
      </div>
    </ModalShell>
  );
}
