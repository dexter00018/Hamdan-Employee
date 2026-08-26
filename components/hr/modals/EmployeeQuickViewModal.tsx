// @ts-nocheck
'use client';

// Presentation-only extraction of legacy dashboard JSX. The parent page remains
// the source of truth for typed state, data fetching, and mutations.
export default function EmployeeQuickViewModal({ context }: { context: Record<string, any> }) {
  const { fallbackLeaveCredits, formatPh, initials, openPayslipsModal, openProfileChoice, quickViewAttendance, quickViewCredits, quickViewProfile, scrollToDashboardSection, setAttendanceHistoryOpen, setCutoffFilter, setQuickViewProfile, setSearchTerm, setSelectedDate, statusTagClass, todayManila } = context;
  return (
    <>
        {/* EMPLOYEE QUICK VIEW MODAL */}
        {quickViewProfile && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/45 backdrop-blur-sm p-0 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setQuickViewProfile(null); }}>
            <div className="w-full max-w-xl card-style shadow-2xl max-h-[90vh] flex flex-col !p-4 sm:!p-5" onMouseDown={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between gap-3 mb-4 flex-shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-11 h-11 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-extrabold overflow-hidden flex-shrink-0">
                    {initials(quickViewProfile.full_name)}
                  </span>
                  <span className="min-w-0"><span className="block text-sm font-bold text-slate-900 truncate">{quickViewProfile.full_name || 'Unknown'}</span><span className="block text-[10px] text-slate-400 truncate">{quickViewProfile.employee_id || 'No ID'} · {quickViewProfile.designation || 'No designation'}</span></span>
                </div>
                <button type="button" onClick={() => setQuickViewProfile(null)} className="text-slate-400 hover:text-slate-600" aria-label="Close employee quick view">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              <div className="overflow-y-auto flex-1 pr-1 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100"><p className="label-branded mb-1">Today</p><p className="text-xs font-bold text-slate-800">{quickViewAttendance.find((log) => log.log_date === todayManila)?.status || 'No record'}</p></div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100"><p className="label-branded mb-1">Time In</p><p className="text-xs font-bold text-slate-800">{quickViewAttendance.find((log) => log.log_date === todayManila)?.time_in ? formatPh(quickViewAttendance.find((log) => log.log_date === todayManila)!.time_in as string) : '-'}</p></div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100"><p className="label-branded mb-1">Employment</p><p className="text-xs font-bold text-slate-800">{quickViewCredits?.employment_status || 'Not set'}</p></div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100"><p className="label-branded mb-1">Leave Credits</p><p className="text-xs font-bold text-slate-800">{quickViewCredits?.employment_status === 'Regular' ? `${(quickViewCredits.total_credits ?? fallbackLeaveCredits) - (quickViewCredits.used_credits ?? 0)} remaining` : 'N/A'}</p></div>
                </div>

                <div>
                  <p className="label-branded mb-2">Recent Attendance</p>
                  {quickViewAttendance.length === 0 ? (
                    <p className="p-4 text-center text-xs text-slate-400 rounded-xl border-2 border-dashed border-slate-100">No attendance records yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {quickViewAttendance.map((log) => (
                        <div key={log.id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="text-xs font-medium text-slate-700">{log.log_date}</span>
                          <span className="text-[10px] text-slate-500">{log.time_in ? formatPh(log.time_in) : '-'} → {log.time_out ? formatPh(log.time_out) : 'No time-out'}</span>
                          <span className={statusTagClass(log.status)}>{log.status || '-'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-4 flex-shrink-0">
                <button type="button" onClick={() => { const profile = quickViewProfile; if (!profile) return; setQuickViewProfile(null); openProfileChoice(profile); }} className="py-2.5 rounded-full bg-slate-900 text-white text-[10px] font-bold hover:bg-slate-700">Profile</button>
                <button type="button" onClick={() => { setSearchTerm(quickViewProfile?.full_name || ''); setSelectedDate(''); setCutoffFilter(''); setAttendanceHistoryOpen(true); setQuickViewProfile(null); scrollToDashboardSection('attendance-history'); }} className="py-2.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold hover:bg-blue-100">Attendance</button>
                <button type="button" onClick={() => { const profile = quickViewProfile; if (!profile) return; setQuickViewProfile(null); openPayslipsModal(profile); }} className="py-2.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold hover:bg-emerald-100">Payslips</button>
              </div>
            </div>
          </div>
        )}
    </>
  );
}
