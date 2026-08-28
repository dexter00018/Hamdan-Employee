import { Activity, ClipboardList, DatabaseBackup, KeyRound, ScrollText, Settings, UserPlus, Users } from 'lucide-react';

type Props = {
  onCreateAccount: () => void;
  onAccounts: () => void;
  onAttendance: () => void;
  onSettings: () => void;
  onResetPassword: () => void;
  onAuditLog: () => void;
  onSystemHealth: () => void;
  onBackup: () => void;
};

export default function SuperAdminQuickActions(props: Props) {
  const actions = [
    { label: 'Create Account', icon: UserPlus, action: props.onCreateAccount },
    { label: 'User Accounts', icon: Users, action: props.onAccounts },
    { label: 'Attendance Records', icon: ClipboardList, action: props.onAttendance },
    { label: 'App Settings', icon: Settings, action: props.onSettings },
    { label: 'Reset Password', icon: KeyRound, action: props.onResetPassword },
    { label: 'Audit Log', icon: ScrollText, action: props.onAuditLog },
    { label: 'System Health', icon: Activity, action: props.onSystemHealth },
    { label: 'Database Backup', icon: DatabaseBackup, action: props.onBackup, system: true },
  ];

  return (
    <section aria-labelledby="super-admin-quick-actions-title">
      <div className="mb-3">
        <h2 id="super-admin-quick-actions-title" className="text-base font-semibold text-slate-950 dark:text-white sm:text-lg">Admin Quick Actions</h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-300">Account, workforce, and system controls</p>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {actions.map(({ label, icon: Icon, action, system }) => (
          <button key={label} type="button" onClick={action} className="group relative flex min-h-24 min-w-0 flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-slate-200 bg-white px-1.5 py-3 text-center shadow-[0_8px_24px_rgba(15,23,42,0.07)] transition hover:-translate-y-0.5 hover:border-green-200 hover:shadow-lg dark:border-slate-700 dark:bg-[#292f2b] dark:hover:border-green-700 sm:px-3">
            <span className={`relative grid h-11 w-11 place-items-center rounded-2xl text-white shadow-lg ${system ? 'bg-gradient-to-br from-slate-600 to-slate-800' : 'bg-gradient-to-br from-emerald-500 to-green-700'}`}>
              <span className="absolute inset-[3px] rounded-[13px] border border-white/25" aria-hidden="true" />
              <Icon aria-hidden="true" size={20} strokeWidth={2.2} />
            </span>
            <span className="relative w-full text-balance text-[10px] font-bold leading-tight text-slate-800 dark:text-slate-100 sm:text-xs">{label}</span>
            <span className={`absolute inset-x-4 bottom-0 h-0.5 rounded-t-full ${system ? 'bg-slate-500' : 'bg-green-600'}`} aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  );
}
