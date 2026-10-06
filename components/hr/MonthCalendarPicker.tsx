'use client';

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';

function dateFromMonth(value: string) {
  return new Date(`${value}-01T12:00:00`);
}

function monthValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(date: Date) {
  return date.toLocaleString('en-PH', { month: 'long', year: 'numeric' });
}

type Anchor = { top: number; left: number };

export default function MonthCalendarPicker({ value, onChange }: { value: string; onChange: (month: string) => void }) {
  const selectedDate = useMemo(() => dateFromMonth(value), [value]);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => selectedDate.getFullYear());
  const [anchor, setAnchor] = useState<Anchor>({ top: 84, left: 12 });
  const months = Array.from({ length: 12 }, (_, month) => new Date(viewYear, month, 1, 12));

  useEffect(() => setMounted(true), []);
  useEffect(() => setViewYear(selectedDate.getFullYear()), [selectedDate]);

  useEffect(() => {
    if (!open) return;
    const position = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(420, window.innerWidth - 24);
      setAnchor({
        top: Math.min(rect.bottom + 8, Math.max(12, window.innerHeight - 320)),
        left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)),
      });
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const choose = (date: Date) => {
    onChange(monthValue(date));
    setOpen(false);
  };

  return <div className="relative z-40">
    <button ref={triggerRef} type="button" onClick={() => setOpen((current) => !current)} aria-haspopup="dialog" aria-expanded={open} className="flex min-w-[156px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-left shadow-sm transition hover:border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-slate-500">
      <CalendarDays size={14} className="text-slate-500 dark:text-slate-300" />
      <span><span className="block text-[8px] font-bold uppercase tracking-[.12em] text-slate-400">Reporting month</span><span className="block text-[10px] font-bold text-slate-800 dark:text-white">{monthLabel(selectedDate)}</span></span>
    </button>
    {open && mounted && createPortal(<div className="fixed inset-0 z-[250]" role="presentation">
      <button type="button" aria-label="Close reporting month picker" className="absolute inset-0 cursor-default bg-slate-950/10 backdrop-blur-[1px] sm:bg-transparent sm:backdrop-blur-none" onClick={() => setOpen(false)} />
      <div className="absolute z-[251] w-[calc(100vw-24px)] max-w-[420px] rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_24px_60px_rgba(15,23,42,.24)] dark:border-slate-600 dark:bg-slate-900 sm:rounded-3xl sm:p-5" style={{ top: anchor.top, left: anchor.left }} role="dialog" aria-modal="true" aria-label="Choose reporting month">
        <div className="mb-4 flex items-center justify-between gap-3"><button type="button" onClick={() => setViewYear((year) => year - 1)} className="grid h-9 w-9 place-items-center rounded-full text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800" aria-label="Previous year"><ChevronLeft size={20} /></button><div className="text-center"><p className="text-sm font-bold text-slate-900 dark:text-white">Choose reporting month</p><p className="mt-0.5 text-[10px] text-slate-400">Select a month in {viewYear}</p></div><button type="button" onClick={() => setViewYear((year) => year + 1)} className="grid h-9 w-9 place-items-center rounded-full text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800" aria-label="Next year"><ChevronRight size={20} /></button></div>
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2">{months.map((month) => { const monthKey = monthValue(month); const selected = monthKey === value; return <button key={monthKey} type="button" onClick={() => choose(month)} aria-pressed={selected} className={`rounded-xl border px-2 py-2.5 text-sm font-bold transition ${selected ? 'border-emerald-500/60 bg-emerald-600 text-white shadow-sm dark:border-emerald-400/50 dark:bg-emerald-700' : 'border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-100 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-800'}`}>{month.toLocaleString('en-PH', { month: 'short' })}</button>; })}</div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-[11px] dark:border-slate-700"><span className="text-slate-500 dark:text-slate-300">Showing <b className="text-slate-900 dark:text-white">{monthLabel(selectedDate)}</b></span><button type="button" onClick={() => choose(new Date())} className="font-bold text-green-700 underline underline-offset-4 dark:text-green-300">This month</button></div>
      </div>
    </div>, document.body)}
  </div>;
}
