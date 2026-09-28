'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Eraser, XCircle } from 'lucide-react';
import ModalShell from '@/components/shared/ModalShell';
import { supabase } from '@/lib/supabase';

type Props = { open: boolean; onClose: () => void; userId: string | null };
type Request = { id: string; eligible_hours: number; status: string; time_out_at: string; created_at: string };
type Transaction = { kind: 'earned' | 'used' | 'converted'; hours: number };
type LateRecord = { id: string; log_date: string; time_in: string | null };
type UsageRequest = { id: string; attendance_log_id: string; hours: number; status: string; created_at: string; reviewed_at: string | null; hr_notes: string | null };

const statusClass = (status: string) => {
  if (status === 'Approved') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300';
  if (status === 'Rejected') return 'bg-rose-50 text-rose-700 dark:bg-rose-950/35 dark:text-rose-300';
  return 'bg-amber-50 text-amber-700 dark:bg-amber-950/35 dark:text-amber-300';
};

export default function OffsetRequestsModal({ open, onClose, userId }: Props) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [lateRecords, setLateRecords] = useState<LateRecord[]>([]);
  const [usageRequests, setUsageRequests] = useState<UsageRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [useOpen, setUseOpen] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchOffsetData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    const [requestRes, transactionRes, lateRes, usageRes] = await Promise.all([
      supabase.from('offset_requests').select('id,eligible_hours,status,time_out_at,created_at').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('offset_transactions').select('kind,hours').eq('user_id', userId),
      supabase.from('attendance_logs').select('id,log_date,time_in').eq('user_id', userId).eq('status', 'Late').order('log_date', { ascending: false }).limit(100),
      supabase.from('offset_usage_requests').select('id,attendance_log_id,hours,status,created_at,reviewed_at,hr_notes').eq('user_id', userId).order('created_at', { ascending: false }),
    ]);

    if (requestRes.error) console.error('Error fetching offset requests:', requestRes.error);
    if (transactionRes.error) console.error('Error fetching offset balance:', transactionRes.error);
    if (lateRes.error) console.error('Error fetching Late records:', lateRes.error);
    if (usageRes.error) console.error('Error fetching offset usage requests:', usageRes.error);

    setRequests((requestRes.data || []) as Request[]);
    setTransactions((transactionRes.data || []) as Transaction[]);
    setLateRecords(((lateRes.data || []) as any[]).map((row) => ({ ...row, id: String(row.id) })) as LateRecord[]);
    setUsageRequests(((usageRes.data || []) as any[]).map((row) => ({ ...row, attendance_log_id: String(row.attendance_log_id) })) as UsageRequest[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!open || !userId) return;
    fetchOffsetData();
  }, [open, userId, fetchOffsetData]);

  const approvedBalance = useMemo(
    () => transactions.reduce((total, transaction) => total + (transaction.kind === 'earned' ? transaction.hours : -transaction.hours), 0),
    [transactions]
  );

  const pendingUseHours = useMemo(
    () => usageRequests.filter((request) => request.status === 'Pending').reduce((total, request) => total + request.hours, 0),
    [usageRequests]
  );

  const availableToRequest = Math.max(0, approvedBalance - pendingUseHours);
  const pendingLogIds = new Set(usageRequests.filter((request) => request.status === 'Pending').map((request) => request.attendance_log_id));
  const eligibleLateRecords = lateRecords.filter((record) => !pendingLogIds.has(record.id));
  const usageDate = new Map(lateRecords.map((record) => [record.id, record.log_date]));

  const submitUseRequest = async (attendanceLogId: string) => {
    setSubmittingId(attendanceLogId);
    setMessage(null);
    const { error } = await supabase.rpc('submit_offset_usage_request', {
      p_attendance_log_id: Number(attendanceLogId),
    });

    if (error) {
      setMessage({ type: 'error', text: error.message || 'Unable to submit offset usage request.' });
      setSubmittingId(null);
      return;
    }

    setMessage({ type: 'success', text: 'Offset usage request submitted to HR. Your hour will only be deducted if HR approves it.' });
    setSubmittingId(null);
    setUseOpen(false);
    await fetchOffsetData();
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Offset Request"
      description="Earn approved offset hours after 7:00 PM, then request to use them for a Late attendance record."
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-700/80 dark:text-cyan-300/80">Approved offset balance</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-cyan-800 dark:text-cyan-200">{approvedBalance} hrs</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {pendingUseHours > 0 ? `${pendingUseHours} hr${pendingUseHours === 1 ? '' : 's'} reserved in pending use request${pendingUseHours === 1 ? '' : 's'}. ` : ''}
                {availableToRequest} hr{availableToRequest === 1 ? '' : 's'} available to request.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setUseOpen((value) => !value)}
              disabled={availableToRequest < 1 || eligibleLateRecords.length === 0}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Eraser size={15} /> Use Offset Hours
            </button>
          </div>
          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">9 approved hours can still be converted to one paid leave day through HR. Using an hour for Late reduces your remaining balance.</p>
        </section>

        {useOpen && (
          <section className="rounded-2xl bg-slate-50 p-3 dark:bg-[#303632]">
            <div className="mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Choose a Late date</h3>
              <p className="mt-0.5 text-[11px] text-slate-500">Submitting reserves 1 approved hour. HR must approve before the hour is deducted and the tag changes to Offset Applied.</p>
            </div>
            <div className="space-y-2">
              {eligibleLateRecords.length === 0 ? (
                <p className="rounded-xl bg-white px-3 py-4 text-center text-xs text-slate-500 dark:bg-[#292f2b]">No eligible Late record is available.</p>
              ) : eligibleLateRecords.map((record) => (
                <div key={record.id} className="flex flex-col gap-2 rounded-xl bg-white p-3 shadow-[0_4px_14px_rgba(15,23,42,0.04)] dark:bg-[#292f2b] sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{new Date(`${record.log_date}T00:00:00+08:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">Late attendance · Uses 1 approved offset hour</p>
                  </div>
                  <button
                    type="button"
                    disabled={submittingId === record.id || availableToRequest < 1}
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
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Use offset history</h3>
              <p className="text-[11px] text-slate-500">Your requests to apply approved offset to Late attendance.</p>
            </div>
          </div>
          {loading ? <p className="py-4 text-center text-sm text-slate-500">Loading…</p> : usageRequests.length ? (
            <div className="space-y-2">
              {usageRequests.map((request) => (
                <div key={request.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-[#303632]">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">Use {request.hours} hr for Late{usageDate.get(request.attendance_log_id) ? ` · ${usageDate.get(request.attendance_log_id)}` : ''}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">Submitted {new Date(request.created_at).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                  </div>
                  <span className={`flex-none rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClass(request.status)}`}>{request.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-500 dark:bg-[#303632]">No offset usage requests yet.</p>
          )}
        </section>

        <section className="border-t border-slate-100 pt-4 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Earned offset history</h3>
          <p className="mb-2 mt-0.5 text-[11px] text-slate-500">Auto-generated whole hours after 7:00 PM, subject to HR approval.</p>
          {loading ? <p className="py-4 text-center text-sm text-slate-500">Loading…</p> : requests.length ? (
            <div className="space-y-2">
              {requests.map((request) => (
                <div key={request.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-[#303632]">
                  <div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">{request.eligible_hours} hour{request.eligible_hours !== 1 ? 's' : ''}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">Timed out {new Date(request.time_out_at).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClass(request.status)}`}>{request.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-500 dark:bg-[#303632]">No earned offset requests yet.</p>
          )}
        </section>
      </div>
    </ModalShell>
  );
}
