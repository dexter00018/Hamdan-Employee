'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Clock3, Eraser, LogOut, Search, Sparkles, Users, X } from 'lucide-react';
import ModalShell from '@/components/shared/ModalShell';
import { supabase } from '@/lib/supabase';

type OffsetRequest = { id: string; user_id: string; eligible_hours: number; time_out_at: string; created_at: string };
type OffsetUsageRequest = { id: string; user_id: string; attendance_log_id: string; hours: number; required_minutes: number | null; created_at: string };
type EarlyOutOffsetRequest = { id: string; user_id: string; attendance_log_id: string; required_minutes: number; cutoff_hour: number; created_at: string };
type EmployeeProfile = { id: string; full_name: string | null; employee_id: string | null };
type AttendanceLog = { id: string; log_date: string; time_in: string | null; time_out: string | null; status: string | null };
type EmployeeOffsetBalance = { user_id: string; full_name: string; employee_id: string | null; approved_minutes: number; reserved_minutes: number; available_minutes: number };
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

function timeLabel(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });
}

function dateTimeLabel(value: string) {
  return new Date(value).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function HROffsetApprovalNotifierV2() {
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
      supabase.from('offset_requests').select('id,user_id,eligible_hours,time_out_at,created_at').eq('status', 'Pending').order('created_at', { ascending: true }),
      supabase.from('offset_usage_requests').select('id,user_id,attendance_log_id,hours,required_minutes,created_at').eq('status', 'Pending').order('created_at', { ascending: true }),
      supabase.from('early_out_offset_requests').select('id,user_id,attendance_log_id,required_minutes,cutoff_hour,created_at').eq('status', 'Pending').order('created_at', { ascending: true }),
      supabase.rpc('get_hr_offset_balances'),
    ]);

    if (pendingRes.error) console.error('Error fetching pending Offset:', pendingRes.error);
    if (usageRes.error) console.error('Error fetching Late Offset:', usageRes.error);
    if (earlyOutRes.error) console.error('Error fetching Early Out Offset:', earlyOutRes.error);
    if (balanceRes.error) console.error('Error fetching Offset balances:', balanceRes.error);

    const pending = (pendingRes.data || []) as OffsetRequest[];
    const usage = ((usageRes.data || []) as any[]).map((row) => ({ ...row, attendance_log_id: String(row.attendance_log_id) })) as OffsetUsageRequest[];
    const early = ((earlyOutRes.data || []) as any[]).map((row) => ({ ...row, attendance_log_id: String(row.attendance_log_id) })) as EarlyOutOffsetRequest[];

    setRequests(pending);
    setUsageRequests(usage);
    setEarlyOutRequests(early);
    setBalances(((balanceRes.data || []) as any[]).map((row) => ({
      ...row,
      approved_minutes: Number(row.approved_minutes || 0),
      reserved_minutes: Number(row.reserved_minutes || 0),
      available_minutes: Number(row.available_minutes || 0),
    })) as EmployeeOffsetBalance[]);

    const userIds = [...new Set([...pending.map((r) => r.user_id), ...usage.map((r) => r.user_id), ...early.map((r) => r.user_id)])];
    const attendanceIds = [...new Set([...usage.map((r) => Number(r.attendance_log_id)), ...early.map((r) => Number(r.attendance_log_id))].filter(Number.isFinite))];

    const [profileRes, attendanceRes] = await Promise.all([
      userIds.length ? supabase.from('profiles').select('id,full_name,employee_id').in('id', userIds) : Promise.resolve({ data: [], error: null } as any),
      attendanceIds.length ? supabase.from('attendance_logs').select('id,log_date,time_in,time_out,status').in('id', attendanceIds) : Promise.resolve({ data: [], error: null } as any),
    ]);

    if (profileRes.error) console.error('Error fetching Offset profiles:', profileRes.error);
    if (attendanceRes.error) console.error('Error fetching Offset attendance:', attendanceRes.error);

    setProfiles(Object.fromEntries(((profileRes.data || []) as EmployeeProfile[]).map((profile) => [profile.id, profile])));
    setAttendanceLogs(Object.fromEntries(((attendanceRes.data || []) as any[]).map((row) => [String(row.id), { ...row, id: String(row.id) }])));
    setLoading(false);
    window.dispatchEvent(new Event('hr:offset-updated'));
  }, []);

  useEffect(() => {
    void fetchOffsetWork();
    const refresh = () => { if (document.visibilityState === 'visible') void fetchOffsetWork(); };
    const openOffset = () => { setOpen(true); void fetchOffsetWork(); };
    const channel = supabase
      .channel('hr-offset-work-live')
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

  useEffect(() => { setPage(0); }, [activeTab, balanceSearch]);

  const totalHours = useMemo(() => requests.reduce((sum, request) => sum + Number(request.eligible_hours || 0), 0), [requests]);
  const filteredBalances = useMemo(() => {
    const q = balanceSearch.trim().toLowerCase();
    return q ? balances.filter((row) => `${row.full_name} ${row.employee_id || ''}`.toLowerCase().includes(q)) : balances;
  }, [balances, balanceSearch]);

  const reviewEarned = async (requestId: string, approve: boolean) => {
    setReviewingId(requestId); setMessage(null);
    const { error } = await supabase.rpc('review_offset_request', { p_request_id: requestId, p_approve: approve, p_notes: approve ? 'Approved by HR' : 'Declined by HR' });
    if (error) setMessage(error.message || 'Unable to review earned Offset.');
    else setMessage(approve ? 'Earned Offset approved.' : 'Earned Offset declined.');
    setReviewingId(null); if (!error) await fetchOffsetWork();
  };

  const reviewLate = async (requestId: string, approve: boolean) => {
    setReviewingId(requestId); setMessage(null);
    const { error } = await supabase.rpc('review_offset_usage_request', { p_request_id: requestId, p_approve: approve, p_notes: approve ? 'Approved by HR' : 'Declined by HR' });
    if (error) setMessage(error.message || 'Unable to review Late Offset.');
    else setMessage(approve ? 'Late Offset approved.' : 'Late Offset declined.');
    setReviewingId(null); if (!error) await fetchOffsetWork();
  };

  const reviewEarly = async (requestId: string, approve: boolean) => {
    setReviewingId(requestId); setMessage(null);
    const { error } = await supabase.rpc('review_early_out_offset_request', { p_request_id: requestId, p_approve: approve, p_notes: approve ? 'Approved by HR' : 'Declined by HR' });
    if (error) setMessage(error.message || 'Unable to review Early Out Offset.');
    else setMessage(approve ? 'Early Out approved.' : 'Early Out declined.');
    setReviewingId(null); if (!error) await fetchOffsetWork();
  };

  const tabs: Array<{ key: TabKey; label: string; count: number; icon: React.ReactNode }> = [
    { key: 'earned', label: 'Earned', count: requests.length, icon: <Sparkles size={14} /> },
    { key: 'early', label: 'Early Out', count: earlyOutRequests.length, icon: <LogOut size={14} /> },
    { key: 'late', label: 'Late', count: usageRequests.length, icon: <Eraser size={14} /> },
    { key: 'balances', label: 'Balances', count: balances.length, icon: <Users size={14} /> },
  ];

  const currentLength = activeTab === 'earned' ? requests.length : activeTab === 'early' ? earlyOutRequests.length : activeTab === 'late' ? usageRequests.length : filteredBalances.length;
  const pageCount = Math.max(1, Math.ceil(currentLength / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const visibleEarned = requests.slice(start, end);
  const visibleEarly = earlyOutRequests.slice(start, end);
  const visibleLate = usageRequests.slice(start, end);
  const visibleBalances = filteredBalances.slice(start, end);

  const pager = (
    <div className="mt-auto flex shrink-0 items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-800">
      <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-bold text-slate-600 disabled:opacity-30 dark:bg-slate-800 dark:text-slate-300">Previous</button>
      <span className="text-[10px] font-semibold text-slate-400">{safePage + 1}/{pageCount}</span>
      <button type="button" onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={safePage >= pageCount - 1} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-bold text-slate-600 disabled:opacity-30 dark:bg-slate-800 dark:text-slate-300">Next</button>
    </div>
  );

  return (
    <ModalShell open={open} onClose={() => setOpen(false)} title="Offset Management" description="HR approvals and balances" icon={<Clock3 size={20} />} size="lg" className="h-[680px] max-h-[92dvh]">
      <div className="flex h-full min-h-0 flex-col gap-3">
        {message && <div className="shrink-0 rounded-lg bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{message}</div>}

        <div className="grid shrink-0 grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1 sm:grid-cols-4 dark:bg-[#2d332f]">
          {tabs.map((tab) => <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={`flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-[11px] font-bold transition ${activeTab === tab.key ? 'bg-white text-slate-900 shadow-sm dark:bg-[#3a413c] dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>{tab.icon}<span>{tab.label}</span><span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[9px] text-slate-500 dark:bg-slate-800">{tab.count}</span></button>)}
        </div>

        {activeTab === 'earned' && <section className="flex min-h-0 flex-1 flex-col">
          <div className="mb-2 flex shrink-0 items-center justify-between"><div><h3 className="text-xs font-bold text-slate-900 dark:text-white">Earned Hours</h3><p className="text-[10px] text-slate-500">After 7:30 PM · assigned to final project on approval</p></div><span className="rounded-full bg-cyan-50 px-2 py-1 text-[10px] font-bold text-cyan-700">{requests.length} · {totalHours}h</span></div>
          <div className="min-h-0 flex-1 space-y-1.5 overflow-hidden">
            {loading ? <p className="py-8 text-center text-xs text-slate-500">Loading…</p> : visibleEarned.length ? visibleEarned.map((request) => {
              const profile = profiles[request.user_id]; const busy = reviewingId === request.id;
              return <div key={request.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-[#303632]"><div className="min-w-0"><p className="truncate text-xs font-bold text-slate-900 dark:text-white">{profile?.full_name || 'Employee'}</p><p className="mt-0.5 text-[10px] text-slate-500">{profile?.employee_id || 'No ID'} · {dateTimeLabel(request.time_out_at)} · <b className="text-cyan-700">+{request.eligible_hours}h</b></p></div><div className="flex gap-1.5"><button disabled={busy} onClick={() => reviewEarned(request.id, false)} className="inline-flex h-8 items-center gap-1 rounded-lg bg-rose-50 px-2.5 text-[10px] font-bold text-rose-700 disabled:opacity-40"><X size={13}/> Reject</button><button disabled={busy} onClick={() => reviewEarned(request.id, true)} className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-[10px] font-bold text-white disabled:opacity-40"><Check size={13}/> Approve</button></div></div>;
            }) : <p className="rounded-xl bg-slate-50 px-3 py-8 text-center text-xs text-slate-500">No pending earned hours.</p>}
          </div>{pager}
        </section>}

        {activeTab === 'early' && <section className="flex min-h-0 flex-1 flex-col">
          <div className="mb-2 shrink-0"><h3 className="text-xs font-bold text-slate-900 dark:text-white">Early Out</h3><p className="text-[10px] text-slate-500">Exact minutes · current & previous month</p></div>
          <div className="min-h-0 flex-1 space-y-1.5 overflow-hidden">
            {loading ? <p className="py-8 text-center text-xs text-slate-500">Loading…</p> : visibleEarly.length ? visibleEarly.map((request) => {
              const profile = profiles[request.user_id]; const attendance = attendanceLogs[request.attendance_log_id]; const busy = reviewingId === request.id;
              return <div key={request.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-amber-50/60 px-3 py-2.5 dark:bg-amber-950/15"><div className="min-w-0"><p className="truncate text-xs font-bold text-slate-900 dark:text-white">{profile?.full_name || 'Employee'}</p><p className="mt-0.5 text-[10px] text-slate-500">{attendance?.log_date || '—'} · Out {timeLabel(attendance?.time_out)} · <b className="text-amber-700">{formatMinutes(request.required_minutes)}</b></p></div><div className="flex gap-1.5"><button disabled={busy} onClick={() => reviewEarly(request.id, false)} className="inline-flex h-8 items-center gap-1 rounded-lg bg-white px-2.5 text-[10px] font-bold text-rose-700 disabled:opacity-40"><X size={13}/> Reject</button><button disabled={busy} onClick={() => reviewEarly(request.id, true)} className="inline-flex h-8 items-center gap-1 rounded-lg bg-amber-600 px-2.5 text-[10px] font-bold text-white disabled:opacity-40"><Check size={13}/> Approve</button></div></div>;
            }) : <p className="rounded-xl bg-slate-50 px-3 py-8 text-center text-xs text-slate-500">No pending Early Out.</p>}
          </div>{pager}
        </section>}

        {activeTab === 'late' && <section className="flex min-h-0 flex-1 flex-col">
          <div className="mb-2 shrink-0"><h3 className="text-xs font-bold text-slate-900 dark:text-white">Late</h3><p className="text-[10px] text-slate-500">Current & previous month · exact late minutes</p></div>
          <div className="min-h-0 flex-1 space-y-1.5 overflow-hidden">
            {loading ? <p className="py-8 text-center text-xs text-slate-500">Loading…</p> : visibleLate.length ? visibleLate.map((request) => {
              const profile = profiles[request.user_id]; const attendance = attendanceLogs[request.attendance_log_id]; const busy = reviewingId === request.id;
              return <div key={request.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-violet-50/60 px-3 py-2.5 dark:bg-violet-950/15"><div className="min-w-0"><p className="truncate text-xs font-bold text-slate-900 dark:text-white">{profile?.full_name || 'Employee'}</p><p className="mt-0.5 text-[10px] text-slate-500">{attendance?.log_date || '—'} · In {timeLabel(attendance?.time_in)} · <b className="text-violet-700">{formatMinutes(Number(request.required_minutes ?? request.hours * 60))}</b></p></div><div className="flex gap-1.5"><button disabled={busy} onClick={() => reviewLate(request.id, false)} className="inline-flex h-8 items-center gap-1 rounded-lg bg-white px-2.5 text-[10px] font-bold text-rose-700 disabled:opacity-40"><X size={13}/> Reject</button><button disabled={busy} onClick={() => reviewLate(request.id, true)} className="inline-flex h-8 items-center gap-1 rounded-lg bg-violet-600 px-2.5 text-[10px] font-bold text-white disabled:opacity-40"><Check size={13}/> Approve</button></div></div>;
            }) : <p className="rounded-xl bg-slate-50 px-3 py-8 text-center text-xs text-slate-500">No pending Late Offset.</p>}
          </div>{pager}
        </section>}

        {activeTab === 'balances' && <section className="flex min-h-0 flex-1 flex-col">
          <div className="mb-2 flex shrink-0 items-center justify-between"><div><h3 className="text-xs font-bold text-slate-900 dark:text-white">Employee Balances</h3><p className="text-[10px] text-slate-500">Approved · Reserved · Available</p></div><span className="text-[10px] font-semibold text-slate-400">{filteredBalances.length}</span></div>
          <div className="relative mb-2 shrink-0"><Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={balanceSearch} onChange={(e) => setBalanceSearch(e.target.value)} placeholder="Search employee" className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-[11px] outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-[#292f2b]"/></div>
          <div className="min-h-0 flex-1 space-y-1.5 overflow-hidden">
            {loading ? <p className="py-8 text-center text-xs text-slate-500">Loading…</p> : visibleBalances.length ? visibleBalances.map((row) => <div key={row.user_id} className="grid items-center gap-3 rounded-xl bg-slate-50 px-4 py-2.5 sm:grid-cols-[minmax(0,1.1fr)_minmax(260px,1fr)] dark:bg-[#303632]"><div className="min-w-0"><p className="truncate text-xs font-bold text-slate-900 dark:text-white">{row.full_name || 'Employee'}</p><p className="text-[9px] text-slate-500">{row.employee_id || 'No ID'}</p></div><div className="grid w-full grid-cols-3 gap-2"><div className="rounded-lg bg-white px-2 py-1.5 text-center dark:bg-[#292f2b]"><p className="text-[7px] font-bold uppercase text-slate-400">Approved</p><p className="text-[10px] font-black text-slate-700 dark:text-slate-200">{formatMinutes(row.approved_minutes)}</p></div><div className="rounded-lg bg-amber-50 px-2 py-1.5 text-center dark:bg-amber-950/20"><p className="text-[7px] font-bold uppercase text-amber-500">Reserved</p><p className="text-[10px] font-black text-amber-700">{formatMinutes(row.reserved_minutes)}</p></div><div className="rounded-lg bg-emerald-50 px-2 py-1.5 text-center dark:bg-emerald-950/20"><p className="text-[7px] font-bold uppercase text-emerald-500">Available</p><p className="text-[10px] font-black text-emerald-700">{formatMinutes(row.available_minutes)}</p></div></div></div>) : <p className="rounded-xl bg-slate-50 px-3 py-8 text-center text-xs text-slate-500">No employees found.</p>}
          </div>{pager}
        </section>}
      </div>
    </ModalShell>
  );
}
