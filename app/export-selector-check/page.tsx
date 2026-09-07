'use client';
import { useState } from 'react';
import ExportReportsModal from '@/components/hr/modals/ExportReportsModal';
export default function Check() {
  const [employee, setEmployee] = useState('');
  const [month, setMonth] = useState('2026-09');
  const [period, setPeriod] = useState<'MONTH' | 'H1' | 'H2'>('MONTH');
  const [cutoff, setCutoff] = useState('2026-09:H1');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const exportPreview = () => setMessage({ type: 'success', text: `Preview: ${employee || 'all'} / ${month} / ${period}` });
  return <ExportReportsModal open onClose={() => {}} employees={[{ id: 'alice', full_name: 'Alice Example', employee_id: 'TEST-1' }, { id: 'bob', full_name: 'Bob Example', employee_id: 'TEST-2' }]} exportEmployeeId={employee} setExportEmployeeId={setEmployee} availableCutoffs={[cutoff]} exportCutoff={cutoff} setExportCutoff={setCutoff} formatCutoffLabel={value => value} rawExportMonth={month} setRawExportMonth={setMonth} rawExportPeriod={period} setRawExportPeriod={setPeriod} rawExportPreviewCount={0} exportMsg={message} setExportMsg={setMessage} exportingType={null} exportEmployeeMasterListCSV={exportPreview} exportEmployeeMasterListPDF={exportPreview} exportPayrollSummaryCSV={exportPreview} exportPayrollSummaryPDF={exportPreview} exportRawAttendanceCSV={exportPreview} exportRawAttendancePDF={exportPreview} />;
}
