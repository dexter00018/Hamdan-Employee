import Image from 'next/image';
import {
  BellRing,
  CalendarClock,
  CarFront,
  CircleAlert,
  FileText,
  HandCoins,
  Headphones,
  LayoutDashboard,
  LogOut,
  Moon,
  Plane,
  Sun,
  UserRound,
} from 'lucide-react';

type Props = {
  employeeName: string;
  designation: string;
  avatarUrl?: string | null;
  darkMode: boolean;
  actionCount: number;
  onDashboard: () => void;
  onAttendance: () => void;
  onLeave: () => void;
  onDisputes: () => void;
  onPayslips: () => void;
  onDocuments: () => void;
  onActionCenter: () => void;
  onCommute: () => void;
  onHelpdesk: () => void;
  onProfile: () => void;
  onToggleTheme: () => void;
  onLogout: () => void;
};

export default function EmployeeDesktopSidebar(props: Props) {
  const items = [
    { label: 'Dashboard', icon: LayoutDashboard, action: props.onDashboard },
    { label: 'My Attendance', icon: CalendarClock, action: props.onAttendance },
    { label: 'My Leave', icon: Plane, action: props.onLeave },
    { label: 'My Disputes', icon: CircleAlert, action: props.onDisputes },
    { label: 'My Payslips', icon: HandCoins, action: props.onPayslips },
    { label: 'My Documents', icon: FileText, action: props.onDocuments },
    { label: 'Action Center', icon: BellRing, action: props.onActionCenter, badge: props.actionCount },
    { label: 'Commute Check', icon: CarFront, action: props.onCommute },
    { label: 'Helpdesk / HR', icon: Headphones, action: props.onHelpdesk },
    { label: 'My Profile', icon: UserRound, action: props.onProfile },
  ];

  return (
    <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_8px_30px_rgba(15,23,42,0.06)] dark:bg-[#292f2b] lg:flex">
      <div className="border-b border-slate-100 px-2 pb-4">
        <p className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">HAMDAN</p>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#16a34a]">Engineering</p>
      </div>
      <nav aria-label="Employee desktop navigation" className="mt-4 flex-1 space-y-1 overflow-y-auto">
        {items.map(({ label, icon: Icon, action, badge }, index) => (
          <button key={label} type="button" onClick={action} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition ${index === 0 ? 'bg-green-50 text-green-700 dark:bg-[#263b2f] dark:text-[#8ee6a7]' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:hover:bg-[#343b36]'}`}>
            <Icon aria-hidden="true" size={18} strokeWidth={2} />
            <span className="flex-1">{label}</span>
            {!!badge && <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{badge > 99 ? '99+' : badge}</span>}
          </button>
        ))}
      </nav>
      <button type="button" onClick={props.onToggleTheme} className="mt-3 flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:hover:bg-[#343b36]" aria-label={props.darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
        {props.darkMode ? <Sun size={18} /> : <Moon size={18} />}
        {props.darkMode ? 'Light Mode' : 'Dark Mode'}
      </button>
      <button type="button" onClick={props.onProfile} className="mt-3 flex min-h-14 items-center gap-3 rounded-xl bg-slate-50 p-2.5 text-left dark:bg-[#343b36]">
        <span className="grid h-10 w-10 flex-none place-items-center overflow-hidden rounded-full bg-white text-slate-500 dark:bg-[#292f2b]">
          {props.avatarUrl ? <Image src={props.avatarUrl} alt="" width={40} height={40} className="h-full w-full object-cover" /> : <UserRound size={18} />}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-xs font-bold text-slate-900 dark:text-white">{props.employeeName}</span>
          <span className="block truncate text-[11px] text-slate-500">{props.designation}</span>
        </span>
      </button>
      <button type="button" onClick={props.onLogout} className="mt-2 flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-red-700 transition-colors duration-150 hover:bg-red-50 dark:text-red-300 dark:hover:bg-[#44292b]">
        <LogOut size={18} aria-hidden="true" />
        Log Out
      </button>
    </aside>
  );
}
