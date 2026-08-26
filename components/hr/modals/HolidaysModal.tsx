// @ts-nocheck
'use client';

// Presentation-only extraction of legacy dashboard JSX. The parent page remains
// the source of truth for typed state, data fetching, and mutations.
export default function HolidaysModal({ context }: { context: Record<string, any> }) {
  const { CalendarRange, LoadingRow, Spinner, addHoliday, deleteHoliday, holidayMsg, holidaySaving, holidays, holidaysLoading, holidaysOpen, newHolidayDate, newHolidayName, setHolidaysOpen, setNewHolidayDate, setNewHolidayName } = context;
  return (
    <>
        {/* HOLIDAYS MODULE MODAL */}
        {holidaysOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 backdrop-blur-sm p-0 sm:items-center sm:p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget && !holidaySaving) setHolidaysOpen(false); }}
        >
        <section className="w-full max-w-2xl card-style shadow-2xl max-h-[90vh] flex flex-col !p-4 sm:!p-5" onMouseDown={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between gap-2 mb-4 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center"><CalendarRange size={17} strokeWidth={2.4}/></span>
              <h3 className="mb-0 text-sm">
              Holidays
              <span className="block text-[10px] font-medium text-slate-400 normal-case tracking-normal mt-0.5">
                Dates employees won&apos;t be auto-marked Absent
              </span>
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setHolidaysOpen(false)}
              disabled={holidaySaving}
              className="text-slate-400 hover:text-slate-600 transition disabled:opacity-50"
              aria-label="Close holidays"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <div className="overflow-y-auto flex-1 pr-1">
            {holidayMsg && <div className={`p-2.5 rounded-xl text-xs font-bold mb-3 ${holidayMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{holidayMsg.text}</div>}

            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <input
                type="date"
                value={newHolidayDate}
                onChange={(e) => setNewHolidayDate(e.target.value)}
                className="input-field !py-1.5 !text-xs !min-h-0 sm:!w-44 flex-shrink-0"
              />
              <input
                type="text"
                placeholder="Holiday name (e.g. Independence Day)"
                value={newHolidayName}
                onChange={(e) => setNewHolidayName(e.target.value)}
                className="input-field !py-1.5 !text-xs !min-h-0 flex-1 min-w-0 !text-slate-900"
              />
              <button
                type="button"
                onClick={addHoliday}
                disabled={holidaySaving || !newHolidayDate || !newHolidayName.trim()}
                className="btn-primary !w-auto !py-1.5 !text-xs !px-4 disabled:opacity-50 whitespace-nowrap flex-shrink-0"
              >
                {holidaySaving ? <span className="flex items-center justify-center gap-2"><Spinner size="sm" />Adding...</span> : '+ Add Holiday'}
              </button>
            </div>

            <div className="space-y-1.5 min-h-[80px]">
              {holidaysLoading && <LoadingRow label="Loading holidays..." />}
              {!holidaysLoading && holidays.length === 0 && (
                <p className="text-slate-400 text-xs">No holidays added yet.</p>
              )}
              {!holidaysLoading && holidays.map((h) => (
                <div key={h.id} className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 text-xs">{h.name}</span>
                    <span className="text-slate-400 text-xs"> · {new Date(h.holiday_date).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  <button onClick={() => deleteHoliday(h.id)} className="text-rose-500 hover:text-rose-700 text-xs font-bold flex-shrink-0">Remove</button>
                </div>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setHolidaysOpen(false)}
            disabled={holidaySaving}
            className="mt-4 w-full py-3 rounded-full bg-slate-100 text-slate-600 font-medium text-sm hover:bg-slate-200 transition disabled:opacity-50 flex-shrink-0"
          >
            Close
          </button>
        </section>
        </div>
        )}
    </>
  );
}
