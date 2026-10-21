'use client';

import type { CSSProperties } from 'react';
import { Calendar, Sparkles, TreePalm } from 'lucide-react';

type Holiday = { name: string; holiday_date: string };
type Props = { holiday: Holiday | null; days: number | null; onClick: () => void };

function delayStyle(seconds: number): CSSProperties {
  return { '--cc-delay': `${seconds}s` } as CSSProperties;
}

function parseHolidayDate(date: string) {
  const parts = date.split('-').map(Number);
  return new Date(parts[0] ?? 1970, (parts[1] ?? 1) - 1, parts[2] ?? 1);
}

function normalizeName(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Scenes are Philippine-flavored: Christmas here means parols and palms,
// never snow. The next holiday's name picks the watercolor palette.
type Scene = { bg: string; compactBg: string };

function sceneFor(name: string): Scene {
  const h = normalizeName(name);

  if (h.includes('christmas')) {
    return {
      bg: 'border-emerald-200 bg-gradient-to-br from-emerald-50 via-teal-50 to-violet-100 shadow-[0_8px_24px_rgba(15,23,42,0.05)] dark:border-slate-700 dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900',
      compactBg: 'border border-emerald-200/80 bg-gradient-to-br from-emerald-100/90 to-teal-100/90 dark:border-slate-700 dark:from-emerald-950/60 dark:to-slate-900',
    };
  }

  if (h.includes('new year')) {
    return {
      bg: 'border-violet-200 bg-gradient-to-br from-fuchsia-50 via-indigo-50 to-sky-100 shadow-[0_8px_24px_rgba(15,23,42,0.05)] dark:border-slate-700 dark:from-fuchsia-950/40 dark:via-slate-900 dark:to-slate-900',
      compactBg: 'border border-fuchsia-200/80 bg-gradient-to-br from-fuchsia-100/90 to-sky-100/90 dark:border-slate-700 dark:from-fuchsia-950/60 dark:to-slate-900',
    };
  }

  if (h.includes('eid')) {
    return {
      bg: 'border-teal-200 bg-gradient-to-br from-teal-50 via-cyan-50 to-indigo-100 shadow-[0_8px_24px_rgba(15,23,42,0.05)] dark:border-slate-700 dark:from-teal-950/40 dark:via-slate-900 dark:to-slate-900',
      compactBg: 'border border-teal-200/80 bg-gradient-to-br from-teal-100/90 to-indigo-100/90 dark:border-slate-700 dark:from-teal-950/60 dark:to-slate-900',
    };
  }

  // Patriotic: Bonifacio Day, Heroes Day, Independence Day, Araw ng
  // Kagitingan, Ninoy Aquino Day, Rizal Day -- PH pantry colors, watercolor.
  if (h.includes('bonifacio') || h.includes('heroes') || h.includes('independence') || h.includes('kagitingan') || h.includes('valor') || h.includes('ninoy') || h.includes('rizal')) {
    return {
      bg: 'border-violet-200 bg-gradient-to-br from-violet-100 via-purple-100 to-indigo-200 shadow-[0_8px_24px_rgba(15,23,42,0.06)] dark:border-violet-800/60 dark:from-violet-950/60 dark:via-purple-950/40 dark:to-slate-900',
      compactBg: 'border border-indigo-200/80 bg-gradient-to-br from-indigo-100/90 to-violet-100/90 dark:border-slate-700 dark:from-indigo-950/60 dark:to-slate-900',
    };
  }

  return {
    bg: 'border-sky-200 bg-gradient-to-br from-sky-50 via-cyan-50 to-amber-100 shadow-[0_8px_24px_rgba(15,23,42,0.05)] dark:border-slate-700 dark:from-amber-950/50 dark:via-slate-900 dark:to-slate-900',
    compactBg: 'border border-amber-200/80 bg-gradient-to-br from-amber-100/90 to-sky-100/90 dark:border-slate-700 dark:from-amber-950/50 dark:to-slate-900',
  };
}

// NOV / 30 / MON stacked tile, sized for the compact stat card.
function HolidayDateTile({ holiday }: { holiday: Holiday }) {
  const date = parseHolidayDate(holiday.holiday_date);
  return (
    <div
      className="cc-pop relative flex h-14 w-12 flex-shrink-0 flex-col overflow-hidden rounded-xl bg-white shadow-md ring-1 ring-violet-200/90 dark:bg-slate-900 dark:ring-violet-700"
      style={delayStyle(0.16)}
      aria-label={holiday.holiday_date}
    >
      <span className="bg-gradient-to-r from-violet-500 to-purple-500 py-px text-center text-[7px] font-extrabold tracking-wider text-white">{date.toLocaleString('en-US', { month: 'short' }).toUpperCase()}</span>
      <span className="cc-beat flex flex-1 items-center justify-center text-base font-black leading-none text-slate-950 dark:text-white">{date.getDate()}</span>
      <span className="pb-0.5 text-center text-[7px] font-extrabold text-violet-500 dark:text-violet-300">{date.toLocaleString('en-US', { weekday: 'short' }).toUpperCase()}</span>
    </div>
  );
}

// Next holiday card: badge, name, full date and the countdown behind a
// watercolor scene with a flat palm-and-sun illustration, sized to the
// original stat-card height; compact layout below lg uses just the icon,
// the countdown and the label.
export default function NextHolidayCard({ holiday, days, onClick }: Props) {
  const scene = sceneFor(holiday?.name ?? '');
  const compactValue = days === null ? '—' : days === 0 ? 'Now!' : `${days}d`;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="View Next Holiday details"
      className="group relative h-full min-w-0 overflow-hidden rounded-2xl text-left transition duration-300 hover:-translate-y-0.5 hover:shadow-lg"
    >
      <span
        className="pointer-events-none absolute inset-0 z-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full dark:via-white/10"
        aria-hidden="true"
      />
      {/* compact (below lg): icon tile + countdown + label, single band */}
      <div className={`absolute inset-0 flex items-center gap-1 rounded-2xl p-1 lg:hidden ${scene.compactBg}`}>
        <div className="flex items-center gap-1">
          <span className="cc-pop grid h-8 w-8 flex-shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm" aria-hidden="true">
            <Calendar className="h-4 w-4 text-white" strokeWidth={2.4} />
          </span>
          <span className="min-w-0 leading-none">
            <span className="block text-base font-black tracking-tight text-slate-900 dark:text-white">{compactValue}</span>
            <span className="block truncate text-[9px] font-semibold tracking-[-0.02em] text-slate-600 dark:text-slate-300">Holiday</span>
          </span>
        </div>
      </div>

      {/* rich (lg+): badge + name + date + countdown + date tile */}
      <div className={`relative hidden h-full lg:block ${scene.bg}`}>
        <div className="relative flex h-full items-center justify-between gap-3 overflow-hidden rounded-2xl p-3">
          {/* flat palm-and-sun illustration, inside the reserved right band */}
          <Sparkles className="cc-float pointer-events-none absolute right-[56px] top-1.5 h-3.5 w-3.5 text-violet-400/80" style={delayStyle(1.1)} aria-hidden="true" />
          <TreePalm className="cc-float pointer-events-none absolute right-1 bottom-0 h-10 w-10 text-violet-400/50" style={delayStyle(0.45)} aria-hidden="true" />
          <div className="relative min-w-0">
            {holiday ? (
              <>
                <span className="cc-rise inline-flex w-fit items-center rounded-full bg-white/80 px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-wide text-violet-700 ring-1 ring-violet-300 dark:bg-white/10 dark:text-violet-200 dark:ring-violet-500" style={delayStyle(0.06)}>
                  Next Holiday
                </span>
                <p className="cc-rise mt-1 truncate text-xl font-black leading-tight tracking-tight text-slate-950 dark:text-white" style={delayStyle(0.1)}>{holiday.name}</p>
                <p className="cc-rise mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-slate-700 dark:text-slate-300" style={delayStyle(0.13)}>
                  <Calendar className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                  {parseHolidayDate(holiday.holiday_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
                {days !== null && (
                  <span className="cc-rise mt-1 inline-flex w-fit items-center whitespace-nowrap rounded-full bg-violet-500 px-2 py-0.5 text-[9px] font-extrabold text-white shadow-sm" style={delayStyle(0.16)}>
                    {days === 0 ? 'Today!' : `${days} day${days === 1 ? '' : 's'} away`}
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="cc-rise inline-flex w-fit items-center rounded-full bg-white/80 px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-wide text-violet-700 ring-1 ring-violet-300 dark:bg-white/10 dark:text-violet-200 dark:ring-violet-500" style={delayStyle(0.06)}>
                  Next Holiday
                </span>
                <p className="cc-rise mt-1 text-xl font-black leading-tight text-slate-950 dark:text-white" style={delayStyle(0.1)}>No holidays yet</p>
                <p className="cc-rise mt-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300" style={delayStyle(0.13)}>HR holidays appear here</p>
              </>
            )}
          </div>
          {holiday && <HolidayDateTile holiday={holiday} />}
        </div>
      </div>
    </button>
  );
}
