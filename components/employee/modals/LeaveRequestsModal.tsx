'use client';

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import ModalShell from '@/components/shared/ModalShell';
import { supabase } from '@/lib/supabase';

type Leave = { id: string; status: string; leave_type: string; start_date: string; end_date: string; reason?: string | null; hr_notes?: string | null; reviewed_at?: string | null; created_at: string };
type LeaveFunding = { funding_source: 'leave_credit' | 'offset'; offset_minutes_required: number; offset_charged_at: string | null; offset_refunded_at: string | null };
type Props = { open: boolean; onClose: () => void; onBackToChoice: () => void; cancelLeave: (id: string) => void | Promise<void>; countLeaveDays: (start: string, end: string) => number; myLeaves: Leave[]; selectedMyLeaveDetail: Leave | null; setSelectedMyLeaveDetail: Dispatch<SetStateAction<Leave | null>> };

export default function LeaveRequestsModal({ open, onClose, onBackToChoice, cancelLeave, countLeaveDays, myLeaves, selectedMyLeaveDetail, setSelectedMyLeaveDetail }: Props) {
  const [fundingById, setFundingById] = useState<Record<string, LeaveFunding>>({});
  const [cancelledOffsetIds, setCancelledOffsetIds] = useState<Set<string>>(new Set());
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const leaveIdsKey = useMemo(() => myLeaves.map((leave) => leave.id).sort().join(','), [myLeaves]);

  useEffect(() => {
    if (!open || myLeaves.length === 0) return;
    let active = true;
    const loadFunding = async () => {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('id,funding_source,offset_minutes_required,offset_charged_at,offset_refunded_at')
        .in('id', myLeaves.map((leave) => leave.id));
      if (!active || error) return;
      const next: Record<string, LeaveFunding> = {};
      for (const row of data || []) next[String(row.id)] = row as LeaveFunding;
      setFundingById(next);
    };
    void loadFunding();
    return () => { active = false; };
  }, [open, leaveIdsKey, myLeaves]);

  const close = () => { setSelectedMyLeaveDetail(null); setMessage(null); onClose(); };

  const effectiveStatus = (leave: Leave) => cancelledOffsetIds.has(leave.id) ? 'Cancelled' : leave.status;
  const isOffsetLeave = (leave: Leave) => fundingById[leave.id]?.funding_source === 'offset';
  const canCancel = (leave: Leave) => {
    const status = effectiveStatus(leave);
    if (isOffsetLeave(leave)) return status === 'Pending' || status === 'Approved';
    return status === 'Pending';
  };

  const handleCancel = async (leave: Leave) => {
    if (!isOffsetLeave(leave)) {
      await cancelLeave(leave.id);
      return;
    }

    setCancellingId(leave.id);
    setMessage(null);
    const { error } = await supabase.rpc('cancel_my_offset_leave', { p_request_id: leave.id });
    if (error) {
      setMessage({ type: 'error', text: error.message || 'Unable to cancel this offset-funded leave.' });
      setCancellingId(null);
      return;
    }

    setCancelledOffsetIds((current) => new Set([...current, leave.id]));
    setMessage({ type: 'success', text: effectiveStatus(leave) === 'Approved' ? 'Leave cancelled. The 9 offset hours were automatically refunded.' : 'Leave cancelled. The reserved 9 offset hours are available again.' });
    setCancellingId(null);
    window.dispatchEvent(new Event('employee:offset-data-changed'));
  };

  const statusClass = (status: string) => status === 'Approved' ? 'tag-present' : status === 'Rejected' || status === 'Cancelled' ? 'tag-late' : 'tag-excused';

  return (
    <ModalShell open={open} onClose={close} title={selectedMyLeaveDetail ? 'Leave Details' : 'My Leave Requests'} size="sm">
      <div className="overflow-y-auto flex-1">
        {message && <div className={`mb-3 rounded-xl px-3 py-2 text-xs font-medium ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/35 dark:text-rose-300'}`}>{message.text}</div>}

        {selectedMyLeaveDetail ? (
          <div className="space-y-3">
            <button type="button" onClick={() => setSelectedMyLeaveDetail(null)} className="text-blue-600 text-xs font-bold hover:underline flex items-center gap-1 mb-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              Back to list
            </button>

            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="font-bold text-slate-900 text-sm dark:text-white">{selectedMyLeaveDetail.leave_type} Leave</span>
                {isOffsetLeave(selectedMyLeaveDetail) && <p className="mt-0.5 text-[10px] font-semibold text-cyan-700 dark:text-cyan-300">Leave Using Offset · 9h</p>}
              </div>
              <span className={statusClass(effectiveStatus(selectedMyLeaveDetail))}>{effectiveStatus(selectedMyLeaveDetail)}</span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl space-y-2 dark:bg-[#303632]">
              <div>
                <p className="label-branded mb-0.5">Dates</p>
                <p className="text-slate-700 text-xs dark:text-slate-300">
                  {selectedMyLeaveDetail.start_date === selectedMyLeaveDetail.end_date ? selectedMyLeaveDetail.start_date : `${selectedMyLeaveDetail.start_date} → ${selectedMyLeaveDetail.end_date}`}
                  {' '}({countLeaveDays(selectedMyLeaveDetail.start_date, selectedMyLeaveDetail.end_date)}d)
                </p>
              </div>
              {isOffsetLeave(selectedMyLeaveDetail) && (
                <div>
                  <p className="label-branded mb-0.5">Offset Funding</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {fundingById[selectedMyLeaveDetail.id]?.offset_refunded_at ? '9 hours refunded after cancellation.' : fundingById[selectedMyLeaveDetail.id]?.offset_charged_at ? '9 hours deducted after final HR approval.' : '9 hours reserved; no deduction until final HR approval.'}
                  </p>
                </div>
              )}
            </div>

            <div><p className="label-branded mb-1">Your Reason</p><p className="text-slate-600 text-xs bg-slate-50 rounded-xl p-3 dark:bg-[#303632] dark:text-slate-300">{selectedMyLeaveDetail.reason || 'No reason provided.'}</p></div>
            <div><p className="label-branded mb-1">HR Response</p><p className="text-slate-600 text-xs bg-slate-50 rounded-xl p-3 dark:bg-[#303632] dark:text-slate-300">{selectedMyLeaveDetail.hr_notes || 'No notes were left.'}</p></div>

            <div className="text-slate-400 text-[10px] pt-1">
              {selectedMyLeaveDetail.reviewed_at && <p>Resolved: {new Date(selectedMyLeaveDetail.reviewed_at).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>}
              <p>Filed: {new Date(selectedMyLeaveDetail.created_at).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            </div>

            {canCancel(selectedMyLeaveDetail) && (
              <button disabled={cancellingId === selectedMyLeaveDetail.id} onClick={async () => { await handleCancel(selectedMyLeaveDetail); setSelectedMyLeaveDetail(null); }} className="w-full py-2.5 rounded-full bg-rose-50 text-rose-600 text-xs font-bold hover:bg-rose-100 transition disabled:opacity-45 dark:bg-rose-950/30 dark:text-rose-300">
                {cancellingId === selectedMyLeaveDetail.id ? 'Cancelling…' : isOffsetLeave(selectedMyLeaveDetail) && effectiveStatus(selectedMyLeaveDetail) === 'Approved' ? 'Cancel & Refund 9h' : 'Cancel This Request'}
              </button>
            )}
          </div>
        ) : myLeaves.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl dark:border-slate-700"><p className="text-2xl mb-2">🗓️</p><p className="text-slate-400 text-sm font-medium">No leave requests yet</p></div>
        ) : (
          <div className="space-y-2">
            {myLeaves.map((leave) => (
              <div key={leave.id} className="w-full flex items-center gap-2 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition dark:bg-[#303632] dark:hover:bg-[#343b36]">
                <button type="button" onClick={() => setSelectedMyLeaveDetail(leave)} className="min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900 text-xs dark:text-white">{leave.leave_type} Leave</span>
                    {isOffsetLeave(leave) && <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[9px] font-bold text-cyan-700 dark:bg-cyan-950/35 dark:text-cyan-300">OFFSET 9H</span>}
                    <span className={statusClass(effectiveStatus(leave))}>{effectiveStatus(leave)}</span>
                  </div>
                  <div className="text-slate-400 text-[10px] mt-0.5">{leave.start_date === leave.end_date ? leave.start_date : `${leave.start_date} → ${leave.end_date}`} · {countLeaveDays(leave.start_date, leave.end_date)}d</div>
                </button>
                {canCancel(leave) && (
                  <button type="button" disabled={cancellingId === leave.id} onClick={() => void handleCancel(leave)} className="text-rose-500 hover:text-rose-700 text-xs font-bold flex-shrink-0 disabled:opacity-45">
                    {cancellingId === leave.id ? '…' : isOffsetLeave(leave) && effectiveStatus(leave) === 'Approved' ? 'Cancel + Refund' : 'Cancel'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <button type="button" onClick={() => { if (selectedMyLeaveDetail) setSelectedMyLeaveDetail(null); else onBackToChoice(); }} className="mt-6 w-full py-3 rounded-full bg-slate-100 text-slate-600 font-medium text-sm hover:bg-slate-200 transition flex-shrink-0 dark:bg-slate-800 dark:text-slate-200">← Back</button>
    </ModalShell>
  );
}
