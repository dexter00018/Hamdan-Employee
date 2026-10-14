import type { LucideIcon } from 'lucide-react';

type Props = {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: 'green' | 'orange' | 'yellow' | 'purple' | 'red';
  onClick: () => void;
  detail?: string;
};

const tones = {
  green: 'from-emerald-500 to-green-600 shadow-green-500/25',
  orange: 'from-amber-400 to-orange-500 shadow-orange-500/25',
  yellow: 'from-amber-300 to-yellow-500 shadow-amber-500/25',
  purple: 'from-violet-500 to-purple-600 shadow-purple-500/25',
  red: 'from-rose-500 to-red-600 shadow-red-500/25',
};

const surfaces = {
  green: 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/60 dark:bg-emerald-950/30',
  orange: 'border-orange-200 bg-orange-50/80 dark:border-orange-900/60 dark:bg-orange-950/30',
  yellow: 'border-amber-200 bg-amber-50/80 dark:border-amber-900/60 dark:bg-amber-950/30',
  purple: 'border-violet-200 bg-violet-50/80 dark:border-violet-900/60 dark:bg-violet-950/30',
  red: 'border-rose-200 bg-rose-50/80 dark:border-rose-900/60 dark:bg-rose-950/30',
};

export default function EmployeeSummaryCard({ label, value, icon: Icon, tone, onClick, detail }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative min-h-[104px] overflow-hidden rounded-2xl border p-3 text-left shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition duration-200 hover:-translate-y-0.5 hover:shadow-lg sm:min-h-[112px] sm:p-4 ${surfaces[tone]}`}
      aria-label={`View ${label.toLowerCase()} details`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className={`relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br text-white shadow-lg ${tones[tone]}`}>
          <span className="absolute inset-[3px] rounded-[13px] border border-white/25" aria-hidden="true" />
          <Icon aria-hidden="true" size={17} strokeWidth={2.2} />
        </span>
        <span className="stat-number text-xl text-slate-900 dark:text-white sm:text-2xl">{value}</span>
      </div>
      <div className="mt-2 min-w-0">
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</p>
        {detail ? <p className="mt-0.5 truncate text-[9px] font-bold text-orange-600 dark:text-orange-300 sm:text-[10px]">{detail}</p> : null}
      </div>
      <span className={`absolute inset-x-4 bottom-0 h-0.5 rounded-t-full bg-gradient-to-r ${tones[tone].split(' shadow-')[0]}`} aria-hidden="true" />
    </button>
  );
}
