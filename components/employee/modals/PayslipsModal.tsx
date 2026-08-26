'use client';

import Spinner, { LoadingRow } from '@/components/Spinner';
import EmptyState from '@/components/shared/EmptyState';
import ModalShell from '@/components/shared/ModalShell';

type Props = { open: boolean; onClose: () => void; loading: boolean; payslips: any[]; downloadingId: string | null; acknowledgingId: string | null; onDownload: (payslip: any) => void; onAcknowledge: (id: string) => void };

export default function PayslipsModal({ open, onClose, loading, payslips, downloadingId, acknowledgingId, onDownload, onAcknowledge }: Props) {
  return (
    <ModalShell open={open} onClose={onClose} title="My Payslips" description="Secure payslip files published by HR" icon="🧾" size="md">
      {loading ? <LoadingRow label="Loading payslips..." /> : payslips.length === 0 ? (
        <EmptyState icon="📄" title="No payslips yet" description="HR will upload your payslip each cutoff period." />
      ) : <div className="space-y-3">
        {payslips.map((payslip) => (
          <article key={payslip.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800 sm:flex sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2"><p className="truncate text-sm font-extrabold text-slate-950 dark:text-white">{payslip.cutoff_label}</p>{!payslip.acknowledged_at && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[8px] font-extrabold uppercase text-white">New</span>}</div>
              <p className="mt-1 truncate text-xs text-slate-600 dark:text-slate-300">{payslip.file_name}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{new Date(payslip.uploaded_at).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })}</p>
              {payslip.acknowledged_at && <p className="mt-1 text-[9px] font-bold text-green-600 dark:text-green-300">Acknowledged</p>}
            </div>
            <div className="mt-3 flex items-center gap-2 sm:mt-0 sm:flex-col sm:items-stretch">
              <button type="button" onClick={() => onDownload(payslip)} disabled={downloadingId === payslip.id} className="min-h-11 rounded-full bg-slate-200 px-4 text-[10px] font-bold text-slate-800 transition hover:bg-slate-300 disabled:opacity-50 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600">{downloadingId === payslip.id ? <span className="flex items-center gap-2"><Spinner size="sm" />Downloading...</span> : 'Download'}</button>
              {!payslip.acknowledged_at && <button type="button" onClick={() => onAcknowledge(payslip.id)} disabled={acknowledgingId === payslip.id} className="min-h-11 rounded-full px-3 text-[10px] font-bold text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:text-blue-300 dark:hover:bg-blue-950/40">{acknowledgingId === payslip.id ? 'Saving...' : 'Acknowledge'}</button>}
            </div>
          </article>
        ))}
      </div>}
    </ModalShell>
  );
}
