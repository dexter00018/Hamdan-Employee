'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock3, PauseCircle, PlayCircle, RefreshCw, TimerReset } from 'lucide-react';
import ModalShell from '@/components/shared/ModalShell';
import { supabase } from '@/lib/supabase';

type Project = {
  id: string;
  name: string;
  project_code: string | null;
};

type Session = {
  id: string;
  project_id: string;
  started_at: string;
  ended_at: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

const MANILA_OFFSET = '+08:00';

function todayManilaDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function dayBounds(date: string) {
  const start = new Date(`${date}T00:00:00${MANILA_OFFSET}`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
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
  const from = Math.max(sessionStart, start.getTime());
  const to = Math.min(sessionEnd, end.getTime());
  return Math.max(0, to - from);
}

export default function ManpowerTrackerModal({ open, onClose }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [changingProjectId, setChangingProjectId] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [now, setNow] = useState(() => new Date());

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      setMessage({ type: 'error', text: 'Your session could not be verified. Please sign in again.' });
      setLoading(false);
      return;
    }

    const date = todayManilaDate();
    const { start, end } = dayBounds(date);
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    const [projectRes, activeRes, sessionRes] = await Promise.all([
      supabase
        .from('manpower_projects')
        .select('id,name,project_code')
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('manpower_sessions')
        .select('id,project_id,started_at,ended_at')
        .eq('user_id', user.id)
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('manpower_sessions')
        .select('id,project_id,started_at,ended_at')
        .eq('user_id', user.id)
        .lt('started_at', endIso)
        .or(`ended_at.is.null,ended_at.gte.${startIso}`)
        .order('started_at', { ascending: true }),
    ]);

    if (projectRes.error) console.error('Error fetching manpower projects:', projectRes.error);
    if (activeRes.error) console.error('Error fetching active manpower session:', activeRes.error);
    if (sessionRes.error) console.error('Error fetching manpower sessions:', sessionRes.error);

    setProjects((projectRes.data || []) as Project[]);
    setActiveSession((activeRes.data || null) as Session | null);
    setSessions((sessionRes.data || []) as Session[]);
    setNow(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    fetchData();
  }, [open, fetchData]);

  useEffect(() => {
    if (!open || !activeSession) return;
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, [open, activeSession]);

  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const currentProject = activeSession ? projectMap.get(activeSession.project_id) : null;
  const today = todayManilaDate();
  const bounds = dayBounds(today);

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
    if (activeSession?.project_id === projectId) return;
    setChangingProjectId(projectId);
    setMessage(null);
    const { error } = await supabase.rpc('switch_manpower_project', { p_project_id: projectId });
    if (error) {
      setMessage({ type: 'error', text: error.message || 'Unable to start this project timer.' });
      setChangingProjectId(null);
      return;
    }
    setMessage({ type: 'success', text: activeSession ? 'Previous project stopped and the selected project timer started.' : 'Project timer started.' });
    setChangingProjectId(null);
    await fetchData();
  };

  const stopTracking = async () => {
    setStopping(true);
    setMessage(null);
    const { error } = await supabase.rpc('stop_manpower_tracking');
    if (error) {
      setMessage({ type: 'error', text: error.message || 'Unable to stop manpower tracking.' });
      setStopping(false);
      return;
    }
    setMessage({ type: 'success', text: 'Project timer stopped.' });
    setStopping(false);
    await fetchData();
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Manpower Tracker"
      description="Choose the project you are working on. Switching projects automatically stops the previous timer."
      icon={<TimerReset size={20} />}
      size="lg"
    >
      <div className="space-y-4">
        {message && (
          <div className={`rounded-xl px-3 py-2 text-xs font-medium ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/35 dark:text-rose-300'}`}>
            {message.text}
          </div>
        )}

        <section className={`rounded-2xl p-4 ${activeSession ? 'bg-emerald-50/90 dark:bg-emerald-950/25' : 'bg-slate-50 dark:bg-[#303632]'}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Currently tracking</p>
              <h3 className="mt-1 truncate text-lg font-bold text-slate-900 dark:text-white">
                {activeSession ? (currentProject?.name || 'Inactive project') : 'No active project'}
              </h3>
              {currentProject?.project_code && <p className="mt-0.5 text-xs text-slate-500">{currentProject.project_code}</p>}
            </div>
            <div className="flex items-center gap-2 sm:flex-col sm:items-end">
              <span className={`font-mono text-xl font-semibold tracking-tight ${activeSession ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400'}`}>
                {activeSession ? formatDuration(activeElapsed) : '00:00:00'}
              </span>
              {activeSession && (
                <button
                  type="button"
                  onClick={stopTracking}
                  disabled={stopping}
                  className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900"
                >
                  <PauseCircle size={15} /> {stopping ? 'Stopping…' : 'Stop'}
                </button>
              )}
            </div>
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Select project</h3>
              <p className="text-[11px] text-slate-500">Only projects activated by Super Admin appear here.</p>
            </div>
            <button type="button" onClick={fetchData} className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" aria-label="Refresh projects">
              <RefreshCw size={15} />
            </button>
          </div>

          {loading ? (
            <p className="rounded-2xl bg-slate-50 px-4 py-7 text-center text-sm text-slate-500 dark:bg-[#303632]">Loading projects…</p>
          ) : projects.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 px-4 py-7 text-center text-sm text-slate-500 dark:bg-[#303632]">No active manpower projects yet. Please ask Super Admin to add one.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {projects.map((project) => {
                const active = activeSession?.project_id === project.id;
                const changing = changingProjectId === project.id;
                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => switchProject(project.id)}
                    disabled={active || changing}
                    className={`min-h-20 rounded-2xl px-3 py-3 text-left transition ${active ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-50 text-slate-800 hover:bg-slate-100 dark:bg-[#303632] dark:text-white dark:hover:bg-slate-800'} disabled:cursor-default`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block line-clamp-2 text-xs font-bold leading-tight">{project.name}</span>
                        {project.project_code && <span className={`mt-1 block text-[10px] ${active ? 'text-emerald-100' : 'text-slate-500'}`}>{project.project_code}</span>}
                      </span>
                      {active ? <Clock3 size={16} className="flex-none" /> : <PlayCircle size={16} className="flex-none text-slate-400" />}
                    </div>
                    <span className={`mt-2 block text-[10px] font-semibold ${active ? 'text-emerald-100' : 'text-slate-500'}`}>{active ? 'Tracking now' : changing ? 'Starting…' : 'Start / Switch'}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="border-t border-slate-100 pt-4 dark:border-slate-800">
          <div className="mb-2 flex items-end justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Today by project</h3>
              <p className="text-[11px] text-slate-500">September-style project hours are calculated from the actual switch times.</p>
            </div>
            <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[11px] font-bold text-cyan-700 dark:bg-cyan-950/35 dark:text-cyan-300">{formatDuration(todayTotal)}</span>
          </div>
          {projectTotals.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-500 dark:bg-[#303632]">No project time recorded today.</p>
          ) : (
            <div className="space-y-2">
              {projectTotals.map((item) => (
                <div key={item.projectId} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-[#303632]">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">{item.project?.name || 'Inactive project'}</p>
                    {item.project?.project_code && <p className="mt-0.5 text-[10px] text-slate-500">{item.project.project_code}</p>}
                  </div>
                  <span className="flex-none font-mono text-xs font-bold text-slate-700 dark:text-slate-200">{formatDuration(item.duration)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </ModalShell>
  );
}
