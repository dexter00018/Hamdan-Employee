'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import {
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  CalendarClock,
  CarFront,
  CircleAlert,
  Clock3,
  FileText,
  HandCoins,
  Headphones,
  Home,
  IdCard,
  LogOut,
  Moon,
  Plane,
  Sun,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';

type Props = {
  open: boolean;
  darkMode: boolean;
  employeeName: string;
  designation?: string;
  avatarUrl?: string | null;
  attendanceLabel: 'Time In' | 'Time Out' | 'Completed';
  attendanceDisabled: boolean;
  onClose: () => void;
  onToggleTheme: () => void;
  onLogout: () => void;
  onHome: () => void;
  onAttendanceAction: () => void;
  onAttendanceHistory: () => void;
  onLeave: () => void;
  onDisputes: () => void;
  onPayslips: () => void;
  onDocuments: () => void;
  onDirectory: () => void;
  onCalendar: () => void;
  onNotifications: () => void;
  onCommute: () => void;
  onHelpdesk: () => void;
  onActionCenter: () => void;
  onGovernmentIds: () => void;
};

export default function MobileAllToolsSheet(props: Props) {
  useEffect(() => {
    if (!props.open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [props.open]);

  if (!props.open) return null;

  const tools = [
    { label: 'Home', icon: Home, action: props.onHome },
    { label: props.attendanceLabel, icon: Clock3, action: props.onAttendanceAction, disabled: props.attendanceDisabled },
    { label: 'Attendance', icon: CalendarClock, action: props.onAttendanceHistory },
    { label: 'My Leave', icon: Plane, action: props.onLeave },
    { label: 'Disputes', icon: CircleAlert, action: props.onDisputes },
    { label: 'Payslips', icon: HandCoins, action: props.onPayslips },
    { label: 'Documents', icon: FileText, action: props.onDocuments },
    { label: 'Directory', icon: UsersRound, action: props.onDirectory },
    { label: 'Attendance Calendar', icon: CalendarDays, action: props.onCalendar },
    { label: 'Notifications', icon: Bell, action: props.onNotifications },
    { label: 'Commute', icon: CarFront, action: props.onCommute },
    { label: 'Helpdesk', icon: Headphones, action: props.onHelpdesk },
    { label: 'Action Center', icon: BriefcaseBusiness, action: props.onActionCenter },
    { label: 'Government IDs', icon: IdCard, action: props.onGovernmentIds },
  ];

  const runTool = (action: () => void, keepOpen = false) => {
    if (keepOpen) {
      action();
      return;
    }
    props.onClose();
    window.setTimeout(action, 0);
  };

  return (
    <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-labelledby="mobile-all-tools-title">
      <button type="button" className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" onClick={props.onClose} aria-label="Close all tools" />
      <section className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-3xl border-t border-slate-200 bg-white px-4 pt-3 shadow-2xl transition-colors duration-150 dark:border-[#465049] dark:bg-[#292f2b]" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200" aria-hidden="true" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-green-700">Employee Menu</p>
            <h2 id="mobile-all-tools-title" className="text-lg font-bold text-slate-900">Account & Tools</h2>
          </div>
          <button type="button" onClick={props.onClose} className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-600" aria-label="Close all tools">
            <X size={19} />
          </button>
        </div>
        <section className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left dark:bg-[#343b36]">
          <div className="flex min-h-14 items-center gap-3">
            <span className="grid h-12 w-12 flex-none place-items-center overflow-hidden rounded-full bg-white text-slate-500 dark:bg-[#292f2b]">
              {props.avatarUrl ? <Image src={props.avatarUrl} alt="" width={48} height={48} className="h-full w-full object-cover" /> : <UserRound size={20} />}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-slate-900">{props.employeeName}</span>
              <span className="mt-0.5 block truncate text-xs text-slate-500">{props.designation || 'Employee'}</span>
            </span>
          </div>
        </section>
        <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">All Tools</h3>
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {tools.map(({ label, icon: Icon, action, disabled }) => (
            <button key={label} type="button" onClick={() => runTool(action)} disabled={disabled} className="flex min-h-24 min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-1.5 py-3 text-center transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#303632]">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-green-50 text-[#16a34a] dark:bg-[#263b2f] dark:text-[#8ee6a7]">
                <Icon size={19} strokeWidth={2} aria-hidden="true" />
              </span>
              <span className="line-clamp-2 min-h-7 w-full text-[10px] font-semibold leading-tight text-slate-700 dark:text-slate-200 sm:text-[11px]">{label}</span>
            </button>
          ))}
        </div>
        <div className="mt-5 border-t border-slate-200 pt-4">
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Appearance & Account</h3>
          <button type="button" onClick={props.onToggleTheme} className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left transition-colors duration-150 hover:bg-slate-50 dark:hover:bg-[#343b36]" aria-label={props.darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
            <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-green-50 text-green-700 dark:bg-[#263b2f] dark:text-[#8ee6a7]">
              {props.darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-900">Appearance</span>
              <span className="block text-xs text-slate-500">{props.darkMode ? 'Dark Mode' : 'Light Mode'}</span>
            </span>
            <span className={`relative h-6 w-11 rounded-full transition-colors duration-150 ${props.darkMode ? 'bg-green-600' : 'bg-slate-300'}`} aria-hidden="true">
              <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-150 ${props.darkMode ? 'translate-x-6' : 'translate-x-1'}`} />
            </span>
          </button>
          <button type="button" onClick={() => runTool(props.onLogout)} className="mt-1 flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-red-700 transition-colors duration-150 hover:bg-red-50 dark:text-red-300 dark:hover:bg-[#44292b]">
            <LogOut size={18} aria-hidden="true" />
            Log Out
          </button>
        </div>
      </section>
    </div>
  );
}
