'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Clock3, Eraser } from 'lucide-react';
import ModalShell from '@/components/shared/ModalShell';
import { supabase } from '@/lib/supabase';

type Props = { open: boolean; onClose: () => void; userId: string | null };
type Request = { id: string; eligible_hours: number; status: string; time_out_at: string; created_at: string };
type Transaction = { kind: 'earned' | 'used' | 'converted'; hours: number; minutes: number };
type LateRecord = { id: string; log_date: string; time_in: string | null };
type UsageRequest = { id: string; attendance_log_id: string; hours: number; status: string; created_at: string; reviewed_at: string | null; hr_notes: string | null };
type EarlyOutRequest = { id: string; attendance_log_id: string; required_minutes: number; status: string; created_at: string; reviewed_at: string | null; hr_notes: string | null };
type OffsetLeave = { id: string; leave_type: string; start_date: string; status: string; offset_minutes_required: number; offset_charged_at: string | null; offset_refunded_at: string | null; created_at: string };
type HistoryItem = { id: string; createdAt: string; title: string; detail: string; status: string };

const REQUIRED_LEAVE_MINUTES = 9 * 60;

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
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function OffsetRequestsModal({ open, onClose, userId }: Props) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [lateRecords, setLateRecords] = useState<LateRecord[]>([]);
  const [usageRequests, setUsageRequests] = useState<UsageRequest[]>([]);
  const [earlyOutRequests, setEarlyOutRequests] = useState<EarlyOutRequest[]>([]);
  const [offsetLeaves, setOffsetLeaves] = useState<OffsetLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [useOpen, setUseOpen] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchOffsetData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    const [requestRes, transactionRes, lateRes, usageRes, earlyOutRes, leaveRes] = await Promise.all([
      supabase.from('offset_requests').select('id,eligible_hours,status,time_out_at,created_at').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('offset_transactions').select('kind,hours,minutes').eq('user_id', userId),
      supabase.from('attendance_logs').select('id,log_date,time_in').eq('user_id', userId).eq('status', 'Late').order('log_date', { ascending: false }).limit(100),
      supabase.from('offset_usage_requests').select('id,attendance_log_id,hours,status,created_at,reviewed_at,hr_notes').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('early_out_offset_requests').select('id,attendance_log_id,required_minutes,status,created_at,reviewed_at,hr_notes').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('leave_requests').select('id,leave_type,start_date,status,offset_minutes_required,offset_charged_at,offset_refunded_at,created_at').eq('user_id', userId).eq('funding_source', 'offset').order('created_at', { ascending: false }),
    ]);

    if (requestRes.error) console.error('Error fetching offset requests:', requestRes.error);
    if (transactionRes.error) console.error('Error fetching offset balance:', transactionRes.error);
    if (lateRes.error) console.error('Error fetching Late records:', lateRes.error);
    if (usageRes.error) console.error('Error fetching Late Offset requests:', usageRes.error);
    if (earlyOutRes.error) console.error('Error fetching Early Out Offset requests:', earlyOutRes.error);
    if (leaveRes.error) console.error('Error fetching offset leave requests:', leaveRes.error);

    setRequests((requestRes.data || []) as Request[]);
    setTransactions((transactionRes.data || []) as Transaction[]);
    setLateRecords(((lateRes.data || []) as any[]).map((row) => ({ ...row, id: String(row.id) })) as LateRecord[]);
    setUsageRequests(((usageRes.data || []) as any[]).map((row) => ({ ...row, attendance_log_id: String(row.attendance_log_id) })) as UsageRequest[]);
    setEarlyOutRequests(((earlyOutRes.data || []) as any[]).map((row) => ({ ...row, attendance_log_id: String(row.attendance_log_id) })) as EarlyOutRequest[]);
    setOffsetLeaves((leaveRes.data || []) as OffsetLeave[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!open || !userId) return;
    void fetchOffsetData();
  }, [open, userId, fetchOffsetData]);

  useEffect(() => {
    const refresh = () => { if (open) void fetchOffsetData(); };
    window.addEventListener('employee:offset-data-changed', refresh);
    return () => window.removeEventListener('employee:offset-data-changed', refresh);
  }, [open, fetchOffsetData]);

  const approvedBalanceMinutes = useMemo(
    () => transactions.reduce((total, transaction) => {
      const amount = transaction.hours * 60 + (transaction.minutes || 0);
      return total + (transaction.kind === 'earned' ? amount : -amount);
    }, 0),
    [transactions]
  );

  const pendingUseMinutes = useMemo(
    () => usageRequests.filter((request) => request.status === 'Pending').reduce((total, request) => total + request.hours * 60, 0),
    [usageRequests]
  );

  const pendingEarlyOutMinutes = useMemo(
    () => earlyOutRequests.filter((request) => request.status === 'Pending').reduce((total, request) => total + Number(request.required_minutes || 0), 0),
    [earlyOutRequests]
  );

  const pendingLeaveMinutes = useMemo(
    () => offsetLeaves.filter((request) => request.status === 'Pending').reduce((total, request) => total + Number(request.offset_minutes_required || 0), 0),
    [offsetLeaves]
  );

  const reservedMinutes = pendingUseMinutes + pendingEarlyOutMinutes + pendingLeaveMinutes;
  const availableToRequestMinutes = Math.max(0, approvedBalanceMinutes - reservedMinutes);
  const pendingLogIds = new Set(usageRequests.filter((request) => request.status === 'Pending').map((request) => request.attendance_log_id));
  const eligibleLateRecords = lateRecords.filter((record) => !pendingLogIds.has(record.id));
  const usageDate = new Map(lateRecords.map((record) => [record.id, record.log_date]));
  const canFileOffsetLeave = availableToRequestMinutes >= REQUIRED_LEAVE_MINUTES;

  const historyItems = useMemo<HistoryItem[]>(() => {
    const leaveItems: HistoryItem[] = offsetLeaves.map((leave) => ({
      id: `leave-${leave.id}`,
      createdAt: leave.created_at,
      title: `${leave.leave_type} Leave · ${leave.start_date}`,
      detail: leave.offset_refunded_at ? '9h refunded' : leave.offset_charged_at ? '9h deducted' : '9h reserved',
      status: leave.status,
    }));

    const lateItems: HistoryItem[] = usageRequests.map((request) => ({
      id: `late-${request.id}`,
      createdAt: request.created_at,
      title: `Late · ${request.hours}h${usageDate.get(request.attendance_log_id) ? ` · ${usageDate.get(request.attendance_log_id)}` : ''}`,
      detail: submittedLabel(request.created_at),
      status: request.status,
    }));

    const earlyOutItems: HistoryItem[] = earlyOutRequests.map((request) => ({
      id: `early-out-${request.id}`,
      createdAt: request.created_at,
      title: `Early Out · ${formatOffsetMinutes(request.required_minutes)}`,
      detail: submittedLabel(request.created_at),
      status: request.status,
    }));

    const earnedItems: HistoryItem[] = requests.map((request) => ({
      id: `earned-${request.id}`,
      createdAt: request.created_at,
      title: `Earned ${request.eligible_hours}h Offset`,
      detail: `Time Out ${submittedLabel(request.time_out_at)}`,
      status: request.status,
    }));

    return [...leaveItems, ...lateItems, ...earlyOutItems, ...earnedItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [offsetLeaves, usageRequests, earlyOutRequests, requests, usageDate]);

  const submitUseRequest = async (attendanceLogId: string) => {
    setSubmittingId(attendanceLogId);
    setMessage(null);
    const { error } = await supabase.rpc('submit_offset_usage_request', {
      p_attendance_log_id: Number(attendanceLogId),
    });

    if (error) {
      setMessage({ type: 'error', text: error.message || 'Unable to submit offset request.' });
      setSubmittingId(null);
      await fetchOffsetData();
      return;
    }

    setMessage({ type: 'success', text: 'Request sent to HR.' });
    setSubmittingId(null);
    setUseOpen(false);
    await fetchOffsetData();
  };

  const openOffsetLeave = () => {
    if (!canFileOffsetLeave) return;
    onClose();
    window.dispatchEvent(new Event('employee:open-offset-leave'));
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Offset Request"
      description="Late · Early Out · Leave"
      icon={<Clock3 size={20} />}
      size="lg"
    >
      <div className="space-y-5">
        {message && (
          <div className={`rounded-xl px-3 py-2 text-xs font-medium ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/35 dark:text-rose-300'}`}>
            {message.text}
          </div>
        )}

        <section className="rounded-2xl bg-cyan-50/80 p-4 dark:bg-cyan-950/25">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-700/80 dark:text-cyan-300/80">Approved offset</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-cyan-800 dark:text-cyan-200">{formatOffsetMinutes(approvedBalanceMinutes)}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {reservedMinutes > 0 ? `${formatOffsetMinutes(reservedMinutes)} reserved · ` : ''}
                {formatOffsetMinutes(availableToRequestMinutes)} available
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={openOffsetLeave}
                disabled={!canFileOffsetLeave}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <CalendarPlus size={15} /> Leave Using Offset
              </button>
              <button
                type="button"
                onClick={() => setUseOpen((value) => !value)}
                disabled={availableToRequestMinutes < 60 || eligibleLateRecords.length === 0}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Eraser size={15} /> Use for Late
              </button>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">Leave 9h · Late 1h · Early Out exact minutes</p>
        </section>

        {!canFileOffsetLeave && !loading && (
          <div className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">Offset Leave needs 9h available.</div>
        )}

        {useOpen && (
          <section className="rounded-2xl bg-slate-50 p-3 dark:bg-[#303632]">
            <div className="mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Choose a Late date</h3>
              <p className="mt-0.5 text-[11px] text-slate-500">Reserves 1h until HR review.</p>
            </div>
            <div className="space-y-2">
              {eligibleLateRecords.length === 0 ? (
                <p className="rounded-xl bg-white px-3 py-4 text-center text-xs text-slate-500 dark:bg-[#292f2b]">No eligible Late records.</p>
              ) : eligibleLateRecords.map((record) => (
                <div key={record.id} className="flex flex-col gap-2 rounded-xl bg-white p-3 shadow-[0_4px_14px_rgba(15,23,42,0.04)] dark:bg-[#292f2b] sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{new Date(`${record.log_date}T00:00:00+08:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">Uses 1h Offset</p>
                  </div>
                  <button
                    type="button"
                    disabled={submittingId === record.id || availableToRequestMinutes < 60}
                    onClick={() => submitUseRequest(record.id)}
                    className="min-h-9 rounded-xl bg-slate-900 px-3 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-45 dark:bg-white dark:text-slate-900"
                  >
                    {submittingId === record.id ? 'Submitting…' : 'Submit to HR'}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="mb-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Offset History</h3>
            <p className="text-[11px] text-slate-500">Earned and used Offset</p>
          </div>
          {loading ? (
            <p className="py-4 text-center text-sm text-slate-500">Loading…</p>
          ) : historyItems.length ? (
            <div className="space-y-2">
              {historyItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-[#303632]">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">{item.title}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">{item.detail}</p>
                  </div>
                  <span className={`flex-none rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClass(item.status)}`}>{item.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-500 dark:bg-[#303632]">No offset history.</p>
          )}
        </section>
      </div>
    </ModalShell>
  );
}
