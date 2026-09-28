'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Clock3, Eraser, X } from 'lucide-react';
import ModalShell from '@/components/shared/ModalShell';
import { supabase } from '@/lib/supabase';

type OffsetRequest = {
  id: string;
  user_id: string;
  eligible_hours: number;
  time_out_at: string;
  created_at: string;
};

type OffsetUsageRequest = {
  id: string;
  user_id: string;
  attendance_log_id: string;
  hours: number;
  created_at: string;
};

type EmployeeProfile = {
  id: string;
  full_name: string | null;
  employee_id: string | null;
};

type AttendanceLog = {
  id: string;
  log_date: string;
  time_in: string | null;
  status: string | null;
};

export default function HROffsetApprovalNotifier() {
  const [requests, setRequests] = useState<OffsetRequest[]>([]);
  const [usageRequests, setUsageRequests] = useState<OffsetUsageRequest[]>([]);
  const [profiles, setProfiles] = useState<Record<string, EmployeeProfile>>({});
  const [attendanceLogs, setAttendanceLogs] = useState<Record<string, AttendanceLog>>({});
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchOffsetWork = useCallback(async () => {
    setLoading(true);
    const [pendingRes, usageRes] = await Promise.all([
      supabase
        .from('offset_requests')
        .select('id,user_id,eligible_hours,time_out_at,created_at')
        .eq('status', 'Pending')
        .order('created_at', { ascending: true }),
      supabase
        .from('offset_usage_requests')
        .select('id,user_id,attendance_log_id,hours,created_at')
        .eq('status', 'Pending')
        .order('created_at', { ascending: true }),
    ]);

    if (pendingRes.error) console.error('Error fetching pending offset requests:', pendingRes.error);
    if (usageRes.error) console.error('Error fetching offset usage requests:', usageRes.error);

    const pending = (pendingRes.data || []) as OffsetRequest[];
    const usage = ((usageRes.data || []) as any[]).map((row) => ({ ...row, attendance_log_id: String(row.attendance_log_id) })) as OffsetUsageRequest[];
    setRequests(pending);
    setUsageRequests(usage);

    const userIds = [...new Set([...pending.map((request) => request.user_id), ...usage.map((request) => request.user_id)])];
    const attendanceIds = [...new Set(usage.map((request) => Number(request.attendance_log_id)).filter(Number.isFinite))];

    const [profileRes, attendanceRes] = await Promise.all([
      userIds.length
        ? supabase.from('profiles').select('id,full_name,employee_id').in('id', userIds)
        : Promise.resolve({ data: [], error: null } as any),
      attendanceIds.length
        ? supabase.from('attendance_logs').select('id,log_date,time_in,status').in('id', attendanceIds)
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    if (profileRes.error) console.error('Error fetching employee profiles:', profileRes.error);
    if (attendanceRes.error) console.error('Error fetching offset attendance records:', attendanceRes.error);

    setProfiles(Object.fromEntries(((profileRes.data || []) as EmployeeProfile[]).map((profile) => [profile.id, profile])));
    setAttendanceLogs(Object.fromEntries(((attendanceRes.data || []) as any[]).map((row) => [String(row.id), { ...row, id: String(row.id) }])));
    setLoading(false);
    window.dispatchEvent(new Event('hr:offset-updated'));
  }, []);

  useEffect(() => {
    void fetchOffsetWork();
    const interval = window.setInterval(() => void fetchOffsetWork(), 60_000);
    const refreshOnVisible = () => {
      if (document.visibilityState === 'visible') void fetchOffsetWork();
    };
    const openOffset = () => {
      setOpen(true);
      void fetchOffsetWork();
    };
    document.addEventListener('visibilitychange', refreshOnVisible);
    window.addEventListener('hr:open-offset', openOffset);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshOnVisible);
      window.removeEventListener('hr:open-offset', openOffset);
    };
  }, [fetchOffsetWork]);

  const totalHours = useMemo(
    () => requests.reduce((sum, request) => sum + Number(request.eligible_hours || 0), 0),
    [requests]
  );

  const reviewEarned = async (requestId: string, approve: boolean) => {
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

  const reviewUsage = async (requestId: string, approve: boolean) => {
    setReviewingId(requestId);
    setMessage(null);
    const { error } = await supabase.rpc('review_offset_usage_request', {
      p_request_id: requestId,
      p_approve: approve,
      p_notes: approve ? 'Approved by HR' : 'Declined by HR',
    });

    if (error) {
      setMessage(error.message || 'Unable to review this offset usage request.');
      setReviewingId(null);
      return;
    }

    setMessage(approve ? 'Use Offset approved. 1 hour was deducted and the Late tag is now Offset Applied.' : 'Use Offset declined. No hour was deducted and the Late tag remains unchanged.');
    setReviewingId(null);
    await fetchOffsetWork();
  };

  return (
    <ModalShell
      open={open}
      onClose={() => setOpen(false)}
      title="Offset Management"
      description="Approve generated offset hours and employee requests to use approved hours for Late attendance."
      icon={<Clock3 size={20} />}
      size="lg"
    >
      <div className="space-y-5">
        {message && (
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {message}
          </div>
        )}

        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Earned offset approvals</h3>
              <p className="text-[11px] text-slate-500">Whole completed hours after 7:00 PM Manila time.</p>
            </div>
            <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[11px] font-bold text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">{requests.length} · {totalHours} hrs</span>
          </div>

          {loading ? (
            <p className="py-6 text-center text-sm text-slate-500">Loading offset actions…</p>
          ) : requests.length === 0 ? (
            <div className="rounded-2xl bg-emerald-50 px-4 py-5 text-center dark:bg-emerald-950/30">
              <Check className="mx-auto text-emerald-600" size={20} />
              <p className="mt-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">No pending earned offset approvals.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {requests.map((request) => {
                const profile = profiles[request.user_id];
                const isReviewing = reviewingId === request.id;
                return (
                  <div key={request.id} className="rounded-2xl bg-slate-50 p-3 dark:bg-[#303632]">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{profile?.full_name || 'Employee'}</p>
                          {profile?.employee_id && <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-300">{profile.employee_id}</span>}
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                          Timed out {new Date(request.time_out_at).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300">Eligible: {request.eligible_hours} hour{request.eligible_hours === 1 ? '' : 's'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-none">
                        <button type="button" disabled={isReviewing} onClick={() => reviewEarned(request.id, false)} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-rose-50 px-3 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 dark:bg-rose-950/30 dark:text-rose-300"><X size={15} /> Decline</button>
                        <button type="button" disabled={isReviewing} onClick={() => reviewEarned(request.id, true)} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"><Check size={15} /> Approve</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="border-t border-slate-100 pt-4 dark:border-slate-800">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white"><Eraser size={15} /> Use Offset requests</h3>
              <p className="text-[11px] text-slate-500">Employee-selected Late dates. Approve to deduct 1 hour and change the attendance tag to Offset Applied.</p>
            </div>
            <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">{usageRequests.length} pending</span>
          </div>

          {usageRequests.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 px-4 py-5 text-center text-xs text-slate-500 dark:bg-[#303632]">No employee offset usage request is waiting for review.</div>
          ) : (
            <div className="space-y-2">
              {usageRequests.map((request) => {
                const profile = profiles[request.user_id];
                const attendance = attendanceLogs[request.attendance_log_id];
                const isReviewing = reviewingId === request.id;
                return (
                  <div key={request.id} className="rounded-2xl bg-violet-50/60 p-3 dark:bg-violet-950/20">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{profile?.full_name || 'Employee'}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">Request to use {request.hours} hr for Late{attendance?.log_date ? ` on ${new Date(`${attendance.log_date}T00:00:00+08:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}</p>
                        <p className="mt-1 text-[11px] font-semibold text-violet-700 dark:text-violet-300">Submitted {new Date(request.created_at).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-none">
                        <button type="button" disabled={isReviewing} onClick={() => reviewUsage(request.id, false)} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-white px-3 text-xs font-bold text-rose-700 shadow-sm transition hover:bg-rose-50 disabled:opacity-50 dark:bg-[#303632] dark:text-rose-300"><X size={15} /> Decline</button>
                        <button type="button" disabled={isReviewing} onClick={() => reviewUsage(request.id, true)} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-3 text-xs font-bold text-white transition hover:bg-violet-700 disabled:opacity-50"><Check size={15} /> Approve</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </ModalShell>
  );
}
