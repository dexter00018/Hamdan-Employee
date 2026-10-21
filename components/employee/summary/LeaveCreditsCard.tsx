'use client';

import { CalendarDays, Check, Clock, Leaf, Sprout } from 'lucide-react';
import { Chip, RichHeader, SummaryCard, Tile, delayStyle } from './summary-shell';

// Leave credits, sized to the original stat-card height: header with the
// File Leave action, progress bar on the left with the "9 days / 9 left
// of 10" metric right-aligned beside it, and the SL/VL usage pills below.
// The DB keeps one total/used pair (no per-type quotas) and the real
// leave types are Sick and Vacation.
export default function LeaveCreditsCard({ remaining, total, sickUsed, vacationUsed, onClick }: { remaining: number; total: number; sickUsed: number; vacationUsed: number; onClick: () => void }) {
  const safeRemaining = Math.max(0, remaining);
  const safeTotal = Math.max(0, total);
  const pct = safeTotal > 0 ? Math.min(100, Math.round((safeRemaining / safeTotal) * 100)) : 0;
  const compactGradient = 'bg-gradient-to-br from-violet-500 to-purple-600';
  return (
    <SummaryCard
      surface="border border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 shadow-[0_8px_24px_rgba(15,23,42,0.05)] dark:border-violet-900/60 dark:from-violet-950/40 dark:to-slate-900"
      onClick={onClick}
      aria="View Leave Credits details"
      compact={(
        <div className="absolute inset-0 flex items-center gap-1 rounded-2xl bg-gradient-to-br from-violet-100/90 to-purple-100/90 p-1 dark:from-violet-950/60 dark:to-purple-950/40">
          <span className={`cc-pop grid h-8 w-8 flex-shrink-0 place-items-center rounded-xl shadow-sm ${compactGradient}`} aria-hidden="true">
            <CalendarDays className="h-4 w-4 text-white" strokeWidth={2.4} />
          </span>
          <span className="min-w-0 leading-none">
            <span className="block text-base font-black tracking-tight text-slate-900 dark:text-white">{safeRemaining}</span>
            <span className="block truncate text-[9px] font-semibold tracking-[-0.02em] text-slate-600 dark:text-slate-300">Credits</span>
          </span>
        </div>
      )}
      rich={(
        <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl p-2">
          <RichHeader
            tile={<Tile icon={CalendarDays} gradient="bg-gradient-to-br from-violet-500 to-purple-600" />}
            title="Leave Credits"
            subtitle="Available Credits"
            action="File Leave"
          />
          <div className="cc-pop flex items-center gap-2" style={delayStyle(0.12)}>
            {safeTotal > 0 && (
              <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-violet-200/70 dark:bg-slate-700">
                <span className="block h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500" style={{ width: `${Math.max(pct, safeRemaining > 0 ? 3 : 0)}%` }} />
              </span>
            )}
            <span className="flex flex-shrink-0 flex-col items-end leading-none">
              <span className="flex items-baseline gap-1">
                <span className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">{safeRemaining}</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">days</span>
              </span>
              {safeTotal > 0 && <span className="mt-1 text-[9px] font-bold text-slate-700 dark:text-slate-200">{safeRemaining} left of {safeTotal}</span>}
            </span>
            <Sprout className="h-6 w-6 flex-shrink-0 text-emerald-500/80" aria-hidden="true" />
          </div>
          <div className="cc-rise flex items-center gap-1.5" style={delayStyle(0.2)}>
            <Chip icon={Check} circle iconClass="bg-emerald-500" text={`SL ${sickUsed}d Used`} tone="plain" />
            <Chip icon={Clock} circle iconClass="bg-amber-500" text={`VL ${vacationUsed}d Used`} tone="plain" />
          </div>
          {/* leafy watercolor accents, kept inside the reserved right band */}
          <Leaf className="cc-float pointer-events-none absolute bottom-0 right-1 h-9 w-9 text-violet-400/50" style={delayStyle(0.45)} aria-hidden="true" />
          <Sprout className="cc-float pointer-events-none absolute bottom-1 right-9 h-6 w-6 text-violet-400/40" style={delayStyle(0.8)} aria-hidden="true" />
        </div>
      )}
    />
  );
}
