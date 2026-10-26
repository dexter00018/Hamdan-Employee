'use client';

import { History, Sun, Target } from 'lucide-react';
import { Chip, PhoneTile, RichHeader, SummaryCard, Tile, delayStyle } from './summary-shell';
import AnyIcon from '../AnyIcon';

// Attendance streak at the original stat-card height: header on the left,
// the "4 days" metric right-aligned with the streak message badge under
// it, and the encouraging nudge along the bottom.
export default function StreakCard({ streak, message, onClick }: { streak: number; message: string; onClick: () => void }) {
  return (
    <SummaryCard
      surface="border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 shadow-[0_8px_24px_rgba(15,23,42,0.05)] dark:border-orange-900/60 dark:from-orange-950/40 dark:to-slate-900"
      onClick={onClick}
      aria="View Attendance Streak details"
      phone={(
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-orange-100/90 to-amber-100/90 dark:border-slate-700 dark:from-orange-950/60 dark:to-amber-950/40">
          <PhoneTile image="streak_art" value={streak} label="Streak" chevron="bg-orange-500" />
        </div>
      )}
      compact={(
        <div className="absolute inset-0 flex items-center gap-1 rounded-2xl bg-gradient-to-br from-orange-100/90 to-amber-100/90 p-1 dark:from-orange-950/60 dark:to-amber-950/40">
          <span className="cc-pop relative flex h-10 w-10 flex-shrink-0 items-center justify-center" aria-hidden="true">
            <AnyIcon name="streak_art" size={64} className="relative h-10 w-10" />
          </span>
          <span className="min-w-0 leading-none">
            <span className="block text-base font-black tracking-tight text-slate-900 dark:text-white">{streak}</span>
            <span className="block truncate text-[9px] font-semibold tracking-[-0.02em] text-slate-600 dark:text-slate-300">Streak</span>
          </span>
        </div>
      )}
      rich={(
        <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl p-2">
          <RichHeader
            tile={<Tile image="streak_art" gradient="from-amber-400 to-orange-500" />}
            title="Attendance Streak"
            subtitle="Days without being late"
          />
          {/* dart-target accent, top-right above the metric */}
          <Target className="cc-float pointer-events-none absolute right-1 top-1 h-8 w-8 text-orange-400/70" style={delayStyle(0.45)} aria-hidden="true" />
          <div className="cc-pop flex min-w-0 items-center justify-between gap-2" style={delayStyle(0.12)}>
            <Chip icon={Sun} iconClass="fill-amber-400 text-amber-500" text={message} tone="tint" />
            <span className="flex flex-shrink-0 items-baseline gap-1 leading-none">
              <span className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">{streak}</span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">days</span>
            </span>
          </div>
          <div className="cc-rise" style={delayStyle(0.18)}>
            <Chip icon={History} circle iconClass="bg-amber-500" text="Arrive on time to extend your streak." tone="tint" />
          </div>
        </div>
      )}
    />
  );
}
