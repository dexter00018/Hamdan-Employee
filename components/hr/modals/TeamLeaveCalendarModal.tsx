// @ts-nocheck
'use client';

// Presentation-only extraction of legacy dashboard JSX. The parent page remains
// the source of truth for typed state, data fetching, and mutations.
export default function TeamLeaveCalendarModal({ context }: { context: Record<string, any> }) {
  const { CalendarRange, calendarData, leaveCalendarMonth, leaveCalendarOpen, selectedCalendarDate, selectedCalendarDay, setLeaveCalendarMonth, setLeaveCalendarOpen, setSelectedCalendarDate, todayManila } = context;
  return (
    <>
        {/* TEAM LEAVE CALENDAR MODAL */}
        {leaveCalendarOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 backdrop-blur-sm p-0 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setLeaveCalendarOpen(false); }}>
            <div className="w-full max-w-4xl card-style shadow-2xl max-h-[92vh] flex flex-col !p-4 sm:!p-5" onMouseDown={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between gap-3 mb-4 flex-shrink-0">
                <div className="flex items-center gap-2.5"><span className="w-9 h-9 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center"><CalendarRange size={17}/></span><div><h3 className="mb-0 text-sm">Team Leave Calendar</h3><p className="text-[10px] text-slate-400 mt-0.5">Approved leaves and company holidays</p></div></div>
                <button type="button" onClick={() => setLeaveCalendarOpen(false)} className="text-slate-400 hover:text-slate-600" aria-label="Close leave calendar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
              </div>
              <div className="overflow-y-auto flex-1 pr-1">
                <div className="flex items-center gap-2 mb-3">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Month</label>
                  <input type="month" value={leaveCalendarMonth} onChange={(e) => { setLeaveCalendarMonth(e.target.value); setSelectedCalendarDate(null); }} className="input-field !py-1.5 !text-xs !min-h-0 !w-auto" />
                  <div className="ml-auto flex items-center gap-3 text-[9px] font-bold text-slate-400"><span><i className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1"/>Leave</span><span><i className="inline-block w-2 h-2 rounded-full bg-rose-500 mr-1"/>Holiday</span></div>
                </div>
                <div className="grid grid-cols-7 gap-1 mb-1">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day) => <div key={day} className="text-center text-[9px] font-bold uppercase text-slate-400 py-1">{day}</div>)}</div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: calendarData.blanks }).map((_, index) => <div key={`blank-${index}`} className="min-h-16 sm:min-h-20" />)}
                  {calendarData.days.map((day) => (
                    <button key={day.date} type="button" onClick={() => setSelectedCalendarDate(day.date)} className={`min-h-16 sm:min-h-20 p-1.5 rounded-xl border text-left transition ${selectedCalendarDate === day.date ? 'border-blue-400 bg-blue-50' : day.date === todayManila ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'}`}>
                      <span className="block text-[10px] font-bold text-slate-700">{day.day}</span>
                      <span className="flex gap-1 mt-1 flex-wrap">{day.leaves.length > 0 && <span className="inline-flex min-w-4 h-4 items-center justify-center rounded-full bg-blue-500 text-white text-[8px] font-bold px-1">{day.leaves.length}</span>}{day.holiday && <span className="w-2 h-2 rounded-full bg-rose-500 mt-1"/>}</span>
                    </button>
                  ))}
                </div>
                {selectedCalendarDay && (
                  <div className="mt-4 p-3 rounded-2xl border border-slate-100 bg-slate-50">
                    <p className="text-xs font-bold text-slate-900 mb-2">{new Date(`${selectedCalendarDay.date}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                    {selectedCalendarDay.holiday && <div className="p-2 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold mb-2">Holiday · {selectedCalendarDay.holiday.name}</div>}
                    {selectedCalendarDay.leaves.length === 0 ? <p className="text-xs text-slate-400">No approved leaves on this date.</p> : <div className="space-y-1.5">{selectedCalendarDay.leaves.map((leave) => <div key={leave.id} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white border border-slate-100"><span className="text-xs font-bold text-slate-800">{leave.employee?.full_name || 'Unknown'}</span><span className="text-[10px] text-blue-600 font-bold">{leave.leave_type}</span></div>)}</div>}
                    {selectedCalendarDay.leaves.length >= 3 && <p className="mt-2 text-[10px] font-bold text-orange-600">Coverage warning: {selectedCalendarDay.leaves.length} employees are on leave.</p>}
                  </div>
                )}
              </div>
              <button type="button" onClick={() => setLeaveCalendarOpen(false)} className="mt-4 w-full py-3 rounded-full bg-slate-100 text-slate-600 font-medium text-sm hover:bg-slate-200 flex-shrink-0">Close</button>
            </div>
          </div>
        )}
    </>
  );
}
