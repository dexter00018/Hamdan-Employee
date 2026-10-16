import { CalendarClock, CalendarRange, CircleAlert, Clock3, FileDown, FileText, HandCoins, Headphones, LayoutDashboard, LogOut, Megaphone, Network, Plane, UsersRound } from 'lucide-react';

import EmployeeThemeToggle from '@/components/employee/EmployeeThemeToggle';
import styles from './hr-dashboard.module.css';

type Props = { attendanceOpen?: boolean; darkMode: boolean; leaveRequestCount: number; disputeCount: number; onDashboard: () => void; onAttendance: () => void; onEmployees: () => void; onLeave: () => void; onDisputes: () => void; onPayslips: () => void; onDocuments: () => void; onAnnouncements: () => void; onHolidays: () => void; onReports: () => void; onHelpdesk: () => void; onToggleTheme: () => void; onLogout: () => void };

const openOffsetManagement = () => window.dispatchEvent(new Event('hr:open-offset'));
const openLeaveHierarchy = () => window.dispatchEvent(new Event('hr:open-hierarchy'));

export default function HRDesktopSidebar(props: Props) {
  const items = [
    ['Dashboard', LayoutDashboard, props.onDashboard],
    ['Attendance', CalendarClock, props.onAttendance],
    ['Employees', UsersRound, props.onEmployees],
    ['Leave Requests', Plane, props.onLeave],
    ['Offset Management', Clock3, openOffsetManagement],
    ['Leave Hierarchy', Network, openLeaveHierarchy],
    ['Attendance Disputes', CircleAlert, props.onDisputes],
    ['Payslips', HandCoins, props.onPayslips],
    ['Employee Documents', FileText, props.onDocuments],
    ['Announcements', Megaphone, props.onAnnouncements],
    ['Holidays', CalendarRange, props.onHolidays],
    ['Reports', FileDown, props.onReports],
    ['Helpdesk / HR', Headphones, props.onHelpdesk],
  ] as const;

  return <aside className={`dashboard-sidebar dashboard-sidebar-fixed fixed z-40 hidden flex-col rounded-2xl border shadow-[0_8px_30px_rgba(15,23,42,0.04)] lg:flex ${styles.sidebar}`}>
    <div className={styles.sidebarBrand}><LayoutDashboard size={28} /><div><strong>HAMDAN</strong><small>HR Portal</small></div></div>
    <nav aria-label="HR desktop navigation" className="mt-2 flex-1 space-y-0.5 overflow-y-auto">{items.map(([label, Icon, action]) => { const selected = label === (props.attendanceOpen ? 'Attendance' : 'Dashboard'); const badgeCount = label === 'Leave Requests' ? props.leaveRequestCount : label === 'Attendance Disputes' ? props.disputeCount : 0; return <button key={label} type="button" onClick={action} aria-current={selected ? 'page' : undefined} className={`flex min-h-9 w-full items-center gap-3 rounded-xl px-3 text-left text-xs font-medium transition [@media(max-height:760px)]:min-h-8 ${selected ? 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:!text-white' : 'text-slate-700 hover:bg-slate-50 dark:!text-[#e3ece4] dark:hover:bg-slate-800'}`}><Icon size={17} className="shrink-0"/><span className="flex-1">{label}</span>{badgeCount > 0 ? <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">{badgeCount > 99 ? '99+' : badgeCount}</span> : null}</button>; })}</nav>
    <EmployeeThemeToggle darkMode={props.darkMode} onToggle={props.onToggleTheme} className={styles.sidebarTheme} />
    <div className={styles.sidebarProfile}><span>HR</span><div><strong>HR Administrator</strong><small>Human Resources</small></div></div>
    <button type="button" onClick={props.onLogout} className="mt-2 flex min-h-10 items-center gap-3 rounded-xl px-3 text-xs font-medium text-red-700 hover:bg-red-50 dark:text-red-300 [@media(max-height:760px)]:min-h-9"><LogOut size={17}/>Log Out</button>
  </aside>;
}
