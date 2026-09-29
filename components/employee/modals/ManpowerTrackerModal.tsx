'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, LockKeyhole, PauseCircle, PlayCircle, RefreshCw, TimerReset } from 'lucide-react';
import ModalShell from '@/components/shared/ModalShell';
import { supabase } from '@/lib/supabase';

type Project = { id: string; name: string; project_code: string | null };
type Session = { id: string; project_id: string; started_at: string; ended_at: string | null };
type LunchPause = { project_id: string; resumed_at: string | null };
type ShiftStatus = 'not_started' | 'active' | 'completed';
type Props = { open: boolean; onClose: () => void };

const MANILA_OFFSET = '+08:00';

function todayManilaDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function manilaHour(date: Date) {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', hourCycle: 'h23' })
    .formatToParts(date)
    .find((item) => item.type === 'hour');
  return Number(part?.value || 0);
}

function dayBounds(date: string) {
  const start = new Date(`${date}T00:00:00${MANILA_OFFSET}`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

function formatDuration(ms: number) {
  const safe = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function clippedDuration(session: Session, start: Date, end: Date, now: Date) {
  const sessionStart = new Date(session.started_at).getTime();
  const sessionEnd = session.ended_at ? new Date(session.ended_at).getTime() : now.getTime();
  return Math.max(0, Math.min(sessionEnd, end.getTime()) - Math.max(sessionStart, start.getTime()));
}

export default function ManpowerTrackerModal({ open, onClose }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [lunchPause, setLunchPause] = useState<LunchPause | null>(null);
  const [shiftStatus, setShiftStatus] = useState<ShiftStatus>('not_started');
  const [loading, setLoading] = useState(true);
  const [changingProjectId, setChangingProjectId] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [now, setNow] = useState(() => new Date());

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      setMessage({ type: 'error', text: 'Your session could not be verified. Please sign in again.' });
      if (!silent) setLoading(false);
      return;
    }

    const date = todayManilaDate();
    const { start, end } = dayBounds(date);
    const [projectRes, activeRes, sessionRes, attendanceRes, lunchRes] = await Promise.all([
      supabase.from('manpower_projects').select('id,name,project_code').eq('is_active', true).order('name'),
      supabase.from('manpower_sessions').select('id,project_id,started_at,ended_at').eq('user_id', user.id).is('ended_at', null).order('started_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('manpower_sessions').select('id,project_id,started_at,ended_at').eq('user_id', user.id).lt('started_at', end.toISOString()).or(`ended_at.is.null,ended_at.gte.${start.toISOString()}`).order('started_at', { ascending: true }),
      supabase.from('attendance_logs').select('time_in,time_out').eq('user_id', user.id).eq('log_date', date).maybeSingle(),
      supabase.from('manpower_lunch_pauses').select('project_id,resumed_at').eq('user_id', user.id).eq('lunch_date', date).maybeSingle(),
    ]);

    if (projectRes.error) console.error('Error fetching manpower projects:', projectRes.error);
    if (activeRes.error) console.error('Error fetching active manpower session:', activeRes.error);
    if (sessionRes.error) console.error('Error fetching manpower sessions:', sessionRes.error);
    if (attendanceRes.error) console.error('Error fetching attendance shift:', attendanceRes.error);
    if (lunchRes.error) console.error('Error fetching manpower lunch pause:', lunchRes.error);

    const attendance = attendanceRes.data;
    setShiftStatus(!attendance?.time_in ? 'not_started' : attendance.time_out ? 'completed' : 'active');
    setProjects((projectRes.data || []) as Project[]);
    setActiveSession((activeRes.data || null) as Session | null);
    setSessions((sessionRes.data || []) as Session[]);
    setLunchPause((lunchRes.data || null) as LunchPause | null);
    setNow(new Date());
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    fetchData(false);
    const refresh = window.setInterval(() => fetchData(true), 15_000);
    return () => window.clearInterval(refresh);
  }, [open, fetchData]);

  useEffect(() => {
    if (!open) return;
    const ticker = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(ticker);
  }, [open]);

  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const currentProject = activeSession ? projectMap.get(activeSession.project_id) : null;
  const pausedProject = lunchPause ? projectMap.get(lunchPause.project_id) : null;
  const bounds = dayBounds(todayManilaDate());
  const localHour = manilaHour(now);
  const beforeTrackerStart = localHour < 9;
  const lunchBreak = localHour === 12;
  const shiftActive = shiftStatus === 'active';
  const trackingEnabled = shiftActive && !beforeTrackerStart && !lunchBreak;

  const projectTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const session of sessions) {
      const duration = clippedDuration(session, bounds.start, bounds.end, now);
      totals.set(session.project_id, (totals.get(session.project_id) || 0) + duration);
    }
    return [...totals.entries()]
      .map(([projectId, duration]) => ({ projectId, duration, project: projectMap.get(projectId) }))
      .sort((a, b) => b.duration - a.duration);
  }, [sessions, bounds.start, bounds.end, now, projectMap]);

  const todayTotal = projectTotals.reduce((sum, item) => sum + item.duration, 0);
  const activeElapsed = activeSession ? Math.max(0, now.getTime() - new Date(activeSession.started_at).getTime()) : 0;

  const switchProject = async (projectId: string) => {
    if (!trackingEnabled) {
      const text = shiftStatus === 'completed'
        ? 'Your shift is complete. Tracking is locked after Time Out.'
        : !shiftActive
          ? 'Time In first before starting the Manpower Tracker.'
          : beforeTrackerStart
            ? 'Manpower Tracker starts at 9:00 AM Manila time.'
            : lunchBreak
              ? 'Manpower Tracker is on lunch break from 12:00 PM to 1:00 PM.'
              : 'Manpower Tracker is not available right now.';
      setMessage({ type: 'error', text });
      return;
    }
    if (activeSession?.project_id === projectId) return;
    setChangingProjectId(projectId);
    setMessage(null);
    const { error } = await supabase.rpc('switch_manpower_project', { p_project_id: projectId });
    if (error) {
      setMessage({ type: 'error', text: error.message || 'Unable to start this project timer.' });
    } else {
      setMessage({ type: 'success', text: activeSession ? 'Previous project stopped and the selected project started.' : 'Project timer started.' });
    }
    setChangingProjectId(null);
    await fetchData(true);
  };

  const stopTracking = async () => {
    setStopping(true);
    setMessage(null);
    const { error } = await supabase.rpc('stop_manpower_tracking');
    setMessage(error ? { type: 'error', text: error.message || 'Unable to stop manpower tracking.' } : { type: 'success', text: 'Project timer stopped.' });
    setStopping(false);
    await fetchData(true);
  };

  const shiftMeta = lunchBreak && shiftActive
    ? { title: 'Lunch break', text: `${pausedProject?.name || 'Your active project'} is paused from 12:00 PM to 1:00 PM and will resume automatically if your shift is still open.`, className: 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200', icon: <PauseCircle size={18} /> }
    : shiftActive && beforeTrackerStart
      ? { title: 'Tracker opens at 9:00 AM', text: 'You are already timed in. Project tracking becomes available at 9:00 AM Manila time.', className: 'bg-cyan-50 text-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-200', icon: <Clock3 size={18} /> }
      : shiftStatus === 'active'
        ? { title: 'Shift active', text: 'Tracking is available from 9:00 AM until Time Out. Time Out automatically stops the running project.', className: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200', icon: <CheckCircle2 size={18} /> }
        : shiftStatus === 'completed'
          ? { title: 'Shift completed', text: 'Tracking is locked because you already timed out.', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200', icon: <LockKeyhole size={18} /> }
          : { title: 'Time In required', text: 'Start your attendance shift first. Project tracking opens at 9:00 AM Manila time.', className: 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200', icon: <Clock3 size={18} /> };

  return (
    <ModalShell open={open} onClose={onClose} title="Manpower Tracker" description="Project tracking starts at 9:00 AM, pauses for lunch from 12:00 PM to 1:00 PM, and stops automatically at Time Out." icon={<TimerReset size={20} />} size="lg">
      <div className="space-y-4">
        {message && <div className={`rounded-xl px-3 py-2 text-xs font-medium ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/35 dark:text-rose-300'}`}>{message.text}</div>}

        <section className={`flex items-start gap-3 rounded-2xl px-4 py-3 ${shiftMeta.className}`}><span className="mt-0.5 flex-none">{shiftMeta.icon}</span><div><p className="text-sm font-bold">{shiftMeta.title}</p><p className="mt-0.5 text-[11px] opacity-80">{shiftMeta.text}</p></div></section>

        <section className={`rounded-2xl p-4 ${activeSession && trackingEnabled ? 'bg-emerald-50/90 dark:bg-emerald-950/25' : 'bg-slate-50 dark:bg-[#303632]'}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Currently tracking</p><h3 className="mt-1 truncate text-lg font-bold text-slate-900 dark:text-white">{lunchBreak && shiftActive ? (pausedProject?.name || 'Paused for lunch') : activeSession ? (currentProject?.name || 'Inactive project') : 'No active project'}</h3>{(lunchBreak ? pausedProject?.project_code : currentProject?.project_code) && <p className="mt-0.5 text-xs text-slate-500">{lunchBreak ? pausedProject?.project_code : currentProject?.project_code}</p>}</div>
            <div className="flex items-center gap-2 sm:flex-col sm:items-end"><span className={`font-mono text-xl font-semibold tracking-tight ${activeSession && trackingEnabled ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400'}`}>{activeSession && trackingEnabled ? formatDuration(activeElapsed) : '00:00:00'}</span>{activeSession && trackingEnabled && <button type="button" onClick={stopTracking} disabled={stopping} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900"><PauseCircle size={15}/>{stopping ? 'Stopping…' : 'Stop'}</button>}</div>
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between gap-2"><div><h3 className="text-sm font-bold text-slate-900 dark:text-white">Select project</h3><p className="text-[11px] text-slate-500">One project at a time. Switching automatically stops the previous project.</p></div><button type="button" onClick={() => fetchData(false)} className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" aria-label="Refresh projects"><RefreshCw size={15}/></button></div>
          {loading ? <p className="rounded-2xl bg-slate-50 px-4 py-7 text-center text-sm text-slate-500 dark:bg-[#303632]">Loading projects…</p> : projects.length === 0 ? <p className="rounded-2xl bg-slate-50 px-4 py-7 text-center text-sm text-slate-500 dark:bg-[#303632]">No active manpower projects yet.</p> : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{projects.map((project) => {
              const active = activeSession?.project_id === project.id;
              const changing = changingProjectId === project.id;
              const locked = !trackingEnabled;
              return <button key={project.id} type="button" onClick={() => switchProject(project.id)} disabled={locked || active || changing} className={`min-h-20 rounded-2xl px-3 py-3 text-left transition ${active && trackingEnabled ? 'bg-emerald-600 text-white shadow-md' : locked ? 'bg-slate-100 text-slate-400 dark:bg-slate-800/70 dark:text-slate-500' : 'bg-slate-50 text-slate-800 hover:bg-slate-100 dark:bg-[#303632] dark:text-white dark:hover:bg-slate-800'} disabled:cursor-not-allowed`}><div className="flex items-start justify-between gap-2"><span className="min-w-0"><span className="block line-clamp-2 text-xs font-bold leading-tight">{project.name}</span>{project.project_code && <span className="mt-1 block text-[10px] opacity-70">{project.project_code}</span>}</span>{locked ? <LockKeyhole size={16}/> : active ? <Clock3 size={16}/> : <PlayCircle size={16} className="text-slate-400"/>}</div><span className="mt-2 block text-[10px] font-semibold opacity-70">{lunchBreak && shiftActive ? 'Lunch break' : !shiftActive ? (shiftStatus === 'completed' ? 'Shift completed' : 'Time In required') : beforeTrackerStart ? 'Starts 9:00 AM' : active ? 'Tracking now' : changing ? 'Starting…' : 'Start / Switch'}</span></button>;
            })}</div>
          )}
        </section>

        <section className="border-t border-slate-100 pt-4 dark:border-slate-800"><div className="mb-2 flex items-end justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-900 dark:text-white">Today by project</h3><p className="text-[11px] text-slate-500">Tracking starts at 9:00 AM. Lunch from 12:00 PM to 1:00 PM is excluded automatically.</p></div><span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[11px] font-bold text-cyan-700 dark:bg-cyan-950/35 dark:text-cyan-300">{formatDuration(todayTotal)}</span></div>{projectTotals.length === 0 ? <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-500 dark:bg-[#303632]">No project time recorded today.</p> : <div className="space-y-2">{projectTotals.map((item) => <div key={item.projectId} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-[#303632]"><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-900 dark:text-white">{item.project?.name || 'Inactive project'}</p>{item.project?.project_code && <p className="mt-0.5 text-[10px] text-slate-500">{item.project.project_code}</p>}</div><span className="flex-none font-mono text-xs font-bold text-slate-700 dark:text-slate-200">{formatDuration(item.duration)}</span></div>)}</div>}</section>
      </div>
    </ModalShell>
  );
}