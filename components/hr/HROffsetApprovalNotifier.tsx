'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BellRing, Check, Clock3, Eraser, X } from 'lucide-react';
import ModalShell from '@/components/shared/ModalShell';
import { supabase } from '@/lib/supabase';

type OffsetRequest = {
  id: string;
  user_id: string;
  eligible_hours: number;
  time_out_at: string;
  created_at: string;
};

type EmployeeProfile = {
  id: string;
  full_name: string | null;
  employee_id: string | null;
};

type LateRecord = {
  id: string;
  user_id: string;
  log_date: string;
  time_in: string | null;
};

type OffsetTransaction = {
  user_id: string;
  kind: 'earned' | 'used' | 'converted';
  hours: number;
};

export default function HROffsetApprovalNotifier() {
  const [requests, setRequests] = useState<OffsetRequest[]>([]);
  const [lateRecords, setLateRecords] = useState<LateRecord[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [profiles, setProfiles] = useState<Record<string, EmployeeProfile>>({});
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [scrubbingId, setScrubbingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchOffsetWork = useCallback(async () => {
    const [pendingRes, transactionsRes, lateRes] = await Promise.all([
      supabase
        .from('offset_requests')
        .select('id,user_id,eligible_hours,time_out_at,created_at')
        .eq('status', 'Pending')
        .order('created_at', { ascending: true }),
      supabase
        .from('offset_transactions')
        .select('user_id,kind,hours'),
      supabase
        .from('attendance_logs')
        .select('id,user_id,log_date,time_in')
        .eq('status', 'Late')
        .order('log_date', { ascending: false })
        .limit(200),
    ]);

    if (pendingRes.error) console.error('Error fetching pending offset requests:', pendingRes.error);
    if (transactionsRes.error) console.error('Error fetching offset balances:', transactionsRes.error);
    if (lateRes.error) console.error('Error fetching Late attendance records:', lateRes.error);

    const pending = (pendingRes.data || []) as OffsetRequest[];
    const transactions = (transactionsRes.data || []) as OffsetTransaction[];
    const balanceMap: Record<string, number> = {};
    for (const transaction of transactions) {
      const current = balanceMap[transaction.user_id] || 0;
      balanceMap[transaction.user_id] = current + (transaction.kind === 'earned' ? transaction.hours : -transaction.hours);
    }

    const scrubCandidates = ((lateRes.data || []) as LateRecord[]).filter((record) => (balanceMap[record.user_id] || 0) >= 1);

    setRequests(pending);
    setBalances(balanceMap);
    setLateRecords(scrubCandidates);

    const ids = [...new Set([...pending.map((request) => request.user_id), ...scrubCandidates.map((record) => record.user_id)])];
    if (ids.length > 0) {
      const { data: profileRows, error: profileError } = await supabase
        .from('profiles')
        .select('id,full_name,employee_id')
        .in('id', ids);
      if (!profileError) {
        setProfiles(Object.fromEntries(((profileRows || []) as EmployeeProfile[]).map((profile) => [profile.id, profile])));
      }
    } else {
      setProfiles({});
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOffsetWork();
    const interval = window.setInterval(fetchOffsetWork, 60_000);
    const refreshOnVisible = () => {
      if (document.visibilityState === 'visible') fetchOffsetWork();
    };
    document.addEventListener('visibilitychange', refreshOnVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshOnVisible);
    };
  }, [fetchOffsetWork]);

  const totalHours = useMemo(
    () => requests.reduce((sum, request) => sum + Number(request.eligible_hours || 0), 0),
    [requests]
  );

  const review = async (requestId: string, approve: boolean) => {
    setReviewingId(requestId);
    setMessage(null);
    const { error } = await supabase.rpc('review_offset_request', {
      p_request_id: requestId,
      p_approve: approve,
      p_notes: approve ? 'Approved by HR' : 'Declined by HR',
    });

    if (error) {
      setMessage(error.message || 'Unable to review this offset request.');
      setReviewingId(null);
      return;
    }

    setMessage(approve ? 'Offset approved. Eligible hours were added to the employee balance.' : 'Offset declined. No hours were added.');
    setReviewingId(null);
    await fetchOffsetWork();
  };

  const scrubLate = async (attendanceLogId: string) => {
    setScrubbingId(attendanceLogId);
    setMessage(null);
    const { error } = await supabase.rpc('apply_offset_to_late', {
      p_attendance_log_id: Number(attendanceLogId),
    });

    if (error) {
      setMessage(error.message || 'Unable to apply offset to this Late record.');
      setScrubbingId(null);
      return;
    }

    setMessage('Late scrubbed successfully. 1 approved offset hour was used and the attendance tag is now “Offset Applied”.');
    setScrubbingId(null);
    await fetchOffsetWork();
  };

  const actionCount = requests.length + lateRecords.length;
  if (!loading && actionCount === 0 && !open) return null;

  return (
    <>
      {actionCount > 0 && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-[5.75rem] right-3 z-[55] flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-2xl border border-cyan-200 bg-white px-3 py-2.5 text-left shadow-xl transition hover:-translate-y-0.5 dark:border-cyan-900 dark:bg-[#292f2b] sm:bottom-5 sm:right-5"
          aria-label={`${actionCount} offset action${actionCount === 1 ? '' : 's'} pending`}
        >
          <span className="relative grid h-10 w-10 flex-none place-items-center rounded-xl bg-cyan-600 text-white">
            <BellRing size={18} />
            <span className="absolute -right-1.5 -top-1.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white">
              {actionCount > 99 ? '99+' : actionCount}
            </span>
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-bold text-slate-900 dark:text-white">Offset action needed</span>
            <span className="block truncate text-[10px] text-slate-500 dark:text-slate-300">
              {requests.length} approval{requests.length === 1 ? '' : 's'} · {lateRecords.length} Late scrub{lateRecords.length === 1 ? '' : 's'}
            </span>
          </span>
        </button>
      )}

      <ModalShell
        open={open}
        onClose={() => setOpen(false)}
        title="Offset Management"
        description="Approve generated offset hours, then use approved hours to scrub Late attendance when needed."
        icon={<Clock3 size={20} />}
        size="lg"
      >
        <div className="space-y-5">
          {message && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {message}
            </div>
          )}

          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Pending approvals</h3>
                <p className="text-[11px] text-slate-500">Whole completed hours after 7:00 PM Manila time.</p>
              </div>
              <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[11px] font-bold text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">{requests.length} · {totalHours} hrs</span>
            </div>

            {loading ? (
              <p className="py-6 text-center text-sm text-slate-500">Loading offset actions…</p>
            ) : requests.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50 px-4 py-5 text-center dark:border-emerald-800 dark:bg-emerald-950/30">
                <Check className="mx-auto text-emerald-600" size={20} />
                <p className="mt-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">No pending offset approvals.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {requests.map((request) => {
                  const profile = profiles[request.user_id];
                  const isReviewing = reviewingId === request.id;
                  return (
                    <div key={request.id} className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-[#303632]">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{profile?.full_name || 'Employee'}</p>
                            {profile?.employee_id && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{profile.employee_id}</span>}
                          </div>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                            Timed out {new Date(request.time_out_at).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300">Eligible: {request.eligible_hours} hour{request.eligible_hours === 1 ? '' : 's'}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-none">
                          <button type="button" disabled={isReviewing} onClick={() => review(request.id, false)} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-rose-200 px-3 text-xs font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30">
                            <X size={15} /> Decline
                          </button>
                          <button type="button" disabled={isReviewing} onClick={() => review(request.id, true)} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50">
                            <Check size={15} /> Approve
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="border-t border-slate-200 pt-4 dark:border-slate-700">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Scrub Late using approved offset</h3>
                <p className="text-[11px] text-slate-500">1 approved offset hour removes one Late tag and records it as Offset Applied.</p>
              </div>
              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">{lateRecords.length} eligible</span>
            </div>

            {lateRecords.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-center text-xs text-slate-500 dark:border-slate-700">No Late records currently have an approved offset hour available.</div>
            ) : (
              <div className="space-y-2">
                {lateRecords.map((record) => {
                  const profile = profiles[record.user_id];
                  const balance = balances[record.user_id] || 0;
                  const isScrubbing = scrubbingId === record.id;
                  return (
                    <div key={record.id} className="rounded-2xl border border-violet-100 bg-violet-50/40 p-3 dark:border-violet-900/60 dark:bg-violet-950/20">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{profile?.full_name || 'Employee'}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">Late on {new Date(`${record.log_date}T00:00:00+08:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                          <p className="mt-1 text-[11px] font-semibold text-violet-700 dark:text-violet-300">Approved offset balance: {balance} hr{balance === 1 ? '' : 's'}</p>
                        </div>
                        <button type="button" disabled={isScrubbing} onClick={() => scrubLate(record.id)} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-3 text-xs font-bold text-white transition hover:bg-violet-700 disabled:opacity-50">
                          <Eraser size={15} /> Scrub Late
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </ModalShell>
    </>
  );
}
