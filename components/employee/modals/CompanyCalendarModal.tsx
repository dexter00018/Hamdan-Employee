'use client';

import { LoadingRow } from '@/components/Spinner';
import EmptyState from '@/components/shared/EmptyState';
import ModalShell from '@/components/shared/ModalShell';

type Props = { open: boolean; onClose: () => void; loading: boolean; holidays: any[]; upcoming: any[]; past: any[]; formatDate: (date: string) => string; daysUntil: (date: string) => number };

export default function CompanyCalendarModal({ open, onClose, loading, holidays, upcoming, past, formatDate, daysUntil }: Props) {
  return (
    <ModalShell open={open} onClose={onClose} title="Company Calendar" description="Official holidays and non-working dates" icon="🗓️" size="md">
      {loading ? <LoadingRow label="Loading holidays..." /> : holidays.length === 0 ? <EmptyState icon="🗓️" title="No holidays set up yet" description="HR-managed company holidays will appear here." /> : <>
        {upcoming.length > 0 && <section className="mb-4 rounded-2xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-950/50"><p className="text-[10px] font-extrabold uppercase tracking-widest text-purple-700 dark:text-purple-300">Next holiday</p><p className="mt-1 text-sm font-extrabold text-slate-950 dark:text-white">{upcoming[0].name}</p><p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{formatDate(upcoming[0].holiday_date)} · {daysUntil(upcoming[0].holiday_date) === 0 ? 'Today!' : `${daysUntil(upcoming[0].holiday_date)} day${daysUntil(upcoming[0].holiday_date) === 1 ? '' : 's'} away`}</p></section>}
        {upcoming.length > 0 && <section><p className="label-branded mb-2">Upcoming</p><div className="mb-5 space-y-2">{upcoming.map((holiday) => <div key={holiday.id} className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800"><span className="text-xs font-bold text-slate-950 dark:text-white">{holiday.name}</span><span className="flex-shrink-0 text-[10px] text-slate-500 dark:text-slate-300">{formatDate(holiday.holiday_date)}</span></div>)}</div></section>}
        {past.length > 0 && <section><p className="label-branded mb-2">Past this year</p><div className="space-y-2">{past.map((holiday) => <div key={holiday.id} className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 opacity-70 dark:border-slate-700 dark:bg-slate-800"><span className="text-xs font-bold text-slate-950 dark:text-white">{holiday.name}</span><span className="flex-shrink-0 text-[10px] text-slate-500 dark:text-slate-300">{formatDate(holiday.holiday_date)}</span></div>)}</div></section>}
      </>}
    </ModalShell>
  );
}
