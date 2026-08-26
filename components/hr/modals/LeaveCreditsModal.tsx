// @ts-nocheck
'use client';

// Presentation-only extraction of legacy dashboard JSX. The parent page remains
// the source of truth for typed state, data fetching, and mutations.
export default function LeaveCreditsModal({ context }: { context: Record<string, any> }) {
  const { fallbackLeaveCredits, leaveCreditsLoading, leaveCreditsModalOpen, setLeaveCreditsModalOpen, sortedLeaveCreditsData } = context;
  return (
    <>
      {/* LEAVE CREDITS OVERVIEW MODAL -- read-only monitoring, no manual
          adjustment. Sorted so Regular employees running lowest on
          credits surface first. */}
      {leaveCreditsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 backdrop-blur-sm p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-sm card-style shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <div>
                <h3 className="mb-0">Leave Credits</h3>
                <p className="text-slate-400 text-xs mt-1">{new Date().getFullYear()} · Regular employees only</p>
              </div>
              <button
                type="button"
                onClick={() => setLeaveCreditsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-2">
              {leaveCreditsLoading && (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={`credit-skel-${i}`} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 animate-pulse">
                    <div className="h-3.5 w-2/3 bg-slate-200 rounded mb-2" />
                    <div className="h-3 w-1/3 bg-slate-200 rounded" />
                  </div>
                ))
              )}
              {!leaveCreditsLoading && sortedLeaveCreditsData.length === 0 && (
                <p className="py-8 text-center text-slate-400 text-sm">No employees found.</p>
              )}
              {!leaveCreditsLoading && sortedLeaveCreditsData.map((e) => {
                const isRegular = e.employment_status === 'Regular';
                const total = e.total_credits ?? fallbackLeaveCredits;
                const used = e.used_credits ?? 0;
                const remaining = total - used;
                const isLow = isRegular && remaining <= 3;
                return (
                  <div key={e.id} className="flex items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 text-xs truncate">{e.full_name || 'Unknown'}</p>
                      <p className="text-slate-400 text-[10px]">{e.employee_id || '-'}</p>
                    </div>
                    {isRegular ? (
                      <span className={`text-xs font-extrabold flex-shrink-0 ${isLow ? 'text-orange-600' : 'text-slate-700'}`}>
                        {remaining} / {total}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[10px] font-medium flex-shrink-0">
                        {e.employment_status || 'Not set'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setLeaveCreditsModalOpen(false)}
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
