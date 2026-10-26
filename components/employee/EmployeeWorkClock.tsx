'use client';

import { memo, useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { getAttendanceStatusDisplay } from '@/lib/attendance-status-display';
import { supabase } from '@/lib/supabase';
import Icon3D from './Icon3D';
import IconGlobeArt from './IconGlobeArt';

type TodayLog = {
  id?: string | number;
  time_in?: string | null;
  time_out: string | null;
  status: string | null;
  late_offset_minutes?: number | null;
} | null;

function getManilaClock() {
  const now = new Date();
  return {
    dateKey: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now),
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

function EmployeeWorkClock({ todayLog, endHour, compact = false }: { todayLog: TodayLog; endHour: number; compact?: boolean }) {
  const [clock, setClock] = useState(() => ({ time: '--:--:--', date: '', dateKey: '' }));
  const [earlyOutOffset, setEarlyOutOffset] = useState<{ status: string; requiredMinutes: number } | null>(null);

  useEffect(() => {
    const updateClock = () => setClock(getManilaClock());
    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const attendanceLogId = todayLog?.id;
    if (!attendanceLogId) {
      setEarlyOutOffset(null);
      return;
    }

    let active = true;
    const loadStatus = async () => {
      const { data, error } = await supabase
        .from('early_out_offset_requests')
        .select('status, required_minutes')
        .eq('attendance_log_id', Number(attendanceLogId))
        .maybeSingle();
      if (!active) return;
      if (error) {
        console.error('Error fetching Early Out Offset status:', error);
        setEarlyOutOffset(null);
      } else {
        setEarlyOutOffset(data?.status ? { status: data.status, requiredMinutes: Number(data.required_minutes || 0) } : null);
      }
    };

    void loadStatus();
    // Realtime keeps this status current; avoid a redundant 30-second poll.
    const channel = supabase
      .channel(`employee-early-out-offset-${attendanceLogId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'early_out_offset_requests', filter: `attendance_log_id=eq.${attendanceLogId}` },
        (payload) => {
          const request = payload.new as { status?: string; required_minutes?: number };
          setEarlyOutOffset(request.status ? { status: String(request.status), requiredMinutes: Number(request.required_minutes || 0) } : null);
        }
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [todayLog?.id]);

  const isTodayLate = todayLog?.status?.toLowerCase() === 'late';
  const todayWorkStatus = !todayLog
    ? { label: 'No Time In', className: 'bg-red-100 text-red-700' }
    : getAttendanceStatusDisplay({
        status: todayLog.status,
        logDate: clock.dateKey,
        timeOut: todayLog.time_out,
        lateOffsetMinutes: todayLog.late_offset_minutes,
        earlyOutOffsetMinutes: earlyOutOffset?.status === 'Approved' ? earlyOutOffset.requiredMinutes : 0,
        timeOutHour: endHour,
      });

  const workClockTone = !todayLog
    ? {
        panel: 'from-rose-500 to-red-700',
        border: 'border-red-200 dark:border-red-900/60',
        rail: 'from-rose-400 via-red-500 to-red-700',
        wrap: 'max-lg:border-rose-900/30 max-lg:bg-gradient-to-br max-lg:from-rose-500 max-lg:to-red-700',
      }
    : isTodayLate
      ? {
          panel: 'from-amber-400 to-orange-600',
          border: 'border-orange-200 dark:border-orange-900/60',
          rail: 'from-amber-300 via-orange-500 to-red-500',
          wrap: 'max-lg:border-orange-900/30 max-lg:bg-gradient-to-br max-lg:from-amber-400 max-lg:to-orange-600',
        }
      : {
          panel: 'from-emerald-500 to-green-700',
          border: 'border-emerald-200 dark:border-emerald-900/60',
          rail: 'from-emerald-400 via-green-500 to-teal-600',
          wrap: 'max-lg:border-emerald-900/30 max-lg:bg-gradient-to-br max-lg:from-emerald-600 max-lg:to-green-800',
        };

  return (
    <div className={`employee-work-clock relative flex max-lg:flex-row overflow-hidden border bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)] dark:bg-[#292f2b] ${compact ? 'min-h-40 rounded-3xl lg:min-h-28 lg:rounded-2xl' : 'min-h-40 rounded-3xl'} max-lg:rounded-2xl ${workClockTone.border} ${workClockTone.wrap}`}>
      <div className={`work-clock-brand relative flex w-[34%] min-w-28 flex-col items-center justify-center overflow-hidden bg-gradient-to-br px-3 py-5 text-center text-white transition-colors duration-300 ${compact ? 'lg:py-3' : ''} ${workClockTone.panel}`}>
        <span className="absolute -left-7 -top-8 h-20 w-20 rounded-full border-[14px] border-white/10" aria-hidden="true" />
        <span className={`grid place-items-center rounded-2xl bg-white/15 shadow-inner ring-1 ring-white/25 ${compact ? 'h-11 w-11 lg:h-8 lg:w-8 lg:rounded-xl' : 'h-11 w-11'}`}>
          <IconGlobeArt size={42} className="h-7 w-7 drop-shadow-[0_2px_4px_rgba(0,0,0,0.28)] lg:h-6 lg:w-6" />
        </span>
        <p className={`mt-3 text-[9px] font-black uppercase tracking-[0.18em] text-white/75 ${compact ? 'lg:mt-1.5 lg:text-[8px]' : ''}`}>Work clock</p>
        <span className={`mt-2 rounded-full px-2.5 py-1 text-[8px] font-extrabold uppercase tracking-wide shadow-sm ${compact ? 'lg:mt-1 lg:px-2 lg:py-0.5' : ''} ${todayWorkStatus.className}`}>
          {todayWorkStatus.label}
        </span>
      </div>
      <div className={`work-clock-content relative flex min-w-0 flex-1 flex-col justify-center px-4 py-5 text-left sm:px-5 ${compact ? 'lg:px-4 lg:py-3' : ''}`}>
        <span className={`absolute right-0 top-0 h-full w-1 bg-gradient-to-b transition-colors duration-300 ${workClockTone.rail}`} aria-hidden="true" />
        <div className="work-clock-time-in hidden">
          <p>Time In</p>
          <strong>{todayLog?.time_in ? new Date(todayLog.time_in).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}</strong>
        </div>
        <div className="work-clock-current">
        <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-400 max-lg:text-white/80">
          <MapPin className="mr-1 hidden max-lg:inline h-3 w-3 align-[-2px]" strokeWidth={2.6} aria-hidden="true" />Philippine time
        </p>
        <p className={`mt-1 font-mono font-black leading-none tabular-nums tracking-[-0.08em] text-slate-950 dark:text-white max-lg:text-white ${compact ? 'text-[clamp(2rem,8vw,3rem)] lg:text-3xl' : 'text-[clamp(2rem,8vw,3rem)]'}`}>{clock.time}</p>
        <div className={`mt-3 border-t border-dashed border-slate-200 pt-2 dark:border-slate-700 max-lg:border-white/30 ${compact ? 'lg:mt-1.5 lg:pt-1.5' : ''}`}>
          <p className="truncate text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-300 max-lg:text-white/85">{clock.date}</p>
        </div>
        </div>
      </div>
    </div>
  );
}

export default memo(EmployeeWorkClock);
