'use client';
import { useState } from 'react';
import { Headphones } from 'lucide-react';
const localize = (text: string) => text;


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
  onCancel: (id: string) => void | Promise<void>;
};

export default function HelpDeskModal({ open, onClose, saving, loading, message, form, setForm, requests, onSubmit, onCancel }: Props) {
  const [history, setHistory] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const visible = requests.filter(r => (['Resolved', 'Cancelled'].includes(r.status)) === history);
  return (
    <ModalShell open={open} onClose={onClose} closeDisabled={saving} title={localize("Help Desk / HR Request")} description={localize("Submit a concern and follow its progress")} icon="🎫" size="lg">
      {message && <div role="status" className={`mb-3 rounded-xl border p-3 text-xs font-bold ${message.type === 'success' ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/50 dark:text-green-200' : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200'}`}>{message.text}</div>}
      <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
          <p className="mb-3 text-sm font-black text-slate-950 dark:text-white"><>{"New request"}</></p>
          <label htmlFor="helpdesk-category" className="label-branded"><>{"Category"}</></label>
          <select id="helpdesk-category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="input-field mb-3 !min-h-10 !rounded-xl !py-2 !text-sm">
            {['IT Concern', 'Payroll Concern', 'Profile Correction', 'Government ID Correction', 'General HR Concern'].map((category) => <option key={category}>{category}</option>)}
          </select>
          <label htmlFor="helpdesk-subject" className="label-branded"><>{"Subject"}</></label>
          <input id="helpdesk-subject" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} className="input-field mb-3 !min-h-10 !rounded-xl !py-2 !text-sm" maxLength={120} placeholder={localize("Short summary")} />
          <label htmlFor="helpdesk-description" className="label-branded"><>{"Description"}</></label>
          <textarea id="helpdesk-description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="input-field mb-3 !min-h-24 !rounded-xl !text-sm resize-y" maxLength={2000} placeholder={localize("Describe your concern...")} />
          <button type="button" onClick={onSubmit} disabled={saving} className="btn-primary !min-h-10 !py-2 !text-xs w-full disabled:opacity-50"><>{saving ? 'Submitting...' : 'Submit request'}</></button>
        </div>
        <div>
          <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">{[false,true].map(value => <button type="button" key={String(value)} aria-pressed={history === value} onClick={() => setHistory(value)} className={`min-h-10 rounded-lg px-3 text-xs font-bold ${history === value ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200'}`}>{localize(value ? 'History' : 'Active')} ({requests.filter(r => (['Resolved', 'Cancelled'].includes(r.status)) === value).length})</button>)}</div>
          <div className="max-h-[480px] space-y-2 overflow-y-auto pe-1">
            {loading ? <LoadingRow label={localize("Loading requests...")} /> : visible.length === 0 ? (
              <EmptyState icon="🎫" title={localize("No requests submitted yet")} description={localize("Your requests and HR responses will be listed here.")} />
            ) : visible.map((request) => (
              <article key={request.id} className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><p className="break-words text-sm font-bold text-slate-950 dark:text-white">{request.subject}</p><p className="mt-1 text-[11px] text-slate-500 dark:text-slate-300">{request.category}</p></div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-extrabold uppercase ${request.status === 'Cancelled' ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200' : request.status === 'Resolved' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-200' : request.status === 'In Progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200'}`}>{localize(request.status)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-600 dark:text-slate-300">{request.description}</p>
                {request.hr_notes && <p className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-blue-50 p-3 text-xs text-blue-800 dark:bg-blue-950/50 dark:text-blue-200"><strong>{localize(request.category === 'IT Concern' ? 'IT response:' : 'HR response:')}</strong> {request.hr_notes}</p>}
                {!['Resolved', 'Cancelled'].includes(request.status) && <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">{cancelId === request.id ? <><p className="mb-2 text-xs">{localize('Cancel this request? It will move to History and cannot be edited.')}</p><div className="grid grid-cols-2 gap-2"><button type="button" disabled={saving} className="min-h-10 rounded-lg bg-red-600 px-2 text-xs font-bold text-white disabled:opacity-50" onClick={() => { void onCancel(request.id); setCancelId(null); }}>{localize('Confirm cancellation')}</button><button type="button" disabled={saving} className="min-h-10 rounded-lg border border-slate-200 px-2 text-xs" onClick={() => setCancelId(null)}>{localize('Keep request')}</button></div></> : <button type="button" disabled={saving} className="min-h-10 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 disabled:opacity-50" onClick={() => setCancelId(request.id)}>{localize('Cancel request')}</button>}</div>}
                {request.status === 'Cancelled' && <p className="mt-3 text-xs text-slate-500">{localize('Cancelled requests are read-only.')}</p>}
              </article>
            ))}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
