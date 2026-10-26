'use client';

import type { CSSProperties, ReactNode } from 'react';
import { ArrowRight, ChevronRight, type LucideIcon } from 'lucide-react';
import AnyIcon from '../AnyIcon';

export function delayStyle(seconds: number): CSSProperties {
  return { '--cc-delay': `${seconds}s` } as CSSProperties;
}

// Flat icon accent, consistent style across all four cards.
export function Accent({ icon: Icon, cls, d }: { icon: LucideIcon; cls: string; d: number }) {
  return <Icon className={`cc-float pointer-events-none absolute hidden lg:block ${cls}`} style={delayStyle(d)} aria-hidden="true" />;
}

// Icon tile for the four summary cards: a bundled 3D emoji render on a
// soft wash of the card's vivid gradient, for a bold colorful pop.
export function Tile({ image, gradient }: { image: string; gradient?: string }) {
  return (
    <span className="cc-pop relative grid h-10 w-10 flex-shrink-0 place-items-center" style={delayStyle(0.1)} aria-hidden="true">
      {gradient && !image.endsWith('_art') && <span className={`absolute inset-0 rounded-full bg-gradient-to-br opacity-30 ${gradient}`} aria-hidden="true" />}
      <AnyIcon name={image} size={52} className={`relative ${gradient ? 'h-10 w-10' : 'h-8 w-8'} drop-shadow-[0_3px_6px_rgba(15,23,42,0.25)]`} />
    </span>
  );
}

// Phone-only compact stat tile: large 3D icon top-left, value + label
// bottom-left, and a small solid-color circular chevron bottom-right.
export function PhoneTile({ image, value, label, chevron }: { image: string; value: string | number; label: string; chevron: string }) {
  return (
    <div className="absolute inset-0 flex flex-col p-2">
      <AnyIcon name={image} size={64} className="h-9 w-9 drop-shadow-[0_3px_5px_rgba(15,23,42,0.18)]" />
      <span className="mt-auto flex w-full items-end justify-between gap-1">
        <span className="min-w-0 leading-none">
          <span className="block text-lg font-black tracking-tight text-slate-900 dark:text-white">{value}</span>
          <span className="mt-1 block truncate text-[9px] font-semibold tracking-[-0.02em] text-slate-600 dark:text-slate-300">{label}</span>
        </span>
        <span className={`grid h-[18px] w-[18px] flex-shrink-0 place-items-center rounded-full text-white shadow-sm ${chevron}`} aria-hidden="true">
          <ChevronRight className="h-2.5 w-2.5" strokeWidth={3.4} />
        </span>
      </span>
    </div>
  );
}

// One shared wrapper for the four summary cards: a hover sheen, the
// compact icon+value layout below lg (the 4-in-row mobile row), and the
// rich layout at lg+. The rich layout is sized to the original stat-card
// height (~110px), so everything inside stays single-row and tight.
// Phones (<768px) get the big vertical tile look instead of the row.
export function SummaryCard({ surface, onClick, aria, compact, phone, rich }: { surface: string; onClick: () => void; aria: string; compact: ReactNode; phone?: ReactNode; rich: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={aria}
      className={`group relative h-full min-w-0 overflow-hidden text-left transition duration-300 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.985] active:shadow-sm rounded-2xl ${surface}`}
    >
      <span
        className="pointer-events-none absolute inset-0 z-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full dark:via-white/10"
        aria-hidden="true"
      />
      <div className="md:hidden">{phone ?? compact}</div>
      <div className="hidden md:block lg:hidden">{compact}</div>
      <div className="relative hidden h-full lg:block">{rich}</div>
    </button>
  );
}

export function RichHeader({ tile, title, subtitle, action }: { tile: ReactNode; title: string; subtitle: string; action?: string }) {
  return (
    <div className="flex items-start gap-2">
      {tile}
      <div className="min-w-0 flex-1">
        <p className="cc-rise truncate text-[14px] font-extrabold leading-tight text-slate-950 dark:text-white" style={delayStyle(0.06)}>{title}</p>
        <p className="cc-rise truncate text-[12px] font-medium leading-tight text-slate-700 dark:text-slate-300" style={delayStyle(0.09)}>{subtitle}</p>
      </div>
      {action ? (
        <span
          className="cc-rise inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-violet-200/80 bg-white/70 px-2 py-0.5 text-[9px] font-extrabold text-violet-700 shadow-sm transition group-hover:bg-white dark:border-violet-800 dark:bg-white/5 dark:text-violet-200"
          style={delayStyle(0.12)}
        >
          {action} <ArrowRight className="h-2.5 w-2.5" aria-hidden="true" />
        </span>
      ) : null}
    </div>
  );
}

// Big stat value + unit, with the small helper line on the right.
export function BigValue({ value, unit, right }: { value: string | number; unit: string; right?: ReactNode }) {
  return (
    <div className="cc-pop mt-2 flex items-center justify-between gap-2" style={delayStyle(0.12)}>
      <span className="flex flex-shrink-0 items-baseline gap-1">
        <span className="text-2xl font-black leading-none tracking-tight text-slate-950 dark:text-white">{value}</span>
        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{unit}</span>
      </span>
      {right}
    </div>
  );
}

// Right-aligned metric block: big value + unit on top, optional badge
// below -- the shared alignment pattern for "9 days", "4 days", "22 min".
export function MetricRight({ value, unit, badge, delay = 0.12 }: { value: string | number; unit: string; badge?: ReactNode; delay?: number }) {
  return (
    <div className="cc-pop flex flex-col items-end gap-0.5" style={delayStyle(delay)}>
      <span className="flex items-baseline gap-1 leading-none">
        <span className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">{value}</span>
        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{unit}</span>
      </span>
      {badge}
    </div>
  );
}

// Pill chip with a flat icon: either bare (colored icon) or inside a
// small solid circle (white icon), matching the reference mock.
export function Chip({ icon: Icon, iconClass = '', circle = false, text, tone = 'plain' }: { icon: LucideIcon; iconClass?: string; circle?: boolean; text: string; tone?: 'plain' | 'tint' | 'warn' | 'green' }) {
  const tones = {
    plain: 'bg-white/85 text-slate-800 ring-1 ring-slate-300/80 dark:bg-white/10 dark:text-slate-100 dark:ring-slate-500',
    tint: 'bg-white/85 text-slate-800 ring-1 ring-slate-300/80 dark:bg-white/10 dark:text-slate-100 dark:ring-slate-500',
    warn: 'bg-amber-500/20 text-amber-900 ring-1 ring-amber-500/40 dark:text-amber-100',
    green: 'bg-emerald-500/20 text-emerald-900 ring-1 ring-emerald-500/40 dark:text-emerald-100',
  };
  return (
    <span className={`cc-rise inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-2 py-0.5 text-[10px] font-semibold ${tones[tone]}`}>
      {circle ? (
        <span className={`grid h-4 w-4 flex-shrink-0 place-items-center rounded-full ${iconClass}`} aria-hidden="true">
          <Icon className="h-2.5 w-2.5 text-white" strokeWidth={3} />
        </span>
      ) : (
        <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${iconClass}`} aria-hidden="true" />
      )}
      <span className="truncate">{text}</span>
    </span>
  );
}
