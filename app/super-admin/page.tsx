'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase, supabaseAuthActions } from '@/lib/supabase';
import Image from 'next/image';
import Spinner, { LoadingRow } from '@/components/Spinner';

export default function SuperAdminDashboard() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);

  // Create account fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [attendanceDateFilter, setAttendanceDateFilter] = useState(() =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())
  );
  const [editingLog, setEditingLog] = useState<{
    id: string;
    employeeName: string;
    timeInLocal: string;
    timeOutLocal: string;
    status: string;
  } | null>(null);
  const [logSaving, setLogSaving] = useState(false);

  useEffect(() => {
    fetchEmployees();
    fetchAttendanceLogs();
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
      .order('time_in', { ascending: false })
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
    return new Date(`${value}:00+08:00`).toISOString();
  };

  const toManilaDateString = (iso: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(iso));

  const todayManila = toManilaDateString(new Date().toISOString());

  const filteredAttendanceLogs = attendanceLogs.filter((log) => {
    const matchesSearch = log.profiles?.full_name
      ?.toLowerCase()
      .includes(attendanceSearch.toLowerCase());
    const matchesDate = attendanceDateFilter
      ? log.time_in && toManilaDateString(log.time_in) === attendanceDateFilter
      : true;
    return matchesSearch && matchesDate;
  });

  const startEditLog = (log: any) => {
    setEditingLog({
      id: log.id,
      employeeName: log.profiles?.full_name ?? 'Unknown',
      timeInLocal: log.time_in ? toManilaInputValue(log.time_in) : '',
      timeOutLocal: log.time_out ? toManilaInputValue(log.time_out) : '',
      status: log.status ?? 'Present',
    });
  };

  const saveEditLog = async () => {
    if (!editingLog) return;
    setLogSaving(true);

    try {
      const newTimeInISO = manilaInputValueToUTCISO(editingLog.timeInLocal);
      const newLogDate = editingLog.timeInLocal.split('T')[0];
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
    setFullName('');
    setEmployeeId('');
    setDesignation('');
    setRole('employee');
  };

  const startEdit = (emp: any) => {
    setEditingId(emp.id);
    setFullName(emp.full_name ?? '');
    setEmployeeId(emp.employee_id ?? '');
    setDesignation(emp.designation ?? '');
    setRole((emp.role ?? 'employee') as 'employee' | 'admin');
    setMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (editingId) {
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

      const { error } = await supabaseAuthActions.auth.resetPasswordForEmail(resetEmail, {
        redirectTo,
      });

      if (error) throw error;

      setMessage({
        type: 'success',
        text: 'Check your email for reset password instructions.',
      });

      setResetEmail('');
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err?.message ?? 'Reset password failed' });
    } finally {
      setResetLoading(false);
    }
  };

  const employeeIdConflict = useMemo(() => {
    const trimmed = employeeId.trim().toLowerCase();
    if (!trimmed) return null;
    const match = employees.find(
      (emp) =>
        emp.employee_id?.trim().toLowerCase() === trimmed && emp.id !== editingId
    );
    return match ? match.full_name : null;
  }, [employeeId, employees, editingId]);

  const fullNameConflict = useMemo(() => {
    const trimmed = fullName.trim().toLowerCase();
    if (!trimmed) return null;
    const match = employees.find(
      (emp) =>
        emp.full_name?.trim().toLowerCase() === trimmed && emp.id !== editingId
    );
    return match ? true : false;
  }, [fullName, employees, editingId]);

  const [emailConflict, setEmailConflict] = useState(false);
  const [emailChecking, setEmailChecking] = useState(false);

  useEffect(() => {
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
        setEmailConflict(false);
      } finally {
        setEmailChecking(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [email, editingId]);

  const roleTagClass = (r: string) => (r === 'admin' ? 'tag-admin' : 'tag-employee');

  const statusTagClass = (s: string) => {
    if (s === 'Late') return 'tag-late';
    if (s === 'Excused') return 'tag-excused';
    return 'tag-present';
  };

  const initials = (name: string | null) =>
    (name || '?')
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  const totalAccounts = employees.length;
  const totalAdmins = employees.filter((e) => e.role === 'admin').length;
  const totalEmployeesCount = employees.filter((e) => e.role === 'employee').length;

  return (
    <main className="min-h-screen relative p-4 md:p-8">
      <div className="fixed inset-0 z-0">
        <Image
          src="/images/hamdan-logo.png"
          alt="Background"
          fill
          className="object-cover opacity-[0.05] blur-sm"
          priority
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto space-y-6">
        <header className="branding-box flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1>HAMDAN ENGINEERING</h1>
            <p className="text-[13px] font-bold text-slate-600 uppercase tracking-widest mt-1">
              Super Admin Portal
            </p>
          </div>

          <button
            onClick={() =>
              supabase.auth.signOut().then(() => (window.location.href = '/'))
            }
            className="bg-white/70 text-slate-700 px-6 py-2.5 rounded-full font-bold text-sm hover:bg-white transition"
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <section className="card-style h-fit">
            <h3 className="mb-6">
              {editingId ? 'Edit Account' : 'Create New Account'}
            </h3>

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
                    ⚠️ Another account already uses this name. Make sure you're not accidentally editing the wrong employee.
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

              <button disabled={loading || !!employeeIdConflict || emailConflict} className="btn-primary">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner size="sm" />
                    Processing...
                  </span>
                ) : employeeIdConflict
                  ? 'Fix Employee ID Conflict First'
                  : emailConflict
                  ? 'Fix Email Conflict First'
                  : editingId
                  ? 'Save Changes'
                  : 'Create Account'}
              </button>
            </form>

            <form
              onSubmit={handleResetPassword}
              className="space-y-3 pt-6 mt-6 border-t border-slate-100"
            >
              <h3>Reset Password</h3>

              <input
                type="email"
                placeholder="Email to reset"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="input-field"
              />

              <button
                type="submit"
                disabled={resetLoading}
                className="btn-primary"
              >
                {resetLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner size="sm" />
                    Sending...
                  </span>
                ) : 'Send Reset Email'}
              </button>
            </form>
          </section>

          <section className="lg:col-span-2 card-style">
            <h3 className="mb-6">User Accounts</h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-400 text-xs font-bold uppercase tracking-widest border-b border-slate-100">
                    <th className="pb-4">Employee</th>
                    <th className="pb-4">Emp ID</th>
                    <th className="pb-4">Role</th>
                    <th className="pb-4 text-right">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {employeesLoading && employees.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8">
                        <LoadingRow label="Loading accounts..." />
                      </td>
                    </tr>
                  )}
                  {employees.map((emp) => (
                    <tr
                      key={emp.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-blue-50 text-blue-600 font-bold text-xs flex items-center justify-center">
                            {initials(emp.full_name)}
                          </div>
                          <span className="font-bold text-slate-900">{emp.full_name}</span>
                        </div>
                      </td>
                      <td className="py-4 font-mono font-bold text-slate-500 text-sm">
                        {emp.employee_id || '-'}
                      </td>
                      <td className="py-4">
                        <span className={roleTagClass(emp.role)}>{emp.role}</span>
                      </td>
                      <td className="py-4 text-right">
                        <button
                          type="button"
                          onClick={() => startEdit(emp)}
                          className="text-blue-600 font-bold text-sm hover:underline"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!employeesLoading && employees.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400 text-sm">
                        No accounts found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <section className="card-style">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h3>
                Attendance Records
                {attendanceDateFilter && (
                  <span className="block text-[11px] font-medium text-slate-400 normal-case tracking-normal mt-1">
                    {attendanceDateFilter === todayManila
                      ? "Showing today's records"
                      : `Showing records for ${attendanceDateFilter}`}
                  </span>
                )}
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                Edit an employee's time in for disputes or forgotten time-ins.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 items-center w-full md:w-auto">
              <input
                type="text"
                placeholder="Search employee..."
                value={attendanceSearch}
                onChange={(e) => setAttendanceSearch(e.target.value)}
                className="input-field md:w-56"
              />
              <input
                type="date"
                value={attendanceDateFilter}
                onChange={(e) => setAttendanceDateFilter(e.target.value)}
                className="input-field md:w-auto"
              />
              {attendanceDateFilter !== todayManila && (
                <button
                  onClick={() => setAttendanceDateFilter(todayManila)}
                  className="text-blue-600 font-bold text-xs whitespace-nowrap"
                >
                  Today
                </button>
              )}
              {attendanceDateFilter && (
                <button
                  onClick={() => setAttendanceDateFilter('')}
                  className="text-slate-400 font-bold text-xs whitespace-nowrap"
                >
                  View All
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-400 text-xs font-bold uppercase tracking-widest border-b border-slate-100">
                  <th className="pb-4">Employee</th>
                  <th className="pb-4">Date</th>
                  <th className="pb-4">Time In</th>
                  <th className="pb-4">Time Out</th>
                  <th className="pb-4">Status</th>
                  <th className="pb-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attendanceLoading && (
                  <tr>
                    <td colSpan={6} className="py-8">
                      <LoadingRow label="Loading attendance records..." />
                    </td>
                  </tr>
                )}

                {!attendanceLoading &&
                  filteredAttendanceLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 font-bold text-slate-900">
                        {log.profiles?.full_name ?? '-'}
                      </td>
                      <td className="py-4 text-slate-600 text-sm">
                        {log.time_in
                          ? new Date(log.time_in).toLocaleDateString('en-US', {
                              timeZone: 'Asia/Manila',
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : 'N/A'}
                      </td>
                      <td className="py-4 text-slate-600 text-sm">
                        {log.time_in
                          ? new Date(log.time_in).toLocaleTimeString('en-US', {
                              timeZone: 'Asia/Manila',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'N/A'}
                      </td>
                      <td className="py-4 text-slate-600 text-sm">
                        {log.time_out
                          ? new Date(log.time_out).toLocaleTimeString('en-US', {
                              timeZone: 'Asia/Manila',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>
                      <td className="py-4">
                        <span className={statusTagClass(log.status)}>{log.status}</span>
                      </td>
                      <td className="py-4 text-right">
                        <button
                          type="button"
                          onClick={() => startEditLog(log)}
                          className="text-blue-600 font-bold text-sm hover:underline"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}

                {!attendanceLoading && filteredAttendanceLogs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 text-sm">
                      No attendance records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

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