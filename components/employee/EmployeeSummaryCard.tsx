import type { LucideIcon } from 'lucide-react';

type Props = {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: 'green' | 'orange' | 'purple' | 'red';
  onClick: () => void;
  detail?: string;
};

const tones = {
  green: 'from-emerald-500 to-green-600 shadow-green-500/25',
  orange: 'from-amber-400 to-orange-500 shadow-orange-500/25',
  purple: 'from-violet-500 to-purple-600 shadow-purple-500/25',
  red: 'from-rose-500 to-red-600 shadow-red-500/25',
};

export default function EmployeeSummaryCard({ label, value, icon: Icon, tone, onClick, detail }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative min-h-24 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-[0_8px_24px_rgba(15,23,42,0.07)] transition duration-200 hover:-translate-y-0.5 hover:border-green-200 hover:shadow-lg dark:bg-[#292f2b] dark:hover:border-green-700 sm:p-4"
      aria-label={`View ${label.toLowerCase()} details`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className={`relative grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-lg ${tones[tone]}`}>
          <span className="absolute inset-[3px] rounded-[13px] border border-white/25" aria-hidden="true" />
          <Icon aria-hidden="true" size={18} strokeWidth={2.2} />
        </span>
        <span className="stat-number text-2xl text-slate-900 dark:text-white">{value}</span>
      </div>
      <div className="mt-3 min-w-0">
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 sm:text-sm">{label}</p>
        {detail ? <p className="mt-0.5 truncate text-[9px] font-bold text-orange-600 dark:text-orange-300 sm:text-[10px]">{detail}</p> : null}
      </div>
      <span className={`absolute inset-x-4 bottom-0 h-0.5 rounded-t-full bg-gradient-to-r ${tones[tone].split(' shadow-')[0]}`} aria-hidden="true" />
    </button>
  );
}
