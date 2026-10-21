'use client';

import { AlarmClock, ArrowRight, Clock, Hourglass } from 'lucide-react';
import { Chip, RichHeader, SummaryCard, Tile, delayStyle } from './summary-shell';
import { formatOffsetShort } from '@/lib/employee/dashboard-utils';

// Earned offset time at the original stat-card height. Single unit
// (minutes) with an explicit Available/Held split so the balance is
// never ambiguous, plus a real-looking history link under it.
export default function OffsetCard({ minutes, reserved, onClick }: { minutes: number | null; reserved: number; onClick: () => void }) {
  const safe = Math.max(0, minutes ?? 0);
  const available = Math.max(0, safe - Math.max(0, reserved));
  const status = minutes === null
    ? { icon: Clock, circleClass: 'bg-slate-400', text: 'Loading…', tone: 'plain' as const }
    : safe === 0
      ? { icon: Clock, circleClass: 'bg-slate-400', text: 'No offset balance yet', tone: 'plain' as const }
      : reserved > 0
        ? { icon: Clock, circleClass: 'bg-amber-500', text: `Available ${formatOffsetShort(available)} - Held ${formatOffsetShort(reserved)}`, tone: 'warn' as const }
        : { icon: Clock, circleClass: 'bg-emerald-500', text: `Available ${formatOffsetShort(safe)}`, tone: 'green' as const };

  return (
    <SummaryCard
      surface="border border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 shadow-[0_8px_24px_rgba(15,23,42,0.05)] dark:border-emerald-900/60 dark:from-emerald-950/40 dark:to-slate-900"
      onClick={onClick}
      aria="View Offset Hours details"
      compact={(
        <div className="absolute inset-0 flex items-center gap-1 rounded-2xl bg-gradient-to-br from-emerald-100/90 to-green-100/90 p-1 dark:from-emerald-950/60 dark:to-green-950/40">
          <span className="cc-pop grid h-8 w-8 flex-shrink-0 place-items-center rounded-xl shadow-sm bg-gradient-to-br from-emerald-500 to-green-600" aria-hidden="true">
            <Hourglass className="h-4 w-4 text-white" strokeWidth={2.4} />
          </span>
          <span className="min-w-0 leading-none">
            <span className="block text-base font-black tracking-tight text-slate-900 dark:text-white">{formatOffsetShort(safe)}</span>
            <span className="block truncate text-[9px] font-semibold tracking-[-0.02em] text-slate-600 dark:text-slate-300">Offset</span>
          </span>
        </div>
      )}
      rich={(
        <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl p-2">
          <RichHeader
            tile={<Tile icon={Hourglass} gradient="bg-gradient-to-br from-emerald-500 to-green-600" />}
            title="Offset Hours"
            subtitle="Earned time you can use"
          />
          <div className="cc-pop flex min-w-0 items-center justify-between gap-2" style={delayStyle(0.12)}>
            <Chip icon={status.icon} circle iconClass={status.circleClass} text={status.text} tone={status.tone} />
            <span className="flex flex-shrink-0 items-baseline gap-1 leading-none">
              <span className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">{safe}</span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">min</span>
            </span>
          </div>
          <div className="cc-rise flex items-center" style={delayStyle(0.18)}>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 underline-offset-2 group-hover:underline dark:text-emerald-300">
              View your offset hours history <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </span>
          </div>
          {/* alarm-clock accent, bottom-right under the metric */}
          <AlarmClock className="cc-float pointer-events-none absolute bottom-1 right-1 h-8 w-8 text-emerald-400/70" style={delayStyle(0.45)} aria-hidden="true" />
        </div>
      )}
    />
  );
}
