import { Activity, Ellipsis, House, Settings, Users } from 'lucide-react';

type Props = { onHome: () => void; onAccounts: () => void; onSettings: () => void; onHealth: () => void; onMore: () => void };

export default function SuperAdminMobileBottomNav(props: Props) {
  const items = [
    { label: 'Home', icon: House, action: props.onHome },
    { label: 'Accounts', icon: Users, action: props.onAccounts },
    { label: 'Settings', icon: Settings, action: props.onSettings },
    { label: 'Health', icon: Activity, action: props.onHealth },
    { label: 'More', icon: Ellipsis, action: props.onMore },
  ];
  return <nav aria-label="Super Admin navigation" className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl dark:border-slate-700 dark:bg-slate-950/95 lg:hidden"><div className="grid grid-cols-5">{items.map(({ label, icon: Icon, action }, index) => <button key={label} type="button" onClick={action} className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-bold ${index === 0 ? 'text-green-700 dark:text-green-400' : 'text-slate-500 dark:text-slate-300'}`}><Icon size={19} strokeWidth={2} /><span>{label}</span></button>)}</div></nav>;
}
