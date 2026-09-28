'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Headphones, Activity, Archive, ClipboardList, DatabaseBackup, KeyRound, LogOut, Moon, ScrollText, Settings, Sun, TimerReset, UserPlus, Users, WalletCards, X } from 'lucide-react';

const ManpowerTrackerModal = dynamic(() => import('@/components/super-admin/modals/ManpowerTrackerModal'));
const OffsetManagementModal = dynamic(() => import('@/components/super-admin/modals/OffsetManagementModal'));

type Props = { open: boolean; darkMode: boolean; email: string | null; onClose: () => void; onToggleTheme: () => void; onLogout: () => void; onCreate: () => void; onAccounts: () => void; onHelpdesk: () => void; onAttendance: () => void; onSettings: () => void; onReset: () => void; onAudit: () => void; onHealth: () => void; onBackup: () => void; onArchive: () => void };

export default function SuperAdminMobileToolsSheet(props: Props) {
  const [manpowerOpen, setManpowerOpen] = useState(false);
  const [offsetOpen, setOffsetOpen] = useState(false);

  const groups = [
    { title: 'Help Desk', items: [['IT Help Desk', Headphones, props.onHelpdesk]] },
    { title: 'Account Management', items: [['Create Account', UserPlus, props.onCreate], ['User Accounts', Users, props.onAccounts], ['Reset Password', KeyRound, props.onReset]] },
    { title: 'Workforce', items: [['Attendance Records', ClipboardList, props.onAttendance], ['Manpower Tracker', TimerReset, () => { props.onClose(); window.setTimeout(() => setManpowerOpen(true), 0); }], ['Offset Management', WalletCards, () => { props.onClose(); window.setTimeout(() => setOffsetOpen(true), 0); }]] },
    { title: 'Security & History', items: [['Audit Log', ScrollText, props.onAudit]] },
    { title: 'System', items: [['System Health', Activity, props.onHealth], ['Database Backup', DatabaseBackup, props.onBackup], ['Data Archival', Archive, props.onArchive]] },
    { title: 'Configuration', items: [['App Settings', Settings, props.onSettings]] },
  ] as const;

  const run = (action: () => void) => { props.onClose(); window.setTimeout(action, 0); };

  return (
    <>
      {props.open ? (
        <div className="fixed inset-0 z-[65] bg-slate-950/45 backdrop-blur-sm lg:hidden" onMouseDown={(event) => { if (event.target === event.currentTarget) props.onClose(); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="admin-tools-title" className="absolute inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-t-[28px] border border-slate-200 bg-white px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl dark:border-slate-700 dark:bg-[#202521]">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-600"/>
            <header className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-green-700 dark:text-green-300">Super Admin</p><h2 id="admin-tools-title" className="text-lg font-black text-slate-950 dark:text-white">Tools & Account</h2><p className="mt-0.5 text-[10px] text-slate-500 dark:!text-[#aab8ad]">{props.email || 'Super Administrator'}</p></div><button type="button" onClick={props.onClose} className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:!text-white" aria-label="Close admin tools"><X size={19}/></button></header>
            <div className="space-y-4">{groups.map((group) => <section key={group.title}><p className="mb-2 text-[9px] font-black uppercase tracking-[0.16em] text-slate-500 dark:!text-[#aab8ad]">{group.title}</p><div className="grid grid-cols-3 gap-2">{group.items.map(([label, Icon, action]) => {
              const internal = label === 'Manpower Tracker' || label === 'Offset Management';
              return <button key={label} type="button" onClick={() => internal ? action() : run(action)} className="flex min-h-20 min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 text-center dark:border-slate-700 dark:bg-[#292f2b]"><span className="grid h-9 w-9 place-items-center rounded-xl bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300"><Icon size={18}/></span><span className="line-clamp-2 text-[10px] font-bold leading-tight text-slate-800 dark:!text-white">{label}</span></button>;
            })}</div></section>)}</div>
            <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700"><p className="mb-2 text-[9px] font-black uppercase tracking-[0.16em] text-slate-500 dark:!text-[#aab8ad]">Appearance & Account</p><button type="button" onClick={props.onToggleTheme} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:!text-white dark:hover:bg-slate-800">{props.darkMode ? <Sun size={18}/> : <Moon size={18}/>} {props.darkMode ? 'Light Mode' : 'Dark Mode'}</button><button type="button" onClick={() => run(props.onLogout)} className="mt-1 flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-bold text-red-700 hover:bg-red-50 dark:text-red-300"><LogOut size={18}/>Log Out</button></div>
          </section>
        </div>
      ) : null}

      <ManpowerTrackerModal open={manpowerOpen} onClose={() => setManpowerOpen(false)} />
      <OffsetManagementModal open={offsetOpen} onClose={() => setOffsetOpen(false)} />
    </>
  );
}
