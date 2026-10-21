'use client';

import type { CSSProperties, ReactNode } from 'react';
import { CalendarDays, ChevronRight, History, Star } from 'lucide-react';
import { LoadingRow } from '@/components/Spinner';
import EmptyState from '@/components/shared/EmptyState';
import ModalShell from '@/components/shared/ModalShell';

type Holiday = { id: string | number; name: string; holiday_date: string };
type Props = { open: boolean; onClose: () => void; loading: boolean; holidays: Holiday[]; upcoming: Holiday[]; past: Holiday[]; formatDate: (date: string) => string; daysUntil: (date: string) => number };
type HolidayTheme = { emoji: string; label: string; row: string; pill: string };

function delayStyle(seconds: number): CSSProperties {
  return { '--cc-delay': `${seconds}s` } as CSSProperties;
}

function parseHolidayDate(date: string) {
  const parts = date.split('-').map(Number);
  return new Date(parts[0] ?? 1970, (parts[1] ?? 1) - 1, parts[2] ?? 1);
}

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

// Per-holiday look used by list rows: emoji illustration, tagline, and a
// pastel gradient + matching date chip so each card reads at a glance.
function getHolidayTheme(name: string): HolidayTheme {
  const holiday = normalizeHolidayName(name);

  if (holiday.includes('new year')) return { emoji: '🎉', label: 'New Year', row: 'from-fuchsia-50 to-pink-100 dark:from-slate-800 dark:to-slate-800/70 dark:border-slate-700', pill: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-200' };
  if (holiday.includes('araw ng kagitingan') || holiday.includes('day of valor')) return { emoji: '🎖️', label: 'Day of Valor', row: 'from-amber-50 to-orange-100 dark:from-slate-800 dark:to-slate-800/70 dark:border-slate-700', pill: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200' };
  if (holiday.includes('labor day')) return { emoji: '👷', label: 'Regular holiday', row: 'from-orange-50 to-amber-100 dark:from-slate-800 dark:to-slate-800/70 dark:border-slate-700', pill: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200' };
  if (holiday.includes('independence day')) return { emoji: '🎌', label: 'Regular holiday', row: 'from-sky-50 to-blue-100 dark:from-slate-800 dark:to-slate-800/70 dark:border-slate-700', pill: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200' };
  if (holiday.includes('bonifacio day')) return { emoji: '🚩', label: 'National holiday', row: 'from-indigo-50 to-blue-100 dark:from-slate-800 dark:to-slate-800/70 dark:border-slate-700', pill: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200' };
  if (holiday.includes('national heroes day')) return { emoji: '🏛️', label: 'Regular holiday', row: 'from-sky-50 to-indigo-100 dark:from-slate-800 dark:to-slate-800/70 dark:border-slate-700', pill: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200' };
  if (holiday.includes('christmas')) return { emoji: '🎄', label: 'Regular holiday', row: 'from-emerald-50 to-green-100 dark:from-slate-800 dark:to-slate-800/70 dark:border-slate-700', pill: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' };
  if (holiday.includes('rizal day')) return { emoji: '🎁', label: 'Regular holiday', row: 'from-violet-50 to-purple-100 dark:from-slate-800 dark:to-slate-800/70 dark:border-slate-700', pill: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200' };
  if (holiday.includes('eidl fitr') || holiday.includes('eidul fitr') || holiday.includes('eid al fitr') || holiday.includes('eidl adha') || holiday.includes('eidul adha') || holiday.includes('eid al adha')) return { emoji: '🕌', label: 'Regular holiday', row: 'from-teal-50 to-cyan-100 dark:from-slate-800 dark:to-slate-800/70 dark:border-slate-700', pill: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200' };
  if (holiday.includes('ninoy aquino')) return { emoji: '🕊️', label: 'Special non-working day', row: 'from-green-50 to-teal-100 dark:from-slate-800 dark:to-slate-800/70 dark:border-slate-700', pill: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200' };

  return { emoji: '📅', label: 'Company holiday', row: 'from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-800/70 dark:border-slate-700', pill: 'bg-slate-200 text-slate-800 dark:bg-slate-900 dark:text-slate-200' };
}

type HolidayRowProps = { holiday: Holiday; formatDate: (date: string) => string; index: number; past?: boolean };

function HolidayRow({ holiday, formatDate, index, past = false }: HolidayRowProps) {
  const theme = getHolidayTheme(holiday.name);
  return (
    <div
      className={`cc-rise group flex min-h-[68px] items-center justify-between gap-3 rounded-2xl border border-white/60 bg-gradient-to-r p-3.5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg ${theme.row} ${past ? 'opacity-80' : ''}`}
      style={delayStyle(0.12 + index * 0.07)}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white/85 text-2xl shadow-sm ring-1 ring-white/70 transition duration-300 group-hover:-rotate-6 group-hover:scale-110 dark:bg-slate-900/70 dark:ring-slate-600"
          aria-hidden="true"
        >
          {theme.emoji}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold text-slate-950 dark:text-white">{holiday.name}</p>
          <p className="truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">{theme.label}</p>
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-1.5">
        <span className={`rounded-xl px-2.5 py-1.5 text-[11px] font-bold shadow-sm ${theme.pill}`}>{formatDate(holiday.holiday_date)}</span>
        <ChevronRight className="h-4 w-4 text-slate-300 transition duration-300 group-hover:translate-x-1 group-hover:text-slate-400 dark:text-slate-500" aria-hidden="true" />
      </div>
    </div>
  );
}

// Hero countdown tile: NOV / 30 / MON stacked, matching the calendar mockup.
function NextHolidayTile({ holiday }: { holiday: Holiday }) {
  const date = parseHolidayDate(holiday.holiday_date);
  return (
    <div
      className="cc-pop relative flex h-[88px] w-[74px] flex-shrink-0 flex-col overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-violet-200 dark:bg-slate-900 dark:ring-violet-700"
      style={delayStyle(0.16)}
      aria-label={holiday.holiday_date}
    >
      <span className="bg-gradient-to-r from-violet-500 to-purple-500 py-1 text-center text-[10px] font-extrabold tracking-wider text-white">{date.toLocaleString('en-US', { month: 'short' }).toUpperCase()}</span>
      <span className="cc-beat flex flex-1 items-center justify-center text-3xl font-black text-slate-950 dark:text-white">{date.getDate()}</span>
      <span className="pb-1.5 text-center text-[10px] font-extrabold text-violet-500 dark:text-violet-300">{date.toLocaleString('en-US', { weekday: 'short' }).toUpperCase()}</span>
    </div>
  );
}

function NextHolidayBanner({ holiday, formatDate, daysUntil }: { holiday: Holiday; formatDate: (date: string) => string; daysUntil: (date: string) => number }) {
  const countdown = daysUntil(holiday.holiday_date) === 0 ? 'Today!' : `${daysUntil(holiday.holiday_date)} day${daysUntil(holiday.holiday_date) === 1 ? '' : 's'} away`;
  return (
    <section
      className="cc-rise relative mb-5 overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-100 via-purple-100 to-sky-100 p-5 dark:border-violet-800 dark:from-violet-950 dark:via-purple-950 dark:to-indigo-950"
      style={delayStyle(0.05)}
    >
      {/* Floating confetti + sparkles */}
      <span className="cc-float absolute right-[44%] top-3 h-2 w-2 rounded-full bg-red-400 shadow-sm" style={delayStyle(0.1)} aria-hidden="true" />
      <span className="cc-float absolute right-[30%] top-8 h-2.5 w-2.5 rounded-full bg-sky-400 shadow-sm" style={delayStyle(0.55)} aria-hidden="true" />
      <span className="cc-float absolute right-[38%] bottom-4 h-2 w-2 rounded-full bg-amber-400 shadow-sm" style={delayStyle(1.05)} aria-hidden="true" />
      <span className="cc-float absolute right-[16%] bottom-5 h-2 w-2 rounded-full bg-fuchsia-400 shadow-sm" style={delayStyle(1.5)} aria-hidden="true" />
      <span className="cc-float absolute right-[22%] top-3 text-lg" style={delayStyle(0.8)} aria-hidden="true">✨</span>
      <span className="cc-float absolute right-[48%] bottom-8 text-base" style={delayStyle(1.25)} aria-hidden="true">🎊</span>
      <div className="absolute -left-8 -top-10 h-28 w-28 rounded-full bg-white/40 dark:bg-white/5" aria-hidden="true" />
      <div className="absolute -left-4 top-8 h-16 w-16 rounded-full bg-white/30 dark:bg-white/5" aria-hidden="true" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="cc-rise inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-violet-700 shadow-sm ring-1 ring-white/70 dark:bg-white/10 dark:text-violet-200 dark:ring-white/10" style={delayStyle(0.08)}>
            <Star className="cc-beat h-3 w-3 fill-amber-400 text-amber-400" aria-hidden="true" /> Next holiday
          </span>
          <p className="cc-rise mt-2.5 truncate text-2xl font-black tracking-tight text-slate-950 dark:text-white" style={delayStyle(0.12)}>{holiday.name}</p>
          <p className="cc-rise mt-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300" style={delayStyle(0.16)}>
            <CalendarDays className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            {formatDate(holiday.holiday_date)} · {countdown}
          </p>
        </div>
        <NextHolidayTile holiday={holiday} />
      </div>
    </section>
  );
}

function SectionHeader({ icon, title, count, delay }: { icon: ReactNode; title: string; count: number; delay: number }) {
  return (
    <div className="cc-rise mb-2.5 flex items-center justify-between" style={delayStyle(delay)}>
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-300">{icon}</span>
        <h3 className="text-sm font-extrabold text-slate-950 dark:text-white">{title}</h3>
      </div>
      <span className="rounded-full bg-slate-200/80 px-2.5 py-1 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">{count} event{count === 1 ? '' : 's'}</span>
    </div>
  );
}

export default function CompanyCalendarModal({ open, onClose, loading, holidays, upcoming, past, formatDate, daysUntil }: Props) {
  const nextHoliday = upcoming[0];
  return (
    <ModalShell open={open} onClose={onClose} title="Company Calendar" description="Holidays & non-working days" icon={<CalendarDays className="h-5 w-5 text-indigo-700 dark:text-indigo-300" />} size="md">
      {loading ? <LoadingRow label="Loading holidays..." /> : holidays.length === 0 ? <EmptyState icon={<CalendarDays size={18} />} title="No holidays yet" description="HR holidays appear here." /> : <>
        {nextHoliday && <NextHolidayBanner holiday={nextHoliday} formatDate={formatDate} daysUntil={daysUntil} />}
        {upcoming.length > 0 && (
          <section className="mb-5">
            <SectionHeader icon={<CalendarDays className="h-4 w-4" aria-hidden="true" />} title="Upcoming" count={upcoming.length} delay={0.1} />
            <div className="space-y-2.5">{upcoming.map((holiday, index) => <HolidayRow key={holiday.id} holiday={holiday} formatDate={formatDate} index={index} />)}</div>
          </section>
        )}
        {past.length > 0 && (
          <section>
            <SectionHeader icon={<History className="h-4 w-4" aria-hidden="true" />} title="Past This Year" count={past.length} delay={0.16} />
            <div className="space-y-2.5">{past.map((holiday, index) => <HolidayRow key={holiday.id} holiday={holiday} formatDate={formatDate} index={index} past />)}</div>
          </section>
        )}
      </>}
    </ModalShell>
  );
}
