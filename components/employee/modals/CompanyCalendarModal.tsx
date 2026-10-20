'use client';

import type { LucideIcon } from 'lucide-react';
import { BookOpen, BriefcaseBusiness, CalendarDays, Flag, Gift, Landmark, Medal, MoonStar, PartyPopper } from 'lucide-react';
import { LoadingRow } from '@/components/Spinner';
import EmptyState from '@/components/shared/EmptyState';
import ModalShell from '@/components/shared/ModalShell';

type Holiday = { id: string | number; name: string; holiday_date: string };
type Props = { open: boolean; onClose: () => void; loading: boolean; holidays: Holiday[]; upcoming: Holiday[]; past: Holiday[]; formatDate: (date: string) => string; daysUntil: (date: string) => number };
type HolidayVisual = { Icon: LucideIcon; accent: string; label: string };

function normalizeHolidayName(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getHolidayVisual(name: string): HolidayVisual {
  const holiday = normalizeHolidayName(name);

  if (holiday.includes('new year')) return { Icon: PartyPopper, accent: 'text-amber-700 dark:text-amber-300', label: 'New Year' };
  if (holiday.includes('araw ng kagitingan') || holiday.includes('day of valor')) return { Icon: Medal, accent: 'text-amber-700 dark:text-amber-300', label: 'Day of Valor' };
  if (holiday.includes('labor day')) return { Icon: BriefcaseBusiness, accent: 'text-orange-700 dark:text-orange-300', label: 'Labor Day' };
  if (holiday.includes('independence day')) return { Icon: Flag, accent: 'text-blue-700 dark:text-blue-300', label: 'Independence Day' };
  if (holiday.includes('national heroes day') || holiday.includes('bonifacio day')) return { Icon: Landmark, accent: 'text-blue-700 dark:text-blue-300', label: 'National holiday' };
  if (holiday.includes('christmas day')) return { Icon: Gift, accent: 'text-emerald-700 dark:text-emerald-300', label: 'Christmas Day' };
  if (holiday.includes('rizal day')) return { Icon: BookOpen, accent: 'text-violet-700 dark:text-violet-300', label: 'Rizal Day' };
  if (holiday.includes('eidl fitr') || holiday.includes('eidul fitr') || holiday.includes('eid al fitr')) return { Icon: MoonStar, accent: 'text-sky-700 dark:text-sky-300', label: 'Eid al-Fitr' };
  if (holiday.includes('eidl adha') || holiday.includes('eidul adha') || holiday.includes('eid al adha')) return { Icon: MoonStar, accent: 'text-sky-700 dark:text-sky-300', label: 'Eid al-Adha' };

  return { Icon: CalendarDays, accent: 'text-indigo-700 dark:text-indigo-300', label: 'Company holiday' };
}

function HolidayRow({ holiday, formatDate, past = false }: { holiday: Holiday; formatDate: (date: string) => string; past?: boolean }) {
  const { Icon, accent, label } = getHolidayVisual(holiday.name);
  return <div className={`flex min-h-14 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800 ${past ? 'opacity-70' : ''}`}>
    <div className="flex min-w-0 items-center gap-3">
      <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700 ${accent}`} aria-label={label}><Icon className="h-4 w-4" strokeWidth={2.25} /></span>
      <span className="min-w-0 text-xs font-bold text-slate-950 dark:text-white">{holiday.name}</span>
    </div>
    <span className="flex-shrink-0 text-[10px] text-slate-500 dark:text-slate-300">{formatDate(holiday.holiday_date)}</span>
  </div>;
}

export default function CompanyCalendarModal({ open, onClose, loading, holidays, upcoming, past, formatDate, daysUntil }: Props) {
  const nextHoliday = upcoming[0];
  const nextVisual = nextHoliday ? getHolidayVisual(nextHoliday.name) : null;
  const NextIcon = nextVisual?.Icon ?? CalendarDays;

  return (
    <ModalShell open={open} onClose={onClose} title="Company Calendar" description="Holidays & non-working days" icon={<CalendarDays className="h-5 w-5 text-indigo-700 dark:text-indigo-300" />} size="md">
      {loading ? <LoadingRow label="Loading holidays..." /> : holidays.length === 0 ? <EmptyState icon={<CalendarDays size={18} />} title="No holidays yet" description="HR holidays appear here." /> : <>
        {nextHoliday && nextVisual && <section className="relative mb-4 overflow-hidden rounded-2xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-950/50">
          <div className="absolute -right-3 -top-3 h-24 w-24 rounded-full bg-white/35 dark:bg-white/5" aria-hidden="true" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-purple-700 dark:text-purple-300">Next holiday</p>
              <p className="mt-1 text-sm font-extrabold text-slate-950 dark:text-white">{nextHoliday.name}</p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{formatDate(nextHoliday.holiday_date)} · {daysUntil(nextHoliday.holiday_date) === 0 ? 'Today!' : `${daysUntil(nextHoliday.holiday_date)} day${daysUntil(nextHoliday.holiday_date) === 1 ? '' : 's'} away`}</p>
            </div>
            <div
              className={`relative flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-2xl bg-white/75 shadow-sm ring-1 ring-purple-200/80 dark:bg-slate-900/40 dark:ring-purple-700/80 ${nextVisual.accent}`}
              aria-label={`${nextVisual.label} illustration`}
            >
              <NextIcon className="h-10 w-10" strokeWidth={1.7} aria-hidden="true" />
            </div>
          </div>
        </section>}
        {upcoming.length > 0 && <section><p className="label-branded mb-2">Upcoming</p><div className="mb-5 space-y-2">{upcoming.map((holiday) => <HolidayRow key={holiday.id} holiday={holiday} formatDate={formatDate} />)}</div></section>}
        {past.length > 0 && <section><p className="label-branded mb-2">Past this year</p><div className="space-y-2">{past.map((holiday) => <HolidayRow key={holiday.id} holiday={holiday} formatDate={formatDate} past />)}</div></section>}
      </>}
    </ModalShell>
  );
}

