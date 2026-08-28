import {
  CalendarDays,
  CircleAlert,
  CloudSun,
  FileText,
  HandCoins,
  Headphones,
  IdCard,
  Plane,
} from 'lucide-react';

type Props = {
  onWeather: () => void;
  onLeave: () => void;
  onDisputes: () => void;
  onPayslips: () => void;
  onDocuments: () => void;
  onDirectory: () => void;
  onCompanyCalendar: () => void;
  onHelpdesk: () => void;
};

export default function EmployeeQuickActions({
  onWeather,
  onLeave,
  onDisputes,
  onPayslips,
  onDocuments,
  onDirectory,
  onCompanyCalendar,
  onHelpdesk,
}: Props) {
  const actions = [
    { label: 'Employee Directory', icon: IdCard, action: onDirectory, tone: 'from-emerald-500 to-green-600 shadow-green-500/25' },
    { label: 'Weather', icon: CloudSun, action: onWeather, tone: 'from-sky-400 to-cyan-600 shadow-cyan-500/25' },
    { label: 'My Leave', icon: Plane, action: onLeave, tone: 'from-teal-500 to-emerald-600 shadow-emerald-500/25' },
    { label: 'Disputes', icon: CircleAlert, action: onDisputes, tone: 'from-orange-500 to-rose-500 shadow-orange-500/25' },
    { label: 'Payslips', icon: HandCoins, action: onPayslips, tone: 'from-amber-400 to-orange-500 shadow-amber-500/25' },
    { label: 'Documents', icon: FileText, action: onDocuments, tone: 'from-cyan-500 to-teal-600 shadow-cyan-500/25' },
    { label: 'Company Calendar', icon: CalendarDays, action: onCompanyCalendar, tone: 'from-indigo-500 to-blue-600 shadow-indigo-500/25' },
    { label: 'Helpdesk', icon: Headphones, action: onHelpdesk, tone: 'from-violet-500 to-purple-600 shadow-violet-500/25' },
  ];

  return (
    <section aria-labelledby="employee-quick-actions-title">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 id="employee-quick-actions-title" className="text-base font-semibold sm:text-lg">Quick Actions</h2>
          <p className="mt-0.5 text-xs text-slate-500">Your most-used employee tools</p>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {actions.map(({ label, icon: Icon, action, tone }) => (
          <button
            key={label}
            type="button"
            onClick={action}
            className="group relative flex min-h-24 min-w-0 flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-slate-200 bg-white px-1.5 py-3 text-center shadow-[0_8px_24px_rgba(15,23,42,0.07)] transition duration-200 hover:-translate-y-0.5 hover:border-green-200 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#292f2b] dark:hover:border-green-700 sm:px-3"
          >
            <span className="absolute -right-5 -top-5 h-14 w-14 rounded-full bg-green-100/50 blur-sm transition group-hover:scale-125 dark:bg-green-900/20" aria-hidden="true" />
            <span className={`relative grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-lg ${tone}`}>
              <span className="absolute inset-[3px] rounded-[13px] border border-white/25" aria-hidden="true" />
              <Icon aria-hidden="true" size={20} strokeWidth={2.2} />
            </span>
            <span className="relative w-full text-balance text-[10px] font-bold leading-tight text-slate-800 dark:text-slate-100 sm:text-xs">{label}</span>
            <span className={`absolute inset-x-4 bottom-0 h-0.5 rounded-t-full bg-gradient-to-r ${tone.split(' shadow-')[0]}`} aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  );
}
