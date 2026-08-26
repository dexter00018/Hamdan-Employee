'use client';

import { LoadingRow } from '@/components/Spinner';
import EmptyState from '@/components/shared/EmptyState';
import ModalShell from '@/components/shared/ModalShell';

type Props = { open: boolean; onClose: () => void; loading: boolean; requests: any[]; drafts: Record<string, any>; setDrafts: (updater: any) => void; savingId: string | null; onSave: (id: string) => void };

export default function HelpDeskRequestsModal({ open, onClose, loading, requests, drafts, setDrafts, savingId, onSave }: Props) {
  return <ModalShell open={open} onClose={onClose} closeDisabled={Boolean(savingId)} title="Help Desk / HR Requests" description="Review employee concerns, update status, and send an HR response" icon="🎫" size="lg">
    {loading ? <LoadingRow label="Loading employee requests..." /> : requests.length === 0 ? <EmptyState icon="🎫" title="No Help Desk requests yet" description="New employee concerns will appear here." /> : <div className="space-y-3">{requests.map((request) => {
      const draft = drafts[request.id] || { status: request.status, hr_notes: request.hr_notes || '' };
      return <article key={request.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-xs font-extrabold text-slate-950 dark:text-white">{request.employee?.full_name || 'Unknown employee'}</p><p className="text-[10px] text-slate-500 dark:text-slate-300">{request.employee?.employee_id || 'No ID'} · {request.category} · {new Date(request.created_at).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })}</p></div><span className={request.status === 'Resolved' ? 'tag-present' : request.status === 'In Progress' ? 'tag-excused' : 'tag-late'}>{request.status}</span></div>
        <p className="mt-3 text-xs font-semibold text-slate-900 dark:text-white">{request.subject}</p><p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-600 dark:text-slate-300">{request.description}</p>
        <div className="mt-3 grid grid-cols-1 items-end gap-2 sm:grid-cols-[150px_1fr_auto]"><div><label className="label-branded">Status</label><select className="input-field min-h-11 !py-2 !text-xs" value={draft.status} onChange={(event) => setDrafts((current: any) => ({ ...current, [request.id]: { ...draft, status: event.target.value } }))}><option>Submitted</option><option>In Progress</option><option>Resolved</option></select></div><div><label className="label-branded">HR Response</label><input className="input-field min-h-11 !py-2 !text-xs" value={draft.hr_notes} placeholder="Response shown to employee..." onChange={(event) => setDrafts((current: any) => ({ ...current, [request.id]: { ...draft, hr_notes: event.target.value } }))}/></div><button type="button" onClick={() => onSave(request.id)} disabled={savingId === request.id} className="btn-primary min-h-11 !px-4 !py-2.5 text-xs disabled:opacity-50">{savingId === request.id ? 'Saving...' : 'Save response'}</button></div>
      </article>;
    })}</div>}
  </ModalShell>;
}
