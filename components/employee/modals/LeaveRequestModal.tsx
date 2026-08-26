// @ts-nocheck
'use client';

// Presentation-only extraction of legacy dashboard JSX. The parent page remains
// the source of truth for typed state, data fetching, and mutations.
export default function LeaveRequestModal({ context }: { context: Record<string, any> }) {
  const { Spinner, countLeaveDays, countLeaveHolidays, fallbackLeaveCredits, isRegular, leaveCredits, leaveForm, leaveModalOpen, leaveMsg, leaveSaving, remainingCredits, setLeaveChoiceModalOpen, setLeaveForm, setLeaveModalOpen, submitLeave, todayManila, upcomingApprovedLeaves } = context;
  return (
    <>
      {/* Leave Request Modal */}
      {leaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 backdrop-blur-sm p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-sm card-style shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="mb-0">File a Leave Request</h3>
              <button type="button" onClick={() => setLeaveModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition" aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Credits badge for Regular employees */}
            {isRegular && (
              <div className={`flex items-center justify-between p-3 rounded-xl mb-4 ${remainingCredits <= 3 ? 'bg-orange-50 border border-orange-100' : 'bg-green-50 border border-green-100'}`}>
                <p className={`text-xs font-bold ${remainingCredits <= 3 ? 'text-orange-700' : 'text-green-700'}`}>
                  Leave Credits ({new Date().getFullYear()})
                </p>
                <p className={`text-sm font-extrabold ${remainingCredits <= 3 ? 'text-orange-700' : 'text-green-700'}`}>
                  {remainingCredits} / {leaveCredits?.total_credits ?? fallbackLeaveCredits} remaining
                </p>
              </div>
            )}

            {upcomingApprovedLeaves.length > 0 && (
              <div className="p-3 rounded-xl mb-4 bg-blue-50 border border-blue-100">
                <p className="text-blue-700 text-[10px] font-extrabold uppercase tracking-wide mb-2">Upcoming approved leave</p>
                <div className="space-y-1.5">
                  {upcomingApprovedLeaves.map((leave) => (
                    <div key={leave.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-slate-700">{leave.leave_type}</span>
                      <span className="text-slate-500">{leave.start_date}{leave.end_date !== leave.start_date ? ` – ${leave.end_date}` : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isRegular && (
              <div className="flex items-start gap-2 p-3 rounded-xl mb-4 bg-sky-50 border border-sky-100">
                <p className="text-xs text-sky-700 font-medium">ℹ️ Leave credits apply to Regular employees only. Your request will still be reviewed by HR.</p>
              </div>
            )}

            {leaveMsg && (
              <div className={`p-3 rounded-xl text-sm font-bold mb-4 ${leaveMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {leaveMsg.text}
              </div>
            )}

            <label className="label-branded">Leave Type</label>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {(['Sick', 'Vacation', 'Emergency'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setLeaveForm({ ...leaveForm, leave_type: t })}
                  className={`py-2.5 rounded-full text-xs font-bold transition border ${leaveForm.leave_type === t ? 'bg-[#17211b] text-white border-[#17211b] dark:bg-[#e5eee7] dark:text-[#17211b] dark:border-[#c9d9cc]' : 'bg-[#eef3ef] text-[#526054] border-transparent hover:bg-[#e2ebe4] dark:bg-[#303631] dark:text-[#c7d5ca] dark:hover:bg-[#29382f]'}`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Start/End Date -- no `min` restriction to today anymore, so
                past dates can be filed retroactively (e.g. forgot to file
                before a day already tagged "Absent" by the overnight
                sweep). Once HR approves, settle_overdue_leave_days() will
                flip that Absent tag to the specific leave type filed here. */}
            <label className="label-branded">Start Date</label>
            <input
              type="date"
              className="input-field mb-3"
              value={leaveForm.start_date}
              onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value, end_date: e.target.value })}
            />

            <label className="label-branded">End Date</label>
            <input
              type="date"
              className="input-field mb-3"
              value={leaveForm.end_date}
              onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
              min={leaveForm.start_date || undefined}
            />

            {leaveForm.start_date && leaveForm.end_date && (
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 mb-3">
                <p className="text-slate-700 text-xs font-bold">
                  📅 {countLeaveDays(leaveForm.start_date, leaveForm.end_date)} chargeable working day{countLeaveDays(leaveForm.start_date, leaveForm.end_date) === 1 ? '' : 's'}
                </p>
                <p className="text-slate-400 text-[10px] mt-1">
                  Weekends and company holidays are excluded.
                  {countLeaveHolidays(leaveForm.start_date, leaveForm.end_date) > 0 && ` ${countLeaveHolidays(leaveForm.start_date, leaveForm.end_date)} holiday${countLeaveHolidays(leaveForm.start_date, leaveForm.end_date) === 1 ? '' : 's'} excluded.`}
                </p>
                {isRegular && (
                  <p className={`text-[10px] font-bold mt-1 ${remainingCredits - countLeaveDays(leaveForm.start_date, leaveForm.end_date) < 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    Estimated balance after approval: {remainingCredits - countLeaveDays(leaveForm.start_date, leaveForm.end_date)} credit{Math.abs(remainingCredits - countLeaveDays(leaveForm.start_date, leaveForm.end_date)) === 1 ? '' : 's'}
                  </p>
                )}
                {leaveForm.start_date < todayManila && (
                  <p className="text-blue-600 text-[10px] font-bold mt-1">Filing for a past date</p>
                )}
                {isRegular && remainingCredits < countLeaveDays(leaveForm.start_date, leaveForm.end_date) && (
                  <p className="text-orange-600 text-[10px] font-bold mt-1">⚠️ This request exceeds your remaining credits.</p>
                )}
              </div>
            )}

            <label className="label-branded">Reason (optional)</label>
            <textarea
              className="input-field mb-6 min-h-[72px] resize-y"
              value={leaveForm.reason}
              onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
              placeholder="e.g. Medical appointment, family emergency..."
            />

            <div className="flex gap-3">
              <button
                type="button"
                className="flex-1 p-3 bg-slate-100 rounded-full font-medium text-sm"
                onClick={() => { setLeaveModalOpen(false); setLeaveChoiceModalOpen(true); }}
              >
                ← Back
              </button>
              <button
                type="button"
                className="flex-1 btn-primary disabled:opacity-50"
                onClick={submitLeave}
                disabled={leaveSaving || !leaveForm.start_date || !leaveForm.end_date}
              >
                {leaveSaving ? <span className="flex items-center justify-center gap-2"><Spinner size="sm" />Submitting...</span> : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
