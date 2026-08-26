'use client';

import type { Dispatch, SetStateAction } from 'react';
import { CheckCircle2 } from 'lucide-react';
import ModalShell from '@/components/shared/ModalShell';

type InsightKind = 'attendance' | 'late' | 'absent' | 'leave';
type Meta = { title: string; description: string; empty: string; tone: string };
type RecordItem = { id: string; log_date?: string | null; status?: string | null; time_in?: string | null; profiles?: { full_name?: string | null } | null };
type Props = { modal: InsightKind | null; meta: Meta | null; records: RecordItem[]; initials: (name: string | null) => string; setModal: Dispatch<SetStateAction<InsightKind | null>> };

export default function AttendanceInsightsModal({ modal, meta, records, initials, setModal }: Props) {
  if (!modal || !meta) return null;
  return <ModalShell open onClose={() => setModal(null)} title={meta.title} description={meta.description} size="sm">
    {records.length === 0 ? <div className="rounded-2xl border-2 border-dashed border-slate-100 bg-slate-50/60 px-4 py-10 text-center"><CheckCircle2 size={22} className="mx-auto mb-2 text-slate-300"/><p className="text-xs font-bold text-slate-500">{meta.empty}</p></div> : <div className="space-y-2">{records.map((record) => <div key={record.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3"><span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-extrabold ${meta.tone}`}>{initials(record.profiles?.full_name || null)}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-slate-900">{record.profiles?.full_name || 'Unknown employee'}</span><span className="mt-0.5 block text-[10px] text-slate-400">{record.log_date} · {record.status || 'Present'}{record.time_in ? ` · ${new Date(record.time_in).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' })}` : ''}</span></span></div>)}</div>}
    <button type="button" onClick={() => setModal(null)} className="mt-4 w-full rounded-full bg-slate-100 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-200">Close</button>
  </ModalShell>;
}
