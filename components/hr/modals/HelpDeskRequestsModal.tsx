'use client';
import { useState, type Dispatch, type SetStateAction } from 'react';
import { CheckCircle2, ChevronRight, FileText, Headphones, Hourglass, Search, UserRound, XCircle } from 'lucide-react';
const t = (text: string) => text;
import { LoadingRow } from '@/components/Spinner';
import ModalShell from '@/components/shared/ModalShell';

export type HelpdeskRequest = { id: string; category: string; subject: string; description: string; status: string; hr_notes?: string | null; created_at: string; updated_at?: string; employee?: { full_name?: string | null; employee_id?: string | null } | null };
export type HelpdeskDraft = { status: string; hr_notes: string };
type Props = { open: boolean; onClose: () => void; loading: boolean; requests: HelpdeskRequest[]; drafts: Record<string, HelpdeskDraft>; setDrafts: Dispatch<SetStateAction<Record<string, HelpdeskDraft>>>; savingId: string | null; onSave: (id: string) => void | Promise<void>; department?: string; error?: string };
const terminal = (status: string) => status === 'Resolved' || status === 'Cancelled';
const tones: Record<string, string> = {
  Open: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200',
  'In Progress': 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200',
  Resolved: 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-200',
  Cancelled: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

export default function HelpDeskRequestsModal({ open, onClose, loading, requests, drafts, setDrafts, savingId, onSave, department = 'HR', error }: Props) {
  const [history, setHistory] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [oldest, setOldest] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const visible = requests.filter(r => terminal(r.status) === history && (!category || category === r.category) && (!status || status === r.status) &&
    [r.subject, r.description, r.employee?.full_name, r.employee?.employee_id, r.category, r.id].join(' ').toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => (oldest ? 1 : -1) * (Date.parse(a.created_at) - Date.parse(b.created_at)));
  const selected = visible.find(r => r.id === selectedId) || visible[0];
  const draft = selected ? drafts[selected.id] || { status: selected.status, hr_notes: selected.hr_notes || '' } : null;
  const date = (value: string) => new Date(value).toLocaleString('en-GB', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  const tabs = (value: boolean) => { setHistory(value); setStatus(''); };
  const badge = (value: string) => <span className={`inline-flex shrink-0 rounded-full px-3 py-1 text-[10px] font-bold ${tones[value] || tones.Open}`}>{t(value)}</span>;
  return <ModalShell open={open} onClose={onClose} closeDisabled={!!savingId} title={t(department === 'IT' ? 'IT Help Desk' : 'HR Help Desk')} description={t('Manage employee requests and provide timely support.')} icon={<Headphones size={24} />} size="xl" className="[&>header]:!py-3 [&>div]:!p-3 sm:[&>div]:!p-4">
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="mb-3 grid grid-cols-4 gap-1.5 sm:gap-2">
      {[{ label: 'Open tickets', value: 'Open', Icon: FileText }, { label: 'In Progress', value: 'In Progress', Icon: Hourglass }, { label: 'Resolved', value: 'Resolved', Icon: CheckCircle2 }, { label: 'Cancelled', value: 'Cancelled', Icon: XCircle }].map(({ label, value, Icon }) =>
        <button type="button" key={value} onClick={() => { setHistory(terminal(value)); setStatus(value); }} className={`flex min-w-0 items-center justify-center gap-2 rounded-xl border border-slate-200 px-1.5 py-2 text-center sm:justify-start sm:px-3 sm:text-start dark:border-slate-700 ${tones[value]}`}>
          <Icon size={18} className="hidden shrink-0 sm:block" aria-hidden="true" /><span><span className="block text-lg font-bold leading-6">{requests.filter(r => r.status === value).length}</span><span className="block text-[10px] leading-4 sm:text-xs">{t(label)}</span></span><ChevronRight className="ms-auto hidden sm:block" size={16} />
        </button>)}
    </div>
    {loading ? <LoadingRow label={t('Loading requests...')} /> : <div className="grid items-start gap-3 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.4fr)]">
      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-2 flex border-b border-slate-100 dark:border-slate-700">{[false, true].map(value => <button key={String(value)} type="button" aria-pressed={history === value} onClick={() => tabs(value)} className={`min-h-10 flex-1 border-b-2 text-sm font-bold ${history === value ? 'border-emerald-600 text-emerald-700 dark:text-emerald-300' : 'border-transparent text-slate-500'}`}>{t(value ? 'History' : 'Active')} ({requests.filter(r => terminal(r.status) === value).length})</button>)}</div>
        <div className="relative"><Search size={16} className="pointer-events-none absolute start-3 top-3.5 text-slate-400" /><input aria-label={t('Search tickets')} placeholder={t('Search tickets, employees, or keywords...')} value={query} onChange={e => setQuery(e.target.value)} className="input-field !min-h-10 !py-2 !rounded-xl w-full !ps-9 !text-xs" /></div>
        <div className="my-2 grid grid-cols-3 gap-2">
          <select aria-label={t('Category')} value={category} onChange={e => setCategory(e.target.value)} className="input-field !min-h-10 !py-2 !rounded-xl min-w-0 !px-2 !text-xs"><option value="">{t('All categories')}</option>{[...new Set(requests.map(r => r.category))].sort().map(c => <option key={c} value={c}>{t(c)}</option>)}</select>
          <select aria-label={t('Status')} value={status} onChange={e => setStatus(e.target.value)} className="input-field !min-h-10 !py-2 !rounded-xl min-w-0 !px-2 !text-xs"><option value="">{t('All statuses')}</option>{(history ? ['Resolved', 'Cancelled'] : ['Open', 'In Progress']).map(s => <option key={s} value={s}>{t(s)}</option>)}</select>
          <select aria-label={t('Sort tickets')} value={oldest ? 'oldest' : 'newest'} onChange={e => setOldest(e.target.value === 'oldest')} className="input-field !min-h-10 !py-2 !rounded-xl min-w-0 !px-2 !text-xs"><option value="newest">{t('Newest')}</option><option value="oldest">{t('Oldest')}</option></select>
        </div>
        <div className="max-h-52 lg:max-h-[55vh] space-y-2 overflow-y-auto">{visible.length ? visible.map(r => <button key={r.id} type="button" aria-pressed={selected?.id === r.id} onClick={() => setSelectedId(r.id)} className={`w-full rounded-xl border p-2.5 text-start ${selected?.id === r.id ? 'border-emerald-300 bg-emerald-50/70 ring-1 ring-emerald-200 dark:border-emerald-700 dark:bg-emerald-950/40 dark:ring-emerald-800' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'}`}><div className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] text-slate-500">#{r.id.slice(0, 8)}</span>{badge(r.status)}</div><p dir="auto" className="truncate text-sm font-bold">{r.subject}</p><p className="mt-1 text-xs text-slate-500">{t(r.category)}</p><p className="mt-1 truncate text-xs text-slate-600 dark:text-slate-300">{r.employee?.full_name || t('Unknown employee')}</p></button>) : <p className="p-8 text-center text-sm text-slate-500">{t('No matching tickets.')}</p>}</div>
      </section>
      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 sm:p-4">
        {selected && draft ? <>
          <p className="text-xs text-slate-500">#{selected.id.slice(0, 8)}</p><div className="my-2 flex flex-wrap items-center gap-3"><h3 dir="auto" className="break-words text-lg font-bold">{selected.subject}</h3>{badge(selected.status)}</div><p className="text-xs text-slate-500">{date(selected.created_at)} · {t('Manila time')}</p>
          <div className="my-2 border-b border-slate-200 pb-1.5 text-xs font-bold text-emerald-700 dark:border-slate-700 dark:text-emerald-300">{t('Details')}</div>
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-700 [&>div]:min-w-0 [&>div]:break-words"><div><p className="mb-1 flex items-center gap-2 text-xs text-slate-500"><UserRound size={15} />{t('Requestor')}</p><p className="font-semibold">{selected.employee?.full_name || t('Unknown employee')}</p><p className="text-xs text-slate-500">{selected.employee?.employee_id}</p></div><div><p className="mb-1 text-xs text-slate-500">{t('Category')}</p>{t(selected.category)}</div></div>
          <h4 className="mb-2 mt-3 text-sm font-bold">{t('Description')}</h4><p dir="auto" className="whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 text-sm leading-6 dark:bg-slate-800">{selected.description}</p>
          {terminal(selected.status) ? <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700"><h4 className="text-sm font-bold">{t('Final response')}</h4>{selected.updated_at && <p className="mt-1 text-xs text-slate-500">{t('Last updated')}: {date(selected.updated_at)}</p>}<div className="mt-3 rounded-xl bg-emerald-50/70 p-3 dark:bg-emerald-950/40"><p dir="auto" className="whitespace-pre-wrap text-sm leading-7">{selected.hr_notes || t('No response recorded.')}</p><p className="mt-2 text-xs text-slate-500">{t('Resolved and cancelled tickets are read-only.')}</p></div></div> : <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">
            <div className={`mb-3 grid gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800 ${department === 'HR' ? 'grid-cols-4' : 'grid-cols-3'}`}>{(department === 'HR' ? ['Open', 'In Progress', 'Resolved', 'Cancelled'] : ['Open', 'In Progress', 'Resolved']).map(s => <button type="button" key={s} disabled={!!savingId} aria-pressed={draft.status === s} onClick={() => setDrafts(current => ({ ...current, [selected.id]: { ...draft, status: s } }))} className={`min-h-10 min-w-0 rounded-lg border px-1 text-[10px] font-semibold leading-tight sm:text-xs ${draft.status === s ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-200 text-slate-600 dark:border-slate-600 dark:text-slate-200'}`}>{t(s === 'Resolved' ? 'Resolve' : s === 'Cancelled' ? 'Cancel' : s)}</button>)}</div>
            <label htmlFor={`reply-${selected.id}`} className="mb-2 block text-xs font-bold">{t('Response to employee')}</label><textarea id={`reply-${selected.id}`} rows={2} maxLength={5000} disabled={!!savingId} className="input-field !min-h-20 !rounded-xl !p-3 w-full resize-y text-sm" value={draft.hr_notes} onChange={e => setDrafts(current => ({ ...current, [selected.id]: { ...draft, hr_notes: e.target.value } }))} />
            {terminal(draft.status) && <p className="mt-2 text-xs text-slate-500">{t('Saving will move this ticket to History and lock further edits.')}</p>}
            <button type="button" disabled={!!savingId} onClick={() => onSave(selected.id)} className="btn-primary mt-2 !min-h-10 !py-2 !text-xs disabled:opacity-50">{t(savingId === selected.id ? 'Saving...' : draft.status === 'Resolved' ? 'Resolve and archive' : draft.status === 'Cancelled' ? 'Cancel and archive' : 'Save response')}</button>
          </div>}
        </> : <p className="py-20 text-center text-sm text-slate-500">{t('Select a ticket to view details.')}</p>}
      </section>
    </div>}
  </ModalShell>;
}
