'use client';

import { LoadingRow } from '@/components/Spinner';
import ModalShell from '@/components/shared/ModalShell';
import EmptyState from '@/components/shared/EmptyState';

type Props = {
  open: boolean;
  onClose: () => void;
  saving: boolean;
  loading: boolean;
  message: { type: string; text: string } | null;
  form: { category: string; subject: string; description: string };
  setForm: (value: any) => void;
  requests: any[];
  onSubmit: () => void;
};

export default function HelpDeskModal({ open, onClose, saving, loading, message, form, setForm, requests, onSubmit }: Props) {
  return (
    <ModalShell open={open} onClose={onClose} closeDisabled={saving} title="Help Desk / HR Request" description="Submit a concern and follow its progress" icon="🎫" size="lg">
      {message && <div role="status" className={`mb-4 rounded-2xl border p-3 text-xs font-bold ${message.type === 'success' ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/50 dark:text-green-200' : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200'}`}>{message.text}</div>}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          <p className="mb-4 text-xs font-black text-slate-950 dark:text-white">New request</p>
          <label className="label-branded">Category</label>
          <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="input-field mb-3 min-h-11">
            {['IT Concern', 'Payroll Concern', 'Profile Correction', 'Government ID Correction', 'General HR Concern'].map((category) => <option key={category}>{category}</option>)}
          </select>
          <label className="label-branded">Subject</label>
          <input value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} className="input-field mb-3 min-h-11" maxLength={120} placeholder="Short summary" />
          <label className="label-branded">Description</label>
          <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="input-field mb-3 min-h-28 resize-y" maxLength={2000} placeholder="Describe your concern..." />
          <button type="button" onClick={onSubmit} disabled={saving} className="btn-primary min-h-11 w-full disabled:opacity-50">{saving ? 'Submitting...' : 'Submit request'}</button>
        </div>
        <div>
          <p className="label-branded mb-2">My requests</p>
          <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
            {loading ? <LoadingRow label="Loading requests..." /> : requests.length === 0 ? (
              <EmptyState icon="🎫" title="No requests submitted yet" description="Your requests and HR responses will be listed here." />
            ) : requests.map((request) => (
              <article key={request.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><p className="text-xs font-extrabold text-slate-950 dark:text-white">{request.subject}</p><p className="mt-1 text-[9px] text-slate-500 dark:text-slate-300">{request.category}</p></div>
                  <span className={`rounded-full px-2 py-1 text-[8px] font-extrabold uppercase ${request.status === 'Resolved' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-200' : request.status === 'In Progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200'}`}>{request.status}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-[10px] leading-relaxed text-slate-600 dark:text-slate-300">{request.description}</p>
                {request.hr_notes && <p className="mt-2 rounded-xl bg-blue-50 p-3 text-[10px] text-blue-800 dark:bg-blue-950/50 dark:text-blue-200"><strong>HR response:</strong> {request.hr_notes}</p>}
              </article>
            ))}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
