'use client';

import { LoadingRow } from '@/components/Spinner';
import ModalShell from '@/components/shared/ModalShell';
import EmptyState from '@/components/shared/EmptyState';

type Props = {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  documents: any[];
  downloadingId: string | null;
  onDownload: (document: any) => void;
};

export default function EmployeeDocumentsModal({ open, onClose, loading, documents, downloadingId, onDownload }: Props) {
  return (
    <ModalShell open={open} onClose={onClose} title="My Documents" description="Policies, handbooks, and memorandums published by HR" icon="📚" size="md">
      {loading ? <LoadingRow label="Loading documents..." /> : documents.length === 0 ? (
        <EmptyState icon="📚" title="No documents published yet" description="New company files will appear here after HR publishes them." />
      ) : (
        <div className="space-y-2">
          {documents.map((document) => (
            <article key={document.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-xs font-extrabold text-slate-950 dark:text-white">{document.title}</p>
                <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-300">{document.category} · {new Date(document.published_at).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })}</p>
              </div>
              <button type="button" onClick={() => onDownload(document)} disabled={downloadingId === document.id} className="min-h-11 flex-shrink-0 rounded-full bg-teal-100 px-4 text-[11px] font-extrabold text-teal-800 transition hover:bg-teal-200 disabled:opacity-50 dark:bg-teal-950 dark:text-teal-200 dark:hover:bg-teal-900">
                {downloadingId === document.id ? 'Downloading...' : 'Download file'}
              </button>
            </article>
          ))}
        </div>
      )}
    </ModalShell>
  );
}
