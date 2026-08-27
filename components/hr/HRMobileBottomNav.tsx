'use client';

import { useState } from 'react';
import { ClipboardList, Clock3, Home, Menu, UsersRound } from 'lucide-react';

type Tab = 'home' | 'attendance' | 'requests' | 'employees' | 'more';
type Props = { requestCount: number; onHome: () => void; onAttendance: () => void; onRequests: () => void; onEmployees: () => void; onMore: () => void };

export default function HRMobileBottomNav(props: Props) {
  const [active, setActive] = useState<Tab>('home');
  const items = [
    { key: 'home' as const, label: 'Home', icon: Home, action: props.onHome },
    { key: 'attendance' as const, label: 'Attendance', icon: Clock3, action: props.onAttendance },
    { key: 'requests' as const, label: 'Requests', icon: ClipboardList, action: props.onRequests, badge: props.requestCount },
    { key: 'employees' as const, label: 'Employees', icon: UsersRound, action: props.onEmployees },
    { key: 'more' as const, label: 'More', icon: Menu, action: props.onMore },
  ];
  return <nav aria-label="HR mobile navigation" className="fixed inset-x-0 bottom-0 z-[45] border-t border-slate-200/80 bg-white/95 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-700 dark:bg-[#292f2b]/95 lg:hidden">
    <div className="mx-auto flex max-w-lg px-2 pt-2" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
      {items.map(({ key, label, icon: Icon, action, badge }) => <button key={key} type="button" onClick={() => { setActive(key); action(); }} className={`relative flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[10px] font-semibold transition ${active === key ? 'text-green-700 dark:text-green-300' : 'text-slate-500'}`} aria-current={active === key ? 'page' : undefined}>
        <span className={`relative grid h-8 w-9 place-items-center rounded-xl ${active === key ? 'bg-green-50 dark:bg-green-950/40' : ''}`}><Icon size={19} strokeWidth={active === key ? 2.5 : 2} />{badge ? <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white">{badge > 9 ? '9+' : badge}</span> : null}</span>
        <span className="max-w-full truncate">{label}</span>
      </button>)}
    </div>
  </nav>;
}
