type SpinnerProps = {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const sizeMap = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-10 h-10 border-[3px]',
};

// Simple, dependency-free spinner (no icon library needed). Uses the
// brand green by default via currentColor, so it inherits whatever
// text color class is applied to it.
export default function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <span
      className={`inline-block ${sizeMap[size]} rounded-full border-current border-t-transparent animate-spin ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

// Convenience component: spinner + label, for inline "Loading X..." states.
export function LoadingRow({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
      <Spinner size="sm" />
      <span>{label}</span>
    </div>
  );
}

// Full-section loading state: centers a larger spinner with a label,
// for when an entire card/page area is waiting on its first data load.
export function LoadingSection({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-400">
      <Spinner size="lg" className="text-blue-600" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}
