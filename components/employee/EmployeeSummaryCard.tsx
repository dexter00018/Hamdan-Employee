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

const detailColors = {
  green: 'text-emerald-700 dark:text-emerald-300',
  orange: 'text-orange-700 dark:text-orange-300',
  yellow: 'text-amber-700 dark:text-amber-300',
  purple: 'text-violet-700 dark:text-violet-300',
  red: 'text-rose-700 dark:text-rose-300',
};

export default function EmployeeSummaryCard({ label, value, icon: Icon, tone, onClick, detail }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`dashboard-stat group relative min-w-0 overflow-hidden rounded-2xl border text-left shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-lg ${surfaces[tone]}`}
      aria-label={`View ${label.toLowerCase()} details`}
    >
      <span className={`dashboard-stat-icon relative bg-gradient-to-br text-white shadow-sm ${tones[tone]}`}>
        <Icon aria-hidden="true" size={28} strokeWidth={1.8} />
      </span>
      <div className="dashboard-stat-copy">
        <p className="dashboard-stat-label">{label}</p>
        <span className="dashboard-stat-value text-slate-900 dark:text-white">{value}</span>
        {detail ? <p className={`dashboard-stat-detail ${detailColors[tone]}`}>{detail}</p> : null}
      </div>
      <span className={`dashboard-stat-rail absolute inset-x-4 bottom-0 h-0.5 rounded-t-full bg-gradient-to-r ${tones[tone].split(' shadow-')[0]}`} aria-hidden="true" />
    </button>
  );
}
