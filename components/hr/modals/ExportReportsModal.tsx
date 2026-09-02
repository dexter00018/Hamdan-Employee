'use client';

import type { Dispatch, SetStateAction } from 'react';
import { FileDown } from 'lucide-react';
import ModalShell from '@/components/shared/ModalShell';

type Period = 'MONTH' | 'H1' | 'H2';
type Feedback = { type: 'success' | 'error'; text: string } | null;
type ExportAction = () => void | Promise<void>;
type Props = { open: boolean; onClose: () => void; availableCutoffs: string[]; exportCutoff: string; exportEmployeeMasterListCSV: ExportAction; exportEmployeeMasterListPDF: ExportAction; exportMsg: Feedback; exportPayrollSummaryCSV: ExportAction; exportPayrollSummaryPDF: ExportAction; exportRawAttendanceCSV: ExportAction; exportRawAttendancePDF: ExportAction; exportingType: string | null; formatCutoffLabel: (key: string) => string; rawExportMonth: string; rawExportPeriod: Period; rawExportPreviewCount: number; setExportCutoff: Dispatch<SetStateAction<string>>; setExportMsg: Dispatch<SetStateAction<Feedback>>; setRawExportMonth: Dispatch<SetStateAction<string>>; setRawExportPeriod: Dispatch<SetStateAction<Period>> };

export default function ExportReportsModal({ open, onClose, availableCutoffs, exportCutoff, exportEmployeeMasterListCSV, exportEmployeeMasterListPDF, exportMsg, exportPayrollSummaryCSV, exportPayrollSummaryPDF, exportRawAttendanceCSV, exportRawAttendancePDF, exportingType, formatCutoffLabel, rawExportMonth, rawExportPeriod, rawExportPreviewCount, setExportCutoff, setExportMsg, setRawExportMonth, setRawExportPeriod }: Props) {
  return (
    <ModalShell open={open} onClose={onClose} title="Export Reports" icon={<FileDown size={17} strokeWidth={2.4}/>} size="sm" closeDisabled={Boolean(exportingType)} className="dark:!border-[#34453a] dark:!bg-[#151d18]">
            {exportMsg && (
              <div className={`p-3 rounded-xl text-sm font-bold mb-4 ${exportMsg.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'}`}>
                {exportMsg.text}
              </div>
            )}

            {/* Payroll Summary per Cutoff */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 mb-3 dark:!border-[#34453a] dark:!bg-[#0d1510]">
              <p className="font-bold text-slate-900 text-xs mb-1 dark:!text-white">Payroll Summary</p>
              <p className="text-slate-500 text-[11px] mb-3 dark:!text-[#c4d0c7]">Present/Late/Absent/Leave day counts and late minutes per employee, for one cutoff period.</p>
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
                  className="w-full bg-slate-900 text-white text-xs font-bold py-2.5 rounded-full hover:bg-slate-700 transition disabled:bg-slate-300 disabled:text-slate-500 disabled:opacity-100 dark:!bg-[#243229] dark:!text-white dark:hover:!bg-[#304237] dark:disabled:!bg-[#344039] dark:disabled:!text-[#c4d0c7]"
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
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 mb-3 dark:!border-[#34453a] dark:!bg-[#0d1510]">
              <p className="font-bold text-slate-900 text-xs mb-1 dark:!text-white">Employee Master List</p>
              <p className="text-slate-500 text-[11px] mb-3 dark:!text-[#c4d0c7]">Name, designation, employment status, and government IDs for every employee.</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={exportEmployeeMasterListCSV}
                  disabled={!!exportingType}
                  className="w-full bg-slate-900 text-white text-xs font-bold py-2.5 rounded-full hover:bg-slate-700 transition disabled:bg-slate-300 disabled:text-slate-500 disabled:opacity-100 dark:!bg-[#243229] dark:!text-white dark:hover:!bg-[#304237] dark:disabled:!bg-[#344039] dark:disabled:!text-[#c4d0c7]"
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
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 dark:!border-[#34453a] dark:!bg-[#0d1510]">
              <p className="font-bold text-slate-900 text-xs mb-1 dark:!text-white">Raw Attendance Log</p>
              <p className="text-slate-500 text-[11px] mb-3 dark:!text-[#c4d0c7]">
                Export every attendance record for a whole month or one payroll cutoff. This export is independent from the collapsed Attendance History view.
              </p>

              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 dark:!text-[#c4d0c7]">Month</label>
              <input
                type="month"
                className="input-field !py-1.5 !text-xs !min-h-0 mb-2"
                value={rawExportMonth}
                onChange={(e) => { setRawExportMonth(e.target.value); setExportMsg(null); }}
              />

              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 dark:!text-[#c4d0c7]">Coverage</label>
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-white border border-slate-200 mb-2 dark:!border-[#34453a] dark:!bg-[#18231c]">
                {([
                  ['MONTH', 'Whole Month'],
                  ['H1', '1–15'],
                  ['H2', '16–End'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => { setRawExportPeriod(value); setExportMsg(null); }}
                    className={`px-2 py-2 rounded-lg text-[10px] font-bold transition ${rawExportPeriod === value ? 'bg-slate-900 text-white shadow dark:!bg-[#e8f2eb] dark:!text-[#0d1510]' : 'text-slate-500 hover:bg-slate-50 dark:!text-[#c4d0c7] dark:hover:!bg-[#243229]'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <p className={`text-[10px] font-bold mb-3 ${rawExportPreviewCount > 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-300'}`}>
                {rawExportPreviewCount} loaded matching record{rawExportPreviewCount === 1 ? '' : 's'} · complete period will be checked before export
              </p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={exportRawAttendanceCSV}
                  disabled={!!exportingType || !rawExportMonth}
                  className="w-full bg-slate-900 text-white text-xs font-bold py-2.5 rounded-full hover:bg-slate-700 transition disabled:bg-slate-300 disabled:text-slate-500 disabled:opacity-100 dark:!bg-[#243229] dark:!text-white dark:hover:!bg-[#304237] dark:disabled:!bg-[#344039] dark:disabled:!text-[#c4d0c7]"
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
              onClick={onClose}
              className="mt-4 w-full py-3 rounded-full bg-slate-100 text-slate-700 font-medium text-sm hover:bg-slate-200 transition dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
            >
              Close
            </button>
    </ModalShell>
  );
}
