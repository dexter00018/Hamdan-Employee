// @ts-nocheck
'use client';

// Presentation-only extraction of legacy dashboard JSX. The parent page remains
// the source of truth for typed state, data fetching, and mutations.
export default function LeaveChoiceModal({ context }: { context: Record<string, any> }) {
  const { fetchMyLeaves, isRegular, leaveChoiceModalOpen, myLeaves, remainingCredits, setLeaveChoiceModalOpen, setLeaveForm, setLeaveModalOpen, setLeaveMsg, setMyLeavesModalOpen, setSelectedMyLeaveDetail } = context;
  return (
    <>
      {/* Leave Choice Modal -- pick "Request Leave" or "My Leave Requests" */}      {/* Leave Choice Modal -- pick "Request Leave" or "My Leave Requests" */}
      {leaveChoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 backdrop-blur-sm p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-sm card-style shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <h3 className="mb-0">Leave</h3>
              <button type="button" onClick={() => setLeaveChoiceModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition" aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <p className="text-sm text-slate-400 mb-6">What would you like to do?</p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setLeaveChoiceModalOpen(false);
                  setLeaveMsg(null);
                  setLeaveForm({ leave_type: 'Sick', start_date: '', end_date: '', reason: '' });
                  setLeaveModalOpen(true);
                }}
                className="w-full flex items-center gap-3 p-4 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-slate-100 transition text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0 text-lg">📝</div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 text-sm">Request Leave</p>
                  <p className="text-slate-400 text-xs mt-0.5">{isRegular ? `${remainingCredits} credits left` : 'File a new leave request'}</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLeaveChoiceModalOpen(false);
                  setSelectedMyLeaveDetail(null);
                  setMyLeavesModalOpen(true);
                  fetchMyLeaves();
                }}
                className="w-full flex items-center gap-3 p-4 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-slate-100 transition text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0 text-lg">🗓️</div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 text-sm">My Leave Requests</p>
                  <p className="text-slate-400 text-xs mt-0.5">{myLeaves.length > 0 ? `${myLeaves.length} request${myLeaves.length === 1 ? '' : 's'}` : 'No leave requests yet'}</p>
                </div>
              </button>
            </div>

            <button
              type="button"
              className="w-full mt-6 p-3 bg-slate-100 rounded-full font-medium text-sm"
              onClick={() => setLeaveChoiceModalOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
