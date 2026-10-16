'use client';

import ModalShell from '@/components/shared/ModalShell';
import EmployeeThemeToggle from '@/components/employee/EmployeeThemeToggle';
import { CalendarDays, CalendarRange, Clock3, Coins, FileChartColumn, FolderDown, LifeBuoy, LogOut, Megaphone, Network } from 'lucide-react';

type Props = { open: boolean; darkMode: boolean; onClose: () => void; onToggleTheme: () => void; onLogout: () => void; onAnnouncements: () => void; onHolidays: () => void; onLeaveCalendar: () => void; onLeaveCredits: () => void; onReports: () => void; onDocuments: () => void; onHelpdesk: () => void };

const openOffsetManagement = () => window.dispatchEvent(new Event('hr:open-offset'));
const openLeaveHierarchy = () => window.dispatchEvent(new Event('hr:open-hierarchy'));

export default function HRMobileToolsSheet(props: Props) {
  if (!props.open) return null;
  const tools = [
    { label: 'Offset Management', detail: 'Offset approvals', icon: Clock3, tone: 'from-cyan-500 to-blue-700', action: openOffsetManagement },
    { label: 'Leave Hierarchy', detail: 'Ranks & leads', icon: Network, tone: 'from-violet-500 to-purple-700', action: openLeaveHierarchy },
    { label: 'Announcements', detail: 'Company updates', icon: Megaphone, tone: 'from-fuchsia-500 to-purple-700', action: props.onAnnouncements },
    { label: 'Holidays', detail: 'Holiday dates', icon: CalendarDays, tone: 'from-rose-500 to-pink-700', action: props.onHolidays },
    { label: 'Leave Calendar', detail: 'Team schedule', icon: CalendarRange, tone: 'from-violet-500 to-indigo-700', action: props.onLeaveCalendar },
    { label: 'Leave Credits', detail: 'Leave balances', icon: Coins, tone: 'from-amber-400 to-yellow-700', action: props.onLeaveCredits },
    { label: 'Export Reports', detail: 'CSV / PDF', icon: FileChartColumn, tone: 'from-cyan-500 to-blue-700', action: props.onReports },
    { label: 'Documents', detail: 'Employee files', icon: FolderDown, tone: 'from-slate-500 to-slate-800', action: props.onDocuments },
    { label: 'Help Desk', detail: 'Employee requests', icon: LifeBuoy, tone: 'from-sky-500 to-cyan-700', action: props.onHelpdesk },
  ];
  const run = (action: () => void) => { props.onClose(); window.setTimeout(action, 0); };
  return <ModalShell open={props.open} onClose={props.onClose} title="HR Tools & Account" description="People operations tools and appearance." size="lg">
      <div className="grid grid-cols-1 gap-2 min-[430px]:grid-cols-2">{tools.map(({ label, detail, icon: Icon, tone, action }) => <button key={label} type="button" onClick={() => run(action)} className="flex min-h-[76px] min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left shadow-sm transition active:scale-[.98] dark:!border-[#34453a] dark:!bg-[#202b24]"><span className={`relative grid h-12 w-12 flex-none place-items-center rounded-2xl bg-gradient-to-br text-white shadow-lg ${tone}`}><span className="absolute inset-[3px] rounded-[13px] border border-white/35"/><Icon size={23} strokeWidth={2.8}/></span><span className="min-w-0"><span className="block text-xs font-extrabold text-slate-950 dark:!text-white">{label}</span><span className="mt-1 block text-[10px] leading-snug text-slate-500 dark:!text-[#c4d0c7]">{detail}</span></span></button>)}</div>
      <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700"><EmployeeThemeToggle darkMode={props.darkMode} onToggle={props.onToggleTheme} /><button type="button" onClick={() => run(props.onLogout)} className="mt-2 flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-bold text-red-700 hover:bg-red-50 dark:!text-red-300"><LogOut size={18}/>Log Out</button></div>
    </ModalShell>;
}
