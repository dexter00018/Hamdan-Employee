'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock3, Network } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function HRDashboardToolInjector() {
  const [quickActionsTarget, setQuickActionsTarget] = useState<Element | null>(null);
  const [notificationTarget, setNotificationTarget] = useState<Element | null>(null);
  const [offsetCount, setOffsetCount] = useState(0);

  const refreshOffsetCount = useCallback(async () => {
    const [earned, usage] = await Promise.all([
      supabase.from('offset_requests').select('id', { count: 'exact', head: true }).eq('status', 'Pending'),
      supabase.from('offset_usage_requests').select('id', { count: 'exact', head: true }).eq('status', 'Pending'),
    ]);
    setOffsetCount((earned.count || 0) + (usage.count || 0));
  }, []);

  useEffect(() => {
    const syncTargets = () => {
      const quickSection = document.querySelector('section[aria-labelledby="hr-quick-actions-title"]');
      const grid = quickSection?.querySelector(':scope > div.grid') || null;
      const notification = document.querySelector('button[aria-label^="Open notifications"]');
      setQuickActionsTarget((current) => current === grid ? current : grid);
      setNotificationTarget((current) => current === notification ? current : notification);

      document.querySelectorAll<HTMLButtonElement>('button[aria-label^="Open leave hierarchy"], button[aria-label*="offset action"]')
        .forEach((button) => { button.style.display = 'none'; });
    };

    syncTargets();
    const observer = new MutationObserver(syncTargets);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const openHiddenOffset = () => {
      const button = document.querySelector<HTMLButtonElement>('button[aria-label*="offset action"]');
      button?.click();
    };
    const openHiddenHierarchy = () => {
      const button = document.querySelector<HTMLButtonElement>('button[aria-label^="Open leave hierarchy"]');
      button?.click();
    };
    window.addEventListener('hr:open-offset', openHiddenOffset);
    window.addEventListener('hr:open-hierarchy', openHiddenHierarchy);
    return () => {
      window.removeEventListener('hr:open-offset', openHiddenOffset);
      window.removeEventListener('hr:open-hierarchy', openHiddenHierarchy);
    };
  }, []);

  useEffect(() => {
    void refreshOffsetCount();
    const interval = window.setInterval(() => void refreshOffsetCount(), 30_000);
    const refreshVisible = () => { if (document.visibilityState === 'visible') void refreshOffsetCount(); };
    document.addEventListener('visibilitychange', refreshVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshVisible);
    };
  }, [refreshOffsetCount]);

  const openOffset = () => window.dispatchEvent(new Event('hr:open-offset'));
  const openHierarchy = () => window.dispatchEvent(new Event('hr:open-hierarchy'));

  const quickActions = quickActionsTarget ? createPortal(
    <>
      <button type="button" onClick={openOffset} className="group relative flex min-h-28 min-w-0 flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-slate-200 bg-white px-1.5 py-3 text-center shadow-[0_5px_16px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-green-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 dark:border-slate-700 dark:bg-[#292f2b] dark:hover:border-green-700">
        <span className={`relative grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-lg ring-1 ring-black/10 ${offsetCount > 0 ? 'from-amber-500 to-orange-700' : 'from-cyan-500 to-blue-700'}`}>
          <span className="absolute inset-[3px] rounded-[13px] border border-white/35"/>
          <Clock3 size={24} strokeWidth={3}/>
          {offsetCount > 0 && <span className="absolute -right-2 -top-2 grid h-6 min-w-6 place-items-center rounded-full border-2 border-white bg-rose-600 px-1 text-[10px] font-black text-white shadow dark:border-[#292f2b]">{offsetCount > 99 ? '99+' : offsetCount}</span>}
        </span>
        <span className="line-clamp-2 text-[10px] font-extrabold leading-tight text-slate-900 dark:text-white sm:text-xs">Offset Management</span>
        <span className={`hidden max-w-full truncate text-[10px] sm:block ${offsetCount > 0 ? 'font-bold text-orange-700 dark:text-orange-300' : 'text-slate-500 dark:text-slate-300'}`}>{offsetCount > 0 ? `${offsetCount} pending` : 'All clear'}</span>
        <span className={`absolute inset-x-4 bottom-0 h-0.5 rounded-t-full bg-gradient-to-r ${offsetCount > 0 ? 'from-amber-500 to-orange-700' : 'from-cyan-500 to-blue-700'}`} aria-hidden="true" />
      </button>

      <button type="button" onClick={openHierarchy} className="group relative flex min-h-28 min-w-0 flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-slate-200 bg-white px-1.5 py-3 text-center shadow-[0_5px_16px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-green-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 dark:border-slate-700 dark:bg-[#292f2b] dark:hover:border-green-700">
        <span className="relative grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 text-white shadow-lg ring-1 ring-black/10">
          <span className="absolute inset-[3px] rounded-[13px] border border-white/35"/>
          <Network size={24} strokeWidth={3}/>
        </span>
        <span className="line-clamp-2 text-[10px] font-extrabold leading-tight text-slate-900 dark:text-white sm:text-xs">Leave Hierarchy</span>
        <span className="hidden max-w-full truncate text-[10px] text-slate-500 dark:text-slate-300 sm:block">Rank & Direct Lead</span>
        <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-t-full bg-gradient-to-r from-violet-500 to-purple-700" aria-hidden="true" />
      </button>
    </>,
    quickActionsTarget
  ) : null;

  const notificationBadge = notificationTarget && offsetCount > 0 ? createPortal(
    <span className="pointer-events-none absolute -bottom-1 -left-1 grid h-4 min-w-4 place-items-center rounded-full bg-cyan-600 px-1 text-[8px] font-black text-white ring-2 ring-white dark:ring-[#292f2b]" title={`${offsetCount} pending offset action${offsetCount === 1 ? '' : 's'}`}>
      {offsetCount > 9 ? '9+' : offsetCount}
    </span>,
    notificationTarget
  ) : null;

  return <>{quickActions}{notificationBadge}</>;
}
