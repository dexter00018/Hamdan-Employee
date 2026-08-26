'use client';

import Spinner from '@/components/Spinner';
import ModalShell from '@/components/shared/ModalShell';

type Props = { open: boolean; onClose: () => void; loading: boolean; lastBackupAt: string | null; lastArchiveAt: string | null; formatTimestamp: (value: string | null) => string; adminEmail: string | null; result: { type: string; text: string } | null; sending: boolean; onSendTestEmail: () => void };

export default function SystemHealthModal({ open, onClose, loading, lastBackupAt, lastArchiveAt, formatTimestamp, adminEmail, result, sending, onSendTestEmail }: Props) {
  return <ModalShell open={open} onClose={onClose} title="System Health" description="Backup, archive, and email delivery status" icon="💚" size="md">
    <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800"><p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-300">🗄️ Last backup</p><p className="mt-2 text-xs font-bold text-slate-950 dark:text-white">{loading ? 'Checking...' : formatTimestamp(lastBackupAt)}</p></div><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800"><p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-300">🗃️ Last archive</p><p className="mt-2 text-xs font-bold text-slate-950 dark:text-white">{loading ? 'Checking...' : formatTimestamp(lastArchiveAt)}</p></div></div>
    <section className="border-t border-slate-200 pt-4 dark:border-slate-700"><p className="label-branded mb-1">Email delivery (SMTP)</p><p className="mb-3 text-xs leading-relaxed text-slate-500 dark:text-slate-300">Sends a real password reset link to {adminEmail ?? 'your admin account'} to confirm email delivery end-to-end.</p>{result && <div role="status" className={`mb-3 rounded-2xl border p-3 text-xs font-bold ${result.type === 'success' ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/50 dark:text-green-200' : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200'}`}>{result.text}</div>}<button type="button" onClick={onSendTestEmail} disabled={sending || !adminEmail} className="btn-primary min-h-11 w-full disabled:opacity-50">{sending ? <span className="flex items-center justify-center gap-2"><Spinner size="sm"/>Sending...</span> : 'Send test email'}</button></section>
  </ModalShell>;
}
