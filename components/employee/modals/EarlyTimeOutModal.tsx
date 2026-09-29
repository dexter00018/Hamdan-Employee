'use client';

import { useState } from 'react';
import Spinner from '@/components/Spinner';
import ModalShell from '@/components/shared/ModalShell';

type Props = {
  open: boolean;
  onClose: () => void;
  expectedTimeOutLabel: string;
  handleTimeOut: () => void | Promise<void>;
  timeOutLoading: boolean;
};

function formatMinutes(totalMinutes: number) {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours && rest) return `${hours}h ${rest}m`;
  if (hours) return `${hours}h`;
  return `${rest}m`;
}

export default function EarlyTimeOutModal({ open, onClose, expectedTimeOutLabel, handleTimeOut, timeOutLoading }: Props) {
  const [offsetLoading, setOffsetLoading] = useState(false);
  const [offsetError, setOffsetError] = useState<string | null>(null);

  const useOffset = async () => {
    setOffsetLoading(true);
    setOffsetError(null);
    try {
      const response = await fetch('/api/time-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useOffset: true }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to use Offset for Early Out.');

      const minutes = Number(result.offsetMinutes || 0);
      try {
        sessionStorage.setItem(
          'employee:early-out-offset-success',
          minutes > 0 ? `${formatMinutes(minutes)} Offset reserved for HR review.` : 'Offset reserved for HR review.'
        );
      } catch {
        // Session storage is optional; the attendance record is already saved.
      }
      onClose();
      window.dispatchEvent(new Event('employee:offset-data-changed'));
      window.location.reload();
    } catch (error) {
      setOffsetError(error instanceof Error ? error.message : 'Unable to use Offset for Early Out.');
    } finally {
      setOffsetLoading(false);
    }
  };

  const busy = timeOutLoading || offsetLoading;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Time Out Early?"
      description="Use Offset for exact early minutes"
      icon="⚠️"
      size="sm"
      closeDisabled={busy}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="min-h-11 rounded-xl bg-slate-100 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200"
            onClick={() => { onClose(); void handleTimeOut(); }}
            disabled={busy}
          >
            {timeOutLoading ? <span className="flex items-center justify-center gap-2"><Spinner size="sm"/>Processing…</span> : 'Time Out'}
          </button>
          <button
            type="button"
            className="min-h-11 rounded-xl bg-emerald-700 px-3 text-xs font-bold text-white transition hover:bg-emerald-800 disabled:opacity-50"
            onClick={() => void useOffset()}
            disabled={busy}
          >
            {offsetLoading ? <span className="flex items-center justify-center gap-2"><Spinner size="sm"/>Processing…</span> : 'Use Offset'}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        {offsetError && <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{offsetError}</div>}
        <div className="rounded-xl bg-amber-50 px-3 py-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="font-bold">Official Time Out: {expectedTimeOutLabel}</p>
          <p className="mt-1 opacity-80">Current: {new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: true })}</p>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-300">Use Offset reserves the exact early minutes. HR approval deducts the reserved minutes; rejection deducts nothing.</p>
      </div>
    </ModalShell>
  );
}
