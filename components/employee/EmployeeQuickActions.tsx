'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import AnyIcon from './AnyIcon';

const ManpowerTrackerModal = dynamic(() => import('@/components/employee/modals/ManpowerTrackerModal'));

type Props = {
  onAttendanceHistory: () => void;
  onLeave: () => void;
  onDisputes: () => void;
  onPayslips: () => void;
  onOffset: () => void;
  onDirectory: () => void;
  onCompanyCalendar: () => void;
  onHelpdesk: () => void;
  designation: string | null | undefined;
  ready: boolean;
  hasTimeInToday: boolean;
  referenceLayout?: boolean;
};

export default function EmployeeQuickActions({
  onAttendanceHistory,
  onLeave,
  onDisputes,
  onPayslips,
  onOffset,
  onDirectory,
  onCompanyCalendar,
  onHelpdesk,
  designation,
  ready,
  hasTimeInToday,
  referenceLayout = false,
}: Props) {
  const [manpowerOpen, setManpowerOpen] = useState(false);
  const manpowerPromptCheckedRef = useRef(false);
  const manpowerRestricted = ['IT MANAGER', 'HR MANAGER'].includes((designation || '').trim().toUpperCase());

  useEffect(() => {
    if (!ready || !hasTimeInToday || manpowerRestricted || manpowerPromptCheckedRef.current) return;
    manpowerPromptCheckedRef.current = true;
    let cancelled = false;

    const promptForManpowerWhenNeeded = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user || cancelled) return;
      const { data: activeSession, error } = await supabase
        .from('manpower_sessions')
        .select('id')
        .eq('user_id', authData.user.id)
        .is('ended_at', null)
        .limit(1)
        .maybeSingle();
      if (!cancelled && !error && !activeSession) setManpowerOpen(true);
    };

    void promptForManpowerWhenNeeded();
    return () => { cancelled = true; };
  }, [ready, hasTimeInToday, manpowerRestricted]);

  const actions = [
    { label: 'Manpower Tracker', img: 'busts_in_silhouette', tint: 'bg-emerald-200/70 dark:bg-emerald-800/50', action: () => setManpowerOpen(true), disabled: manpowerRestricted, title: manpowerRestricted ? 'Manpower Tracker is not assigned to this designation.' : undefined },
    { label: 'Employee Directory', img: 'directory_art', tint: 'bg-sky-200/70 dark:bg-sky-800/50', action: onDirectory },
    { label: 'Attendance History', img: 'history_art', tint: 'bg-blue-200/70 dark:bg-blue-800/50', action: onAttendanceHistory },
    { label: 'My Leave', img: 'leave_art', tint: 'bg-teal-200/70 dark:bg-teal-800/50', action: onLeave },
    { label: 'Disputes', img: 'disputes_art', tint: 'bg-orange-200/70 dark:bg-orange-800/50', action: onDisputes },
    { label: 'Payslips', img: 'payslip_art', tint: 'bg-amber-200/70 dark:bg-amber-800/50', action: onPayslips },
    { label: 'Offset Request', img: 'hourglass_not_done', tint: 'bg-cyan-200/70 dark:bg-cyan-800/50', action: onOffset },
    { label: 'Company Calendar', img: 'calendar_live_art', tint: 'bg-indigo-200/70 dark:bg-indigo-800/50', action: onCompanyCalendar },
    { label: 'Helpdesk', img: 'headphone', tint: 'bg-violet-200/70 dark:bg-violet-800/50', action: onHelpdesk },
  ];

  return (
    <>
      <section aria-labelledby="employee-quick-actions-title">
        <div className="quick-actions-heading mb-3 flex items-center gap-3">
          <AnyIcon name="high_voltage" size={52} className="h-7 w-7" />
          <div>
            <h2 id="employee-quick-actions-title" className="text-base font-semibold sm:text-lg">Quick Actions</h2>
            <p className="mt-0.5 text-xs text-slate-500">Employee tools for easy access</p>
          </div>
          <span className="hidden max-md:ml-auto max-md:inline-flex max-md:items-center max-md:gap-0.5 max-md:text-[11px] max-md:font-semibold max-md:text-slate-400" aria-hidden="true">
            Access your tools <ChevronRight className="h-3.5 w-3.5 text-green-600" strokeWidth={2.6} />
          </span>
        </div>
        <div className={`employee-quick-actions grid grid-cols-4 gap-2 sm:grid-cols-5 sm:gap-3 ${referenceLayout ? 'lg:grid-cols-4 lg:gap-2' : 'lg:grid-cols-9 lg:gap-2'}`}>
          {actions.map(({ label, img, tint, action, disabled, title }) => (
            <button
              key={label}
              type="button"
              onClick={action}
              disabled={disabled}
              title={title}
              aria-label={title ? `${label}: ${title}` : label}
              className={`group relative flex min-h-[82px] min-w-0 flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl bg-white/90 px-1 py-2.5 text-center shadow-[0_7px_22px_rgba(15,23,42,0.06)] transition duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_10px_28px_rgba(15,23,42,0.09)] active:translate-y-0 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#292f2b] dark:hover:bg-[#303632] sm:min-h-24 sm:px-3 max-md:items-start max-md:justify-between max-md:rounded-2xl max-md:px-2.5 max-md:py-3 max-md:text-left ${referenceLayout ? 'lg:min-h-[58px] lg:gap-1 lg:px-1 lg:py-1.5' : 'lg:min-h-[72px] lg:gap-1 lg:px-1 lg:py-2'} ${referenceLayout && label === 'Helpdesk' ? 'lg:col-span-4 lg:flex-row lg:justify-start lg:px-4 lg:text-left' : ''}`}
            >
              <span className="absolute -right-5 -top-5 h-14 w-14 rounded-full bg-green-100/35 blur-sm transition group-hover:scale-125 dark:bg-green-900/15" aria-hidden="true" />
                <span className="relative grid h-10 w-10 place-items-center lg:h-8 lg:w-8" aria-hidden="true">
                  {!img.endsWith('_art') && <span className={`absolute inset-0 rounded-full ${tint}`} />}
                  <AnyIcon name={img} size={56} className="relative h-10 w-10 transition-transform duration-200 group-hover:scale-110 lg:h-8 lg:w-8" />
                </span>
              <span className={`relative w-full text-balance max-md:pr-4 text-[10px] font-semibold leading-tight text-slate-700 dark:text-slate-100 sm:text-xs lg:text-[9px] ${referenceLayout && label === 'Helpdesk' ? 'lg:text-left lg:text-[10px]' : ''}`}>{label}</span>
              <span className={label === 'Helpdesk'
                ? 'qa-chevron absolute right-3 top-1/2 grid h-[18px] w-[18px] -translate-y-1/2 place-items-center rounded-full text-white'
                : 'qa-chevron absolute bottom-2 right-2 grid h-[18px] w-[18px] place-items-center rounded-full text-white'}
                aria-hidden="true">
                <ChevronRight className="h-2.5 w-2.5" strokeWidth={3.4} />
              </span>
            </button>
          ))}
        </div>
      </section>

      <ManpowerTrackerModal open={manpowerOpen} onClose={() => setManpowerOpen(false)} />
    </>
  );
}
