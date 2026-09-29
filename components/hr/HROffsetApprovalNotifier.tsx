'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Clock3, Eraser, LogOut, Search, X } from 'lucide-react';
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

type EarlyOutOffsetRequest = {
  id: string;
  user_id: string;
  attendance_log_id: string;
  required_minutes: number;
  cutoff_hour: number;
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
  time_out: string | null;
  status: string | null;
};

type EmployeeOffsetBalance = {
  user_id: string;
  full_name: string;
  employee_id: string | null;
  approved_minutes: number;
  reserved_minutes: number;
  available_minutes: number;
};

const BALANCE_PAGE_SIZE = 6;

function formatMinutes(totalMinutes: number) {
  const safe = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
}

function timeLabel(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('en-US', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function HROffsetApprovalNotifier() {
  const [requests, setRequests] = useState<OffsetRequest[]>([]);
  const [usageRequests, setUsageRequests] = useState<OffsetUsageRequest[]>([]);
  const [earlyOutRequests, setEarlyOutRequests] = useState<EarlyOutOffsetRequest[]>([]);
  const [balances, setBalances] = useState<EmployeeOffsetBalance[]>([]);
  const [profiles, setProfiles] = useState<Record<string, EmployeeProfile>>({});
  const [attendanceLogs, setAttendanceLogs] = useState<Record<string, AttendanceLog>>({});
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [balanceSearch, setBalanceSearch] = useState('');
  const [balancePage, setBalancePage] = useState(0);

  const fetchOffsetWork = useCallback(async () => {
    setLoading(true);
    const [pendingRes, usageRes, earlyOutRes, balanceRes] = await Promise.all([
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
      supabase
        .from('early_out_offset_requests')
        .select('id,user_id,attendance_log_id,required_minutes,cutoff_hour,created_at')
        .eq('status', 'Pending')
        .order('created_at', { ascending: true }),
      supabase.rpc('get_hr_offset_balances'),
    ]);

    if (pendingRes.error) console.error('Error fetching pending offset requests:', pendingRes.error);
    if (usageRes.error) console.error('Error fetching offset usage requests:', usageRes.error);
    if (earlyOutRes.error) console.error('Error fetching Early Out Offset requests:', earlyOutRes.error);
    if (balanceRes.error) console.error('Error fetching employee Offset balances:', balanceRes.error);

    const pending = (pendingRes.data || []) as OffsetRequest[];
    const usage = ((usageRes.data || []) as any[]).map((row) => ({ ...row, attendance_log_id: String(row.attendance_log_id) })) as OffsetUsageRequest[];
    const earlyOut = ((earlyOutRes.data || []) as any[]).map((row) => ({ ...row, attendance_log_id: String(row.attendance_log_id) })) as EarlyOutOffsetRequest[];
    setRequests(pending);
    setUsageRequests(usage);
    setEarlyOutRequests(earlyOut);
    setBalances(((balanceRes.data || []) as any[]).map((row) => ({
      ...row,
      approved_minutes: Number(row.approved_minutes || 0),
      reserved_minutes: Number(row.reserved_minutes || 0),
      available_minutes: Number(row.available_minutes || 0),
    })) as EmployeeOffsetBalance[]);

    const userIds = [...new Set([
      ...pending.map((request) => request.user_id),
      ...usage.map((request) => request.user_id),
      ...earlyOut.map((request) => request.user_id),
    ])];
    const attendanceIds = [...new Set([
      ...usage.map((request) => Number(request.attendance_log_id)),
      ...earlyOut.map((request) => Number(request.attendance_log_id)),
    ].filter(Number.isFinite))];

    const [profileRes, attendanceRes] = await Promise.all([
      userIds.length
        ? supabase.from('profiles').select('id,full_name,employee_id').in('id', userIds)
        : Promise.resolve({ data: [], error: null } as any),
      attendanceIds.length
        ? supabase.from('attendance_logs').select('id,log_date,time_in,time_out,status').in('id', attendanceIds)
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

  useEffect(() => setBalancePage(0), [balanceSearch]);

  const totalHours = useMemo(
    () => requests.reduce((sum, request) => sum + Number(request.eligible_hours || 0), 0),
    [requests]
  );

  const filteredBalances = useMemo(() => {
    const q = balanceSearch.trim().toLowerCase();
    if (!q) return balances;
    return balances.filter((row) => `${row.full_name} ${row.employee_id || ''}`.toLowerCase().includes(q));
  }, [balances, balanceSearch]);

  const balancePageCount = Math.max(1, Math.ceil(filteredBalances.length / BALANCE_PAGE_SIZE));
  const safeBalancePage = Math.min(balancePage, balancePageCount - 1);
  const visibleBalances = filteredBalances.slice(safeBalancePage * BALANCE_PAGE_SIZE, (safeBalancePage + 1) * BALANCE_PAGE_SIZE);

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

    setMessage(approve ? 'Offset approved.' : 'Offset declined.');
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

    setMessage(approve ? 'Late Offset approved.' : 'Late Offset declined.');
    setReviewingId(null);
    await fetchOffsetWork();
  };

  const reviewEarlyOut = async (requestId: string, approve: boolean) => {
    setReviewingId(requestId);
    setMessage(null);
    const { error } = await supabase.rpc('review_early_out_offset_request', {
      p_request_id: requestId,
      p_approve: approve,
      p_notes: approve ? 'Approved by HR' : 'Declined by HR',
    });

    if (error) {
      setMessage(error.message || 'Unable to review this Early Out Offset request.');
      setReviewingId(null);
      return;
    }

    setMessage(approve ? 'Early Out Offset approved and deducted.' : 'Early Out Offset declined. No deduction.');
    setReviewingId(null);
    await fetchOffsetWork();
  };

  return (
    <ModalShell
      open={open}
      onClose={() => setOpen(false)}
      title="Offset Management"
      description="Balances · Earned · Late · Early Out"
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
          <div className="mb-2 flex items-end justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Employee Balances</h3>
              <p className="text-[11px] text-slate-500">Approved · Reserved · Available</p>
            </div>
            <span className="text-[10px] font-semibold text-slate-400">{filteredBalances.length} employees</span>
          </div>
          <div className="relative mb-2">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={balanceSearch}
              onChange={(event) => setBalanceSearch(event.target.value)}
              placeholder="Search employee"
              className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-800 outline-none transition focus:border-cyan-400 dark:border-slate-700 dark:bg-[#292f2b] dark:text-white"
            />
          </div>
          {loading ? (
            <p className="py-4 text-center text-xs text-slate-500">Loading…</p>
          ) : visibleBalances.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-500 dark:bg-[#303632]">No employee found.</p>
          ) : (
            <div className="space-y-1.5">
              {visibleBalances.map((row) => (
                <div key={row.user_id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-[#303632]">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-900 dark:text-white">{row.full_name || 'Employee'}</p>
                    <p className="text-[10px] text-slate-500">{row.employee_id || 'No employee ID'}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-center">
                    <div className="min-w-[54px] rounded-lg bg-white px-2 py-1 dark:bg-[#292f2b]"><p className="text-[8px] font-bold uppercase text-slate-400">Approved</p><p className="text-[11px] font-black text-slate-700 dark:text-slate-200">{formatMinutes(row.approved_minutes)}</p></div>
                    <div className="min-w-[54px] rounded-lg bg-amber-50 px-2 py-1 dark:bg-amber-950/20"><p className="text-[8px] font-bold uppercase text-amber-500">Reserved</p><p className="text-[11px] font-black text-amber-700 dark:text-amber-300">{formatMinutes(row.reserved_minutes)}</p></div>
                    <div className="min-w-[54px] rounded-lg bg-emerald-50 px-2 py-1 dark:bg-emerald-950/20"><p className="text-[8px] font-bold uppercase text-emerald-500">Available</p><p className="text-[11px] font-black text-emerald-700 dark:text-emerald-300">{formatMinutes(row.available_minutes)}</p></div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {balancePageCount > 1 && (
            <div className="mt-2 flex items-center justify-between gap-2">
              <button type="button" onClick={() => setBalancePage((page) => Math.max(0, page - 1))} disabled={safeBalancePage === 0} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-bold text-slate-600 disabled:opacity-40 dark:bg-slate-800 dark:text-slate-300">Previous</button>
              <span className="text-[10px] font-semibold text-slate-400">{safeBalancePage + 1}/{balancePageCount}</span>
              <button type="button" onClick={() => setBalancePage((page) => Math.min(balancePageCount - 1, page + 1))} disabled={safeBalancePage >= balancePageCount - 1} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-bold text-slate-600 disabled:opacity-40 dark:bg-slate-800 dark:text-slate-300">Next</button>
            </div>
          )}
        </section>

        <section className="border-t border-slate-100 pt-4 dark:border-slate-800">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Earned Offset</h3>
              <p className="text-[11px] text-slate-500">Completed hours after 7 PM</p>
            </div>
            <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[11px] font-bold text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">{requests.length} · {totalHours}h</span>
          </div>

          {loading ? (
            <p className="py-6 text-center text-sm text-slate-500">Loading…</p>
          ) : requests.length === 0 ? (
            <div className="rounded-2xl bg-emerald-50 px-4 py-4 text-center dark:bg-emerald-950/30">
              <Check className="mx-auto text-emerald-600" size={20} />
              <p className="mt-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">No pending earned Offset.</p>
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
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">{new Date(request.time_out_at).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                        <p className="mt-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300">{request.eligible_hours}h eligible</p>
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
              <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white"><Eraser size={15} /> Late Offset</h3>
              <p className="text-[11px] text-slate-500">Current cutoff · 1h each</p>
            </div>
            <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">{usageRequests.length}</span>
          </div>

          {usageRequests.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 px-4 py-4 text-center text-xs text-slate-500 dark:bg-[#303632]">No pending Late Offset.</div>
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
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">Late{attendance?.log_date ? ` · ${attendance.log_date}` : ''} · Original {timeLabel(attendance?.time_in || null)}</p>
                        <p className="mt-1 text-[11px] font-semibold text-violet-700 dark:text-violet-300">Consumes 1h Offset</p>
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

        <section className="border-t border-slate-100 pt-4 dark:border-slate-800">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white"><LogOut size={15} /> Early Out Offset</h3>
              <p className="text-[11px] text-slate-500">Exact early minutes</p>
            </div>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">{earlyOutRequests.length}</span>
          </div>

          {earlyOutRequests.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 px-4 py-4 text-center text-xs text-slate-500 dark:bg-[#303632]">No pending Early Out Offset.</div>
          ) : (
            <div className="space-y-2">
              {earlyOutRequests.map((request) => {
                const profile = profiles[request.user_id];
                const attendance = attendanceLogs[request.attendance_log_id];
                const isReviewing = reviewingId === request.id;
                return (
                  <div key={request.id} className="rounded-2xl bg-amber-50/70 p-3 dark:bg-amber-950/20">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{profile?.full_name || 'Employee'}</p>
                          {profile?.employee_id && <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-300">{profile.employee_id}</span>}
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">Early Out{attendance?.log_date ? ` · ${attendance.log_date}` : ''} · Time Out {timeLabel(attendance?.time_out || null)}</p>
                        <p className="mt-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">Consumes {formatMinutes(request.required_minutes)} Offset</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-none">
                        <button type="button" disabled={isReviewing} onClick={() => reviewEarlyOut(request.id, false)} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-white px-3 text-xs font-bold text-rose-700 shadow-sm transition hover:bg-rose-50 disabled:opacity-50 dark:bg-[#303632] dark:text-rose-300"><X size={15} /> Decline</button>
                        <button type="button" disabled={isReviewing} onClick={() => reviewEarlyOut(request.id, true)} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-3 text-xs font-bold text-white transition hover:bg-amber-700 disabled:opacity-50"><Check size={15} /> Approve</button>
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
