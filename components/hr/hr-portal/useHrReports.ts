'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/types/hr';
import { earlyOutOffsetLabel, formatCutoffLabel, formatLateDuration, matchesCutoff, type AttendanceLog, type Profile } from './shared';

// --- Export Reports (CSV + print-ready PDF) ---
export function useHrReports({ attendance, profiles, getMinutesLate }: {
  attendance: AttendanceLog[];
  profiles: Profile[];
  getMinutesLate: (timeInIso: string) => number;
}) {
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportCutoff, setExportCutoff] = useState('');
  const [exportEmployeeId, setExportEmployeeId] = useState('');
  const [rawExportMonth, setRawExportMonth] = useState(() =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit' })
      .format(new Date())
      .slice(0, 7)
  );
  const [rawExportPeriod, setRawExportPeriod] = useState<'MONTH' | 'H1' | 'H2'>('MONTH');
  const [exportingType, setExportingType] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!exportModalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !exportingType) setExportModalOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [exportModalOpen, exportingType]);

  const escapeCsv = (val: string) => `"${(val ?? '').replace(/"/g, '""')}"`;

  const downloadCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csv = [headers, ...rows].map((r) => r.map((v) => escapeCsv(String(v))).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Opens a clean, branded print document. Choosing "Save as PDF" in the
  // browser print dialog creates the PDF without adding another npm package.
  const printReportAsPdf = (
    title: string,
    periodLabel: string,
    headers: string[],
    rows: (string | number)[][]
  ) => {
    const escapeHtml = (value: string | number) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    const reportWindow = window.open('', '_blank');
    if (!reportWindow) {
      throw new Error('The PDF window was blocked. Please allow pop-ups for this site and try again.');
    }
    reportWindow.opener = null;

    const generatedAt = new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Manila',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    reportWindow.document.write(`<!doctype html>
      <html><head><title>${escapeHtml(title)}</title><meta charset="utf-8" />
      <style>
        @page { size: landscape; margin: 12mm; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #0f172a; font: 10px Arial, sans-serif; }
        .header { border-bottom: 3px solid #0f172a; padding-bottom: 10px; margin-bottom: 14px; }
        .brand { font-size: 18px; font-weight: 800; letter-spacing: .08em; }
        h1 { margin: 5px 0 3px; font-size: 15px; }
        .meta { color: #64748b; line-height: 1.5; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        thead { display: table-header-group; }
        tr { page-break-inside: avoid; }
        th { background: #0f172a; color: white; text-align: left; font-size: 8px; text-transform: uppercase; letter-spacing: .04em; }
        th, td { border: 1px solid #cbd5e1; padding: 6px; vertical-align: top; overflow-wrap: anywhere; }
        tbody tr:nth-child(even) { background: #f8fafc; }
        .footer { margin-top: 10px; color: #64748b; font-size: 8px; text-align: right; }
        @media print { .no-print { display: none !important; } }
      </style></head><body>
        <div class="header">
          <div class="brand">HAMDAN ENGINEERING</div>
          <h1>${escapeHtml(title)}</h1>
          <div class="meta">Period: ${escapeHtml(periodLabel)}<br/>Generated: ${escapeHtml(generatedAt)} (Philippine time)<br/>Records: ${rows.length}</div>
        </div>
        <table><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>
        <div class="footer">Hamdan Engineering · ${escapeHtml(title)}</div>
        <script>window.addEventListener('load',function(){setTimeout(function(){window.print();},250);});<\/script>
      </body></html>`);
    reportWindow.document.close();
  };

  const buildPayrollSummaryRows = () => {
    if (!exportCutoff) throw new Error('Please select a cutoff period first.');
    const cutoffLogs = attendance.filter((log) => (!exportEmployeeId || log.user_id === exportEmployeeId) && log.log_date && matchesCutoff(log.log_date, exportCutoff));
    const byEmployee = new Map<string, { name: string; empId: string; present: number; late: number; lateMinutes: number; absent: number; leave: number }>();

    for (const p of profiles) {
      if (exportEmployeeId && p.id !== exportEmployeeId) continue;
      byEmployee.set(p.id, { name: p.full_name || 'Unknown', empId: p.employee_id || '-', present: 0, late: 0, lateMinutes: 0, absent: 0, leave: 0 });
    }
    for (const log of cutoffLogs) {
      const entry = byEmployee.get(log.user_id);
      if (!entry) continue;
      const status = log.status?.toLowerCase() ?? '';
      if (status === 'absent') { entry.absent++; continue; }
      if (status.includes('leave')) { entry.leave++; continue; }
      entry.present++;
      if (status === 'late' && log.time_in) {
        entry.late++;
        entry.lateMinutes += getMinutesLate(log.time_in);
      }
    }
    return Array.from(byEmployee.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((e) => [e.empId, e.name, e.present, e.late, e.lateMinutes, e.absent, e.leave]);
  };

  // Payroll Summary per Cutoff -- aggregates the already-loaded
  // `attendance` array (all logs, fetched on dashboard load) by
  // employee for whichever cutoff is selected in the export modal.
  const exportPayrollSummaryCSV = () => {
    setExportingType('payroll-csv');
    setExportMsg(null);
    try {
      const rows = buildPayrollSummaryRows();
      downloadCsv(
        `payroll-summary-${exportCutoff.replace(':', '_')}-${exportEmployeeId || 'all-employees'}.csv`,
        ['Employee ID', 'Name', 'Present Days', 'Late Days', 'Total Late Minutes', 'Absent Days', 'Leave Days'],
        rows
      );
      setExportMsg({ type: 'success', text: `Payroll summary for ${formatCutoffLabel(exportCutoff)} downloaded.` });
    } catch (err: unknown) {
      setExportMsg({ type: 'error', text: errorMessage(err, 'Failed to export payroll summary.') });
    } finally {
      setExportingType(null);
    }
  };

  const exportPayrollSummaryPDF = () => {
    setExportingType('payroll-pdf');
    setExportMsg(null);
    try {
      const rows = buildPayrollSummaryRows();
      printReportAsPdf(
        'Payroll Summary',
        `${formatCutoffLabel(exportCutoff)} - ${exportEmployeeId ? profiles.find(p => p.id === exportEmployeeId)?.full_name || 'Selected employee' : 'All employees'}`,
        ['Employee ID', 'Name', 'Present Days', 'Late Days', 'Late Minutes', 'Absent Days', 'Leave Days'],
        rows
      );
      setExportMsg({ type: 'success', text: 'Payroll Summary opened. Choose “Save as PDF” in the print dialog.' });
    } catch (err: unknown) {
      setExportMsg({ type: 'error', text: errorMessage(err, 'Failed to create payroll PDF.') });
    } finally {
      setExportingType(null);
    }
  };

  const getEmployeeMasterListRows = async () => {
    const { data: govData, error: govError } = await supabase
      .from('employee_government_ids')
      .select('user_id, sss_number, philhealth_number, pagibig_number, tin_number, hired_date, employment_status');
    if (govError) throw govError;

    const govMap = new Map((govData || []).map((g: { user_id: string; sss_number: string | null; philhealth_number: string | null; pagibig_number: string | null; tin_number: string | null; hired_date: string | null; employment_status: string | null }) => [g.user_id, g]));
    return profiles
      .slice()
      .sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? ''))
      .map((p) => {
        const g = govMap.get(p.id);
        return [p.employee_id || '-', p.full_name || 'Unknown', p.designation || '-', p.employee_email || '-', g?.employment_status || '-', g?.hired_date || '-', g?.sss_number || '-', g?.philhealth_number || '-', g?.pagibig_number || '-', g?.tin_number || '-'];
      });
  };

  // Employee Master List -- needs a fresh government-IDs fetch since
  // that table isn't loaded in bulk anywhere else in this dashboard.
  const exportEmployeeMasterListCSV = async () => {
    setExportingType('master-csv');
    setExportMsg(null);
    try {
      const rows = await getEmployeeMasterListRows();

      downloadCsv(
        'employee-master-list.csv',
        ['Employee ID', 'Full Name', 'Designation', 'Email', 'Employment Status', 'Hired Date', 'SSS', 'PhilHealth', 'Pag-IBIG', 'TIN'],
        rows
      );
      setExportMsg({ type: 'success', text: 'Employee master list downloaded.' });
    } catch (err: unknown) {
      console.error('Error exporting employee master list:', err);
      setExportMsg({ type: 'error', text: errorMessage(err, 'Failed to export employee master list.') });
    } finally {
      setExportingType(null);
    }
  };

  const exportEmployeeMasterListPDF = async () => {
    setExportingType('master-pdf');
    setExportMsg(null);
    try {
      const rows = await getEmployeeMasterListRows();
      printReportAsPdf(
        'Employee Master List',
        'All active employee profiles',
        ['Employee ID', 'Full Name', 'Designation', 'Email', 'Employment Status', 'Hired Date', 'SSS', 'PhilHealth', 'Pag-IBIG', 'TIN'],
        rows
      );
      setExportMsg({ type: 'success', text: 'Employee Master List opened. Choose “Save as PDF” in the print dialog.' });
    } catch (err: unknown) {
      console.error('Error exporting employee master list PDF:', err);
      setExportMsg({ type: 'error', text: errorMessage(err, 'Failed to create employee master list PDF.') });
    } finally {
      setExportingType(null);
    }
  };

  const getRawExportRange = () => {
    if (!/^\d{4}-\d{2}$/.test(rawExportMonth)) throw new Error('Please select a valid month.');
    const [year, month] = rawExportMonth.split('-').map(Number);
    const finalDay = new Date(year, month, 0).getDate();
    const startDay = rawExportPeriod === 'H2' ? 16 : 1;
    const endDay = rawExportPeriod === 'H1' ? 15 : finalDay;
    const start = `${rawExportMonth}-${String(startDay).padStart(2, '0')}`;
    const end = `${rawExportMonth}-${String(endDay).padStart(2, '0')}`;
    const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const label = rawExportPeriod === 'MONTH'
      ? monthLabel
      : rawExportPeriod === 'H1'
        ? `${monthLabel.replace(` ${year}`, '')} 1–15, ${year}`
        : `${monthLabel.replace(` ${year}`, '')} 16–${finalDay}, ${year}`;
    const suffix = rawExportPeriod === 'MONTH' ? 'whole-month' : rawExportPeriod.toLowerCase();
    return { start, end, label, suffix };
  };

  const rawExportPreviewCount = useMemo(() => {
    try {
      const { start, end } = getRawExportRange();
      return attendance.filter((log) => (!exportEmployeeId || log.user_id === exportEmployeeId) && !!log.log_date && log.log_date >= start && log.log_date <= end).length;
    } catch {
      return 0;
    }
  }, [attendance, rawExportMonth, rawExportPeriod, exportEmployeeId]);

  const fetchRawAttendanceRows = async () => {
    const range = getRawExportRange();
    let query = supabase
      .from('attendance_logs')
      .select('id, user_id, log_date, time_in, time_out, status, late_offset_minutes, early_out_offset_minutes, profiles!inner(full_name, employee_id, role, is_active), early_out_offset_requests(status, required_minutes)')
      .eq('profiles.role', 'employee')
      .or('is_active.eq.true,resigned_date.not.is.null', { referencedTable: 'profiles' })
      .gte('log_date', range.start)
      .lte('log_date', range.end)
      .order('log_date', { ascending: true })
      .order('time_in', { ascending: true, nullsFirst: false }).order('id');
    if (exportEmployeeId) query = query.eq('user_id', exportEmployeeId);
    const data: AttendanceLog[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data: page, error } = await query.range(offset, offset + 499);
      if (error) throw error;
      data.push(...((page || []) as unknown as AttendanceLog[]));
      if (!page || page.length < 500) break;
    }

    const logs = ((data || []) as unknown as AttendanceLog[]).sort((a, b) => {
      const dateCompare = (a.log_date || '').localeCompare(b.log_date || '');
      if (dateCompare !== 0) return dateCompare;
      return (a.profiles?.full_name || '').localeCompare(b.profiles?.full_name || '');
    });
    const formatTime = (iso: string | null) => iso
      ? new Date(iso).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : '-';
    const rows = logs.map((log) => {
      const isLate = log.status?.toLowerCase() === 'late' && !!log.time_in;
      const offset = earlyOutOffsetLabel(log);
      return [
        log.log_date || '-',
        log.profiles?.full_name || 'Unknown',
        log.profiles?.employee_id || profiles.find((p) => p.id === log.user_id)?.employee_id || '-',
        formatTime(log.time_in),
        formatTime(log.time_out),
        log.status || '-',
        offset?.label || '-',
        isLate ? formatLateDuration(getMinutesLate(log.time_in as string)) : '-',
      ];
    });
    const employeeLabel = exportEmployeeId ? profiles.find(p => p.id === exportEmployeeId)?.full_name || 'Selected employee' : 'All employees';
    return { ...range, label: `${range.label} - ${employeeLabel}`, suffix: `${range.suffix}-${exportEmployeeId || 'all-employees'}`, rows };
  };

  // Raw Attendance Log has an independent whole-month / cutoff filter.
  // It fetches the complete selected range, not only the visible page.
  const exportRawAttendanceCSV = async () => {
    setExportingType('raw-csv');
    setExportMsg(null);
    try {
      const { rows, label, suffix } = await fetchRawAttendanceRows();
      if (rows.length === 0) throw new Error(`No attendance records found for ${label}.`);
      downloadCsv(
        `raw-attendance-${rawExportMonth}-${suffix}.csv`,
        ['Date', 'Employee', 'Employee ID', 'Time In', 'Time Out', 'Status', 'Offset', 'Late Duration'],
        rows
      );
      setExportMsg({ type: 'success', text: `Raw attendance CSV downloaded (${rows.length} records for ${label}).` });
    } catch (err: unknown) {
      console.error('Error exporting raw attendance CSV:', err);
      setExportMsg({ type: 'error', text: errorMessage(err, 'Failed to export raw attendance CSV.') });
    } finally {
      setExportingType(null);
    }
  };

  const exportRawAttendancePDF = async () => {
    setExportingType('raw-pdf');
    setExportMsg(null);
    try {
      const { rows, label } = await fetchRawAttendanceRows();
      if (rows.length === 0) throw new Error(`No attendance records found for ${label}.`);
      printReportAsPdf(
        'Raw Attendance Log',
        label,
        ['Date', 'Employee', 'Employee ID', 'Time In', 'Time Out', 'Status', 'Offset', 'Late Duration'],
        rows
      );
      setExportMsg({ type: 'success', text: `Raw attendance report opened (${rows.length} records). Choose “Save as PDF” in the print dialog.` });
    } catch (err: unknown) {
      console.error('Error exporting raw attendance PDF:', err);
      setExportMsg({ type: 'error', text: errorMessage(err, 'Failed to create raw attendance PDF.') });
    } finally {
      setExportingType(null);
    }
  };

  // Cutoff options generated from whatever months actually appear in
  // the attendance data, newest first.
  const availableCutoffs = useMemo(() => {
    const months = new Set<string>();
    attendance.forEach((log) => {
      if (log.log_date) months.add(log.log_date.slice(0, 7));
    });
    const opts: string[] = [];
    months.forEach((ym) => {
      opts.push(`${ym}:H1`);
      opts.push(`${ym}:H2`);
    });
    return opts.sort().reverse();
  }, [attendance]);

  const openReports = () => { setExportModalOpen(true); setExportMsg(null); if (!exportCutoff) setExportCutoff(availableCutoffs[0] || ''); };

  return {
    exportModalOpen,
    setExportModalOpen,
    exportCutoff,
    setExportCutoff,
    exportEmployeeId,
    setExportEmployeeId,
    rawExportMonth,
    setRawExportMonth,
    rawExportPeriod,
    setRawExportPeriod,
    exportingType,
    exportMsg,
    setExportMsg,
    availableCutoffs,
    openReports,
    exportPayrollSummaryCSV,
    exportPayrollSummaryPDF,
    exportEmployeeMasterListCSV,
    exportEmployeeMasterListPDF,
    exportRawAttendanceCSV,
    exportRawAttendancePDF,
    rawExportPreviewCount,
    formatCutoffLabel,
  };
}
