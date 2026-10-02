'use client';

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Clock3 } from 'lucide-react';
import ModalShell from '@/components/shared/ModalShell';
import { supabase } from '@/lib/supabase';

type LeaveForm = { leave_type: string; start_date: string; end_date: string; reason: string };
type Feedback = { type: 'success' | 'error'; text: string } | null;
type Transaction = { kind: 'earned' | 'used' | 'converted'; hours: number; minutes: number };
type Props = { open: boolean; onClose: () => void; fetchMyLeaves: () => void | Promise<void>; isRegular: boolean; myLeavesCount: number; remainingCredits: number; setLeaveForm: Dispatch<SetStateAction<LeaveForm>>; setLeaveModalOpen: Dispatch<SetStateAction<boolean>>; setLeaveMsg: Dispatch<SetStateAction<Feedback>>; setMyLeavesModalOpen: Dispatch<SetStateAction<boolean>>; clearSelectedLeave: () => void };

const REQUIRED_OFFSET_MINUTES = 9 * 60;

function formatOffsetMinutes(totalMinutes: number) {
  const safe = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
}

export default function LeaveChoiceModal({ open, onClose, fetchMyLeaves, isRegular, myLeavesCount, remainingCredits, setLeaveForm, setLeaveModalOpen, setLeaveMsg, setMyLeavesModalOpen, clearSelectedLeave }: Props) {
  const [offsetLoading, setOffsetLoading] = useState(false);
  const [balanceMinutes, setBalanceMinutes] = useState(0);
  const [reservedMinutes, setReservedMinutes] = useState(0);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const load = async () => {
      setOffsetLoading(true);
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) {
        if (active) setOffsetLoading(false);
        return;
      }
      const [transactionsRes, usageRes, leavesRes] = await Promise.all([
        supabase.from('offset_transactions').select('kind,hours,minutes').eq('user_id', user.id),
        supabase.from('offset_usage_requests').select('hours,required_minutes').eq('user_id', user.id).eq('status', 'Pending'),
        supabase.from('leave_requests').select('offset_minutes_required').eq('user_id', user.id).eq('funding_source', 'offset').eq('status', 'Pending'),
      ]);
      if (!active) return;
      const transactions = (transactionsRes.data || []) as Transaction[];
      const balance = transactions.reduce((total, transaction) => {
        const amount = Number(transaction.hours || 0) * 60 + Number(transaction.minutes || 0);
        return total + (transaction.kind === 'earned' ? amount : -amount);
      }, 0);
      const usageReserved = (usageRes.data || []).reduce((total: number, row: any) => total + Number(row.required_minutes ?? Number(row.hours || 0) * 60), 0);
      const leaveReserved = (leavesRes.data || []).reduce((total: number, row: any) => total + Number(row.offset_minutes_required || 0), 0);
      setBalanceMinutes(balance);
      setReservedMinutes(usageReserved + leaveReserved);
      setOffsetLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [open]);

  const availableOffsetMinutes = useMemo(() => Math.max(0, balanceMinutes - reservedMinutes), [balanceMinutes, reservedMinutes]);
  const canUseOffsetLeave = availableOffsetMinutes >= REQUIRED_OFFSET_MINUTES;

  const openRegularLeave = () => {
    onClose();
    setLeaveMsg(null);
    setLeaveForm({ leave_type: 'Sick', start_date: '', end_date: '', reason: '' });
    setLeaveModalOpen(true);
  };

  const openOffsetLeave = () => {
    if (!canUseOffsetLeave) return;
    onClose();
    window.dispatchEvent(new Event('employee:open-offset-leave'));
  };

  return <ModalShell open={open} onClose={onClose} title="Leave" description="Choose leave type" size="sm">
    <div className="space-y-3">
      <button type="button" onClick={openRegularLeave} className="flex w-full items-center gap-3 rounded-2xl bg-slate-50 p-4 text-left transition hover:bg-slate-100 dark:bg-[#303632] dark:hover:bg-[#343b36]">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-green-50 text-lg dark:bg-green-950/35">📝</div>
        <div><p className="text-sm font-bold text-slate-900 dark:text-white">Regular Leave</p><p className="mt-0.5 text-xs text-slate-400">{isRegular ? `${remainingCredits} credits left` : 'New leave request'}</p></div>
      </button>

      <button type="button" onClick={openOffsetLeave} disabled={!canUseOffsetLeave || offsetLoading} className="flex w-full items-center gap-3 rounded-2xl bg-cyan-50 p-4 text-left transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-cyan-950/25 dark:hover:bg-cyan-950/35">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white text-cyan-700 shadow-sm dark:bg-[#292f2b] dark:text-cyan-300"><Clock3 size={18}/></div>
        <div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-900 dark:text-white">Leave Using Offset</p><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{offsetLoading ? 'Checking balance…' : canUseOffsetLeave ? `${formatOffsetMinutes(availableOffsetMinutes)} available · 9h on HR approval` : `${formatOffsetMinutes(availableOffsetMinutes)} available · 9h required`}</p></div>
      </button>

      <button type="button" onClick={() => { onClose(); clearSelectedLeave(); setMyLeavesModalOpen(true); void fetchMyLeaves(); }} className="flex w-full items-center gap-3 rounded-2xl bg-slate-50 p-4 text-left transition hover:bg-slate-100 dark:bg-[#303632] dark:hover:bg-[#343b36]">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-50 text-lg dark:bg-amber-950/35">🗓️</div>
        <div><p className="text-sm font-bold text-slate-900 dark:text-white">My Leave Requests</p><p className="mt-0.5 text-xs text-slate-400">{myLeavesCount > 0 ? `${myLeavesCount} request${myLeavesCount === 1 ? '' : 's'}` : 'No requests'}</p></div>
      </button>
    </div>
    <button type="button" className="mt-6 w-full rounded-full bg-slate-100 p-3 text-sm font-medium dark:bg-slate-800 dark:text-slate-200" onClick={onClose}>Cancel</button>
  </ModalShell>;
}
