'use client';
import { ReactNode } from 'react';
export function BentoGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {children}
    </div>
  );
}
export function BentoGridItem({
  onClick,
  icon,
  iconWrapClassName,
  title,
  description,
  className = '',
}: {
  onClick: () => void;
  icon: ReactNode;
  iconWrapClassName?: string;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`card-style !p-3 sm:!p-4 flex items-center gap-3 text-left hover:bg-slate-50 hover:-translate-y-0.5 transition min-h-[76px] ${className}`}
    >
      <span className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${iconWrapClassName}`}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-bold text-slate-900 text-xs">{title}</span>
        <span className="block text-slate-400 text-[10px] mt-0.5 truncate">{description}</span>
      </span>
    </button>
  );
}