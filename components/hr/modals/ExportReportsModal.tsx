// @ts-nocheck
'use client';

// Presentation-only extraction of legacy dashboard JSX. The parent page remains
// the source of truth for typed state, data fetching, and mutations.
export default function ExportReportsModal({ context }: { context: Record<string, any> }) {
  const { FileDown, availableCutoffs, exportCutoff, exportEmployeeMasterListCSV, exportEmployeeMasterListPDF, exportModalOpen, exportMsg, exportPayrollSummaryCSV, exportPayrollSummaryPDF, exportRawAttendanceCSV, exportRawAttendancePDF, exportingType, formatCutoffLabel, rawExportMonth, rawExportPeriod, rawExportPreviewCount, setExportCutoff, setExportModalOpen, setExportMsg, setRawExportMonth, setRawExportPeriod } = context;
  return (
    <>
      {/* EXPORT REPORTS MODAL */}
      {exportModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 backdrop-blur-sm p-0 sm:items-center sm:p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !exportingType) setExportModalOpen(false);
          }}
        >
          <div className="w-full max-w-sm card-style shadow-2xl max-h-[90vh] overflow-y-auto" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0"><FileDown size={17} strokeWidth={2.4}/></span>
                <h3 className="mb-0">Export Reports</h3>
              </div>
              <button
                type="button"
                onClick={() => setExportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {exportMsg && (
              <div className={`p-3 rounded-xl text-sm font-bold mb-4 ${exportMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {exportMsg.text}
              </div>
            )}

            {/* Payroll Summary per Cutoff */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 mb-3">
              <p className="font-bold text-slate-900 text-xs mb-1">Payroll Summary</p>
              <p className="text-slate-400 text-[11px] mb-3">Present/Late/Absent/Leave day counts and late minutes per employee, for one cutoff period.</p>
              <select
                className="input-field !py-1.5 !text-xs !min-h-0 mb-2"
                value={exportCutoff}
                onChange={(e) => setExportCutoff(e.target.value)}
              >
                <option value="">Select cutoff period...</option>
                {availableCutoffs.map((c) => <option key={c} value={c}>{formatCutoffLabel(c)}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={exportPayrollSummaryCSV}
                  disabled={!!exportingType || !exportCutoff}
                  className="w-full bg-slate-900 text-white text-xs font-bold py-2.5 rounded-full hover:bg-slate-700 transition disabled:opacity-50"
                >
                  {exportingType === 'payroll-csv' ? 'Exporting...' : 'Download CSV'}
                </button>
                <button
                  type="button"
                  onClick={exportPayrollSummaryPDF}
                  disabled={!!exportingType || !exportCutoff}
                  className="w-full bg-red-600 text-white text-xs font-bold py-2.5 rounded-full hover:bg-red-700 transition disabled:opacity-50"
                >
                  {exportingType === 'payroll-pdf' ? 'Preparing...' : 'Download PDF'}
                </button>
              </div>
            </div>

            {/* Employee Master List */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 mb-3">
              <p className="font-bold text-slate-900 text-xs mb-1">Employee Master List</p>
              <p className="text-slate-400 text-[11px] mb-3">Name, designation, employment status, and government IDs for every employee.</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={exportEmployeeMasterListCSV}
                  disabled={!!exportingType}
                  className="w-full bg-slate-900 text-white text-xs font-bold py-2.5 rounded-full hover:bg-slate-700 transition disabled:opacity-50"
                >
                  {exportingType === 'master-csv' ? 'Exporting...' : 'Download CSV'}
                </button>
                <button
                  type="button"
                  onClick={exportEmployeeMasterListPDF}
                  disabled={!!exportingType}
                  className="w-full bg-red-600 text-white text-xs font-bold py-2.5 rounded-full hover:bg-red-700 transition disabled:opacity-50"
                >
                  {exportingType === 'master-pdf' ? 'Preparing...' : 'Download PDF'}
                </button>
              </div>
            </div>

            {/* Raw Attendance Log */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <p className="font-bold text-slate-900 text-xs mb-1">Raw Attendance Log</p>
              <p className="text-slate-400 text-[11px] mb-3">
                Export every attendance record for a whole month or one payroll cutoff. This export is independent from the collapsed Attendance History view.
              </p>

              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Month</label>
              <input
                type="month"
                className="input-field !py-1.5 !text-xs !min-h-0 mb-2"
                value={rawExportMonth}
                onChange={(e) => { setRawExportMonth(e.target.value); setExportMsg(null); }}
              />

              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Coverage</label>
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-white border border-slate-200 mb-2">
                {([
                  ['MONTH', 'Whole Month'],
                  ['H1', '1–15'],
                  ['H2', '16–End'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => { setRawExportPeriod(value); setExportMsg(null); }}
                    className={`px-2 py-2 rounded-lg text-[10px] font-bold transition ${rawExportPeriod === value ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <p className={`text-[10px] font-bold mb-3 ${rawExportPreviewCount > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                {rawExportPreviewCount} loaded matching record{rawExportPreviewCount === 1 ? '' : 's'} · complete period will be checked before export
              </p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={exportRawAttendanceCSV}
                  disabled={!!exportingType || !rawExportMonth}
                  className="w-full bg-slate-900 text-white text-xs font-bold py-2.5 rounded-full hover:bg-slate-700 transition disabled:opacity-50"
                >
                  {exportingType === 'raw-csv' ? 'Exporting...' : 'Download CSV'}
                </button>
                <button
                  type="button"
                  onClick={exportRawAttendancePDF}
                  disabled={!!exportingType || !rawExportMonth}
                  className="w-full bg-red-600 text-white text-xs font-bold py-2.5 rounded-full hover:bg-red-700 transition disabled:opacity-50"
                >
                  {exportingType === 'raw-pdf' ? 'Preparing...' : 'Download PDF'}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setExportModalOpen(false)}
              className="mt-4 w-full py-3 rounded-full bg-slate-100 text-slate-600 font-medium text-sm hover:bg-slate-200 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
