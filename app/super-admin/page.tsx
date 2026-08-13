'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase, supabaseAuthActions } from '@/lib/supabase';
import Spinner from '@/components/Spinner';

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
    setMessage(null);

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

      setMessage({
        type: 'success',
        text: 'Check your email for reset password instructions.',
      });

      setResetEmail('');
      setResetPasswordModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err?.message ?? 'Reset password failed' });
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

  return (
    <main className="min-h-screen p-3 sm:p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-3 sm:space-y-4 md:space-y-5">
        {/* BRANDING HEADER */}
        <header className="branding-box flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 !p-3 sm:!p-4">
          <div>
            <h1 className="text-base sm:text-lg md:text-2xl leading-tight">HAMDAN ENGINEERING</h1>
            <p className="text-slate-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mt-0.5">
              Super Admin Portal
            </p>
          </div>

          <button
            onClick={() =>
              supabase.auth.signOut().then(() => (window.location.href = '/'))
            }
            className="text-slate-500 font-medium text-xs hover:text-red-600 transition whitespace-nowrap"
            type="button"
          >
            Log Out
          </button>
        </header>

        {message && (
          <div
            className={`p-4 rounded-2xl text-sm font-bold ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* QUICK STATS */}
        <div className="grid grid-cols-3 gap-3 md:gap-4">
          <div className="card-dark flex flex-col items-center justify-center !p-4 md:!p-6 text-center">
            <p className="stat-number text-2xl md:text-3xl text-white">{totalAccounts}</p>
            <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mt-1">Total Accounts</p>
          </div>
          <div className="card-style flex flex-col items-center justify-center !p-4 md:!p-6 text-center">
            <p className="stat-number text-2xl md:text-3xl text-sky-600">{totalEmployeesCount}</p>
            <p className="label-branded mt-1">Employees</p>
          </div>
          <div className="card-style flex flex-col items-center justify-center !p-4 md:!p-6 text-center">
            <p className="stat-number text-2xl md:text-3xl text-purple-600">{totalAdmins}</p>
            <p className="label-branded mt-1">HR Admins</p>
          </div>
        </div>

        {/* ACTION GRID -- every management area is a compact icon button
            that opens its own modal, instead of an always-expanded or
            accordion-style card. Keeps the dashboard short and tidy. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={openCreateAccountModal}
            className="card-style !p-4 flex flex-col items-center justify-center gap-2 text-center hover:bg-slate-50 transition"
          >
            <span className="w-10 h-10 rounded-2xl bg-sky-50 flex items-center justify-center text-lg flex-shrink-0">➕</span>
            <span className="font-bold text-slate-900 text-xs">Create New Account</span>
          </button>

          <button
            type="button"
            onClick={() => { setResetEmail(''); setMessage(null); setResetPasswordModalOpen(true); }}
            className="card-style !p-4 flex flex-col items-center justify-center gap-2 text-center hover:bg-slate-50 transition"
          >
            <span className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center text-lg flex-shrink-0">🔑</span>
            <span className="font-bold text-slate-900 text-xs">Reset Password</span>
          </button>

          <button
            type="button"
            onClick={openUserAccountsModal}
            className="card-style !p-4 flex flex-col items-center justify-center gap-2 text-center hover:bg-slate-50 transition"
          >
            <span className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-lg flex-shrink-0">👥</span>
            <span className="font-bold text-slate-900 text-xs">User Accounts</span>
            <span className="text-slate-400 text-[10px] -mt-1">{totalAccounts} total</span>
          </button>

          <button
            type="button"
            onClick={openAttendanceRecordsModal}
            className="card-style !p-4 flex flex-col items-center justify-center gap-2 text-center hover:bg-slate-50 transition"
          >
            <span className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-lg flex-shrink-0">📋</span>
            <span className="font-bold text-slate-900 text-xs">Attendance Records</span>
          </button>

          <button
            type="button"
            onClick={() => setArchivalModalOpen(true)}
            className="card-style !p-4 flex flex-col items-center justify-center gap-2 text-center hover:bg-slate-50 transition"
          >
            <span className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-lg flex-shrink-0">🗃️</span>
            <span className="font-bold text-slate-900 text-xs">Data Archival</span>
          </button>

          <button
            type="button"
            onClick={() => setBackupModalOpen(true)}
            className="card-style !p-4 flex flex-col items-center justify-center gap-2 text-center hover:bg-slate-50 transition"
          >
            <span className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-lg flex-shrink-0">🗄️</span>
            <span className="font-bold text-slate-900 text-xs">Database Backup</span>
          </button>
        </div>
      </div>

      {/* ── CREATE / EDIT ACCOUNT MODAL ── */}
      {createAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm card-style shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="mb-0">{editingId ? 'Edit Account' : 'Create New Account'}</h3>
              <button
                type="button"
                onClick={resetForm}
                className="text-slate-400 hover:text-slate-600 transition"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Full Name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input-field"
                />
                {fullNameConflict && (
                  <p className="text-orange-600 text-xs font-medium mt-1.5 ml-1">
                    ⚠️ Another account already uses this name. Make sure you&apos;re not accidentally editing the wrong employee.
                  </p>
                )}
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Employee ID"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="input-field"
                />
                {employeeIdConflict && (
                  <p className="text-red-600 text-xs font-medium mt-1.5 ml-1">
                    ⚠️ This Employee ID is already used by {employeeIdConflict}. Please use a different one.
                  </p>
                )}
              </div>

              <input
                type="text"
                placeholder="Designation"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="input-field"
              />

              {!editingId && (
                <>
                  <div>
                    <input
                      type="email"
                      placeholder="Email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input-field"
                    />
                    {emailChecking && (
                      <p className="text-slate-400 text-xs font-medium mt-1.5 ml-1">
                        Checking email availability...
                      </p>
                    )}
                    {!emailChecking && emailConflict && (
                      <p className="text-red-600 text-xs font-medium mt-1.5 ml-1">
                        ⚠️ An account with this email already exists.
                      </p>
                    )}
                  </div>
                  <input
                    type="password"
                    placeholder="Password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field"
                  />
                  <div>
                    <input
                      type="password"
                      placeholder="Confirm Password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="input-field"
                    />
                    {passwordMismatch && (
                      <p className="text-red-600 text-xs font-medium mt-1.5 ml-1">
                        ⚠️ Passwords do not match.
                      </p>
                    )}
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('employee')}
                  className={`p-3 rounded-full font-bold text-sm transition ${
                    role === 'employee' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  Employee
                </button>
                <button
                  type="button"
                  onClick={() => setRole('admin')}
                  className={`p-3 rounded-full font-bold text-sm transition ${
                    role === 'admin' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  HR Admin
                </button>
              </div>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="w-full p-3 rounded-full font-bold bg-slate-100 text-slate-600"
                >
                  Cancel Edit
                </button>
              )}

              <button disabled={loading || !!employeeIdConflict || emailConflict || passwordMismatch} className="btn-primary">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner size="sm" />
                    Processing...
                  </span>
                ) : employeeIdConflict
                  ? 'Fix Employee ID Conflict First'
                  : emailConflict
                  ? 'Fix Email Conflict First'
                  : passwordMismatch
                  ? 'Passwords Do Not Match'
                  : editingId
                  ? 'Save Changes'
                  : 'Create Account'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── RESET PASSWORD MODAL ── */}
      {resetPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm card-style shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="mb-0">Reset Password</h3>
              <button
                type="button"
                onClick={() => setResetPasswordModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-3">
              <input
                type="email"
                placeholder="Email to reset"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="input-field"
              />

              <button type="submit" disabled={resetLoading} className="btn-primary">
                {resetLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner size="sm" />
                    Sending...
                  </span>
                ) : 'Send Reset Email'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── USER ACCOUNTS MODAL ── */}
      {userAccountsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm card-style shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <div>
                <h3 className="mb-0">User Accounts</h3>
                <p className="text-slate-400 text-xs mt-1">{totalAccounts} account{totalAccounts === 1 ? '' : 's'}</p>
              </div>
              <button
                type="button"
                onClick={() => setUserAccountsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-2">
              {employeesLoading && employees.length === 0 && (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={`emp-skel-${i}`} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 animate-pulse">
                    <div className="w-9 h-9 rounded-full bg-slate-200 flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-2/3 bg-slate-200 rounded" />
                      <div className="h-3 w-1/3 bg-slate-200 rounded" />
                    </div>
                  </div>
                ))
              )}
              {!employeesLoading && paginatedEmployees.map((emp) => (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => startEdit(emp)}
                  className="w-full flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-slate-100 transition text-left"
                >
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-blue-50 text-blue-600 font-bold text-xs flex items-center justify-center">
                    {initials(emp.full_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900 text-sm truncate">{emp.full_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono font-bold text-slate-500 text-xs">{emp.employee_id || '-'}</span>
                      <span className={roleTagClass(emp.role)}>{emp.role}</span>
                    </div>
                  </div>
                  <span className="text-blue-600 font-bold text-xs flex-shrink-0">Edit</span>
                </button>
              ))}
              {!employeesLoading && employees.length === 0 && (
                <p className="py-8 text-center text-slate-400 text-sm">No accounts found.</p>
              )}
            </div>

            {employees.length > PAGE_SIZE && (
              <div className="flex items-center justify-between pt-4 flex-shrink-0">
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
        </div>
      )}

      {/* ── ATTENDANCE RECORDS MODAL ── */}
      {attendanceRecordsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm card-style shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <div>
                <h3 className="mb-0">Attendance Records</h3>
                <p className="text-slate-400 text-xs mt-1">
                  {attendanceDateFilter === todayManila ? "Today's records" : attendanceDateFilter ? `Records for ${attendanceDateFilter}` : 'All records'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAttendanceRecordsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mb-3 flex-shrink-0">
              <input
                type="text"
                placeholder="Search employee..."
                value={attendanceSearch}
                onChange={(e) => handleAttendanceSearchChange(e.target.value)}
                className="input-field !py-1.5 !text-xs !min-h-0 flex-1 min-w-[140px]"
              />
              <input
                type="date"
                value={attendanceDateFilter}
                onChange={(e) => handleAttendanceDateChange(e.target.value)}
                className="input-field !py-1.5 !text-xs !min-h-0 w-auto"
              />
              <div className="flex gap-3 w-full">
                {attendanceDateFilter !== todayManila && (
                  <button
                    onClick={() => handleAttendanceDateChange(todayManila)}
                    className="text-blue-600 font-bold text-xs whitespace-nowrap"
                  >
                    Today
                  </button>
                )}
                {attendanceDateFilter && (
                  <button
                    onClick={() => handleAttendanceDateChange('')}
                    className="text-slate-400 font-bold text-xs whitespace-nowrap"
                  >
                    View All
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto flex-1 space-y-2">
              {attendanceLoading && (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={`att-skel-${i}`} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 animate-pulse">
                    <div className="flex items-center justify-between gap-2">
                      <div className="h-3.5 w-28 bg-slate-200 rounded" />
                      <div className="h-5 w-14 bg-slate-200 rounded-full" />
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <div className="h-3 w-20 bg-slate-200 rounded" />
                      <div className="h-3 w-24 bg-slate-200 rounded" />
                    </div>
                  </div>
                ))
              )}
              {!attendanceLoading &&
                paginatedAttendanceLogs.map((log) => (
                  <button
                    key={log.id}
                    type="button"
                    onClick={() => startEditLog(log)}
                    className="w-full p-3 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-slate-100 transition text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 text-sm truncate">{log.profiles?.full_name ?? '-'}</span>
                      <span className={statusTagClass(log.status)}>{log.status}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1.5">
                      <span className="text-slate-400 text-xs">
                        {log.log_date
                          ? new Date(log.log_date).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })
                          : 'N/A'}
                      </span>
                      <span className="text-slate-600 text-xs">
                        {log.time_in
                          ? new Date(log.time_in).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' })
                          : 'N/A'}
                        {' – '}
                        {log.time_out
                          ? new Date(log.time_out).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </span>
                    </div>
                  </button>
                ))}
              {!attendanceLoading && filteredAttendanceLogs.length === 0 && (
                <p className="py-8 text-center text-slate-400 text-sm">No attendance records found.</p>
              )}
            </div>

            {filteredAttendanceLogs.length > PAGE_SIZE && (
              <div className="flex items-center justify-between pt-4 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setAttendancePage((p) => Math.max(1, p - 1))}
                  disabled={attendancePage === 1}
                  className="text-xs font-bold text-blue-600 disabled:text-slate-300 disabled:cursor-not-allowed"
                >
                  ← Prev
                </button>
                <span className="text-slate-400 text-[10px] font-medium">Page {attendancePage} of {attendanceTotalPages} · {filteredAttendanceLogs.length} records</span>
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
        </div>
      )}

      {/* DATA ARCHIVAL MODAL */}
      {archivalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm card-style shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-2xl bg-slate-100 flex items-center justify-center text-base flex-shrink-0">🗃️</span>
                <h3 className="mb-0">Data Archival</h3>
              </div>
              <button
                type="button"
                onClick={() => setArchivalModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <p className="text-sm text-slate-400 mb-6">
              Moves attendance, dispute, and leave records older than 1 year out of the main tables and into
              the archive tables, to keep everything fast as data grows. Nothing is permanently deleted --
              archived records stay viewable, just moved out of the way.
            </p>
            <button
              type="button"
              onClick={handleArchiveOldRecords}
              disabled={archiveLoading}
              className="w-full btn-primary disabled:opacity-50"
            >
              {archiveLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner size="sm" />
                  Archiving...
                </span>
              ) : 'Archive Records Older Than 1 Year'}
            </button>
            {archiveResult && (
              <p className={`text-sm font-medium mt-3 ${archiveResult.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                {archiveResult.type === 'error' ? `⚠️ ${archiveResult.text}` : `✅ ${archiveResult.text}`}
              </p>
            )}
            <button
              type="button"
              onClick={() => setArchivalModalOpen(false)}
              className="mt-4 w-full py-3 rounded-full bg-slate-100 text-slate-600 font-medium text-sm hover:bg-slate-200 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* DATABASE BACKUP MODAL */}
      {backupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm card-style shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-2xl bg-slate-100 flex items-center justify-center text-base flex-shrink-0">🗄️</span>
                <h3 className="mb-0">Database Backup</h3>
              </div>
              <button
                type="button"
                onClick={() => setBackupModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <p className="text-sm text-slate-400 mb-6">
              Runs a full backup (schema + all data, including the auth schema) of the production Supabase
              database and emails you the .sql file once it completes -- a genuine off-site copy, separate
              from the server this app runs on.
            </p>
            <button
              type="button"
              onClick={handleBackupDatabase}
              disabled={backupLoading}
              className="w-full btn-primary disabled:opacity-50"
            >
              {backupLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner size="sm" />
                  Starting Backup...
                </span>
              ) : 'Backup Database'}
            </button>
            {backupResult && (
              <p className={`text-sm font-medium mt-3 ${backupResult.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                {backupResult.type === 'error' ? `⚠️ ${backupResult.text}` : `✅ ${backupResult.text}`}
              </p>
            )}
            <button
              type="button"
              onClick={() => setBackupModalOpen(false)}
              className="mt-4 w-full py-3 rounded-full bg-slate-100 text-slate-600 font-medium text-sm hover:bg-slate-200 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ARCHIVE PASSWORD CONFIRMATION MODAL */}
      {archivePasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm card-style shadow-2xl">
            <h3 className="mb-2">Confirm Your Password</h3>
            <p className="text-sm text-slate-400 mb-4">
              For security, re-enter your password to archive records older than 1 year. This moves them
              out of the main tables -- nothing is permanently deleted.
            </p>
            <input
              type="password"
              autoFocus
              placeholder="Your password"
              value={archivePasswordInput}
              onChange={(e) => setArchivePasswordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && archivePasswordInput && !archivePasswordVerifying) {
                  confirmArchiveWithPassword();
                }
              }}
              className="input-field"
            />
            {archivePasswordError && (
              <p className="text-red-600 text-sm font-medium mt-2">⚠️ {archivePasswordError}</p>
            )}
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setArchivePasswordModalOpen(false);
                  setArchivePasswordInput('');
                  setArchivePasswordError(null);
                }}
                className="flex-1 p-3 bg-slate-100 rounded-full font-medium text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmArchiveWithPassword}
                disabled={!archivePasswordInput || archivePasswordVerifying}
                className="flex-1 btn-primary disabled:opacity-50"
              >
                {archivePasswordVerifying ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner size="sm" />
                    Verifying...
                  </span>
                ) : 'Confirm & Archive'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BACKUP PASSWORD CONFIRMATION MODAL */}
      {backupPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm card-style shadow-2xl">
            <h3 className="mb-2">Confirm Your Password</h3>
            <p className="text-sm text-slate-400 mb-4">
              For security, re-enter your password to run a full database backup. This includes every
              user&apos;s account records, and the resulting file will be emailed to you.
            </p>
            <input
              type="password"
              autoFocus
              placeholder="Your password"
              value={backupPasswordInput}
              onChange={(e) => setBackupPasswordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && backupPasswordInput && !backupPasswordVerifying) {
                  confirmBackupWithPassword();
                }
              }}
              className="input-field"
            />
            {backupPasswordError && (
              <p className="text-red-600 text-sm font-medium mt-2">⚠️ {backupPasswordError}</p>
            )}
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setBackupPasswordModalOpen(false);
                  setBackupPasswordInput('');
                  setBackupPasswordError(null);
                }}
                className="flex-1 p-3 bg-slate-100 rounded-full font-medium text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmBackupWithPassword}
                disabled={!backupPasswordInput || backupPasswordVerifying}
                className="flex-1 btn-primary disabled:opacity-50"
              >
                {backupPasswordVerifying ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner size="sm" />
                    Verifying...
                  </span>
                ) : 'Confirm & Backup'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT ATTENDANCE MODAL -- opens on top of the Attendance Records
          modal when a row is tapped. */}
      {editingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm card-style shadow-2xl">
            <h3 className="mb-2">Edit Attendance</h3>
            <p className="text-sm text-slate-400 mb-6">{editingLog.employeeName}</p>

            <label className="label-branded">Time In (Philippine Time)</label>
            <input
              type="datetime-local"
              className="input-field mb-4"
              value={editingLog.timeInLocal}
              onChange={(e) =>
                setEditingLog({ ...editingLog, timeInLocal: e.target.value })
              }
            />

            <label className="label-branded">Time Out (Philippine Time)</label>
            <input
              type="datetime-local"
              className="input-field mb-1"
              value={editingLog.timeOutLocal}
              onChange={(e) =>
                setEditingLog({ ...editingLog, timeOutLocal: e.target.value })
              }
            />
            {editingLog.timeOutLocal && (
              <button
                type="button"
                onClick={() => setEditingLog({ ...editingLog, timeOutLocal: '' })}
                className="text-slate-400 text-xs font-bold hover:text-slate-600 mb-4"
              >
                Clear time out
              </button>
            )}
            {!editingLog.timeOutLocal && <div className="mb-4" />}

            <label className="label-branded">Status</label>
            <select
              className="input-field mb-6"
              value={editingLog.status}
              onChange={(e) =>
                setEditingLog({ ...editingLog, status: e.target.value })
              }
            >
              <option value="Present">Present</option>
              <option value="Late">Late</option>
              <option value="Excused">Excused</option>
              <option value="Absent">Absent</option>
              <option value="Sick Leave">Sick Leave</option>
              <option value="Vacation Leave">Vacation Leave</option>
              <option value="Emergency Leave">Emergency Leave</option>
            </select>

            <div className="flex gap-3">
              <button
                type="button"
                className="flex-1 p-3 bg-slate-100 rounded-full font-medium text-sm"
                onClick={() => setEditingLog(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 btn-primary disabled:opacity-50"
                onClick={saveEditLog}
                disabled={logSaving || !editingLog.timeInLocal}
              >
                {logSaving ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner size="sm" />
                    Saving...
                  </span>
                ) : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}