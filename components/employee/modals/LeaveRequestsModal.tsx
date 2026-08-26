'use client';

import type { Dispatch, SetStateAction } from 'react';
import ModalShell from '@/components/shared/ModalShell';

type Leave = { id: string; status: string; leave_type: string; start_date: string; end_date: string; reason?: string | null; hr_notes?: string | null; reviewed_at?: string | null; created_at: string };
type Props = { open: boolean; onClose: () => void; onBackToChoice: () => void; cancelLeave: (id: string) => void | Promise<void>; countLeaveDays: (start: string, end: string) => number; myLeaves: Leave[]; selectedMyLeaveDetail: Leave | null; setSelectedMyLeaveDetail: Dispatch<SetStateAction<Leave | null>> };

export default function LeaveRequestsModal({ open, onClose, onBackToChoice, cancelLeave, countLeaveDays, myLeaves, selectedMyLeaveDetail, setSelectedMyLeaveDetail }: Props) {
  const close = () => { setSelectedMyLeaveDetail(null); onClose(); };
  return (
    <ModalShell open={open} onClose={close} title={selectedMyLeaveDetail ? 'Leave Details' : 'My Leave Requests'} size="sm">
            <div className="overflow-y-auto flex-1">
              {selectedMyLeaveDetail ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setSelectedMyLeaveDetail(null)}
                    className="text-blue-600 text-xs font-bold hover:underline flex items-center gap-1 mb-2"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    Back to list
                  </button>

                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 text-sm">{selectedMyLeaveDetail.leave_type} Leave</span>
                    <span className={selectedMyLeaveDetail.status === 'Approved' ? 'tag-present' : selectedMyLeaveDetail.status === 'Rejected' ? 'tag-late' : 'tag-excused'}>{selectedMyLeaveDetail.status}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                    <div>
                      <p className="label-branded mb-0.5">Dates</p>
                      <p className="text-slate-700 text-xs">
                        {selectedMyLeaveDetail.start_date === selectedMyLeaveDetail.end_date ? selectedMyLeaveDetail.start_date : `${selectedMyLeaveDetail.start_date} → ${selectedMyLeaveDetail.end_date}`}
                        {' '}({countLeaveDays(selectedMyLeaveDetail.start_date, selectedMyLeaveDetail.end_date)}d)
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="label-branded mb-1">Your Reason</p>
                    <p className="text-slate-600 text-xs bg-slate-50 rounded-xl border border-slate-100 p-3">{selectedMyLeaveDetail.reason || 'No reason provided.'}</p>
                  </div>

                  <div>
                    <p className="label-branded mb-1">HR Response</p>
                    <p className="text-slate-600 text-xs bg-slate-50 rounded-xl border border-slate-100 p-3">{selectedMyLeaveDetail.hr_notes || 'No notes were left.'}</p>
                  </div>

                  <div className="text-slate-400 text-[10px] pt-1">
                    {selectedMyLeaveDetail.reviewed_at && (
                      <p>Resolved: {new Date(selectedMyLeaveDetail.reviewed_at).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    )}
                    <p>Filed: {new Date(selectedMyLeaveDetail.created_at).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>

                  {selectedMyLeaveDetail.status === 'Pending' && (
                    <button
                      onClick={() => { cancelLeave(selectedMyLeaveDetail.id); setSelectedMyLeaveDetail(null); }}
                      className="w-full py-2.5 rounded-full bg-rose-50 text-rose-600 text-xs font-bold hover:bg-rose-100 transition"
                    >
                      Cancel This Request
                    </button>
                  )}
                </div>
              ) : myLeaves.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl">
                  <p className="text-2xl mb-2">🗓️</p>
                  <p className="text-slate-400 text-sm font-medium">No leave requests yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {myLeaves.map((l) => (
                    <div key={l.id} className="w-full flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition">
                      <button type="button" onClick={() => setSelectedMyLeaveDetail(l)} className="min-w-0 flex-1 text-left">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900 text-xs">{l.leave_type} Leave</span>
                          <span className={l.status === 'Approved' ? 'tag-present' : l.status === 'Rejected' ? 'tag-late' : 'tag-excused'}>{l.status}</span>
                        </div>
                        <div className="text-slate-400 text-[10px] mt-0.5">{l.start_date === l.end_date ? l.start_date : `${l.start_date} → ${l.end_date}`} · {countLeaveDays(l.start_date, l.end_date)}d</div>
                      </button>
                      {l.status === 'Pending' && (
                        <button
                          type="button"
                          onClick={() => cancelLeave(l.id)}
                          className="text-rose-500 hover:text-rose-700 text-xs font-bold flex-shrink-0"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                if (selectedMyLeaveDetail) {
                  setSelectedMyLeaveDetail(null);
                } else {
                  onBackToChoice();
                }
              }}
              className="mt-6 w-full py-3 rounded-full bg-slate-100 text-slate-600 font-medium text-sm hover:bg-slate-200 transition flex-shrink-0"
            >
              ← Back
            </button>
    </ModalShell>
  );
}
