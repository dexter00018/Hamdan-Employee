// @ts-nocheck
'use client';

// Presentation-only extraction of legacy dashboard JSX. The parent page remains
// the source of truth for typed state, data fetching, and mutations.
export default function LeaveHistoryModal({ context }: { context: Record<string, any> }) {
  const { countLeaveDays, leaveHistoryModalOpen, leaveRequests, selectedLeaveDetail, setLeaveHistoryModalOpen, setSelectedLeaveDetail } = context;
  return (
    <>
      {/* Leave History Modal */}
      {leaveHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 backdrop-blur-sm p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-sm card-style shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-6 flex-shrink-0">
              <h3 className="mb-0">{selectedLeaveDetail ? 'Leave Details' : 'Leave History'}</h3>
              <button
                type="button"
                onClick={() => { setLeaveHistoryModalOpen(false); setSelectedLeaveDetail(null); }}
                className="text-slate-400 hover:text-slate-600 transition"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {selectedLeaveDetail ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setSelectedLeaveDetail(null)}
                    className="text-blue-600 text-xs font-bold hover:underline flex items-center gap-1 mb-2"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    Back to list
                  </button>

                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 text-sm">{selectedLeaveDetail.employee?.full_name ?? 'Unknown'}</span>
                    <span className={selectedLeaveDetail.status === 'Approved' ? 'tag-present' : 'tag-late'}>{selectedLeaveDetail.status}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                    <div>
                      <p className="label-branded mb-0.5">Leave Type</p>
                      <p className="text-slate-700 text-xs">{selectedLeaveDetail.leave_type}</p>
                    </div>
                    <div>
                      <p className="label-branded mb-0.5">Dates</p>
                      <p className="text-slate-700 text-xs">
                        {selectedLeaveDetail.start_date === selectedLeaveDetail.end_date ? selectedLeaveDetail.start_date : `${selectedLeaveDetail.start_date} → ${selectedLeaveDetail.end_date}`}
                        {' '}({countLeaveDays(selectedLeaveDetail.start_date, selectedLeaveDetail.end_date)}d)
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="label-branded mb-1">Employee&apos;s Reason</p>
                    <p className="text-slate-600 text-xs bg-slate-50 rounded-xl border border-slate-100 p-3">{selectedLeaveDetail.reason || 'No reason provided.'}</p>
                  </div>

                  <div>
                    <p className="label-branded mb-1">HR Response</p>
                    <p className="text-slate-600 text-xs bg-slate-50 rounded-xl border border-slate-100 p-3">{selectedLeaveDetail.hr_notes || 'No notes were left.'}</p>
                  </div>

                  <div className="text-slate-400 text-[10px] pt-1">
                    {selectedLeaveDetail.reviewed_at && (
                      <p>Resolved: {new Date(selectedLeaveDetail.reviewed_at).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}{selectedLeaveDetail.reviewer?.full_name ? ` by ${selectedLeaveDetail.reviewer.full_name}` : ''}</p>
                    )}
                    <p>Filed: {new Date(selectedLeaveDetail.created_at).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ) : leaveRequests.filter((l) => l.status !== 'Pending').length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl">
                  <p className="text-slate-400 text-sm font-medium">No resolved leave requests yet.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {leaveRequests.filter((l) => l.status !== 'Pending').map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setSelectedLeaveDetail(l)}
                      className="w-full flex items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition text-left"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-slate-900 text-xs">{l.employee?.full_name ?? 'Unknown'}</span>
                        <span className="text-slate-400 text-xs"> · {l.leave_type} · {l.start_date === l.end_date ? l.start_date : `${l.start_date}→${l.end_date}`} · {countLeaveDays(l.start_date, l.end_date)}d</span>
                      </div>
                      <span className={l.status === 'Approved' ? 'tag-present' : 'tag-late'}>{l.status}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => { setLeaveHistoryModalOpen(false); setSelectedLeaveDetail(null); }}
              className="mt-6 w-full py-3 rounded-full bg-slate-100 text-slate-600 font-medium text-sm hover:bg-slate-200 transition flex-shrink-0"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
