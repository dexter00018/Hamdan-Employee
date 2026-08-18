'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CalendarClock, CalendarRange, CheckCircle2, Clock3, FileDown, Megaphone, RefreshCw, Search, UsersRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Spinner, { LoadingRow } from '@/components/Spinner';

type AttendanceLog = {
  id: string;
  user_id: string;
  log_date: string;
  time_in: string | null;
  time_out: string | null;
  status: string | null;
  profiles?: { full_name: string | null; employee_id?: string | null };
};

type Profile = {
  id: string;
  full_name: string | null;
  employee_id: string | null;
  designation: string | null;
  avatar_url: string | null;
  employee_email: string | null;
};

// Must match app/employee/page.tsx and app/api/time-in/route.ts.
// Fallback values only -- normal operation uses the configurable values
// fetched from app_settings (editable via Super Admin -> App Settings).
const FALLBACK_LATE_CUTOFF_HOUR = 9;
const FALLBACK_LATE_CUTOFF_MINUTE = 15;

export default function HRDashboard() {
  const router = useRouter();
  const [attendance, setAttendance] = useState<AttendanceLog[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter States — defaults to "today" (Philippine time) so HR sees
  // today's attendance by default instead of the entire history.
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(() =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())
  );
  // Cutoff period filter (1-15 / 16-end of month) -- when set, this takes over
  // from selectedDate for payroll-period review instead of a single day.
  const [cutoffFilter, setCutoffFilter] = useState('');

  // Which modal is open: null | 'choice' | 'edit' | 'payslips'
  const [modalMode, setModalMode] = useState<null | 'choice' | 'edit' | 'payslips'>(null);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState({ id: null as string | null, full_name: '', employee_id: '', designation: '', employee_email: '', sss_number: '', philhealth_number: '', pagibig_number: '', tin_number: '', hired_date: '', employment_status: '' });
  const [saveLoading, setSaveLoading] = useState(false);

  // Avatar upload (HR uploads directly on behalf of the employee) --
  // stored in the public "avatars" Supabase Storage bucket, URL saved
  // into profiles.avatar_url. See storage RLS: HR/super_admin only.
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const MAX_AVATAR_MB = 5;

  // App-wide configurable settings (late cutoff, default leave credits)
  // -- fetched once on load from app_settings, editable by Super Admin
  // without needing a code change/redeploy. Falls back to the
  // module-level constants above until the fetch resolves.
  const [lateCutoffHour, setLateCutoffHour] = useState(FALLBACK_LATE_CUTOFF_HOUR);
  const [lateCutoffMinute, setLateCutoffMinute] = useState(FALLBACK_LATE_CUTOFF_MINUTE);
  const [fallbackLeaveCredits, setFallbackLeaveCredits] = useState(10);

  const fetchAppSettings = async () => {
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['late_cutoff_hour', 'late_cutoff_minute', 'default_leave_credits']);
    if (error) {
      console.error('Error fetching app settings:', error);
      return;
    }
    const map = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
    if (typeof map.late_cutoff_hour === 'number') setLateCutoffHour(map.late_cutoff_hour);
    if (typeof map.late_cutoff_minute === 'number') setLateCutoffMinute(map.late_cutoff_minute);
    if (typeof map.default_leave_credits === 'number') setFallbackLeaveCredits(map.default_leave_credits);
  };

  // --- Leave Credits Overview (read-only monitoring, no manual edit) ---
  // Pulls profiles + employee_government_ids + leave_credits separately
  // and merges client-side, since not every employee has a leave_credits
  // row yet (only created lazily by settle_leave_day() the first time
  // they actually use a credit) or a government_ids row (HR hasn't set
  // Employment Status yet).
  const [leaveCreditsModalOpen, setLeaveCreditsModalOpen] = useState(false);
  const [leaveCreditsLoading, setLeaveCreditsLoading] = useState(false);
  const [leaveCreditsFetched, setLeaveCreditsFetched] = useState(false);
  const [leaveCreditsData, setLeaveCreditsData] = useState<{
    id: string;
    full_name: string | null;
    employee_id: string | null;
    employment_status: string | null;
    total_credits: number | null;
    used_credits: number | null;
  }[]>([]);

  const fetchLeaveCreditsOverview = async () => {
    setLeaveCreditsLoading(true);
    const year = new Date().getFullYear();
    const [profRes, govRes, creditsRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, employee_id').eq('role', 'employee').order('full_name'),
      supabase.from('employee_government_ids').select('user_id, employment_status'),
      supabase.from('leave_credits').select('user_id, total_credits, used_credits').eq('year', year),
    ]);

    if (profRes.error) console.error('Error fetching profiles for leave credits:', profRes.error);
    if (govRes.error) console.error('Error fetching government IDs for leave credits:', govRes.error);
    if (creditsRes.error) console.error('Error fetching leave credits:', creditsRes.error);

    const govMap = new Map((govRes.data || []).map((g: any) => [g.user_id, g.employment_status]));
    const creditsMap = new Map((creditsRes.data || []).map((c: any) => [c.user_id, c]));

    const merged = (profRes.data || []).map((p: any) => {
      const credits = creditsMap.get(p.id);
      return {
        id: p.id,
        full_name: p.full_name,
        employee_id: p.employee_id,
        employment_status: govMap.get(p.id) ?? null,
        total_credits: credits?.total_credits ?? null,
        used_credits: credits?.used_credits ?? null,
      };
    });

    setLeaveCreditsData(merged);
    setLeaveCreditsLoading(false);
  };

  const openLeaveCreditsModal = () => {
    setLeaveCreditsModalOpen(true);
    if (!leaveCreditsFetched) {
      setLeaveCreditsFetched(true);
      fetchLeaveCreditsOverview();
    }
  };

  // Sorted so Regular employees running low on credits surface first --
  // the whole point of a monitoring view is to catch that at a glance.
  const sortedLeaveCreditsData = useMemo(() => {
    return [...leaveCreditsData].sort((a, b) => {
      const aRemaining = a.employment_status === 'Regular' ? (a.total_credits ?? fallbackLeaveCredits) - (a.used_credits ?? 0) : Infinity;
      const bRemaining = b.employment_status === 'Regular' ? (b.total_credits ?? fallbackLeaveCredits) - (b.used_credits ?? 0) : Infinity;
      if (aRemaining !== bRemaining) return aRemaining - bRemaining;
      return (a.full_name ?? '').localeCompare(b.full_name ?? '');
    });
  }, [leaveCreditsData, fallbackLeaveCredits]);

  // --- Export Reports (CSV + print-ready PDF) ---
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportCutoff, setExportCutoff] = useState('');
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
  // browser print dialog creates the PDF without adding another npm package,
  // so this updated HR page remains a one-file copy/paste replacement.
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
    const cutoffLogs = attendance.filter((log) => log.log_date && matchesCutoff(log.log_date, exportCutoff));
    const byEmployee = new Map<string, { name: string; empId: string; present: number; late: number; lateMinutes: number; absent: number; leave: number }>();

    for (const p of profiles) {
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
        `payroll-summary-${exportCutoff.replace(':', '_')}.csv`,
        ['Employee ID', 'Name', 'Present Days', 'Late Days', 'Total Late Minutes', 'Absent Days', 'Leave Days'],
        rows
      );
      setExportMsg({ type: 'success', text: `Payroll summary for ${formatCutoffLabel(exportCutoff)} downloaded.` });
    } catch (err: any) {
      setExportMsg({ type: 'error', text: err?.message ?? 'Failed to export payroll summary.' });
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
        formatCutoffLabel(exportCutoff),
        ['Employee ID', 'Name', 'Present Days', 'Late Days', 'Late Minutes', 'Absent Days', 'Leave Days'],
        rows
      );
      setExportMsg({ type: 'success', text: 'Payroll Summary opened. Choose “Save as PDF” in the print dialog.' });
    } catch (err: any) {
      setExportMsg({ type: 'error', text: err?.message ?? 'Failed to create payroll PDF.' });
    } finally {
      setExportingType(null);
    }
  };

  const getEmployeeMasterListRows = async () => {
    const { data: govData, error: govError } = await supabase
      .from('employee_government_ids')
      .select('user_id, sss_number, philhealth_number, pagibig_number, tin_number, hired_date, employment_status');
    if (govError) throw govError;

    const govMap = new Map((govData || []).map((g: any) => [g.user_id, g]));
    return profiles
      .slice()
      .sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? ''))
      .map((p) => {
        const g = govMap.get(p.id) as any;
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
    } catch (err: any) {
      console.error('Error exporting employee master list:', err);
      setExportMsg({ type: 'error', text: err?.message ?? 'Failed to export employee master list.' });
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
    } catch (err: any) {
      console.error('Error exporting employee master list PDF:', err);
      setExportMsg({ type: 'error', text: err?.message ?? 'Failed to create employee master list PDF.' });
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
      return attendance.filter((log) => !!log.log_date && log.log_date >= start && log.log_date <= end).length;
    } catch {
      return 0;
    }
  }, [attendance, rawExportMonth, rawExportPeriod]);

  const fetchRawAttendanceRows = async () => {
    const range = getRawExportRange();
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('id, user_id, log_date, time_in, time_out, status, profiles!inner(full_name, employee_id, role)')
      .eq('profiles.role', 'employee')
      .gte('log_date', range.start)
      .lte('log_date', range.end)
      .order('log_date', { ascending: true })
      .order('time_in', { ascending: true, nullsFirst: false });
    if (error) throw error;

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
      return [
        log.log_date || '-',
        log.profiles?.full_name || 'Unknown',
        log.profiles?.employee_id || profiles.find((p) => p.id === log.user_id)?.employee_id || '-',
        formatTime(log.time_in),
        formatTime(log.time_out),
        log.status || '-',
        isLate ? formatLateDuration(getMinutesLate(log.time_in as string)) : '-',
      ];
    });
    return { ...range, rows };
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
        ['Date', 'Employee', 'Employee ID', 'Time In', 'Time Out', 'Status', 'Late Duration'],
        rows
      );
      setExportMsg({ type: 'success', text: `Raw attendance CSV downloaded (${rows.length} records for ${label}).` });
    } catch (err: any) {
      console.error('Error exporting raw attendance CSV:', err);
      setExportMsg({ type: 'error', text: err?.message ?? 'Failed to export raw attendance CSV.' });
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
        ['Date', 'Employee', 'Employee ID', 'Time In', 'Time Out', 'Status', 'Late Duration'],
        rows
      );
      setExportMsg({ type: 'success', text: `Raw attendance report opened (${rows.length} records). Choose “Save as PDF” in the print dialog.` });
    } catch (err: any) {
      console.error('Error exporting raw attendance PDF:', err);
      setExportMsg({ type: 'error', text: err?.message ?? 'Failed to create raw attendance PDF.' });
    } finally {
      setExportingType(null);
    }
  };

  const handleAvatarChange = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please choose an image file.');
      return;
    }
    if (file.size > MAX_AVATAR_MB * 1024 * 1024) {
      setErrorMsg(`Image must be under ${MAX_AVATAR_MB}MB.`);
      return;
    }
    setErrorMsg(null);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  // Announcement States
  const [announcementId, setAnnouncementId] = useState<string | null>(null);
  const [announcementContent, setAnnouncementContent] = useState('');
  const [announcementImageUrl, setAnnouncementImageUrl] = useState<string | null>(null);
  const [announcementImageFile, setAnnouncementImageFile] = useState<File | null>(null);
  const [announcementImagePreview, setAnnouncementImagePreview] = useState<string | null>(null);
  const [announcementRemoveImage, setAnnouncementRemoveImage] = useState(false);
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const announcementImageInputRef = useRef<HTMLInputElement>(null);
  const [announcementUpdatedAt, setAnnouncementUpdatedAt] = useState<string | null>(null);
  const [announcementLoading, setAnnouncementLoading] = useState(true);
  const [announcementSaving, setAnnouncementSaving] = useState(false);
  const [announcementMsg, setAnnouncementMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Payslip upload states
  const [payslipFile, setPayslipFile] = useState<File | null>(null);
  const [payslipCutoff, setPayslipCutoff] = useState('');
  const [payslipUploading, setPayslipUploading] = useState(false);
  const [payslipMsg, setPayslipMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [employeePayslips, setEmployeePayslips] = useState<{ id: string; cutoff_label: string; file_name: string; file_path: string; uploaded_at: string; published: boolean; published_at: string | null; acknowledged_at: string | null }[]>([]);
  const [employeePayslipsLoading, setEmployeePayslipsLoading] = useState(false);
  const payslipFileRef = useRef<HTMLInputElement>(null);

  // Attendance Disputes
  const [disputes, setDisputes] = useState<any[]>([]);
  const [disputesLoading, setDisputesLoading] = useState(true);
  const [disputeActionLoadingId, setDisputeActionLoadingId] = useState<string | null>(null);
  const [disputeMsg, setDisputeMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [disputesHistoryModalOpen, setDisputesHistoryModalOpen] = useState(false);

  // Leave Requests
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [leaveRequestsLoading, setLeaveRequestsLoading] = useState(true);
  const [leaveActionLoadingId, setLeaveActionLoadingId] = useState<string | null>(null);
  const [leaveMsg, setLeaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [leaveHrNotes, setLeaveHrNotes] = useState<{ [id: string]: string }>({});
  const [leaveHistoryModalOpen, setLeaveHistoryModalOpen] = useState(false);
  const [selectedDisputeDetail, setSelectedDisputeDetail] = useState<any>(null);
  const [selectedLeaveDetail, setSelectedLeaveDetail] = useState<any>(null);
  const [employeesListOpen, setEmployeesListOpen] = useState(false);
  const [attendanceHistoryOpen, setAttendanceHistoryOpen] = useState(false);
  const [holidaysOpen, setHolidaysOpen] = useState(false);
  const PAGE_SIZE = 10;
  const [employeesPage, setEmployeesPage] = useState(1);
  const [attendancePage, setAttendancePage] = useState(1);
  const [holidays, setHolidays] = useState<{ id: string; holiday_date: string; name: string }[]>([]);
  const [holidaysLoading, setHolidaysLoading] = useState(false);
  const [holidaysFetched, setHolidaysFetched] = useState(false);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [holidaySaving, setHolidaySaving] = useState(false);
  const [holidayMsg, setHolidayMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [globalEmployeeSearch, setGlobalEmployeeSearch] = useState('');
  const [quickViewProfile, setQuickViewProfile] = useState<Profile | null>(null);
  const [leaveCalendarOpen, setLeaveCalendarOpen] = useState(false);
  const [leaveCalendarMonth, setLeaveCalendarMonth] = useState(() =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7)
  );
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [attendanceInsightsOpen, setAttendanceInsightsOpen] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [filtersHydrated, setFiltersHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('hamdan-hr-attendance-filters');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.searchTerm === 'string') setSearchTerm(parsed.searchTerm);
        if (typeof parsed.selectedDate === 'string') setSelectedDate(parsed.selectedDate);
        if (typeof parsed.cutoffFilter === 'string') setCutoffFilter(parsed.cutoffFilter);
      }
    } catch (error) {
      console.warn('Could not restore attendance filters:', error);
    } finally {
      setFiltersHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!filtersHydrated) return;
    window.localStorage.setItem('hamdan-hr-attendance-filters', JSON.stringify({ searchTerm, selectedDate, cutoffFilter }));
  }, [filtersHydrated, searchTerm, selectedDate, cutoffFilter]);

  useEffect(() => {
    const moduleModalOpen = announcementOpen || holidaysOpen || employeesListOpen || leaveCalendarOpen || !!quickViewProfile;
    if (!moduleModalOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (announcementOpen && !announcementSaving) setAnnouncementOpen(false);
      if (holidaysOpen && !holidaySaving) setHolidaysOpen(false);
      if (employeesListOpen) setEmployeesListOpen(false);
      if (leaveCalendarOpen) setLeaveCalendarOpen(false);
      if (quickViewProfile) setQuickViewProfile(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [announcementOpen, announcementSaving, holidaysOpen, holidaySaving, employeesListOpen, leaveCalendarOpen, quickViewProfile]);

  useEffect(() => {
    const runStartupSweeps = async () => {
      // Catch-up sweeps, run once per dashboard load, before pulling any
      // attendance/leave data -- so anything they generate (a fresh
      // 'Absent' row, a newly-deducted leave credit) is already reflected
      // in what gets fetched right after.
      const [{ error: leaveSweepError }, { error: absenceSweepError }] = await Promise.all([
        supabase.rpc('settle_overdue_leave_days'),
        supabase.rpc('settle_overdue_absences'),
      ]);
      if (leaveSweepError) console.error('Error settling overdue leave days:', leaveSweepError);
      if (absenceSweepError) console.error('Error settling overdue absences:', absenceSweepError);

      refreshAllData();
      fetchLeaveRequests();
    };
    runStartupSweeps();
    fetchAppSettings();
    fetchAnnouncement();
    fetchDisputes();
    setLeaveCreditsFetched(true);
    fetchLeaveCreditsOverview();
    setHolidaysFetched(true);
    fetchHolidays();
  }, []);

  const refreshAllData = async () => {
    setLoadingData(true);
    setRefreshing(true);
    setErrorMsg(null);

    const [att, prof] = await Promise.all([
      supabase
        .from('attendance_logs')
        .select('*, profiles!inner(full_name)')
        .eq('profiles.role', 'employee')
        .order('log_date', { ascending: false })
        .order('time_in', { ascending: false, nullsFirst: false }),
      supabase
        .from('profiles')
        .select('id, full_name, employee_id, designation, avatar_url, employee_email')
        .eq('role', 'employee')
        .order('full_name'),
    ]);

    if (att.error) {
      console.error('Error fetching attendance:', att.error);
      setErrorMsg(att.error.message);
    }
    if (prof.error) {
      console.error('Error fetching profiles:', prof.error);
      setErrorMsg((prev) => prev ?? prof.error.message);
    }

    setAttendance(att.data || []);
    setProfiles(prof.data || []);
    setLoadingData(false);
    setRefreshing(false);
    setLastUpdatedAt(new Date());
  };

  // Loads the current published announcement (if any) so HR can see and
  // edit what's already live before publishing changes.
  const fetchAnnouncement = async () => {
    setAnnouncementLoading(true);
    const { data, error } = await supabase
      .from('announcements')
      .select('id, content, image_url, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching announcement:', error);
      setAnnouncementMsg({ type: 'error', text: error.message });
      setAnnouncementLoading(false);
      return;
    }

    setAnnouncementId(data?.id ?? null);
    setAnnouncementContent(data?.content ?? '');
    setAnnouncementImageUrl(data?.image_url ?? null);
    setAnnouncementImageFile(null);
    setAnnouncementImagePreview(null);
    setAnnouncementRemoveImage(false);
    if (announcementImageInputRef.current) announcementImageInputRef.current.value = '';
    setAnnouncementUpdatedAt(data?.updated_at ?? null);
    setAnnouncementLoading(false);
  };

  const MAX_ANNOUNCEMENT_IMAGE_MB = 5;

  const handleAnnouncementImageChange = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAnnouncementMsg({ type: 'error', text: 'Please choose an image file.' });
      return;
    }
    if (file.size > MAX_ANNOUNCEMENT_IMAGE_MB * 1024 * 1024) {
      setAnnouncementMsg({ type: 'error', text: `Image must be under ${MAX_ANNOUNCEMENT_IMAGE_MB}MB.` });
      return;
    }
    setAnnouncementMsg(null);
    setAnnouncementRemoveImage(false);
    setAnnouncementImageFile(file);
    setAnnouncementImagePreview(URL.createObjectURL(file));
  };

  const clearAnnouncementImage = () => {
    setAnnouncementImageFile(null);
    setAnnouncementImagePreview(null);
    setAnnouncementRemoveImage(true);
    if (announcementImageInputRef.current) announcementImageInputRef.current.value = '';
  };

  // Publishes the announcement. If one already exists we UPDATE it (so
  // there's always a single "current" announcement employees see);
  // otherwise we INSERT the first one. RLS only allows admin/super_admin
  // roles to write to this table.
  const publishAnnouncement = async () => {
    setAnnouncementSaving(true);
    setAnnouncementMsg(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Resolve what image_url should end up as: a freshly-uploaded
      // image, explicitly removed (null), or left untouched.
      let nextImageUrl: string | null | undefined = undefined;

      if (announcementImageFile) {
        const ext = announcementImageFile.name.split('.').pop() || 'jpg';
        const filePath = `announcement-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('announcements')
          .upload(filePath, announcementImageFile, { contentType: announcementImageFile.type, upsert: false });
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('announcements').getPublicUrl(filePath);
        nextImageUrl = publicUrlData.publicUrl;
      } else if (announcementRemoveImage) {
        nextImageUrl = null;
      }

      if (announcementId) {
        const updatePayload: Record<string, any> = {
          content: announcementContent,
          updated_at: new Date().toISOString(),
          updated_by: user?.id ?? null,
        };
        if (nextImageUrl !== undefined) updatePayload.image_url = nextImageUrl;

        const { error } = await supabase
          .from('announcements')
          .update(updatePayload)
          .eq('id', announcementId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('announcements')
          .insert([{
            content: announcementContent,
            image_url: nextImageUrl ?? null,
            updated_by: user?.id ?? null,
          }])
          .select('id, updated_at')
          .single();

        if (error) throw error;
        setAnnouncementId(data.id);
      }

      setAnnouncementMsg({ type: 'success', text: 'Announcement published successfully.' });
      await fetchAnnouncement();
    } catch (err: any) {
      console.error('Error publishing announcement:', err);
      setAnnouncementMsg({ type: 'error', text: err?.message ?? 'Failed to publish announcement.' });
    } finally {
      setAnnouncementSaving(false);
    }
  };

  // --- Attendance Disputes ---
  const fetchHolidays = async () => {
    setHolidaysLoading(true);
    const { data, error } = await supabase
      .from('holidays')
      .select('id, holiday_date, name')
      .order('holiday_date', { ascending: false });

    if (error) {
      console.error('Error fetching holidays:', error);
      setHolidayMsg({ type: 'error', text: error.message });
      setHolidaysLoading(false);
      return;
    }
    setHolidays(data || []);
    setHolidaysLoading(false);
  };

  const toggleHolidays = () => {
    setHolidaysOpen((v) => !v);
    if (!holidaysFetched) {
      setHolidaysFetched(true);
      fetchHolidays();
    }
  };

  const addHoliday = async () => {
    if (!newHolidayDate || !newHolidayName.trim()) {
      setHolidayMsg({ type: 'error', text: 'Please provide both a date and a name.' });
      return;
    }
    setHolidaySaving(true);
    setHolidayMsg(null);

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('holidays').insert([{
      holiday_date: newHolidayDate,
      name: newHolidayName.trim(),
      created_by: user?.id ?? null,
    }]);

    if (error) {
      setHolidayMsg({ type: 'error', text: error.code === '23505' ? 'That date is already marked as a holiday.' : error.message });
      setHolidaySaving(false);
      return;
    }

    setNewHolidayDate('');
    setNewHolidayName('');
    setHolidayMsg({ type: 'success', text: 'Holiday added.' });
    await fetchHolidays();
    setHolidaySaving(false);
  };

  const deleteHoliday = async (id: string) => {
    if (!confirm('Remove this holiday? Employees may be marked Absent for this date again if it passes without a time-in.')) return;
    const { error } = await supabase.from('holidays').delete().eq('id', id);
    if (error) {
      setHolidayMsg({ type: 'error', text: error.message });
      return;
    }
    await fetchHolidays();
  };

  const fetchDisputes = async () => {
    setDisputesLoading(true);
    const { data, error } = await supabase
      .from('attendance_disputes')
      .select(`
        id, attendance_log_id, dispute_date, dispute_type, claimed_time_in, original_time_in, claimed_time_out, original_time_out, reason, status, hr_notes, created_at, reviewed_at,
        employee:profiles!attendance_disputes_user_id_fkey(full_name),
        reviewer:profiles!attendance_disputes_reviewed_by_fkey(full_name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching disputes:', error);
      setDisputesLoading(false);
      return;
    }
    setDisputes(data || []);
    setDisputesLoading(false);
  };

  // Computes Present/Late the same way as everywhere else in the app,
  // based on the claimed time-in in Philippine time. Only relevant for
  // TimeIn-type disputes -- TimeOut disputes don't change the Present/
  // Late status, since that's determined solely by time_in.
  const computeStatusForTime = (isoString: string) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date(isoString)).reduce((acc: any, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
    const hour = parseInt(parts.hour, 10);
    const minute = parseInt(parts.minute, 10);
    const isLate = hour > lateCutoffHour || (hour === lateCutoffHour && minute > lateCutoffMinute);
    return isLate ? 'Late' : 'Present';
  };

  const approveDispute = async (dispute: any) => {
    setDisputeActionLoadingId(dispute.id);
    setDisputeMsg(null);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const disputeType = dispute.dispute_type || 'TimeIn';

      if (disputeType === 'TimeOut') {
        // Timeout disputes always reference an existing log (the
        // employee already timed in that day) -- just correct time_out.
        // Status (Present/Late) is untouched since that's derived from
        // time_in only.
        if (!dispute.attendance_log_id) {
          throw new Error('This dispute has no linked attendance record to update.');
        }
        const { error } = await supabase
          .from('attendance_logs')
          .update({ time_out: dispute.claimed_time_out })
          .eq('id', dispute.attendance_log_id);
        if (error) throw error;
      } else if (dispute.attendance_log_id) {
        // Existing (wrongly-tagged) log -- correct its time_in/status.
        const newStatus = computeStatusForTime(dispute.claimed_time_in);
        const { error } = await supabase
          .from('attendance_logs')
          .update({ time_in: dispute.claimed_time_in, status: newStatus })
          .eq('id', dispute.attendance_log_id);
        if (error) throw error;
      } else {
        // No log existed for that day (forgot to time in) -- create it.
        // Uses upsert (not insert) because the nightly/on-load absence sweep
        // may have already filled this date with a placeholder 'Absent' row
        // (see settle_overdue_absences) -- this overwrites that placeholder
        // with the real, HR-confirmed time_in/status instead of colliding
        // with the unique (user_id, log_date) constraint.
        const newStatus = computeStatusForTime(dispute.claimed_time_in);
        const { data: disputeRow } = await supabase
          .from('attendance_disputes')
          .select('user_id')
          .eq('id', dispute.id)
          .single();

        const { error } = await supabase.from('attendance_logs').upsert([{
          user_id: disputeRow?.user_id,
          log_date: dispute.dispute_date,
          time_in: dispute.claimed_time_in,
          status: newStatus,
        }], { onConflict: 'user_id,log_date' });
        if (error) throw error;
      }

      const { error: updateError } = await supabase
        .from('attendance_disputes')
        .update({ status: 'Approved', reviewed_at: new Date().toISOString(), reviewed_by: currentUser?.id ?? null })
        .eq('id', dispute.id);
      if (updateError) throw updateError;

      setDisputeMsg({ type: 'success', text: 'Dispute approved and attendance record updated.' });
      await Promise.all([fetchDisputes(), refreshAllData()]);
    } catch (err: any) {
      console.error('Error approving dispute:', err);
      setDisputeMsg({ type: 'error', text: err?.message ?? 'Failed to approve dispute.' });
    } finally {
      setDisputeActionLoadingId(null);
    }
  };

  const rejectDispute = async (dispute: any) => {
    setDisputeActionLoadingId(dispute.id);
    setDisputeMsg(null);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('attendance_disputes')
        .update({ status: 'Rejected', reviewed_at: new Date().toISOString(), reviewed_by: currentUser?.id ?? null })
        .eq('id', dispute.id);
      if (error) throw error;

      setDisputeMsg({ type: 'success', text: 'Dispute rejected.' });
      await fetchDisputes();
    } catch (err: any) {
      console.error('Error rejecting dispute:', err);
      setDisputeMsg({ type: 'error', text: err?.message ?? 'Failed to reject dispute.' });
    } finally {
      setDisputeActionLoadingId(null);
    }
  };

  // --- Leave Requests ---
  const fetchLeaveRequests = async () => {
    setLeaveRequestsLoading(true);
    const { data, error } = await supabase
      .from('leave_requests')
      .select(`id, leave_type, start_date, end_date, reason, status, hr_notes, created_at, reviewed_at,
        employee:profiles!leave_requests_user_id_fkey(full_name, id),
        reviewer:profiles!leave_requests_reviewed_by_fkey(full_name)`)
      .order('created_at', { ascending: false });
    if (error) { console.error('Error fetching leave requests:', error); }
    setLeaveRequests(data || []);
    setLeaveRequestsLoading(false);
  };

  const countLeaveDays = (start: string, end: string) => {
    let count = 0;
    const d = new Date(start);
    const endDate = new Date(end);
    const holidayDates = new Set(holidays.map((holiday) => holiday.holiday_date));
    while (d <= endDate) {
      const day = d.getDay();
      const dateKey = d.toISOString().slice(0, 10);
      if (day !== 0 && day !== 6 && !holidayDates.has(dateKey)) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  };

  const approveLeave = async (leave: any) => {
    setLeaveActionLoadingId(leave.id);
    setLeaveMsg(null);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const notes = leaveHrNotes[leave.id]?.trim() || null;

      const { error } = await supabase
        .from('leave_requests')
        .update({ status: 'Approved', hr_notes: notes, reviewed_by: currentUser?.id, reviewed_at: new Date().toISOString() })
        .eq('id', leave.id);
      if (error) throw error;

      // NOTE: leave credits are NOT deducted here anymore. Approving just
      // creates one 'Pending' leave_request_days row per weekday in range.
      // Each day only turns into an actual credit deduction later, once we
      // can confirm the employee didn't time in that day (see
      // settle_leave_day / settle_overdue_leave_days in Supabase, called
      // from the HR and Employee dashboards on load, plus a DB trigger that
      // fires the moment an employee times in).
      const { error: genError } = await supabase.rpc('generate_leave_request_days', {
        p_leave_request_id: leave.id,
      });
      if (genError) throw genError;

      setLeaveMsg({ type: 'success', text: 'Leave request approved.' });
      await fetchLeaveRequests();
    } catch (err: any) {
      console.error('Error approving leave:', err);
      setLeaveMsg({ type: 'error', text: err?.message ?? 'Failed to approve leave.' });
    } finally {
      setLeaveActionLoadingId(null);
    }
  };

  const rejectLeave = async (leave: any) => {
    setLeaveActionLoadingId(leave.id);
    setLeaveMsg(null);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const notes = leaveHrNotes[leave.id]?.trim() || null;
      const { error } = await supabase
        .from('leave_requests')
        .update({ status: 'Rejected', hr_notes: notes, reviewed_by: currentUser?.id, reviewed_at: new Date().toISOString() })
        .eq('id', leave.id);
      if (error) throw error;
      setLeaveMsg({ type: 'success', text: 'Leave request rejected.' });
      await fetchLeaveRequests();
    } catch (err: any) {
      console.error('Error rejecting leave:', err);
      setLeaveMsg({ type: 'error', text: err?.message ?? 'Failed to reject leave.' });
    } finally {
      setLeaveActionLoadingId(null);
    }
  };

  // Converts a UTC ISO timestamp to its Philippine calendar date
  // ("YYYY-MM-DD"). Comparing this instead of the raw UTC prefix avoids
  // misfiling records near midnight (PH is UTC+8, so a log_time_in of
  // "2026-07-05T17:30:00Z" is already July 6 in Manila).
  const toManilaDateString = (iso: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(iso));

  // Cutoff key format: "YYYY-MM:H1" (days 1-15) or "YYYY-MM:H2" (days
  // 16 to end of month) -- the standard PH semi-monthly payroll split.
  const matchesCutoff = (manilaDate: string, cutoffKey: string) => {
    const [ym, half] = cutoffKey.split(':');
    if (!manilaDate.startsWith(ym)) return false;
    const day = parseInt(manilaDate.split('-')[2], 10);
    return half === 'H1' ? day <= 15 : day >= 16;
  };

  // Filter Logic -- a chosen cutoff period takes priority over the
  // single-date filter, so HR can switch to payroll-period review
  // without the two filters fighting each other.
  const filteredAttendance = useMemo(() => {
    return attendance.filter((log) => {
      const matchesSearch = log.profiles?.full_name
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase());

      let matchesFilter = true;
      if (cutoffFilter) {
        matchesFilter = !!log.log_date && matchesCutoff(log.log_date, cutoffFilter);
      } else if (selectedDate) {
        matchesFilter = log.log_date === selectedDate;
      }

      return matchesSearch && matchesFilter;
    });
  }, [attendance, searchTerm, selectedDate, cutoffFilter]);

  // Reset to page 1 whenever the filtered set changes shape (new search,
  // date, or cutoff), so we don't land on a now-empty page. Adjusting
  // state during render (rather than in a useEffect) avoids an extra
  // render pass -- this is the pattern React recommends for "reset state
  // when a prop/dependency changes".
  const [prevAttendanceFilters, setPrevAttendanceFilters] = useState([searchTerm, selectedDate, cutoffFilter]);
  if (
    prevAttendanceFilters[0] !== searchTerm ||
    prevAttendanceFilters[1] !== selectedDate ||
    prevAttendanceFilters[2] !== cutoffFilter
  ) {
    setPrevAttendanceFilters([searchTerm, selectedDate, cutoffFilter]);
    setAttendancePage(1);
  }

  const attendanceTotalPages = Math.max(1, Math.ceil(filteredAttendance.length / PAGE_SIZE));
  const paginatedAttendance = filteredAttendance.slice(
    (attendancePage - 1) * PAGE_SIZE,
    attendancePage * PAGE_SIZE
  );

  const employeesTotalPages = Math.max(1, Math.ceil(profiles.length / PAGE_SIZE));
  const paginatedProfiles = profiles.slice(
    (employeesPage - 1) * PAGE_SIZE,
    employeesPage * PAGE_SIZE
  );

  // Minutes late for a single Late log, derived from the configurable
  // late cutoff (Super Admin -> App Settings) -- same threshold
  // app/api/time-in/route.ts uses to decide Present vs Late, since we
  // don't store an exact minutes-late value anywhere. Status is
  // compared case-insensitively since it can also be hand-edited
  // directly in Supabase (e.g. "late" instead of "Late").
  const getMinutesLate = (timeInIso: string) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .formatToParts(new Date(timeInIso))
      .reduce((acc: any, p) => { acc[p.type] = p.value; return acc; }, {});
    const minutesSinceMidnight = parseInt(parts.hour, 10) * 60 + parseInt(parts.minute, 10);
    const cutoffMinutes = lateCutoffHour * 60 + lateCutoffMinute;
    return Math.max(0, minutesSinceMidnight - cutoffMinutes);
  };

  const formatLateDuration = (mins: number) => {
    if (mins <= 0) return '0 min';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h === 0 ? `${m} min` : `${h}h ${m}m`;
  };

  // Total minutes late across whatever's currently filtered (name search,
  // date, and/or cutoff) -- e.g. search an employee's name to see just
  // their accumulated late minutes for the selected period.
  const filteredTotalLateMinutes = useMemo(
    () =>
      filteredAttendance
        .filter((log) => log.status?.toLowerCase() === 'late' && log.time_in)
        .reduce((sum, log) => sum + getMinutesLate(log.time_in as string), 0),
    [filteredAttendance, lateCutoffHour, lateCutoffMinute]
  );

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

  const formatCutoffLabel = (key: string) => {
    const [ym, half] = key.split(':');
    const [y, m] = ym.split('-').map(Number);
    const monthName = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long' });
    const finalDay = new Date(y, m, 0).getDate();
    return half === 'H1' ? `${monthName} 1-15, ${y}` : `${monthName} 16-${finalDay}, ${y}`;
  };

  // Just the distinct months (no H1/H2 duplication) for a shorter month
  // picker -- the half is chosen separately via two pill buttons.
  const availableCutoffMonths = useMemo(() => {
    const months = new Set<string>();
    availableCutoffs.forEach((c) => months.add(c.split(':')[0]));
    return Array.from(months).sort().reverse();
  }, [availableCutoffs]);

  const [selectedCutoffYm, selectedCutoffHalf] = cutoffFilter ? (cutoffFilter.split(':') as [string, string]) : ['', ''];

  const formatCutoffMonthOnly = (ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const handleCutoffMonthChange = (ym: string) => {
    if (!ym) { setCutoffFilter(''); return; }
    setCutoffFilter(`${ym}:${selectedCutoffHalf || 'H1'}`);
    setSelectedDate('');
  };

  const handleCutoffHalfChange = (half: 'H1' | 'H2') => {
    if (!selectedCutoffYm) return;
    setCutoffFilter(`${selectedCutoffYm}:${half}`);
    setSelectedDate('');
  };

  // Opens the choice modal — HR picks Edit Profile or Payslips
  const openProfileChoice = (p: Profile) => {
    setSelectedProfile(p);
    setModalMode('choice');
  };

  // Opens the Edit Profile modal for the selected profile
  const openEdit = async (p: Profile) => {
    setEditing({
      id: p.id,
      full_name: p.full_name || '',
      employee_id: p.employee_id || '',
      designation: p.designation || '',
      employee_email: p.employee_email || '',
      sss_number: '',
      philhealth_number: '',
      pagibig_number: '',
      tin_number: '',
      hired_date: '',
      employment_status: '',
    });

    // Reset avatar picker state and load the employee's current photo
    // (if any) as the starting preview.
    setAvatarFile(null);
    setAvatarPreview(null);
    setCurrentAvatarUrl(p.avatar_url ?? null);
    if (avatarInputRef.current) avatarInputRef.current.value = '';

    setModalMode('edit');

    const { data: govIdData } = await supabase
      .from('employee_government_ids')
      .select('sss_number, philhealth_number, pagibig_number, tin_number, hired_date, employment_status')
      .eq('user_id', p.id)
      .maybeSingle();

    if (govIdData) {
      setEditing((prev) => ({
        ...prev,
        sss_number: govIdData.sss_number ?? '',
        philhealth_number: govIdData.philhealth_number ?? '',
        pagibig_number: govIdData.pagibig_number ?? '',
        tin_number: govIdData.tin_number ?? '',
        hired_date: govIdData.hired_date ?? '',
        employment_status: govIdData.employment_status ?? '',
      }));
    }
  };

  // Opens the Payslips modal for the selected profile
  const openPayslipsModal = (p: Profile) => {
    setPayslipFile(null);
    setPayslipCutoff('');
    setPayslipMsg(null);
    setPublishMsg(null);
    if (payslipFileRef.current) payslipFileRef.current.value = '';
    fetchEmployeePayslips(p.id);
    setModalMode('payslips');
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedProfile(null);
  };

  // Translates raw Postgres error text into a friendly, specific
  // message, instead of showing the raw "duplicate key value violates
  // unique constraint ..." text.
  const getFriendlyErrorMessage = (rawMessage: string): string => {
    const msg = rawMessage.toLowerCase();
    if (msg.includes('profiles_employee_id_key') || (msg.includes('employee_id') && msg.includes('duplicate'))) {
      return 'This Employee ID is already used by another account. Please use a different one.';
    }
    if (msg.includes('duplicate key value violates unique constraint')) {
      return 'Another account is already using the same information. Please check and try again.';
    }
    return rawMessage;
  };

  // Real-time warning: flags if the Employee ID being typed in the edit
  // modal already belongs to a DIFFERENT employee, so HR sees it before
  // saving instead of only after a failed update.
  const editingEmployeeIdConflict = useMemo(() => {
    const trimmed = editing.employee_id.trim().toLowerCase();
    if (!trimmed) return null;
    const match = profiles.find(
      (p) =>
        p.employee_id?.trim().toLowerCase() === trimmed && p.id !== editing.id
    );
    return match ? match.full_name : null;
  }, [editing.employee_id, editing.id, profiles]);

  const saveEdit = async () => {
    if (!editing.id) return;
    setSaveLoading(true);

    // Upload the new avatar first (if HR picked one) so we have the
    // final public URL ready to include in the same profiles update
    // below -- avoids a second round-trip / partial-save state.
    let nextAvatarUrl: string | undefined = undefined;
    if (avatarFile) {
      setAvatarUploading(true);
      const ext = avatarFile.name.split('.').pop() || 'jpg';
      const filePath = `${editing.id}/avatar_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, avatarFile, { contentType: avatarFile.type, upsert: false });

      if (uploadError) {
        console.error('Error uploading avatar:', uploadError);
        setErrorMsg(getFriendlyErrorMessage(uploadError.message));
        setAvatarUploading(false);
        setSaveLoading(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      nextAvatarUrl = publicUrlData.publicUrl;
      setAvatarUploading(false);
    }

    const updatePayload: Record<string, any> = {
      full_name: editing.full_name,
      employee_id: editing.employee_id,
      designation: editing.designation,
      employee_email: editing.employee_email.trim() || null,
    };
    if (nextAvatarUrl !== undefined) updatePayload.avatar_url = nextAvatarUrl;

    const { error } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', editing.id);

    if (error) {
      console.error('Error saving profile:', error);
      setErrorMsg(getFriendlyErrorMessage(error.message));
      setSaveLoading(false);
      return;
    }

    // Upsert government IDs into their own table -- only if HR actually
    // filled in at least one of the fields.
    if (
      editing.sss_number.trim() ||
      editing.philhealth_number.trim() ||
      editing.pagibig_number.trim() ||
      editing.tin_number.trim() ||
      editing.hired_date.trim() ||
      editing.employment_status.trim()
    ) {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const { error: govIdError } = await supabase
        .from('employee_government_ids')
        .upsert({
          user_id: editing.id,
          sss_number: editing.sss_number.trim() || null,
          philhealth_number: editing.philhealth_number.trim() || null,
          pagibig_number: editing.pagibig_number.trim() || null,
          tin_number: editing.tin_number.trim() || null,
          hired_date: editing.hired_date.trim() || null,
          employment_status: editing.employment_status.trim() || null,
          updated_at: new Date().toISOString(),
          updated_by: currentUser?.id ?? null,
        }, { onConflict: 'user_id' });

      if (govIdError) {
        console.error('Error saving government IDs:', govIdError);
        setErrorMsg(getFriendlyErrorMessage(govIdError.message));
        setSaveLoading(false);
        return;
      }
    }

    await refreshAllData();
    setModalMode(null);
    setSaveLoading(false);
  };

  const statusTagClass = (s: string | null) => {
    const v = s?.toLowerCase() ?? '';
    if (v === 'late') return 'tag-late';
    if (v === 'excused') return 'tag-excused';
    if (v === 'absent') return 'tag-absent';
    if (v.includes('leave')) return 'tag-leave';
    return 'tag-present';
  };

  // Fetch payslips for the employee currently open in the edit modal.
  const fetchEmployeePayslips = async (userId: string) => {
    setEmployeePayslipsLoading(true);
    const { data, error } = await supabase
      .from('payslips')
      .select('id, cutoff_label, file_name, file_path, uploaded_at, published, published_at, acknowledged_at')
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false });
    if (error) console.error('Error fetching employee payslips:', error);
    setEmployeePayslips((data || []) as { id: string; cutoff_label: string; file_name: string; file_path: string; uploaded_at: string; published: boolean; published_at: string | null; acknowledged_at: string | null }[]);
    setEmployeePayslipsLoading(false);
  };

  // --- Publish payslip (triggers the payslip email send) ---
  // Marks the payslip published (visible/emailed) and asks the local API
  // route to fire the n8n webhook so the email goes out right away, instead
  // of waiting for the workflow's 10-minute polling fallback.
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishMsg, setPublishMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const publishPayslip = async (payslipId: string, employeeId: string) => {
    setPublishingId(payslipId);
    setPublishMsg(null);
    try {
      const res = await fetch('/api/publish-payslip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payslip_id: payslipId }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to publish payslip.');

      setPublishMsg({
        type: 'success',
        text: result.emailTriggered
          ? 'Published! Email is being sent now.'
          : 'Published, but the instant email trigger failed -- it will still go out within 10 minutes via the automatic check.',
      });
      await fetchEmployeePayslips(employeeId);
    } catch (err: any) {
      console.error('Error publishing payslip:', err);
      setPublishMsg({ type: 'error', text: err?.message ?? 'Failed to publish payslip.' });
    } finally {
      setPublishingId(null);
    }
  };

  // Generate cutoff options: current month ± 3 months, both halves.
  const generateCutoffOptions = () => {
    const options: { value: string; label: string }[] = [];
    const now = new Date();
    for (let offset = -3; offset <= 3; offset++) {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const monthName = d.toLocaleDateString('en-US', { month: 'long' });
      const finalDay = new Date(y, d.getMonth() + 1, 0).getDate();
      options.push({ value: `${y}-${m}:H1`, label: `${monthName} 1-15, ${y}` });
      options.push({ value: `${y}-${m}:H2`, label: `${monthName} 16-${finalDay}, ${y}` });
    }
    return options.reverse();
  };

  const uploadPayslip = async (employeeId: string) => {
    if (!payslipFile || !payslipCutoff) {
      setPayslipMsg({ type: 'error', text: 'Please select a file and a cutoff period.' });
      return;
    }
    if (payslipFile.type !== 'application/pdf') {
      setPayslipMsg({ type: 'error', text: 'Only PDF files are allowed.' });
      return;
    }
    setPayslipUploading(true);
    setPayslipMsg(null);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const cutoffOption = generateCutoffOptions().find(o => o.value === payslipCutoff);
      const cutoffLabel = cutoffOption?.label || payslipCutoff;
      const filePath = `${employeeId}/${payslipCutoff.replace(':', '_')}_${Date.now()}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from('payslips')
        .upload(filePath, payslipFile, { contentType: 'application/pdf', upsert: false });
      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('payslips').insert([{
        user_id: employeeId,
        cutoff_period: payslipCutoff,
        cutoff_label: cutoffLabel,
        file_path: filePath,
        file_name: payslipFile.name,
        uploaded_by: currentUser?.id ?? null,
      }]);
      if (dbError) {
        await supabase.storage.from('payslips').remove([filePath]);
        throw dbError;
      }

      setPayslipMsg({ type: 'success', text: `Payslip uploaded for ${cutoffLabel}.` });
      setPayslipFile(null);
      setPayslipCutoff('');
      if (payslipFileRef.current) payslipFileRef.current.value = '';
      await fetchEmployeePayslips(employeeId);
    } catch (err: any) {
      console.error('Error uploading payslip:', err);
      setPayslipMsg({ type: 'error', text: err?.message ?? 'Failed to upload payslip.' });
    } finally {
      setPayslipUploading(false);
    }
  };

  const deletePayslip = async (payslipId: string, filePath: string, employeeId: string) => {
    if (!confirm('Delete this payslip? This cannot be undone.')) return;
    try {
      await supabase.storage.from('payslips').remove([filePath]);
      const { error } = await supabase.from('payslips').delete().eq('id', payslipId);
      if (error) throw error;
      await fetchEmployeePayslips(employeeId);
    } catch (err: any) {
      console.error('Error deleting payslip:', err);
      alert('Failed to delete payslip: ' + err.message);
    }
  };

  const todayManila = useMemo(() => {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' });
    return fmt.format(new Date()); // "YYYY-MM-DD"
  }, []);

  const todaysLogs = useMemo(
    () => attendance.filter((log) => log.time_in && toManilaDateString(log.time_in) === todayManila),
    [attendance, todayManila]
  );
  const presentTodayCount = todaysLogs.length;
  const lateTodayCount = todaysLogs.filter((l) => l.status?.toLowerCase() === 'late').length;
  const lowLeaveCreditsCount = leaveCreditsData.filter((employee) => {
    if (employee.employment_status !== 'Regular') return false;
    const total = employee.total_credits ?? fallbackLeaveCredits;
    return total - (employee.used_credits ?? 0) <= 3;
  }).length;
  const upcomingHolidaysCount = holidays.filter((holiday) => holiday.holiday_date >= todayManila).length;
  const announcementModuleLabel = announcementUpdatedAt
    ? `Updated ${new Date(announcementUpdatedAt).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' })}`
    : 'Create an announcement';

  // Employees with no time-in yet today. This is intentionally a live,
  // frontend-only view -- it does NOT create a real 'Absent' attendance_logs
  // row (that only happens for days that have already fully passed, via
  // settle_overdue_absences). It just naturally clears an employee off this
  // list the moment their time-in shows up in `attendance`.
  // Employees on an approved leave that covers today shouldn't show up as
  // "not yet timed in" -- they're expected to be out, not tardy/absent.
  const onApprovedLeaveToday = useMemo(
    () =>
      new Set(
        leaveRequests
          .filter((l) => l.status === 'Approved' && l.start_date <= todayManila && l.end_date >= todayManila)
          .map((l) => l.employee?.id)
      ),
    [leaveRequests, todayManila]
  );

  const notYetTimedInToday = useMemo(
    () => profiles.filter((p) => !todaysLogs.some((log) => log.user_id === p.id) && !onApprovedLeaveToday.has(p.id)),
    [profiles, todaysLogs, onApprovedLeaveToday]
  );
  const onLeaveTodayCount = onApprovedLeaveToday.size;

  // Light auto-refresh so this list (and the Present/Late header counts)
  // update on their own through the day as employees time in, without
  // requiring a manual page reload.
  useEffect(() => {
    const interval = setInterval(() => {
      refreshAllData();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const initials = (name: string | null) =>
    (name || '?')
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  // Human-friendly label + formatted before/after times for a dispute,
  // regardless of whether it's a TimeIn or TimeOut dispute -- used in
  // both the pending list and the history detail view.
  const disputeTypeLabel = (d: any) => {
    const dType = d.dispute_type || 'TimeIn';
    if (dType === 'TimeOut') return 'Missed time-out';
    return d.attendance_log_id ? 'Late tag dispute' : 'Missed time-in';
  };
  const disputeOriginal = (d: any) => ((d.dispute_type || 'TimeIn') === 'TimeOut' ? d.original_time_out : d.original_time_in);
  const disputeClaimed = (d: any) => ((d.dispute_type || 'TimeIn') === 'TimeOut' ? d.claimed_time_out : d.claimed_time_in);
  const disputeFieldLabel = (d: any) => ((d.dispute_type || 'TimeIn') === 'TimeOut' ? 'Time-Out' : 'Time-In');
  const formatPh = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const globalEmployeeMatches = useMemo(() => {
    const query = globalEmployeeSearch.trim().toLowerCase();
    if (!query) return [];
    return profiles
      .filter((profile) =>
        profile.full_name?.toLowerCase().includes(query) ||
        profile.employee_id?.toLowerCase().includes(query) ||
        profile.designation?.toLowerCase().includes(query)
      )
      .slice(0, 8);
  }, [globalEmployeeSearch, profiles]);

  const quickViewAttendance = useMemo(() => {
    if (!quickViewProfile) return [];
    return attendance.filter((log) => log.user_id === quickViewProfile.id).slice(0, 5);
  }, [attendance, quickViewProfile]);
  const quickViewCredits = quickViewProfile
    ? leaveCreditsData.find((entry) => entry.id === quickViewProfile.id) ?? null
    : null;

  const calendarData = useMemo(() => {
    const [year, month] = leaveCalendarMonth.split('-').map(Number);
    if (!year || !month) return { blanks: 0, days: [] as { date: string; day: number; leaves: any[]; holiday: { id: string; holiday_date: string; name: string } | null }[] };
    const daysInMonth = new Date(year, month, 0).getDate();
    const blanks = new Date(year, month - 1, 1).getDay();
    const days = Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const date = `${leaveCalendarMonth}-${String(day).padStart(2, '0')}`;
      return {
        date,
        day,
        leaves: leaveRequests.filter((leave) => leave.status === 'Approved' && leave.start_date <= date && leave.end_date >= date),
        holiday: holidays.find((holiday) => holiday.holiday_date === date) ?? null,
      };
    });
    return { blanks, days };
  }, [leaveCalendarMonth, leaveRequests, holidays]);
  const selectedCalendarDay = selectedCalendarDate
    ? calendarData.days.find((day) => day.date === selectedCalendarDate) ?? null
    : null;

  const attendanceInsights = useMemo(() => {
    const currentMonth = todayManila.slice(0, 7);
    const [year, month] = currentMonth.split('-').map(Number);
    const previousDate = new Date(year, month - 2, 1);
    const previousMonth = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, '0')}`;
    const summarize = (monthKey: string) => {
      const logs = attendance.filter((log) => log.log_date?.startsWith(monthKey));
      const late = logs.filter((log) => log.status?.toLowerCase() === 'late').length;
      const absent = logs.filter((log) => log.status?.toLowerCase() === 'absent').length;
      const leave = logs.filter((log) => log.status?.toLowerCase().includes('leave')).length;
      const worked = logs.filter((log) => {
        const status = log.status?.toLowerCase() ?? '';
        return status !== 'absent' && !status.includes('leave');
      }).length;
      const total = worked + absent + leave;
      return { logs, late, absent, leave, worked, attendanceRate: total ? Math.round((worked / total) * 100) : 0 };
    };
    const current = summarize(currentMonth);
    const previous = summarize(previousMonth);
    const lateByEmployee = new Map<string, number>();
    current.logs.filter((log) => log.status?.toLowerCase() === 'late').forEach((log) => {
      const name = log.profiles?.full_name || 'Unknown';
      lateByEmployee.set(name, (lateByEmployee.get(name) ?? 0) + 1);
    });
    const topLateEmployees = Array.from(lateByEmployee.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { currentMonth, current, previous, topLateEmployees };
  }, [attendance, todayManila]);

  const pendingDisputesCount = disputes.filter((dispute) => dispute.status === 'Pending').length;
  const pendingLeaveCount = leaveRequests.filter((leave) => leave.status === 'Pending').length;

  const getLeaveBalance = (userId?: string) => {
    const employee = leaveCreditsData.find((entry) => entry.id === userId);
    if (!employee || employee.employment_status !== 'Regular') return null;
    return (employee.total_credits ?? fallbackLeaveCredits) - (employee.used_credits ?? 0);
  };

  const scrollToDashboardSection = (id: string) => {
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  return (
    <main className="min-h-screen p-3 sm:p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-3 sm:space-y-4 md:space-y-5">
        {/* Header */}
        <header className="branding-box flex items-center justify-between gap-3 !p-3 sm:!p-4">
          <div>
            <h1 className="text-base sm:text-lg md:text-2xl leading-tight">HAMDAN ENGINEERING</h1>
            <p className="text-slate-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mt-0.5">HR Portal</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-4">
              <div className="text-center"><p className="stat-number text-xl text-slate-900 leading-none">{profiles.length}</p><p className="text-slate-600 text-[9px] font-bold uppercase tracking-widest mt-0.5">Employees</p></div>
              <div className="w-px h-8 bg-slate-900/10"/>
              <div className="text-center"><p className="stat-number text-xl text-green-600 leading-none">{presentTodayCount}</p><p className="label-branded mt-0.5 mb-0">Present</p></div>
              <div className="w-px h-8 bg-slate-900/10"/>
              <div className="text-center"><p className="stat-number text-xl text-orange-600 leading-none">{lateTodayCount}</p><p className="label-branded mt-0.5 mb-0">Late</p></div>
            </div>
            <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} className="text-slate-500 font-medium text-xs hover:text-red-600 transition whitespace-nowrap">Sign out</button>
          </div>
        </header>

        {errorMsg && <div className="p-3 rounded-xl text-xs font-bold bg-red-50 text-red-700">{errorMsg}</div>}

        {/* Global employee search + live refresh */}
        <div className="card-style !p-3 flex flex-col sm:flex-row sm:items-center gap-3 relative z-30">
          <div className="relative flex-1 min-w-0">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="search"
              value={globalEmployeeSearch}
              onChange={(e) => setGlobalEmployeeSearch(e.target.value)}
              placeholder="Search employee name, ID, or designation..."
              className="input-field !pl-9 !py-2 !text-xs !min-h-0 w-full"
            />
            {globalEmployeeSearch.trim() && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden max-h-72 overflow-y-auto z-50">
                {globalEmployeeMatches.length === 0 ? (
                  <p className="p-4 text-slate-400 text-xs text-center">No matching employee found.</p>
                ) : globalEmployeeMatches.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => { setQuickViewProfile(profile); setGlobalEmployeeSearch(''); }}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0 transition"
                  >
                    <span className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0">{initials(profile.full_name)}</span>
                    <span className="min-w-0"><span className="block text-xs font-bold text-slate-900 truncate">{profile.full_name || 'Unknown'}</span><span className="block text-[10px] text-slate-400 truncate">{profile.employee_id || 'No ID'} · {profile.designation || 'No designation'}</span></span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0">
            <span className="text-[10px] text-slate-400 font-medium">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
              {lastUpdatedAt ? `Updated ${lastUpdatedAt.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' })}` : 'Loading live data'}
            </span>
            <button type="button" onClick={refreshAllData} disabled={refreshing} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold hover:bg-slate-200 disabled:opacity-50 transition">
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {/* Daily attendance overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {[
            { label: 'Present', value: presentTodayCount, tone: 'text-emerald-600', icon: <CheckCircle2 size={15}/> },
            { label: 'Late', value: lateTodayCount, tone: 'text-orange-600', icon: <Clock3 size={15}/> },
            { label: 'On Leave', value: onLeaveTodayCount, tone: 'text-blue-600', icon: <CalendarClock size={15}/> },
            { label: 'Not Timed In', value: notYetTimedInToday.length, tone: 'text-amber-600', icon: <AlertTriangle size={15}/> },
          ].map((stat) => (
            <div key={stat.label} className="card-style !p-3 flex items-center gap-2.5 min-w-0">
              <span className={`${stat.tone} flex-shrink-0`}>{stat.icon}</span>
              <span className="min-w-0"><span className={`stat-number block text-lg leading-none ${stat.tone}`}>{stat.value}</span><span className="block text-slate-400 text-[9px] font-bold uppercase tracking-wide mt-1 truncate">{stat.label}</span></span>
            </div>
          ))}
        </div>

        {/* MODULES -- compact icon buttons that open their own modal,
            same pattern as the Super Admin dashboard, so these don't
            add another full-width accordion section to scroll past. */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={openLeaveCreditsModal}
            className="card-style !p-3 sm:!p-4 flex items-center gap-3 text-left hover:bg-slate-50 hover:-translate-y-0.5 transition min-h-[76px]"
          >
            <span className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0"><CalendarClock size={18} strokeWidth={2.4}/></span>
            <span className="min-w-0"><span className="block font-bold text-slate-900 text-xs">Leave Credits</span><span className={`block text-[10px] mt-0.5 truncate ${lowLeaveCreditsCount > 0 ? 'text-orange-600 font-bold' : 'text-slate-400'}`}>{leaveCreditsLoading ? 'Checking balances...' : lowLeaveCreditsCount > 0 ? `${lowLeaveCreditsCount} low balance${lowLeaveCreditsCount === 1 ? '' : 's'}` : 'Balances healthy'}</span></span>
          </button>

          <button
            type="button"
            onClick={() => { setExportModalOpen(true); setExportMsg(null); if (!exportCutoff) setExportCutoff(availableCutoffs[0] || ''); }}
            className="card-style !p-3 sm:!p-4 flex items-center gap-3 text-left hover:bg-slate-50 hover:-translate-y-0.5 transition min-h-[76px]"
          >
            <span className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0"><FileDown size={18} strokeWidth={2.4}/></span>
            <span className="min-w-0"><span className="block font-bold text-slate-900 text-xs">Export Reports</span><span className="block text-slate-400 text-[10px] mt-0.5">CSV &amp; PDF</span></span>
          </button>

          <button
            type="button"
            onClick={() => setAnnouncementOpen(true)}
            className="card-style !p-3 sm:!p-4 flex items-center gap-3 text-left hover:bg-slate-50 hover:-translate-y-0.5 transition min-h-[76px]"
          >
            <span className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0"><Megaphone size={18} strokeWidth={2.4}/></span>
            <span className="min-w-0"><span className="block font-bold text-slate-900 text-xs">Announcements</span><span className="block text-slate-400 text-[10px] mt-0.5 truncate">{announcementModuleLabel}</span></span>
          </button>

          <button
            type="button"
            onClick={() => { if (!holidaysOpen) toggleHolidays(); }}
            className="card-style !p-3 sm:!p-4 flex items-center gap-3 text-left hover:bg-slate-50 hover:-translate-y-0.5 transition min-h-[76px]"
          >
            <span className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0"><CalendarRange size={18} strokeWidth={2.4}/></span>
            <span className="min-w-0"><span className="block font-bold text-slate-900 text-xs">Holidays</span><span className="block text-slate-400 text-[10px] mt-0.5">{holidaysLoading ? 'Checking calendar...' : `${upcomingHolidaysCount} upcoming`}</span></span>
          </button>

          <button
            type="button"
            onClick={() => setEmployeesListOpen(true)}
            className="card-style !p-3 sm:!p-4 flex items-center gap-3 text-left hover:bg-slate-50 hover:-translate-y-0.5 transition min-h-[76px]"
          >
            <span className="w-10 h-10 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center flex-shrink-0"><UsersRound size={18} strokeWidth={2.4}/></span>
            <span className="min-w-0"><span className="block font-bold text-slate-900 text-xs">Employees</span><span className="block text-slate-400 text-[10px] mt-0.5">{profiles.length} total</span></span>
          </button>

          <button
            type="button"
            onClick={() => { setSelectedCalendarDate(null); setLeaveCalendarOpen(true); }}
            className="card-style !p-3 sm:!p-4 flex items-center gap-3 text-left hover:bg-slate-50 hover:-translate-y-0.5 transition min-h-[76px]"
          >
            <span className="w-10 h-10 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center flex-shrink-0"><CalendarRange size={18} strokeWidth={2.4}/></span>
            <span className="min-w-0"><span className="block font-bold text-slate-900 text-xs">Leave Calendar</span><span className="block text-slate-400 text-[10px] mt-0.5">Approved leaves &amp; holidays</span></span>
          </button>
        </div>

        {/* Priority action center */}
        <section id="action-center" className="card-style !p-4 scroll-mt-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="mb-0 text-sm">Action Center</h3>
              <p className="text-slate-400 text-[10px] mt-0.5">Items that may need HR attention today</p>
            </div>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 rounded-full px-2.5 py-1">
              {pendingDisputesCount + pendingLeaveCount + lowLeaveCreditsCount} open
            </span>
          </div>
          {pendingDisputesCount + pendingLeaveCount + lowLeaveCreditsCount === 0 ? (
            <div className="flex items-center justify-center gap-2 py-5 rounded-2xl border-2 border-dashed border-emerald-100 bg-emerald-50/50 text-emerald-700">
              <CheckCircle2 size={17}/><span className="text-xs font-bold">All caught up — no pending HR actions.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { label: 'Pending Disputes', count: pendingDisputesCount, tone: 'text-blue-600 bg-blue-50', action: () => scrollToDashboardSection('attendance-disputes') },
                { label: 'Leave Requests', count: pendingLeaveCount, tone: 'text-violet-600 bg-violet-50', action: () => scrollToDashboardSection('leave-requests') },
                { label: 'Low Leave Credits', count: lowLeaveCreditsCount, tone: 'text-orange-600 bg-orange-50', action: openLeaveCreditsModal },
              ].map((item) => (
                <button key={item.label} type="button" onClick={item.action} className="p-3 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-slate-100 transition text-left">
                  <span className={`inline-flex min-w-7 h-7 items-center justify-center rounded-full px-2 text-xs font-extrabold ${item.tone}`}>{item.count}</span>
                  <span className="block text-slate-700 text-[10px] font-bold mt-2">{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Attendance insights moved near the top for faster daily review. */}
        <section className="card-style !p-4">
          <button type="button" onClick={() => setAttendanceInsightsOpen((open) => !open)} className="w-full flex items-center justify-between gap-2 text-left">
            <div><h3 className="text-sm mb-0">Attendance Insights</h3><p className="text-slate-400 text-[10px] mt-0.5">Current-month performance and repeated lateness</p></div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`text-slate-400 transition-transform ${attendanceInsightsOpen ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {attendanceInsightsOpen && (
            <div className="pt-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
                {[
                  { label: 'Attendance Rate', value: `${attendanceInsights.current.attendanceRate}%`, tone: 'text-emerald-600' },
                  { label: 'Late Records', value: attendanceInsights.current.late, tone: 'text-orange-600' },
                  { label: 'Absent Records', value: attendanceInsights.current.absent, tone: 'text-rose-600' },
                  { label: 'Leave Days', value: attendanceInsights.current.leave, tone: 'text-blue-600' },
                ].map((item) => <div key={item.label} className="p-3 rounded-xl bg-slate-50 border border-slate-100"><p className={`stat-number text-xl ${item.tone}`}>{item.value}</p><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-1">{item.label}</p></div>)}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl border border-slate-100 bg-slate-50">
                  <p className="text-xs font-bold text-slate-800 mb-2">Compared with previous month</p>
                  {[['Late', attendanceInsights.current.late, attendanceInsights.previous.late], ['Absent', attendanceInsights.current.absent, attendanceInsights.previous.absent], ['Worked', attendanceInsights.current.worked, attendanceInsights.previous.worked]].map(([label, current, previous]) => { const delta = Number(current) - Number(previous); return <div key={String(label)} className="flex items-center justify-between text-xs py-1"><span className="text-slate-500">{label}</span><span className="font-bold text-slate-800">{current} <small className="text-slate-400 ml-1">{delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${delta}`}</small></span></div>; })}
                </div>
                <div className="p-3 rounded-2xl border border-slate-100 bg-slate-50">
                  <p className="text-xs font-bold text-slate-800 mb-2">Most late this month</p>
                  {attendanceInsights.topLateEmployees.length === 0 ? <p className="text-xs text-slate-400">No late records this month.</p> : attendanceInsights.topLateEmployees.map(([name, count]) => <div key={name} className="flex items-center justify-between text-xs py-1"><span className="font-semibold text-slate-600 truncate">{name}</span><span className="font-bold text-orange-600">{count}</span></div>)}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Not Yet Timed In Today -- live view, not a permanent Absent tag */}
        {notYetTimedInToday.length > 0 && (
        <section id="not-yet-timed-in" className="card-style !p-4 scroll-mt-4">
          <h3 className="mb-0 text-sm">
            Not Yet Timed In Today
            <span className="block text-[10px] font-medium text-red-600 normal-case tracking-normal mt-0.5">
              {notYetTimedInToday.length} employee{notYetTimedInToday.length === 1 ? '' : 's'} — auto-updates as they time in
            </span>
          </h3>

          <div className="mt-4 space-y-1.5">
            {notYetTimedInToday.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 font-bold text-[9px] flex items-center justify-center flex-shrink-0">{initials(p.full_name)}</div>
                  <span className="font-bold text-slate-900 text-xs truncate">{p.full_name}</span>
                </div>
                {onApprovedLeaveToday.has(p.id) ? (
                  <span className="tag-leave flex-shrink-0">Leave</span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider text-amber-700 flex-shrink-0">Not Timed In</span>
                )}
              </div>
            ))}
          </div>
        </section>
        )}

        {/* EMPLOYEE QUICK VIEW MODAL */}
        {quickViewProfile && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-sm p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setQuickViewProfile(null); }}>
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

        {/* TEAM LEAVE CALENDAR MODAL */}
        {leaveCalendarOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setLeaveCalendarOpen(false); }}>
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

        {/* ANNOUNCEMENTS MODULE MODAL */}
        {announcementOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget && !announcementSaving) setAnnouncementOpen(false); }}
        >
        <section className="w-full max-w-2xl card-style shadow-2xl max-h-[90vh] flex flex-col !p-4 sm:!p-5" onMouseDown={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between gap-2 mb-4 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center"><Megaphone size={17} strokeWidth={2.4}/></span>
              <h3 className="mb-0 text-sm">
              Announcements
              {announcementUpdatedAt && (
                <span className="block text-[10px] font-medium text-slate-400 normal-case tracking-normal mt-0.5">
                  Last: {new Date(announcementUpdatedAt).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setAnnouncementOpen(false)}
              disabled={announcementSaving}
              className="text-slate-400 hover:text-slate-600 transition disabled:opacity-50"
              aria-label="Close announcements"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <div className="overflow-y-auto flex-1 pr-1">
          {announcementMsg && <div className={`p-2.5 rounded-xl text-xs font-bold mb-3 ${announcementMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{announcementMsg.text}</div>}
          <div className="min-h-[137px]">
          {announcementLoading ? <LoadingRow label="Loading..." /> : (
            <>
              <textarea className="input-field w-full min-h-[80px] resize-y text-sm" placeholder="Type the announcement that all employees will see..." value={announcementContent} onChange={(e) => setAnnouncementContent(e.target.value)} />

              <div className="mt-3">
                {(announcementImagePreview || (announcementImageUrl && !announcementRemoveImage)) ? (
                  <div className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a static asset */}
                    <img
                      src={announcementImagePreview || announcementImageUrl || ''}
                      alt="Announcement attachment"
                      className="max-h-56 max-w-full rounded-xl border border-slate-200 object-contain bg-slate-50"
                    />
                    <button
                      type="button"
                      onClick={clearAnnouncementImage}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white shadow border border-slate-200 flex items-center justify-center text-slate-500 hover:text-red-600 transition"
                      aria-label="Remove image"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ) : (
                  <label className="inline-flex items-center gap-1.5 text-blue-600 text-xs font-bold cursor-pointer hover:underline">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>
                    Add Photo (optional)
                    <input
                      ref={announcementImageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleAnnouncementImageChange(e.target.files?.[0] ?? null)}
                    />
                  </label>
                )}
              </div>

              <button onClick={publishAnnouncement} disabled={announcementSaving || !announcementContent.trim()} className="btn-primary mt-3 !py-2.5 !text-xs disabled:opacity-50">
                {announcementSaving ? <span className="flex items-center justify-center gap-2"><Spinner size="sm"/>Publishing...</span> : announcementId ? 'Update Announcement' : 'Publish Announcement'}
              </button>
            </>
          )}
          </div>
          </div>
          <button
            type="button"
            onClick={() => setAnnouncementOpen(false)}
            disabled={announcementSaving}
            className="mt-4 w-full py-3 rounded-full bg-slate-100 text-slate-600 font-medium text-sm hover:bg-slate-200 transition disabled:opacity-50 flex-shrink-0"
          >
            Close
          </button>
        </section>
        </div>
        )}

        {/* HOLIDAYS MODULE MODAL */}
        {holidaysOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4"
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

        {/* Disputes + Leave — side by side on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-5">

        {/* Attendance Disputes */}
        <section id="attendance-disputes" className="card-style !p-4 scroll-mt-4">
          <h3 className="mb-3 text-sm">Attendance Disputes</h3>
          {disputeMsg && <div className={`p-2.5 rounded-xl text-xs font-bold mb-3 ${disputeMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{disputeMsg.text}</div>}
          <div className="min-h-[160px]">
          {disputesLoading ? <LoadingRow label="Loading disputes..." /> : (
            <>
              <p className="label-branded mb-2">Pending</p>
              {disputes.filter((d) => d.status === 'Pending').length === 0
                ? <div className="flex items-center gap-2 p-3 rounded-xl border border-emerald-100 bg-emerald-50/50 text-emerald-700 text-xs font-bold mb-4"><CheckCircle2 size={15}/>All caught up — no pending disputes.</div>
                : <div className="space-y-2 mb-4">
                    {disputes.filter((d) => d.status === 'Pending').map((d) => (
                      <div
                        key={d.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => { setSelectedDisputeDetail(d); setDisputesHistoryModalOpen(true); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedDisputeDetail(d); setDisputesHistoryModalOpen(true); } }}
                        className="p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-100 hover:border-slate-200 transition focus:outline-none focus:ring-2 focus:ring-blue-200"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-xs">{d.employee?.full_name ?? 'Unknown'}</p>
                            <p className="text-slate-500 text-xs mt-0.5">{disputeTypeLabel(d)} · <span className="font-medium">{d.dispute_date}</span></p>
                            {disputeOriginal(d) && <p className="text-slate-400 text-xs">Was: <span className="font-bold text-slate-600">{formatPh(disputeOriginal(d))}</span></p>}
                            {disputeClaimed(d) && <p className="text-slate-400 text-xs">Claimed: <span className="font-bold text-slate-600">{formatPh(disputeClaimed(d))}</span></p>}
                            {d.reason && <p className="text-slate-400 text-[10px] italic mt-0.5">&ldquo;{d.reason}&rdquo;</p>}
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button onClick={(e) => { e.stopPropagation(); approveDispute(d); }} disabled={disputeActionLoadingId === d.id} className="text-xs font-bold bg-green-600 text-white px-3 py-1.5 rounded-full hover:bg-green-700 transition disabled:opacity-50">{disputeActionLoadingId === d.id ? '...' : 'Approve'}</button>
                            <button onClick={(e) => { e.stopPropagation(); rejectDispute(d); }} disabled={disputeActionLoadingId === d.id} className="text-xs font-bold bg-slate-200 text-slate-700 px-3 py-1.5 rounded-full hover:bg-slate-300 transition disabled:opacity-50">Reject</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
              }
              <p className="label-branded mb-2">Resolved</p>
              <button
                type="button"
                onClick={() => setDisputesHistoryModalOpen(true)}
                className="w-full flex items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition text-left"
              >
                <span className="text-slate-600 text-xs font-bold">View dispute history</span>
                <span className="text-slate-400 text-xs">{disputes.filter((d) => d.status !== 'Pending').length} resolved</span>
              </button>
            </>
          )}
          </div>
        </section>

        {/* Leave Requests */}
        <section id="leave-requests" className="card-style !p-4 scroll-mt-4">
          <h3 className="mb-3 text-sm">Leave Requests</h3>
          {leaveMsg && <div className={`p-2.5 rounded-xl text-xs font-bold mb-3 ${leaveMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{leaveMsg.text}</div>}
          <div className="min-h-[160px]">
          {leaveRequestsLoading ? <LoadingRow label="Loading leave requests..." /> : (
            <>
              <p className="label-branded mb-2">Pending</p>
              {leaveRequests.filter((l) => l.status === 'Pending').length === 0
                ? <div className="flex items-center gap-2 p-3 rounded-xl border border-emerald-100 bg-emerald-50/50 text-emerald-700 text-xs font-bold mb-4"><CheckCircle2 size={15}/>All caught up — no pending leave requests.</div>
                : <div className="space-y-2 mb-4">
                    {leaveRequests.filter((l) => l.status === 'Pending').map((l) => (
                      <div
                        key={l.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => { setSelectedLeaveDetail(l); setLeaveHistoryModalOpen(true); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedLeaveDetail(l); setLeaveHistoryModalOpen(true); } }}
                        className="p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-100 hover:border-slate-200 transition focus:outline-none focus:ring-2 focus:ring-blue-200"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-xs">{l.employee?.full_name ?? 'Unknown'}</p>
                            <p className="text-slate-500 text-xs mt-0.5"><span className="font-semibold">{l.leave_type}</span> · {l.start_date === l.end_date ? l.start_date : `${l.start_date} → ${l.end_date}`} · {countLeaveDays(l.start_date, l.end_date)} chargeable working day{countLeaveDays(l.start_date, l.end_date) === 1 ? '' : 's'}</p>
                            {getLeaveBalance(l.employee?.id) !== null && (
                              <p className={`text-[10px] font-bold mt-1 ${countLeaveDays(l.start_date, l.end_date) > Number(getLeaveBalance(l.employee?.id)) ? 'text-rose-600' : 'text-emerald-600'}`}>
                                Balance: {getLeaveBalance(l.employee?.id)} → estimated {Number(getLeaveBalance(l.employee?.id)) - countLeaveDays(l.start_date, l.end_date)} after approval
                              </p>
                            )}
                            {l.reason && <p className="text-slate-400 text-[10px] italic mt-0.5">&ldquo;{l.reason}&rdquo;</p>}
                            <input type="text" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} className="input-field !py-1.5 !text-xs !min-h-0 mt-1.5" placeholder="HR notes (optional)..." value={leaveHrNotes[l.id] ?? ''} onChange={(e) => setLeaveHrNotes((prev) => ({ ...prev, [l.id]: e.target.value }))} />
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button onClick={(e) => { e.stopPropagation(); approveLeave(l); }} disabled={leaveActionLoadingId === l.id} className="text-xs font-bold bg-green-600 text-white px-3 py-1.5 rounded-full hover:bg-green-700 transition disabled:opacity-50">{leaveActionLoadingId === l.id ? '...' : 'Approve'}</button>
                            <button onClick={(e) => { e.stopPropagation(); rejectLeave(l); }} disabled={leaveActionLoadingId === l.id} className="text-xs font-bold bg-slate-200 text-slate-700 px-3 py-1.5 rounded-full hover:bg-slate-300 transition disabled:opacity-50">Reject</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
              }
              <p className="label-branded mb-2">Resolved</p>
              <button
                type="button"
                onClick={() => setLeaveHistoryModalOpen(true)}
                className="w-full flex items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition text-left"
              >
                <span className="text-slate-600 text-xs font-bold">View leave history</span>
                <span className="text-slate-400 text-xs">{leaveRequests.filter((l) => l.status !== 'Pending').length} resolved</span>
              </button>
            </>
          )}
          </div>
        </section>

        </div>

        <div>
          {/* EMPLOYEES MODULE MODAL */}
          {employeesListOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4"
            onMouseDown={(e) => { if (e.target === e.currentTarget) setEmployeesListOpen(false); }}
          >
          <section className="w-full max-w-lg card-style shadow-2xl max-h-[90vh] flex flex-col !p-4 sm:!p-5" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2 mb-4 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center"><UsersRound size={17} strokeWidth={2.4}/></span>
                <h3 className="mb-0 text-sm">
                Employees
                <span className="block text-[10px] font-medium text-slate-400 normal-case tracking-normal mt-0.5">
                  {profiles.length} total
                </span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEmployeesListOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition"
                aria-label="Close employees"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="space-y-2 min-h-[220px] overflow-y-auto flex-1 pr-1">
              {loadingData && profiles.length === 0 && <LoadingRow label="Loading employees..." />}
              {!loadingData && profiles.length === 0 && <p className="text-slate-400 text-xs">No employees found.</p>}
              {paginatedProfiles.map((p) => (
                <button key={p.id} onClick={() => openProfileChoice(p)} className="w-full flex items-center gap-2.5 text-left p-3 rounded-2xl hover:bg-slate-50 border border-slate-100 transition">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-50 text-blue-600 font-bold text-[10px] flex items-center justify-center overflow-hidden">
                    {p.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a static asset
                      <img src={p.avatar_url} alt={p.full_name ?? 'Employee'} className="w-full h-full object-cover" />
                    ) : (
                      initials(p.full_name)
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 text-xs truncate">{p.full_name}</div>
                    <div className="text-blue-600 text-[10px] truncate">{p.designation || '---'}</div>
                  </div>
                </button>
              ))}
              {profiles.length > PAGE_SIZE && (
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setEmployeesPage((p) => Math.max(1, p - 1))}
                    disabled={employeesPage === 1}
                    className="text-xs font-bold text-blue-600 disabled:text-slate-300 disabled:cursor-not-allowed"
                  >
                    ← Prev
                  </button>
                  <span className="text-slate-400 text-[10px] font-medium">Page {employeesPage} of {employeesTotalPages}</span>
                  <button
                    type="button"
                    onClick={() => setEmployeesPage((p) => Math.min(employeesTotalPages, p + 1))}
                    disabled={employeesPage === employeesTotalPages}
                    className="text-xs font-bold text-blue-600 disabled:text-slate-300 disabled:cursor-not-allowed"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setEmployeesListOpen(false)}
              className="mt-4 w-full py-3 rounded-full bg-slate-100 text-slate-600 font-medium text-sm hover:bg-slate-200 transition flex-shrink-0"
            >
              Close
            </button>
          </section>
          </div>
          )}

          {/* Attendance History */}
          <section id="attendance-history" className="card-style overflow-hidden !p-0 scroll-mt-4">
            <button
              type="button"
              onClick={() => setAttendanceHistoryOpen((v) => !v)}
              className="w-full p-4 flex items-center justify-between gap-2"
            >
              <h3 className="text-sm mb-0">
                Attendance History
                {cutoffFilter ? <span className="block text-[10px] font-medium text-slate-400 normal-case tracking-normal mt-0.5">Showing {formatCutoffLabel(cutoffFilter)}</span>
                  : selectedDate && <span className="block text-[10px] font-medium text-slate-400 normal-case tracking-normal mt-0.5">{selectedDate === todayManila ? "Today's records" : `Records for ${selectedDate}`}</span>}
                {searchTerm && (
                  <span className="block text-[10px] font-bold text-red-600 normal-case tracking-normal mt-0.5">
                    {formatLateDuration(filteredTotalLateMinutes)} late total{cutoffFilter ? ` (${formatCutoffLabel(cutoffFilter)})` : selectedDate ? ` (${selectedDate})` : ''}
                  </span>
                )}
              </h3>
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                className={`text-slate-400 flex-shrink-0 transition-transform ${attendanceHistoryOpen ? 'rotate-180' : ''}`}
              >
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {attendanceHistoryOpen && (
            <>
            <div className="px-4 pb-4 border-b border-slate-100 flex flex-wrap gap-2 items-center">
              <input className="input-field !py-1.5 !text-xs !min-h-0 w-full sm:w-40" placeholder="Search name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              <select className="input-field !py-1.5 !text-xs !min-h-0 w-auto" value={selectedCutoffYm} onChange={(e) => handleCutoffMonthChange(e.target.value)}>
                <option value="">All months</option>
                {availableCutoffMonths.map((ym) => <option key={ym} value={ym}>{formatCutoffMonthOnly(ym)}</option>)}
              </select>
              {selectedCutoffYm && (
                <div className="flex rounded-full bg-slate-100 p-0.5">
                  <button
                    type="button"
                    onClick={() => handleCutoffHalfChange('H1')}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold transition whitespace-nowrap ${selectedCutoffHalf === 'H1' ? 'bg-white shadow text-slate-900' : 'text-slate-400'}`}
                  >
                    1st Half
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCutoffHalfChange('H2')}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold transition whitespace-nowrap ${selectedCutoffHalf === 'H2' ? 'bg-white shadow text-slate-900' : 'text-slate-400'}`}
                  >
                    2nd Half
                  </button>
                </div>
              )}
              <input type="date" className="input-field !py-1.5 !text-xs !min-h-0 w-auto" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); if (e.target.value) setCutoffFilter(''); }} />
              <div className="flex gap-3">
                {selectedDate !== todayManila && <button onClick={() => { setSelectedDate(todayManila); setCutoffFilter(''); }} className="text-blue-600 font-bold text-xs whitespace-nowrap">Today</button>}
                {(selectedDate || cutoffFilter) && <button onClick={() => { setSelectedDate(''); setCutoffFilter(''); }} className="text-slate-400 font-bold text-xs whitespace-nowrap">All</button>}
                {(searchTerm || selectedDate !== todayManila || cutoffFilter) && <button onClick={() => { setSearchTerm(''); setSelectedDate(todayManila); setCutoffFilter(''); setAttendancePage(1); }} className="text-rose-500 font-bold text-xs whitespace-nowrap">Reset Filters</button>}
              </div>
            </div>
            <div className="overflow-x-auto min-h-[260px]">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Time In</th>
                    <th className="px-4 py-3">Time Out</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingData && attendance.length === 0 && <tr><td colSpan={5} className="px-4 py-6"><LoadingRow label="Loading..." /></td></tr>}
                  {paginatedAttendance.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 font-medium text-slate-900 text-xs">{log.profiles?.full_name}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{log.log_date ? new Date(log.log_date).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{log.time_in ? new Date(log.time_in).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A'}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{log.time_out ? new Date(log.time_out).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}</td>
                      <td className="px-4 py-3"><span className={statusTagClass(log.status)}>{log.status}</span></td>
                    </tr>
                  ))}
                  {!loadingData && filteredAttendance.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400 text-xs">No attendance records found.</td></tr>}
                </tbody>
              </table>
              {filteredAttendance.length > PAGE_SIZE && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setAttendancePage((p) => Math.max(1, p - 1))}
                    disabled={attendancePage === 1}
                    className="text-xs font-bold text-blue-600 disabled:text-slate-300 disabled:cursor-not-allowed"
                  >
                    ← Prev
                  </button>
                  <span className="text-slate-400 text-[10px] font-medium">Page {attendancePage} of {attendanceTotalPages} · {filteredAttendance.length} records</span>
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
            </>
            )}
          </section>

          {/* Legacy placement retained in source for easy comparison, hidden because insights now appear near the top. */}
          {false && <section className="card-style overflow-hidden !p-0 mt-3 sm:mt-4 md:mt-5">
            <button type="button" onClick={() => setAttendanceInsightsOpen((open) => !open)} className="w-full p-4 flex items-center justify-between gap-2 text-left">
              <div><h3 className="text-sm mb-0">Attendance Insights</h3><p className="text-slate-400 text-[10px] mt-0.5">Current-month trends and repeated lateness</p></div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`text-slate-400 transition-transform ${attendanceInsightsOpen ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {attendanceInsightsOpen && (
              <div className="px-4 pb-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
                  {[
                    { label: 'Attendance Rate', value: `${attendanceInsights.current.attendanceRate}%`, tone: 'text-emerald-600' },
                    { label: 'Late Records', value: attendanceInsights.current.late, tone: 'text-orange-600' },
                    { label: 'Absent Records', value: attendanceInsights.current.absent, tone: 'text-rose-600' },
                    { label: 'Leave Days', value: attendanceInsights.current.leave, tone: 'text-blue-600' },
                  ].map((item) => <div key={item.label} className="p-3 rounded-xl bg-slate-50 border border-slate-100"><p className={`stat-number text-xl ${item.tone}`}>{item.value}</p><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-1">{item.label}</p></div>)}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div className="p-3 rounded-2xl border border-slate-100 bg-slate-50">
                    <p className="text-xs font-bold text-slate-800 mb-3">Compared with previous month</p>
                    <div className="space-y-2">
                      {[['Late', attendanceInsights.current.late, attendanceInsights.previous.late], ['Absent', attendanceInsights.current.absent, attendanceInsights.previous.absent], ['Worked', attendanceInsights.current.worked, attendanceInsights.previous.worked]].map(([label, current, previous]) => {
                        const delta = Number(current) - Number(previous);
                        return <div key={String(label)} className="flex items-center justify-between text-xs"><span className="text-slate-500">{label}</span><span className="font-bold text-slate-800">{current} <small className={`${delta > 0 && label !== 'Worked' ? 'text-rose-500' : delta < 0 && label !== 'Worked' ? 'text-emerald-500' : 'text-slate-400'} ml-1`}>{delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${delta}`}</small></span></div>;
                      })}
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl border border-slate-100 bg-slate-50">
                    <p className="text-xs font-bold text-slate-800 mb-3">Most late this month</p>
                    {attendanceInsights.topLateEmployees.length === 0 ? <p className="text-xs text-slate-400">No late records this month.</p> : <div className="space-y-2">{attendanceInsights.topLateEmployees.map(([name, count]) => { const max = attendanceInsights.topLateEmployees[0]?.[1] || 1; return <div key={name}><div className="flex justify-between gap-2 text-[10px] mb-1"><span className="font-bold text-slate-700 truncate">{name}</span><span className="text-orange-600 font-bold">{count}</span></div><div className="h-1.5 rounded-full bg-white overflow-hidden"><div className="h-full bg-orange-400 rounded-full" style={{ width: `${Math.max(8, (count / max) * 100)}%` }}/></div></div>; })}</div>}
                  </div>
                </div>
              </div>
            )}
          </section>}
        </div>
      </div>

      {/* ── CHOICE MODAL ── */}
      {modalMode === 'choice' && selectedProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-xs card-style shadow-2xl text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-blue-50 text-blue-600 font-bold text-sm flex items-center justify-center overflow-hidden">
              {selectedProfile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a static asset
                <img src={selectedProfile.avatar_url} alt={selectedProfile.full_name ?? 'Employee'} className="w-full h-full object-cover" />
              ) : (
                initials(selectedProfile.full_name)
              )}
            </div>
            <h3 className="mb-1">{selectedProfile.full_name}</h3>
            <p className="text-slate-400 text-xs mb-6">{selectedProfile.designation || '---'}</p>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => openEdit(selectedProfile)}
                className="w-full py-3 rounded-full bg-slate-900 text-white font-bold text-sm hover:bg-slate-700 transition"
              >
                ✏️ Edit Profile
              </button>
              <button
                type="button"
                onClick={() => openPayslipsModal(selectedProfile)}
                className="w-full py-3 rounded-full bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition"
              >
                📄 Payslips
              </button>
              <button
                type="button"
                onClick={closeModal}
                className="w-full py-3 rounded-full bg-slate-100 text-slate-600 font-medium text-sm hover:bg-slate-200 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT PROFILE MODAL ── */}
      {modalMode === 'edit' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm card-style shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="mb-0">Edit Profile</h3>
              <button
                type="button"
                onClick={() => { setModalMode('choice'); }}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ← Back
              </button>
            </div>

            {/* Profile Photo — HR can upload/replace directly on behalf
                of the employee. Stored in the public "avatars" bucket;
                the URL is only written to profiles.avatar_url on Save. */}
            <div className="mb-6">
              <p className="label-branded mb-2">Profile Photo</p>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-slate-100 overflow-hidden border border-slate-200 flex-shrink-0 flex items-center justify-center">
                  {(avatarPreview || currentAvatarUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a static asset
                    <img src={avatarPreview || currentAvatarUrl || ''} alt="Avatar preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-slate-400 text-[9px] font-bold uppercase tracking-wide text-center px-1">No Photo</span>
                  )}
                </div>
                <label className="inline-flex items-center gap-1.5 text-blue-600 text-xs font-bold cursor-pointer hover:underline">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>
                  {(avatarPreview || currentAvatarUrl) ? 'Change Photo' : 'Upload Photo'}
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleAvatarChange(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </div>

            <input className="input-field mb-3" value={editing.full_name} onChange={e => setEditing({...editing, full_name: e.target.value})} placeholder="Full Name" />
            <div className="mb-3">
              <input className="input-field" value={editing.employee_id} onChange={e => setEditing({...editing, employee_id: e.target.value})} placeholder="Employee ID" />
              {editingEmployeeIdConflict && (
                <p className="text-red-600 text-xs font-medium mt-1.5 ml-1">
                  ⚠️ This Employee ID is already used by {editingEmployeeIdConflict}.
                </p>
              )}
            </div>
            <input className="input-field mb-3" value={editing.designation} onChange={e => setEditing({...editing, designation: e.target.value})} placeholder="Designation" />
            <input
              type="email"
              className="input-field mb-6"
              value={editing.employee_email}
              onChange={e => setEditing({...editing, employee_email: e.target.value})}
              placeholder="Employee Email (for notifications)"
            />

            <div className="mb-6 pt-3 border-t border-slate-100">
              <p className="label-branded mb-3">Government IDs &amp; Employment Details</p>
              <div className="space-y-3">
                <input className="input-field" value={editing.sss_number} onChange={(e) => setEditing({ ...editing, sss_number: e.target.value })} placeholder="SSS Number" />
                <input className="input-field" value={editing.philhealth_number} onChange={(e) => setEditing({ ...editing, philhealth_number: e.target.value })} placeholder="PhilHealth Number" />
                <input className="input-field" value={editing.pagibig_number} onChange={(e) => setEditing({ ...editing, pagibig_number: e.target.value })} placeholder="Pag-IBIG Number" />
                <input className="input-field" value={editing.tin_number} onChange={(e) => setEditing({ ...editing, tin_number: e.target.value })} placeholder="TIN Number" />
                <div>
                  <label className="label-branded">Hired Date</label>
                  <input type="date" className="input-field" value={editing.hired_date} onChange={(e) => setEditing({ ...editing, hired_date: e.target.value })} />
                </div>
                <div>
                  <label className="label-branded">Employment Status</label>
                  <select className="input-field" value={editing.employment_status} onChange={(e) => setEditing({ ...editing, employment_status: e.target.value })}>
                    <option value="">Not set</option>
                    <option value="Regular">Regular</option>
                    <option value="Probationary">Probationary</option>
                    <option value="Contractual">Contractual</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button className="flex-1 p-3 bg-slate-100 rounded-full font-medium text-sm" onClick={closeModal}>Cancel</button>
              <button className="flex-1 btn-primary" onClick={saveEdit} disabled={saveLoading || !!editingEmployeeIdConflict}>
                {saveLoading ? (
                  <span className="flex items-center justify-center gap-2"><Spinner size="sm" />{avatarUploading ? 'Uploading photo...' : 'Saving...'}</span>
                ) : editingEmployeeIdConflict ? 'Fix Conflict First' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PAYSLIPS MODAL ── */}
      {modalMode === 'payslips' && selectedProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm card-style shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="mb-0">Payslips</h3>
                <p className="text-slate-400 text-xs mt-1">{selectedProfile.full_name}</p>
              </div>
              <button
                type="button"
                onClick={() => setModalMode('choice')}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ← Back
              </button>
            </div>

            {/* Existing payslips */}
            {publishMsg && (
              <div className={`p-2.5 rounded-xl text-xs font-bold mb-3 ${publishMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {publishMsg.text}
              </div>
            )}
            {employeePayslipsLoading ? (
              <p className="text-slate-400 text-xs mb-4">Loading payslips...</p>
            ) : employeePayslips.length === 0 ? (
              <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-2xl mb-4">
                <p className="text-slate-400 text-sm">No payslips uploaded yet.</p>
              </div>
            ) : (
              <div className="space-y-2 mb-6">
                {employeePayslips.map((ps) => (
                  <div key={ps.id} className="flex items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{ps.cutoff_label}</p>
                      <p className="text-slate-400 text-[10px] truncate">{ps.file_name}</p>
                      <p className="text-slate-300 text-[10px]">
                        {new Date(ps.uploaded_at).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      {ps.published ? (
                        <span className="tag-present inline-block mt-1">
                          Published{ps.published_at ? ` · ${new Date(ps.published_at).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' })}` : ''}
                        </span>
                      ) : (
                        <span className="tag-excused inline-block mt-1">Not yet published</span>
                      )}
                      {ps.published && (
                        <span className={`inline-block mt-1 ml-1 rounded-full px-2 py-1 text-[9px] font-extrabold uppercase tracking-wide ${ps.acknowledged_at ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                          {ps.acknowledged_at ? `Acknowledged · ${new Date(ps.acknowledged_at).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' })}` : 'Not acknowledged'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {!ps.published && (
                        <button
                          type="button"
                          onClick={() => publishPayslip(ps.id, selectedProfile.id)}
                          disabled={publishingId === ps.id}
                          className="flex-shrink-0 flex items-center gap-1.5 bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-full hover:bg-blue-700 transition disabled:opacity-50"
                        >
                          {publishingId === ps.id ? <><Spinner size="sm" />Publishing...</> : 'Publish'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deletePayslip(ps.id, (ps as any).file_path, selectedProfile.id)}
                        className="flex-shrink-0 text-rose-500 hover:text-rose-700 text-xs font-bold transition px-2"
                        title="Delete payslip"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Upload new payslip */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <p className="label-branded">Upload New Payslip</p>

              {payslipMsg && (
                <div className={`p-2.5 rounded-xl text-xs font-bold ${payslipMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {payslipMsg.text}
                </div>
              )}

              <select className="input-field" value={payslipCutoff} onChange={(e) => setPayslipCutoff(e.target.value)}>
                <option value="">Select cutoff period...</option>
                {generateCutoffOptions().map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              <input
                ref={payslipFileRef}
                type="file"
                accept="application/pdf"
                onChange={(e) => setPayslipFile(e.target.files?.[0] ?? null)}
                className="input-field text-sm file:mr-3 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
              />

              <button
                type="button"
                onClick={() => uploadPayslip(selectedProfile.id)}
                disabled={payslipUploading || !payslipFile || !payslipCutoff}
                className="w-full py-3 rounded-full bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition disabled:opacity-50"
              >
                {payslipUploading ? (
                  <span className="flex items-center justify-center gap-2"><Spinner size="sm" />Uploading...</span>
                ) : 'Upload PDF'}
              </button>

              <button type="button" onClick={closeModal} className="w-full py-3 rounded-full bg-slate-100 text-slate-600 font-medium text-sm hover:bg-slate-200 transition">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispute History Modal */}
      {disputesHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm card-style shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-6 flex-shrink-0">
              <h3 className="mb-0">{selectedDisputeDetail ? 'Dispute Details' : 'Dispute History'}</h3>
              <button
                type="button"
                onClick={() => { setDisputesHistoryModalOpen(false); setSelectedDisputeDetail(null); }}
                className="text-slate-400 hover:text-slate-600 transition"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {selectedDisputeDetail ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setSelectedDisputeDetail(null)}
                    className="text-blue-600 text-xs font-bold hover:underline flex items-center gap-1 mb-2"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    Back to list
                  </button>

                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 text-sm">{selectedDisputeDetail.employee?.full_name ?? 'Unknown'}</span>
                    <span className={selectedDisputeDetail.status === 'Approved' ? 'tag-present' : 'tag-late'}>{selectedDisputeDetail.status}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="tag-excused">{disputeTypeLabel(selectedDisputeDetail)}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                    <div>
                      <p className="label-branded mb-0.5">Dispute Date</p>
                      <p className="text-slate-700 text-xs">{selectedDisputeDetail.dispute_date}</p>
                    </div>
                    {disputeOriginal(selectedDisputeDetail) && (
                      <div>
                        <p className="label-branded mb-0.5">Original {disputeFieldLabel(selectedDisputeDetail)}</p>
                        <p className="text-slate-700 text-xs">{formatPh(disputeOriginal(selectedDisputeDetail))}</p>
                      </div>
                    )}
                    <div>
                      <p className="label-branded mb-0.5">Claimed {disputeFieldLabel(selectedDisputeDetail)}</p>
                      <p className="text-slate-700 text-xs">{disputeClaimed(selectedDisputeDetail) ? formatPh(disputeClaimed(selectedDisputeDetail)) : '—'}</p>
                    </div>
                  </div>

                  <div>
                    <p className="label-branded mb-1">Employee&apos;s Reason</p>
                    <p className="text-slate-600 text-xs bg-slate-50 rounded-xl border border-slate-100 p-3">{selectedDisputeDetail.reason || 'No reason provided.'}</p>
                  </div>

                  <div>
                    <p className="label-branded mb-1">HR Response</p>
                    <p className="text-slate-600 text-xs bg-slate-50 rounded-xl border border-slate-100 p-3">{selectedDisputeDetail.hr_notes || 'No notes were left.'}</p>
                  </div>

                  <div className="text-slate-400 text-[10px] pt-1">
                    {selectedDisputeDetail.reviewed_at && (
                      <p>Resolved: {new Date(selectedDisputeDetail.reviewed_at).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}{selectedDisputeDetail.reviewer?.full_name ? ` by ${selectedDisputeDetail.reviewer.full_name}` : ''}</p>
                    )}
                    <p>Filed: {new Date(selectedDisputeDetail.created_at).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ) : disputes.filter((d) => d.status !== 'Pending').length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl">
                  <p className="text-slate-400 text-sm font-medium">No resolved disputes yet.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {disputes.filter((d) => d.status !== 'Pending').map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setSelectedDisputeDetail(d)}
                      className="w-full flex items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition text-left"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-slate-900 text-xs">{d.employee?.full_name ?? 'Unknown'}</span>
                        <span className="text-slate-400 text-xs"> · {disputeTypeLabel(d)} · {d.dispute_date}</span>
                      </div>
                      <span className={d.status === 'Approved' ? 'tag-present' : 'tag-late'}>{d.status}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => { setDisputesHistoryModalOpen(false); setSelectedDisputeDetail(null); }}
              className="mt-6 w-full py-3 rounded-full bg-slate-100 text-slate-600 font-medium text-sm hover:bg-slate-200 transition flex-shrink-0"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Leave History Modal */}
      {leaveHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm card-style shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-6 flex-shrink-0">
              <h3 className="mb-0">{selectedLeaveDetail ? 'Leave Details' : 'Leave History'}</h3>
              <button
                type="button"
                onClick={() => { setLeaveHistoryModalOpen(false); setSelectedLeaveDetail(null); }}
                className="text-slate-400 hover:text-slate-600 transition"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {selectedLeaveDetail ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setSelectedLeaveDetail(null)}
                    className="text-blue-600 text-xs font-bold hover:underline flex items-center gap-1 mb-2"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    Back to list
                  </button>

                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 text-sm">{selectedLeaveDetail.employee?.full_name ?? 'Unknown'}</span>
                    <span className={selectedLeaveDetail.status === 'Approved' ? 'tag-present' : 'tag-late'}>{selectedLeaveDetail.status}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                    <div>
                      <p className="label-branded mb-0.5">Leave Type</p>
                      <p className="text-slate-700 text-xs">{selectedLeaveDetail.leave_type}</p>
                    </div>
                    <div>
                      <p className="label-branded mb-0.5">Dates</p>
                      <p className="text-slate-700 text-xs">
                        {selectedLeaveDetail.start_date === selectedLeaveDetail.end_date ? selectedLeaveDetail.start_date : `${selectedLeaveDetail.start_date} → ${selectedLeaveDetail.end_date}`}
                        {' '}({countLeaveDays(selectedLeaveDetail.start_date, selectedLeaveDetail.end_date)}d)
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="label-branded mb-1">Employee&apos;s Reason</p>
                    <p className="text-slate-600 text-xs bg-slate-50 rounded-xl border border-slate-100 p-3">{selectedLeaveDetail.reason || 'No reason provided.'}</p>
                  </div>

                  <div>
                    <p className="label-branded mb-1">HR Response</p>
                    <p className="text-slate-600 text-xs bg-slate-50 rounded-xl border border-slate-100 p-3">{selectedLeaveDetail.hr_notes || 'No notes were left.'}</p>
                  </div>

                  <div className="text-slate-400 text-[10px] pt-1">
                    {selectedLeaveDetail.reviewed_at && (
                      <p>Resolved: {new Date(selectedLeaveDetail.reviewed_at).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}{selectedLeaveDetail.reviewer?.full_name ? ` by ${selectedLeaveDetail.reviewer.full_name}` : ''}</p>
                    )}
                    <p>Filed: {new Date(selectedLeaveDetail.created_at).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ) : leaveRequests.filter((l) => l.status !== 'Pending').length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl">
                  <p className="text-slate-400 text-sm font-medium">No resolved leave requests yet.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {leaveRequests.filter((l) => l.status !== 'Pending').map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setSelectedLeaveDetail(l)}
                      className="w-full flex items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition text-left"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-slate-900 text-xs">{l.employee?.full_name ?? 'Unknown'}</span>
                        <span className="text-slate-400 text-xs"> · {l.leave_type} · {l.start_date === l.end_date ? l.start_date : `${l.start_date}→${l.end_date}`} · {countLeaveDays(l.start_date, l.end_date)}d</span>
                      </div>
                      <span className={l.status === 'Approved' ? 'tag-present' : 'tag-late'}>{l.status}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => { setLeaveHistoryModalOpen(false); setSelectedLeaveDetail(null); }}
              className="mt-6 w-full py-3 rounded-full bg-slate-100 text-slate-600 font-medium text-sm hover:bg-slate-200 transition flex-shrink-0"
            >
              Close
            </button>
          </div>
        </div>
      )}
      {/* LEAVE CREDITS OVERVIEW MODAL -- read-only monitoring, no manual
          adjustment. Sorted so Regular employees running lowest on
          credits surface first. */}
      {leaveCreditsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm card-style shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <div>
                <h3 className="mb-0">Leave Credits</h3>
                <p className="text-slate-400 text-xs mt-1">{new Date().getFullYear()} · Regular employees only</p>
              </div>
              <button
                type="button"
                onClick={() => setLeaveCreditsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-2">
              {leaveCreditsLoading && (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={`credit-skel-${i}`} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 animate-pulse">
                    <div className="h-3.5 w-2/3 bg-slate-200 rounded mb-2" />
                    <div className="h-3 w-1/3 bg-slate-200 rounded" />
                  </div>
                ))
              )}
              {!leaveCreditsLoading && sortedLeaveCreditsData.length === 0 && (
                <p className="py-8 text-center text-slate-400 text-sm">No employees found.</p>
              )}
              {!leaveCreditsLoading && sortedLeaveCreditsData.map((e) => {
                const isRegular = e.employment_status === 'Regular';
                const total = e.total_credits ?? fallbackLeaveCredits;
                const used = e.used_credits ?? 0;
                const remaining = total - used;
                const isLow = isRegular && remaining <= 3;
                return (
                  <div key={e.id} className="flex items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 text-xs truncate">{e.full_name || 'Unknown'}</p>
                      <p className="text-slate-400 text-[10px]">{e.employee_id || '-'}</p>
                    </div>
                    {isRegular ? (
                      <span className={`text-xs font-extrabold flex-shrink-0 ${isLow ? 'text-orange-600' : 'text-slate-700'}`}>
                        {remaining} / {total}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[10px] font-medium flex-shrink-0">
                        {e.employment_status || 'Not set'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setLeaveCreditsModalOpen(false)}
              className="mt-6 w-full py-3 rounded-full bg-slate-100 text-slate-600 font-medium text-sm hover:bg-slate-200 transition flex-shrink-0"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* EXPORT REPORTS MODAL */}
      {exportModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4"
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
    </main>
  );
}
