'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Activity, Archive, ClipboardList, DatabaseBackup, House, KeyRound, LogOut, Moon, ScrollText, Settings, Sun, TimerReset, UserPlus, Users, WalletCards } from 'lucide-react';

const ManpowerTrackerModal = dynamic(() => import('@/components/super-admin/modals/ManpowerTrackerModal'));
const OffsetManagementModal = dynamic(() => import('@/components/super-admin/modals/OffsetManagementModal'));

type Props = {
  darkMode: boolean; email: string | null; onToggleTheme: () => void; onLogout: () => void; onHome: () => void;
  onCreate: () => void; onAccounts: () => void; onAttendance: () => void; onSettings: () => void; onReset: () => void; onAudit: () => void; onHealth: () => void; onBackup: () => void; onArchive: () => void;
};

export default function SuperAdminDesktopSidebar(props: Props) {
  const [manpowerOpen, setManpowerOpen] = useState(false);
  const [offsetOpen, setOffsetOpen] = useState(false);

  const groups = [
    { title: '', items: [['Dashboard', House, props.onHome]] },
    { title: 'Accounts', items: [['Create Account', UserPlus, props.onCreate], ['User Accounts', Users, props.onAccounts], ['Reset Password', KeyRound, props.onReset]] },
    { title: 'Workforce', items: [['Attendance Records', ClipboardList, props.onAttendance], ['Manpower Tracker', TimerReset, () => setManpowerOpen(true)], ['Offset Management', WalletCards, () => setOffsetOpen(true)]] },
    { title: 'Configuration', items: [['App Settings', Settings, props.onSettings]] },
    { title: 'Security & History', items: [['Audit Log', ScrollText, props.onAudit]] },
    { title: 'System', items: [['System Health', Activity, props.onHealth], ['Database Backup', DatabaseBackup, props.onBackup], ['Data Archival', Archive, props.onArchive]] },
  ] as const;

  return (
    <>
      <aside className="dashboard-sidebar dashboard-sidebar-fixed fixed bottom-2 left-6 top-2 z-40 hidden w-64 flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white p-3 shadow-[0_12px_35px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-[#202521] lg:flex">
        <div className="shrink-0 border-b border-slate-200 px-1 pb-3 dark:border-slate-700">
          <p className="text-sm font-black tracking-tight text-slate-950 dark:text-white">HAMDAN ENGINEERING</p>
          <p className="mt-0.5 text-[10px] font-bold text-green-700 dark:text-green-300">Super Administrator</p>
        </div>

        <nav className="mt-2 flex-1 space-y-2">
          {groups.map((group) => (
            <div key={group.title || 'dashboard'}>
              {group.title && <p className="mb-1 px-3 text-[9px] font-black uppercase tracking-[0.1em] text-slate-500 dark:text-[#aab8ad]">{group.title}</p>}
              <div className="space-y-0.5">
                {group.items.map(([label, Icon, action]) => (
                  <button key={label} type="button" onClick={action} className={`flex min-h-8 w-full items-center gap-3 rounded-xl px-3 text-left text-[11px] font-bold transition ${label === 'Dashboard' ? 'bg-green-50 text-green-800 dark:bg-green-950/50 dark:!text-white' : 'text-slate-700 hover:bg-slate-100 dark:!text-[#e3ece4] dark:hover:bg-slate-800'}`}>
                    <Icon size={16} className="shrink-0"/>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-2 shrink-0 border-t border-slate-200 pt-2 dark:border-slate-700">
          <button type="button" onClick={props.onToggleTheme} className="flex min-h-9 w-full items-center gap-3 rounded-xl px-3 text-[11px] font-bold text-slate-700 hover:bg-slate-100 dark:!text-[#e3ece4] dark:hover:bg-slate-800">
            {props.darkMode ? <Sun size={16}/> : <Moon size={16}/>} {props.darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
          <div className="mt-1.5 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800">
            <p className="truncate text-[10px] font-bold text-slate-900 dark:text-white">{props.email || 'Super Administrator'}</p>
            <button type="button" onClick={props.onLogout} className="mt-1 flex min-h-8 w-full items-center gap-2 text-[11px] font-bold text-red-600 dark:text-red-300"><LogOut size={15}/>Log Out</button>
          </div>
        </div>
      </aside>

      <ManpowerTrackerModal open={manpowerOpen} onClose={() => setManpowerOpen(false)} />
      <OffsetManagementModal open={offsetOpen} onClose={() => setOffsetOpen(false)} />
    </>
  );
}
