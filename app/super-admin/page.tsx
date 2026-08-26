'use client';
import AccountFormModal from '@/components/super-admin/modals/AccountFormModal';
import ResetPasswordModal from '@/components/super-admin/modals/ResetPasswordModal';
import UserAccountsModal from '@/components/super-admin/modals/UserAccountsModal';
import AttendanceRecordsModal from '@/components/super-admin/modals/AttendanceRecordsModal';
import AppSettingsModal from '@/components/super-admin/modals/AppSettingsModal';
import DataArchiveModal from '@/components/super-admin/modals/DataArchiveModal';
import DatabaseBackupModal from '@/components/super-admin/modals/DatabaseBackupModal';
import ArchivePasswordModal from '@/components/super-admin/modals/ArchivePasswordModal';
import BackupPasswordModal from '@/components/super-admin/modals/BackupPasswordModal';
import EditAttendanceModal from '@/components/super-admin/modals/EditAttendanceModal';

import { useState, useEffect, useMemo } from 'react';
import { supabase, supabaseAuthActions } from '@/lib/supabase';
import Spinner from '@/components/Spinner';
import SystemHealthModal from '@/components/super-admin/modals/SystemHealthModal';
import AuditLogModal from '@/components/super-admin/modals/AuditLogModal';

const PAGE_SIZE = 5;

export default function SuperAdminDashboard() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);

  // Create account fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [designation, setDesignation] = useState('');
  const [role, setRole] = useState<'employee' | 'admin'>('employee');

  // Edit account fields
  const [editingId, setEditingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Reset password fields
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  // Local success/error message for the Reset Password modal -- the
  // top-level `message` banner lives on the page behind the modal
  // overlay and isn't visible while the modal is open, so this needs
  // its own feedback shown inside the modal itself.
  const [resetPasswordMsg, setResetPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Attendance records (for dispute/late corrections)
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);

  // Translates raw Postgres/Auth error text into a friendly, specific
  // message the user can actually act on, instead of showing the raw
  // "duplicate key value violates unique constraint ..." text.
  const getFriendlyErrorMessage = (rawMessage: string): string => {
    const msg = rawMessage.toLowerCase();

    if (msg.includes('profiles_employee_id_key') || (msg.includes('employee_id') && msg.includes('duplicate'))) {
      return 'This Employee ID is already in use by another account. Please use a different one.';
    }
    if (msg.includes('already been registered') || msg.includes('already registered') || (msg.includes('email') && msg.includes('duplicate'))) {
      return 'An account with this email already exists.';
    }
    if (msg.includes('password') && (msg.includes('short') || msg.includes('least'))) {
      return 'Password is too short. It must be at least 6 characters.';
    }
    if (msg.includes('invalid') && msg.includes('email')) {
      return 'This email address is not a valid format.';
    }
    if (msg.includes('duplicate key value violates unique constraint')) {
      return 'Another account is already using the same information (e.g. Employee ID or Email). Please check and try again.';
    }
    return rawMessage;
  };

  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceFetched, setAttendanceFetched] = useState(false);

  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveResult, setArchiveResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [archivePasswordModalOpen, setArchivePasswordModalOpen] = useState(false);
  const [archivePasswordInput, setArchivePasswordInput] = useState('');
  const [archivePasswordError, setArchivePasswordError] = useState<string | null>(null);
  const [archivePasswordVerifying, setArchivePasswordVerifying] = useState(false);

  // --- Database Backup (mirrors the Archive password-confirmation pattern
  // above) -- triggers the n8n workflow, which runs a full pg_dump on the
  // server and emails the result. Gated behind a re-entered password the
  // same way the archive action is, since this touches the entire
  // database (including the auth schema).
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupResult, setBackupResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [backupPasswordModalOpen, setBackupPasswordModalOpen] = useState(false);
  const [backupPasswordInput, setBackupPasswordInput] = useState('');
  const [backupPasswordError, setBackupPasswordError] = useState<string | null>(null);
  const [backupPasswordVerifying, setBackupPasswordVerifying] = useState(false);

  // --- Section modals -- every management area (Create/Edit Account,
  // Reset Password, User Accounts, Attendance Records, Data Archival,
  // Database Backup) now opens from a compact icon button into its own
  // modal, instead of an always-visible or accordion-expanding card.
  // Keeps the dashboard body short and uncluttered.
  const [createAccountModalOpen, setCreateAccountModalOpen] = useState(false);
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
  const [userAccountsModalOpen, setUserAccountsModalOpen] = useState(false);
  const [attendanceRecordsModalOpen, setAttendanceRecordsModalOpen] = useState(false);
  const [archivalModalOpen, setArchivalModalOpen] = useState(false);
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [auditLogModalOpen, setAuditLogModalOpen] = useState(false);
  const [healthModalOpen, setHealthModalOpen] = useState(false);
  const [appSettingsModalOpen, setAppSettingsModalOpen] = useState(false);
  const [appSettings, setAppSettings] = useState<{
    late_cutoff_hour: number;
    late_cutoff_minute: number;
    default_leave_credits: number;
    time_out_reminder_hour: number;
    support_response_target_hours: number;
    payslip_ack_reminder_days: number;
    dashboard_refresh_seconds: number;
  }>({ late_cutoff_hour: 9, late_cutoff_minute: 15, default_leave_credits: 10, time_out_reminder_hour: 19, support_response_target_hours: 24, payslip_ack_reminder_days: 3, dashboard_refresh_seconds: 60 });
  const [appSettingsLoading, setAppSettingsLoading] = useState(false);
  const [appSettingsSaving, setAppSettingsSaving] = useState(false);
  const [appSettingsMsg, setAppSettingsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [lastArchiveAt, setLastArchiveAt] = useState<string | null>(null);
  const [healthStatusLoading, setHealthStatusLoading] = useState(false);
  const [currentAdminEmail, setCurrentAdminEmail] = useState<string | null>(null);

  // Audit Log -- read-only trail of admin/system actions. Entries are
  // written via the log_audit_event() RPC (see migration), which stamps
  // actor_id from the caller's own session -- never trusted from client
  // input -- so this list can't be spoofed by calling code.
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  const [auditLogsFetched, setAuditLogsFetched] = useState(false);
  const [auditLogPage, setAuditLogPage] = useState(1);

  const fetchAuditLogs = async () => {
    setAuditLogsLoading(true);
    const { data, error } = await supabase
      .from('audit_logs')
      .select('id, created_at, actor_name, action, entity_type, summary')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) console.error('Error fetching audit logs:', error);
    setAuditLogs(data || []);
    setAuditLogsLoading(false);
  };

  const openAuditLogModal = () => {
    setAuditLogPage(1);
    setAuditLogModalOpen(true);
    if (!auditLogsFetched) {
      setAuditLogsFetched(true);
      fetchAuditLogs();
    }
  };

  // Fire-and-forget logging helper -- the action itself already
  // succeeded by the time this is called, so a logging failure
  // shouldn't surface as an error to the admin. Just console.error it.
  const logAuditEvent = async (action: string, entityType: string, entityId: string | null, summary: string) => {
    const { error } = await supabase.rpc('log_audit_event', {
      p_action: action,
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_summary: summary,
    });
    if (error) console.error('Error logging audit event:', error);
  };

  const auditActionMeta = (action: string): { icon: string; label: string } => {
    switch (action) {
      case 'account_created': return { icon: '➕', label: 'Account Created' };
      case 'account_updated': return { icon: '✏️', label: 'Account Updated' };
      case 'account_deactivated': return { icon: '🚫', label: 'Account Deactivated' };
      case 'account_reactivated': return { icon: '✅', label: 'Account Reactivated' };
      case 'password_reset_sent': return { icon: '🔑', label: 'Password Reset Sent' };
      case 'data_archived': return { icon: '🗃️', label: 'Data Archived' };
      case 'database_backup': return { icon: '🗄️', label: 'Database Backup' };
      case 'test_email_sent': return { icon: '📧', label: 'Test Email Sent' };
      case 'app_settings_updated': return { icon: '⚙️', label: 'App Settings Updated' };
      default: return { icon: '📝', label: action };
    }
  };

  const auditLogTotalPages = Math.max(1, Math.ceil(auditLogs.length / PAGE_SIZE));
  const paginatedAuditLogs = auditLogs.slice((auditLogPage - 1) * PAGE_SIZE, auditLogPage * PAGE_SIZE);

  // --- System Health ---
  // "Last Backup" / "Last Archive" are read straight from the audit
  // trail we already write to -- no separate tracking table needed.
  // "Send Test Email" reuses the password-reset flow (targeted at the
  // currently logged-in admin's own email) since that's already wired
  // through the exact same custom SMTP path every other auth email
  // uses -- a real end-to-end proof it works, not a synthetic check.
  const openHealthModal = async () => {
    setTestEmailResult(null);
    setHealthModalOpen(true);
    setHealthStatusLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    setCurrentAdminEmail(user?.email ?? null);

    const [{ data: backupRow }, { data: archiveRow }] = await Promise.all([
      supabase.from('audit_logs').select('created_at').eq('action', 'database_backup').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('audit_logs').select('created_at').eq('action', 'data_archived').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    setLastBackupAt(backupRow?.created_at ?? null);
    setLastArchiveAt(archiveRow?.created_at ?? null);
    setHealthStatusLoading(false);
  };

  const sendTestEmail = async () => {
    if (!currentAdminEmail) {
      setTestEmailResult({ type: 'error', text: 'Could not determine your account email.' });
      return;
    }
    setTestEmailLoading(true);
    setTestEmailResult(null);
    try {
      const redirectTo = `${window.location.origin}/auth/reset-password`;
      const { error } = await supabaseAuthActions.auth.resetPasswordForEmail(currentAdminEmail, { redirectTo });
      if (error) throw error;
      setTestEmailResult({ type: 'success', text: `Test email sent to ${currentAdminEmail}. If it arrives, custom SMTP is working end-to-end.` });
      await logAuditEvent('test_email_sent', 'system', null, `Sent a test email to ${currentAdminEmail} to verify SMTP.`);
    } catch (err: any) {
      console.error('Error sending test email:', err);
      setTestEmailResult({ type: 'error', text: err?.message ?? 'Failed to send test email.' });
    } finally {
      setTestEmailLoading(false);
    }
  };

  const formatHealthTimestamp = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : 'Never';

  // --- App Settings ---
  // Business rules (late cutoff, default leave credits, time-out
  // reminder hour) that used to be hardcoded across
  // app/api/time-in/route.ts, app/employee/page.tsx, and app/hr/page.tsx.
  // All three now read these values live from app_settings, so editing
  // here takes effect immediately without a code change or redeploy.
  const openAppSettingsModal = async () => {
    setAppSettingsMsg(null);
    setAppSettingsModalOpen(true);
    setAppSettingsLoading(true);
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['late_cutoff_hour', 'late_cutoff_minute', 'default_leave_credits', 'time_out_reminder_hour', 'support_response_target_hours', 'payslip_ack_reminder_days', 'dashboard_refresh_seconds']);
    if (error) {
      console.error('Error fetching app settings:', error);
      setAppSettingsMsg({ type: 'error', text: error.message });
      setAppSettingsLoading(false);
      return;
    }
    const map = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
    setAppSettings({
      late_cutoff_hour: typeof map.late_cutoff_hour === 'number' ? map.late_cutoff_hour : 9,
      late_cutoff_minute: typeof map.late_cutoff_minute === 'number' ? map.late_cutoff_minute : 15,
      default_leave_credits: typeof map.default_leave_credits === 'number' ? map.default_leave_credits : 10,
      time_out_reminder_hour: typeof map.time_out_reminder_hour === 'number' ? map.time_out_reminder_hour : 19,
      support_response_target_hours: typeof map.support_response_target_hours === 'number' ? map.support_response_target_hours : 24,
      payslip_ack_reminder_days: typeof map.payslip_ack_reminder_days === 'number' ? map.payslip_ack_reminder_days : 3,
      dashboard_refresh_seconds: typeof map.dashboard_refresh_seconds === 'number' ? map.dashboard_refresh_seconds : 60,
    });
    setAppSettingsLoading(false);
  };

  const saveAppSettings = async () => {
    setAppSettingsSaving(true);
    setAppSettingsMsg(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const rows = [
        { key: 'late_cutoff_hour', value: appSettings.late_cutoff_hour },
        { key: 'late_cutoff_minute', value: appSettings.late_cutoff_minute },
        { key: 'default_leave_credits', value: appSettings.default_leave_credits },
        { key: 'time_out_reminder_hour', value: appSettings.time_out_reminder_hour },
        { key: 'support_response_target_hours', value: appSettings.support_response_target_hours },
        { key: 'payslip_ack_reminder_days', value: appSettings.payslip_ack_reminder_days },
        { key: 'dashboard_refresh_seconds', value: appSettings.dashboard_refresh_seconds },
      ];
      for (const row of rows) {
        const { error } = await supabase
          .from('app_settings')
          .upsert({ key: row.key, value: row.value, updated_at: new Date().toISOString(), updated_by: user?.id ?? null }, { onConflict: 'key' });
        if (error) throw error;
      }
      setAppSettingsMsg({ type: 'success', text: 'Settings saved. Takes effect immediately for new time-ins and dashboard loads.' });
      await logAuditEvent(
        'app_settings_updated',
        'system',
        null,
        `Updated app settings: late cutoff ${appSettings.late_cutoff_hour}:${String(appSettings.late_cutoff_minute).padStart(2, '0')}, leave credits ${appSettings.default_leave_credits}, support target ${appSettings.support_response_target_hours}h, payslip reminder ${appSettings.payslip_ack_reminder_days}d, refresh ${appSettings.dashboard_refresh_seconds}s`
      );
    } catch (err: any) {
      console.error('Error saving app settings:', err);
      setAppSettingsMsg({ type: 'error', text: err?.message ?? 'Failed to save settings.' });
    } finally {
      setAppSettingsSaving(false);
    }
  };

  // Pagination -- 5 records per page for both the User Accounts list and
  // the Attendance Records list, now that both live inside a fixed-size
  // modal rather than a full-width page section.
  const [employeesPage, setEmployeesPage] = useState(1);
  const [attendancePage, setAttendancePage] = useState(1);

  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [attendanceDateFilter, setAttendanceDateFilter] = useState(() =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())
  );
  const [editingLog, setEditingLog] = useState<{
    id: string;
    employeeName: string;
    timeInLocal: string; // datetime-local value, in PH time
    timeOutLocal: string; // datetime-local value, in PH time (can be empty)
    status: string;
  } | null>(null);
  const [logSaving, setLogSaving] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    setEmployeesLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching profiles:', error);
      setMessage({ type: 'error', text: error.message });
      setEmployeesLoading(false);
      return;
    }

    setEmployees(data || []);
    setEmployeesLoading(false);
  };

  const fetchAttendanceLogs = async () => {
    setAttendanceLoading(true);
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('id, time_in, time_out, log_date, status, profiles(full_name)')
      // log_date is always populated (unlike time_in, which is null for
      // 'Absent' rows) -- ordering by it keeps the most recent days first
      // regardless of status. nullsFirst: false on time_in keeps each
      // day's real time-ins ahead of any Absent placeholder for that day.
      .order('log_date', { ascending: false })
      .order('time_in', { ascending: false, nullsFirst: false })
      .limit(200);

    if (error) {
      console.error('Error fetching attendance logs:', error);
      setMessage({ type: 'error', text: error.message });
      setAttendanceLoading(false);
      return;
    }

    setAttendanceLogs(data || []);
    setAttendanceLoading(false);
  };

  const openUserAccountsModal = () => {
    setEmployeesPage(1);
    setUserAccountsModalOpen(true);
  };

  const openAttendanceRecordsModal = () => {
    setAttendancePage(1);
    setAttendanceRecordsModalOpen(true);
    if (!attendanceFetched) {
      setAttendanceFetched(true);
      fetchAttendanceLogs();
    }
  };

  // --- Manila timezone helpers ---
  // The database always stores UTC. The Philippines has a fixed UTC+8
  // offset (no daylight saving), so we can safely convert both ways
  // without needing a full timezone library.

  const toManilaInputValue = (iso: string) => {
    const d = new Date(iso);
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = fmt.formatToParts(d).reduce((acc: any, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  };

  const manilaInputValueToUTCISO = (value: string) => {
    // value looks like "2026-07-03T08:09" (a PH wall-clock time)
    return new Date(`${value}:00+08:00`).toISOString();
  };

  const toManilaDateString = (iso: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(iso));

  const todayManila = toManilaDateString(new Date().toISOString());

  const filteredAttendanceLogs = attendanceLogs.filter((log) => {
    const matchesSearch = log.profiles?.full_name
      ?.toLowerCase()
      .includes(attendanceSearch.toLowerCase());
    // Use log_date directly -- it's always populated, unlike time_in, which
    // is null for 'Absent' rows (no time-in happened that day) and would
    // otherwise make those rows unmatchable by any date filter.
    const matchesDate = attendanceDateFilter
      ? log.log_date === attendanceDateFilter
      : true;
    return matchesSearch && matchesDate;
  });

  // Reset to page 1 whenever the search or date filter changes, so we
  // don't land on a now-empty page.
  const handleAttendanceSearchChange = (value: string) => {
    setAttendanceSearch(value);
    setAttendancePage(1);
  };
  const handleAttendanceDateChange = (value: string) => {
    setAttendanceDateFilter(value);
    setAttendancePage(1);
  };

  const attendanceTotalPages = Math.max(1, Math.ceil(filteredAttendanceLogs.length / PAGE_SIZE));
  const paginatedAttendanceLogs = filteredAttendanceLogs.slice(
    (attendancePage - 1) * PAGE_SIZE,
    attendancePage * PAGE_SIZE
  );

  const employeesTotalPages = Math.max(1, Math.ceil(employees.length / PAGE_SIZE));
  const paginatedEmployees = employees.slice(
    (employeesPage - 1) * PAGE_SIZE,
    employeesPage * PAGE_SIZE
  );

  const startEditLog = (log: any) => {
    setEditingLog({
      id: log.id,
      employeeName: log.profiles?.full_name ?? 'Unknown',
      timeInLocal: log.time_in ? toManilaInputValue(log.time_in) : '',
      timeOutLocal: log.time_out ? toManilaInputValue(log.time_out) : '',
      status: log.status ?? 'Present',
    });
  };

  const handleArchiveOldRecords = () => {
    setArchivalModalOpen(false);
    setArchivePasswordInput('');
    setArchivePasswordError(null);
    setArchivePasswordModalOpen(true);
  };

  const confirmArchiveWithPassword = async () => {
    setArchivePasswordError(null);

    const { data: userData, error: getUserError } = await supabase.auth.getUser();
    if (getUserError || !userData.user?.email) {
      setArchivePasswordError('Could not verify your session. Please try logging in again.');
      return;
    }

    setArchivePasswordVerifying(true);

    // There's no dedicated "just check this password" endpoint -- the
    // standard way to re-verify is to sign in again with it. Since it's
    // the same account, this just refreshes the existing session; it
    // doesn't log anyone else in or out.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: userData.user.email,
      password: archivePasswordInput,
    });

    setArchivePasswordVerifying(false);

    if (signInError) {
      setArchivePasswordError('Incorrect password.');
      return;
    }

    setArchivePasswordModalOpen(false);
    setArchivePasswordInput('');
    // Reopen the Data Archival modal so the success/error result has
    // somewhere to display -- it was closed to keep focus on the
    // password prompt, and now shows the "Archiving..." spinner followed
    // by the result once runArchiveOldRecords() finishes.
    setArchivalModalOpen(true);
    await runArchiveOldRecords();
  };

  const runArchiveOldRecords = async () => {
    setArchiveLoading(true);
    setArchiveResult(null);

    const { data, error } = await supabase.rpc('archive_old_records');

    if (error) {
      setArchiveResult({ type: 'error', text: error.message });
      setArchiveLoading(false);
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    const total =
      (row?.archived_attendance_logs ?? 0) +
      (row?.archived_disputes ?? 0) +
      (row?.archived_leave_requests ?? 0) +
      (row?.archived_leave_request_days ?? 0);

    setArchiveResult({
      type: 'success',
      text:
        total === 0
          ? 'Nothing to archive yet -- no records older than 1 year.'
          : `Archived ${row.archived_attendance_logs} attendance log(s), ${row.archived_disputes} dispute(s), ${row.archived_leave_requests} leave request(s), and ${row.archived_leave_request_days} leave day(s).`,
    });

    await logAuditEvent('data_archived', 'system', null,
      total === 0
        ? 'Ran data archival -- nothing older than 1 year to move.'
        : `Archived ${row.archived_attendance_logs} attendance log(s), ${row.archived_disputes} dispute(s), ${row.archived_leave_requests} leave request(s), ${row.archived_leave_request_days} leave day(s).`
    );

    // Refresh so the (now-shrunk) live tables reflect immediately.
    await fetchAttendanceLogs();
    setArchiveLoading(false);
  };

  // --- Database Backup handlers (mirrors the archive flow exactly) ---
  const handleBackupDatabase = () => {
    setBackupModalOpen(false);
    setBackupPasswordInput('');
    setBackupPasswordError(null);
    setBackupPasswordModalOpen(true);
  };

  const confirmBackupWithPassword = async () => {
    setBackupPasswordError(null);

    const { data: userData, error: getUserError } = await supabase.auth.getUser();
    if (getUserError || !userData.user?.email) {
      setBackupPasswordError('Could not verify your session. Please try logging in again.');
      return;
    }

    setBackupPasswordVerifying(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: userData.user.email,
      password: backupPasswordInput,
    });

    setBackupPasswordVerifying(false);

    if (signInError) {
      setBackupPasswordError('Incorrect password.');
      return;
    }

    setBackupPasswordModalOpen(false);
    setBackupPasswordInput('');
    // Same reasoning as the archival flow -- reopen so the result has
    // somewhere to display.
    setBackupModalOpen(true);
    await runBackupDatabase();
  };

  const runBackupDatabase = async () => {
    setBackupLoading(true);
    setBackupResult(null);

    try {
      const res = await fetch('/api/backup-database', { method: 'POST' });
      const result = await res.json();

      if (!res.ok) throw new Error(result.error || 'Failed to start the backup.');

      setBackupResult({
        type: 'success',
        text: "Backup started! It's running on the server now -- you'll get an email with the .sql file attached once it finishes (success or failure).",
      });
      await logAuditEvent('database_backup', 'system', null, 'Triggered a full database backup.');
    } catch (err: any) {
      console.error('Error triggering backup:', err);
      setBackupResult({ type: 'error', text: err?.message ?? 'Failed to start the backup.' });
    } finally {
      setBackupLoading(false);
    }
  };

  const saveEditLog = async () => {
    if (!editingLog) return;
    setLogSaving(true);

    try {
      const newTimeInISO = manilaInputValueToUTCISO(editingLog.timeInLocal);
      // Keep log_date consistent with the corrected time_in (in PH time)
      const newLogDate = editingLog.timeInLocal.split('T')[0];
      // time_out is optional -- only convert it if the admin filled it in.
      const newTimeOutISO = editingLog.timeOutLocal
        ? manilaInputValueToUTCISO(editingLog.timeOutLocal)
        : null;

      const { data: updatedRows, error } = await supabase
        .from('attendance_logs')
        .update({
          time_in: newTimeInISO,
          time_out: newTimeOutISO,
          log_date: newLogDate,
          status: editingLog.status,
        })
        .eq('id', editingLog.id)
        .select();

      if (error) throw error;

      if (!updatedRows || updatedRows.length === 0) {
        throw new Error(
          'No record was updated. This is usually an RLS policy issue — make sure the attendance_logs table has an UPDATE policy for the admin/super_admin role.'
        );
      }

      setMessage({ type: 'success', text: 'Attendance record updated.' });
      setEditingLog(null);
      await fetchAttendanceLogs();
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err?.message ?? 'Failed to update record.' });
    } finally {
      setLogSaving(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setEmployeeId('');
    setDesignation('');
    setRole('employee');
    setCreateAccountModalOpen(false);
  };

  // Opens the Create Account modal fresh (not editing anyone).
  const openCreateAccountModal = () => {
    setEditingId(null);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setEmployeeId('');
    setDesignation('');
    setRole('employee');
    setMessage(null);
    setCreateAccountModalOpen(true);
  };

  const startEdit = (emp: any) => {
    setEditingId(emp.id);
    setFullName(emp.full_name ?? '');
    setEmployeeId(emp.employee_id ?? '');
    setDesignation(emp.designation ?? '');
    setRole((emp.role ?? 'employee') as 'employee' | 'admin');
    setMessage(null);
    setUserAccountsModalOpen(false);
    setCreateAccountModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingId && password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      if (editingId) {
        // Editing an existing profile stays a normal client-side update,
        // since it doesn't touch auth and RLS should already restrict
        // this to admins only.
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: fullName,
            role,
            designation,
            employee_id: employeeId,
          })
          .eq('id', editingId);

        if (error) throw error;

        setMessage({ type: 'success', text: 'Account updated successfully.' });
        await logAuditEvent('account_updated', 'profile', editingId, `Updated account for ${fullName} (${employeeId || 'no ID'})`);
        resetForm();
        await fetchEmployees();
        return;
      }

      // Create mode: call our secure server-side API route instead of
      // supabase.auth.signUp(). signUp() would create the user AND log
      // them in on this browser, silently kicking out the admin's own
      // session. The API route uses the service_role key on the server
      // to create the user without touching the admin's session at all.
      const res = await fetch('/api/create-employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          fullName,
          employeeId,
          designation,
          role,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Failed to create account.');
      }

      setMessage({
        type: 'success',
        text: `Account created successfully for ${fullName}!`,
      });

      await logAuditEvent('account_created', 'profile', result?.id ?? null, `Created ${role} account for ${fullName} (${employeeId || 'no ID'})`);
      resetForm();
      await fetchEmployees();
    } catch (err: any) {
      console.error(err);
      const friendly = getFriendlyErrorMessage(err?.message ?? 'Something went wrong');
      setMessage({ type: 'error', text: friendly });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setResetPasswordMsg(null);

    try {
      const redirectTo = `${window.location.origin}/auth/reset-password`;

      // Uses supabaseAuthActions (a plain, non-cookie-syncing client) so
      // the generated recovery link is implicit-flow / hash-based, not
      // tied to a PKCE verifier stored in THIS (the admin's) browser --
      // see lib/supabase.ts for the full explanation.
      const { error } = await supabaseAuthActions.auth.resetPasswordForEmail(resetEmail, {
        redirectTo,
      });

      if (error) throw error;

      setResetPasswordMsg({ type: 'success', text: 'Check your email for reset password instructions.' });
      await logAuditEvent('password_reset_sent', 'profile', null, `Sent password reset email to ${resetEmail}`);
      // Only clear the field once we know it actually succeeded --
      // an error leaves the typed email in place so the admin doesn't
      // have to retype it after fixing whatever went wrong.
      setResetEmail('');
      setTimeout(() => {
        setResetPasswordModalOpen(false);
        setResetPasswordMsg(null);
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setResetPasswordMsg({ type: 'error', text: err?.message ?? 'Reset password failed' });
    } finally {
      setResetLoading(false);
    }
  };

  // Real-time warning: flags if the Employee ID being typed already
  // belongs to another account, so the admin sees it BEFORE submitting
  // instead of only after a failed save. Excludes the profile currently
  // being edited (so editing someone's own record doesn't false-flag).
  const employeeIdConflict = useMemo(() => {
    const trimmed = employeeId.trim().toLowerCase();
    if (!trimmed) return null;
    const match = employees.find(
      (emp) =>
        emp.employee_id?.trim().toLowerCase() === trimmed && emp.id !== editingId
    );
    return match ? match.full_name : null;
  }, [employeeId, employees, editingId]);

  // Same idea for Full Name -- not a hard DB constraint, but duplicate
  // names are a common source of mix-ups, so we warn (non-blocking).
  const fullNameConflict = useMemo(() => {
    const trimmed = fullName.trim().toLowerCase();
    if (!trimmed) return null;
    const match = employees.find(
      (emp) =>
        emp.full_name?.trim().toLowerCase() === trimmed && emp.id !== editingId
    );
    return match ? true : false;
  }, [fullName, employees, editingId]);

  // Email can't be checked client-side (emails live in auth.users, not
  // the profiles table the browser can read), so we debounce a call to
  // our own /api/check-email route as the admin types.
  const [emailConflict, setEmailConflict] = useState(false);
  const [emailChecking, setEmailChecking] = useState(false);

  useEffect(() => {
    // Only relevant when creating a new account, not editing an existing
    // one (edit mode doesn't show/change the email field at all).
    if (editingId || !email.trim()) {
      setEmailConflict(false);
      return;
    }

    const basicEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!basicEmailPattern.test(email.trim())) {
      setEmailConflict(false);
      return;
    }

    setEmailChecking(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/check-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        });
        const result = await res.json();
        setEmailConflict(!!result.exists);
      } catch (err) {
        console.error('Error checking email availability:', err);
        // Fail open -- don't block the form just because the check
        // itself failed; the server-side create step will still catch
        // a real duplicate.
        setEmailConflict(false);
      } finally {
        setEmailChecking(false);
      }
    }, 500); // debounce so we're not firing a request on every keystroke

    return () => clearTimeout(timer);
  }, [email, editingId]);

  const [deactivating, setDeactivating] = useState(false);

  const toggleAccountActive = async (deactivate: boolean) => {
    if (!editingId) return;

    const editingEmployee = employees.find((e) => e.id === editingId);
    const confirmMsg = deactivate
      ? `Deactivate ${editingEmployee?.full_name ?? 'this account'}? They will no longer be able to log in, but their attendance, leave, and payslip history stays intact.`
      : `Reactivate ${editingEmployee?.full_name ?? 'this account'}? They will be able to log in again.`;

    if (!confirm(confirmMsg)) return;

    setDeactivating(true);
    setMessage(null);
    try {
      const res = await fetch('/api/deactivate-employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: editingId, deactivate }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to update account status.');

      setMessage({ type: 'success', text: result.message });
      await logAuditEvent(
        deactivate ? 'account_deactivated' : 'account_reactivated',
        'profile',
        editingId,
        `${deactivate ? 'Deactivated' : 'Reactivated'} account for ${editingEmployee?.full_name ?? 'unknown'}`
      );
      resetForm();
      await fetchEmployees();
    } catch (err: any) {
      console.error('Error toggling account active state:', err);
      setMessage({ type: 'error', text: err?.message ?? 'Failed to update account status.' });
    } finally {
      setDeactivating(false);
    }
  };

  const roleTagClass = (r: string) => (r === 'admin' ? 'tag-admin' : 'tag-employee');

  // Type-specific leave statuses (e.g. "Sick Leave", "Vacation Leave",
  // "Emergency Leave") set by settle_leave_day() all get the same tag
  // styling as the old generic "Leave" status -- match by substring.
  const statusTagClass = (s: string) => {
    const v = s?.toLowerCase() ?? '';
    if (v === 'late') return 'tag-late';
    if (v === 'excused') return 'tag-excused';
    if (v === 'absent') return 'tag-absent';
    if (v.includes('leave')) return 'tag-leave';
    return 'tag-present';
  };

  const initials = (name: string | null) =>
    (name || '?')
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  // Only relevant while creating a new account (editing never shows the
  // password fields). Only flags once both fields have something typed,
  // so the note doesn't flash red while the person is still typing the
  // first field.
  const passwordMismatch =
    !editingId && password.length > 0 && confirmPassword.length > 0 && password !== confirmPassword;

  const totalAccounts = employees.length;
  const totalAdmins = employees.filter((e) => e.role === 'admin').length;
  const totalEmployeesCount = employees.filter((e) => e.role === 'employee').length;
  const incompleteProfilesCount = employees.filter((e) => e.role === 'employee' && (!e.full_name || !e.employee_id || !e.designation || !e.avatar_url || !e.employee_email)).length;

  return (
    <main className="min-h-screen p-3 sm:p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-3 sm:space-y-4 md:space-y-5">
        {/* SUPER ADMIN HEADER — aligned with HR / Employee hierarchy */}
        <header className="branding-box !p-4 sm:!p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-slate-950 text-white flex items-center justify-center text-lg flex-shrink-0 shadow-sm">
                🛡️
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-base sm:text-lg md:text-xl leading-tight">HAMDAN ENGINEERING</h1>
                  <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-[8px] font-extrabold uppercase tracking-wider">
                    Super Admin
                  </span>
                </div>
                <p className="text-slate-400 text-[10px] font-medium mt-1">
                  Manage workforce access, shared HR rules, security, and system operations.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:flex-shrink-0">
              <button
                type="button"
                onClick={openHealthModal}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-extrabold hover:bg-emerald-100 transition"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                System status
              </button>
              <button
                onClick={() =>
                  supabase.auth.signOut().then(() => (window.location.href = '/'))
                }
                className="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 font-bold text-[10px] hover:bg-red-50 hover:text-red-600 transition"
                type="button"
              >
                Log Out
              </button>
            </div>
          </div>
        </header>

        {message && (
          <div
            className={`p-3.5 rounded-2xl text-xs font-bold border ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                : 'bg-red-50 text-red-700 border-red-100'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* ADMIN OVERVIEW */}
        <section className="space-y-2.5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[9px] uppercase tracking-[0.18em] font-extrabold text-slate-400">
                Administration overview
              </p>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 mt-0.5">
                Workforce & access
              </h2>
            </div>
            <button
              type="button"
              onClick={openUserAccountsModal}
              className="text-[9px] font-extrabold text-slate-500 hover:text-slate-900 transition"
            >
              View accounts →
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            <button
              type="button"
              onClick={openUserAccountsModal}
              className="card-dark !p-3.5 sm:!p-4 flex items-center gap-3 text-left hover:-translate-y-0.5 transition"
            >
              <span className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-base flex-shrink-0">👥</span>
              <span className="min-w-0">
                <span className="stat-number text-xl sm:text-2xl text-white block leading-none">{totalAccounts}</span>
                <span className="text-white/60 text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wide block mt-1">Total Accounts</span>
              </span>
            </button>

            <button
              type="button"
              onClick={openUserAccountsModal}
              className="card-style !p-3.5 sm:!p-4 flex items-center gap-3 text-left hover:bg-sky-50/50 hover:-translate-y-0.5 transition"
            >
              <span className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center text-base flex-shrink-0">🧑‍💼</span>
              <span className="min-w-0">
                <span className="stat-number text-xl sm:text-2xl text-sky-600 block leading-none">{totalEmployeesCount}</span>
                <span className="text-slate-500 text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wide block mt-1">Employees</span>
              </span>
            </button>

            <button
              type="button"
              onClick={openUserAccountsModal}
              className="card-style !p-3.5 sm:!p-4 flex items-center gap-3 text-left hover:bg-violet-50/50 hover:-translate-y-0.5 transition"
            >
              <span className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center text-base flex-shrink-0">🧑‍💻</span>
              <span className="min-w-0">
                <span className="stat-number text-xl sm:text-2xl text-violet-600 block leading-none">{totalAdmins}</span>
                <span className="text-slate-500 text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wide block mt-1">HR Admins</span>
              </span>
            </button>

            <button
              type="button"
              onClick={openUserAccountsModal}
              className="card-style !p-3.5 sm:!p-4 flex items-center gap-3 text-left hover:bg-amber-50/50 hover:-translate-y-0.5 transition"
            >
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${
                incompleteProfilesCount ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
              }`}>
                {incompleteProfilesCount ? '⚠️' : '✓'}
              </span>
              <span className="min-w-0">
                <span className={`stat-number text-xl sm:text-2xl block leading-none ${
                  incompleteProfilesCount ? 'text-amber-600' : 'text-emerald-600'
                }`}>{incompleteProfilesCount}</span>
                <span className="text-slate-500 text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wide block mt-1">Incomplete</span>
              </span>
            </button>
          </div>
        </section>

        {/* PRIMARY MANAGEMENT — mirrors HR / Employee module hierarchy */}
        <section className="card-style !p-3.5 sm:!p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-[9px] uppercase tracking-[0.18em] font-extrabold text-slate-400">
                Primary management
              </p>
              <h2 className="text-sm font-extrabold text-slate-900 mt-0.5">
                People, attendance & shared rules
              </h2>
            </div>
            <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[8px] font-extrabold">
              HR + Employee aligned
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={openCreateAccountModal}
              className="rounded-2xl border border-slate-200 bg-white p-3 flex items-center gap-3 text-left hover:bg-sky-50/60 hover:border-sky-100 hover:-translate-y-0.5 transition min-h-[72px]"
            >
              <span className="w-10 h-10 rounded-2xl bg-sky-50 flex items-center justify-center text-lg flex-shrink-0">➕</span>
              <span className="min-w-0">
                <span className="block font-extrabold text-slate-900 text-xs">Create Account</span>
                <span className="block text-slate-400 text-[9px] mt-1">Employee or HR access</span>
              </span>
            </button>

            <button
              type="button"
              onClick={openUserAccountsModal}
              className="rounded-2xl border border-slate-200 bg-white p-3 flex items-center gap-3 text-left hover:bg-blue-50/60 hover:border-blue-100 hover:-translate-y-0.5 transition min-h-[72px]"
            >
              <span className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-lg flex-shrink-0">👥</span>
              <span className="min-w-0">
                <span className="block font-extrabold text-slate-900 text-xs">User Accounts</span>
                <span className="block text-slate-400 text-[9px] mt-1">Roles, profile details & access</span>
              </span>
            </button>

            <button
              type="button"
              onClick={openAttendanceRecordsModal}
              className="rounded-2xl border border-slate-200 bg-white p-3 flex items-center gap-3 text-left hover:bg-emerald-50/60 hover:border-emerald-100 hover:-translate-y-0.5 transition min-h-[72px]"
            >
              <span className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-lg flex-shrink-0">📋</span>
              <span className="min-w-0">
                <span className="block font-extrabold text-slate-900 text-xs">Attendance Records</span>
                <span className="block text-slate-400 text-[9px] mt-1">Review & correct employee logs</span>
              </span>
            </button>

            <button
              type="button"
              onClick={openAppSettingsModal}
              className="rounded-2xl border border-slate-200 bg-white p-3 flex items-center gap-3 text-left hover:bg-orange-50/60 hover:border-orange-100 hover:-translate-y-0.5 transition min-h-[72px]"
            >
              <span className="w-10 h-10 rounded-2xl bg-orange-50 flex items-center justify-center text-lg flex-shrink-0">⚙️</span>
              <span className="min-w-0">
                <span className="block font-extrabold text-slate-900 text-xs">Shared App Settings</span>
                <span className="block text-slate-400 text-[9px] mt-1">Rules used by HR & Employee</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setResetEmail(''); setResetPasswordMsg(null); setResetPasswordModalOpen(true); }}
              className="rounded-2xl border border-slate-200 bg-white p-3 flex items-center gap-3 text-left hover:bg-amber-50/60 hover:border-amber-100 hover:-translate-y-0.5 transition min-h-[72px]"
            >
              <span className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center text-lg flex-shrink-0">🔑</span>
              <span className="min-w-0">
                <span className="block font-extrabold text-slate-900 text-xs">Password Reset</span>
                <span className="block text-slate-400 text-[9px] mt-1">Secure account recovery</span>
              </span>
            </button>

            <button
              type="button"
              onClick={openAuditLogModal}
              className="rounded-2xl border border-slate-200 bg-white p-3 flex items-center gap-3 text-left hover:bg-indigo-50/60 hover:border-indigo-100 hover:-translate-y-0.5 transition min-h-[72px]"
            >
              <span className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-lg flex-shrink-0">📜</span>
              <span className="min-w-0">
                <span className="block font-extrabold text-slate-900 text-xs">Audit Log</span>
                <span className="block text-slate-400 text-[9px] mt-1">Administrative activity trail</span>
              </span>
            </button>
          </div>
        </section>

        {/* SYSTEM OPERATIONS — lower visual priority */}
        <section className="space-y-2.5">
          <div>
            <p className="text-[9px] uppercase tracking-[0.18em] font-extrabold text-slate-400">
              System operations
            </p>
            <h2 className="text-sm font-extrabold text-slate-900 mt-0.5">
              Maintenance & resilience
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={openHealthModal}
              className="card-style !p-3 flex items-center gap-3 text-left hover:bg-emerald-50/50 hover:-translate-y-0.5 transition"
            >
              <span className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-base flex-shrink-0">💚</span>
              <span className="min-w-0">
                <span className="block font-extrabold text-slate-900 text-[11px]">System Health</span>
                <span className="block text-slate-400 text-[9px] mt-0.5">Check backup, archive & email</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setBackupModalOpen(true)}
              className="card-style !p-3 flex items-center gap-3 text-left hover:bg-slate-50 hover:-translate-y-0.5 transition"
            >
              <span className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-base flex-shrink-0">🗄️</span>
              <span className="min-w-0">
                <span className="block font-extrabold text-slate-900 text-[11px]">Database Backup</span>
                <span className="block text-slate-400 text-[9px] mt-0.5">Create an off-site copy</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setArchivalModalOpen(true)}
              className="card-style !p-3 flex items-center gap-3 text-left hover:bg-slate-50 hover:-translate-y-0.5 transition"
            >
              <span className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-base flex-shrink-0">🗃️</span>
              <span className="min-w-0">
                <span className="block font-extrabold text-slate-900 text-[11px]">Data Archival</span>
                <span className="block text-slate-400 text-[9px] mt-0.5">Move records older than one year</span>
              </span>
            </button>
          </div>
        </section>
      </div>

      <AccountFormModal context={{ Spinner, confirmPassword, createAccountModalOpen, deactivating, designation, editingId, email, emailChecking, emailConflict, employeeId, employeeIdConflict, employees, fullName, fullNameConflict, handleSave, loading, password, passwordMismatch, resetForm, role, setConfirmPassword, setDesignation, setEmail, setEmployeeId, setFullName, setPassword, setRole, toggleAccountActive }} />

      <ResetPasswordModal context={{ Spinner, handleResetPassword, resetEmail, resetLoading, resetPasswordModalOpen, resetPasswordMsg, setResetEmail, setResetPasswordModalOpen, setResetPasswordMsg }} />

      <UserAccountsModal context={{ PAGE_SIZE, employees, employeesLoading, employeesPage, employeesTotalPages, initials, paginatedEmployees, roleTagClass, setEmployeesPage, setUserAccountsModalOpen, startEdit, totalAccounts, userAccountsModalOpen }} />

      <AttendanceRecordsModal context={{ PAGE_SIZE, attendanceDateFilter, attendanceLoading, attendancePage, attendanceRecordsModalOpen, attendanceSearch, attendanceTotalPages, filteredAttendanceLogs, handleAttendanceDateChange, handleAttendanceSearchChange, paginatedAttendanceLogs, setAttendancePage, setAttendanceRecordsModalOpen, startEditLog, statusTagClass, todayManila }} />

      <AppSettingsModal context={{ Spinner, appSettings, appSettingsLoading, appSettingsModalOpen, appSettingsMsg, appSettingsSaving, saveAppSettings, setAppSettings, setAppSettingsModalOpen }} />

      {/* SYSTEM HEALTH MODAL */}
      <SystemHealthModal open={healthModalOpen} onClose={() => setHealthModalOpen(false)} loading={healthStatusLoading} lastBackupAt={lastBackupAt} lastArchiveAt={lastArchiveAt} formatTimestamp={formatHealthTimestamp} adminEmail={currentAdminEmail} result={testEmailResult} sending={testEmailLoading} onSendTestEmail={sendTestEmail} />

      {/* AUDIT LOG MODAL */}
      <AuditLogModal open={auditLogModalOpen} onClose={() => setAuditLogModalOpen(false)} loading={auditLogsLoading} logs={paginatedAuditLogs} allCount={auditLogs.length} pageSize={PAGE_SIZE} page={auditLogPage} totalPages={auditLogTotalPages} onPageChange={setAuditLogPage} actionMeta={auditActionMeta} />

      <DataArchiveModal context={{ Spinner, archivalModalOpen, archiveLoading, archiveResult, handleArchiveOldRecords, setArchivalModalOpen }} />

      <DatabaseBackupModal context={{ Spinner, backupLoading, backupModalOpen, backupResult, handleBackupDatabase, setBackupModalOpen }} />

      <ArchivePasswordModal context={{ Spinner, archivePasswordError, archivePasswordInput, archivePasswordModalOpen, archivePasswordVerifying, confirmArchiveWithPassword, setArchivePasswordError, setArchivePasswordInput, setArchivePasswordModalOpen }} />

      <BackupPasswordModal context={{ Spinner, backupPasswordError, backupPasswordInput, backupPasswordModalOpen, backupPasswordVerifying, confirmBackupWithPassword, setBackupPasswordError, setBackupPasswordInput, setBackupPasswordModalOpen }} />

      <EditAttendanceModal context={{ Spinner, editingLog, logSaving, saveEditLog, setEditingLog }} />


    </main>
  );
}
