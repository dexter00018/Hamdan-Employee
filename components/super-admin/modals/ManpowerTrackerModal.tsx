'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, BriefcaseBusiness, Clock3, Plus, RefreshCw, Search, ToggleLeft, ToggleRight, UsersRound } from 'lucide-react';
import ModalShell from '@/components/shared/ModalShell';
import { supabase } from '@/lib/supabase';

type Project = {
  id: string;
  name: string;
  project_code: string | null;
  is_active: boolean;
  created_at: string;
};

type Employee = {
  id: string;
  full_name: string | null;
  employee_id: string | null;
  designation: string | null;
  is_active: boolean;
};

type Session = {
  id: string;
  user_id: string;
  project_id: string;
  started_at: string;
  ended_at: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

function todayManilaDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function dayBounds(date: string) {
  const start = new Date(`${date}T00:00:00+08:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function durationWithinDay(session: Session, start: Date, end: Date, now: Date) {
  const from = Math.max(new Date(session.started_at).getTime(), start.getTime());
  const rawEnd = session.ended_at ? new Date(session.ended_at).getTime() : now.getTime();
  const to = Math.min(rawEnd, end.getTime());
  return Math.max(0, to - from);
}

function formatDuration(ms: number) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

export default function SuperAdminManpowerTrackerModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<'tracker' | 'projects'>('tracker');
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayManilaDate());
  const [search, setSearch] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectCode, setProjectCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingProject, setSavingProject] = useState(false);
  const [changingProjectId, setChangingProjectId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [now, setNow] = useState(() => new Date());

  const fetchProjects = useCallback(async () => {
    const { data, error } = await supabase
      .from('manpower_projects')
      .select('id,name,project_code,is_active,created_at')
      .order('is_active', { ascending: false })
      .order('name');
    if (error) console.error('Error fetching manpower projects:', error);
    setProjects((data || []) as Project[]);
  }, []);

  const fetchTracker = useCallback(async (date: string) => {
    setLoading(true);
    const { start, end } = dayBounds(date);
    const [employeeRes, sessionRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id,full_name,employee_id,designation,is_active')
        .eq('role', 'employee')
        .order('full_name'),
      supabase
        .from('manpower_sessions')
        .select('id,user_id,project_id,started_at,ended_at')
        .lt('started_at', end.toISOString())
        .or(`ended_at.is.null,ended_at.gte.${start.toISOString()}`)
        .order('started_at', { ascending: true }),
    ]);
    if (employeeRes.error) console.error('Error fetching manpower employees:', employeeRes.error);
    if (sessionRes.error) console.error('Error fetching manpower sessions:', sessionRes.error);
    setEmployees((employeeRes.data || []) as Employee[]);
    setSessions((sessionRes.data || []) as Session[]);
    setNow(new Date());
    setLoading(false);
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchProjects(), fetchTracker(selectedDate)]);
  }, [fetchProjects, fetchTracker, selectedDate]);

  useEffect(() => {
    if (!open) return;
    refreshAll();
  }, [open, refreshAll]);

  useEffect(() => {
    if (!open) return;
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    fetchTracker(selectedDate);
  }, [selectedDate, open, fetchTracker]);

  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const employeeMap = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);
  const bounds = dayBounds(selectedDate);

  const groupedRows = useMemo(() => {
    const grouped = new Map<string, { userId: string; projectId: string; duration: number; active: boolean }>();
    for (const session of sessions) {
      const key = `${session.user_id}:${session.project_id}`;
      const existing = grouped.get(key) || { userId: session.user_id, projectId: session.project_id, duration: 0, active: false };
      existing.duration += durationWithinDay(session, bounds.start, bounds.end, now);
      existing.active = existing.active || !session.ended_at;
      grouped.set(key, existing);
    }
    return [...grouped.values()].sort((a, b) => b.duration - a.duration);
  }, [sessions, bounds.start, bounds.end, now]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return groupedRows;
    return groupedRows.filter((row) => {
      const employee = employeeMap.get(row.userId);
      const project = projectMap.get(row.projectId);
      return [employee?.full_name, employee?.employee_id, employee?.designation, project?.name, project?.project_code]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [groupedRows, employeeMap, projectMap, search]);

  const totalTracked = groupedRows.reduce((sum, row) => sum + row.duration, 0);
  const trackedEmployees = new Set(groupedRows.map((row) => row.userId)).size;
  const activeNow = selectedDate === todayManilaDate() ? sessions.filter((session) => !session.ended_at).length : 0;

  const createProject = async () => {
    const name = projectName.trim();
    const code = projectCode.trim();
    if (!name) {
      setMessage({ type: 'error', text: 'Project name is required.' });
      return;
    }

    setSavingProject(true);
    setMessage(null);
    const { data: authData } = await supabase.auth.getUser();
    const { error } = await supabase.from('manpower_projects').insert({
      name,
      project_code: code || null,
      created_by: authData.user?.id || null,
    });

    if (error) {
      const duplicate = error.message?.toLowerCase().includes('duplicate');
      setMessage({ type: 'error', text: duplicate ? 'A project with this name already exists.' : (error.message || 'Unable to add project.') });
      setSavingProject(false);
      return;
    }

    setProjectName('');
    setProjectCode('');
    setMessage({ type: 'success', text: 'Project added. Employees can select it immediately.' });
    setSavingProject(false);
    await fetchProjects();
  };

  const toggleProject = async (project: Project) => {
    setChangingProjectId(project.id);
    setMessage(null);
    const { error } = await supabase
      .from('manpower_projects')
      .update({ is_active: !project.is_active, updated_at: new Date().toISOString() })
      .eq('id', project.id);

    if (error) {
      setMessage({ type: 'error', text: error.message || 'Unable to update project.' });
      setChangingProjectId(null);
      return;
    }

    setMessage({ type: 'success', text: project.is_active ? 'Project deactivated. Historical tracked hours were preserved.' : 'Project activated and is available to employees.' });
    setChangingProjectId(null);
    await fetchProjects();
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Manpower Tracker"
      description="Manage employee-selectable projects and review actual project hours from timer switches."
      icon={<BarChart3 size={20} />}
      size="xl"
    >
      <div className="space-y-4">
        {message && (
          <div className={`rounded-xl px-3 py-2 text-xs font-medium ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/35 dark:text-rose-300'}`}>
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
          <button type="button" onClick={() => setTab('tracker')} className={`min-h-10 rounded-xl text-xs font-bold transition ${tab === 'tracker' ? 'bg-white text-slate-900 shadow-sm dark:bg-[#303632] dark:text-white' : 'text-slate-500'}`}>Tracked Hours</button>
          <button type="button" onClick={() => setTab('projects')} className={`min-h-10 rounded-xl text-xs font-bold transition ${tab === 'projects' ? 'bg-white text-slate-900 shadow-sm dark:bg-[#303632] dark:text-white' : 'text-slate-500'}`}>Project List</button>
        </div>

        {tab === 'tracker' ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-emerald-50 p-3 dark:bg-emerald-950/25"><UsersRound size={17} className="text-emerald-700 dark:text-emerald-300"/><p className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">{trackedEmployees}</p><p className="text-[10px] text-slate-500">Employees tracked</p></div>
              <div className="rounded-2xl bg-cyan-50 p-3 dark:bg-cyan-950/25"><Clock3 size={17} className="text-cyan-700 dark:text-cyan-300"/><p className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">{formatDuration(totalTracked)}</p><p className="text-[10px] text-slate-500">Total project time</p></div>
              <div className="rounded-2xl bg-violet-50 p-3 dark:bg-violet-950/25"><BriefcaseBusiness size={17} className="text-violet-700 dark:text-violet-300"/><p className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">{activeNow}</p><p className="text-[10px] text-slate-500">Tracking now</p></div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="min-h-10 rounded-xl bg-slate-50 px-3 text-xs font-semibold text-slate-700 outline-none dark:bg-[#303632] dark:text-white" />
              <label className="relative min-w-0 flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employee or project" className="min-h-10 w-full rounded-xl bg-slate-50 pl-9 pr-3 text-xs outline-none dark:bg-[#303632] dark:text-white" />
              </label>
              <button type="button" onClick={refreshAll} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-3 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200"><RefreshCw size={14}/> Refresh</button>
            </div>

            {loading ? (
              <p className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:bg-[#303632]">Loading tracked hours…</p>
            ) : filteredRows.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:bg-[#303632]">No manpower tracking records for this date.</p>
            ) : (
              <div className="space-y-2">
                {filteredRows.map((row) => {
                  const employee = employeeMap.get(row.userId);
                  const project = projectMap.get(row.projectId);
                  return (
                    <div key={`${row.userId}-${row.projectId}`} className="grid gap-2 rounded-2xl bg-slate-50 p-3 dark:bg-[#303632] sm:grid-cols-[1.2fr_1fr_auto] sm:items-center">
                      <div className="min-w-0"><p className="truncate text-xs font-bold text-slate-900 dark:text-white">{employee?.full_name || 'Employee'}</p><p className="mt-0.5 truncate text-[10px] text-slate-500">{employee?.employee_id || 'No ID'}{employee?.designation ? ` · ${employee.designation}` : ''}</p></div>
                      <div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{project?.name || 'Inactive project'}</p><p className="mt-0.5 text-[10px] text-slate-500">{project?.project_code || 'Project'}</p></div>
                      <div className="flex items-center justify-between gap-2 sm:justify-end"><span className="font-mono text-xs font-bold text-slate-800 dark:text-white">{formatDuration(row.duration)}</span>{row.active && selectedDate === todayManilaDate() ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">LIVE</span> : null}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            <section className="rounded-2xl bg-slate-50 p-3 dark:bg-[#303632]">
              <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
                <input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Project name" maxLength={120} className="min-h-10 rounded-xl bg-white px-3 text-xs outline-none shadow-sm dark:bg-[#292f2b] dark:text-white" />
                <input value={projectCode} onChange={(event) => setProjectCode(event.target.value)} placeholder="Project code (optional)" maxLength={40} className="min-h-10 rounded-xl bg-white px-3 text-xs outline-none shadow-sm dark:bg-[#292f2b] dark:text-white" />
                <button type="button" onClick={createProject} disabled={savingProject} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"><Plus size={15}/>{savingProject ? 'Adding…' : 'Add Project'}</button>
              </div>
            </section>

            <div className="space-y-2">
              {projects.length === 0 ? (
                <p className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:bg-[#303632]">No manpower projects yet.</p>
              ) : projects.map((project) => (
                <div key={project.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-3 dark:bg-[#303632]">
                  <div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900 dark:text-white">{project.name}</p><p className="mt-0.5 text-[10px] text-slate-500">{project.project_code || 'No project code'} · {project.is_active ? 'Available to employees' : 'Inactive — history preserved'}</p></div>
                  <button type="button" onClick={() => toggleProject(project)} disabled={changingProjectId === project.id} className={`inline-flex min-h-9 flex-none items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition disabled:opacity-50 ${project.is_active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200'}`}>
                    {project.is_active ? <ToggleRight size={18}/> : <ToggleLeft size={18}/>} {project.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </ModalShell>
  );
}
