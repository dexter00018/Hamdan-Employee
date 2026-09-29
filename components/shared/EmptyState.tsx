import type { ReactNode } from 'react';

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
};

export default function EmptyState({ icon = '📭', title, description, action }: EmptyStateProps) {
  return (
    <div className="flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-7 text-center dark:border-slate-700 dark:bg-slate-800/60">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-lg shadow-sm dark:bg-slate-900" aria-hidden="true">
        {icon}
      </span>
      <p className="mt-3 text-sm font-extrabold text-slate-900 dark:text-white">{title}</p>
      {description && <p className="mt-1 line-clamp-2 max-w-sm text-[10px] leading-snug text-slate-500 dark:text-slate-300 sm:text-[11px]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
