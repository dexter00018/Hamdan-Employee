'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import Spinner, { LoadingRow, LoadingSection } from '@/components/Spinner';

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.8 21.8 0 0 1 5.06-6.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.8 21.8 0 0 1-3.16 4.66M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

const LATE_CUTOFF_HOUR = 9;
const LATE_CUTOFF_MINUTE = 15;

export default function EmployeeDashboard() {
  const [loading, setLoading] = useState(false);
  const [timeOutLoading, setTimeOutLoading] = useState(false);
  const [todayLog, setTodayLog] = useState<{ id: string; time_in: string | null; time_out: string | null; status: string | null } | null>(null);

  // 7PM time-out reminder -- an in-page toast, not a real push
  // notification, so it only appears while this tab is open. Uses a
  // ref for todayLog because the interval below is set up once on
  // mount and would otherwise always see the stale (null) value from
  // that first render.
  const [showTimeOutReminder, setShowTimeOutReminder] = useState(false);
  const todayLogRef = useRef(todayLog);
  const reminderDismissedRef = useRef(false);
  const soundPlayedRef = useRef(false);

  // Browsers (esp. Chrome) block audio from a freshly-created
  // AudioContext unless it was created/resumed directly inside a user
  // gesture (a click/tap). Our sounds get triggered from a timer and a
  // Realtime event -- neither counts as a gesture. The fix: create ONE
  // AudioContext and "unlock" it on the very first click/tap/keypress
  // anywhere on the page (which will already have happened long before
  // 7PM or an announcement update in normal use), then keep reusing
  // that same already-running context for every sound after that.
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const unlockAudio = () => {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
      }
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
    };

    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
    window.addEventListener('keydown', unlockAudio);

    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  useEffect(() => {
    todayLogRef.current = todayLog;
  }, [todayLog]);

  // Two-tone chime generated with the Web Audio API -- no audio file
  // needed. Browsers generally allow this once the person has already
  // interacted with the page at all (e.g. logging in, clicking
  // anything), which will already be true by 7PM in normal use.
  const playNotificationSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const now = ctx.currentTime;

      const playTone = (freq: number, start: number, duration: number, peakVolume = 0.15) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + start);
        gain.gain.exponentialRampToValueAtTime(peakVolume, now + start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + start);
        osc.stop(now + start + duration);
      };

      // Soft "pop" tone with a gentle downward pitch bend -- this is
      // what gives it that bubbly/bouncy Messenger-style feel instead
      // of a flat, robotic beep.
      const playPop = (startFreq: number, endFreq: number, start: number, duration: number, peakVolume = 0.7) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(startFreq, now + start);
        osc.frequency.exponentialRampToValueAtTime(endFreq, now + start + duration);
        gain.gain.setValueAtTime(0.0001, now + start);
        gain.gain.exponentialRampToValueAtTime(peakVolume, now + start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + start);
        osc.stop(now + start + duration);
      };

      // Two soft ascending "bloop-bloop" pops, Messenger-style: the
      // second pop is higher-pitched than the first, each with a
      // slight downward glide for that bubbly character.
      playPop(900, 700, 0, 0.28, 1.0);
      playPop(1300, 1000, 0.24, 0.4, 1.0);
    } catch (err) {
      console.error('Error playing notification sound:', err);
    }
  };

  const dismissReminder = () => {
    reminderDismissedRef.current = true;
    setShowTimeOutReminder(false);
  };
  const [message, setMessage] = useState('');
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');
  const [profile, setProfile] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [initLoading, setInitLoading] = useState(true);

  // Government ID numbers / employment details -- fetched from a
  // separate, more strictly-secured table. See add_government_ids.sql
  // and add_tin_and_hired_date.sql.
  const [governmentIds, setGovernmentIds] = useState<{ sss_number: string | null; philhealth_number: string | null; pagibig_number: string | null; tin_number: string | null; hired_date: string | null; employment_status: string | null } | null>(null);
  const [showGovIdsSection, setShowGovIdsSection] = useState(false);
  const [visibleFields, setVisibleFields] = useState<{ sss: boolean; philhealth: boolean; pagibig: boolean; tin: boolean }>({
    sss: false,
    philhealth: false,
    pagibig: false,
    tin: false,
  });

  // History filter (month picker, e.g. "2026-07")
  const [monthFilter, setMonthFilter] = useState('');

  // Announcements
  const [announcement, setAnnouncement] = useState<string>('');
  const [announcementLoading, setAnnouncementLoading] = useState(true);
  const [announcementError, setAnnouncementError] = useState<string | null>(null);
  const [announcementUpdatedAt, setAnnouncementUpdatedAt] = useState<string | null>(null);
  const [showAnnouncementToast, setShowAnnouncementToast] = useState(false);

  // Office network check -- Time In is only enabled when the request is
  // coming from the office's known public IP. See
  // app/api/check-office-network/route.ts for how this is determined.
  const [officeNetworkAllowed, setOfficeNetworkAllowed] = useState<boolean | null>(null);
  const [checkingNetwork, setCheckingNetwork] = useState(true);

  const checkOfficeNetwork = async () => {
    setCheckingNetwork(true);
    try {
      const res = await fetch('/api/check-office-network');
      const result = await res.json();
      setOfficeNetworkAllowed(!!result.allowed);
    } catch (err) {
      console.error('Error checking office network:', err);
      // Fail closed here -- if we can't verify, don't let them time in
      // and instead show the "not connected" state with a retry option.
      setOfficeNetworkAllowed(false);
    } finally {
      setCheckingNetwork(false);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-GB', { hour12: false }));
      setDate(now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));

      // Check Philippine time specifically (not the device's local
      // time) so the reminder is correct regardless of how the
      // employee's device clock/timezone is set.
      const manilaHour = parseInt(
        new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', hour12: false }).format(now),
        10
      );

      if (
        manilaHour >= 19 &&
        todayLogRef.current?.time_in &&
        !todayLogRef.current?.time_out &&
        !reminderDismissedRef.current
      ) {
        if (!soundPlayedRef.current) {
          playNotificationSound();
          soundPlayedRef.current = true;
        }
        setShowTimeOutReminder(true);
      }
    }, 1000);

    initializeDashboard();
    fetchAnnouncement();
    checkOfficeNetwork();
    return () => clearInterval(timer);
  }, []);

  // Live announcement updates -- listens for INSERT/UPDATE on the
  // announcements table via Supabase Realtime, so a new/edited
  // announcement from HR shows up (with a sound + toast) immediately,
  // without the employee needing to refresh the page. Requires Realtime
  // to be enabled for this table (see enable_announcements_realtime.sql).
  useEffect(() => {
    const channel = supabase
      .channel('employee-announcements')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcements' },
        (payload) => {
          if (payload.eventType === 'DELETE') return;

          const newRow = payload.new as { content?: string; updated_at?: string };
          setAnnouncement(newRow.content || '');
          setAnnouncementError(null);
          setAnnouncementUpdatedAt(
            newRow.updated_at
              ? new Date(newRow.updated_at).toLocaleString('en-US', {
                  timeZone: 'Asia/Manila',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : null
          );

          playNotificationSound();
          setShowAnnouncementToast(true);
          setTimeout(() => setShowAnnouncementToast(false), 6000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const initializeDashboard = async () => {
    setInitLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setInitLoading(false);
      return;
    }

    // Use the Manila calendar date, not the browser's local/UTC date --
    // otherwise an employee whose device is set to a timezone behind
    // UTC could see the wrong "today" near midnight.
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());

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

    // Government IDs live in a separate table with its own RLS -- if
    // no row exists yet (admin hasn't entered these for the employee),
    // this just comes back null and the section shows "Not set".
    const { data: govIdData, error: govIdError } = await supabase
      .from('employee_government_ids')
      .select('sss_number, philhealth_number, pagibig_number, tin_number, hired_date, employment_status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (govIdError) {
      console.error('Error fetching government IDs:', govIdError);
    }
    setGovernmentIds(govIdData ?? null);

    const { data: historyData, error: historyError } = await supabase
      .from('attendance_logs')
      .select('id, log_date, time_in, time_out, status')
      .eq('user_id', user.id)
      .order('log_date', { ascending: false });

    if (historyError) {
      console.error('Error fetching history:', historyError);
      setMessage('Error: ' + historyError.message);
    }

    setHistory(historyData || []);
    const foundTodayLog = historyData?.find(log => log.log_date === today);
    setTodayLog(foundTodayLog ?? null);
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
      setAnnouncementError('Failed to load the announcement right now.');
    } finally {
      setAnnouncementLoading(false);
    }
  };

  const handleTimeIn = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/time-in', { method: 'POST' });
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Failed to record time-in.');
      }

      setMessage(
        result.status === 'Late'
          ? 'Time in recorded, but you are marked as late today.'
          : 'Success! Attendance recorded.'
      );
      await initializeDashboard();
    } catch (err: any) {
      setMessage("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTimeOut = async () => {
    setTimeOutLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/time-out', { method: 'POST' });
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Failed to record time-out.');
      }

      setMessage('Time out recorded. See you tomorrow!');
      setShowTimeOutReminder(false);
      await initializeDashboard();
    } catch (err: any) {
      setMessage("Error: " + err.message);
    } finally {
      setTimeOutLoading(false);
    }
  };

  const statusTagClass = (s: string | null) => (s === 'Late' ? 'tag-late' : 'tag-present');

  // Masks a value except for its first 2 characters, e.g. "34" + dots
  // for the rest -- shows just enough to help the employee recognize
  // "yes, this is my number" without exposing the whole thing.
  const maskValue = (value: string) => {
    if (value.length <= 2) return value;
    return value.slice(0, 2) + '•'.repeat(value.length - 2);
  };

  // Renders one masked/unmaskable government ID row, e.g. SSS Number.
  const renderGovIdRow = (label: string, value: string | null, fieldKey: 'sss' | 'philhealth' | 'pagibig' | 'tin') => (
    <div>
      <p className="label-branded mb-1">{label}</p>
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-slate-700 tabular-nums">
          {value ? (visibleFields[fieldKey] ? value : maskValue(value)) : 'Not set'}
        </p>
        {value && (
          <button
            type="button"
            onClick={() => setVisibleFields((v) => ({ ...v, [fieldKey]: !v[fieldKey] }))}
            className="text-slate-400 hover:text-slate-600 flex-shrink-0 transition"
            aria-label={visibleFields[fieldKey] ? `Hide ${label}` : `Show ${label}`}
          >
            {visibleFields[fieldKey] ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
    </div>
  );

  // Hired Date isn't sensitive like a government ID number, so it's
  // just shown plainly -- no masking/eye icon needed.
  const formatHiredDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

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

  // Circular progress ring: on-time percentage (0-100)
  const onTimePercentage = summary.present > 0 
    ? Math.round((summary.onTime / summary.present) * 100) 
    : 0;

  const circumference = 2 * Math.PI * 45; // radius 45
  const strokeDashoffset = circumference - (onTimePercentage / 100) * circumference;

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
            <p className="label-branded mt-1">Days Present</p>
          </div>
          <div className="card-style !p-4 md:!p-6 text-center">
            <p className="stat-number text-2xl md:text-3xl text-orange-600">{summary.late}</p>
            <p className="label-branded mt-1">Late</p>
          </div>
          <div className="card-style !p-4 md:!p-6 text-center col-span-2 sm:col-span-1">
            <p className="stat-number text-2xl md:text-3xl text-green-600">{summary.onTime}</p>
            <p className="label-branded mt-1">On-Time</p>
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
              <h2 className="text-xl font-semibold text-slate-900 flex items-center justify-center gap-2 min-h-[28px]">
                {initLoading ? (
                  <>
                    <Spinner size="sm" className="text-blue-600" />
                    <span className="text-slate-400 text-base font-medium">Loading...</span>
                  </>
                ) : (
                  profile?.full_name || 'Unknown'
                )}
              </h2>
              <p className="text-blue-600 font-medium text-sm mb-6">{profile?.designation || '---'}</p>

              <div className="text-left border-t border-slate-100 pt-6">
                <p className="label-branded">Employee ID</p>
                <p className="font-medium text-slate-700">{profile?.employee_id || '---'}</p>
              </div>

              <button
                type="button"
                onClick={() => setShowGovIdsSection((s) => !s)}
                className="mt-4 text-blue-600 text-xs font-bold hover:underline"
              >
                {showGovIdsSection ? 'Hide Details' : 'See More Details'}
              </button>

              {showGovIdsSection && (
                <div className="mt-4 pt-4 border-t border-slate-100 text-left space-y-4">
                  {renderGovIdRow('SSS Number', governmentIds?.sss_number ?? null, 'sss')}
                  {renderGovIdRow('PhilHealth Number', governmentIds?.philhealth_number ?? null, 'philhealth')}
                  {renderGovIdRow('Pag-IBIG Number', governmentIds?.pagibig_number ?? null, 'pagibig')}
                  {renderGovIdRow('TIN Number', governmentIds?.tin_number ?? null, 'tin')}
                  <div>
                    <p className="label-branded mb-1">Hired Date</p>
                    <p className="font-medium text-slate-700">
                      {governmentIds?.hired_date ? formatHiredDate(governmentIds.hired_date) : 'Not set'}
                    </p>
                  </div>
                  <div>
                    <p className="label-branded mb-1">Employment Status</p>
                    {governmentIds?.employment_status ? (
                      <span className={
                        governmentIds.employment_status === 'Regular' ? 'tag-present'
                        : governmentIds.employment_status === 'Probationary' ? 'tag-late'
                        : 'tag-excused'
                      }>
                        {governmentIds.employment_status}
                      </span>
                    ) : (
                      <p className="font-medium text-slate-700">Not set</p>
                    )}
                  </div>
                </div>
              )}
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

            {!todayLog ? (
              // State 1: hasn't timed in yet today
              <button
                onClick={handleTimeIn}
                disabled={loading || initLoading || checkingNetwork || officeNetworkAllowed === false}
                className="btn-primary"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner size="sm" />
                    Processing...
                  </span>
                ) : checkingNetwork ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner size="sm" />
                    Checking network...
                  </span>
                ) : officeNetworkAllowed === false ? 'Not on Office Network'
                  : 'Time In'}
              </button>
            ) : !todayLog.time_out ? (
              // State 2: timed in, hasn't timed out yet
              <button
                onClick={handleTimeOut}
                disabled={timeOutLoading || checkingNetwork || officeNetworkAllowed === false}
                className="btn-danger"
              >
                {timeOutLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner size="sm" />
                    Processing...
                  </span>
                ) : checkingNetwork ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner size="sm" />
                    Checking network...
                  </span>
                ) : officeNetworkAllowed === false ? 'Not on Office Network'
                  : 'Time Out'}
              </button>
            ) : (
              // State 3: fully done for today
              <button disabled className="btn-primary opacity-50 cursor-not-allowed">
                Completed for Today
              </button>
            )}

            {todayLog?.time_in && (
              <p className="text-center text-slate-400 text-xs font-medium -mt-4">
                Timed in at{' '}
                {new Date(todayLog.time_in).toLocaleTimeString('en-US', {
                  timeZone: 'Asia/Manila',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
                {todayLog.time_out && (
                  <>
                    {' '}· Timed out at{' '}
                    {new Date(todayLog.time_out).toLocaleTimeString('en-US', {
                      timeZone: 'Asia/Manila',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </>
                )}
              </p>
            )}

            {!checkingNetwork && officeNetworkAllowed === false && !(todayLog?.time_out) && (
              <div className="flex items-center justify-between gap-3 -mt-4 px-1">
                <p className="text-orange-600 text-xs font-medium">
                  ⚠️ You must be connected to the office network to {todayLog ? 'time out' : 'time in'}.
                </p>
                <button
                  onClick={checkOfficeNetwork}
                  className="text-blue-600 text-xs font-bold whitespace-nowrap hover:underline"
                >
                  Check again
                </button>
              </div>
            )}

            {/* Attendance Rate Ring */}
            <div className="card-style flex flex-col items-center justify-center py-8">
              <p className="label-branded">On-Time Rate ({formatMonthLabel(summaryMonthKey)})</p>
              <div className="relative w-32 h-32 my-4">
                <svg
                  className="w-full h-full transform -rotate-90"
                  viewBox="0 0 120 120"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* Background ring */}
                  <circle
                    cx="60"
                    cy="60"
                    r="45"
                    fill="none"
                    stroke="#e6f1e6"
                    strokeWidth="8"
                  />
                  {/* Progress ring */}
                  <circle
                    cx="60"
                    cy="60"
                    r="45"
                    fill="none"
                    stroke="#2fbd6c"
                    strokeWidth="8"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                </svg>
                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="stat-number text-3xl text-green-600">{onTimePercentage}%</p>
                  <p className="text-slate-400 text-xs font-medium">On-Time</p>
                </div>
              </div>
            </div>

            {/* Announcements */}
            {announcementLoading ? (
              <div className="card-style">
                <LoadingRow label="Loading announcement..." />
              </div>
            ) : announcementError ? (
              <div className="card-style border border-red-100">
                <p className="text-red-500 text-sm">{announcementError}</p>
              </div>
            ) : announcement ? (
              <div className="card-dark">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-11 h-11 rounded-2xl bg-green-500 flex items-center justify-center text-xl">
                    📣
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="inline-block bg-green-500 text-slate-900 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3">
                      Announcement
                    </span>
                    <p className="text-white text-base md:text-lg font-medium whitespace-pre-wrap leading-relaxed">
                      {announcement}
                    </p>
                    {announcementUpdatedAt && (
                      <p className="text-green-100/70 text-[11px] font-medium uppercase tracking-widest mt-4">
                        Updated: {announcementUpdatedAt}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="card-style border-2 border-dashed border-slate-200 text-center">
                <p className="text-slate-400 text-sm">No new announcements right now.</p>
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
                {initLoading && <LoadingRow label="Loading attendance history..." />}
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
                      <div className="text-right">
                        <div className="font-semibold text-slate-700">
                          {log.time_in
                            ? new Date(log.time_in).toLocaleTimeString('en-US', {
                                timeZone: 'Asia/Manila',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })
                            : '--:--'}
                          {log.time_out && (
                            <>
                              {' '}–{' '}
                              {new Date(log.time_out).toLocaleTimeString('en-US', {
                                timeZone: 'Asia/Manila',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                            </>
                          )}
                        </div>
                        {!log.time_out && (
                          <div className="text-slate-400 text-[10px] font-medium uppercase tracking-wide">
                            No time out
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* New Announcement Toast (auto-dismisses after 6s) */}
      {showAnnouncementToast && (
        <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-6 sm:top-6 sm:max-w-sm z-50">
          <div className="rounded-2xl bg-slate-900 text-white p-4 shadow-2xl flex items-start gap-3">
            <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-green-500 flex items-center justify-center text-lg">
              📣
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">New announcement posted!</p>
              <p className="text-white/60 text-xs mt-1 line-clamp-2">{announcement}</p>
            </div>
            <button
              onClick={() => setShowAnnouncementToast(false)}
              className="text-white/40 hover:text-white flex-shrink-0"
              aria-label="Close notification"
              type="button"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 7PM Time-Out Reminder (in-page only -- disappears if tab is closed) */}
      {showTimeOutReminder && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm z-50">
          <div className="rounded-2xl bg-slate-900 text-white p-4 shadow-2xl flex items-start gap-3">
            <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-lg">
              🔔
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">Don't forget to time out!</p>
              <p className="text-white/60 text-xs mt-1">It's already past 7:00 PM.</p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleTimeOut}
                  disabled={timeOutLoading}
                  className="text-xs font-bold bg-white text-slate-900 px-3 py-1.5 rounded-full hover:bg-white/90 transition disabled:opacity-50"
                >
                  {timeOutLoading ? 'Processing...' : 'Time Out Now'}
                </button>
                <button
                  onClick={dismissReminder}
                  className="text-xs font-bold text-white/60 hover:text-white px-3 py-1.5 transition"
                >
                  Dismiss
                </button>
              </div>
            </div>
            <button
              onClick={dismissReminder}
              className="text-white/40 hover:text-white flex-shrink-0"
              aria-label="Close reminder"
              type="button"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
