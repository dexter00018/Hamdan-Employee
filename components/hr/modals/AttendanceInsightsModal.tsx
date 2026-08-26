// @ts-nocheck
'use client';

// Presentation-only extraction of legacy dashboard JSX. The parent page remains
// the source of truth for typed state, data fetching, and mutations.
export default function AttendanceInsightsModal({ context }: { context: Record<string, any> }) {
  const { CheckCircle2, attendanceInsightMeta, attendanceInsightModal, attendanceInsightRecords, initials, setAttendanceInsightModal } = context;
  return (
    <>
        {/* CURRENT-MONTH ATTENDANCE INSIGHT RECORDS MODAL */}
        {attendanceInsightModal && attendanceInsightMeta && (
          <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/45 backdrop-blur-sm p-0 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setAttendanceInsightModal(null); }}>
            <section className="w-full max-w-md card-style shadow-2xl max-h-[85vh] flex flex-col !p-4 sm:!p-5" onMouseDown={(event) => event.stopPropagation()}>
              <div className="flex items-start justify-between gap-3 mb-4 flex-shrink-0">
                <div><h3 className={`mb-0 text-sm ${attendanceInsightMeta.tone}`}>{attendanceInsightMeta.title}</h3><p className="text-slate-400 text-[10px] mt-1">{attendanceInsightMeta.description}</p></div>
                <button type="button" onClick={() => setAttendanceInsightModal(null)} className="text-slate-400 hover:text-slate-600 transition" aria-label="Close insight records"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              </div>
              <div className="overflow-y-auto flex-1 pr-1">
                {attendanceInsightRecords.length === 0 ? (
                  <div className="py-10 px-4 rounded-2xl border-2 border-dashed border-slate-100 bg-slate-50/60 text-center"><CheckCircle2 size={22} className="mx-auto text-slate-300 mb-2"/><p className="text-slate-500 text-xs font-bold">{attendanceInsightMeta.empty}</p></div>
                ) : (
                  <div className="space-y-2">
                    {attendanceInsightRecords.map((record) => (
                      <div key={record.id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                        <span className={`w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-extrabold flex-shrink-0 ${attendanceInsightMeta.tone} bg-white`}>{initials(record.profiles?.full_name || null)}</span>
                        <span className="min-w-0 flex-1"><span className="block text-xs font-bold text-slate-900 truncate">{record.profiles?.full_name || 'Unknown employee'}</span><span className="block text-[10px] text-slate-400 mt-0.5">{record.log_date} · {record.status || 'Present'}{record.time_in ? ` · ${new Date(record.time_in).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' })}` : ''}</span></span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button type="button" onClick={() => setAttendanceInsightModal(null)} className="mt-4 w-full py-3 rounded-full bg-slate-100 text-slate-600 font-medium text-sm hover:bg-slate-200 transition flex-shrink-0">Close</button>
            </section>
          </div>
        )}
    </>
  );
}
