// @ts-nocheck
'use client';

// Presentation-only extraction of legacy dashboard JSX. The parent page remains
// the source of truth for typed state, data fetching, and mutations.
export default function DailyOverviewModal({ context }: { context: Record<string, any> }) {
  const { CheckCircle2, dailyOverviewMeta, dailyOverviewModal, dailyOverviewRecords, initials, setDailyOverviewModal } = context;
  return (
    <>
        {/* DAILY OVERVIEW RECORDS MODAL */}
        {dailyOverviewModal && dailyOverviewMeta && (
          <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/45 backdrop-blur-sm p-0 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setDailyOverviewModal(null); }}>
            <section className="w-full max-w-md card-style shadow-2xl max-h-[85vh] flex flex-col !p-4 sm:!p-5" onMouseDown={(event) => event.stopPropagation()}>
              <div className="flex items-start justify-between gap-3 mb-4 flex-shrink-0">
                <div>
                  <h3 className={`mb-0 text-sm ${dailyOverviewMeta.tone}`}>{dailyOverviewMeta.title}</h3>
                  <p className="text-slate-400 text-[10px] mt-1">{dailyOverviewMeta.description}</p>
                </div>
                <button type="button" onClick={() => setDailyOverviewModal(null)} className="text-slate-400 hover:text-slate-600 transition" aria-label="Close daily records">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              <div className="overflow-y-auto flex-1 pr-1">
                {dailyOverviewRecords.length === 0 ? (
                  <div className="py-10 px-4 rounded-2xl border-2 border-dashed border-slate-100 bg-slate-50/60 text-center">
                    <CheckCircle2 size={22} className="mx-auto text-slate-300 mb-2"/>
                    <p className="text-slate-500 text-xs font-bold">{dailyOverviewMeta.empty}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dailyOverviewRecords.map((record: any) => {
                      const isAttendance = dailyOverviewModal === 'present' || dailyOverviewModal === 'late';
                      const isLeave = dailyOverviewModal === 'leave';
                      const name = isAttendance ? record.profiles?.full_name : isLeave ? record.employee?.full_name : record.full_name;
                      const detail = isAttendance
                        ? `${record.time_in ? new Date(record.time_in).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }) : 'No time'} · ${record.status || 'Present'}`
                        : isLeave
                          ? `${record.leave_type} · ${record.start_date === record.end_date ? record.start_date : `${record.start_date} → ${record.end_date}`}`
                          : `${record.employee_id || 'No employee ID'} · ${record.designation || 'No designation'}`;
                      return (
                        <div key={record.id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                          <span className={`w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-extrabold flex-shrink-0 ${dailyOverviewModal === 'late' ? 'bg-orange-50 text-orange-600' : dailyOverviewModal === 'leave' ? 'bg-blue-50 text-blue-600' : dailyOverviewModal === 'notTimedIn' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>{initials(name || null)}</span>
                          <span className="min-w-0"><span className="block text-xs font-bold text-slate-900 truncate">{name || 'Unknown employee'}</span><span className="block text-[10px] text-slate-400 mt-0.5 truncate">{detail}</span></span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <button type="button" onClick={() => setDailyOverviewModal(null)} className="mt-4 w-full py-3 rounded-full bg-slate-100 text-slate-600 font-medium text-sm hover:bg-slate-200 transition flex-shrink-0">Close</button>
            </section>
          </div>
        )}
    </>
  );
}
