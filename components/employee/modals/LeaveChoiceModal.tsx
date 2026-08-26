'use client';

import type { Dispatch, SetStateAction } from 'react';
import ModalShell from '@/components/shared/ModalShell';

type LeaveForm = { leave_type: string; start_date: string; end_date: string; reason: string };
type Feedback = { type: 'success' | 'error'; text: string } | null;
type Props = { open: boolean; onClose: () => void; fetchMyLeaves: () => void | Promise<void>; isRegular: boolean; myLeavesCount: number; remainingCredits: number; setLeaveForm: Dispatch<SetStateAction<LeaveForm>>; setLeaveModalOpen: Dispatch<SetStateAction<boolean>>; setLeaveMsg: Dispatch<SetStateAction<Feedback>>; setMyLeavesModalOpen: Dispatch<SetStateAction<boolean>>; clearSelectedLeave: () => void };

export default function LeaveChoiceModal({ open, onClose, fetchMyLeaves, isRegular, myLeavesCount, remainingCredits, setLeaveForm, setLeaveModalOpen, setLeaveMsg, setMyLeavesModalOpen, clearSelectedLeave }: Props) {
  return <ModalShell open={open} onClose={onClose} title="Leave" description="What would you like to do?" size="sm">
    <div className="space-y-3"><button type="button" onClick={() => { onClose(); setLeaveMsg(null); setLeaveForm({ leave_type: 'Sick', start_date: '', end_date: '', reason: '' }); setLeaveModalOpen(true); }} className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left hover:bg-slate-100"><div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-green-50 text-lg">📝</div><div><p className="text-sm font-bold text-slate-900">Request Leave</p><p className="mt-0.5 text-xs text-slate-400">{isRegular ? `${remainingCredits} credits left` : 'File a new leave request'}</p></div></button><button type="button" onClick={() => { onClose(); clearSelectedLeave(); setMyLeavesModalOpen(true); void fetchMyLeaves(); }} className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left hover:bg-slate-100"><div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-50 text-lg">🗓️</div><div><p className="text-sm font-bold text-slate-900">My Leave Requests</p><p className="mt-0.5 text-xs text-slate-400">{myLeavesCount > 0 ? `${myLeavesCount} request${myLeavesCount === 1 ? '' : 's'}` : 'No leave requests yet'}</p></div></button></div>
    <button type="button" className="mt-6 w-full rounded-full bg-slate-100 p-3 text-sm font-medium" onClick={onClose}>Cancel</button>
  </ModalShell>;
}
