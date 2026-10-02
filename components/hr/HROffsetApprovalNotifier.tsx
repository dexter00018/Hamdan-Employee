'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Clock3, Eraser, LogOut, Search, Sparkles, Users, X } from 'lucide-react';
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
  required_minutes: number | null;
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

type TabKey = 'earned' | 'early' | 'late' | 'balances';

const PAGE_SIZE = 6;

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

function dateTimeLabel(value: string) {
  return new Date(value).toLocaleString('en-US', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
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
  const [activeTab, setActiveTab] = useState<TabKey>('earned');
  const [page, setPage] = useState(0);
  const [balanceSearch, setBalanceSearch] = useState('');

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
        .select('id,user_id,attendance_log_id,hours,required_minutes,created_at')
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
    const usage = ((usageRes.data || []) as any[]).map((row) => ({
      ...row,
      attendance_log_id: String(row.attendance_log_id),
    })) as OffsetUsageRequest[];
    const earlyOut = ((earlyOutRes.data || []) as any[]).map((row) => ({
      ...row,
      attendance_log_id: String(row.attendance_log_id),
    })) as EarlyOutOffsetRequest[];

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

    setProfiles(Object.fromEntries(
      ((profileRes.data || []) as EmployeeProfile[]).map((profile) => [profile.id, profile])
    ));
    setAttendanceLogs(Object.fromEntries(
      ((attendanceRes.data || []) as any[]).map((row) => [String(row.id), { ...row, id: String(row.id) }])
    ));

    setLoading(false);
    window.dispatchEvent(new Event('hr:offset-updated'));
  }, []);

  useEffect(() => {
    void fetchOffsetWork();
    const refresh = () => {
      if (document.visibilityState === 'visible') void fetchOffsetWork();
    };
    const openOffset = () => {
      setOpen(true);
      void fetchOffsetWork();
    };
    const channel = supabase
      .channel('hr-offset-work-live-legacy')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offset_requests' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offset_usage_requests' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'early_out_offset_requests' }, refresh)
      .subscribe();

    window.addEventListener('hr:open-offset', openOffset);

    return () => {
      window.removeEventListener('hr:open-offset', openOffset);
      void supabase.removeChannel(channel);
    };
  }, [fetchOffsetWork]);

  useEffect(() => {
    setPage(0);
  }, [activeTab, balanceSearch]);

  const totalHours = useMemo(
    () => requests.reduce((sum, request) => sum + Number(request.eligible_hours || 0), 0),
    [requests]
  );

  const filteredBalances = useMemo(() => {
    const q = balanceSearch.trim().toLowerCase();
    if (!q) return balances;
    return balances.filter((row) =>
      `${row.full_name} ${row.employee_id || ''}`.toLowerCase().includes(q)
    );
  }, [balances, balanceSearch]);

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

    setMessage(approve ? 'Earned Offset approved.' : 'Earned Offset declined.');
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
      setMessage(error.message || 'Unable to review this Late Offset request.');
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

    setMessage(approve ? 'Early Out approved.' : 'Early Out declined.');
    setReviewingId(null);
    await fetchOffsetWork();
  };

  const tabs: Array<{ key: TabKey; label: string; count: number; icon: React.ReactNode }> = [
    { key: 'earned', label: 'Earned', count: requests.length, icon: <Sparkles size={14} /> },
    { key: 'early', label: 'Early Out', count: earlyOutRequests.length, icon: <LogOut size={14} /> },
    { key: 'late', label: 'Late', count: usageRequests.length, icon: <Eraser size={14} /> },
    { key: 'balances', label: 'Balances', count: balances.length, icon: <Users size={14} /> },
  ];

  const currentLength = activeTab === 'earned'
    ? requests.length
    : activeTab === 'early'
      ? earlyOutRequests.length
      : activeTab === 'late'
        ? usageRequests.length
        : filteredBalances.length;

  const pageCount = Math.max(1, Math.ceil(currentLength / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * PAGE_SIZE;
  const end = start + PAGE_SIZE;

  const visibleEarned = requests.slice(start, end);
  const visibleEarly = earlyOutRequests.slice(start, end);
  const visibleLate = usageRequests.slice(start, end);
  const visibleBalances = filteredBalances.slice(start, end);

  const pagination = pageCount > 1 && (
    <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
      <button
        type="button"
        onClick={() => setPage((value) => Math.max(0, value - 1))}
        disabled={safePage === 0}
        className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-bold text-slate-600 disabled:opacity-35 dark:bg-slate-800 dark:text-slate-300"
      >
        Previous
      </button>
      <span className="text-[10px] font-semibold text-slate-400">{safePage + 1}/{pageCount}</span>
      <button
        type="button"
        onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
        disabled={safePage >= pageCount - 1}
        className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-bold text-slate-600 disabled:opacity-35 dark:bg-slate-800 dark:text-slate-300"
      >
        Next
      </button>
    </div>
  );

  return (
    <ModalShell
      open={open}
      onClose={() => setOpen(false)}
      title="Offset Management"
      description="HR approvals and balances"
      icon={<Clock3 size={20} />}
      size="lg"
    >
      <div className="space-y-3">
        {message && (
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {message}
          </div>
        )}

        <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1 sm:grid-cols-4 dark:bg-[#2d332f]">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-[11px] font-bold transition ${
                activeTab === tab.key
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-[#3a413c] dark:text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${
                activeTab === tab.key
                  ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200'
                  : 'bg-white/70 text-slate-400 dark:bg-slate-800 dark:text-slate-400'
              }`}>{tab.count}</span>
            </button>
          ))}
        </div>

        {activeTab === 'earned' && (
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">Earned Hours</h3>
                <p className="text-[10px] text-slate-500">After 7 PM</p>
              </div>
              <span className="rounded-full bg-cyan-50 px-2 py-1 text-[10px] font-bold text-cyan-700 dark:bg-cyan-950/35 dark:text-cyan-300">{requests.length} · {totalHours}h</span>
            </div>

            {loading ? (
              <p className="py-6 text-center text-xs text-slate-500">Loading…</p>
            ) : requests.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-3 py-5 text-center text-xs text-slate-500 dark:bg-[#303632]">No pending earned hours.</p>
            ) : (
              <div className="space-y-1.5">
                {visibleEarned.map((request) => {
                  const profile = profiles[request.user_id];
                  const busy = reviewingId === request.id;
                  return (
                    <div key={request.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-[#303632]">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-xs font-bold text-slate-900 dark:text-white">{profile?.full_name || 'Employee'}</p>
                          {profile?.employee_id && <span className="shrink-0 text-[9px] font-semibold text-slate-400">{profile.employee_id}</span>}
                        </div>
                        <p className="mt-0.5 text-[10px] text-slate-500">{dateTimeLabel(request.time_out_at)} · <span className="font-bold text-cyan-700 dark:text-cyan-300">+{request.eligible_hours}h</span></p>
                      </div>
                      <div className="flex gap-1.5">
                        <button type="button" disabled={busy} onClick={() => reviewEarned(request.id, false)} className="inline-flex h-8 items-center gap-1 rounded-lg bg-rose-50 px-2.5 text-[10px] font-bold text-rose-700 disabled:opacity-40 dark:bg-rose-950/25 dark:text-rose-300"><X size={13} /> Reject</button>
                        <button type="button" disabled={busy} onClick={() => reviewEarned(request.id, true)} className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-[10px] font-bold text-white disabled:opacity-40"><Check size={13} /> Approve</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {pagination}
          </section>
        )}

        {activeTab === 'early' && (
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">Early Out</h3>
                <p className="text-[10px] text-slate-500">Exact minutes</p>
              </div>
              <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">{earlyOutRequests.length}</span>
            </div>

            {loading ? (
              <p className="py-6 text-center text-xs text-slate-500">Loading…</p>
            ) : earlyOutRequests.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-3 py-5 text-center text-xs text-slate-500 dark:bg-[#303632]">No pending Early Out.</p>
            ) : (
              <div className="space-y-1.5">
                {visibleEarly.map((request) => {
                  const profile = profiles[request.user_id];
                  const attendance = attendanceLogs[request.attendance_log_id];
                  const busy = reviewingId === request.id;
                  return (
                    <div key={request.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl bg-amber-50/60 px-3 py-2 dark:bg-amber-950/15">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-xs font-bold text-slate-900 dark:text-white">{profile?.full_name || 'Employee'}</p>
                          {profile?.employee_id && <span className="shrink-0 text-[9px] font-semibold text-slate-400">{profile.employee_id}</span>}
                        </div>
                        <p className="mt-0.5 text-[10px] text-slate-500">{attendance?.log_date || '—'} · Out {timeLabel(attendance?.time_out || null)} · <span className="font-bold text-amber-700 dark:text-amber-300">{formatMinutes(request.required_minutes)}</span></p>
                      </div>
                      <div className="flex gap-1.5">
                        <button type="button" disabled={busy} onClick={() => reviewEarlyOut(request.id, false)} className="inline-flex h-8 items-center gap-1 rounded-lg bg-white px-2.5 text-[10px] font-bold text-rose-700 shadow-sm disabled:opacity-40 dark:bg-[#303632] dark:text-rose-300"><X size={13} /> Reject</button>
                        <button type="button" disabled={busy} onClick={() => reviewEarlyOut(request.id, true)} className="inline-flex h-8 items-center gap-1 rounded-lg bg-amber-600 px-2.5 text-[10px] font-bold text-white disabled:opacity-40"><Check size={13} /> Approve</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {pagination}
          </section>
        )}

        {activeTab === 'late' && (
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">Late</h3>
                <p className="text-[10px] text-slate-500">Current & previous month · exact late minutes</p>
              </div>
              <span className="rounded-full bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">{usageRequests.length}</span>
            </div>

            {loading ? (
              <p className="py-6 text-center text-xs text-slate-500">Loading…</p>
            ) : usageRequests.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-3 py-5 text-center text-xs text-slate-500 dark:bg-[#303632]">No pending Late Offset.</p>
            ) : (
              <div className="space-y-1.5">
                {visibleLate.map((request) => {
                  const profile = profiles[request.user_id];
                  const attendance = attendanceLogs[request.attendance_log_id];
                  const busy = reviewingId === request.id;
                  return (
                    <div key={request.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl bg-violet-50/60 px-3 py-2 dark:bg-violet-950/15">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-xs font-bold text-slate-900 dark:text-white">{profile?.full_name || 'Employee'}</p>
                          {profile?.employee_id && <span className="shrink-0 text-[9px] font-semibold text-slate-400">{profile.employee_id}</span>}
                        </div>
                        <p className="mt-0.5 text-[10px] text-slate-500">{attendance?.log_date || '—'} · In {timeLabel(attendance?.time_in || null)} · <span className="font-bold text-violet-700 dark:text-violet-300">{formatMinutes(Number(request.required_minutes ?? request.hours * 60))}</span></p>
                      </div>
                      <div className="flex gap-1.5">
                        <button type="button" disabled={busy} onClick={() => reviewUsage(request.id, false)} className="inline-flex h-8 items-center gap-1 rounded-lg bg-white px-2.5 text-[10px] font-bold text-rose-700 shadow-sm disabled:opacity-40 dark:bg-[#303632] dark:text-rose-300"><X size={13} /> Reject</button>
                        <button type="button" disabled={busy} onClick={() => reviewUsage(request.id, true)} className="inline-flex h-8 items-center gap-1 rounded-lg bg-violet-600 px-2.5 text-[10px] font-bold text-white disabled:opacity-40"><Check size={13} /> Approve</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {pagination}
          </section>
        )}

        {activeTab === 'balances' && (
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">Employee Balances</h3>
                <p className="text-[10px] text-slate-500">Approved · Reserved · Available</p>
              </div>
              <span className="text-[10px] font-semibold text-slate-400">{filteredBalances.length}</span>
            </div>

            <div className="relative mb-2">
              <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={balanceSearch}
                onChange={(event) => setBalanceSearch(event.target.value)}
                placeholder="Search employee"
                className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-[11px] text-slate-800 outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-[#292f2b] dark:text-white"
              />
            </div>

            {loading ? (
              <p className="py-6 text-center text-xs text-slate-500">Loading…</p>
            ) : visibleBalances.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-3 py-5 text-center text-xs text-slate-500 dark:bg-[#303632]">No employee found.</p>
            ) : (
              <div className="space-y-1.5">
                {visibleBalances.map((row) => (
                  <div key={row.user_id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-[#303632]">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-900 dark:text-white">{row.full_name || 'Employee'}</p>
                      <p className="text-[9px] text-slate-500">{row.employee_id || 'No ID'}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-center">
                      <div className="min-w-[50px] rounded-md bg-white px-1.5 py-1 dark:bg-[#292f2b]"><p className="text-[7px] font-bold uppercase text-slate-400">Approved</p><p className="text-[10px] font-black text-slate-700 dark:text-slate-200">{formatMinutes(row.approved_minutes)}</p></div>
                      <div className="min-w-[50px] rounded-md bg-amber-50 px-1.5 py-1 dark:bg-amber-950/20"><p className="text-[7px] font-bold uppercase text-amber-500">Reserved</p><p className="text-[10px] font-black text-amber-700 dark:text-amber-300">{formatMinutes(row.reserved_minutes)}</p></div>
                      <div className="min-w-[50px] rounded-md bg-emerald-50 px-1.5 py-1 dark:bg-emerald-950/20"><p className="text-[7px] font-bold uppercase text-emerald-500">Available</p><p className="text-[10px] font-black text-emerald-700 dark:text-emerald-300">{formatMinutes(row.available_minutes)}</p></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {pagination}
          </section>
        )}
      </div>
    </ModalShell>
  );
}
