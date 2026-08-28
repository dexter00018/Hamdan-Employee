'use client';

import type { Dispatch, SetStateAction } from 'react';
import { CheckCircle2 } from 'lucide-react';
import ModalShell from '@/components/shared/ModalShell';

type OverviewKind = 'present' | 'late' | 'leave' | 'notTimedIn';
type Meta = { title: string; description: string; empty: string; tone: string };
type RecordItem = { id: string; full_name?: string | null; employee_id?: string | null; designation?: string | null; time_in?: string | null; status?: string | null; leave_type?: string | null; start_date?: string | null; end_date?: string | null; profiles?: { full_name?: string | null } | null; employee?: { full_name?: string | null } | null };
type Props = { modal: OverviewKind | null; meta: Meta | null; records: RecordItem[]; initials: (name: string | null) => string; setModal: Dispatch<SetStateAction<OverviewKind | null>> };

export default function DailyOverviewModal({ modal, meta, records, initials, setModal }: Props) {
  if (!modal || !meta) return null;
  return <ModalShell open onClose={() => setModal(null)} title={meta.title} description={meta.description} size="sm">
    {records.length === 0 ? <div className="rounded-2xl border-2 border-dashed border-slate-100 bg-slate-50/60 px-4 py-10 text-center dark:border-slate-700 dark:bg-slate-800"><CheckCircle2 size={22} className="mx-auto mb-2 text-slate-300 dark:text-slate-500"/><p className="text-xs font-bold text-slate-500 dark:text-slate-300">{meta.empty}</p></div> : <div className="space-y-2">{records.map((record) => {
      const isAttendance = modal === 'present' || modal === 'late'; const isLeave = modal === 'leave'; const name = isAttendance ? record.profiles?.full_name : isLeave ? record.employee?.full_name : record.full_name;
      const detail = isAttendance ? `${record.time_in ? new Date(record.time_in).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }) : 'No time'} · ${record.status || 'Present'}` : isLeave ? `${record.leave_type} · ${record.start_date === record.end_date ? record.start_date : `${record.start_date} → ${record.end_date}`}` : `${record.employee_id || 'No employee ID'} · ${record.designation || 'No designation'}`;
      return <div key={record.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800"><span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold ${modal === 'late' ? 'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300' : modal === 'leave' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300' : modal === 'notTimedIn' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'}`}>{initials(name || null)}</span><span className="min-w-0"><span className="block truncate text-xs font-bold text-slate-950 dark:text-white">{name || 'Unknown employee'}</span><span className="mt-0.5 block truncate text-[10px] text-slate-500 dark:text-slate-300">{detail}</span></span></div>;
    })}</div>}
    <button type="button" onClick={() => setModal(null)} className="mt-4 w-full rounded-full bg-slate-100 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">Close</button>
  </ModalShell>;
}
