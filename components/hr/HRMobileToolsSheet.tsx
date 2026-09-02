'use client';

import { useEffect } from 'react';
import { CalendarDays, CalendarRange, Coins, FileChartColumn, FolderDown, LifeBuoy, LogOut, Megaphone, Moon, Sun, X } from 'lucide-react';

type Props = { open: boolean; darkMode: boolean; onClose: () => void; onToggleTheme: () => void; onLogout: () => void; onAnnouncements: () => void; onHolidays: () => void; onLeaveCalendar: () => void; onLeaveCredits: () => void; onReports: () => void; onDocuments: () => void; onHelpdesk: () => void };

export default function HRMobileToolsSheet(props: Props) {
  useEffect(() => { if (!props.open) return; const previous = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = previous; }; }, [props.open]);
  if (!props.open) return null;
  const tools = [
    { label: 'Announcements', detail: 'Publish company updates', icon: Megaphone, tone: 'from-fuchsia-500 to-purple-700', action: props.onAnnouncements },
    { label: 'Holidays', detail: 'Manage holiday dates', icon: CalendarDays, tone: 'from-rose-500 to-pink-700', action: props.onHolidays },
    { label: 'Leave Calendar', detail: 'View team schedules', icon: CalendarRange, tone: 'from-violet-500 to-indigo-700', action: props.onLeaveCalendar },
    { label: 'Leave Credits', detail: 'Review balances', icon: Coins, tone: 'from-amber-400 to-yellow-700', action: props.onLeaveCredits },
    { label: 'Export Reports', detail: 'Download CSV or PDF', icon: FileChartColumn, tone: 'from-cyan-500 to-blue-700', action: props.onReports },
    { label: 'Documents', detail: 'Manage employee files', icon: FolderDown, tone: 'from-slate-500 to-slate-800', action: props.onDocuments },
    { label: 'Help Desk', detail: 'Respond to requests', icon: LifeBuoy, tone: 'from-sky-500 to-cyan-700', action: props.onHelpdesk },
  ];
  const run = (action: () => void) => { props.onClose(); window.setTimeout(action, 0); };
  return <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-labelledby="hr-tools-title">
    <button type="button" className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={props.onClose} aria-label="Close HR tools" />
    <section className="absolute inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-t-[28px] border-t border-slate-200 bg-white px-4 pt-3 text-slate-950 shadow-2xl dark:border-slate-700 dark:!bg-[#151d18] dark:!text-white" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
      <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-600" />
      <header className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-green-700 dark:!text-green-300">HR menu</p><h2 id="hr-tools-title" className="text-xl font-black text-slate-950 dark:!text-white">Tools & Account</h2><p className="mt-0.5 text-xs text-slate-500 dark:!text-slate-300">Choose a tool to continue</p></div><button type="button" onClick={props.onClose} className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-700 dark:!bg-[#253229] dark:!text-white" aria-label="Close HR tools"><X size={20} strokeWidth={2.8}/></button></header>
      <div className="grid grid-cols-1 gap-2 min-[430px]:grid-cols-2">{tools.map(({ label, detail, icon: Icon, tone, action }) => <button key={label} type="button" onClick={() => run(action)} className="flex min-h-[76px] min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left shadow-sm transition active:scale-[.98] dark:!border-[#34453a] dark:!bg-[#202b24]"><span className={`relative grid h-12 w-12 flex-none place-items-center rounded-2xl bg-gradient-to-br text-white shadow-lg ${tone}`}><span className="absolute inset-[3px] rounded-[13px] border border-white/35"/><Icon size={23} strokeWidth={2.8}/></span><span className="min-w-0"><span className="block text-xs font-extrabold text-slate-950 dark:!text-white">{label}</span><span className="mt-1 block text-[10px] leading-snug text-slate-500 dark:!text-[#c4d0c7]">{detail}</span></span></button>)}</div>
      <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700"><button type="button" onClick={props.onToggleTheme} className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800"><span className="grid h-10 w-10 place-items-center rounded-xl bg-green-50 text-green-700 dark:!bg-green-950/50 dark:!text-green-300">{props.darkMode ? <Sun size={19}/> : <Moon size={19}/>}</span><span className="flex-1"><span className="block text-sm font-bold text-slate-900 dark:!text-white">Appearance</span><span className="text-xs text-slate-500 dark:!text-slate-300">{props.darkMode ? 'Dark Mode' : 'Light Mode'}</span></span></button><button type="button" onClick={() => run(props.onLogout)} className="mt-1 flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-bold text-red-700 hover:bg-red-50 dark:!text-red-300"><LogOut size={18}/>Log Out</button></div>
    </section>
  </div>;
}
