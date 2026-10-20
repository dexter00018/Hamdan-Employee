'use client';

// Hidden legacy intake sections for attendance disputes and leave
// requests (Requests are managed from Quick Actions; retained only as a
// non-rendered fallback).
import { CheckCircle2 } from 'lucide-react';

import { LoadingRow } from '@/components/Spinner';
import { type AttendanceDispute, type LeaveRequest } from '@/lib/types/hr';
import { disputeClaimed, disputeOriginal, disputeTypeLabel, formatPh } from './shared';

export function HrPendingRequestsSections({
  disputes,
  disputesLoading,
  disputeMsg,
  disputeActionLoadingId,
  approveDispute,
  rejectDispute,
  setSelectedDisputeDetail,
  setDisputesHistoryModalOpen,
  leaveRequests,
  leaveRequestsLoading,
  leaveMsg,
  leaveActionLoadingId,
  approveLeave,
  rejectLeave,
  countLeaveDays,
  getLeaveBalance,
  leaveHrNotes,
  setLeaveHrNotes,
  setSelectedLeaveDetail,
  setLeaveHistoryModalOpen,
}: {
  disputes: AttendanceDispute[];
  disputesLoading: boolean;
  disputeMsg: { type: 'success' | 'error'; text: string } | null;
  disputeActionLoadingId: string | null;
  approveDispute: (d: AttendanceDispute) => Promise<void>;
  rejectDispute: (d: AttendanceDispute) => Promise<void>;
  setSelectedDisputeDetail: (d: AttendanceDispute | null) => void;
  setDisputesHistoryModalOpen: (open: boolean) => void;
  leaveRequests: LeaveRequest[];
  leaveRequestsLoading: boolean;
  leaveMsg: { type: 'success' | 'error'; text: string } | null;
  leaveActionLoadingId: string | null;
  approveLeave: (l: LeaveRequest) => Promise<void>;
  rejectLeave: (l: LeaveRequest) => Promise<void>;
  countLeaveDays: (start: string, end: string) => number;
  getLeaveBalance: (userId?: string) => number | null;
  leaveHrNotes: { [id: string]: string };
  setLeaveHrNotes: (updater: (prev: { [id: string]: string }) => { [id: string]: string }) => void;
  setSelectedLeaveDetail: (l: LeaveRequest | null) => void;
  setLeaveHistoryModalOpen: (open: boolean) => void;
}) {
  return (
    <div className="hidden" aria-hidden="true">

        {/* Attendance Disputes */}
        <section id="attendance-disputes" className="card-style !p-4 scroll-mt-4">
          <h3 className="mb-3 text-sm">Attendance Disputes</h3>
          {disputeMsg && <div className={`p-2.5 rounded-xl text-xs font-bold mb-3 ${disputeMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{disputeMsg.text}</div>}
          <div className="min-h-[160px]">
          {disputesLoading ? <LoadingRow label="Loading disputes..." /> : (
            <>
              <p className="label-branded mb-2">Pending</p>
              {disputes.filter((d) => d.status === 'Pending').length === 0
                ? <div className="flex items-center gap-2 p-3 rounded-xl border border-emerald-100 bg-emerald-50/50 text-emerald-700 text-xs font-bold mb-4"><CheckCircle2 size={15}/>All caught up — no pending disputes.</div>
                : <div className="space-y-2 mb-4">
                    {disputes.filter((d) => d.status === 'Pending').map((d) => (
                      <div
                        key={d.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => { setSelectedDisputeDetail(d); setDisputesHistoryModalOpen(true); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedDisputeDetail(d); setDisputesHistoryModalOpen(true); } }}
                        className="p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-100 hover:border-slate-200 transition focus:outline-none focus:ring-2 focus:ring-blue-200"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-xs">{d.employee?.full_name ?? 'Unknown'}</p>
                            <p className="text-slate-500 text-xs mt-0.5">{disputeTypeLabel(d)} · <span className="font-medium">{d.dispute_date}</span></p>
                            {disputeOriginal(d) && <p className="text-slate-400 text-xs">Was: <span className="font-bold text-slate-600">{formatPh(disputeOriginal(d)!)}</span></p>}
                            {disputeClaimed(d) && <p className="text-slate-400 text-xs">Claimed: <span className="font-bold text-slate-600">{formatPh(disputeClaimed(d)!)}</span></p>}
                            {d.reason && <p className="text-slate-400 text-[10px] italic mt-0.5">&ldquo;{d.reason}&rdquo;</p>}
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button onClick={(e) => { e.stopPropagation(); approveDispute(d); }} disabled={disputeActionLoadingId === d.id} className="text-xs font-bold bg-green-600 text-white px-3 py-1.5 rounded-full hover:bg-green-700 transition disabled:opacity-50">{disputeActionLoadingId === d.id ? '...' : 'Approve'}</button>
                            <button onClick={(e) => { e.stopPropagation(); rejectDispute(d); }} disabled={disputeActionLoadingId === d.id} className="text-xs font-bold bg-slate-200 text-slate-700 px-3 py-1.5 rounded-full hover:bg-slate-300 transition disabled:opacity-50">Reject</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
              }
              <p className="label-branded mb-2">Resolved</p>
              <button
                type="button"
                onClick={() => setDisputesHistoryModalOpen(true)}
                className="w-full flex items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition text-left"
              >
                <span className="text-slate-600 text-xs font-bold">View dispute history</span>
                <span className="text-slate-400 text-xs">{disputes.filter((d) => d.status !== 'Pending').length} resolved</span>
              </button>
            </>
          )}
          </div>
        </section>

        {/* Leave Requests */}
        <section id="leave-requests" className="card-style !p-4 scroll-mt-4">
          <h3 className="mb-3 text-sm">Leave Requests</h3>
          {leaveMsg && <div className={`p-2.5 rounded-xl text-xs font-bold mb-3 ${leaveMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{leaveMsg.text}</div>}
          <div className="min-h-[160px]">
          {leaveRequestsLoading ? <LoadingRow label="Loading leave requests..." /> : (
            <>
              <p className="label-branded mb-2">Pending</p>
              {leaveRequests.filter((l) => l.status === 'Pending').length === 0
                ? <div className="flex items-center gap-2 p-3 rounded-xl border border-emerald-100 bg-emerald-50/50 text-emerald-700 text-xs font-bold mb-4"><CheckCircle2 size={15}/>All caught up — no pending leave requests.</div>
                : <div className="space-y-2 mb-4">
                    {leaveRequests.filter((l) => l.status === 'Pending').map((l) => (
                      <div
                        key={l.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => { setSelectedLeaveDetail(l); setLeaveHistoryModalOpen(true); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedLeaveDetail(l); setLeaveHistoryModalOpen(true); } }}
                        className="p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-100 hover:border-slate-200 transition focus:outline-none focus:ring-2 focus:ring-blue-200"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-xs">{l.employee?.full_name ?? 'Unknown'}</p>
                            <p className="text-slate-500 text-xs mt-0.5"><span className="font-semibold">{l.leave_type}</span> · {l.start_date === l.end_date ? l.start_date : `${l.start_date} → ${l.end_date}`} · {countLeaveDays(l.start_date, l.end_date)} chargeable working day{countLeaveDays(l.start_date, l.end_date) === 1 ? '' : 's'}</p>
                            {getLeaveBalance(l.employee?.id) !== null && (
                              <p className={`text-[10px] font-bold mt-1 ${countLeaveDays(l.start_date, l.end_date) > Number(getLeaveBalance(l.employee?.id)) ? 'text-rose-600' : 'text-emerald-600'}`}>
                                Balance: {getLeaveBalance(l.employee?.id)} → estimated {Number(getLeaveBalance(l.employee?.id)) - countLeaveDays(l.start_date, l.end_date)} after approval
                              </p>
                            )}
                            {l.reason && <p className="text-slate-400 text-[10px] italic mt-0.5">&ldquo;{l.reason}&rdquo;</p>}
                            <input type="text" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} className="input-field !py-1.5 !text-xs !min-h-0 mt-1.5" placeholder="HR notes (optional)..." value={leaveHrNotes[l.id] ?? ''} onChange={(e) => setLeaveHrNotes((prev) => ({ ...prev, [l.id]: e.target.value }))} />
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button onClick={(e) => { e.stopPropagation(); approveLeave(l); }} disabled={leaveActionLoadingId === l.id} className="text-xs font-bold bg-green-600 text-white px-3 py-1.5 rounded-full hover:bg-green-700 transition disabled:opacity-50">{leaveActionLoadingId === l.id ? '...' : 'Approve'}</button>
                            <button onClick={(e) => { e.stopPropagation(); rejectLeave(l); }} disabled={leaveActionLoadingId === l.id} className="text-xs font-bold bg-slate-200 text-slate-700 px-3 py-1.5 rounded-full hover:bg-slate-300 transition disabled:opacity-50">Reject</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
              }
              <p className="label-branded mb-2">Resolved</p>
              <button
                type="button"
                onClick={() => setLeaveHistoryModalOpen(true)}
                className="w-full flex items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition text-left"
              >
                <span className="text-slate-600 text-xs font-bold">View leave history</span>
                <span className="text-slate-400 text-xs">{leaveRequests.filter((l) => l.status !== 'Pending').length} resolved</span>
              </button>
            </>
          )}
          </div>
        </section>

        </div>
  );
}

export default HrPendingRequestsSections;
