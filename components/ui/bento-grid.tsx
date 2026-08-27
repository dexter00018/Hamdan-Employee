import { cn } from '@/lib/utils';

export const BentoGrid = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => {
  return (
    <div
      className={cn(
        'grid grid-cols-2 xl:grid-cols-4 md:auto-rows-[9rem] gap-3',
        className
      )}
    >
      {children}
    </div>
  );
};

export const BentoGridItem = ({
  className,
  title,
  description,
  icon,
  iconWrapClassName,
  onClick,
}: {
  className?: string;
  title?: string | React.ReactNode;
  description?: string | React.ReactNode;
  icon?: React.ReactNode;
  iconWrapClassName?: string;
  onClick?: () => void;
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        // Re-themed from Aceternity's dark/neutral defaults to match
        // this repo's card-style: white surface, slate borders/text,
        // mint-green (blue-*) as the brand accent, subtle lift on hover
        // instead of a hard shadow -- matches the other module buttons
        // on this page (see the plain "card-style" buttons around it).
        'group/bento row-span-1 rounded-2xl border border-slate-100 bg-white p-3 sm:p-4',
        'flex flex-col justify-between text-left min-h-[76px]',
        'hover:bg-slate-50 hover:-translate-y-0.5 transition duration-200',
        className
      )}
    >
      <span
        className={cn(
          'w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0',
          'transition-transform duration-200 group-hover/bento:translate-x-1',
          iconWrapClassName
        )}
      >
        {icon}
      </span>
      <div className="mt-3">
        <div className="font-bold text-slate-900 text-xs">{title}</div>
        {description && (
          <div className="text-slate-400 text-[10px] mt-0.5 truncate">
            {description}
          </div>
        )}
      </div>
    </button>
  );
};