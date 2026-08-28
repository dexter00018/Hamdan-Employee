'use client';

import { memo, useEffect, useState } from 'react';
import { Clock3 } from 'lucide-react';

type TodayLog = {
  time_out: string | null;
  status: string | null;
} | null;

function getManilaClock() {
  const now = new Date();
  return {
    time: now.toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Manila',
      hour12: false,
    }),
    date: now.toLocaleDateString('en-US', {
      timeZone: 'Asia/Manila',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  };
}

function EmployeeWorkClock({ todayLog }: { todayLog: TodayLog }) {
  const [clock, setClock] = useState(() => ({ time: '--:--:--', date: '' }));

  useEffect(() => {
    const updateClock = () => setClock(getManilaClock());
    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const isTodayLate = todayLog?.status?.toLowerCase() === 'late';
  const todayWorkStatus = !todayLog
    ? { label: 'No Time In', color: 'bg-red-100 text-red-700' }
    : isTodayLate
      ? { label: todayLog.time_out ? 'Completed · Late' : 'Working · Late', color: 'bg-orange-100 text-orange-700' }
      : { label: todayLog.time_out ? 'Completed' : 'Working', color: 'bg-green-100 text-green-700' };

  const workClockTone = !todayLog
    ? {
        panel: 'from-rose-500 to-red-700',
        border: 'border-red-200 dark:border-red-900/60',
        rail: 'from-rose-400 via-red-500 to-red-700',
      }
    : isTodayLate
      ? {
          panel: 'from-amber-400 to-orange-600',
          border: 'border-orange-200 dark:border-orange-900/60',
          rail: 'from-amber-300 via-orange-500 to-red-500',
        }
      : {
          panel: 'from-emerald-500 to-green-700',
          border: 'border-emerald-200 dark:border-emerald-900/60',
          rail: 'from-emerald-400 via-green-500 to-teal-600',
        };

  return (
    <div className={`relative flex min-h-40 overflow-hidden rounded-3xl border bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)] dark:bg-[#292f2b] ${workClockTone.border}`}>
      <div className={`relative flex w-[34%] min-w-28 flex-col items-center justify-center overflow-hidden bg-gradient-to-br px-3 py-5 text-center text-white transition-colors duration-300 ${workClockTone.panel}`}>
        <span className="absolute -left-7 -top-8 h-20 w-20 rounded-full border-[14px] border-white/10" aria-hidden="true" />
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 shadow-inner ring-1 ring-white/25">
          <Clock3 aria-hidden="true" size={21} strokeWidth={2.2} />
        </span>
        <p className="mt-3 text-[9px] font-black uppercase tracking-[0.18em] text-white/75">Work clock</p>
        <span className={`mt-2 rounded-full px-2.5 py-1 text-[8px] font-extrabold uppercase tracking-wide shadow-sm ${todayWorkStatus.color}`}>
          {todayWorkStatus.label}
        </span>
      </div>
      <div className="relative flex min-w-0 flex-1 flex-col justify-center px-4 py-5 text-left sm:px-5">
        <span className={`absolute right-0 top-0 h-full w-1 bg-gradient-to-b transition-colors duration-300 ${workClockTone.rail}`} aria-hidden="true" />
        <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-400">Philippine time</p>
        <p className="mt-1 font-mono text-[clamp(2rem,8vw,3rem)] font-black leading-none tabular-nums tracking-[-0.08em] text-slate-950 dark:text-white">{clock.time}</p>
        <div className="mt-3 border-t border-dashed border-slate-200 pt-2 dark:border-slate-700">
          <p className="truncate text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-300">{clock.date}</p>
        </div>
      </div>
    </div>
  );
}

export default memo(EmployeeWorkClock);
