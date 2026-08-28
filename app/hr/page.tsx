'use client';
import HRDesktopSidebar from '@/components/hr/HRDesktopSidebar';
import HRMobileBottomNav from '@/components/hr/HRMobileBottomNav';
import HRMobileToolsSheet from '@/components/hr/HRMobileToolsSheet';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { AlertTriangle, Bell, CalendarClock, CalendarRange, CheckCircle2, ChevronRight, Clock3, FileDown, FileText, Headphones, Megaphone, Moon, RefreshCw, Search, Sun, UserRound, UsersRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { LoadingRow } from '@/components/Spinner';

const AttendanceInsightsModal = dynamic(() => import('@/components/hr/modals/AttendanceInsightsModal'));
const DailyOverviewModal = dynamic(() => import('@/components/hr/modals/DailyOverviewModal'));
const EmployeeQuickViewModal = dynamic(() => import('@/components/hr/modals/EmployeeQuickViewModal'));
const TeamLeaveCalendarModal = dynamic(() => import('@/components/hr/modals/TeamLeaveCalendarModal'));
const AnnouncementsModal = dynamic(() => import('@/components/hr/modals/AnnouncementsModal'));
const HolidaysModal = dynamic(() => import('@/components/hr/modals/HolidaysModal'));
const EmployeesModal = dynamic(() => import('@/components/hr/modals/EmployeesModal'));
const EmployeeChoiceModal = dynamic(() => import('@/components/hr/modals/EmployeeChoiceModal'));
const EmployeeEditModal = dynamic(() => import('@/components/hr/modals/EmployeeEditModal'));
const PayslipManagementModal = dynamic(() => import('@/components/hr/modals/PayslipManagementModal'));
const DisputeHistoryModal = dynamic(() => import('@/components/hr/modals/DisputeHistoryModal'));
const LeaveHistoryModal = dynamic(() => import('@/components/hr/modals/LeaveHistoryModal'));
const LeaveCreditsModal = dynamic(() => import('@/components/hr/modals/LeaveCreditsModal'));
const ExportReportsModal = dynamic(() => import('@/components/hr/modals/ExportReportsModal'));
const HelpDeskRequestsModal = dynamic(() => import('@/components/hr/modals/HelpDeskRequestsModal'));
const EmployeeDocumentsModal = dynamic(() => import('@/components/hr/modals/EmployeeDocumentsModal'));

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
  const [darkMode, setDarkMode] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [dailyOverviewModal, setDailyOverviewModal] = useState<null | 'present' | 'late' | 'leave' | 'notTimedIn'>(null);
  const [attendanceInsightModal, setAttendanceInsightModal] = useState<null | 'attendance' | 'late' | 'absent' | 'leave'>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [filtersHydrated, setFiltersHydrated] = useState(false);

  // Employee Help Desk management
  const [hrSupportModalOpen, setHrSupportModalOpen] = useState(false);
  const [hrSupportRequests, setHrSupportRequests] = useState<any[]>([]);
  const [hrSupportLoading, setHrSupportLoading] = useState(false);
  const [hrSupportSavingId, setHrSupportSavingId] = useState<string | null>(null);
  const [hrSupportDrafts, setHrSupportDrafts] = useState<Record<string, { status: string; hr_notes: string }>>({});

  const fetchHrSupportRequests = async () => {
    setHrSupportLoading(true);
    const { data, error } = await supabase
      .from('employee_support_requests')
      .select('id, user_id, category, subject, description, status, hr_notes, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching employee support requests:', error);
      setHrSupportRequests([]);
      setHrSupportDrafts({});
      setHrSupportLoading(false);
      return;
    }

    const requests = data || [];
    const employeeIds = [...new Set(requests.map((request: any) => request.user_id).filter(Boolean))];
    let employeeById: Record<string, { full_name: string | null; employee_id: string | null }> = {};

    if (employeeIds.length > 0) {
      const { data: employees, error: employeesError } = await supabase
        .from('profiles')
        .select('id, full_name, employee_id')
        .in('id', employeeIds);

      if (employeesError) {
        console.error('Error fetching Help Desk employee profiles:', employeesError);
      } else {
        employeeById = Object.fromEntries(
          (employees || []).map((employee: any) => [employee.id, {
            full_name: employee.full_name,
            employee_id: employee.employee_id,
          }])
        );
      }
    }

    const rows = requests.map((request: any) => ({
      ...request,
      employee: employeeById[request.user_id] || null,
    }));
    setHrSupportRequests(rows);
    setHrSupportDrafts(Object.fromEntries(rows.map((request: any) => [request.id, { status: request.status, hr_notes: request.hr_notes || '' }])));
    setHrSupportLoading(false);
  };

  const saveHrSupportRequest = async (requestId: string) => {
    const draft = hrSupportDrafts[requestId];
    if (!draft) return;
    setHrSupportSavingId(requestId);
    const { error } = await supabase.from('employee_support_requests').update({ status: draft.status, hr_notes: draft.hr_notes.trim() || null }).eq('id', requestId);
    if (error) alert('Failed to update request: ' + error.message);
    else await fetchHrSupportRequests();
    setHrSupportSavingId(null);
  };

  // Employee Documents publishing
  const [hrDocumentsModalOpen, setHrDocumentsModalOpen] = useState(false);
  const [hrDocuments, setHrDocuments] = useState<any[]>([]);
  const [hrDocumentsLoading, setHrDocumentsLoading] = useState(false);
  const [hrDocumentSaving, setHrDocumentSaving] = useState(false);
  const [hrDocumentTitle, setHrDocumentTitle] = useState('');
  const [hrDocumentCategory, setHrDocumentCategory] = useState('Company Policy');
  const [hrDocumentFile, setHrDocumentFile] = useState<File | null>(null);
  const hrDocumentFileRef = useRef<HTMLInputElement>(null);

  const fetchHrDocuments = async () => {
    setHrDocumentsLoading(true);
    const { data, error } = await supabase.from('employee_documents').select('id, title, category, file_name, file_path, is_active, published_at').order('published_at', { ascending: false });
    if (error) console.error('Error fetching employee documents:', error);
    setHrDocuments(data || []);
    setHrDocumentsLoading(false);
  };

  const uploadHrDocument = async () => {
    if (!hrDocumentTitle.trim() || !hrDocumentFile) { alert('Enter a title and choose a file.'); return; }
    setHrDocumentSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You are not logged in.');
      const safeName = hrDocumentFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage.from('employee-documents').upload(filePath, hrDocumentFile, { upsert: false });
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase.from('employee_documents').insert({ title: hrDocumentTitle.trim(), category: hrDocumentCategory, file_name: hrDocumentFile.name, file_path: filePath, created_by: user.id, is_active: true });
      if (insertError) { await supabase.storage.from('employee-documents').remove([filePath]); throw insertError; }
      setHrDocumentTitle(''); setHrDocumentFile(null); if (hrDocumentFileRef.current) hrDocumentFileRef.current.value = '';
      await fetchHrDocuments();
    } catch (error: any) { alert('Failed to publish document: ' + (error?.message || 'Please try again.')); }
    finally { setHrDocumentSaving(false); }
  };

  const toggleHrDocument = async (document: any) => {
    const { error } = await supabase.from('employee_documents').update({ is_active: !document.is_active }).eq('id', document.id);
    if (error) alert('Failed to update document: ' + error.message); else await fetchHrDocuments();
  };

  const deleteHrDocument = async (document: any) => {
    if (!confirm(`Delete ${document.title}?`)) return;
    const { error: storageError } = await supabase.storage.from('employee-documents').remove([document.file_path]);
    if (storageError) { alert('Failed to delete file: ' + storageError.message); return; }
    const { error } = await supabase.from('employee_documents').delete().eq('id', document.id);
    if (error) alert('Failed to delete document record: ' + error.message); else await fetchHrDocuments();
  };

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
    const moduleModalOpen = announcementOpen || holidaysOpen || employeesListOpen || leaveCalendarOpen || hrSupportModalOpen || hrDocumentsModalOpen || !!quickViewProfile || !!dailyOverviewModal || !!attendanceInsightModal;
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
      if (dailyOverviewModal) setDailyOverviewModal(null);
      if (attendanceInsightModal) setAttendanceInsightModal(null);
      if (hrSupportModalOpen && !hrSupportSavingId) setHrSupportModalOpen(false);
      if (hrDocumentsModalOpen && !hrDocumentSaving) setHrDocumentsModalOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [announcementOpen, announcementSaving, holidaysOpen, holidaySaving, employeesListOpen, leaveCalendarOpen, hrSupportModalOpen, hrDocumentsModalOpen, hrSupportSavingId, hrDocumentSaving, quickViewProfile, dailyOverviewModal, attendanceInsightModal]);

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
    fetchHrSupportRequests();
    fetchHrDocuments();
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
  // Present = every employee who has successfully timed in today.
  // Late is a subset of Present, so late employees remain included here.
  // Example: 13 on-time + 1 late = 14 Present, while Late still shows 1.
  const presentTodayCount = useMemo(
    () => new Set(todaysLogs.map((log) => log.user_id)).size,
    [todaysLogs]
  );

  const lateTodayCount = useMemo(
    () => new Set(
      todaysLogs
        .filter((log) => log.status?.toLowerCase() === 'late')
        .map((log) => log.user_id)
    ).size,
    [todaysLogs]
  );
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
  const openHrSupportCount = hrSupportRequests.filter((request) => request.status !== 'Resolved').length;
  const activeHrDocumentsCount = hrDocuments.filter((document) => document.is_active).length;

  const attendanceInsightMeta = attendanceInsightModal ? {
    attendance: { title: 'Attendance Records This Month', description: `Worked records used in the ${attendanceInsights.current.attendanceRate}% attendance rate.`, tone: 'text-emerald-600', empty: 'No worked attendance records this month.' },
    late: { title: 'Late Records This Month', description: 'All current-month attendance records tagged Late.', tone: 'text-orange-600', empty: 'No late records this month.' },
    absent: { title: 'Absent Records This Month', description: 'All current-month attendance records tagged Absent.', tone: 'text-rose-600', empty: 'No absent records this month.' },
    leave: { title: 'Leave Records This Month', description: 'All current-month settled leave-day attendance records.', tone: 'text-blue-600', empty: 'No leave records this month.' },
  }[attendanceInsightModal] : null;

  const attendanceInsightRecords = attendanceInsightModal === 'attendance'
    ? attendanceInsights.current.logs.filter((log) => {
        const status = log.status?.toLowerCase() ?? '';
        return status !== 'absent' && !status.includes('leave');
      })
    : attendanceInsightModal === 'late'
      ? attendanceInsights.current.logs.filter((log) => log.status?.toLowerCase() === 'late')
      : attendanceInsightModal === 'absent'
        ? attendanceInsights.current.logs.filter((log) => log.status?.toLowerCase() === 'absent')
        : attendanceInsightModal === 'leave'
          ? attendanceInsights.current.logs.filter((log) => log.status?.toLowerCase().includes('leave'))
          : [];

  const approvedLeavesToday = leaveRequests.filter(
    (leave) => leave.status === 'Approved' && leave.start_date <= todayManila && leave.end_date >= todayManila
  );

  const dailyOverviewMeta = dailyOverviewModal ? {
    present: { title: 'Present Today', description: 'All employees who have timed in today.', tone: 'text-emerald-600', empty: 'No employees have timed in today.' },
    late: { title: 'Late Today', description: 'Employees tagged Late for today.', tone: 'text-orange-600', empty: 'No late records today.' },
    leave: { title: 'On Leave Today', description: 'Approved leave requests covering today.', tone: 'text-blue-600', empty: 'No employees are on approved leave today.' },
    notTimedIn: { title: 'Not Timed In Today', description: 'Employees with no time-in and no approved leave today.', tone: 'text-amber-600', empty: 'Everyone expected today has already timed in.' },
  }[dailyOverviewModal] : null;

  const dailyOverviewRecords = dailyOverviewModal === 'present'
    ? todaysLogs
    : dailyOverviewModal === 'late'
      ? todaysLogs.filter((log) => log.status?.toLowerCase() === 'late')
      : dailyOverviewModal === 'leave'
        ? approvedLeavesToday
        : dailyOverviewModal === 'notTimedIn'
          ? notYetTimedInToday
          : [];

  const getLeaveBalance = (userId?: string) => {
    const employee = leaveCreditsData.find((entry) => entry.id === userId);
    if (!employee || employee.employment_status !== 'Regular') return null;
    return (employee.total_credits ?? fallbackLeaveCredits) - (employee.used_credits ?? 0);
  };

  const scrollToDashboardSection = (id: string) => {
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const applyTheme = (useDark: boolean) => {
    document.documentElement.classList.toggle('dark', useDark);
    document.documentElement.style.colorScheme = useDark ? 'dark' : 'light';
    try { localStorage.setItem('theme', useDark ? 'dark' : 'light'); } catch { /* storage can be unavailable */ }
    setDarkMode(useDark);
  };
  const toggleTheme = () => applyTheme(!darkMode);
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  useEffect(() => {
    queueMicrotask(() => setDarkMode(document.documentElement.classList.contains('dark')));
  }, []);

  const pendingHrActionCount = pendingDisputesCount + pendingLeaveCount + openHrSupportCount;
  const openReports = () => { setExportModalOpen(true); setExportMsg(null); if (!exportCutoff) setExportCutoff(availableCutoffs[0] || ''); };
  const openDocuments = () => { setHrDocumentsModalOpen(true); fetchHrDocuments(); };
  const openHelpdesk = () => { setHrSupportModalOpen(true); fetchHrSupportRequests(); };
  const openLeaveCalendar = () => { setSelectedCalendarDate(null); setLeaveCalendarOpen(true); };
  const openHolidays = () => { if (!holidaysOpen) toggleHolidays(); };
  const openAttendanceLog = () => { setAttendanceHistoryOpen(true); scrollToDashboardSection('attendance-history'); };

  return (
    <main id="hr-dashboard-top" className="min-h-screen bg-slate-50 p-3 pb-24 text-slate-950 transition-colors dark:bg-[#111512] dark:text-slate-100 sm:p-4 sm:pb-24 md:p-6 lg:py-6 lg:pl-[260px] lg:pr-6">
      <HRDesktopSidebar darkMode={darkMode} requestCount={pendingHrActionCount} onDashboard={() => scrollToDashboardSection('hr-dashboard-top')} onAttendance={openAttendanceLog} onEmployees={() => setEmployeesListOpen(true)} onLeave={() => scrollToDashboardSection('leave-requests')} onDisputes={() => scrollToDashboardSection('attendance-disputes')} onPayslips={() => setEmployeesListOpen(true)} onDocuments={openDocuments} onAnnouncements={() => setAnnouncementOpen(true)} onHolidays={openHolidays} onReports={openReports} onHelpdesk={openHelpdesk} onToggleTheme={toggleTheme} onLogout={handleLogout} />
      <div className="max-w-7xl mx-auto space-y-3 sm:space-y-4 md:space-y-5">
        {/* Header */}
        <header className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_4px_18px_rgba(15,23,42,0.05)] dark:border-slate-700 dark:bg-[#292f2b] sm:p-4">
          <div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-green-700 dark:text-green-300">Hamdan Engineering</p><h1 className="mt-0.5 truncate text-xl font-bold leading-tight text-slate-950 dark:text-white sm:text-2xl">HR Dashboard</h1><p className="mt-1 hidden text-xs text-slate-600 dark:text-slate-300 sm:block">People, attendance, and employee operations.</p></div>
          <div className="flex flex-none items-center gap-1.5">
            <button type="button" onClick={toggleTheme} className="grid h-11 w-11 place-items-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:!text-white dark:hover:bg-slate-800 lg:hidden" aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>{darkMode ? <Sun size={18}/> : <Moon size={18}/>}</button>
            <button type="button" onClick={() => scrollToDashboardSection('action-center')} className="relative grid h-11 w-11 place-items-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:!text-white dark:hover:bg-slate-800" aria-label={`${pendingHrActionCount} pending HR actions`}><Bell size={18}/>{pendingHrActionCount ? <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white">{pendingHrActionCount > 9 ? '9+' : pendingHrActionCount}</span> : null}</button>
            <button type="button" onClick={() => setMobileToolsOpen(true)} className="grid h-11 w-11 place-items-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:!text-white lg:hidden" aria-label="Open HR tools"><UserRound size={18}/></button>
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
              <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                {globalEmployeeMatches.length === 0 ? (
                  <p className="p-4 text-slate-400 text-xs text-center">No matching employee found.</p>
                ) : globalEmployeeMatches.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => { setQuickViewProfile(profile); setGlobalEmployeeSearch(''); }}
                    className="flex w-full items-center gap-3 border-b border-slate-100 p-3 text-left transition last:border-0 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
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
            <button type="button" onClick={refreshAllData} disabled={refreshing} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-2 text-[10px] font-bold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {/* Daily attendance overview */}
        <section aria-labelledby="daily-overview-title"><div className="mb-3"><h2 id="daily-overview-title" className="text-base font-semibold sm:text-lg">Daily Overview</h2><p className="mt-0.5 text-xs text-slate-500">Today&apos;s attendance at a glance</p></div><div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          {[
            { key: 'present' as const, label: 'Present', value: presentTodayCount, tone: 'from-emerald-500 to-green-600', icon: <CheckCircle2 size={19}/> },
            { key: 'late' as const, label: 'Late', value: lateTodayCount, tone: 'from-amber-400 to-orange-500', icon: <Clock3 size={19}/> },
            { key: 'leave' as const, label: 'On Leave', value: onLeaveTodayCount, tone: 'from-sky-500 to-blue-600', icon: <CalendarClock size={19}/> },
            { key: 'notTimedIn' as const, label: 'Not Timed In', value: notYetTimedInToday.length, tone: 'from-orange-500 to-red-600', icon: <AlertTriangle size={19}/> },
          ].map((stat) => (
            <button type="button" key={stat.key} onClick={() => setDailyOverviewModal(stat.key)} className="group relative flex min-h-24 items-center gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-[0_6px_20px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-[#292f2b]" aria-label={`View ${stat.label} records`}>
              <span className={`relative grid h-11 w-11 flex-none place-items-center rounded-2xl bg-gradient-to-br text-white shadow-md ${stat.tone}`}><span className="absolute inset-[3px] rounded-[13px] border border-white/25"/>{stat.icon}</span>
              <span className="min-w-0"><span className="stat-number block text-2xl leading-none text-slate-950 dark:text-white">{stat.value}</span><span className="mt-1.5 block text-[11px] font-bold text-slate-600 dark:text-slate-300">{stat.label}</span></span>
            </button>
          ))}
        </div></section>

        {/* HR modules keep their existing handlers while sharing one visual language. */}
        <section aria-labelledby="hr-quick-actions-title"><div className="mb-3"><h2 id="hr-quick-actions-title" className="text-base font-semibold sm:text-lg">HR Quick Actions</h2><p className="mt-0.5 text-xs text-slate-500">Frequently used people operations tools</p></div><div className="grid grid-cols-4 gap-2 sm:gap-3">
          {[
            { title: 'Leave Credits', description: leaveCreditsLoading ? 'Checking...' : lowLeaveCreditsCount ? `${lowLeaveCreditsCount} low` : 'Healthy', icon: CalendarClock, action: openLeaveCreditsModal, warning: lowLeaveCreditsCount > 0 },
            { title: 'Export Reports', description: 'CSV & PDF', icon: FileDown, action: openReports },
            { title: 'Announcements', description: announcementModuleLabel, icon: Megaphone, action: () => setAnnouncementOpen(true) },
            { title: 'Holidays', description: holidaysLoading ? 'Checking...' : `${upcomingHolidaysCount} upcoming`, icon: CalendarRange, action: openHolidays },
            { title: 'Employees', description: `${profiles.length} total`, icon: UsersRound, action: () => setEmployeesListOpen(true) },
            { title: 'Leave Calendar', description: 'Leaves & holidays', icon: CalendarRange, action: openLeaveCalendar },
            { title: 'Help Desk', description: openHrSupportCount ? `${openHrSupportCount} open` : 'All clear', icon: Headphones, action: openHelpdesk, warning: openHrSupportCount > 0 },
            { title: 'Documents', description: `${activeHrDocumentsCount} published`, icon: FileText, action: openDocuments },
          ].map(({ title, description, icon: Icon, action, warning }) => <button key={title} type="button" onClick={action} className="group relative flex min-h-24 min-w-0 flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-slate-200 bg-white px-1.5 py-3 text-center shadow-[0_5px_16px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-green-200 dark:border-slate-700 dark:bg-[#292f2b]"><span className={`relative grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-md ${warning ? 'from-amber-400 to-orange-500' : 'from-emerald-500 to-green-700'}`}><span className="absolute inset-[3px] rounded-[13px] border border-white/25"/><Icon size={18}/></span><span className="line-clamp-2 text-[10px] font-bold leading-tight text-slate-800 dark:text-slate-100 sm:text-xs">{title}</span><span className={`hidden max-w-full truncate text-[10px] sm:block ${warning ? 'font-bold text-orange-600' : 'text-slate-400'}`}>{description}</span></button>)}
        </div></section>

        {/* Priority action center */}
        <section id="action-center" className="card-style !p-4 scroll-mt-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="mb-0 text-sm">Action Center</h3>
              <p className="text-slate-400 text-[10px] mt-0.5">Items that may need HR attention today</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {pendingHrActionCount} open
            </span>
          </div>
          {pendingHrActionCount === 0 ? (
            <div className="flex items-center justify-center gap-2 py-5 rounded-2xl border-2 border-dashed border-emerald-100 bg-emerald-50/50 text-emerald-700">
              <CheckCircle2 size={17}/><span className="text-xs font-bold">All caught up — no pending HR actions.</span>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
              {[
                { label: 'Pending Disputes', description: 'Review attendance corrections', count: pendingDisputesCount, icon: Clock3, action: () => scrollToDashboardSection('attendance-disputes') },
                { label: 'Pending Leave Requests', description: 'Approve or reject submitted leave', count: pendingLeaveCount, icon: CalendarClock, action: () => scrollToDashboardSection('leave-requests') },
                { label: 'Open Help Desk Requests', description: 'Respond to employee concerns', count: openHrSupportCount, icon: Headphones, action: openHelpdesk },
              ].map((item) => (
                <button key={item.label} type="button" onClick={item.action} className="flex min-h-16 w-full items-center gap-3 border-b border-slate-200 bg-white px-3 py-3 text-left transition last:border-b-0 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#292f2b] dark:hover:bg-slate-800">
                  <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300"><item.icon size={18}/></span>
                  <span className="min-w-0 flex-1"><span className="block text-xs font-bold text-slate-900 dark:text-white">{item.label}</span><span className="mt-0.5 block text-[10px] text-slate-500">{item.description}</span></span>
                  <span className="grid h-7 min-w-7 place-items-center rounded-full bg-slate-100 px-2 text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-200">{item.count}</span><ChevronRight size={17} className="text-slate-400"/>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="card-style !p-4">
          <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm mb-0">Attendance Insights</h3><p className="mt-0.5 text-[10px] text-slate-400">Current-month performance</p></div><button type="button" onClick={() => setAttendanceInsightModal('attendance')} className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-xs font-bold text-green-700 hover:bg-green-50 dark:text-green-300">View Insights <ChevronRight size={15}/></button></div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { key: 'attendance' as const, label: 'Attendance Rate', value: `${attendanceInsights.current.attendanceRate}%`, tone: 'text-emerald-600' },
              { key: 'late' as const, label: 'Late', value: attendanceInsights.current.late, tone: 'text-orange-600' },
              { key: 'absent' as const, label: 'Absent', value: attendanceInsights.current.absent, tone: 'text-rose-600' },
              { key: 'leave' as const, label: 'Leave', value: attendanceInsights.current.leave, tone: 'text-blue-600' },
            ].map((item) => <button type="button" key={item.key} onClick={() => setAttendanceInsightModal(item.key)} className="min-h-16 rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-left transition hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700" aria-label={`View ${item.label}`}><p className={`stat-number text-lg leading-none ${item.tone}`}>{item.value}</p><p className="mt-1 text-[10px] font-bold text-slate-600 dark:text-slate-200">{item.label}</p></button>)}
          </div>
        </section>

        <AttendanceInsightsModal modal={attendanceInsightModal} meta={attendanceInsightMeta} records={attendanceInsightRecords} initials={initials} setModal={setAttendanceInsightModal} />

        <DailyOverviewModal modal={dailyOverviewModal} meta={dailyOverviewMeta} records={dailyOverviewRecords} initials={initials} setModal={setDailyOverviewModal} />

        <EmployeeQuickViewModal fallbackLeaveCredits={fallbackLeaveCredits} formatPh={formatPh} initials={initials} openPayslipsModal={openPayslipsModal} openProfileChoice={openProfileChoice} quickViewAttendance={quickViewAttendance} quickViewCredits={quickViewCredits} quickViewProfile={quickViewProfile} scrollToDashboardSection={scrollToDashboardSection} setAttendanceHistoryOpen={setAttendanceHistoryOpen} setCutoffFilter={setCutoffFilter} setQuickViewProfile={setQuickViewProfile} setSearchTerm={setSearchTerm} setSelectedDate={setSelectedDate} statusTagClass={statusTagClass} todayManila={todayManila} />

        <TeamLeaveCalendarModal open={leaveCalendarOpen} onClose={() => setLeaveCalendarOpen(false)} calendarData={calendarData} leaveCalendarMonth={leaveCalendarMonth} selectedCalendarDate={selectedCalendarDate} selectedCalendarDay={selectedCalendarDay} setLeaveCalendarMonth={setLeaveCalendarMonth} setSelectedCalendarDate={setSelectedCalendarDate} todayManila={todayManila} />

        <AnnouncementsModal open={announcementOpen} onClose={() => setAnnouncementOpen(false)} announcementContent={announcementContent} announcementId={announcementId} announcementImageInputRef={announcementImageInputRef} announcementImagePreview={announcementImagePreview} announcementImageUrl={announcementImageUrl} announcementLoading={announcementLoading} announcementMsg={announcementMsg} announcementRemoveImage={announcementRemoveImage} announcementSaving={announcementSaving} announcementUpdatedAt={announcementUpdatedAt} clearAnnouncementImage={clearAnnouncementImage} handleAnnouncementImageChange={handleAnnouncementImageChange} publishAnnouncement={publishAnnouncement} setAnnouncementContent={setAnnouncementContent} />

        <HolidaysModal open={holidaysOpen} onClose={() => setHolidaysOpen(false)} addHoliday={addHoliday} deleteHoliday={deleteHoliday} holidayMsg={holidayMsg} holidaySaving={holidaySaving} holidays={holidays} holidaysLoading={holidaysLoading} newHolidayDate={newHolidayDate} newHolidayName={newHolidayName} setNewHolidayDate={setNewHolidayDate} setNewHolidayName={setNewHolidayName} />

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
          <EmployeesModal open={employeesListOpen} onClose={() => setEmployeesListOpen(false)} pageSize={PAGE_SIZE} employeesPage={employeesPage} employeesTotalPages={employeesTotalPages} initials={initials} loadingData={loadingData} openProfileChoice={openProfileChoice} paginatedProfiles={paginatedProfiles} profiles={profiles} setEmployeesPage={setEmployeesPage} />

          {/* Attendance History */}
          <section id="attendance-history" className="card-style overflow-hidden !p-0 scroll-mt-4">
            <button
              type="button"
              onClick={() => setAttendanceHistoryOpen((v) => !v)}
              className="w-full p-4 flex items-center justify-between gap-2"
            >
              <h3 className="text-sm mb-0">
                Raw Attendance Log
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
            <div className="min-h-[260px] max-w-full overflow-x-auto overscroll-x-contain" role="region" aria-label="Scrollable raw attendance records" tabIndex={0}>
              <table className="w-full min-w-[680px] text-left">
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

        </div>
      </div>

      <HRMobileBottomNav requestCount={pendingHrActionCount} onHome={() => scrollToDashboardSection('hr-dashboard-top')} onAttendance={openAttendanceLog} onRequests={() => scrollToDashboardSection('action-center')} onEmployees={() => setEmployeesListOpen(true)} onMore={() => setMobileToolsOpen(true)} />
      <HRMobileToolsSheet open={mobileToolsOpen} darkMode={darkMode} onClose={() => setMobileToolsOpen(false)} onToggleTheme={toggleTheme} onLogout={handleLogout} onAnnouncements={() => setAnnouncementOpen(true)} onHolidays={openHolidays} onLeaveCalendar={openLeaveCalendar} onLeaveCredits={openLeaveCreditsModal} onReports={openReports} onDocuments={openDocuments} onHelpdesk={openHelpdesk} />

      <EmployeeChoiceModal open={modalMode === 'choice'} onClose={closeModal} initials={initials} openEdit={openEdit} openPayslipsModal={openPayslipsModal} selectedProfile={selectedProfile} />

      <EmployeeEditModal open={modalMode === 'edit'} onClose={closeModal} avatarInputRef={avatarInputRef} avatarPreview={avatarPreview} avatarUploading={avatarUploading} currentAvatarUrl={currentAvatarUrl} editing={editing} editingEmployeeIdConflict={editingEmployeeIdConflict} handleAvatarChange={handleAvatarChange} saveEdit={saveEdit} saveLoading={saveLoading} setEditing={setEditing} setModalMode={setModalMode} />

      <PayslipManagementModal open={modalMode === 'payslips'} onClose={closeModal} onBack={() => setModalMode('choice')} deletePayslip={deletePayslip} employeePayslips={employeePayslips} employeePayslipsLoading={employeePayslipsLoading} generateCutoffOptions={generateCutoffOptions} payslipCutoff={payslipCutoff} payslipFile={payslipFile} payslipFileRef={payslipFileRef} payslipMsg={payslipMsg} payslipUploading={payslipUploading} publishMsg={publishMsg} publishPayslip={publishPayslip} publishingId={publishingId} selectedProfile={selectedProfile} setPayslipCutoff={setPayslipCutoff} setPayslipFile={setPayslipFile} uploadPayslip={uploadPayslip} />

      <DisputeHistoryModal open={disputesHistoryModalOpen} onClose={() => setDisputesHistoryModalOpen(false)} disputeClaimed={disputeClaimed} disputeFieldLabel={disputeFieldLabel} disputeOriginal={disputeOriginal} disputeTypeLabel={disputeTypeLabel} disputes={disputes} formatPh={formatPh} selectedDisputeDetail={selectedDisputeDetail} setSelectedDisputeDetail={setSelectedDisputeDetail} />

      <LeaveHistoryModal open={leaveHistoryModalOpen} onClose={() => setLeaveHistoryModalOpen(false)} countLeaveDays={countLeaveDays} leaveRequests={leaveRequests} selectedLeaveDetail={selectedLeaveDetail} setSelectedLeaveDetail={setSelectedLeaveDetail} />

      {/* HELP DESK REQUESTS MANAGEMENT MODAL */}
      <HelpDeskRequestsModal open={hrSupportModalOpen} onClose={() => setHrSupportModalOpen(false)} loading={hrSupportLoading} requests={hrSupportRequests} drafts={hrSupportDrafts} setDrafts={setHrSupportDrafts} savingId={hrSupportSavingId} onSave={saveHrSupportRequest} />

      {/* EMPLOYEE DOCUMENTS MANAGEMENT MODAL */}
      <EmployeeDocumentsModal open={hrDocumentsModalOpen} onClose={() => setHrDocumentsModalOpen(false)} saving={hrDocumentSaving} loading={hrDocumentsLoading} title={hrDocumentTitle} setTitle={setHrDocumentTitle} category={hrDocumentCategory} setCategory={setHrDocumentCategory} file={hrDocumentFile} setFile={setHrDocumentFile} fileRef={hrDocumentFileRef} documents={hrDocuments} onUpload={uploadHrDocument} onToggle={toggleHrDocument} onDelete={deleteHrDocument} />

      <LeaveCreditsModal open={leaveCreditsModalOpen} onClose={() => setLeaveCreditsModalOpen(false)} fallbackLeaveCredits={fallbackLeaveCredits} leaveCreditsLoading={leaveCreditsLoading} sortedLeaveCreditsData={sortedLeaveCreditsData} />

      <ExportReportsModal open={exportModalOpen} onClose={() => setExportModalOpen(false)} availableCutoffs={availableCutoffs} exportCutoff={exportCutoff} exportEmployeeMasterListCSV={exportEmployeeMasterListCSV} exportEmployeeMasterListPDF={exportEmployeeMasterListPDF} exportMsg={exportMsg} exportPayrollSummaryCSV={exportPayrollSummaryCSV} exportPayrollSummaryPDF={exportPayrollSummaryPDF} exportRawAttendanceCSV={exportRawAttendanceCSV} exportRawAttendancePDF={exportRawAttendancePDF} exportingType={exportingType} formatCutoffLabel={formatCutoffLabel} rawExportMonth={rawExportMonth} rawExportPeriod={rawExportPeriod} rawExportPreviewCount={rawExportPreviewCount} setExportCutoff={setExportCutoff} setExportMsg={setExportMsg} setRawExportMonth={setRawExportMonth} setRawExportPeriod={setRawExportPeriod} />


    </main>
  );
}
