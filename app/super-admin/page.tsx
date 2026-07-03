'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';

export default function SuperAdminDashboard() {
  const [employees, setEmployees] = useState<any[]>([]);

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
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [editingLog, setEditingLog] = useState<{
    id: string;
    employeeName: string;
    timeInLocal: string; // datetime-local value, in PH time
    status: string;
  } | null>(null);
  const [logSaving, setLogSaving] = useState(false);

  useEffect(() => {
    fetchEmployees();
    fetchAttendanceLogs();
  }, []);

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching profiles:', error);
      setMessage({ type: 'error', text: error.message });
      return;
    }

    setEmployees(data || []);
  };

  const fetchAttendanceLogs = async () => {
    setAttendanceLoading(true);
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('id, time_in, log_date, status, profiles(full_name)')
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

  const filteredAttendanceLogs = attendanceLogs.filter((log) =>
    log.profiles?.full_name
      ?.toLowerCase()
      .includes(attendanceSearch.toLowerCase())
  );

  const startEditLog = (log: any) => {
    setEditingLog({
      id: log.id,
      employeeName: log.profiles?.full_name ?? 'Unknown',
      timeInLocal: log.time_in ? toManilaInputValue(log.time_in) : '',
      status: log.status ?? 'Present',
    });
  };

  const saveEditLog = async () => {
    if (!editingLog) return;
    setLogSaving(true);

    try {
      const newTimeInISO = manilaInputValueToUTCISO(editingLog.timeInLocal);
      // Keep log_date consistent with the corrected time_in (in PH time)
      const newLogDate = editingLog.timeInLocal.split('T')[0];

      const { data: updatedRows, error } = await supabase
        .from('attendance_logs')
        .update({
          time_in: newTimeInISO,
          log_date: newLogDate,
          status: editingLog.status,
        })
        .eq('id', editingLog.id)
        .select();

      if (error) throw error;

      if (!updatedRows || updatedRows.length === 0) {
        throw new Error(
          'Walang na-update na record. Kadalasan RLS policy issue ito — siguraduhing may UPDATE policy ang attendance_logs table para sa admin/super_admin role.'
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
        text: `Matagumpay na nairehistro si ${fullName}!`,
      });

      resetForm();
      await fetchEmployees();
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err?.message ?? 'Something went wrong' });
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

      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
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

  const roleTagClass = (r: string) => (r === 'admin' ? 'tag-admin' : 'tag-employee');

  const statusTagClass = (s: string) => {
    if (s === 'Late') return 'tag-late';
    if (s === 'Excused') return 'tag-excused';
    return 'tag-present';
  };

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
        {/* BRANDING HEADER */}
        <header className="branding-box">
          <div>
            <h1>HAMDAN ENGINEERING</h1>
            <p className="text-[18px] font-bold text-blue-600 uppercase tracking-widest">
              Super Admin Portal
            </p>
          </div>

          <button
            onClick={() =>
              supabase.auth.signOut().then(() => (window.location.href = '/'))
            }
            className="bg-red-50 text-red-600 px-10 py-2 rounded-xl font-bold text-sm hover:bg-red-100 transition"
            type="button"
          >
            Log Out
          </button>
        </header>

        {message && (
          <div
            className={`p-4 rounded-xl text-sm font-bold ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* FORM CARD */}
          <section className="card-style h-fit">
            <h3 className="mb-6">
              {editingId ? 'Edit Account' : 'Create New Account'}
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              <input
                type="text"
                placeholder="Full Name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input-field"
              />

              <input
                type="text"
                placeholder="Employee ID"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="input-field"
              />

              <input
                type="text"
                placeholder="Designation"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="input-field"
              />

              {!editingId && (
                <>
                  <input
                    type="email"
                    placeholder="Email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field"
                  />
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
                  className={`p-3 rounded-xl font-bold ${
                    role === 'employee' ? 'bg-blue-600 text-white' : 'bg-slate-100'
                  }`}
                >
                  Employee
                </button>
                <button
                  type="button"
                  onClick={() => setRole('admin')}
                  className={`p-3 rounded-xl font-bold ${
                    role === 'admin' ? 'bg-purple-600 text-white' : 'bg-slate-100'
                  }`}
                >
                  HR Admin
                </button>
              </div>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="w-full p-3 rounded-xl font-bold bg-slate-100 text-slate-600"
                >
                  Cancel Edit
                </button>
              )}

              <button disabled={loading} className="btn-primary">
                {loading
                  ? 'Processing...'
                  : editingId
                  ? 'Save Changes'
                  : 'Create Account'}
              </button>
            </form>

            {/* RESET PASSWORD FORM */}
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
                {resetLoading ? 'Sending...' : 'Send Reset Email'}
              </button>
            </form>
          </section>

          {/* TABLE SECTION */}
          <section className="lg:col-span-2 card-style">
            <h3 className="mb-6">User Accounts</h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-400 text-xs font-bold uppercase tracking-widest border-b border-slate-100">
                    <th className="pb-4">Emp ID</th>
                    <th className="pb-4">Name</th>
                    <th className="pb-4">Role</th>
                    <th className="pb-4 text-right">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {employees.map((emp) => (
                    <tr
                      key={emp.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="py-4 font-mono font-bold text-slate-500 text-sm">
                        {emp.employee_id || '-'}
                      </td>
                      <td className="py-4 font-bold text-slate-900">
                        {emp.full_name}
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
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* ATTENDANCE RECORDS SECTION (dispute / late corrections) */}
        <section className="card-style">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h3>Attendance Records</h3>
              <p className="text-sm text-slate-400 mt-1">
                I-edit ang time in ng employee para sa dispute o nakalimutang time in.
              </p>
            </div>
            <input
              type="text"
              placeholder="Search employee..."
              value={attendanceSearch}
              onChange={(e) => setAttendanceSearch(e.target.value)}
              className="input-field md:w-64"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-400 text-xs font-bold uppercase tracking-widest border-b border-slate-100">
                  <th className="pb-4">Employee</th>
                  <th className="pb-4">Date</th>
                  <th className="pb-4">Time In</th>
                  <th className="pb-4">Status</th>
                  <th className="pb-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attendanceLoading && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 text-sm">
                      Loading...
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
                    <td colSpan={5} className="py-8 text-center text-slate-400 text-sm">
                      Walang attendance records na nahanap.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* EDIT ATTENDANCE MODAL */}
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
                className="flex-1 p-3 bg-slate-100 rounded-xl font-medium text-sm"
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
                {logSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
