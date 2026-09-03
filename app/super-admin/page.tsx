'use client';
import ArchivePasswordModal from '@/components/super-admin/modals/ArchivePasswordModal';
import BackupPasswordModal from '@/components/super-admin/modals/BackupPasswordModal';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, supabaseAuthActions } from '@/lib/supabase';
import dynamic from 'next/dynamic';
import { Activity, AlertTriangle, ChevronRight, Clock3, Moon, ShieldCheck, Sun, UserRound, Users } from 'lucide-react';
import SuperAdminQuickActions from '@/components/super-admin/SuperAdminQuickActions';
import SuperAdminMobileBottomNav from '@/components/super-admin/SuperAdminMobileBottomNav';
import SuperAdminMobileToolsSheet from '@/components/super-admin/SuperAdminMobileToolsSheet';
import SuperAdminDesktopSidebar from '@/components/super-admin/SuperAdminDesktopSidebar';
import { APP_SETTING_DEFINITIONS, DEFAULT_APP_SETTINGS, normalizeAppSettings, type AppSettingsValues } from '@/lib/app-settings';
import VerificationDialog from '@/components/shared/VerificationDialog';

const AccountFormModal = dynamic(() => import('@/components/super-admin/modals/AccountFormModal'));
const ResetPasswordModal = dynamic(() => import('@/components/super-admin/modals/ResetPasswordModal'));
const UserAccountsModal = dynamic(() => import('@/components/super-admin/modals/UserAccountsModal'));
const AttendanceRecordsModal = dynamic(() => import('@/components/super-admin/modals/AttendanceRecordsModal'));
const AppSettingsModal = dynamic(() => import('@/components/super-admin/modals/AppSettingsModal'));
const DataArchiveModal = dynamic(() => import('@/components/super-admin/modals/DataArchiveModal'));
const DatabaseBackupModal = dynamic(() => import('@/components/super-admin/modals/DatabaseBackupModal'));
const EditAttendanceModal = dynamic(() => import('@/components/super-admin/modals/EditAttendanceModal'));
const SystemHealthModal = dynamic(() => import('@/components/super-admin/modals/SystemHealthModal'));
const AuditLogModal = dynamic(() => import('@/components/super-admin/modals/AuditLogModal'));
const AdminAttentionModal = dynamic(() => import('@/components/super-admin/modals/AdminAttentionModal'));

const PAGE_SIZE = 5;

export default function SuperAdminDashboard() {
  const [darkMode, setDarkMode] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
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
  const [attentionModalOpen, setAttentionModalOpen] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettingsValues>({ ...DEFAULT_APP_SETTINGS });
  const [savedAppSettings, setSavedAppSettings] = useState<AppSettingsValues | null>(null);
  const [appSettingsLoading, setAppSettingsLoading] = useState(false);
  const [appSettingsSaving, setAppSettingsSaving] = useState(false);
  const [appSettingsMsg, setAppSettingsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [lastArchiveAt, setLastArchiveAt] = useState<string | null>(null);
  const [healthStatusLoading, setHealthStatusLoading] = useState(false);
  const [currentAdminEmail, setCurrentAdminEmail] = useState<string | null>(null);
  const directoryPageSize = Number(appSettings.directory_page_size || PAGE_SIZE);
  const attendancePageSize = Number(appSettings.attendance_page_size || PAGE_SIZE);

  const applyTheme = useCallback((nextDark: boolean) => {
    document.documentElement.classList.toggle('dark', nextDark);
    document.documentElement.style.colorScheme = nextDark ? 'dark' : 'light';
    try { localStorage.setItem('theme', nextDark ? 'dark' : 'light'); } catch { /* unavailable storage */ }
    setDarkMode(nextDark);
  }, []);

  const toggleTheme = () => applyTheme(!darkMode);
  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.replace('/');
  };

  useEffect(() => {
    queueMicrotask(() => setDarkMode(document.documentElement.classList.contains('dark')));
    const syncTheme = (event: StorageEvent) => {
      if (event.key === 'theme' && (event.newValue === 'dark' || event.newValue === 'light')) applyTheme(event.newValue === 'dark');
    };
    window.addEventListener('storage', syncTheme);
    return () => window.removeEventListener('storage', syncTheme);
  }, [applyTheme]);

  // Audit Log -- read-only trail of admin/system actions. Entries are
  // written via the log_audit_event() RPC (see migration), which stamps
  // actor_id from the caller's own session -- never trusted from client
  // input -- so this list can't be spoofed by calling code.
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  const [auditLogsFetched, setAuditLogsFetched] = useState(false);
  const [auditLogPage, setAuditLogPage] = useState(1);
  const [recentAuditLogs, setRecentAuditLogs] = useState<any[]>([]);

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
  const fetchHealthStatus = async () => {
    setHealthStatusLoading(true);
    const [{ data: backupRow }, { data: archiveRow }] = await Promise.all([
      supabase.from('audit_logs').select('created_at').eq('action', 'database_backup').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('audit_logs').select('created_at').eq('action', 'data_archived').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    setLastBackupAt(backupRow?.created_at ?? null);
    setLastArchiveAt(archiveRow?.created_at ?? null);
    setHealthStatusLoading(false);
  };

  const openHealthModal = async () => {
    setTestEmailResult(null);
    setHealthModalOpen(true);
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentAdminEmail(user?.email ?? null);
    await fetchHealthStatus();
  };

  useEffect(() => {
    fetchHealthStatus();
    supabase.from('audit_logs').select('id, created_at, action, summary').order('created_at', { ascending: false }).limit(3).then(({ data }) => setRecentAuditLogs(data || []));
  }, []);

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
      .in('key', APP_SETTING_DEFINITIONS.map((setting) => setting.key));
    if (error) {
      console.error('Error fetching app settings:', error);
      setAppSettingsMsg({ type: 'error', text: error.message });
      setAppSettingsLoading(false);
      return;
    }
    const loadedSettings = normalizeAppSettings(data);
    setAppSettings(loadedSettings);
    setSavedAppSettings(loadedSettings);
    setAppSettingsLoading(false);
  };

  const saveAppSettings = async () => {
    setAppSettingsSaving(true);
    setAppSettingsMsg(null);
    try {
      const seasonalStart = String(appSettings.seasonal_theme_start_date || '');
      const seasonalEnd = String(appSettings.seasonal_theme_end_date || '');
      if (seasonalStart && seasonalEnd && seasonalStart > seasonalEnd) {
        setAppSettingsMsg({ type: 'error', text: 'Seasonal Theme end date must be on or after its start date.' });
        return false;
      }
      const changedDefinitions = APP_SETTING_DEFINITIONS.filter((setting) => savedAppSettings?.[setting.key] !== appSettings[setting.key]);
      if (!changedDefinitions.length) return true;
      const { data: { user } } = await supabase.auth.getUser();
      const rows = APP_SETTING_DEFINITIONS.map((setting) => ({ key: setting.key, value: appSettings[setting.key] }));
      const timestamp = new Date().toISOString();
      const { error } = await supabase.from('app_settings').upsert(
        rows.map((row) => ({ ...row, updated_at: timestamp, updated_by: user?.id ?? null })),
        { onConflict: 'key' }
      );
      if (error) throw error;
      const labels = Object.fromEntries(APP_SETTING_DEFINITIONS.map((setting) => [setting.key, setting.label])) as Record<string, string>;
      const changes = (Object.keys(appSettings) as Array<keyof typeof appSettings>)
        .filter((key) => savedAppSettings?.[key] !== appSettings[key])
        .map((key) => `${labels[key]} ${savedAppSettings?.[key] ?? 'unset'} → ${appSettings[key]}`);
      setSavedAppSettings({ ...appSettings });
      setAppSettingsMsg({ type: 'success', text: 'Settings saved. ACTIVE controls apply immediately; controls still marked FUTURE remain stored until their backend workflow is available.' });
      const seasonalChanges = changes.filter((change) => change.toLowerCase().includes('seasonal') || change.startsWith('Theme ') || change.startsWith('Apply To') || change.startsWith('Start Date') || change.startsWith('End Date') || change.startsWith('Holiday Banner'));
      await logAuditEvent(
        seasonalChanges.length ? 'seasonal_theme_updated' : 'app_settings_updated',
        'system',
        null,
        `${seasonalChanges.length ? 'Seasonal Theme updated' : 'Updated App Settings'}: ${changes.join('; ') || 'no value changes'}`
      );
      return true;
    } catch (err: any) {
      console.error('Error saving app settings:', err);
      setAppSettingsMsg({ type: 'error', text: err?.message ?? 'Failed to save settings.' });
      return false;
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
    supabase.auth.getUser().then(({ data }) => setCurrentAdminEmail(data.user?.email ?? null));
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

  const attendanceTotalPages = Math.max(1, Math.ceil(filteredAttendanceLogs.length / attendancePageSize));
  const paginatedAttendanceLogs = filteredAttendanceLogs.slice(
    (attendancePage - 1) * attendancePageSize,
    attendancePage * attendancePageSize
  );

  const employeesTotalPages = Math.max(1, Math.ceil(employees.length / directoryPageSize));
  const paginatedEmployees = employees.slice(
    (employeesPage - 1) * directoryPageSize,
    employeesPage * directoryPageSize
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

  const openResetPasswordModal = () => {
    setResetEmail('');
    setResetPasswordMsg(null);
    setResetPasswordModalOpen(true);
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
  const [accountVerification, setAccountVerification] = useState<{ deactivate: boolean; employeeId: string; name: string } | null>(null);

  const toggleAccountActive = async (deactivate: boolean) => {
    if (!editingId) return;

    const editingEmployee = employees.find((e) => e.id === editingId);
    setAccountVerification({ deactivate, employeeId: editingId, name: editingEmployee?.full_name ?? 'this account' });
  };

  const confirmToggleAccountActive = async () => {
    if (!accountVerification) return;
    const { deactivate, employeeId: targetId, name } = accountVerification;

    setDeactivating(true);
    setMessage(null);
    try {
      const res = await fetch('/api/deactivate-employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: targetId, deactivate }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to update account status.');

      setMessage({ type: 'success', text: result.message });
      await logAuditEvent(
        deactivate ? 'account_deactivated' : 'account_reactivated',
        'profile',
        targetId,
        `${deactivate ? 'Deactivated' : 'Reactivated'} account for ${name}`
      );
      setAccountVerification(null);
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
  const attentionItems: Array<{ id: string; title: string; description: string; actionLabel: string; action: () => void }> = [];
  if (incompleteProfilesCount > 0) attentionItems.push({ id: 'profiles', title: 'Incomplete Profiles', description: `${incompleteProfilesCount} employee profile${incompleteProfilesCount === 1 ? ' needs' : 's need'} required information.`, actionLabel: 'Review accounts', action: openUserAccountsModal });
  if (!healthStatusLoading && !lastBackupAt) attentionItems.push({ id: 'backup', title: 'No Backup Recorded', description: 'No successful database backup appears in the administrative audit trail.', actionLabel: 'Open backup', action: () => setBackupModalOpen(true) });
  if (!healthStatusLoading && !lastArchiveAt) attentionItems.push({ id: 'archive', title: 'No Archive Recorded', description: 'No completed data archival appears in the administrative audit trail.', actionLabel: 'Open archival', action: () => setArchivalModalOpen(true) });

  return (
    <main id="super-admin-dashboard-top" className="min-h-screen bg-slate-50 p-3 pb-24 transition-colors dark:bg-[#111512] sm:p-4 md:p-6 lg:pb-6 lg:pl-[300px]">
      <SuperAdminDesktopSidebar darkMode={darkMode} email={currentAdminEmail} onToggleTheme={toggleTheme} onLogout={handleLogout} onHome={() => document.getElementById('super-admin-dashboard-top')?.scrollIntoView({ behavior: 'smooth' })} onCreate={openCreateAccountModal} onAccounts={openUserAccountsModal} onAttendance={openAttendanceRecordsModal} onSettings={openAppSettingsModal} onReset={openResetPasswordModal} onAudit={openAuditLogModal} onHealth={openHealthModal} onBackup={() => setBackupModalOpen(true)} onArchive={() => setArchivalModalOpen(true)} />
      <div className="mx-auto max-w-7xl space-y-4 md:space-y-5">
        {/* SUPER ADMIN HEADER — aligned with HR / Employee hierarchy */}
        <header className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.07)] dark:border-slate-700 dark:bg-[#202521] sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-green-50 text-green-700 shadow-sm dark:bg-green-950/50 dark:text-green-300">
                <ShieldCheck size={20} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-base leading-tight text-slate-950 dark:text-white sm:text-lg md:text-xl">HAMDAN ENGINEERING</h1>
                </div>
                <p className="mt-1 text-[11px] font-bold text-green-700 dark:text-green-400">
                  Super Administrator
                </p>
                <p className="mt-0.5 text-[10px] text-slate-500 dark:!text-[#aab8ad]">System & Access Management</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:flex-shrink-0">
              <button type="button" onClick={toggleTheme} className="grid h-11 w-11 place-items-center rounded-full border border-slate-200 text-slate-600 dark:border-slate-700 dark:!text-white" aria-label={darkMode ? 'Use light mode' : 'Use dark mode'}>
                {darkMode ? <Sun size={19} /> : <Moon size={19} />}
              </button>
              <button
                type="button"
                onClick={openHealthModal}
                className="relative grid h-11 w-11 place-items-center rounded-full border border-slate-200 text-slate-600 dark:border-slate-700 dark:!text-white"
                aria-label="Open system health"
              >
                <Activity size={19} />
                {attentionItems.length > 0 && <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-orange-500 dark:border-[#202521]" />}
              </button>
              <button
                onClick={() => setMobileToolsOpen(true)}
                className="grid h-11 w-11 place-items-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:!text-white lg:hidden"
                type="button"
                aria-label="Open Super Admin menu"
              >
                <UserRound size={19} />
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

        <div className="hidden lg:block"><h2 className="text-xl font-black text-slate-950 dark:text-white">Dashboard</h2><p className="mt-1 text-xs text-slate-500 dark:!text-[#aab8ad]">System overview and administrative control center</p></div>

        {/* ADMIN OVERVIEW */}
        <section className="space-y-2.5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-600 dark:!text-[#c3d0c5] sm:text-sm">Account Overview</h2>
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
              className="card-style !p-3.5 sm:!p-4 flex min-h-24 items-center gap-3 text-left hover:-translate-y-0.5 transition dark:bg-[#292f2b]"
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300"><Users size={17}/></span>
              <span className="min-w-0">
                <span className="stat-number block text-xl leading-none text-green-700 dark:text-green-300 sm:text-2xl">{totalAccounts}</span>
                <span className="mt-1 block text-[10px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-300 sm:text-[11px]">Total Accounts</span>
              </span>
            </button>

            <button
              type="button"
              onClick={openUserAccountsModal}
              className="card-style !p-3.5 sm:!p-4 flex min-h-24 items-center gap-3 text-left hover:-translate-y-0.5 transition dark:bg-[#292f2b]"
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300"><UserRound size={17}/></span>
              <span className="min-w-0">
                <span className="stat-number text-xl sm:text-2xl text-sky-600 block leading-none">{totalEmployeesCount}</span>
                <span className="mt-1 block text-[10px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-300 sm:text-[11px]">Employees</span>
              </span>
            </button>

            <button
              type="button"
              onClick={openUserAccountsModal}
              className="card-style !p-3.5 sm:!p-4 flex min-h-24 items-center gap-3 text-left hover:-translate-y-0.5 transition dark:bg-[#292f2b]"
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"><ShieldCheck size={17}/></span>
              <span className="min-w-0">
                <span className="stat-number block text-xl leading-none text-blue-700 dark:text-blue-300 sm:text-2xl">{totalAdmins}</span>
                <span className="mt-1 block text-[10px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-300 sm:text-[11px]">HR Admins</span>
              </span>
            </button>

            <button
              type="button"
              onClick={openUserAccountsModal}
              className="card-style !p-3.5 sm:!p-4 flex min-h-24 items-center gap-3 text-left hover:-translate-y-0.5 transition dark:bg-[#292f2b]"
            >
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${
                incompleteProfilesCount ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
              }`}>
                {incompleteProfilesCount ? <AlertTriangle size={17}/> : <ShieldCheck size={17}/>}
              </span>
              <span className="min-w-0">
                <span className={`stat-number text-xl sm:text-2xl block leading-none ${
                  incompleteProfilesCount ? 'text-amber-600' : 'text-emerald-600'
                }`}>{incompleteProfilesCount}</span>
                <span className="mt-1 block text-[10px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-300 sm:text-[11px]">Incomplete Profiles</span>
              </span>
            </button>
          </div>
        </section>

        {attentionItems.length > 0 ? <button type="button" onClick={() => setAttentionModalOpen(true)} className="flex w-full items-center gap-3 rounded-[22px] border border-orange-200 bg-white p-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.05)] dark:border-orange-900 dark:bg-[#202521]"><span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300"><AlertTriangle size={18}/></span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="text-sm font-bold text-slate-950 dark:text-white">Needs Attention</span><span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-black text-orange-800 dark:bg-orange-950 dark:text-orange-200">{attentionItems.length}</span></span><span className="mt-1 block truncate text-xs font-semibold text-slate-700 dark:!text-[#e3ece4]">{attentionItems[0].title}</span><span className="mt-0.5 block truncate text-[10px] text-slate-500 dark:!text-[#aab8ad]">{attentionItems[0].description}</span>{attentionItems.length > 1 ? <span className="mt-1 block text-[10px] font-bold text-orange-700 dark:text-orange-300">+{attentionItems.length - 1} more</span> : null}</span><ChevronRight size={18} className="flex-none text-slate-400"/></button> : null}

        <SuperAdminQuickActions
          onCreateAccount={openCreateAccountModal}
          onAccounts={openUserAccountsModal}
          onAttendance={openAttendanceRecordsModal}
          onSettings={openAppSettingsModal}
          onResetPassword={openResetPasswordModal}
          onAuditLog={openAuditLogModal}
          onSystemHealth={openHealthModal}
          onBackup={() => setBackupModalOpen(true)}
        />
        <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <button type="button" onClick={openHealthModal} className="rounded-[24px] border border-slate-200 bg-white p-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-[#202521]"><div className="flex items-center justify-between gap-3"><div><div className="flex items-center gap-2"><p className="text-base font-semibold text-slate-950 dark:text-white">System Health</p><span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${healthStatusLoading ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:!text-white' : lastBackupAt && lastArchiveAt ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:!text-white' : 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200'}`}>{healthStatusLoading ? 'CHECKING' : lastBackupAt && lastArchiveAt ? 'HEALTHY' : 'ATTENTION'}</span></div><p className="mt-0.5 text-xs text-slate-500 dark:!text-[#aab8ad]">Backup, archive, and email delivery</p></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300"><Activity size={18}/></span></div><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800"><p className="text-[10px] font-bold text-slate-500 dark:!text-[#aab8ad]">Last backup</p><p className="mt-1 text-xs font-bold text-slate-950 dark:text-white">{healthStatusLoading ? 'Checking…' : formatHealthTimestamp(lastBackupAt)}</p></div><div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800"><p className="text-[10px] font-bold text-slate-500 dark:!text-[#aab8ad]">Last archive</p><p className="mt-1 text-xs font-bold text-slate-950 dark:text-white">{healthStatusLoading ? 'Checking…' : formatHealthTimestamp(lastArchiveAt)}</p></div></div></button>
          <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-[#202521]"><div className="flex items-center justify-between gap-3"><div><p className="text-base font-semibold text-slate-950 dark:text-white">Recent Admin Activity</p><p className="mt-0.5 text-xs text-slate-500 dark:!text-[#aab8ad]">Latest security and configuration events</p></div><Clock3 size={18} className="text-green-700 dark:text-green-300"/></div><div className="mt-3 space-y-1.5">{recentAuditLogs.length ? recentAuditLogs.map((log) => <div key={log.id} className="flex items-start gap-2 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800"><span className="mt-1 h-2 w-2 flex-none rounded-full bg-green-500"/><span className="min-w-0"><span className="block truncate text-[11px] font-bold text-slate-900 dark:text-white">{auditActionMeta(log.action).label}</span><span className="block truncate text-[9px] text-slate-500 dark:!text-[#aab8ad]">{new Date(log.created_at).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></span></div>) : <p className="rounded-xl bg-slate-50 p-3 text-[10px] text-slate-500 dark:bg-slate-800 dark:!text-[#aab8ad]">No recent administrative activity.</p>}</div><button type="button" onClick={openAuditLogModal} className="mt-2 min-h-11 w-full text-xs font-bold text-green-700 dark:text-green-300">View Audit Log →</button></section>
        </div>
      </div>

      <SuperAdminMobileBottomNav onHome={() => document.getElementById('super-admin-dashboard-top')?.scrollIntoView({ behavior: 'smooth' })} onAccounts={openUserAccountsModal} onSettings={openAppSettingsModal} onHealth={openHealthModal} onMore={() => setMobileToolsOpen(true)} />
      <SuperAdminMobileToolsSheet open={mobileToolsOpen} darkMode={darkMode} email={currentAdminEmail} onClose={() => setMobileToolsOpen(false)} onToggleTheme={toggleTheme} onLogout={handleLogout} onCreate={openCreateAccountModal} onAccounts={openUserAccountsModal} onAttendance={openAttendanceRecordsModal} onSettings={openAppSettingsModal} onReset={openResetPasswordModal} onAudit={openAuditLogModal} onHealth={openHealthModal} onBackup={() => setBackupModalOpen(true)} onArchive={() => setArchivalModalOpen(true)} />

      {createAccountModalOpen && <AccountFormModal open={createAccountModalOpen} onClose={() => setCreateAccountModalOpen(false)} confirmPassword={confirmPassword} deactivating={deactivating} designation={designation} editingId={editingId} email={email} emailChecking={emailChecking} emailConflict={emailConflict} employeeId={employeeId} employeeIdConflict={employeeIdConflict} employees={employees} fullName={fullName} fullNameConflict={fullNameConflict} handleSave={handleSave} loading={loading} password={password} passwordMismatch={passwordMismatch} resetForm={resetForm} role={role} setConfirmPassword={setConfirmPassword} setDesignation={setDesignation} setEmail={setEmail} setEmployeeId={setEmployeeId} setFullName={setFullName} setPassword={setPassword} setRole={setRole} toggleAccountActive={toggleAccountActive} />}

      {resetPasswordModalOpen && <ResetPasswordModal open={resetPasswordModalOpen} onClose={() => setResetPasswordModalOpen(false)} handleResetPassword={handleResetPassword} resetEmail={resetEmail} resetLoading={resetLoading} resetPasswordMsg={resetPasswordMsg} setResetEmail={setResetEmail} setResetPasswordMsg={setResetPasswordMsg} />}

      {userAccountsModalOpen && <UserAccountsModal open={userAccountsModalOpen} onClose={() => setUserAccountsModalOpen(false)} pageSize={directoryPageSize} employees={employees} employeesLoading={employeesLoading} employeesPage={employeesPage} employeesTotalPages={employeesTotalPages} initials={initials} paginatedEmployees={paginatedEmployees} roleTagClass={roleTagClass} setEmployeesPage={setEmployeesPage} startEdit={startEdit} totalAccounts={totalAccounts} />}

      {attendanceRecordsModalOpen && <AttendanceRecordsModal open={attendanceRecordsModalOpen} onClose={() => setAttendanceRecordsModalOpen(false)} pageSize={attendancePageSize} attendanceDateFilter={attendanceDateFilter} attendanceLoading={attendanceLoading} attendancePage={attendancePage} attendanceSearch={attendanceSearch} attendanceTotalPages={attendanceTotalPages} filteredAttendanceLogs={filteredAttendanceLogs} handleAttendanceDateChange={handleAttendanceDateChange} handleAttendanceSearchChange={handleAttendanceSearchChange} paginatedAttendanceLogs={paginatedAttendanceLogs} setAttendancePage={setAttendancePage} startEditLog={startEditLog} statusTagClass={statusTagClass} todayManila={todayManila} />}

      {appSettingsModalOpen && <AppSettingsModal open={appSettingsModalOpen} onClose={() => setAppSettingsModalOpen(false)} appSettings={appSettings} savedAppSettings={savedAppSettings} appSettingsLoading={appSettingsLoading} appSettingsMsg={appSettingsMsg} appSettingsSaving={appSettingsSaving} saveAppSettings={saveAppSettings} setAppSettings={setAppSettings} />}

      {attentionModalOpen && <AdminAttentionModal open={attentionModalOpen} onClose={() => setAttentionModalOpen(false)} items={attentionItems} />}

      {/* SYSTEM HEALTH MODAL */}
      {healthModalOpen && <SystemHealthModal open={healthModalOpen} onClose={() => setHealthModalOpen(false)} loading={healthStatusLoading} lastBackupAt={lastBackupAt} lastArchiveAt={lastArchiveAt} formatTimestamp={formatHealthTimestamp} adminEmail={currentAdminEmail} result={testEmailResult} sending={testEmailLoading} onSendTestEmail={sendTestEmail} />}

      {/* AUDIT LOG MODAL */}
      {auditLogModalOpen && <AuditLogModal open={auditLogModalOpen} onClose={() => setAuditLogModalOpen(false)} loading={auditLogsLoading} logs={paginatedAuditLogs} allCount={auditLogs.length} pageSize={PAGE_SIZE} page={auditLogPage} totalPages={auditLogTotalPages} onPageChange={setAuditLogPage} actionMeta={auditActionMeta} />}

      {archivalModalOpen && <DataArchiveModal open={archivalModalOpen} onClose={() => setArchivalModalOpen(false)} archiveLoading={archiveLoading} archiveResult={archiveResult} handleArchiveOldRecords={handleArchiveOldRecords} />}

      {backupModalOpen && <DatabaseBackupModal open={backupModalOpen} onClose={() => setBackupModalOpen(false)} backupLoading={backupLoading} backupResult={backupResult} handleBackupDatabase={handleBackupDatabase} />}

      <ArchivePasswordModal open={archivePasswordModalOpen} onClose={() => setArchivePasswordModalOpen(false)} archivePasswordError={archivePasswordError} archivePasswordInput={archivePasswordInput} archivePasswordVerifying={archivePasswordVerifying} confirmArchiveWithPassword={confirmArchiveWithPassword} setArchivePasswordError={setArchivePasswordError} setArchivePasswordInput={setArchivePasswordInput} />

      <BackupPasswordModal open={backupPasswordModalOpen} onClose={() => setBackupPasswordModalOpen(false)} backupPasswordError={backupPasswordError} backupPasswordInput={backupPasswordInput} backupPasswordVerifying={backupPasswordVerifying} confirmBackupWithPassword={confirmBackupWithPassword} setBackupPasswordError={setBackupPasswordError} setBackupPasswordInput={setBackupPasswordInput} />

      {editingLog && <EditAttendanceModal editingLog={editingLog} logSaving={logSaving} saveEditLog={saveEditLog} setEditingLog={setEditingLog} />}

      <VerificationDialog open={Boolean(accountVerification)} title={accountVerification?.deactivate ? 'Deactivate account?' : 'Reactivate account?'} description={accountVerification?.deactivate ? 'The employee will immediately lose login access, while historical records remain intact.' : 'The employee will regain access to the application.'} confirmLabel={accountVerification?.deactivate ? 'Deactivate account' : 'Reactivate account'} tone={accountVerification?.deactivate ? 'danger' : 'primary'} details={accountVerification ? [accountVerification.name, accountVerification.deactivate ? 'Attendance, leave, and payslip history will not be deleted.' : 'Existing account data and permissions will be restored.'] : []} busy={deactivating} onCancel={() => { if (!deactivating) setAccountVerification(null); }} onConfirm={confirmToggleAccountActive} />


    </main>
  );
}
