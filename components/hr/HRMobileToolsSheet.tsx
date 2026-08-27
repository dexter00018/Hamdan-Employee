'use client';

import { useEffect } from 'react';
import { CalendarClock, CalendarRange, FileDown, FileText, Headphones, LogOut, Megaphone, Moon, Sun, X } from 'lucide-react';

type Props = { open: boolean; darkMode: boolean; onClose: () => void; onToggleTheme: () => void; onLogout: () => void; onAnnouncements: () => void; onHolidays: () => void; onLeaveCalendar: () => void; onLeaveCredits: () => void; onReports: () => void; onDocuments: () => void; onHelpdesk: () => void };

export default function HRMobileToolsSheet(props: Props) {
  useEffect(() => { if (!props.open) return; const previous = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = previous; }; }, [props.open]);
  if (!props.open) return null;
  const tools = [
    ['Announcements', Megaphone, props.onAnnouncements], ['Holidays', CalendarRange, props.onHolidays], ['Leave Calendar', CalendarClock, props.onLeaveCalendar], ['Leave Credits', CalendarClock, props.onLeaveCredits], ['Export Reports', FileDown, props.onReports], ['Employee Documents', FileText, props.onDocuments], ['Help Desk Requests', Headphones, props.onHelpdesk],
  ] as const;
  const run = (action: () => void) => { props.onClose(); window.setTimeout(action, 0); };
  return <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-labelledby="hr-tools-title">
    <button type="button" className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" onClick={props.onClose} aria-label="Close HR tools" />
    <section className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-3xl border-t border-slate-200 bg-white px-4 pt-3 shadow-2xl dark:border-slate-700 dark:bg-[#292f2b]" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
      <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200" />
      <div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-green-700">HR Menu</p><h2 id="hr-tools-title" className="text-lg font-bold">Tools & Account</h2></div><button type="button" onClick={props.onClose} className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 dark:bg-slate-800" aria-label="Close HR tools"><X size={19}/></button></div>
      <div className="grid grid-cols-4 gap-2">{tools.map(([label, Icon, action]) => <button key={label} type="button" onClick={() => run(action)} className="flex min-h-24 min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-1 py-3 text-center shadow-sm dark:border-slate-700 dark:bg-[#303632]"><span className="relative grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-700 text-white shadow-md"><span className="absolute inset-[3px] rounded-[13px] border border-white/25"/><Icon size={19}/></span><span className="line-clamp-2 text-[10px] font-bold leading-tight">{label}</span></button>)}</div>
      <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700"><button type="button" onClick={props.onToggleTheme} className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800"><span className="grid h-10 w-10 place-items-center rounded-xl bg-green-50 text-green-700 dark:bg-green-950/40">{props.darkMode ? <Sun size={18}/> : <Moon size={18}/>}</span><span className="flex-1"><span className="block text-sm font-semibold">Appearance</span><span className="text-xs text-slate-500">{props.darkMode ? 'Dark Mode' : 'Light Mode'}</span></span></button><button type="button" onClick={() => run(props.onLogout)} className="mt-1 flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-red-700 hover:bg-red-50 dark:text-red-300"><LogOut size={18}/>Log Out</button></div>
    </section>
  </div>;
}
