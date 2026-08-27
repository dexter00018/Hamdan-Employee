'use client';
import SummaryDetailModal from '@/components/employee/modals/SummaryDetailModal';
import AttendanceDisputeFormModal from '@/components/employee/modals/AttendanceDisputeFormModal';
import LeaveChoiceModal from '@/components/employee/modals/LeaveChoiceModal';
import LeaveRequestsModal from '@/components/employee/modals/LeaveRequestsModal';
import AttendanceDisputesModal from '@/components/employee/modals/AttendanceDisputesModal';
import LeaveRequestModal from '@/components/employee/modals/LeaveRequestModal';
import EarlyTimeOutModal from '@/components/employee/modals/EarlyTimeOutModal';
import MobileBottomNav from '@/components/employee/MobileBottomNav';
import EmployeeSummaryCard from '@/components/employee/EmployeeSummaryCard';
import EmployeeQuickActions from '@/components/employee/EmployeeQuickActions';
import EmployeeDesktopSidebar from '@/components/employee/EmployeeDesktopSidebar';
import MobileAllToolsSheet from '@/components/employee/MobileAllToolsSheet';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import Spinner, { LoadingRow } from '@/components/Spinner';
import PlanMyCommuteModal from '@/components/employee/commute/PlanMyCommuteModal';
import AttendanceCalendarModal from '@/components/employee/modals/AttendanceCalendarModal';
import EmployeeDocumentsModal from '@/components/employee/modals/EmployeeDocumentsModal';
import HelpDeskModal from '@/components/employee/modals/HelpDeskModal';
import NotificationsModal from '@/components/employee/modals/NotificationsModal';
import PayslipsModal from '@/components/employee/modals/PayslipsModal';
import EmployeeDirectoryModal from '@/components/employee/modals/EmployeeDirectoryModal';
import CompanyCalendarModal from '@/components/employee/modals/CompanyCalendarModal';
import { Bell, CalendarDays, CalendarX2, CheckCircle2, CircleAlert, Clock3, HandCoins, Headphones, Plane, UserRound } from 'lucide-react';

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

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}

// Fallback values used only if app_settings hasn't loaded yet or a row
// is missing -- normal operation always uses the configurable values
// fetched from the database (editable via Super Admin -> App Settings).
const FALLBACK_LATE_CUTOFF_HOUR = 9;
const FALLBACK_LATE_CUTOFF_MINUTE = 15;
const FALLBACK_LEAVE_CREDITS = 10;
const FALLBACK_TIME_OUT_REMINDER_HOUR = 19;

export default function EmployeeDashboard() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeOutLoading, setTimeOutLoading] = useState(false);
  const [todayLog, setTodayLog] = useState<{ id: string; time_in: string | null; time_out: string | null; status: string | null } | null>(null);

  // App-wide configurable settings (late cutoff, leave credits default,
  // time-out reminder hour) -- fetched once on load from app_settings,
  // editable by Super Admin without needing a code change/redeploy.
  // Falls back to the constants above until the fetch resolves.
  const [lateCutoffHour, setLateCutoffHour] = useState(FALLBACK_LATE_CUTOFF_HOUR);
  const [lateCutoffMinute, setLateCutoffMinute] = useState(FALLBACK_LATE_CUTOFF_MINUTE);
  const [fallbackLeaveCredits, setFallbackLeaveCredits] = useState(FALLBACK_LEAVE_CREDITS);
  const [timeOutReminderHour, setTimeOutReminderHour] = useState(FALLBACK_TIME_OUT_REMINDER_HOUR);

  const fetchAppSettings = async () => {
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['late_cutoff_hour', 'late_cutoff_minute', 'default_leave_credits', 'time_out_reminder_hour']);
    if (error) {
      console.error('Error fetching app settings:', error);
      return;
    }
    const map = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
    if (typeof map.late_cutoff_hour === 'number') setLateCutoffHour(map.late_cutoff_hour);
    if (typeof map.late_cutoff_minute === 'number') setLateCutoffMinute(map.late_cutoff_minute);
    if (typeof map.default_leave_credits === 'number') setFallbackLeaveCredits(map.default_leave_credits);
    if (typeof map.time_out_reminder_hour === 'number') setTimeOutReminderHour(map.time_out_reminder_hour);
  };

  // --- Dark Mode ---
  // The root layout applies the saved theme before first paint. This state
  // mirrors that DOM class for icons and controls after hydration.
  const [darkMode, setDarkMode] = useState(false);

  const applyTheme = useCallback((nextDark: boolean) => {
    document.documentElement.classList.toggle('dark', nextDark);
    document.documentElement.style.colorScheme = nextDark ? 'dark' : 'light';
    try { localStorage.setItem('theme', nextDark ? 'dark' : 'light'); } catch { /* localStorage can be unavailable */ }
    setDarkMode(nextDark);
  }, []);

  const toggleTheme = () => applyTheme(!darkMode);

  useEffect(() => {
    queueMicrotask(() => setDarkMode(document.documentElement.classList.contains('dark')));
    const syncTheme = (event: StorageEvent) => {
      if (event.key === 'theme' && (event.newValue === 'dark' || event.newValue === 'light')) {
        applyTheme(event.newValue === 'dark');
      }
    };
    window.addEventListener('storage', syncTheme);
    return () => window.removeEventListener('storage', syncTheme);
  }, [applyTheme]);

  // 7PM time-out reminder -- an in-page toast, not a real push
  // notification, so it only appears while this tab is open. Uses a
  // ref for todayLog because the interval below is set up once on
  // mount and would otherwise always see the stale (null) value from
  // that first render.
  const [showTimeOutReminder, setShowTimeOutReminder] = useState(false);
  const todayLogRef = useRef(todayLog);
  const timeOutReminderHourRef = useRef(timeOutReminderHour);
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

  useEffect(() => {
    timeOutReminderHourRef.current = timeOutReminderHour;
  }, [timeOutReminderHour]);

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

      // A limiter/compressor so we can safely push the individual tone
      // volumes higher for a louder chime, without the peaks clipping
      // into harsh distortion the way a raw gain increase would.
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-14, now);
      compressor.knee.setValueAtTime(6, now);
      compressor.ratio.setValueAtTime(12, now);
      compressor.attack.setValueAtTime(0.003, now);
      compressor.release.setValueAtTime(0.15, now);
      compressor.connect(ctx.destination);

      const playTone = (_freq: number, _start: number, _duration: number, _peakVolume = 0.15) => {
        // reserved for future use
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
        gain.connect(compressor);
        osc.start(now + start);
        osc.stop(now + start + duration);
      };

      // Two soft ascending "bloop-bloop" pops, Messenger-style: the
      // second pop is higher-pitched than the first, each with a
      // slight downward glide for that bubbly character. Volumes go
      // through the compressor above, so pushing these past 1.0 makes
      // it louder without distorting.
      playPop(900, 700, 0, 0.28, 1.8);
      playPop(1300, 1000, 0.24, 0.4, 1.8);
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

  // History filter (month picker, e.g. "2026-07:H1") -- defaults to the
  // current cutoff period so employees land on "this cutoff" instead of
  // their entire history.
  const [monthFilter, setMonthFilter] = useState(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const half = now.getDate() <= 15 ? 'H1' : 'H2';
    return `${ym}:${half}`;
  });

  // Collapsed by default so the dashboard opens short and uncluttered;
  // the employee taps to expand when they actually want to look at it.
  const [attendanceHistoryOpen, setAttendanceHistoryOpen] = useState(false);

  // Announcements
  const [announcement, setAnnouncement] = useState<string>('');
  const [announcementImageUrl, setAnnouncementImageUrl] = useState<string | null>(null);
  const [announcementLoading, setAnnouncementLoading] = useState(true);
  const [announcementError, setAnnouncementError] = useState<string | null>(null);
  const [announcementUpdatedAt, setAnnouncementUpdatedAt] = useState<string | null>(null);
  const [showAnnouncementToast, setShowAnnouncementToast] = useState(false);
  const [disputeResultToast, setDisputeResultToast] = useState<{ status: string; date: string; disputeType: string } | null>(null);

  // AI Weather & Commute Advisory
  // n8n writes the latest advisory to `weather_advisories`; employees only
  // read the latest active row. The weather provider/API key never needs to
  // be exposed in the browser.
  const [weatherAdvisory, setWeatherAdvisory] = useState<{
    id: string;
    location_name: string;
    advisory_date: string;
    headline: string;
    message: string;
    severity: 'normal' | 'info' | 'watch' | 'warning' | 'critical';
    temperature_c: number | null;
    precipitation_probability: number | null;
    weather_code: number | null;
    commute_window: string | null;
    source_name: string | null;
    generated_at: string;
  } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [commuteModalOpen, setCommuteModalOpen] = useState(false);

  const fetchWeatherAdvisory = async () => {
    setWeatherLoading(true);
    try {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
      const { data, error } = await supabase
        .from('weather_advisories')
        .select('id, location_name, advisory_date, headline, message, severity, temperature_c, precipitation_probability, weather_code, commute_window, source_name, generated_at')
        .eq('is_active', true)
        .eq('advisory_date', today)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setWeatherAdvisory((data as any) ?? null);
    } catch (err) {
      console.error('Error fetching weather advisory:', err);
      setWeatherAdvisory(null);
    } finally {
      setWeatherLoading(false);
    }
  };

  const openCommuteChecker = () => {
    setCommuteModalOpen(true);
  };

  // Office network check -- Time In is only enabled  // Office network check -- Time In is only enabled when the request is
  // coming from the office's known public IP. See
  // app/api/check-office-network/route.ts for how this is determined.
  const [officeNetworkAllowed, setOfficeNetworkAllowed] = useState<boolean | null>(null);
  const [checkingNetwork, setCheckingNetwork] = useState(true);
  const [officeNetworkIssue, setOfficeNetworkIssue] = useState<'outside' | 'unavailable' | null>(null);

  const checkOfficeNetwork = async () => {
    setCheckingNetwork(true);
    setOfficeNetworkIssue(null);
    try {
      const res = await fetch('/api/check-office-network', { cache: 'no-store' });
      const result = await res.json();
      if (result.allowed) {
        setOfficeNetworkAllowed(true);
        setOfficeNetworkIssue(null);
      } else {
        setOfficeNetworkAllowed(false);
        setOfficeNetworkIssue(
          result.code === 'ATTENDANCE_NETWORK_UNAVAILABLE' || res.status === 503
            ? 'unavailable'
            : 'outside'
        );
      }
    } catch (err) {
      console.error('Error checking office network:', err);
      // Fail closed when the network cannot be verified. Only attendance
      // recording is disabled; the rest of the employee portal stays usable.
      setOfficeNetworkAllowed(false);
      setOfficeNetworkIssue('unavailable');
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
        manilaHour >= timeOutReminderHourRef.current &&
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

    const runStartupSweeps = async () => {
      // Catch-up sweeps, run once per login/page load, before pulling
      // attendance history or the leave credit balance -- so anything they
      // generate (a fresh 'Absent' row for a day with no time-in, a
      // newly-deducted leave credit) is already reflected in what loads
      // right after.
      const [{ error: leaveSweepError }, { error: absenceSweepError }] = await Promise.all([
        supabase.rpc('settle_overdue_leave_days'),
        supabase.rpc('settle_overdue_absences'),
      ]);
      if (leaveSweepError) console.error('Error settling overdue leave days:', leaveSweepError);
      if (absenceSweepError) console.error('Error settling overdue absences:', absenceSweepError);

      initializeDashboard();
      fetchLeaveCredits();
    };
    runStartupSweeps();
    fetchAppSettings();
    fetchAnnouncement();
    fetchWeatherAdvisory();
    checkOfficeNetwork();
    fetchMyDisputes();
    fetchPayslips();
    fetchMyLeaves();
    fetchCompanyHolidays();
    fetchSupportRequests();
    fetchEmployeeDocuments();
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

          const newRow = payload.new as { content?: string; image_url?: string; updated_at?: string };
          setAnnouncement(newRow.content || '');
          setAnnouncementImageUrl(newRow.image_url || null);
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

  // Live dispute + leave status updates via Supabase Realtime.
  // Runs only once currentUserId is known (set during initializeDashboard),
  // so .on() and .subscribe() are always called synchronously — no async gap.
  useEffect(() => {
    if (!currentUserId) return;

    const disputeChannel = supabase
      .channel('employee-dispute-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'attendance_disputes', filter: `user_id=eq.${currentUserId}` },
        (payload) => {
          const newRow = payload.new as { status?: string; dispute_date?: string; dispute_type?: string };
          if (newRow.status === 'Approved' || newRow.status === 'Rejected') {
            setDisputeResultToast({ status: newRow.status, date: newRow.dispute_date || '', disputeType: newRow.dispute_type || 'TimeIn' });
            playNotificationSound();
            fetchMyDisputes();
            initializeDashboard();
            setTimeout(() => setDisputeResultToast(null), 8000);
          }
        }
      )
      .subscribe();

    const leaveChannel = supabase
      .channel('employee-leave-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'leave_requests', filter: `user_id=eq.${currentUserId}` },
        (payload) => {
          const newRow = payload.new as { status?: string; leave_type?: string };
          if (newRow.status === 'Approved' || newRow.status === 'Rejected') {
            setLeaveResultToast({ status: newRow.status, leave_type: newRow.leave_type || 'Leave' });
            playNotificationSound();
            fetchMyLeaves();
            fetchLeaveCredits();
            setTimeout(() => setLeaveResultToast(null), 8000);
          }
        }
      )
      .subscribe();

    const supportChannel = supabase
      .channel('employee-support-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'employee_support_requests', filter: `user_id=eq.${currentUserId}` },
        () => {
          fetchSupportRequests();
          playNotificationSound();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(disputeChannel);
      supabase.removeChannel(leaveChannel);
      supabase.removeChannel(supportChannel);
    };
  }, [currentUserId]);

  // Weather advisories are generated by n8n, but the Employee Dashboard
  // updates immediately when n8n inserts/updates today's row.
  useEffect(() => {
    const channel = supabase
      .channel('employee-weather-advisories')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'weather_advisories' },
        () => fetchWeatherAdvisory()
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
    setCurrentUserId(user.id);

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
        .select('content, image_url, updated_at')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      setAnnouncement(data?.content || '');
      setAnnouncementImageUrl(data?.image_url || null);
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

  // Called when the employee clicks Time Out.
  // If it's before 7PM Manila time, show a warning first.
  const handleTimeOutClick = () => {
    const now = new Date();
    const manilaHour = parseInt(
      new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', hour12: false }).format(now),
      10
    );
    if (manilaHour < timeOutReminderHour) {
      setShowEarlyTimeOutWarning(true);
    } else {
      handleTimeOut();
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

  // Type-specific leave statuses (e.g. "Sick Leave", "Vacation Leave",
  // "Emergency Leave") all get the same tag styling as the old generic
  // "Leave" status -- match by substring instead of exact equality.
  const statusTagClass = (s: string | null) => {
    const v = s?.toLowerCase() ?? '';
    if (v === 'late') return 'tag-late';
    if (v === 'absent') return 'tag-absent';
    if (v.includes('leave')) return 'tag-leave';
    return 'tag-present';
  };

  // --- Early time-out warning (before 7PM) ---
  const [showEarlyTimeOutWarning, setShowEarlyTimeOutWarning] = useState(false);

  // --- Employee Directory ---
  // Read-only list of colleagues -- employees only (no HR admins or
  // super-admins), showing name, designation, photo, and email so an
  // employee can look someone up. Pulls straight from `profiles`; the
  // government-ID table (SSS/PhilHealth/etc.) is a separate, more
  // strictly-secured table and is never touched here.
  const [directoryModalOpen, setDirectoryModalOpen] = useState(false);
  const [directoryEmployees, setDirectoryEmployees] = useState<{ id: string; full_name: string | null; designation: string | null; avatar_url: string | null; employee_email: string | null }[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [directorySearch, setDirectorySearch] = useState('');

  const fetchDirectory = async () => {
    setDirectoryLoading(true);
    // NOTE: this selects OTHER employees' basic profile info, not just the
    // logged-in user's own row -- make sure the `profiles` table's RLS
    // has a SELECT policy that lets any authenticated user read these
    // columns (full_name, designation, avatar_url, employee_email, role)
    // for all rows, e.g.:
    //   create policy "Employees can view the directory"
    //   on profiles for select
    //   to authenticated
    //   using (true);
    // (Sensitive fields like SSS/PhilHealth/TIN live in
    // employee_government_ids, a separate table, and are unaffected.)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, designation, avatar_url, employee_email, role')
      // Employees only -- HR admins and the super-admin account don't
      // belong in a colleague directory.
      .eq('role', 'employee')
      .order('full_name', { ascending: true });

    if (error) {
      console.error('Error fetching directory:', error);
      setDirectoryLoading(false);
      return;
    }
    setDirectoryEmployees(data || []);
    setDirectoryLoading(false);
  };

  // --- Company Calendar (Holidays) ---
  // Read-only view of the holidays HR has set up (the same `holidays`
  // table Super Admin manages). NOTE: like the Directory above, this
  // selects rows the logged-in employee doesn't own, so `holidays` needs
  // a SELECT policy allowing any authenticated user to read it, e.g.:
  //   create policy "Employees can view holidays"
  //   on holidays for select
  //   to authenticated
  //   using (true);
  const [companyHolidays, setCompanyHolidays] = useState<{ id: string; holiday_date: string; name: string }[]>([]);
  const [holidaysLoading, setHolidaysLoading] = useState(true);
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);

  const fetchCompanyHolidays = async () => {
    setHolidaysLoading(true);
    const { data, error } = await supabase
      .from('holidays')
      .select('id, holiday_date, name')
      .order('holiday_date', { ascending: true });

    if (error) {
      console.error('Error fetching holidays:', error);
      setHolidaysLoading(false);
      return;
    }
    setCompanyHolidays(data || []);
    setHolidaysLoading(false);
  };

  const directoryInitials = (name: string | null) =>
    (name || '?')
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  const filteredDirectory = useMemo(() => {
    const q = directorySearch.trim().toLowerCase();
    if (!q) return directoryEmployees;
    return directoryEmployees.filter((e) =>
      e.full_name?.toLowerCase().includes(q) ||
      e.designation?.toLowerCase().includes(q)
    );
  }, [directoryEmployees, directorySearch]);

  // --- Payslips modal ---
  const [payslipsModalOpen, setPayslipsModalOpen] = useState(false);
  const [payslips, setPayslips] = useState<{ id: string; cutoff_label: string; cutoff_period: string; file_name: string; file_path: string; uploaded_at: string; published_at: string | null; acknowledged_at: string | null }[]>([]);
  const [payslipsLoading, setPayslipsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [acknowledgingPayslipId, setAcknowledgingPayslipId] = useState<string | null>(null);

  const fetchPayslips = async () => {
    setPayslipsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPayslipsLoading(false); return; }
    const { data, error } = await supabase
      .from('payslips')
      .select('id, cutoff_label, cutoff_period, file_name, file_path, uploaded_at, published_at, acknowledged_at')
      .eq('user_id', user.id)
      .eq('published', true)
      .order('uploaded_at', { ascending: false });
    if (error) console.error('Error fetching payslips:', error);
    setPayslips((data || []) as typeof payslips);
    setPayslipsLoading(false);
  };

  const acknowledgePayslip = async (payslipId: string) => {
    setAcknowledgingPayslipId(payslipId);
    const acknowledgedAt = new Date().toISOString();
    const { error } = await supabase.rpc('acknowledge_my_payslip', {
      p_payslip_id: payslipId,
    });
    if (error) {
      alert('Unable to acknowledge this payslip: ' + error.message);
    } else {
      setPayslips((current) => current.map((p) => p.id === payslipId ? { ...p, acknowledged_at: acknowledgedAt } : p));
    }
    setAcknowledgingPayslipId(null);
  };

  const downloadPayslip = async (payslip: { id: string; file_path: string; file_name: string }) => {
    setDownloadingId(payslip.id);
    try {
      const { data, error } = await supabase.storage
        .from('payslips')
        .download(payslip.file_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = payslip.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Error downloading payslip:', err);
      alert('Failed to download payslip: ' + err.message);
    } finally {
      setDownloadingId(null);
    }
  };

  // --- Help Desk / HR Requests ---
  type SupportRequest = {
    id: string;
    category: string;
    subject: string;
    description: string;
    status: 'Submitted' | 'In Progress' | 'Resolved';
    hr_notes: string | null;
    created_at: string;
    updated_at: string;
  };
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([]);
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportSaving, setSupportSaving] = useState(false);
  const [supportMessage, setSupportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [supportForm, setSupportForm] = useState({ category: 'IT Concern', subject: '', description: '' });

  const fetchSupportRequests = async () => {
    setSupportLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSupportLoading(false); return; }
    const { data, error } = await supabase
      .from('employee_support_requests')
      .select('id, category, subject, description, status, hr_notes, created_at, updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) console.error('Error fetching support requests:', error);
    setSupportRequests((data || []) as SupportRequest[]);
    setSupportLoading(false);
  };

  const submitSupportRequest = async () => {
    if (!supportForm.subject.trim() || !supportForm.description.trim()) {
      setSupportMessage({ type: 'error', text: 'Please enter a subject and description.' });
      return;
    }
    setSupportSaving(true);
    setSupportMessage(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSupportMessage({ type: 'error', text: 'You are not logged in.' });
      setSupportSaving(false);
      return;
    }
    const { error } = await supabase.from('employee_support_requests').insert([{
      user_id: user.id,
      category: supportForm.category,
      subject: supportForm.subject.trim(),
      description: supportForm.description.trim(),
    }]);
    if (error) {
      setSupportMessage({ type: 'error', text: error.message });
    } else {
      setSupportMessage({ type: 'success', text: 'Request submitted. HR or IT can now review it.' });
      setSupportForm({ category: 'IT Concern', subject: '', description: '' });
      await fetchSupportRequests();
    }
    setSupportSaving(false);
  };

  // --- Employee Documents ---
  type EmployeeDocument = {
    id: string;
    title: string;
    category: string;
    file_name: string;
    file_path: string;
    published_at: string;
  };
  const [documentsModalOpen, setDocumentsModalOpen] = useState(false);
  const [employeeDocuments, setEmployeeDocuments] = useState<EmployeeDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [downloadingDocumentId, setDownloadingDocumentId] = useState<string | null>(null);

  const fetchEmployeeDocuments = async () => {
    setDocumentsLoading(true);
    const { data, error } = await supabase
      .from('employee_documents')
      .select('id, title, category, file_name, file_path, published_at')
      .eq('is_active', true)
      .order('published_at', { ascending: false });
    if (error) console.error('Error fetching employee documents:', error);
    setEmployeeDocuments((data || []) as EmployeeDocument[]);
    setDocumentsLoading(false);
  };

  const downloadEmployeeDocument = async (document: EmployeeDocument) => {
    setDownloadingDocumentId(document.id);
    const { data, error } = await supabase.storage
      .from('employee-documents')
      .download(document.file_path);
    if (error) {
      alert('Unable to download this document: ' + error.message);
    } else {
      const url = URL.createObjectURL(data);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = document.file_name;
      anchor.click();
      URL.revokeObjectURL(url);
    }
    setDownloadingDocumentId(null);
  };

  // --- Leave Requests ---
  const [myLeaves, setMyLeaves] = useState<any[]>([]);
  const [myLeavesModalOpen, setMyLeavesModalOpen] = useState(false);
  const [leaveCredits, setLeaveCredits] = useState<{ total_credits: number; used_credits: number } | null>(null);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  // Single "Leave" quick action opens this small choice screen first --
  // "Request Leave" or "My Leave Requests" -- instead of two separate
  // buttons on the dashboard.
  const [leaveChoiceModalOpen, setLeaveChoiceModalOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ leave_type: 'Sick', start_date: '', end_date: '', reason: '' });
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [leaveMsg, setLeaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [leaveResultToast, setLeaveResultToast] = useState<{ status: string; leave_type: string } | null>(null);
  // Which leave request is currently expanded into the detail view inside
  // the "My Leave Requests" modal (null = showing the list).
  const [selectedMyLeaveDetail, setSelectedMyLeaveDetail] = useState<any>(null);
  const isRegular = governmentIds?.employment_status === 'Regular';
  // Configurable default (Super Admin -> App Settings) -- matches the
  // DB column default and the fallback used server-side in
  // settle_leave_day() when a leave_credits row doesn't exist yet for
  // the employee/year.
  const remainingCredits = leaveCredits ? leaveCredits.total_credits - leaveCredits.used_credits : fallbackLeaveCredits;

  const fetchMyLeaves = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from('leave_requests')
      .select('id, leave_type, start_date, end_date, reason, status, hr_notes, created_at, reviewed_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) { console.error('Error fetching leaves:', error); return; }
    setMyLeaves(data || []);
  };

  const fetchLeaveCredits = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const year = new Date().getFullYear();
    const { data } = await supabase
      .from('leave_credits')
      .select('total_credits, used_credits')
      .eq('user_id', user.id)
      .eq('year', year)
      .maybeSingle();
    setLeaveCredits(data ?? null);
  };

  const submitLeave = async () => {
    if (!leaveForm.start_date || !leaveForm.end_date) {
      setLeaveMsg({ type: 'error', text: 'Please fill in the start and end date.' });
      return;
    }
    if (leaveForm.end_date < leaveForm.start_date) {
      setLeaveMsg({ type: 'error', text: 'End date cannot be before start date.' });
      return;
    }
    setLeaveSaving(true);
    setLeaveMsg(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You are not logged in.');
      const { error } = await supabase.from('leave_requests').insert([{
        user_id: user.id,
        leave_type: leaveForm.leave_type,
        start_date: leaveForm.start_date,
        end_date: leaveForm.end_date,
        reason: leaveForm.reason.trim() || null,
      }]);
      if (error) throw error;
      setLeaveMsg({ type: 'success', text: 'Leave request submitted! HR will review it soon.' });
      await fetchMyLeaves();
      setTimeout(() => setLeaveModalOpen(false), 1200);
    } catch (err: any) {
      console.error('Error submitting leave:', err);
      setLeaveMsg({ type: 'error', text: err?.message || 'Failed to submit leave request.' });
    } finally {
      setLeaveSaving(false);
    }
  };

  const cancelLeave = async (leaveId: string) => {
    if (!confirm('Cancel this leave request?')) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { alert('You are not logged in.'); return; }
    const { error } = await supabase
      .from('leave_requests')
      .delete()
      .eq('id', leaveId)
      .eq('user_id', user.id)
      .eq('status', 'Pending');
    if (error) { alert('Failed to cancel: ' + error.message); return; }
    await fetchMyLeaves();
  };

  const companyHolidayDateSet = useMemo(
    () => new Set(companyHolidays.map((holiday) => holiday.holiday_date)),
    [companyHolidays]
  );

  // Count chargeable leave days: Monday-Friday, excluding company holidays.
  const countLeaveDays = (start: string, end: string) => {
    if (!start || !end || end < start) return 0;
    let count = 0;
    const [sy, sm, sd] = start.split('-').map(Number);
    const [ey, em, ed] = end.split('-').map(Number);
    const d = new Date(Date.UTC(sy, sm - 1, sd));
    const endDate = new Date(Date.UTC(ey, em - 1, ed));
    while (d <= endDate) {
      const day = d.getUTCDay();
      const dateKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      if (day !== 0 && day !== 6 && !companyHolidayDateSet.has(dateKey)) count++;
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return count;
  };

  const countLeaveHolidays = (start: string, end: string) => {
    if (!start || !end || end < start) return 0;
    return companyHolidays.filter((holiday) => holiday.holiday_date >= start && holiday.holiday_date <= end).length;
  };

  // --- Attendance Disputes ---
  // Employees can dispute a day tagged "Late" (claiming they actually
  // arrived earlier), a day with no time-in at all (they forgot to time
  // in), or a day where they timed in but forgot to time out. All three
  // go through the same request table; HR approves/rejects.
  const [myDisputes, setMyDisputes] = useState<any[]>([]);
  const [myDisputesModalOpen, setMyDisputesModalOpen] = useState(false);
  // Which dispute is currently expanded into the detail view inside the
  // "My Disputes" modal (null = showing the list).
  const [selectedMyDisputeDetail, setSelectedMyDisputeDetail] = useState<any>(null);
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  // Three-step flow:
  // "choice"  -> pick Time In or Time Out dispute (only shown when the
  //              modal was opened generically, i.e. type isn't locked yet)
  // "form"    -> fill in date / time / reason
  // "confirm" -> review everything highlighted before actually submitting
  const [disputeStep, setDisputeStep] = useState<'choice' | 'form' | 'confirm'>('form');
  const [disputeForm, setDisputeForm] = useState<{ attendanceLogId: string | null; date: string; timeLocal: string; reason: string; type: 'TimeIn' | 'TimeOut' }>({
    attendanceLogId: null,
    date: '',
    timeLocal: '',
    reason: '',
    type: 'TimeIn',
  });
  const [disputeSaving, setDisputeSaving] = useState(false);
  const [cancelingDisputeId, setCancelingDisputeId] = useState<string | null>(null);
  const [disputeMsg, setDisputeMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchMyDisputes = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from('attendance_disputes')
      .select('id, attendance_log_id, dispute_date, dispute_type, claimed_time_in, original_time_in, claimed_time_out, original_time_out, reason, status, hr_notes, created_at, reviewed_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching disputes:', error);
      return;
    }
    setMyDisputes(data || []);
  };

  const cancelDispute = async (disputeId: string) => {
    if (!confirm('Cancel this pending attendance dispute?')) return;
    setCancelingDisputeId(disputeId);
    try {
      const { error } = await supabase.rpc('cancel_my_attendance_dispute', { p_dispute_id: disputeId });
      if (error) throw error;
      setMyDisputes((current) => current.filter((dispute) => dispute.id !== disputeId));
      setSelectedMyDisputeDetail(null);
      await fetchMyDisputes();
    } catch (error: any) {
      alert('Failed to cancel dispute: ' + (error?.message || 'Please try again.'));
    } finally {
      setCancelingDisputeId(null);
    }
  };

  // Opens the dispute modal. If a log already exists for that day
  // (disputing a wrong "Late" tag, or a missed time-out), pass it in;
  // otherwise leave it null (the "I forgot to time in" case) and just
  // prefill the date. `type` controls which field (time-in or time-out)
  // is being disputed. `locked` = true means this was opened from a
  // specific row (Late tag / missed time-out link) and the type can't
  // be switched; false means it was opened from the generic
  // "+ Missed time-in / time-out" action and the employee can toggle
  // between the two.
  const openDisputeModal = (attendanceLogId: string | null, date: string, type: 'TimeIn' | 'TimeOut' = 'TimeIn', locked: boolean = true) => {
    disputeTypeLocked.current = locked;
    setDisputeForm({ attendanceLogId, date, timeLocal: '', reason: '', type });
    setDisputeMsg(null);
    // Locked (opened from a specific row -- type already known): skip
    // straight to the form. Unlocked (generic "+ Missed time-in /
    // time-out" action): make the employee choose the type first.
    setDisputeStep(locked ? 'form' : 'choice');
    setDisputeModalOpen(true);
  };

  const hasPendingDispute = (dateStr: string, type: 'TimeIn' | 'TimeOut') =>
    myDisputes.some((d) => d.dispute_date === dateStr && d.status === 'Pending' && (d.dispute_type || 'TimeIn') === type);

  // Human-friendly label + before/after times for a dispute, regardless
  // of whether it's a TimeIn or TimeOut dispute -- shared by the "My
  // Disputes" list and its detail view.
  const disputeTypeLabel = (d: any) => {
    const dType = d.dispute_type || 'TimeIn';
    if (dType === 'TimeOut') return 'Missed time-out';
    return d.attendance_log_id ? 'Late tag dispute' : 'Missed time-in';
  };
  const disputeOriginal = (d: any) => ((d.dispute_type || 'TimeIn') === 'TimeOut' ? d.original_time_out : d.original_time_in);
  const disputeClaimed = (d: any) => ((d.dispute_type || 'TimeIn') === 'TimeOut' ? d.claimed_time_out : d.claimed_time_in);
  const disputeFieldLabel = (d: any) => ((d.dispute_type || 'TimeIn') === 'TimeOut' ? 'Time-Out' : 'Time-In');
  const formatDisputeTimePh = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' });

  // Whether the currently-open dispute modal was launched from a
  // specific row (Late tag / missed time-out link -- type is fixed) or
  // from the generic "Dispute" action, where the employee picks the
  // type themselves on the "choice" screen (type is toggleable). When
  // toggleable, both a date change and a type change re-look-up that
  // day's log from already-loaded history and attach its id when one
  // applies -- e.g. correcting an existing "Late" log's time-in, or
  // adding a missing time-out to a day that already has a time-in.
  const disputeTypeLocked = useRef(true);

  // Given a target date + dispute type, figures out which existing
  // attendance_logs row (if any) this dispute should be tied to.
  // - TimeOut: only makes sense if that date's log already has a
  //   time-in on record (nothing to attach a missed time-out to
  //   otherwise).
  // - TimeIn: if a log already exists for that date (e.g. tagged
  //   "Late"), we're correcting it; otherwise this is a brand-new
  //   missed time-in entry (attendanceLogId stays null, which the
  //   dispute-approval flow treats as "create a new log").
  const resolveDisputeLogId = (dateStr: string, type: 'TimeIn' | 'TimeOut') => {
    if (!dateStr) return null;
    const match = history.find((h) => h.log_date === dateStr);
    if (type === 'TimeOut') return match?.time_in ? match.id : null;
    return match?.id ?? null;
  };

  const handleDisputeDateChange = (newDate: string) => {
    if (disputeTypeLocked.current) {
      setDisputeForm((f) => ({ ...f, date: newDate }));
      return;
    }
    setDisputeForm((f) => ({ ...f, date: newDate, attendanceLogId: resolveDisputeLogId(newDate, f.type) }));
  };

  // Only ever called from the toggleable (non-locked) modal.
  const handleDisputeTypeChange = (type: 'TimeIn' | 'TimeOut') => {
    setDisputeForm((f) => ({ ...f, type, attendanceLogId: resolveDisputeLogId(f.date, type) }));
  };

  // Called from the "choice" step -- sets the chosen type (reusing the
  // same lookup logic as handleDisputeTypeChange) then advances to the
  // form step where the employee fills in date/time/reason.
  const selectDisputeType = (type: 'TimeIn' | 'TimeOut') => {
    handleDisputeTypeChange(type);
    setDisputeMsg(null);
    setDisputeStep('form');
  };

  // Same cutoffs used everywhere else in this file (configurable late
  // cutoff, configurable time-out cutoff -- Super Admin -> App
  // Settings) -- used here to decide whether each option on the
  // "choice" screen is actually worth disputing.
  const isTimeInOnTime = (timeInIso: string) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date(timeInIso)).reduce((acc: any, p) => { acc[p.type] = p.value; return acc; }, {});
    const minutesSinceMidnight = parseInt(parts.hour, 10) * 60 + parseInt(parts.minute, 10);
    return minutesSinceMidnight < lateCutoffHour * 60 + lateCutoffMinute;
  };

  const isTimeOutComplete = (timeOutIso: string) => {
    const manilaHour = parseInt(
      new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', hour12: false }).format(new Date(timeOutIso)),
      10
    );
    return manilaHour >= timeOutReminderHour;
  };

  // Whether each dispute type is actually worth offering on the "choice"
  // screen for the date currently selected. If no date is chosen yet
  // (e.g. opened via the generic top button before the form is filled
  // in), both stay enabled -- there's nothing to check against yet.
  const disputeChoiceEligibility = useMemo(() => {
    if (!disputeForm.date) {
      return {
        timeIn: { eligible: true, reason: '' },
        timeOut: { eligible: true, reason: '' },
      };
    }
    const match = history.find((h) => h.log_date === disputeForm.date);

    const timeIn = match?.time_in && isTimeInOnTime(match.time_in)
      ? { eligible: false, reason: 'Already on time -- nothing to dispute.' }
      : { eligible: true, reason: '' };

    const timeOut = !match?.time_in
      ? { eligible: false, reason: 'No time-in recorded yet for this date.' }
      : match?.time_out && isTimeOutComplete(match.time_out)
        ? { eligible: false, reason: 'Already timed out -- nothing to dispute.' }
        : { eligible: true, reason: '' };

    return { timeIn, timeOut };
  }, [disputeForm.date, history, lateCutoffHour, lateCutoffMinute, timeOutReminderHour]);

  // Validates the form and, if everything checks out, moves to the
  // highlighted review/confirm screen instead of submitting right away.
  const proceedToDisputeConfirm = () => {
    if (!disputeForm.date || !disputeForm.timeLocal) {
      setDisputeMsg({ type: 'error', text: disputeForm.type === 'TimeOut' ? 'Please fill in the date and the time you actually left.' : 'Please fill in the date and the time you actually arrived.' });
      return;
    }
    if (disputeForm.type === 'TimeOut' && !disputeForm.attendanceLogId) {
      setDisputeMsg({ type: 'error', text: "You don't have a time-in recorded on that date yet, so there's no time-out to correct. File a missed time-in dispute for that date first." });
      return;
    }
    setDisputeMsg(null);
    setDisputeStep('confirm');
  };

  const submitDispute = async () => {
    if (!disputeForm.date || !disputeForm.timeLocal) {
      setDisputeMsg({ type: 'error', text: disputeForm.type === 'TimeOut' ? 'Please fill in the date and the time you actually left.' : 'Please fill in the date and the time you actually arrived.' });
      return;
    }
    if (disputeForm.type === 'TimeOut' && !disputeForm.attendanceLogId) {
      setDisputeMsg({ type: 'error', text: "You don't have a time-in recorded on that date yet, so there's no time-out to correct. File a missed time-in dispute for that date first." });
      return;
    }
    setDisputeSaving(true);
    setDisputeMsg(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You are not logged in.');

      // disputeForm.timeLocal is a PH wall-clock time like "08:05";
      // combine with the date and convert to a real UTC timestamp,
      // same +08:00 fixed-offset approach used elsewhere in the app.
      const claimedTimeISO = new Date(`${disputeForm.date}T${disputeForm.timeLocal}:00+08:00`).toISOString();

      // Snapshot what time_in/time_out currently is (if a log already
      // exists for this day), so we can show a clear "before -> after"
      // comparison even after HR approves and the real record gets
      // overwritten.
      const existingLog = disputeForm.attendanceLogId
        ? history.find((h) => h.id === disputeForm.attendanceLogId)
        : null;

      const payload: Record<string, any> = {
        attendance_log_id: disputeForm.attendanceLogId,
        user_id: user.id,
        dispute_date: disputeForm.date,
        dispute_type: disputeForm.type,
        reason: disputeForm.reason.trim() || null,
      };

      if (disputeForm.type === 'TimeOut') {
        payload.claimed_time_out = claimedTimeISO;
        payload.original_time_out = existingLog?.time_out ?? null;
      } else {
        payload.claimed_time_in = claimedTimeISO;
        payload.original_time_in = existingLog?.time_in ?? null;
      }

      const { error } = await supabase.from('attendance_disputes').insert([payload]);

      if (error) throw error;

      setDisputeMsg({ type: 'success', text: 'Dispute submitted! HR will review it soon.' });
      await fetchMyDisputes();
      setTimeout(() => setDisputeModalOpen(false), 1200);
    } catch (err: any) {
      console.error('Error submitting dispute:', err);
      const msg = err?.message?.includes('one_pending_dispute_per_user_date')
        ? 'You already have a pending dispute for this date.'
        : (err?.message || 'Failed to submit dispute.');
      setDisputeMsg({ type: 'error', text: msg });
    } finally {
      setDisputeSaving(false);
    }
  };

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
  //
  // Period key format: "YYYY-MM:ALL" (whole month), "YYYY-MM:H1"
  // (days 1-15), or "YYYY-MM:H2" (days 16 to end of month).
  const matchesCutoff = (logDate: string | undefined, cutoffKey: string) => {
    if (!logDate || !cutoffKey) return false;
    const [ym, half] = cutoffKey.split(':');
    if (!logDate.startsWith(ym)) return false;
    if (half === 'ALL') return true;
    const day = parseInt(logDate.split('-')[2], 10);
    return half === 'H1' ? day <= 15 : day >= 16;
  };

  const currentCutoffKey = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const half = now.getDate() <= 15 ? 'H1' : 'H2';
    return `${ym}:${half}`;
  }, []);

  // Today's date in Manila -- used to decide whether a "no time out"
  // row is eligible for a missed-time-out dispute (only past days;
  // today's row already has its own Time Out button/reminder).
  const todayManila = useMemo(
    () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date()),
    []
  );

  const upcomingApprovedLeaves = myLeaves
    .filter((leave) => leave.status === 'Approved' && leave.end_date >= todayManila)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 3);

  // --- Attendance Streak badge ---
  // Counts consecutive work days (most recent first) that are neither
  // "Late" nor "Absent" -- an approved Leave day doesn't break the streak,
  // it's just skipped over.
  const attendanceStreak = useMemo(() => {
    const sorted = [...history]
      .filter((l) => l.log_date && l.log_date <= todayManila)
      .sort((a, b) => (a.log_date < b.log_date ? 1 : -1));
    let streak = 0;
    for (const log of sorted) {
      const status = log.status?.toLowerCase() ?? '';
      if (status === 'late' || status === 'absent') break;
      if (status.includes('leave')) continue;
      streak += 1;
    }
    return streak;
  }, [history, todayManila]);

  const streakMessage =
    attendanceStreak === 0 ? 'Start your streak today!' :
    attendanceStreak < 5 ? 'Nice start!' :
    attendanceStreak < 10 ? 'Great job!' :
    attendanceStreak < 20 ? 'Impressive!' : 'Outstanding!';

  // Split holidays into upcoming (today included) and past, each sorted
  // nearest-first, for the Company Calendar modal.
  const { upcomingHolidays, pastHolidays } = useMemo(() => {
    const upcoming = companyHolidays
      .filter((h) => h.holiday_date >= todayManila)
      .sort((a, b) => (a.holiday_date < b.holiday_date ? -1 : 1));
    const past = companyHolidays
      .filter((h) => h.holiday_date < todayManila)
      .sort((a, b) => (a.holiday_date < b.holiday_date ? 1 : -1));
    return { upcomingHolidays: upcoming, pastHolidays: past };
  }, [companyHolidays, todayManila]);

  const formatHolidayDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const daysUntilHoliday = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const [ty, tm, td] = todayManila.split('-').map(Number);
    return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86400000);
  };

  // If the employee has filtered Attendance History to a specific
  // cutoff, the summary cards follow that same cutoff. Otherwise,
  // default to the current cutoff period.
  const summaryCutoffKey = monthFilter || currentCutoffKey;

  // Minutes late for a single Late log, derived from the configurable
  // late cutoff (Super Admin -> App Settings) -- same threshold
  // app/api/time-in/route.ts uses to decide Present vs Late, since we
  // don't store an exact minutes-late value anywhere.
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

  const formatLateCutoffLabel = () => {
    const period = lateCutoffHour >= 12 ? 'PM' : 'AM';
    const hour12 = lateCutoffHour % 12 === 0 ? 12 : lateCutoffHour % 12;
    return `${hour12}:${String(lateCutoffMinute).padStart(2, '0')} ${period}`;
  };

  // "Leave" here now covers any type-specific status ("Sick Leave",
  // "Vacation Leave", "Emergency Leave") set by settle_leave_day(), not
  // just the literal word "Leave" -- match by substring.
  const isLeaveStatus = (s: string | null | undefined) => (s ?? '').toLowerCase().includes('leave');

  const summary = useMemo(() => {
    const cutoffLogs = history.filter(log => matchesCutoff(log.log_date, summaryCutoffKey));
    // "Present" here means the employee actually showed up (on-time or late) --
    // it must exclude 'Absent' and any Leave-type rows, which now also live in
    // attendance_logs. Status is compared case-insensitively since it can
    // also be hand-edited directly in Supabase (e.g. "late" instead of "Late").
    const presentLogs = cutoffLogs.filter(l => l.status?.toLowerCase() !== 'absent' && !isLeaveStatus(l.status));
    const lateLogs = cutoffLogs.filter(l => l.status?.toLowerCase() === 'late');
    const absentLogs = cutoffLogs.filter(l => l.status?.toLowerCase() === 'absent');
    const leaveLogs = cutoffLogs.filter(l => isLeaveStatus(l.status));
    const onTime = presentLogs.length - lateLogs.length;
    const totalLateMinutes = lateLogs
      .filter(l => l.time_in)
      .reduce((sum, l) => sum + getMinutesLate(l.time_in), 0);
    // presentLogs/lateLogs/absentLogs carried along so the stat cards can
    // list the exact dates behind each number when tapped.
    return { present: presentLogs.length, late: lateLogs.length, leave: leaveLogs.length, absent: absentLogs.length, onTime, totalLateMinutes, presentLogs, lateLogs, leaveLogs, absentLogs };
  }, [history, summaryCutoffKey, lateCutoffHour, lateCutoffMinute]);

  // Which stat card's detail list is currently open (null = none).
  const [summaryDetailType, setSummaryDetailType] = useState<'present' | 'late' | 'leave' | 'absent' | null>(null);

  const summaryDetailInfo = useMemo(() => {
    if (!summaryDetailType) return null;
    const map: Record<'present' | 'late' | 'leave' | 'absent', { title: string; accent: string; logs: any[]; emptyNote: string }> = {
      present: { title: 'Present Days', accent: 'text-blue-600', logs: summary.presentLogs, emptyNote: "No present days on record for this period yet." },
      late: { title: 'Late Days', accent: 'text-orange-600', logs: summary.lateLogs, emptyNote: "No late days this period -- keep it up!" },
      leave: { title: 'Days on Leave', accent: 'text-purple-600', logs: summary.leaveLogs, emptyNote: "No leave days recorded for this period." },
      absent: { title: 'Absent Days', accent: 'text-red-600', logs: summary.absentLogs, emptyNote: "No absences this period -- perfect attendance!" },
    };
    return map[summaryDetailType];
  }, [summaryDetailType, summary]);

  // --- History filtering ---
  const availableCutoffs = useMemo(() => {
    const months = new Set<string>();
    history.forEach(log => {
      if (log.log_date) months.add(log.log_date.slice(0, 7));
    });
    // Always include the current cutoff's month, even if there's no
    // attendance log for it yet, so the dropdown (defaulted to this
    // cutoff) always has a matching option to display.
    months.add(currentCutoffKey.split(':')[0]);
    const opts: string[] = [];
    months.forEach(ym => {
      opts.push(`${ym}:H1`);
      opts.push(`${ym}:H2`);
    });
    // String sort works here since "YYYY-MM:H1" < "YYYY-MM:H2"
    // alphabetically, and the zero-padded YYYY-MM sorts correctly too.
    return opts.sort().reverse();
  }, [history, currentCutoffKey]);

  // Just the distinct months (no H1/H2 duplication) for a shorter, easier
  // to scan month picker -- the half is chosen separately via the two
  // pill buttons next to it.
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    availableCutoffs.forEach((c) => months.add(c.split(':')[0]));
    return Array.from(months).sort().reverse();
  }, [availableCutoffs]);

  const [selectedYm, selectedHalf] = monthFilter ? (monthFilter.split(':') as [string, string]) : ['', ''];

  const formatMonthOnly = (ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const handleMonthChange = (ym: string) => {
    if (!ym) { setMonthFilter(''); return; }
    setMonthFilter(`${ym}:${selectedHalf || 'H1'}`);
  };

  const handleHalfChange = (half: 'ALL' | 'H1' | 'H2') => {
    const ym = selectedYm || currentCutoffKey.split(':')[0];
    setMonthFilter(`${ym}:${half}`);
  };

  const filteredHistory = useMemo(() => {
    if (!monthFilter) return history;
    return history.filter(log => matchesCutoff(log.log_date, monthFilter));
  }, [history, monthFilter]);

  const formatMonthLabel = (key: string) => {
    const [ym, half] = key.split(':');
    const [y, m] = ym.split('-').map(Number);
    const monthName = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long' });
    if (half === 'ALL') return `${monthName} ${y} (Whole Month)`;
    const lastDay = new Date(y, m, 0).getDate();
    return half === 'H1' ? `${monthName} 1-15, ${y}` : `${monthName} 16-${lastDay}, ${y}`;
  };

  // --- Monthly Attendance Calendar ---
  const [attendanceCalendarOpen, setAttendanceCalendarOpen] = useState(false);
  const [attendanceCalendarMonth, setAttendanceCalendarMonth] = useState(() => currentCutoffKey.split(':')[0]);
  const [selectedAttendanceCalendarDate, setSelectedAttendanceCalendarDate] = useState<string | null>(null);

  const attendanceCalendarDays = useMemo(() => {
    const [year, month] = attendanceCalendarMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstWeekday = new Date(year, month - 1, 1).getDay();
    const cells: Array<{ date: string; day: number; log: any | null; holiday: string | null } | null> = [];
    for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${attendanceCalendarMonth}-${String(day).padStart(2, '0')}`;
      cells.push({
        date,
        day,
        log: history.find((item) => item.log_date === date) || null,
        holiday: companyHolidays.find((item) => item.holiday_date === date)?.name || null,
      });
    }
    return cells;
  }, [attendanceCalendarMonth, history, companyHolidays]);

  const selectedAttendanceCalendarDay = selectedAttendanceCalendarDate
    ? {
        date: selectedAttendanceCalendarDate,
        log: history.find((item) => item.log_date === selectedAttendanceCalendarDate) || null,
        holiday: companyHolidays.find((item) => item.holiday_date === selectedAttendanceCalendarDate)?.name || null,
      }
    : null;

  // --- Profile completeness ---
  const profileCompleteness = useMemo(() => {
    const fields = [
      profile?.full_name,
      profile?.employee_id,
      profile?.designation,
      profile?.avatar_url,
      governmentIds?.sss_number,
      governmentIds?.philhealth_number,
      governmentIds?.pagibig_number,
      governmentIds?.tin_number,
      governmentIds?.hired_date,
      governmentIds?.employment_status,
    ];
    const completed = fields.filter(Boolean).length;
    return {
      completed,
      total: fields.length,
      percent: Math.round((completed / fields.length) * 100),
      missing: fields.length - completed,
    };
  }, [profile, governmentIds]);

  // --- Persistent Notification Inbox ---
  type EmployeeNotification = {
    id: string;
    title: string;
    message: string;
    date: string;
    target: 'leave' | 'dispute' | 'payslip' | 'announcement' | 'holiday' | 'support';
  };
  const [notificationsModalOpen, setNotificationsModalOpen] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);

  useEffect(() => {
    if (!currentUserId) return;
    try {
      const stored = localStorage.getItem(`employee-notifications-read:${currentUserId}`);
      setReadNotificationIds(stored ? JSON.parse(stored) : []);
    } catch {
      setReadNotificationIds([]);
    }
  }, [currentUserId]);

  const employeeNotifications = useMemo<EmployeeNotification[]>(() => {
    const items: EmployeeNotification[] = [];
    myLeaves
      .filter((leave) => leave.status === 'Approved' || leave.status === 'Rejected')
      .forEach((leave) => items.push({
        id: `leave:${leave.id}:${leave.status}`,
        title: `Leave ${leave.status}`,
        message: `${leave.leave_type} leave · ${leave.start_date} to ${leave.end_date}`,
        date: leave.reviewed_at || leave.created_at,
        target: 'leave',
      }));
    myDisputes
      .filter((dispute) => dispute.status === 'Approved' || dispute.status === 'Rejected')
      .forEach((dispute) => items.push({
        id: `dispute:${dispute.id}:${dispute.status}`,
        title: `Attendance dispute ${dispute.status}`,
        message: `${disputeTypeLabel(dispute)} · ${dispute.dispute_date}`,
        date: dispute.reviewed_at || dispute.created_at,
        target: 'dispute',
      }));
    payslips
      .filter((payslip) => !payslip.acknowledged_at)
      .forEach((payslip) => items.push({
        id: `payslip:${payslip.id}`,
        title: 'New payslip available',
        message: payslip.cutoff_label,
        date: payslip.published_at || payslip.uploaded_at,
        target: 'payslip',
      }));
    supportRequests
      .filter((request) => request.status === 'In Progress' || request.status === 'Resolved')
      .forEach((request) => items.push({
        id: `support:${request.id}:${request.status}`,
        title: `Request ${request.status}`,
        message: request.subject,
        date: request.updated_at,
        target: 'support',
      }));
    if (announcement && announcementUpdatedAt) {
      items.push({
        id: `announcement:${announcementUpdatedAt}`,
        title: 'Company announcement',
        message: announcement,
        date: announcementUpdatedAt,
        target: 'announcement',
      });
    }
    if (upcomingHolidays[0]) {
      items.push({
        id: `holiday:${upcomingHolidays[0].id}`,
        title: 'Upcoming holiday',
        message: `${upcomingHolidays[0].name} · ${formatHolidayDate(upcomingHolidays[0].holiday_date)}`,
        date: upcomingHolidays[0].holiday_date,
        target: 'holiday',
      });
    }
    return items.sort((a, b) => {
      const aTime = Date.parse(a.date) || 0;
      const bTime = Date.parse(b.date) || 0;
      return bTime - aTime;
    });
  }, [myLeaves, myDisputes, payslips, supportRequests, announcement, announcementUpdatedAt, upcomingHolidays]);

  const unreadNotificationCount = employeeNotifications.filter((item) => !readNotificationIds.includes(item.id)).length;

  const markNotificationRead = (notificationId: string) => {
    if (!currentUserId || readNotificationIds.includes(notificationId)) return;
    const next = [...readNotificationIds, notificationId];
    setReadNotificationIds(next);
    localStorage.setItem(`employee-notifications-read:${currentUserId}`, JSON.stringify(next));
  };

  const markAllNotificationsRead = () => {
    if (!currentUserId) return;
    const next = employeeNotifications.map((item) => item.id);
    setReadNotificationIds(next);
    localStorage.setItem(`employee-notifications-read:${currentUserId}`, JSON.stringify(next));
  };

  const openNotificationTarget = (notification: EmployeeNotification) => {
    markNotificationRead(notification.id);
    setNotificationsModalOpen(false);
    if (notification.target === 'leave') setMyLeavesModalOpen(true);
    if (notification.target === 'dispute') setMyDisputesModalOpen(true);
    if (notification.target === 'payslip') setPayslipsModalOpen(true);
    if (notification.target === 'holiday') setCalendarModalOpen(true);
    if (notification.target === 'support') setSupportModalOpen(true);
  };

  const pendingLeavesCount = myLeaves.filter((leave) => leave.status === 'Pending').length;
  const pendingDisputesCount = myDisputes.filter((dispute) => dispute.status === 'Pending').length;
  const newPayslipsCount = payslips.filter((payslip) => !payslip.acknowledged_at).length;
  const openSupportCount = supportRequests.filter((request) => request.status !== 'Resolved').length;

  const todayWorkStatus = !todayLog
    ? { label: 'Not Timed In', color: 'bg-slate-100 text-slate-600' }
    : todayLog.time_out
      ? { label: 'Completed', color: 'bg-green-100 text-green-700' }
      : todayLog.status?.toLowerCase() === 'late'
        ? { label: 'Working · Late', color: 'bg-orange-100 text-orange-700' }
        : { label: 'Working', color: 'bg-blue-100 text-blue-700' };

  const expectedTimeOutLabel = (() => {
    const period = timeOutReminderHour >= 12 ? 'PM' : 'AM';
    const hour = timeOutReminderHour % 12 || 12;
    return `${hour}:00 ${period}`;
  })();

  // --- Export Attendance History ---
  // Both exports respect whatever the employee currently has the history
  // filtered to (monthFilter) via filteredHistory.
  const exportFileLabel = () => {
    const idPart = profile?.employee_id ? `-${profile.employee_id}` : '';
    const periodPart = monthFilter ? `-${monthFilter.replace(':', '-')}` : '-all';
    return `attendance${idPart}${periodPart}`;
  };

  const exportAttendanceCSV = () => {
    const escapeCsv = (val: string) => `"${(val ?? '').replace(/"/g, '""')}"`;
    const headers = ['Date', 'Day', 'Status', 'Time In', 'Time Out'];
    const rows = filteredHistory.map((log) => {
      const weekday = new Date(log.log_date).toLocaleDateString('en-US', { weekday: 'long' });
      const timeIn = log.time_in ? new Date(log.time_in).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }) : '';
      const timeOut = log.time_out ? new Date(log.time_out).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }) : '';
      return [log.log_date, weekday, log.status ?? '', timeIn, timeOut];
    });
    const csv = [headers, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportFileLabel()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Opens a print-formatted view in a new tab and triggers the browser's
  // print dialog -- the employee can "Save as PDF" from there. Avoids
  // needing a PDF-generation library as a project dependency.
  const exportAttendancePDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to export as PDF.');
      return;
    }
    const rowsHtml = filteredHistory.map((log) => {
      const weekday = new Date(log.log_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const timeIn = log.time_in ? new Date(log.time_in).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }) : '--:--';
      const timeOut = log.time_out ? new Date(log.time_out).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }) : '--:--';
      return `<tr><td>${weekday}</td><td>${log.log_date}</td><td><span class="tag ${(log.status ?? '').toLowerCase()}">${log.status ?? ''}</span></td><td>${timeIn}</td><td>${timeOut}</td></tr>`;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>${exportFileLabel()}</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #1e293b; padding: 32px; }
            h1 { font-size: 18px; margin: 0 0 2px; }
            .sub { color: #64748b; font-size: 12px; margin: 0 0 20px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
            th { color: #64748b; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
            .tag { padding: 3px 8px; border-radius: 999px; font-weight: bold; font-size: 10px; text-transform: uppercase; }
            .tag.present { background: #e4fbea; color: #0c7a34; }
            .tag.late { background: #ffeee2; color: #c23f0e; }
            .tag.absent { background: #ffe1e1; color: #b91c1c; }
            .tag.sick.leave, .tag.vacation.leave, .tag.emergency.leave { background: #f3ecfd; color: #6d28d9; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <h1>${profile?.full_name || 'Employee'} -- Attendance History</h1>
          <p class="sub">${profile?.employee_id ? `ID: ${profile.employee_id} · ` : ''}${monthFilter ? formatMonthLabel(monthFilter) : 'All records'} · Generated ${new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric' })}</p>
          <table>
            <thead><tr><th>Day</th><th>Date</th><th>Status</th><th>Time In</th><th>Time Out</th></tr></thead>
            <tbody>${rowsHtml || '<tr><td colspan="5">No records.</td></tr>'}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  // Formats "HH:MM" (24h) into a readable 12h time, e.g. "8:05 AM" --
  // used on the dispute confirmation screen.
  const formatTimeLocal = (hhmm: string) => {
    if (!hhmm) return '--';
    return new Date(`2000-01-01T${hhmm}:00`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const employeeActionCount = (todayLog?.time_in && !todayLog.time_out ? 1 : 0)
    + pendingLeavesCount + pendingDisputesCount + newPayslipsCount + openSupportCount
    + (!initLoading && profileCompleteness.percent < 100 ? 1 : 0);

  const scrollToEmployeeSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openAttendanceFromNav = () => {
    setAttendanceHistoryOpen(true);
    window.setTimeout(() => scrollToEmployeeSection('employee-attendance-history'), 0);
  };

  const openProfileFromNav = () => {
    setShowGovIdsSection(true);
    window.setTimeout(() => scrollToEmployeeSection('employee-profile'), 0);
  };

  const openAttendanceCalendar = () => {
    setAttendanceCalendarMonth(selectedYm || currentCutoffKey.split(':')[0]);
    setSelectedAttendanceCalendarDate(null);
    setAttendanceCalendarOpen(true);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.replace('/');
  };

  const greeting = (() => {
    const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', hour12: false }).format(new Date()));
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const employeeFirstName = profile?.full_name?.trim().split(/\s+/)[0] || 'there';
  const attendanceQuickLabel: 'Time In' | 'Time Out' | 'Completed' = !todayLog ? 'Time In' : !todayLog.time_out ? 'Time Out' : 'Completed';
  const attendanceQuickDisabled = loading || initLoading || timeOutLoading || checkingNetwork || officeNetworkAllowed === false || Boolean(todayLog?.time_out);
  const runAttendanceQuickAction = () => {
    if (!todayLog) handleTimeIn();
    else if (!todayLog.time_out) handleTimeOutClick();
  };

  return (
    <main id="employee-dashboard-top" className="employee-dashboard min-h-screen p-3 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:p-4 sm:pb-[calc(6rem+env(safe-area-inset-bottom))] md:p-6 md:pb-[calc(6rem+env(safe-area-inset-bottom))] lg:p-8">
      <style jsx global>{`
        /* DARK MODE — neutral dark gray, not pure black. */
        .dark { color-scheme: dark; }
        .dark body { background-color: #202522; color: #f1f5f2; }
        .dark .card-style { background: #292f2b !important; border-color: #414944 !important; color: #f1f5f2; }
        .dark .branding-box { background: #2c332e !important; border-color: #465049 !important; color: #f7faf8; }
        .dark .input-field { background: #252b27 !important; border-color: #4b554e !important; color: #f7faf8 !important; }
        .dark .input-field::placeholder { color: #aeb8b1 !important; opacity: 1; }
        .dark input, .dark select, .dark textarea { color-scheme: dark; }
        .employee-dashboard .card-style {
          border: 1px solid #e2e8e3;
          border-radius: 1rem;
          box-shadow: 0 4px 18px rgba(15, 23, 42, .045);
        }
        .dark .employee-dashboard .card-style { border-color: #414944 !important; }

        .dark .text-slate-950, .dark .text-slate-900, .dark .text-slate-800 { color: #f8faf9 !important; }
        .dark .text-slate-700, .dark .text-slate-600 { color: #dce3de !important; }
        .dark .text-slate-500 { color: #bec8c1 !important; }
        .dark .text-slate-400 { color: #a7b2aa !important; }
        .dark .text-slate-300 { color: #94a098 !important; }

        .dark .bg-white { background-color: #2d342f !important; }
        .dark .bg-white\/20 { background-color: rgba(75, 84, 78, .45) !important; }
        .dark .bg-white\/70, .dark .bg-white\/80, .dark .bg-white\/85, .dark .bg-white\/90, .dark .bg-white\/95 { background-color: rgba(49, 57, 51, .96) !important; }
        .dark .bg-slate-50, .dark .bg-slate-50\/80 { background-color: #282e2a !important; }
        .dark .bg-slate-100 { background-color: #333a35 !important; }
        .dark .bg-slate-100\/90 { background-color: rgba(51, 58, 53, .96) !important; }
        .dark .bg-slate-300 { background-color: #68726b !important; }
        .dark .bg-slate-400 { background-color: #7c8780 !important; }
        .dark .bg-slate-200 { background-color: #444c46 !important; }
        .dark .bg-slate-900 { background-color: #343a36 !important; }
        .dark .bg-slate-950 { background-color: #303632 !important; }
        .dark .border-slate-100 { border-color: #3e4741 !important; }
        .dark .border-slate-200 { border-color: #4b554e !important; }
        .dark .border-slate-200\/80 { border-color: rgba(75, 85, 78, .88) !important; }
        .dark .border-white\/70 { border-color: #505a53 !important; }
        .dark .border-black\/5 { border-color: #4b554e !important; }
        .dark .hover\:bg-slate-50:hover { background-color: #343b36 !important; }
        .dark .hover\:bg-slate-100:hover { background-color: #3b433d !important; }
        .dark .hover\:bg-slate-200:hover { background-color: #48514a !important; }

        .dark .bg-green-50, .dark .bg-emerald-50, .dark .bg-emerald-50\/70 { background-color: #263b2f !important; }
        .dark .bg-green-100, .dark .bg-emerald-100 { background-color: #31503c !important; }
        .dark .border-green-100, .dark .border-green-200, .dark .border-emerald-100, .dark .border-emerald-200 { border-color: #4b7458 !important; }
        .dark .text-green-950, .dark .text-green-900, .dark .text-green-800, .dark .text-green-700,
        .dark .text-emerald-950, .dark .text-emerald-900, .dark .text-emerald-800, .dark .text-emerald-700 { color: #c8f2d3 !important; }
        .dark .text-green-600, .dark .text-emerald-600 { color: #8ee6a7 !important; }

        .dark .bg-blue-50, .dark .bg-blue-50\/70, .dark .bg-sky-50 { background-color: #263443 !important; }
        .dark .bg-sky-50\/40 { background-color: rgba(38, 52, 67, .94) !important; }
        .dark .bg-blue-100, .dark .bg-sky-100 { background-color: #304760 !important; }
        .dark .border-blue-100, .dark .border-blue-200, .dark .border-sky-100, .dark .border-sky-200 { border-color: #4b6f94 !important; }
        .dark .text-blue-950, .dark .text-blue-900, .dark .text-blue-800, .dark .text-blue-700, .dark .text-blue-600,
        .dark .text-sky-950, .dark .text-sky-900, .dark .text-sky-800, .dark .text-sky-700, .dark .text-sky-600 { color: #c5ddff !important; }

        .dark .bg-amber-50, .dark .bg-orange-50, .dark .bg-orange-50\/70 { background-color: #403525 !important; }
        .dark .bg-amber-50\/60 { background-color: rgba(64, 53, 37, .96) !important; }
        .dark .bg-orange-50\/60 { background-color: rgba(64, 53, 37, .96) !important; }
        .dark .bg-amber-100, .dark .bg-orange-100 { background-color: #57432b !important; }
        .dark .border-amber-100, .dark .border-amber-200, .dark .border-orange-100, .dark .border-orange-200, .dark .border-orange-300 { border-color: #84633a !important; }
        .dark .text-amber-950, .dark .text-amber-900, .dark .text-amber-800, .dark .text-amber-700, .dark .text-amber-600,
        .dark .text-orange-950, .dark .text-orange-900, .dark .text-orange-800, .dark .text-orange-700, .dark .text-orange-600 { color: #ffe2a3 !important; }

        /* Realtime red alerts: light text on muted dark-red surface. */
        .dark .bg-red-50, .dark .bg-rose-50 { background-color: #44292b !important; }
        .dark .bg-red-50\/60 { background-color: rgba(68, 41, 43, .96) !important; }
        .dark .bg-red-100, .dark .bg-rose-100 { background-color: #5a3034 !important; }
        .dark .bg-red-200, .dark .bg-rose-200 { background-color: #67373c !important; }
        .dark .border-red-100, .dark .border-red-200, .dark .border-red-300, .dark .border-rose-100, .dark .border-rose-200 { border-color: #8b4d53 !important; }
        .dark .text-red-950, .dark .text-red-900, .dark .text-red-800, .dark .text-red-700, .dark .text-red-600, .dark .text-red-500,
        .dark .text-rose-950, .dark .text-rose-900, .dark .text-rose-800, .dark .text-rose-700, .dark .text-rose-600, .dark .text-rose-500 { color: #ffd1d5 !important; }

        .dark .bg-purple-50, .dark .bg-violet-50 { background-color: #382e42 !important; }
        .dark .bg-purple-100, .dark .bg-violet-100 { background-color: #493758 !important; }
        .dark .border-purple-100, .dark .border-purple-200, .dark .border-violet-100, .dark .border-violet-200 { border-color: #705885 !important; }
        .dark .text-purple-950, .dark .text-purple-900, .dark .text-purple-800, .dark .text-purple-700, .dark .text-purple-600,
        .dark .text-violet-950, .dark .text-violet-900, .dark .text-violet-800, .dark .text-violet-700, .dark .text-violet-600 { color: #ead8ff !important; }

        .dark .bg-teal-50, .dark .bg-cyan-50 { background-color: #263b3a !important; }
        .dark .border-teal-100, .dark .border-teal-200, .dark .border-cyan-100, .dark .border-cyan-200 { border-color: #4d7774 !important; }
        .dark .text-teal-950, .dark .text-teal-900, .dark .text-teal-800, .dark .text-teal-700, .dark .text-teal-600,
        .dark .text-cyan-950, .dark .text-cyan-900, .dark .text-cyan-800, .dark .text-cyan-700, .dark .text-cyan-600 { color: #c6f3ef !important; }

        .dark .employee-notification-unread { background: #29394a !important; border-color: #45617d !important; }
        .dark .employee-notification-read { background: #2a302c !important; border-color: #414a44 !important; opacity: 1 !important; }
        .dark .employee-notification-unread .text-slate-900,
        .dark .employee-notification-read .text-slate-900 { color: #f7faf8 !important; }
        .dark .employee-notification-unread .text-slate-500,
        .dark .employee-notification-read .text-slate-500 { color: #c2ccc5 !important; }

        .dark .hover\:bg-red-100:hover, .dark .hover\:bg-rose-100:hover { background-color: #60363a !important; }
        .dark .hover\:bg-amber-100:hover, .dark .hover\:bg-orange-100:hover { background-color: #604a30 !important; }
        .dark .hover\:bg-blue-50:hover, .dark .hover\:bg-sky-50:hover { background-color: #31455a !important; }
        .dark .hover\:bg-emerald-50:hover, .dark .hover\:bg-green-50:hover { background-color: #304a39 !important; }

        .dark .tag-present, .dark .tag-late, .dark .tag-absent, .dark .tag-leave, .dark .tag-excused { border: 1px solid currentColor; }
        .dark button:disabled { opacity: .55; }

        /* The commute modal owns an explicit theme scope so switching theme
           while a result is open never leaves OS-level dark utilities behind. */
        .commute-theme-scope[data-theme='light'] { color-scheme: light; }
        .commute-theme-scope[data-theme='dark'] { color-scheme: dark; }
        .commute-theme-scope.dark .commute-canvas-surface,
        .commute-theme-scope.dark [class*="bg-[#fcfbf8]"] { background: #1f252d !important; }
        .commute-theme-scope.dark .commute-advisory-surface {
          background: linear-gradient(90deg, #1e3150 0%, #29313b 100%) !important;
          border-color: #355987 !important;
        }
        .commute-theme-scope .commute-location-title { color: #0f172a !important; }
        .commute-theme-scope .commute-location-address { color: #475569 !important; opacity: 1 !important; }
        .commute-theme-scope.dark .commute-location-card {
          background: #26313e !important;
          border-color: #547090 !important;
          box-shadow: none !important;
        }
        .commute-theme-scope.dark .commute-location-title { color: #f8fafc !important; }
        .commute-theme-scope.dark .commute-location-address { color: #cbd5e1 !important; }
        .commute-theme-scope.dark .commute-location-icon { background: #3b82f6 !important; color: #fff !important; }
        .commute-theme-scope.dark .commute-location-clear {
          background: #1f2937 !important;
          border-color: #64748b !important;
          color: #e2e8f0 !important;
        }
        .commute-theme-scope.dark .commute-plan-button {
          background: linear-gradient(90deg, #1d4ed8 0%, #2563eb 55%, #4f46e5 100%) !important;
          color: #fff !important;
        }
        .commute-theme-scope.dark [class*="bg-blue-50/"] { background-color: rgba(30, 49, 80, .72) !important; }
        .commute-theme-scope.dark [class*="bg-orange-50/"] { background-color: rgba(64, 45, 30, .78) !important; }
        .commute-theme-scope.dark [class*="bg-amber-50/"] { background-color: rgba(66, 53, 30, .78) !important; }
        @media (max-width: 1023px) {
          .employee-quick-actions > button {
            min-height: 5.5rem;
            flex-direction: column;
            justify-content: center;
            gap: .375rem;
            text-align: center;
          }
          .employee-quick-actions > button > div:first-child { width: 2.75rem; height: 2.75rem; }
          .employee-quick-actions > button > div:last-child p:last-child { display: none; }
        }
      `}</style>
      <div className="mx-auto max-w-[1600px] space-y-4 md:space-y-6">

        {/* Header */}
        <header className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_4px_18px_rgba(15,23,42,0.04)] dark:bg-[#292f2b] sm:p-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#16a34a] lg:hidden">Hamdan Engineering</p>
            <h1 className="mt-0.5 truncate text-xl font-bold leading-tight sm:text-2xl">{greeting}, {employeeFirstName}!</h1>
            <p className="mt-1 hidden text-xs text-slate-500 sm:block">Here&apos;s what&apos;s happening with your workday.</p>
            <p className="mt-1 text-xs font-medium text-slate-500">{date} <span className="mx-1 text-slate-300">•</span> {time || '--:--:--'}</p>
          </div>
          <div className="flex flex-none items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="grid h-11 w-11 place-items-center rounded-full border border-slate-200 text-slate-500 transition-colors duration-150 hover:bg-slate-50 lg:hidden"
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? <SunIcon /> : <MoonIcon />}
            </button>
            <button type="button" onClick={() => setNotificationsModalOpen(true)} className="relative grid h-11 w-11 place-items-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-50" aria-label={`Notifications${unreadNotificationCount ? `, ${unreadNotificationCount} unread` : ''}`}>
              <Bell size={19} strokeWidth={2} />
              {unreadNotificationCount > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white">{unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}</span>}
            </button>
            <button type="button" onClick={() => setMobileToolsOpen(true)} className="grid h-11 w-11 place-items-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 text-slate-500 lg:hidden" aria-label="Open employee menu">
              {profile?.avatar_url ? <Image src={profile.avatar_url} alt="" width={44} height={44} className="h-full w-full object-cover" /> : <UserRound size={19} />}
            </button>
            <button type="button" onClick={openProfileFromNav} className="hidden h-11 w-11 place-items-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 text-slate-500 lg:grid" aria-label="Open employee profile">
              {profile?.avatar_url ? <Image src={profile.avatar_url} alt="" width={44} height={44} className="h-full w-full object-cover" /> : <UserRound size={19} />}
            </button>
          </div>
        </header>

        {message && <div className={`p-3 rounded-xl text-xs font-bold ${message.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{message}</div>}

        {/* Mobile summary cards -- tap any of these to see which dates were counted. */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          <EmployeeSummaryCard label="Present" value={summary.present} icon={CheckCircle2} tone="green" onClick={() => setSummaryDetailType('present')} />
          <EmployeeSummaryCard label="Late" value={summary.late} icon={Clock3} tone="orange" onClick={() => setSummaryDetailType('late')} />
          <EmployeeSummaryCard label="On Leave" value={summary.leave} icon={CalendarDays} tone="purple" onClick={() => setSummaryDetailType('leave')} />
          <EmployeeSummaryCard label="Not Timed In" value={summary.absent} icon={CalendarX2} tone="red" onClick={() => setSummaryDetailType('absent')} />
        </div>

        {/* Main layout */}
        <div className="grid grid-cols-1 gap-3 sm:gap-4 md:gap-5 lg:grid-cols-5">
          <EmployeeDesktopSidebar
            employeeName={profile?.full_name || 'Employee'}
            designation={profile?.designation || 'Employee'}
            avatarUrl={profile?.avatar_url}
            darkMode={darkMode}
            actionCount={employeeActionCount}
            onDashboard={() => scrollToEmployeeSection('employee-dashboard-top')}
            onAttendance={openAttendanceFromNav}
            onLeave={() => setLeaveChoiceModalOpen(true)}
            onDisputes={() => { setSelectedMyDisputeDetail(null); setMyDisputesModalOpen(true); fetchMyDisputes(); }}
            onPayslips={() => { setPayslipsModalOpen(true); fetchPayslips(); }}
            onDocuments={() => { setDocumentsModalOpen(true); fetchEmployeeDocuments(); }}
            onActionCenter={() => scrollToEmployeeSection('employee-action-center')}
            onCommute={() => setCommuteModalOpen(true)}
            onHelpdesk={() => { setSupportModalOpen(true); fetchSupportRequests(); }}
            onProfile={openProfileFromNav}
            onToggleTheme={toggleTheme}
            onLogout={handleLogout}
          />
          {/* Profile Sidebar */}
          <div id="employee-profile" className="scroll-mt-4 lg:col-span-1">
            <div className="card-style lg:sticky lg:top-6 !p-4">
              <div className="flex items-center gap-3 lg:flex-col lg:text-center lg:gap-0">
                <div className="w-14 h-14 lg:w-20 lg:h-20 lg:mx-auto lg:mb-3 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 flex-shrink-0">
                  {profile?.avatar_url ? <Image src={profile.avatar_url} alt="Profile" width={80} height={80} className="object-cover w-full h-full"/> : <div className="text-slate-400 font-bold text-xs">Logo</div>}
                </div>
                <div className="flex-1 min-w-0 lg:w-full">
                  <h2 className="text-sm lg:text-base font-semibold text-slate-900 truncate lg:text-center">
                    {initLoading ? <span className="text-slate-400">Loading...</span> : (profile?.full_name || 'Unknown')}
                  </h2>
                  <p className="text-blue-600 font-medium text-xs truncate lg:text-center">{profile?.designation || '---'}</p>
                  <p className="text-slate-400 text-[10px] lg:hidden">ID: {profile?.employee_id || '---'}</p>
                </div>
              </div>
              <div className="hidden lg:block text-left border-t border-slate-100 pt-3 mt-3">
                <p className="label-branded">Employee ID</p>
                <p className="font-medium text-slate-700 text-sm">{profile?.employee_id || '---'}</p>
              </div>

              {/* Attendance Streak badge -- consecutive work days without a
                  Late or Absent tag (approved Leave doesn't break it). */}
              {!initLoading && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2.5 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100 rounded-2xl p-3">
                    <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center flex-shrink-0 text-lg shadow-sm">🔥</div>
                    <div className="min-w-0">
                      <p className="font-extrabold text-slate-900 text-sm leading-none">{attendanceStreak}-day streak</p>
                      <p className="text-orange-600 text-[10px] font-bold uppercase tracking-wide mt-1">{streakMessage}</p>
                    </div>
                  </div>
                </div>
              )}

              {!initLoading && (
                <div className="mt-3">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wide">Profile completeness</p>
                    <p className="text-slate-700 text-[10px] font-extrabold">{profileCompleteness.percent}%</p>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-green-500 transition-all" style={{ width: `${profileCompleteness.percent}%` }} />
                  </div>
                </div>
              )}

              <button type="button" onClick={() => setShowGovIdsSection((s) => !s)} className="mt-3 text-blue-600 text-xs font-bold hover:underline w-full text-left lg:text-center">
                {showGovIdsSection ? 'Hide Details' : 'See More Details'}
              </button>
              {showGovIdsSection && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
                  {renderGovIdRow('SSS Number', governmentIds?.sss_number ?? null, 'sss')}
                  {renderGovIdRow('PhilHealth Number', governmentIds?.philhealth_number ?? null, 'philhealth')}
                  {renderGovIdRow('Pag-IBIG Number', governmentIds?.pagibig_number ?? null, 'pagibig')}
                  {renderGovIdRow('TIN Number', governmentIds?.tin_number ?? null, 'tin')}
                  <div><p className="label-branded mb-1">Hired Date</p><p className="font-medium text-slate-700 text-sm">{governmentIds?.hired_date ? formatHiredDate(governmentIds.hired_date) : 'Not set'}</p></div>
                  <div>
                    <p className="label-branded mb-1">Employment Status</p>
                    {governmentIds?.employment_status ? (
                      <span className={governmentIds.employment_status === 'Regular' ? 'tag-present' : governmentIds.employment_status === 'Probationary' ? 'tag-late' : 'tag-excused'}>{governmentIds.employment_status}</span>
                    ) : <p className="font-medium text-slate-700 text-sm">Not set</p>}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-3 sm:space-y-4 md:space-y-5">

            {/* Clock + Time buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="card-style !p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${todayWorkStatus.color}`}>
                    {todayWorkStatus.label}
                  </span>
                </div>
                <h1 className="stat-number text-blue-600 text-3xl md:text-4xl lg:text-5xl tracking-tight normal-case">{time || '--:--:--'}</h1>
                <p className="mt-1 text-slate-400 font-medium uppercase text-[9px] tracking-widest">{date}</p>
                <p className="mt-1 text-[10px] text-slate-400">Late cutoff: {formatLateCutoffLabel()} (PH Time)</p>
                <p className="mt-1 text-[10px] text-slate-400">Expected Time Out: {expectedTimeOutLabel}</p>
              </div>
              <div className="flex flex-col gap-2 justify-center">
                {!todayLog ? (
                  <button onClick={handleTimeIn} disabled={loading || initLoading || checkingNetwork || officeNetworkAllowed === false} className="btn-primary !py-3">
                    {loading ? <span className="flex items-center justify-center gap-2"><Spinner size="sm"/>Processing...</span> : checkingNetwork ? <span className="flex items-center justify-center gap-2"><Spinner size="sm"/>Checking...</span> : officeNetworkAllowed === false ? (officeNetworkIssue === 'unavailable' ? 'Attendance Unavailable' : 'Not on Office Network') : 'Time In'}
                  </button>
                ) : !todayLog.time_out ? (
                  <button onClick={handleTimeOutClick} disabled={timeOutLoading || checkingNetwork || officeNetworkAllowed === false} className="btn-danger !py-3">
                    {timeOutLoading ? <span className="flex items-center justify-center gap-2"><Spinner size="sm"/>Processing...</span> : checkingNetwork ? <span className="flex items-center justify-center gap-2"><Spinner size="sm"/>Checking...</span> : officeNetworkAllowed === false ? (officeNetworkIssue === 'unavailable' ? 'Attendance Unavailable' : 'Not on Office Network') : 'Time Out'}
                  </button>
                ) : (
                  <button disabled className="btn-primary !py-3 opacity-50 cursor-not-allowed">Completed for Today</button>
                )}
                {todayLog?.time_in && (
                  <p className="text-center text-slate-400 text-xs">
                    In: {new Date(todayLog.time_in).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    {todayLog.time_out && <> · Out: {new Date(todayLog.time_out).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</>}
                  </p>
                )}
                {!checkingNetwork && officeNetworkAllowed === false && !(todayLog?.time_out) && (
                  <div className={`flex items-start justify-between gap-3 rounded-xl border p-3 ${officeNetworkIssue === 'unavailable' ? 'bg-red-50 border-red-100' : 'bg-orange-50 border-orange-100'}`}>
                    <div className="min-w-0">
                      <p className={`text-xs font-bold ${officeNetworkIssue === 'unavailable' ? 'text-red-700' : 'text-orange-700'}`}>
                        {officeNetworkIssue === 'unavailable' ? 'Attendance recording is temporarily unavailable.' : 'You are not connected to an authorized office network.'}
                      </p>
                      <p className="text-slate-500 text-[10px] mt-1">
                        {officeNetworkIssue === 'unavailable'
                          ? 'Please contact HR or IT. You can still use the rest of the Employee Portal.'
                          : 'Time In and Time Out are available only through the office network. Other portal features remain available.'}
                      </p>
                    </div>
                    <button onClick={checkOfficeNetwork} className="text-blue-600 text-xs font-bold hover:underline flex-shrink-0">Retry</button>
                  </div>
                )}
                {/* Total Minutes Late (accumulated for the cutoff) */}
                <div className="flex items-center gap-3 card-style !p-3">
                  <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-xs">{formatLateDuration(summary.totalLateMinutes)} Late</p>
                    <p className="text-slate-400 text-[10px]">{formatMonthLabel(summaryCutoffKey)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Employee Action Center */}
            <section id="employee-action-center" className="card-style scroll-mt-4 !p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <h3 className="mb-0 text-sm">Action Center</h3>
                  <p className="text-slate-400 text-[10px] mt-0.5">Items that may need your attention</p>
                </div>
                <button type="button" onClick={() => setNotificationsModalOpen(true)} className="text-blue-600 text-[11px] font-bold hover:underline">
                  Notifications{unreadNotificationCount > 0 ? ` (${unreadNotificationCount})` : ''}
                </button>
              </div>
              {(todayLog?.time_in && !todayLog.time_out) || pendingLeavesCount > 0 || pendingDisputesCount > 0 || newPayslipsCount > 0 || openSupportCount > 0 || (!initLoading && profileCompleteness.percent < 100) ? (
                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-slate-50/80 px-3">
                  {todayLog?.time_in && !todayLog.time_out && (
                    <button type="button" onClick={handleTimeOutClick} disabled={officeNetworkAllowed === false || timeOutLoading} className="flex min-h-16 w-full items-center gap-3 py-3 text-left disabled:opacity-50">
                      <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-amber-50 text-amber-700"><Clock3 size={17} /></span>
                      <span className="min-w-0 flex-1"><span className="block text-xs font-bold text-slate-900">Time Out pending</span><span className="mt-0.5 block text-xs text-slate-500">Complete today&apos;s attendance.</span></span>
                      <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">Action</span>
                    </button>
                  )}
                  {pendingLeavesCount > 0 && (
                    <button type="button" onClick={() => setMyLeavesModalOpen(true)} className="flex min-h-16 w-full items-center gap-3 py-3 text-left">
                      <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-green-50 text-green-700"><Plane size={17} /></span>
                      <span className="min-w-0 flex-1"><span className="block text-xs font-bold text-slate-900">Pending Leave Requests</span><span className="mt-0.5 block text-xs text-slate-500">Review your request status.</span></span>
                      <span className="rounded-full bg-green-50 px-2 py-1 text-[10px] font-bold text-green-700">{pendingLeavesCount}</span>
                    </button>
                  )}
                  {pendingDisputesCount > 0 && (
                    <button type="button" onClick={() => setMyDisputesModalOpen(true)} className="flex min-h-16 w-full items-center gap-3 py-3 text-left">
                      <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-red-50 text-red-700"><CircleAlert size={17} /></span>
                      <span className="min-w-0 flex-1"><span className="block text-xs font-bold text-slate-900">Attendance Disputes</span><span className="mt-0.5 block text-xs text-slate-500">Review open attendance corrections.</span></span>
                      <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-bold text-red-700">{pendingDisputesCount}</span>
                    </button>
                  )}
                  {newPayslipsCount > 0 && (
                    <button type="button" onClick={() => setPayslipsModalOpen(true)} className="flex min-h-16 w-full items-center gap-3 py-3 text-left">
                      <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-blue-50 text-blue-700"><HandCoins size={17} /></span>
                      <span className="min-w-0 flex-1"><span className="block text-xs font-bold text-slate-900">Latest Payslip Available</span><span className="mt-0.5 block text-xs text-slate-500">Review and acknowledge receipt.</span></span>
                      <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">{newPayslipsCount}</span>
                    </button>
                  )}
                  {openSupportCount > 0 && (
                    <button type="button" onClick={() => setSupportModalOpen(true)} className="flex min-h-16 w-full items-center gap-3 py-3 text-left">
                      <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-purple-50 text-purple-700"><Headphones size={17} /></span>
                      <span className="min-w-0 flex-1"><span className="block text-xs font-bold text-slate-900">Support Requests</span><span className="mt-0.5 block text-xs text-slate-500">Check the latest helpdesk status.</span></span>
                      <span className="rounded-full bg-purple-50 px-2 py-1 text-[10px] font-bold text-purple-700">{openSupportCount}</span>
                    </button>
                  )}
                  {!initLoading && profileCompleteness.percent < 100 && (
                    <button type="button" onClick={openProfileFromNav} className="flex min-h-16 w-full items-center gap-3 py-3 text-left">
                      <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-slate-100 text-slate-600"><UserRound size={17} /></span>
                      <span className="min-w-0 flex-1"><span className="block text-xs font-bold text-slate-900">Profile Completeness</span><span className="mt-0.5 block text-xs text-slate-500">{profileCompleteness.missing} detail{profileCompleteness.missing === 1 ? '' : 's'} still missing.</span><span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-slate-200"><span className="block h-full rounded-full bg-green-600" style={{ width: `${profileCompleteness.percent}%` }} /></span></span>
                      <span className="text-xs font-bold text-green-700">{profileCompleteness.percent}%</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-green-50 border border-green-100 text-center">
                  <p className="font-bold text-green-700 text-sm">You&apos;re all caught up!</p>
                  <p className="text-green-600 text-[10px] mt-1">No pending employee actions right now.</p>
                </div>
              )}
            </section>
            {/* Announcements */}
            {/* min-h approximates the resolved card's typical height (icon row
                + 2-3 lines of text) so swapping from skeleton to real content
                doesn't shove everything below it down -- this was a measurable
                contributor to this page's Cumulative Layout Shift score. */}
            {announcementLoading ? (
              <div className="card-style !p-4 min-h-[104px] flex items-center"><LoadingRow label="Loading announcement..." /></div>
            ) : announcementError ? (
              <div className="card-style !p-4 border border-red-100"><p className="text-red-500 text-sm">{announcementError}</p></div>
            ) : announcement ? (
              <div className="card-dark !p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-green-500 flex items-center justify-center text-sm">📣</div>
                  <div className="flex-1 min-w-0">
                    <span className="mb-2 inline-block rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-950">Announcement</span>
                    <p className="text-white text-sm font-medium whitespace-pre-wrap leading-relaxed">{announcement}</p>
                    {announcementImageUrl && (
                      // Fixed aspect-ratio wrapper reserves the image's box before
                      // it loads, so the rest of the page doesn't jump once the
                      // browser learns the real dimensions (a CLS contributor).
                      <div className="mt-3 w-full aspect-video max-h-[420px] rounded-2xl bg-black/10 border border-white/10 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a static asset */}
                        <img
                          src={announcementImageUrl}
                          alt="Announcement attachment"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}
                    {announcementUpdatedAt && <p className="text-green-100/70 text-[10px] font-medium uppercase tracking-widest mt-2">Updated: {announcementUpdatedAt}</p>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="card-style !p-3 border-2 border-dashed border-slate-200 text-center">
                <p className="text-slate-400 text-xs">No announcements right now.</p>
              </div>
            )}

            {/* AI Weather & Commute Advisory */}
            {/* min-h approximates the resolved card's typical height so the
                skeleton-to-content swap doesn't push page content below it
                down -- see the announcement block above for the same fix. */}
            {weatherLoading ? (
              <div className="card-style !p-4 min-h-[168px] flex items-center">
                <LoadingRow label="Loading weather advisory..." />
              </div>
            ) : weatherAdvisory ? (
              <section
                className="card-style !p-4"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg flex-shrink-0 ${
                      weatherAdvisory.severity === 'critical'
                        ? 'bg-red-100'
                        : weatherAdvisory.severity === 'warning'
                          ? 'bg-orange-100'
                          : weatherAdvisory.severity === 'watch'
                            ? 'bg-amber-100'
                            : 'bg-sky-100'
                    }`}
                  >
                    {weatherAdvisory.precipitation_probability != null && weatherAdvisory.precipitation_probability >= 60 ? '🌧️' : '🌤️'}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-[11px] font-extrabold uppercase tracking-widest text-green-700">
                        Weather & Commute Advisory
                      </span>
                      <span
                        className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          weatherAdvisory.severity === 'critical'
                            ? 'bg-red-100 text-red-700'
                            : weatherAdvisory.severity === 'warning'
                              ? 'bg-orange-100 text-orange-700'
                              : weatherAdvisory.severity === 'watch'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-sky-100 text-sky-700'
                        }`}
                      >
                        {weatherAdvisory.severity}
                      </span>
                    </div>

                    <p className="font-bold text-slate-900 text-sm leading-snug">
                      {weatherAdvisory.headline}
                    </p>
                    <p className="text-slate-600 text-xs mt-1 leading-relaxed whitespace-pre-wrap">
                      {weatherAdvisory.message}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                      <span>📍 {weatherAdvisory.location_name}</span>
                      {weatherAdvisory.temperature_c != null && (
                        <span>🌡️ {Math.round(weatherAdvisory.temperature_c)}°C</span>
                      )}
                      {weatherAdvisory.precipitation_probability != null && (
                        <span>☔ {Math.round(weatherAdvisory.precipitation_probability)}% rain chance</span>
                      )}
                      {weatherAdvisory.commute_window && (
                        <span>🚗 {weatherAdvisory.commute_window}</span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={openCommuteChecker}
                      className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-green-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-green-700"
                    >
                      🚗 Check Weather & Live Traffic
                    </button>

                    <p className="text-slate-400 text-[9px] mt-2">
                      Updated {new Date(weatherAdvisory.generated_at).toLocaleString('en-US', {
                        timeZone: 'Asia/Manila',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {weatherAdvisory.source_name ? ` · ${weatherAdvisory.source_name}` : ''}
                    </p>
                  </div>
                </div>
              </section>
            ) : null}

            {!weatherLoading && !weatherAdvisory && (
              <button type="button" onClick={openCommuteChecker} className="card-style !p-4 w-full flex items-center justify-between gap-3 text-left hover:bg-slate-50 transition">
                <span className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 rounded-2xl bg-sky-50 flex items-center justify-center text-lg">🌦️</span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-slate-900">Weather & Live Traffic</span>
                    <span className="block text-[10px] text-slate-400 mt-0.5">30-minute weather and live traffic for any PH route.</span>
                  </span>
                </span>
                <span className="text-slate-400">→</span>
              </button>
            )}

            {/* Quick Actions */}
            <EmployeeQuickActions
              attendanceLabel={attendanceQuickLabel}
              attendanceDisabled={attendanceQuickDisabled}
              onAttendanceAction={runAttendanceQuickAction}
              onAttendanceHistory={openAttendanceFromNav}
              onLeave={() => setLeaveChoiceModalOpen(true)}
              onDisputes={() => { setSelectedMyDisputeDetail(null); setMyDisputesModalOpen(true); fetchMyDisputes(); }}
              onPayslips={() => { setPayslipsModalOpen(true); fetchPayslips(); }}
              onDocuments={() => { setDocumentsModalOpen(true); fetchEmployeeDocuments(); }}
              onCommute={() => setCommuteModalOpen(true)}
              onHelpdesk={() => { setSupportModalOpen(true); fetchSupportRequests(); }}
            />

            <section aria-labelledby="more-employee-tools-title" className="card-style !rounded-2xl !p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h2 id="more-employee-tools-title" className="text-sm font-semibold">More Employee Tools</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Directory and company dates</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => { setDirectoryModalOpen(true); setDirectorySearch(''); fetchDirectory(); }} className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-50">Employee Directory</button>
                <button type="button" onClick={() => { setCalendarModalOpen(true); fetchCompanyHolidays(); }} className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-50">Company Calendar</button>
              </div>
            </section>

            <div className="hidden">
              <button type="button" onClick={() => setLeaveChoiceModalOpen(true)} className="card-style !p-3 flex items-center gap-2 hover:bg-slate-50 transition text-left">
                <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 text-xs">Leave</p>
                  <p className="text-slate-400 text-[10px] truncate">{isRegular ? `${remainingCredits} credits left` : 'Request or view leaves'}</p>
                </div>
              </button>
              <button type="button" onClick={() => { setPayslipsModalOpen(true); fetchPayslips(); }} className="card-style !p-3 flex items-center gap-2 hover:bg-slate-50 transition text-left">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 text-xs">My Payslips</p>
                  <p className="text-slate-400 text-[10px] truncate">{payslips.length > 0 ? `${payslips.length} available` : 'No payslips yet'}</p>
                </div>
              </button>
              <button type="button" onClick={() => { setSelectedMyDisputeDetail(null); setMyDisputesModalOpen(true); fetchMyDisputes(); }} className="card-style !p-3 flex items-center gap-2 hover:bg-slate-50 transition text-left">
                <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center flex-shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-600"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 text-xs">My Disputes</p>
                  <p className="text-slate-400 text-[10px] truncate">{myDisputes.length > 0 ? `${myDisputes.length} dispute${myDisputes.length === 1 ? '' : 's'}` : 'No disputes yet'}</p>
                </div>
              </button>
              <button type="button" onClick={() => { setDirectoryModalOpen(true); setDirectorySearch(''); fetchDirectory(); }} className="card-style !p-3 flex items-center gap-2 hover:bg-slate-50 transition text-left">
                <div className="w-8 h-8 rounded-xl bg-sky-50 flex items-center justify-center flex-shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-sky-600"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 text-xs">Employee Directory</p>
                  <p className="text-slate-400 text-[10px] truncate">Look up a colleague</p>
                </div>
              </button>
              <button type="button" onClick={() => { setCalendarModalOpen(true); fetchCompanyHolidays(); }} className="card-style !p-3 flex items-center gap-2 hover:bg-slate-50 transition text-left">
                <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 text-xs">Company Calendar</p>
                  <p className="text-slate-400 text-[10px] truncate">
                    {!holidaysLoading && upcomingHolidays.length > 0
                      ? `Next: ${upcomingHolidays[0].name}`
                      : 'View holidays'}
                  </p>
                </div>
              </button>
              <button type="button" onClick={() => setNotificationsModalOpen(true)} className="card-style !p-3 flex items-center gap-2 hover:bg-slate-50 transition text-left">
                <div className="relative w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0 text-sm">
                  🔔
                  {unreadNotificationCount > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}</span>}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 text-xs">Notifications</p>
                  <p className="text-slate-400 text-[10px] truncate">{unreadNotificationCount > 0 ? `${unreadNotificationCount} unread` : 'You are up to date'}</p>
                </div>
              </button>
              <button type="button" onClick={() => { setSupportModalOpen(true); fetchSupportRequests(); }} className="card-style !p-3 flex items-center gap-2 hover:bg-slate-50 transition text-left">
                <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center flex-shrink-0 text-sm">🎫</div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 text-xs">Help Desk / HR</p>
                  <p className="text-slate-400 text-[10px] truncate">{openSupportCount > 0 ? `${openSupportCount} open request${openSupportCount === 1 ? '' : 's'}` : 'Submit a concern'}</p>
                </div>
              </button>
              <button type="button" onClick={() => { setDocumentsModalOpen(true); fetchEmployeeDocuments(); }} className="card-style !p-3 flex items-center gap-2 hover:bg-slate-50 transition text-left">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0 text-sm">📚</div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 text-xs">My Documents</p>
                  <p className="text-slate-400 text-[10px] truncate">{employeeDocuments.length > 0 ? `${employeeDocuments.length} available` : 'Policies and memorandums'}</p>
                </div>
              </button>
            </div>

            {/* Attendance History -- collapsed by default; tap the header to expand. */}
            <div id="employee-attendance-history" className="card-style scroll-mt-4 !p-4">
              <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAttendanceHistoryOpen((v) => !v)}
                className="flex-1 flex items-center justify-between gap-2 text-left"
              >
                <h3 className="mb-0 text-sm">
                  Attendance History
                  {!attendanceHistoryOpen && (
                    <span className="block text-[10px] font-medium text-slate-400 normal-case tracking-normal mt-0.5">
                      {monthFilter ? formatMonthLabel(monthFilter) : `${filteredHistory.length} record${filteredHistory.length === 1 ? '' : 's'}`}
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
                <button
                  type="button"
                  onClick={openAttendanceCalendar}
                  className="px-3 py-2 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold hover:bg-blue-100 transition flex-shrink-0"
                >
                  Calendar
                </button>
              </div>

              {attendanceHistoryOpen && (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 mt-4 mb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <select className="input-field !py-1.5 !text-xs !min-h-0 w-auto" value={selectedYm} onChange={(e) => handleMonthChange(e.target.value)}>
                        <option value="">All months</option>
                        {availableMonths.map((ym) => <option key={ym} value={ym}>{formatMonthOnly(ym)}</option>)}
                      </select>
                      {selectedYm && (
                        <div className="flex flex-wrap rounded-2xl bg-slate-100 p-0.5">
                          <button
                            type="button"
                            onClick={() => handleHalfChange('ALL')}
                            className={`px-3 py-1 rounded-full text-[11px] font-bold transition whitespace-nowrap ${selectedHalf === 'ALL' ? 'bg-white shadow text-slate-900' : 'text-slate-400'}`}
                          >
                            Whole Month
                          </button>
                          <button
                            type="button"
                            onClick={() => handleHalfChange('H1')}
                            className={`px-3 py-1 rounded-full text-[11px] font-bold transition whitespace-nowrap ${selectedHalf === 'H1' ? 'bg-white shadow text-slate-900' : 'text-slate-400'}`}
                          >
                            1st Half
                          </button>
                          <button
                            type="button"
                            onClick={() => handleHalfChange('H2')}
                            className={`px-3 py-1 rounded-full text-[11px] font-bold transition whitespace-nowrap ${selectedHalf === 'H2' ? 'bg-white shadow text-slate-900' : 'text-slate-400'}`}
                          >
                            2nd Half
                          </button>
                        </div>
                      )}
                      {monthFilter && <button onClick={() => setMonthFilter('')} className="text-slate-400 text-xs font-bold hover:text-slate-600">Clear</button>}
                    </div>
                  </div>
                  {filteredHistory.length > 0 && (
                    <div className="flex items-center justify-end gap-2 mb-3">
                      <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wide mr-1">Export:</span>
                      <button
                        type="button"
                        onClick={exportAttendanceCSV}
                        className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-[11px] font-bold px-3 py-1.5 rounded-full hover:bg-slate-200 transition"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        CSV
                      </button>
                      <button
                        type="button"
                        onClick={exportAttendancePDF}
                        className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-[11px] font-bold px-3 py-1.5 rounded-full hover:bg-slate-200 transition"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        PDF
                      </button>
                    </div>
                  )}
                  <div className="space-y-2">
                    {initLoading && <LoadingRow label="Loading..." />}
                    {!initLoading && filteredHistory.length === 0 && <p className="text-slate-400 text-xs">No records{monthFilter ? ' for this selected period' : ''}.</p>}
                    {filteredHistory.map((log, index) => (
                      <div key={index} className="flex items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 text-xs">{new Date(log.log_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                          <div className="text-slate-400 text-[10px]">{log.log_date}</div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={statusTagClass(log.status)}>{log.status}</span>
                          <div className="text-right">
                            <div className="font-semibold text-slate-700 text-xs">
                              {log.time_in ? new Date(log.time_in).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }) : '--:--'}
                              {log.time_out && <> – {new Date(log.time_out).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' })}</>}
                            </div>
                            {/* Single "Dispute" button -- lets the employee pick Time In or
                                Time Out on the choice screen, instead of two separate,
                                cramped buttons. Only one pending dispute is allowed per
                                date, so a single pending badge covers either type. */}
                            <div className="mt-1.5 flex justify-end">
                              {(() => {
                                const canDisputeTimeOut = !log.time_out && log.time_in;
                                const canDisputeLate = log.status?.toLowerCase() === 'late';
                                const isPending = hasPendingDispute(log.log_date, 'TimeIn') || hasPendingDispute(log.log_date, 'TimeOut');

                                if (isPending) {
                                  return (
                                    <span className="inline-flex items-center gap-1 text-orange-600 text-[9px] font-bold uppercase tracking-wide">
                                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                                      Dispute Pending
                                    </span>
                                  );
                                }

                                if (canDisputeTimeOut || canDisputeLate) {
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => openDisputeModal(log.id, log.log_date, canDisputeLate ? 'TimeIn' : 'TimeOut', false)}
                                      className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 text-[9px] font-bold uppercase tracking-wide px-3 py-1 rounded-full hover:bg-blue-100 transition whitespace-nowrap"
                                    >
                                      Dispute
                                    </button>
                                  );
                                }

                                // No time-in at all that day -- nothing to dispute yet.
                                if (!log.time_out && !log.time_in) {
                                  return <span className="text-slate-400 text-[9px] uppercase tracking-wide">No time out</span>;
                                }

                                return null;
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

          </div>
        </div>
      </div>

      <SummaryDetailModal formatMonthLabel={formatMonthLabel} setSummaryDetailType={setSummaryDetailType} statusTagClass={statusTagClass} summaryCutoffKey={summaryCutoffKey} summaryDetailInfo={summaryDetailInfo} summaryDetailType={summaryDetailType} />

      <MobileBottomNav
        actionCount={employeeActionCount}
        onHome={() => scrollToEmployeeSection('employee-dashboard-top')}
        onAttendance={openAttendanceFromNav}
        onLeave={() => setLeaveChoiceModalOpen(true)}
        onActionCenter={() => scrollToEmployeeSection('employee-action-center')}
        onProfile={openProfileFromNav}
      />

      <MobileAllToolsSheet
        open={mobileToolsOpen}
        darkMode={darkMode}
        employeeName={profile?.full_name || 'Employee'}
        designation={profile?.designation || 'Employee'}
        avatarUrl={profile?.avatar_url}
        attendanceLabel={attendanceQuickLabel}
        attendanceDisabled={attendanceQuickDisabled}
        onClose={() => setMobileToolsOpen(false)}
        onToggleTheme={toggleTheme}
        onLogout={handleLogout}
        onHome={() => scrollToEmployeeSection('employee-dashboard-top')}
        onAttendanceAction={runAttendanceQuickAction}
        onAttendanceHistory={openAttendanceFromNav}
        onLeave={() => setLeaveChoiceModalOpen(true)}
        onDisputes={() => { setSelectedMyDisputeDetail(null); setMyDisputesModalOpen(true); fetchMyDisputes(); }}
        onPayslips={() => { setPayslipsModalOpen(true); fetchPayslips(); }}
        onDocuments={() => { setDocumentsModalOpen(true); fetchEmployeeDocuments(); }}
        onDirectory={() => { setDirectoryModalOpen(true); setDirectorySearch(''); fetchDirectory(); }}
        onCalendar={openAttendanceCalendar}
        onNotifications={() => setNotificationsModalOpen(true)}
        onCommute={() => setCommuteModalOpen(true)}
        onHelpdesk={() => { setSupportModalOpen(true); fetchSupportRequests(); }}
        onActionCenter={() => scrollToEmployeeSection('employee-action-center')}
        onProfile={openProfileFromNav}
      />

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

      <AttendanceDisputeFormModal open={disputeModalOpen} onClose={() => setDisputeModalOpen(false)} disputeChoiceEligibility={disputeChoiceEligibility} disputeForm={disputeForm} disputeMsg={disputeMsg} disputeSaving={disputeSaving} disputeStep={disputeStep} disputeTypeLocked={disputeTypeLocked} formatTimeLocal={formatTimeLocal} handleDisputeDateChange={handleDisputeDateChange} proceedToDisputeConfirm={proceedToDisputeConfirm} selectDisputeType={selectDisputeType} setDisputeForm={setDisputeForm} setDisputeStep={setDisputeStep} submitDispute={submitDispute} />

      {/* Dispute Result Toast (auto-dismisses after 8s) */}
      {disputeResultToast && (
        <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-6 sm:top-24 sm:max-w-sm z-50">
          <div className={`rounded-2xl text-white p-4 shadow-2xl flex items-start gap-3 ${disputeResultToast.status === 'Approved' ? 'bg-green-600' : 'bg-rose-600'}`}>
            <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-lg">
              {disputeResultToast.status === 'Approved' ? '✅' : '❌'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">
                Dispute {disputeResultToast.status === 'Approved' ? 'Approved' : 'Declined'}
              </p>
              <p className="text-white/80 text-xs mt-1">
                Your {disputeResultToast.disputeType === 'TimeOut' ? 'time-out' : 'time-in'} dispute for {disputeResultToast.date} was {disputeResultToast.status === 'Approved' ? 'approved' : 'declined'} by HR.
              </p>
            </div>
            <button
              onClick={() => setDisputeResultToast(null)}
              className="text-white/60 hover:text-white flex-shrink-0"
              aria-label="Close notification"
              type="button"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Configurable Time-Out Reminder (in-page only) */}
      {showTimeOutReminder && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm z-50">
          <div className="rounded-2xl bg-slate-900 text-white p-4 shadow-2xl flex items-start gap-3">
            <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-lg">
              🔔
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">Don&apos;t forget to time out!</p>
              <p className="text-white/60 text-xs mt-1">It&apos;s already past {expectedTimeOutLabel}.</p>
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
      {/* Payslips Modal */}
      <PayslipsModal open={payslipsModalOpen} onClose={() => setPayslipsModalOpen(false)} loading={payslipsLoading} payslips={payslips} downloadingId={downloadingId} acknowledgingId={acknowledgingPayslipId} onDownload={downloadPayslip} onAcknowledge={acknowledgePayslip} />

      <PlanMyCommuteModal
        open={commuteModalOpen}
        onClose={() => setCommuteModalOpen(false)}
        darkMode={darkMode}
        initialDestination={weatherAdvisory?.location_name}
      />

      <LeaveChoiceModal open={leaveChoiceModalOpen} onClose={() => setLeaveChoiceModalOpen(false)} fetchMyLeaves={fetchMyLeaves} isRegular={isRegular} myLeavesCount={myLeaves.length} remainingCredits={remainingCredits} setLeaveForm={setLeaveForm} setLeaveModalOpen={setLeaveModalOpen} setLeaveMsg={setLeaveMsg} setMyLeavesModalOpen={setMyLeavesModalOpen} clearSelectedLeave={() => setSelectedMyLeaveDetail(null)} />

      <LeaveRequestsModal open={myLeavesModalOpen} onClose={() => setMyLeavesModalOpen(false)} onBackToChoice={() => { setMyLeavesModalOpen(false); setLeaveChoiceModalOpen(true); }} cancelLeave={cancelLeave} countLeaveDays={countLeaveDays} myLeaves={myLeaves} selectedMyLeaveDetail={selectedMyLeaveDetail} setSelectedMyLeaveDetail={setSelectedMyLeaveDetail} />

      <AttendanceDisputesModal open={myDisputesModalOpen} onClose={() => setMyDisputesModalOpen(false)} cancelDispute={cancelDispute} cancelingDisputeId={cancelingDisputeId} disputeClaimed={disputeClaimed} disputeFieldLabel={disputeFieldLabel} disputeOriginal={disputeOriginal} disputeTypeLabel={disputeTypeLabel} formatDisputeTimePh={formatDisputeTimePh} myDisputes={myDisputes} openDisputeModal={openDisputeModal} selectedMyDisputeDetail={selectedMyDisputeDetail} setSelectedMyDisputeDetail={setSelectedMyDisputeDetail} />

      {/* Employee Directory Modal */}
      <EmployeeDirectoryModal open={directoryModalOpen} onClose={() => setDirectoryModalOpen(false)} loading={directoryLoading} total={directoryEmployees.length} search={directorySearch} onSearchChange={setDirectorySearch} employees={filteredDirectory} initials={directoryInitials} />

      {/* Company Calendar Modal */}
      <CompanyCalendarModal open={calendarModalOpen} onClose={() => setCalendarModalOpen(false)} loading={holidaysLoading} holidays={companyHolidays} upcoming={upcomingHolidays} past={pastHolidays} formatDate={formatHolidayDate} daysUntil={daysUntilHoliday} />

      <LeaveRequestModal open={leaveModalOpen} onClose={() => setLeaveModalOpen(false)} onBack={() => { setLeaveModalOpen(false); setLeaveChoiceModalOpen(true); }} countLeaveDays={countLeaveDays} countLeaveHolidays={countLeaveHolidays} fallbackLeaveCredits={fallbackLeaveCredits} isRegular={isRegular} leaveCredits={leaveCredits} leaveForm={leaveForm} leaveMsg={leaveMsg} leaveSaving={leaveSaving} remainingCredits={remainingCredits} setLeaveForm={setLeaveForm} submitLeave={submitLeave} todayManila={todayManila} upcomingApprovedLeaves={upcomingApprovedLeaves} />

      {/* Leave Result Toast */}
      {leaveResultToast && (
        <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-6 sm:top-36 sm:max-w-sm z-50">
          <div className={`rounded-2xl text-white p-4 shadow-2xl flex items-start gap-3 ${leaveResultToast.status === 'Approved' ? 'bg-green-600' : 'bg-rose-600'}`}>
            <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-lg">
              {leaveResultToast.status === 'Approved' ? '✅' : '❌'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">Leave {leaveResultToast.status === 'Approved' ? 'Approved' : 'Declined'}</p>
              <p className="text-white/80 text-xs mt-1">Your {leaveResultToast.leave_type} leave request was {leaveResultToast.status === 'Approved' ? 'approved' : 'declined'} by HR.</p>
            </div>
            <button onClick={() => setLeaveResultToast(null)} className="text-white/60 hover:text-white flex-shrink-0" type="button">✕</button>
          </div>
        </div>
      )}

      {/* Notification Inbox Modal */}
      <NotificationsModal open={notificationsModalOpen} onClose={() => setNotificationsModalOpen(false)} notifications={employeeNotifications} unreadCount={unreadNotificationCount} readIds={readNotificationIds} onMarkAllRead={markAllNotificationsRead} onOpenNotification={openNotificationTarget} />

      {/* Attendance Calendar Modal */}
      <AttendanceCalendarModal open={attendanceCalendarOpen} onClose={() => setAttendanceCalendarOpen(false)} month={attendanceCalendarMonth} onMonthChange={(value) => { setAttendanceCalendarMonth(value); setSelectedAttendanceCalendarDate(null); }} availableMonths={availableMonths} formatMonth={formatMonthOnly} days={attendanceCalendarDays} selectedDate={selectedAttendanceCalendarDate} onSelectDate={setSelectedAttendanceCalendarDate} selectedDay={selectedAttendanceCalendarDay} />

      {/* Help Desk / HR Request Modal */}
      <HelpDeskModal open={supportModalOpen} onClose={() => setSupportModalOpen(false)} saving={supportSaving} loading={supportLoading} message={supportMessage} form={supportForm} setForm={setSupportForm} requests={supportRequests} onSubmit={submitSupportRequest} />

      {/* Employee Documents Modal */}
      <EmployeeDocumentsModal open={documentsModalOpen} onClose={() => setDocumentsModalOpen(false)} loading={documentsLoading} documents={employeeDocuments} downloadingId={downloadingDocumentId} onDownload={downloadEmployeeDocument} />

      <EarlyTimeOutModal open={showEarlyTimeOutWarning} onClose={() => setShowEarlyTimeOutWarning(false)} expectedTimeOutLabel={expectedTimeOutLabel} handleTimeOut={handleTimeOut} timeOutLoading={timeOutLoading} />



    </main>
  );
}
