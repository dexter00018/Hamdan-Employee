'use client';

// Hamdan-style centered loading screen, modeled after the brand's
// splash loader: a rounded "H" tile that beats (double pulse) with the
// brand leaf green, a small status line underneath, and a dimmed blurred
// backdrop so the page reads as "switching" instead of frozen.
type CenterLoaderProps = {
  show: boolean;
  /** 'fixed' covers the whole viewport; 'inside' covers the nearest positioned container (e.g. a modal body). */
  placement?: 'fixed' | 'inside';
  /** Short status line under the tile, e.g. "Preparing dashboard…". */
  label?: string;
};

export default function CenterLoader({ show, placement = 'fixed', label = 'Loading…' }: CenterLoaderProps) {
  return (
    <div
      aria-hidden="true"
      className={
        placement === 'fixed'
          ? `pointer-events-none fixed inset-0 z-[85] flex items-center justify-center bg-white/80 backdrop-blur-[3px] transition-opacity duration-300 dark:bg-[#131614]/95 ${show ? 'opacity-100' : 'opacity-0'}`
          : `pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-white/80 backdrop-blur-[3px] transition-opacity duration-200 dark:bg-[#232b26]/95 ${show ? 'opacity-100' : 'opacity-0'}`
      }
    >
      <span className="pointer-events-none flex flex-col items-center gap-4">
        <span
          className={`grid h-16 w-16 place-items-center rounded-[22px] border border-emerald-500/25 bg-white shadow-[0_10px_30px_rgba(47,189,108,0.14)] dark:border-emerald-400/15 dark:bg-[#222a25] ${show ? 'animate-[hamdan-heartbeat_2.1s_ease-in-out_infinite]' : '[animation-play-state:paused]'}`}
        >
          <span className="text-2xl font-black leading-none bg-gradient-to-b from-[#2fbd6c] to-[#1d8f52] bg-clip-text text-transparent">
            H
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className={`h-1.5 w-1.5 rounded-full bg-[#2fbd6c] ${show ? 'animate-pulse' : ''}`} />
          <span className="text-[11px] font-semibold tracking-wide text-slate-500 dark:text-slate-400">
            {label}
          </span>
        </span>
      </span>
    </div>
  );
}
