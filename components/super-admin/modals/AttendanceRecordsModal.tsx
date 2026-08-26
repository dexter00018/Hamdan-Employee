// @ts-nocheck
'use client';

// Presentation-only extraction of legacy dashboard JSX. The parent page remains
// the source of truth for typed state, data fetching, and mutations.
export default function AttendanceRecordsModal({ context }: { context: Record<string, any> }) {
  const { PAGE_SIZE, attendanceDateFilter, attendanceLoading, attendancePage, attendanceRecordsModalOpen, attendanceSearch, attendanceTotalPages, filteredAttendanceLogs, handleAttendanceDateChange, handleAttendanceSearchChange, paginatedAttendanceLogs, setAttendancePage, setAttendanceRecordsModalOpen, startEditLog, statusTagClass, todayManila } = context;
  return (
    <>
      {/* ── ATTENDANCE RECORDS MODAL ── */}
      {attendanceRecordsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 backdrop-blur-sm p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-sm card-style shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <div>
                <h3 className="mb-0">Attendance Records</h3>
                <p className="text-slate-400 text-xs mt-1">
                  {attendanceDateFilter === todayManila ? "Today's records" : attendanceDateFilter ? `Records for ${attendanceDateFilter}` : 'All records'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAttendanceRecordsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mb-3 flex-shrink-0">
              <input
                type="text"
                placeholder="Search employee..."
                value={attendanceSearch}
                onChange={(e) => handleAttendanceSearchChange(e.target.value)}
                className="input-field !py-1.5 !text-xs !min-h-0 flex-1 min-w-[140px]"
              />
              <input
                type="date"
                value={attendanceDateFilter}
                onChange={(e) => handleAttendanceDateChange(e.target.value)}
                className="input-field !py-1.5 !text-xs !min-h-0 w-auto"
              />
              <div className="flex gap-3 w-full">
                {attendanceDateFilter !== todayManila && (
                  <button
                    onClick={() => handleAttendanceDateChange(todayManila)}
                    className="text-blue-600 font-bold text-xs whitespace-nowrap"
                  >
                    Today
                  </button>
                )}
                {attendanceDateFilter && (
                  <button
                    onClick={() => handleAttendanceDateChange('')}
                    className="text-slate-400 font-bold text-xs whitespace-nowrap"
                  >
                    View All
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto flex-1 space-y-2">
              {attendanceLoading && (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={`att-skel-${i}`} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 animate-pulse">
                    <div className="flex items-center justify-between gap-2">
                      <div className="h-3.5 w-28 bg-slate-200 rounded" />
                      <div className="h-5 w-14 bg-slate-200 rounded-full" />
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <div className="h-3 w-20 bg-slate-200 rounded" />
                      <div className="h-3 w-24 bg-slate-200 rounded" />
                    </div>
                  </div>
                ))
              )}
              {!attendanceLoading &&
                paginatedAttendanceLogs.map((log) => (
                  <button
                    key={log.id}
                    type="button"
                    onClick={() => startEditLog(log)}
                    className="w-full p-3 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-slate-100 transition text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 text-sm truncate">{log.profiles?.full_name ?? '-'}</span>
                      <span className={statusTagClass(log.status)}>{log.status}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1.5">
                      <span className="text-slate-400 text-xs">
                        {log.log_date
                          ? new Date(log.log_date).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })
                          : 'N/A'}
                      </span>
                      <span className="text-slate-600 text-xs">
                        {log.time_in
                          ? new Date(log.time_in).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' })
                          : 'N/A'}
                        {' – '}
                        {log.time_out
                          ? new Date(log.time_out).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </span>
                    </div>
                  </button>
                ))}
              {!attendanceLoading && filteredAttendanceLogs.length === 0 && (
                <p className="py-8 text-center text-slate-400 text-sm">No attendance records found.</p>
              )}
            </div>

            {filteredAttendanceLogs.length > PAGE_SIZE && (
              <div className="flex items-center justify-between pt-4 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setAttendancePage((p) => Math.max(1, p - 1))}
                  disabled={attendancePage === 1}
                  className="text-xs font-bold text-blue-600 disabled:text-slate-300 disabled:cursor-not-allowed"
                >
                  ← Prev
                </button>
                <span className="text-slate-400 text-[10px] font-medium">Page {attendancePage} of {attendanceTotalPages} · {filteredAttendanceLogs.length} records</span>
                <button
                  type="button"
                  onClick={() => setAttendancePage((p) => Math.min(attendanceTotalPages, p + 1))}
                  disabled={attendancePage === attendanceTotalPages}
                  className="text-xs font-bold text-blue-600 disabled:text-slate-300 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
