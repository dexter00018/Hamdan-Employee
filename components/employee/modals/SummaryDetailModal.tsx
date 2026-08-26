// @ts-nocheck
'use client';

// Presentation-only extraction of legacy dashboard JSX. The parent page remains
// the source of truth for typed state, data fetching, and mutations.
export default function SummaryDetailModal({ context }: { context: Record<string, any> }) {
  const { formatMonthLabel, setSummaryDetailType, statusTagClass, summaryCutoffKey, summaryDetailInfo, summaryDetailType } = context;
  return (
    <>
      {/* Summary Stat Detail Modal -- lists the exact dates behind the
          Present / Late / Absent number for the current cutoff. */}
      {summaryDetailType && summaryDetailInfo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 backdrop-blur-sm p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-sm card-style shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-1 flex-shrink-0">
              <h3 className="mb-0">{summaryDetailInfo.title}</h3>
              <button
                type="button"
                onClick={() => setSummaryDetailType(null)}
                className="text-slate-400 hover:text-slate-600 transition"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <p className="text-slate-400 text-xs mb-4 flex-shrink-0">{formatMonthLabel(summaryCutoffKey)}</p>

            <div className="overflow-y-auto flex-1">
              {summaryDetailInfo.logs.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl">
                  <p className="text-2xl mb-2">📋</p>
                  <p className="text-slate-400 text-sm font-medium">{summaryDetailInfo.emptyNote}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {summaryDetailInfo.logs
                    .slice()
                    .sort((a, b) => (a.log_date < b.log_date ? 1 : -1))
                    .map((log) => (
                      <div key={log.id} className="flex items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 text-xs">{new Date(log.log_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                          <div className="text-slate-400 text-[10px]">{log.log_date}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className={statusTagClass(log.status)}>{log.status}</span>
                          {log.time_in && (
                            <div className="text-slate-500 text-[10px] mt-1">
                              {new Date(log.time_in).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' })}
                              {log.time_out && <> – {new Date(log.time_out).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' })}</>}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSummaryDetailType(null)}
              className="mt-6 w-full py-3 rounded-full bg-[#edf4ef] text-[#405047] border border-[#dce7df] font-medium text-sm hover:bg-[#e1ece4] hover:text-[#253229] transition flex-shrink-0 dark:bg-[#323833] dark:text-[#dbe7de] dark:border-[#33443a] dark:hover:bg-[#3c443e] dark:hover:text-[#f2f8f3]"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
