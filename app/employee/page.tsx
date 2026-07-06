'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';

const LATE_CUTOFF_HOUR = 9;
const LATE_CUTOFF_MINUTE = 15;

export default function EmployeeDashboard() {
  const [loading, setLoading] = useState(false);
  const [isAlreadyTimedIn, setIsAlreadyTimedIn] = useState(false);
  const [message, setMessage] = useState('');
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');
  const [profile, setProfile] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [initLoading, setInitLoading] = useState(true);

  // History filter (month picker, e.g. "2026-07")
  const [monthFilter, setMonthFilter] = useState('');

  // Announcements
  const [announcement, setAnnouncement] = useState<string>('');
  const [announcementLoading, setAnnouncementLoading] = useState(true);
  const [announcementError, setAnnouncementError] = useState<string | null>(null);
  const [announcementUpdatedAt, setAnnouncementUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-GB', { hour12: false }));
      setDate(now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
    }, 1000);

    initializeDashboard();
    fetchAnnouncement();
    return () => clearInterval(timer);
  }, []);

  const initializeDashboard = async () => {
    setInitLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setInitLoading(false);
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, employee_id, designation, role, avatar_url')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      setMessage('Error: ' + profileError.message);
    }

    setProfile(profileData);

    const { data: historyData, error: historyError } = await supabase
      .from('attendance_logs')
      .select('log_date, time_in, status')
      .eq('user_id', user.id)
      .order('log_date', { ascending: false });

    if (historyError) {
      console.error('Error fetching history:', historyError);
      setMessage('Error: ' + historyError.message);
    }

    setHistory(historyData || []);
    const hasTimedInToday = historyData?.some(log => log.log_date === today);
    setIsAlreadyTimedIn(!!hasTimedInToday);
    setInitLoading(false);
  };

  // Fetches the latest announcement straight from Supabase. RLS on the
  // `announcements` table should allow SELECT to any authenticated user
  // but only allow INSERT/UPDATE from admin/super_admin roles (see the
  // SQL setup notes shared alongside this file).
  const fetchAnnouncement = async () => {
    setAnnouncementLoading(true);
    setAnnouncementError(null);
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('content, updated_at')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      setAnnouncement(data?.content || '');
      setAnnouncementUpdatedAt(
        data?.updated_at
          ? new Date(data.updated_at).toLocaleString('en-US', {
              timeZone: 'Asia/Manila',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : null
      );
    } catch (err: any) {
      console.error('Error fetching announcement:', err);
      setAnnouncementError('Hindi ma-fetch ang announcement ngayon.');
    } finally {
      setAnnouncementLoading(false);
    }
  };

  // Determine Present vs Late based on Philippine time, regardless of
  // what timezone the employee's device/browser is set to.
  const getStatusForNow = () => {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = fmt.formatToParts(now).reduce((acc: any, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
    const hour = parseInt(parts.hour, 10);
    const minute = parseInt(parts.minute, 10);

    const isLate =
      hour > LATE_CUTOFF_HOUR ||
      (hour === LATE_CUTOFF_HOUR && minute > LATE_CUTOFF_MINUTE);

    return isLate ? 'Late' : 'Present';
  };

  const handleTimeIn = async () => {
    setLoading(true);
    setMessage('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You are not logged in!");

      const today = new Date().toISOString().split('T')[0];
      const status = getStatusForNow();

      // Note: time_in is intentionally omitted here. The attendance_logs
      // table now defaults time_in to now() at the database level (see
      // attendance_setup.sql), so a spoofed device clock can no longer
      // affect the recorded time. `status` is still computed client-side
      // for instant UI feedback; if you want it fully tamper-proof too,
      // move that computation into a DB trigger/generated column.
      const { error } = await supabase.from('attendance_logs').insert([{
        user_id: user.id,
        log_date: today,
        status,
      }]);

      if (error) throw error;
      setMessage(
        status === 'Late'
          ? 'Na-record ang time in mo, pero medyo late ka na ngayon.'
          : 'Success! Attendance recorded.'
      );
      setIsAlreadyTimedIn(true);
      await initializeDashboard();
    } catch (err: any) {
      setMessage("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const statusTagClass = (s: string | null) => (s === 'Late' ? 'tag-late' : 'tag-present');

  // --- Summary card calculations ---
  // log_date is a plain "YYYY-MM-DD" string, so we parse it manually
  // instead of `new Date(log_date)` to avoid the browser's local
  // timezone shifting it into the wrong day/month.
  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // If the employee has filtered Attendance History to a specific month,
  // the summary cards follow that same month. Otherwise, default to the
  // current calendar month.
  const summaryMonthKey = monthFilter || currentMonthKey;

  const summary = useMemo(() => {
    const monthLogs = history.filter(log => log.log_date?.startsWith(summaryMonthKey));
    const present = monthLogs.length;
    const late = monthLogs.filter(l => l.status === 'Late').length;
    const onTime = present - late;
    return { present, late, onTime };
  }, [history, summaryMonthKey]);

  // --- History filtering ---
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    history.forEach(log => {
      if (log.log_date) set.add(log.log_date.slice(0, 7));
    });
    return Array.from(set).sort().reverse();
  }, [history]);

  const filteredHistory = useMemo(() => {
    if (!monthFilter) return history;
    return history.filter(log => log.log_date?.startsWith(monthFilter));
  }, [history, monthFilter]);

  const formatMonthLabel = (key: string) => {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">

        {/* Header */}
        <header className="branding-box flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl">HAMDAN ENGINEERING</h1>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Employee Portal</p>
          </div>
          <button
            onClick={() => supabase.auth.signOut().then(() => window.location.href = '/')}
            className="self-start sm:self-auto text-slate-600 font-medium text-sm hover:text-red-600 transition"
          >
            Log Out
          </button>
        </header>

        {message && (
          <div className={`p-4 rounded-xl text-sm font-bold ${message.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {message}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
          <div className="card-style !p-4 md:!p-6 text-center">
            <p className="stat-number text-2xl md:text-3xl text-blue-600">{summary.present}</p>
            <p className="label-branded mt-1">Days Present ({formatMonthLabel(summaryMonthKey)})</p>
          </div>
          <div className="card-style !p-4 md:!p-6 text-center">
            <p className="stat-number text-2xl md:text-3xl text-orange-600">{summary.late}</p>
            <p className="label-branded mt-1">Late ({formatMonthLabel(summaryMonthKey)})</p>
          </div>
          <div className="card-style !p-4 md:!p-6 text-center col-span-2 sm:col-span-1">
            <p className="stat-number text-2xl md:text-3xl text-green-600">{summary.onTime}</p>
            <p className="label-branded mt-1">On-Time ({formatMonthLabel(summaryMonthKey)})</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {/* Profile Sidebar */}
          <div className="md:col-span-1">
            <div className="card-style md:sticky md:top-8 text-center">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                {profile?.avatar_url ? (
                  <Image src={profile.avatar_url} alt="Profile" width={96} height={96} className="object-cover w-full h-full" />
                ) : (
                  <div className="text-slate-400 font-bold">Logo</div>
                )}
              </div>
              <h2 className="text-xl font-semibold text-slate-900">{initLoading ? 'Loading...' : (profile?.full_name || 'Unknown')}</h2>
              <p className="text-blue-600 font-medium text-sm mb-6">{profile?.designation || '---'}</p>

              <div className="text-left border-t border-slate-100 pt-6">
                <p className="label-branded">Employee ID</p>
                <p className="font-medium text-slate-700">{profile?.employee_id || '---'}</p>
              </div>
            </div>
          </div>

          {/* Main Dashboard Area */}
          <div className="md:col-span-2 space-y-6 md:space-y-8">
            <div className="card-style p-6 md:p-10 text-center">
              <h1 className="stat-number text-blue-600 text-3xl sm:text-4xl md:text-5xl tracking-tight normal-case">{time || '--:--:--'}</h1>
              <p className="mt-2 text-slate-400 font-medium uppercase text-[10px] tracking-widest">{date}</p>
              <p className="mt-3 text-[11px] text-slate-400 font-medium">
                Late cutoff: 9:15 AM (Philippine Time)
              </p>
            </div>

            <button
              onClick={handleTimeIn}
              disabled={loading || isAlreadyTimedIn || initLoading}
              className="btn-primary"
            >
              {loading ? 'Processing...' : isAlreadyTimedIn ? 'Already Timed In' : 'Time In'}
            </button>

            {/* Announcements */}
            {announcementLoading ? (
              <div className="card-style">
                <p className="text-slate-400 text-sm">Loading announcement...</p>
              </div>
            ) : announcementError ? (
              <div className="card-style border border-red-100">
                <p className="text-red-500 text-sm">{announcementError}</p>
              </div>
            ) : announcement ? (
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-blue-600 p-6 md:p-8 shadow-lg shadow-blue-600/20">
                <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white/5"></div>
                <div className="absolute -right-2 top-10 w-16 h-16 rounded-full bg-white/5"></div>

                <div className="relative flex items-start gap-4">
                  <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-amber-500 flex items-center justify-center text-xl">
                    📣
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="inline-block bg-amber-500 text-slate-900 text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full mb-3">
                      Announcement
                    </span>
                    <p className="text-white text-base md:text-lg font-medium whitespace-pre-wrap leading-relaxed">
                      {announcement}
                    </p>
                    {announcementUpdatedAt && (
                      <p className="text-blue-100/70 text-[11px] font-medium uppercase tracking-widest mt-4">
                        Updated: {announcementUpdatedAt}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="card-style border-2 border-dashed border-slate-200 text-center">
                <p className="text-slate-400 text-sm">Walang bagong announcement sa ngayon.</p>
              </div>
            )}

            <div className="card-style">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <h3 className="mb-0">Attendance History</h3>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    className="input-field w-full sm:w-auto"
                    value={monthFilter}
                    onChange={(e) => setMonthFilter(e.target.value)}
                  >
                    <option value="">All months</option>
                    {availableMonths.map((m) => (
                      <option key={m} value={m}>{formatMonthLabel(m)}</option>
                    ))}
                  </select>
                  {monthFilter && (
                    <button
                      onClick={() => setMonthFilter('')}
                      className="text-slate-400 text-xs font-bold hover:text-slate-600 transition whitespace-nowrap"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                {initLoading && (
                  <p className="text-slate-400 text-sm">Loading...</p>
                )}
                {!initLoading && filteredHistory.length === 0 && (
                  <p className="text-slate-400 text-sm">No attendance records{monthFilter ? ' for this month' : ''}.</p>
                )}
                {filteredHistory.map((log, index) => (
                  <div key={index} className="flex flex-wrap justify-between items-center gap-2 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <div className="font-medium text-slate-900">{new Date(log.log_date).toLocaleDateString('en-US', { weekday: 'long' })}</div>
                      <div className="label-branded mb-0">{log.log_date}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={statusTagClass(log.status)}>{log.status}</span>
                      <div className="font-semibold text-slate-700">
                        {new Date(log.time_in).toLocaleTimeString('en-US', {
                          timeZone: 'Asia/Manila',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
