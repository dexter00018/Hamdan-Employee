'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import {
  CalendarDays,
  CircleAlert,
  CloudSun,
  Clock3,
  HandCoins,
  Headphones,
  IdCard,
  Plane,
  TimerReset,
} from 'lucide-react';

const ManpowerTrackerModal = dynamic(() => import('@/components/employee/modals/ManpowerTrackerModal'));

type Props = {
  onWeather: () => void;
  onLeave: () => void;
  onDisputes: () => void;
  onPayslips: () => void;
  onOffset: () => void;
  onDirectory: () => void;
  onCompanyCalendar: () => void;
  onHelpdesk: () => void;
};

export default function EmployeeQuickActions({
  onWeather,
  onLeave,
  onDisputes,
  onPayslips,
  onOffset,
  onDirectory,
  onCompanyCalendar,
  onHelpdesk,
}: Props) {
  const [manpowerOpen, setManpowerOpen] = useState(false);

  const actions = [
    { label: 'Manpower Tracker', icon: TimerReset, action: () => setManpowerOpen(true), tone: 'from-green-500 to-emerald-700 shadow-green-500/20' },
    { label: 'Employee Directory', icon: IdCard, action: onDirectory, tone: 'from-emerald-500 to-green-600 shadow-green-500/20' },
    { label: 'Weather', icon: CloudSun, action: onWeather, tone: 'from-sky-400 to-cyan-600 shadow-cyan-500/20' },
    { label: 'My Leave', icon: Plane, action: onLeave, tone: 'from-teal-500 to-emerald-600 shadow-emerald-500/20' },
    { label: 'Disputes', icon: CircleAlert, action: onDisputes, tone: 'from-orange-500 to-rose-500 shadow-orange-500/20' },
    { label: 'Payslips', icon: HandCoins, action: onPayslips, tone: 'from-amber-400 to-orange-500 shadow-amber-500/20' },
    { label: 'Offset Request', icon: Clock3, action: onOffset, tone: 'from-cyan-500 to-teal-600 shadow-cyan-500/20' },
    { label: 'Company Calendar', icon: CalendarDays, action: onCompanyCalendar, tone: 'from-indigo-500 to-blue-600 shadow-indigo-500/20' },
    { label: 'Helpdesk', icon: Headphones, action: onHelpdesk, tone: 'from-violet-500 to-purple-600 shadow-violet-500/20' },
  ];

  return (
    <>
      <section aria-labelledby="employee-quick-actions-title">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 id="employee-quick-actions-title" className="text-base font-semibold sm:text-lg">Quick Actions</h2>
            <p className="mt-0.5 text-xs text-slate-500">Your most-used employee tools</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-3">
          {actions.map(({ label, icon: Icon, action, tone }) => (
            <button
              key={label}
              type="button"
              onClick={action}
              className="group relative flex min-h-24 min-w-0 flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl bg-white/90 px-1.5 py-3 text-center shadow-[0_7px_22px_rgba(15,23,42,0.06)] transition duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_10px_28px_rgba(15,23,42,0.09)] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#292f2b] dark:hover:bg-[#303632] sm:px-3"
            >
              <span className="absolute -right-5 -top-5 h-14 w-14 rounded-full bg-green-100/35 blur-sm transition group-hover:scale-125 dark:bg-green-900/15" aria-hidden="true" />
              <span className={`relative grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-md ${tone}`}>
                <Icon aria-hidden="true" size={20} strokeWidth={2.1} />
              </span>
              <span className="relative w-full text-balance text-[10px] font-semibold leading-tight text-slate-700 dark:text-slate-100 sm:text-xs">{label}</span>
            </button>
          ))}
        </div>
      </section>

      <ManpowerTrackerModal open={manpowerOpen} onClose={() => setManpowerOpen(false)} />
    </>
  );
}
