'use client';

import type { Dispatch, SetStateAction } from 'react';
import { CalendarClock, CheckCircle2, ChevronLeft } from 'lucide-react';
import ModalShell from '@/components/shared/ModalShell';
import type { LeaveRequest } from '@/lib/types/hr';

type Props = { open: boolean; onClose: () => void; approveLeave: (item: LeaveRequest) => void; rejectLeave: (item: LeaveRequest) => void; actionLoadingId: string | null; message: { type: 'success' | 'error'; text: string } | null; loading: boolean; countLeaveDays: (start: string, end: string) => number; leaveRequests: LeaveRequest[]; leaveHrNotes: Record<string, string>; setLeaveHrNotes: Dispatch<SetStateAction<Record<string, string>>>; selectedLeaveDetail: LeaveRequest | null; setSelectedLeaveDetail: Dispatch<SetStateAction<LeaveRequest | null>> };

export default function LeaveHistoryModal(p: Props) {
  const pending = p.leaveRequests.filter((item) => item.status === 'Pending');
  const resolved = p.leaveRequests.filter((item) => item.status !== 'Pending');
  const detail = p.selectedLeaveDetail;
  const close = () => { p.setSelectedLeaveDetail(null); p.onClose(); };
  const dates = (item: LeaveRequest) => item.start_date === item.end_date ? item.start_date : `${item.start_date} → ${item.end_date}`;
  return <ModalShell open={p.open} onClose={close} title={detail ? 'Leave Details' : 'Leave Requests'} size="sm"><div className="max-h-[68vh] overflow-y-auto pr-1">
    {p.message && <div className={`mb-3 rounded-xl p-3 text-xs font-bold ${p.message.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'}`}>{p.message.text}</div>}
    {detail ? <div className="space-y-3">
      <button type="button" onClick={() => p.setSelectedLeaveDetail(null)} className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400"><ChevronLeft size={14}/>Back to all requests</button>
      <div className="flex items-center justify-between gap-2"><strong className="text-sm text-slate-900 dark:text-white">{detail.employee?.full_name ?? 'Unknown'}</strong><span className={detail.status === 'Approved' ? 'tag-present' : detail.status === 'Pending' ? 'tag-excused' : 'tag-late'}>{detail.status}</span></div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800"><p className="text-xs font-bold text-slate-900 dark:text-white">{detail.leave_type}</p><p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{dates(detail)} · {p.countLeaveDays(detail.start_date, detail.end_date)} working day(s)</p></div>
      <div><p className="label-branded mb-1">Employee reason</p><p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">{detail.reason || 'No reason provided.'}</p></div>
      {detail.status === 'Pending' && <><input className="input-field !min-h-0 !py-2 !text-xs" placeholder="HR notes (optional)…" value={p.leaveHrNotes[detail.id] ?? ''} onChange={(event) => p.setLeaveHrNotes((current) => ({ ...current, [detail.id]: event.target.value }))}/><div className="grid grid-cols-2 gap-2"><button type="button" disabled={p.actionLoadingId === detail.id} onClick={() => p.approveLeave(detail)} className="rounded-full bg-green-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">Approve</button><button type="button" disabled={p.actionLoadingId === detail.id} onClick={() => p.rejectLeave(detail)} className="rounded-full bg-slate-200 px-4 py-2.5 text-xs font-bold text-slate-800 disabled:opacity-50 dark:bg-slate-700 dark:text-white">Reject</button></div></>}
    </div> : p.loading ? <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-300">Loading leave requests…</p> : <div className="space-y-5">
      <section><div className="mb-2 flex items-center justify-between"><p className="label-branded">Pending review</p><span className="rounded-full bg-orange-50 px-2 py-1 text-[10px] font-black text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">{pending.length}</span></div>{pending.length === 0 ? <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"><CheckCircle2 size={16}/>All caught up — no pending leave requests.</div> : <div className="space-y-2">{pending.map((item) => <Row key={item.id} item={item} subtitle={`${item.leave_type} · ${dates(item)}`} pending onClick={() => p.setSelectedLeaveDetail(item)}/>)}</div>}</section>
      <section><p className="label-branded mb-2">Resolved ({resolved.length})</p>{resolved.length === 0 ? <p className="rounded-xl border-2 border-dashed border-slate-200 py-8 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-300">No resolved leave requests yet.</p> : <div className="space-y-2">{resolved.map((item) => <Row key={item.id} item={item} subtitle={dates(item)} onClick={() => p.setSelectedLeaveDetail(item)}/>)}</div>}</section>
    </div>}
  </div></ModalShell>;
}

function Row({ item, subtitle, pending, onClick }: { item: LeaveRequest; subtitle: string; pending?: boolean; onClick: () => void }) { return <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-orange-300 dark:border-slate-700 dark:bg-slate-800"><span className={`grid h-9 w-9 place-items-center rounded-xl ${pending ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300' : 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300'}`}><CalendarClock size={19} strokeWidth={2.8}/></span><span className="min-w-0 flex-1"><strong className="block truncate text-xs text-slate-900 dark:text-white">{item.employee?.full_name ?? 'Unknown'}</strong><span className="text-[10px] text-slate-500 dark:text-slate-300">{subtitle}</span></span>{!pending && <span className={item.status === 'Approved' ? 'tag-present' : 'tag-late'}>{item.status}</span>}</button>; }
