import type { LucideIcon } from 'lucide-react';

type Props = {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: 'green' | 'orange' | 'purple' | 'red';
  onClick: () => void;
};

const tones = {
  green: 'bg-green-50 text-green-700 dark:bg-[#263b2f] dark:text-[#8ee6a7]',
  orange: 'bg-orange-50 text-orange-700 dark:bg-[#403525] dark:text-[#ffe2a3]',
  purple: 'bg-purple-50 text-purple-700 dark:bg-[#382e42] dark:text-[#ead8ff]',
  red: 'bg-red-50 text-red-700 dark:bg-[#44292b] dark:text-[#ffd1d5]',
};

export default function EmployeeSummaryCard({ label, value, icon: Icon, tone, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group min-h-24 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-[0_4px_18px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-green-200 hover:shadow-md dark:bg-[#292f2b] dark:hover:border-green-700 sm:p-4"
      aria-label={`View ${label.toLowerCase()} details`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${tones[tone]}`}>
          <Icon aria-hidden="true" size={18} strokeWidth={2} />
        </span>
        <span className="stat-number text-2xl text-slate-900 dark:text-white">{value}</span>
      </div>
      <p className="mt-3 text-xs font-semibold text-slate-600 dark:text-slate-300 sm:text-sm">{label}</p>
    </button>
  );
}
