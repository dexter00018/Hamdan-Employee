'use client';

import Spinner from '@/components/Spinner';
import ModalShell from '@/components/shared/ModalShell';

type Props = { open: boolean; onClose: () => void; archiveLoading: boolean; archiveResult: { type: 'success' | 'error'; text: string } | null; handleArchiveOldRecords: () => void | Promise<void> };

export default function DataArchiveModal({ open, onClose, archiveLoading, archiveResult, handleArchiveOldRecords }: Props) {
  return <ModalShell open={open} onClose={onClose} title="Data Archival" icon="🗃️" size="sm" closeDisabled={archiveLoading}>
    <p className="mb-6 text-sm text-slate-400">Moves attendance, dispute, and leave records older than 1 year out of the main tables and into the archive tables, to keep everything fast as data grows. Nothing is permanently deleted -- archived records stay viewable, just moved out of the way.</p>
    <button type="button" onClick={handleArchiveOldRecords} disabled={archiveLoading} className="w-full btn-primary disabled:opacity-50">{archiveLoading ? <span className="flex items-center justify-center gap-2"><Spinner size="sm" />Archiving...</span> : 'Archive Records Older Than 1 Year'}</button>
    {archiveResult && <p role="status" className={`mt-3 text-sm font-medium ${archiveResult.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>{archiveResult.type === 'error' ? `⚠️ ${archiveResult.text}` : `✅ ${archiveResult.text}`}</p>}
    <button type="button" onClick={onClose} className="mt-4 w-full rounded-full bg-slate-100 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-200">Close</button>
  </ModalShell>;
}
