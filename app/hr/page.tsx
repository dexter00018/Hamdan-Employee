'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type AttendanceLog = {
  id: string;
  time_in: string | null;
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

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  // Modal States
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState({ id: null as string | null, full_name: '', employee_id: '', designation: '' });
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

      setAnnouncementMsg({ type: 'success', text: 'Na-publish ang announcement.' });
      await fetchAnnouncement();
    } catch (err: any) {
      console.error('Error publishing announcement:', err);
      setAnnouncementMsg({ type: 'error', text: err?.message ?? 'Failed to publish announcement.' });
    } finally {
      setAnnouncementSaving(false);
    }
  };

  // Filter Logic
  const filteredAttendance = useMemo(() => {
    return attendance.filter((log) => {
      const matchesSearch = log.profiles?.full_name
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesDate = selectedDate ? log.time_in?.startsWith(selectedDate) : true;
      return matchesSearch && matchesDate;
    });
  }, [attendance, searchTerm, selectedDate]);

  const openEdit = (p: Profile) => {
    setEditing({
      id: p.id,
      full_name: p.full_name || '',
      employee_id: p.employee_id || '',
      designation: p.designation || '',
    });
    setEditOpen(true);
  };

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

    if (!error) {
      await refreshAllData();
      setEditOpen(false);
    } else {
      console.error('Error saving profile:', error);
      setErrorMsg(error.message);
    }
    setSaveLoading(false);
  };

  const statusTagClass = (s: string | null) => {
    if (s === 'Late') return 'tag-late';
    if (s === 'Excused') return 'tag-excused';
    return 'tag-present';
  };

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
            <p className="text-slate-400 text-sm">Loading...</p>
          ) : (
            <>
              <textarea
                className="input-field w-full min-h-[100px] resize-y"
                placeholder="I-type ang announcement na makikita ng lahat ng employees..."
                value={announcementContent}
                onChange={(e) => setAnnouncementContent(e.target.value)}
              />
              <button
                onClick={publishAnnouncement}
                disabled={announcementSaving || !announcementContent.trim()}
                className="btn-primary mt-4 disabled:opacity-50"
              >
                {announcementSaving ? 'Publishing...' : announcementId ? 'Update Announcement' : 'Publish Announcement'}
              </button>
            </>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Employee Sidebar */}
          <section className="card-style">
            <h3 className="mb-6">Employees</h3>
            <div className="space-y-3">
              {loadingData && profiles.length === 0 && (
                <p className="text-slate-400 text-sm">Loading...</p>
              )}
              {!loadingData && profiles.length === 0 && (
                <p className="text-slate-400 text-sm">No employees found.</p>
              )}
              {profiles.map((p) => (
                <button key={p.id} onClick={() => openEdit(p)} className="w-full text-left p-4 rounded-xl hover:bg-slate-50 border border-slate-100 transition">
                  <div className="font-medium text-slate-900">{p.full_name}</div>
                  <div className="label-branded mb-0 mt-1 text-blue-600">{p.designation}</div>
                </button>
              ))}
            </div>
          </section>

          {/* Attendance History */}
          <section className="card-style lg:col-span-2 overflow-hidden !p-0">
            <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-center">
              <h3>Attendance History</h3>
              <div className="flex gap-2 w-full md:w-auto">
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
              </div>
            </div>

            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                <tr>
                  <th className="px-8 py-4">Employee</th>
                  <th className="px-8 py-4">Date</th>
                  <th className="px-8 py-4">Time In</th>
                  <th className="px-8 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
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
                          })
                        : 'N/A'}
                    </td>
                    <td className="px-8 py-4">
                      <span className={statusTagClass(log.status)}>{log.status}</span>
                    </td>
                  </tr>
                ))}
                {!loadingData && filteredAttendance.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-8 py-8 text-center text-slate-400 text-sm">
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
            <input className="input-field mb-3" value={editing.employee_id} onChange={e => setEditing({...editing, employee_id: e.target.value})} placeholder="Employee ID" />
            <input className="input-field mb-6" value={editing.designation} onChange={e => setEditing({...editing, designation: e.target.value})} placeholder="Designation" />
            <div className="flex gap-3">
              <button className="flex-1 p-3 bg-slate-100 rounded-xl font-medium text-sm" onClick={() => setEditOpen(false)}>Cancel</button>
              <button className="flex-1 btn-primary" onClick={saveEdit} disabled={saveLoading}>
                {saveLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
