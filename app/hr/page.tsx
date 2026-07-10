'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Spinner, { LoadingRow } from '@/components/Spinner';

type AttendanceLog = {
  id: string;
  time_in: string | null;
  time_out: string | null;
  status: string | null;
  profiles?: { full_name: string | null };
};

type Profile = {
  id: string;
  full_name: string | null;
  employee_id: string | null;
  designation: string | null;
};

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

  // Modal States
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState({ id: null as string | null, full_name: '', employee_id: '', designation: '', sss_number: '', philhealth_number: '', pagibig_number: '', tin_number: '', hired_date: '', employment_status: '' });
  const [saveLoading, setSaveLoading] = useState(false);

  // Announcement States
  const [announcementId, setAnnouncementId] = useState<string | null>(null);
  const [announcementContent, setAnnouncementContent] = useState('');
  const [announcementUpdatedAt, setAnnouncementUpdatedAt] = useState<string | null>(null);
  const [announcementLoading, setAnnouncementLoading] = useState(true);
  const [announcementSaving, setAnnouncementSaving] = useState(false);
  const [announcementMsg, setAnnouncementMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    refreshAllData();
    fetchAnnouncement();
  }, []);

  const refreshAllData = async () => {
    setLoadingData(true);
    setErrorMsg(null);

    const [att, prof] = await Promise.all([
      supabase
        .from('attendance_logs')
        .select('*, profiles!inner(full_name)')
        .eq('profiles.role', 'employee')
        .order('time_in', { ascending: false }),
      supabase
        .from('profiles')
        .select('id, full_name, employee_id, designation')
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
  };

  // Loads the current published announcement (if any) so HR can see and
  // edit what's already live before publishing changes.
  const fetchAnnouncement = async () => {
    setAnnouncementLoading(true);
    const { data, error } = await supabase
      .from('announcements')
      .select('id, content, updated_at')
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
    setAnnouncementUpdatedAt(data?.updated_at ?? null);
    setAnnouncementLoading(false);
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

      if (announcementId) {
        const { error } = await supabase
          .from('announcements')
          .update({
            content: announcementContent,
            updated_at: new Date().toISOString(),
            updated_by: user?.id ?? null,
          })
          .eq('id', announcementId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('announcements')
          .insert([{ content: announcementContent, updated_by: user?.id ?? null }])
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

  // Converts a UTC ISO timestamp to its Philippine calendar date
  // ("YYYY-MM-DD"). Comparing this instead of the raw UTC prefix avoids
  // misfiling records near midnight (PH is UTC+8, so a log_time_in of
  // "2026-07-05T17:30:00Z" is already July 6 in Manila).
  const toManilaDateString = (iso: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(iso));

  // Filter Logic
  const filteredAttendance = useMemo(() => {
    return attendance.filter((log) => {
      const matchesSearch = log.profiles?.full_name
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesDate = selectedDate
        ? log.time_in && toManilaDateString(log.time_in) === selectedDate
        : true;
      return matchesSearch && matchesDate;
    });
  }, [attendance, searchTerm, selectedDate]);

  const openEdit = async (p: Profile) => {
    setEditing({
      id: p.id,
      full_name: p.full_name || '',
      employee_id: p.employee_id || '',
      designation: p.designation || '',
      sss_number: '',
      philhealth_number: '',
      pagibig_number: '',
      tin_number: '',
      hired_date: '',
      employment_status: '',
    });
    setEditOpen(true);

    // Government IDs live in a separate table -- fetch this employee's
    // existing values (if any) so HR can see/update them.
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

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: editing.full_name,
        employee_id: editing.employee_id,
        designation: editing.designation,
      })
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
    setEditOpen(false);
    setSaveLoading(false);
  };

  const statusTagClass = (s: string | null) => {
    if (s === 'Late') return 'tag-late';
    if (s === 'Excused') return 'tag-excused';
    return 'tag-present';
  };

  // Today's date in Philippine time, for the "Present/Late Today" stats.
  const todayManila = useMemo(() => {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' });
    return fmt.format(new Date()); // "YYYY-MM-DD"
  }, []);

  const todaysLogs = useMemo(
    () => attendance.filter((log) => log.time_in && toManilaDateString(log.time_in) === todayManila),
    [attendance, todayManila]
  );
  const presentTodayCount = todaysLogs.length;
  const lateTodayCount = todaysLogs.filter((l) => l.status === 'Late').length;

  const initials = (name: string | null) =>
    (name || '?')
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <header className="branding-box flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1>HAMDAN ENGINEERING</h1>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">HR Portal | Attendance</p>
          </div>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} className="text-slate-600 font-medium text-sm hover:text-red-600 transition">
            Sign out
          </button>
        </header>

        {errorMsg && (
          <div className="p-4 rounded-xl text-sm font-bold bg-red-50 text-red-700">
            {errorMsg}
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 md:gap-4">
          <div className="card-dark flex flex-col items-center justify-center !p-4 md:!p-6 text-center">
            <p className="stat-number text-2xl md:text-3xl text-white">{profiles.length}</p>
            <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mt-1">Total Employees</p>
          </div>
          <div className="card-style flex flex-col items-center justify-center !p-4 md:!p-6 text-center">
            <p className="stat-number text-2xl md:text-3xl text-green-600">{presentTodayCount}</p>
            <p className="label-branded mt-1">Present Today</p>
          </div>
          <div className="card-style flex flex-col items-center justify-center !p-4 md:!p-6 text-center">
            <p className="stat-number text-2xl md:text-3xl text-orange-600">{lateTodayCount}</p>
            <p className="label-branded mt-1">Late Today</p>
          </div>
        </div>

        {/* Announcements */}
        <section className="card-style">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h3 className="mb-0">Announcements</h3>
            {announcementUpdatedAt && (
              <p className="text-slate-400 text-[11px] font-medium uppercase tracking-widest">
                Last published: {new Date(announcementUpdatedAt).toLocaleString('en-US', {
                  timeZone: 'Asia/Manila',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
          </div>

          {announcementMsg && (
            <div className={`p-3 rounded-xl text-sm font-bold mb-4 ${announcementMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {announcementMsg.text}
            </div>
          )}

          {announcementLoading ? (
            <LoadingRow label="Loading current announcement..." />
          ) : (
            <>
              <textarea
                className="input-field w-full min-h-[100px] resize-y"
                placeholder="Type the announcement that all employees will see..."
                value={announcementContent}
                onChange={(e) => setAnnouncementContent(e.target.value)}
              />
              <button
                onClick={publishAnnouncement}
                disabled={announcementSaving || !announcementContent.trim()}
                className="btn-primary mt-4 disabled:opacity-50"
              >
                {announcementSaving ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner size="sm" />
                    Publishing...
                  </span>
                ) : announcementId ? 'Update Announcement' : 'Publish Announcement'}
              </button>
            </>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Employee Sidebar */}
          <section className="card-style">
            <h3 className="mb-6">Employees</h3>
            <div className="space-y-3">
              {loadingData && profiles.length === 0 && <LoadingRow label="Loading employees..." />}
              {!loadingData && profiles.length === 0 && (
                <p className="text-slate-400 text-sm">No employees found.</p>
              )}
              {profiles.map((p) => (
                <button key={p.id} onClick={() => openEdit(p)} className="w-full flex items-center gap-3 text-left p-4 rounded-2xl hover:bg-slate-50 border border-slate-100 transition">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-50 text-blue-600 font-bold text-xs flex items-center justify-center">
                    {initials(p.full_name)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 truncate">{p.full_name}</div>
                    <div className="label-branded mb-0 mt-1 text-blue-600 truncate">{p.designation}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Attendance History */}
          <section className="card-style lg:col-span-2 overflow-hidden !p-0">
            <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-center">
              <h3>
                Attendance History
                {selectedDate && (
                  <span className="block text-[11px] font-medium text-slate-400 normal-case tracking-normal mt-1">
                    {selectedDate === todayManila ? "Showing today's records" : `Showing records for ${selectedDate}`}
                  </span>
                )}
              </h3>
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <input
                  className="input-field"
                  placeholder="Search name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <input
                  type="date"
                  className="input-field"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
                {selectedDate !== todayManila && (
                  <button
                    onClick={() => setSelectedDate(todayManila)}
                    className="text-blue-600 font-bold text-xs whitespace-nowrap"
                  >
                    Today
                  </button>
                )}
                {selectedDate && (
                  <button
                    onClick={() => setSelectedDate('')}
                    className="text-slate-400 font-bold text-xs whitespace-nowrap"
                  >
                    View All
                  </button>
                )}
              </div>
            </div>

            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                <tr>
                  <th className="px-8 py-4">Employee</th>
                  <th className="px-8 py-4">Date</th>
                  <th className="px-8 py-4">Time In</th>
                  <th className="px-8 py-4">Time Out</th>
                  <th className="px-8 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingData && attendance.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-8 py-8">
                      <LoadingRow label="Loading attendance history..." />
                    </td>
                  </tr>
                )}
                {filteredAttendance.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition">
                    <td className="px-8 py-4 font-medium text-slate-900">{log.profiles?.full_name}</td>
                    <td className="px-8 py-4 text-slate-600">
                      {log.time_in
                        ? new Date(log.time_in).toLocaleDateString('en-US', {
                            timeZone: 'Asia/Manila',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : 'N/A'}
                    </td>
                    <td className="px-8 py-4 text-slate-600">
                      {log.time_in
                        ? new Date(log.time_in).toLocaleTimeString('en-US', {
                            timeZone: 'Asia/Manila',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })
                        : 'N/A'}
                    </td>
                    <td className="px-8 py-4 text-slate-600">
                      {log.time_out
                        ? new Date(log.time_out).toLocaleTimeString('en-US', {
                            timeZone: 'Asia/Manila',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })
                        : '—'}
                    </td>
                    <td className="px-8 py-4">
                      <span className={statusTagClass(log.status)}>{log.status}</span>
                    </td>
                  </tr>
                ))}
                {!loadingData && filteredAttendance.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-8 py-8 text-center text-slate-400 text-sm">
                      No attendance records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </div>
      </div>

      {/* Edit Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm card-style shadow-2xl">
            <h3 className="mb-6">Edit Profile</h3>
            <input className="input-field mb-3" value={editing.full_name} onChange={e => setEditing({...editing, full_name: e.target.value})} placeholder="Full Name" />
            <div className="mb-3">
              <input className="input-field" value={editing.employee_id} onChange={e => setEditing({...editing, employee_id: e.target.value})} placeholder="Employee ID" />
              {editingEmployeeIdConflict && (
                <p className="text-red-600 text-xs font-medium mt-1.5 ml-1">
                  ⚠️ This Employee ID is already used by {editingEmployeeIdConflict}. Please use a different one.
                </p>
              )}
            </div>
            <input className="input-field mb-3" value={editing.designation} onChange={e => setEditing({...editing, designation: e.target.value})} placeholder="Designation" />

            <div className="mb-6 pt-3 border-t border-slate-100">
              <p className="label-branded mb-3">Government IDs &amp; Employment Details</p>
              <div className="space-y-3">
                <input
                  className="input-field"
                  value={editing.sss_number}
                  onChange={(e) => setEditing({ ...editing, sss_number: e.target.value })}
                  placeholder="SSS Number"
                />
                <input
                  className="input-field"
                  value={editing.philhealth_number}
                  onChange={(e) => setEditing({ ...editing, philhealth_number: e.target.value })}
                  placeholder="PhilHealth Number"
                />
                <input
                  className="input-field"
                  value={editing.pagibig_number}
                  onChange={(e) => setEditing({ ...editing, pagibig_number: e.target.value })}
                  placeholder="Pag-IBIG Number"
                />
                <input
                  className="input-field"
                  value={editing.tin_number}
                  onChange={(e) => setEditing({ ...editing, tin_number: e.target.value })}
                  placeholder="TIN Number"
                />
                <div>
                  <label className="label-branded">Hired Date</label>
                  <input
                    type="date"
                    className="input-field"
                    value={editing.hired_date}
                    onChange={(e) => setEditing({ ...editing, hired_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label-branded">Employment Status</label>
                  <select
                    className="input-field"
                    value={editing.employment_status}
                    onChange={(e) => setEditing({ ...editing, employment_status: e.target.value })}
                  >
                    <option value="">Not set</option>
                    <option value="Regular">Regular</option>
                    <option value="Probationary">Probationary</option>
                    <option value="Contractual">Contractual</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button className="flex-1 p-3 bg-slate-100 rounded-full font-medium text-sm" onClick={() => setEditOpen(false)}>Cancel</button>
              <button className="flex-1 btn-primary" onClick={saveEdit} disabled={saveLoading || !!editingEmployeeIdConflict}>
                {saveLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner size="sm" />
                    Saving...
                  </span>
                ) : editingEmployeeIdConflict ? 'Fix Conflict First' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
