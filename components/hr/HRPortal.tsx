'use client';
import { applyPortalTheme } from '@/lib/portal-theme';
import HRDesktopSidebar from '@/components/hr/HRDesktopSidebar';
import HRMobileBottomNav from '@/components/hr/HRMobileBottomNav';
import HRMobileToolsSheet from '@/components/hr/HRMobileToolsSheet';
import HRDashboardHeader from '@/components/hr/HRDashboardHeader';
import HRDashboardStats from '@/components/hr/HRDashboardStats';
import HRDashboardAnnouncement from '@/components/hr/HRDashboardAnnouncement';
import HRDashboardPending from '@/components/hr/HRDashboardPending';
import HRDashboardQuickActions from '@/components/hr/HRDashboardQuickActions';
import HRDashboardAnalytics from '@/components/hr/HRDashboardAnalytics';
import HRAttendanceHistory from '@/components/hr/HRAttendanceHistory';
import hrStyles from '@/components/hr/hr-dashboard.module.css';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { BadgeAlert, CalendarCheck2, CalendarDays, CalendarRange, Coins, ContactRound, FileChartColumn, FolderDown, LifeBuoy, Megaphone, RefreshCw, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useVerificationDialog } from '@/components/shared/useVerificationDialog';
import { APP_SETTING_DEFINITIONS, DEFAULT_APP_SETTINGS, normalizeAppSettings, type AppSettingsValues } from '@/lib/app-settings';
import { resolveSeasonalTheme, SEASONAL_THEME_PRESENTATION } from '@/lib/seasonal-theme';
import { computeLateMinutes } from '@/lib/attendance-rules';

import { type AttendanceDispute, type LeaveRequest } from '@/lib/types/hr';
import SeasonalDecor from '@/components/seasonal/SeasonalDecor';

import HRAttendanceAnalyticsView from '@/components/hr/hr-portal/HRAttendanceAnalyticsView';
import { HRAttendanceInsightsOverlay, HRDailyOverviewOverlay } from '@/components/hr/hr-portal/HRPortalOverlays';
import HrPendingRequestsSections from '@/components/hr/hr-portal/HrPendingRequestsSections';
import {
  disputeClaimed,
  disputeFieldLabel,
  disputeOriginal,
  disputeTypeLabel,
  formatCutoffLabel,
  formatPh,
  generateCutoffOptions,
  initials,
  type AttendanceLog,
  type AttendanceChartSelection,
  type Profile,
} from '@/components/hr/hr-portal/shared';
import { useHrLeaveCredits } from '@/components/hr/hr-portal/useHrLeaveCredits';
import { useHrReports } from '@/components/hr/hr-portal/useHrReports';
import { useHrAnnouncement } from '@/components/hr/hr-portal/useHrAnnouncement';
import { useHrPayslips } from '@/components/hr/hr-portal/useHrPayslips';
import { useHrDisputes } from '@/components/hr/hr-portal/useHrDisputes';
import { useHrLeaveRequests } from '@/components/hr/hr-portal/useHrLeaveRequests';
import { useHrHolidays } from '@/components/hr/hr-portal/useHrHolidays';
import { useHrHelpdesk } from '@/components/hr/hr-portal/useHrHelpdesk';
import { useHrDocuments } from '@/components/hr/hr-portal/useHrDocuments';
import { useHrEmployeeEditor } from '@/components/hr/hr-portal/useHrEmployeeEditor';
import { useHrDashboardStats } from '@/components/hr/hr-portal/useHrDashboardStats';
import { useHrAttendanceChart } from '@/components/hr/hr-portal/useHrAttendanceChart';
import { useHrQuickView } from '@/components/hr/hr-portal/useHrQuickView';

const EmployeeQuickViewModal = dynamic(() => import('@/components/hr/modals/EmployeeQuickViewModal'));
const TeamLeaveCalendarModal = dynamic(() => import('@/components/hr/modals/TeamLeaveCalendarModal'));
const AnnouncementsModal = dynamic(() => import('@/components/hr/modals/AnnouncementsModal'));
const HolidaysModal = dynamic(() => import('@/components/hr/modals/HolidaysModal'));
const EmployeesModal = dynamic(() => import('@/components/hr/modals/EmployeesModal'));
const EmployeeChoiceModal = dynamic(() => import('@/components/hr/modals/EmployeeChoiceModal'));
const EmployeeEditModal = dynamic(() => import('@/components/hr/modals/EmployeeEditModal'));
const PayslipManagementModal = dynamic(() => import('@/components/hr/modals/PayslipManagementModal'));
const DisputeHistoryModal = dynamic(() => import('@/components/hr/modals/DisputeHistoryModal'));
const LeaveHistoryModal = dynamic(() => import('@/components/hr/modals/LeaveHistoryModal'));
const LeaveCreditsModal = dynamic(() => import('@/components/hr/modals/LeaveCreditsModal'));
const ExportReportsModal = dynamic(() => import('@/components/hr/modals/ExportReportsModal'));
const HelpDeskRequestsModal = dynamic(() => import('@/components/hr/modals/HelpDeskRequestsModal'));
const EmployeeDocumentsModal = dynamic(() => import('@/components/hr/modals/EmployeeDocumentsModal'));
const HRActionCenterModal = dynamic(() => import('@/components/hr/modals/HRActionCenterModal'));

export default function HRPortal({ view = 'dashboard', initialEmployeeId = '' }: { view?: 'dashboard' | 'attendance'; initialEmployeeId?: string }) {
  const isAttendancePage = view === 'attendance';
  const router = useRouter();
  const { verify, verificationDialog } = useVerificationDialog();
  const [attendance, setAttendance] = useState<AttendanceLog[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Which modal is open: null | 'choice' | 'edit' | 'payslips'
  const [modalMode, setModalMode] = useState<null | 'choice' | 'edit' | 'payslips'>(null);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [disputesHistoryModalOpen, setDisputesHistoryModalOpen] = useState(false);
  const [selectedDisputeDetail, setSelectedDisputeDetail] = useState<AttendanceDispute | null>(null);
  const [selectedLeaveDetail, setSelectedLeaveDetail] = useState<LeaveRequest | null>(null);
  const [leaveHistoryModalOpen, setLeaveHistoryModalOpen] = useState(false);
  const [incomingRequestAlert, setIncomingRequestAlert] = useState<{ type: 'dispute' | 'leave'; title: string; detail: string } | null>(null);
  const [employeesListOpen, setEmployeesListOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [actionCenterOpen, setActionCenterOpen] = useState(false);
  const PAGE_SIZE = 10;
  const [employeesPage, setEmployeesPage] = useState(1);
  const [leaveCalendarOpen, setLeaveCalendarOpen] = useState(false);
  const [leaveCalendarMonth, setLeaveCalendarMonth] = useState(() =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7)
  );
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [dailyOverviewModal, setDailyOverviewModal] = useState<null | 'present' | 'late' | 'leave' | 'notTimedIn'>(null);
  const [attendanceInsightModal, setAttendanceInsightModal] = useState<null | 'attendance' | 'late' | 'absent' | 'leave'>(null);
  const [attendanceInsightRange, setAttendanceInsightRange] = useState<AttendanceChartSelection | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  // App-wide configurable settings (late cutoff, default leave credits)
  // -- fetched once on load from app_settings, editable by Super Admin
  // without needing a code change/redeploy. Falls back to the
  // module-level constants above until the fetch resolves.
  const [lateCutoffHour, setLateCutoffHour] = useState(9);
  const [lateCutoffMinute, setLateCutoffMinute] = useState(15);
  const [fallbackLeaveCredits, setFallbackLeaveCredits] = useState(10);
  const [appSettings, setAppSettings] = useState<AppSettingsValues>({ ...DEFAULT_APP_SETTINGS });
  const seasonalTheme = useMemo(() => resolveSeasonalTheme(appSettings, 'hr'), [appSettings]);
  const seasonalPresentation = SEASONAL_THEME_PRESENTATION[seasonalTheme.variant];
  const timeOutReminderHour = typeof appSettings.time_out_reminder_hour === 'number'
    ? appSettings.time_out_reminder_hour
    : 19;

  const fetchAppSettings = useCallback(async () => {
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', APP_SETTING_DEFINITIONS.map((setting) => setting.key));
    if (error) {
      console.error('Error fetching app settings:', error);
      return;
    }
    const map = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
    if (typeof map.late_cutoff_hour === 'number') setLateCutoffHour(map.late_cutoff_hour);
    if (typeof map.late_cutoff_minute === 'number') setLateCutoffMinute(map.late_cutoff_minute);
    if (typeof map.default_leave_credits === 'number') setFallbackLeaveCredits(map.default_leave_credits);
    setAppSettings(normalizeAppSettings(data));
  }, []);

  const refreshAllData = async () => {
    setLoadingData(true);
    setRefreshing(true);
    setErrorMsg(null);

    const [att, prof] = await Promise.all([
      supabase
        .from('attendance_logs')
        .select('*, profiles!inner(full_name, is_active), early_out_offset_requests(status, required_minutes)')
        .eq('profiles.role', 'employee')
        .or('is_active.eq.true,resigned_date.not.is.null', { referencedTable: 'profiles' })
        .order('log_date', { ascending: false })
        .order('time_in', { ascending: false, nullsFirst: false }),
      supabase.rpc('get_employee_roster', { p_mode: 'hr_history' }),
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
    setRefreshing(false);
    setLastUpdatedAt(new Date());
  };

  // Match Employee and Offset requests: grace gates Late, duration starts at 9:00 AM.
  const getMinutesLate = (timeInIso: string) => computeLateMinutes(timeInIso, lateCutoffHour, lateCutoffMinute);

  // --- Domain hooks (leave credits, export reports, announcements,
  // payslips, disputes, leave requests, holidays, helpdesk, documents,
  // employee editor) ---
  const {
    leaveCreditsModalOpen, setLeaveCreditsModalOpen, leaveCreditsLoading,
    leaveCreditsData, sortedLeaveCreditsData, setLeaveCreditsFetched,
    fetchLeaveCreditsOverview, openLeaveCreditsModal, getLeaveBalance,
  } = useHrLeaveCredits({ fallbackLeaveCredits });

  const {
    exportModalOpen, setExportModalOpen, exportCutoff, setExportCutoff, exportEmployeeId, setExportEmployeeId,
    rawExportMonth, setRawExportMonth, rawExportPeriod, setRawExportPeriod, exportingType, exportMsg, setExportMsg,
    availableCutoffs, openReports, exportPayrollSummaryCSV, exportPayrollSummaryPDF,
    exportEmployeeMasterListCSV, exportEmployeeMasterListPDF, exportRawAttendanceCSV, exportRawAttendancePDF,
    rawExportPreviewCount,
  } = useHrReports({ attendance, profiles, getMinutesLate });

  const {
    announcementId, announcementContent, setAnnouncementContent, announcementImageUrl,
    announcementImageInputRef, announcementImagePreview, announcementRemoveImage, announcementOpen,
    setAnnouncementOpen, announcementUpdatedAt, announcementLoading, announcementSaving, announcementMsg,
    announcementAlreadyPublished, fetchAnnouncement, handleAnnouncementImageChange, clearAnnouncementImage,
    saveAnnouncement,
  } = useHrAnnouncement();

  const {
    payslipFile, setPayslipFile, payslipCutoff, setPayslipCutoff, payslipUploading, payslipMsg,
    employeePayslips, employeePayslipsLoading, payslipFileRef, publishingId, publishMsg,
    publishPayslip, uploadPayslip, deletePayslip, openPayslipsModal,
  } = useHrPayslips({ verify, setModalMode });

  const {
    disputes, disputesLoading, disputeActionLoadingId, disputeMsg, fetchDisputes, approveDispute, rejectDispute,
  } = useHrDisputes({ refreshAllData, lateCutoffHour, lateCutoffMinute });

  const {
    holidays, holidaysLoading, setHolidaysFetched,
    newHolidayDate, setNewHolidayDate, newHolidayName, setNewHolidayName, holidaySaving, holidayMsg,
    holidaysOpen, setHolidaysOpen, toggleHolidays, addHoliday, deleteHoliday, fetchHolidays,
  } = useHrHolidays({ verify });

  const {
    leaveRequests, leaveRequestsLoading, fetchLeaveRequests, leaveActionLoadingId, leaveMsg,
    leaveHrNotes, setLeaveHrNotes, countLeaveDays, approveLeave, rejectLeave, cancelApprovedLeave,
  } = useHrLeaveRequests({ holidays });

  const {
    hrSupportModalOpen, setHrSupportModalOpen, hrSupportRequests, hrSupportLoading, hrSupportSavingId,
    hrSupportDrafts, setHrSupportDrafts, fetchHrSupportRequests, saveHrSupportRequest,
  } = useHrHelpdesk();

  const {
    hrDocumentsModalOpen, setHrDocumentsModalOpen, hrDocuments, hrDocumentsLoading, hrDocumentSaving,
    hrDocumentTitle, setHrDocumentTitle, hrDocumentCategory, setHrDocumentCategory, hrDocumentFile,
    setHrDocumentFile, hrDocumentFileRef, fetchHrDocuments, uploadHrDocument, toggleHrDocument, deleteHrDocument,
  } = useHrDocuments({ verify });

  const {
    editing, setEditing, saveLoading, avatarPreview, currentAvatarUrl, avatarUploading, avatarInputRef,
    handleAvatarChange, openEdit, editingEmployeeIdConflict, saveEdit,
  } = useHrEmployeeEditor({ profiles, setErrorMsg, setModalMode, refreshAllData });

  const {
    globalEmployeeSearch, setGlobalEmployeeSearch,
    quickViewProfile, setQuickViewProfile,
    globalEmployeeMatches, quickViewAttendance, quickViewCredits,
  } = useHrQuickView({ attendance, profiles, leaveCreditsData });

  useEffect(() => {
    const moduleModalOpen = announcementOpen || holidaysOpen || employeesListOpen || leaveCalendarOpen || hrSupportModalOpen || hrDocumentsModalOpen || !!quickViewProfile || !!dailyOverviewModal || !!attendanceInsightModal;
    if (!moduleModalOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (announcementOpen && !announcementSaving) setAnnouncementOpen(false);
      if (holidaysOpen && !holidaySaving) setHolidaysOpen(false);
      if (employeesListOpen) setEmployeesListOpen(false);
      if (leaveCalendarOpen) setLeaveCalendarOpen(false);
      if (quickViewProfile) setQuickViewProfile(null);
      if (dailyOverviewModal) setDailyOverviewModal(null);
      if (attendanceInsightModal) setAttendanceInsightModal(null);
      if (hrSupportModalOpen && !hrSupportSavingId) setHrSupportModalOpen(false);
      if (hrDocumentsModalOpen && !hrDocumentSaving) setHrDocumentsModalOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [announcementOpen, announcementSaving, holidaysOpen, holidaySaving, employeesListOpen, leaveCalendarOpen, hrSupportModalOpen, hrDocumentsModalOpen, hrSupportSavingId, hrDocumentSaving, quickViewProfile, dailyOverviewModal, attendanceInsightModal]);

  useEffect(() => {
    const runStartupSweeps = async () => {
      // Catch-up sweeps, run once per dashboard load, before pulling any
      // attendance/leave data -- so anything they generate (a fresh
      // 'Absent' row, a newly-deducted leave credit) is already reflected
      // in what gets fetched right after.
      const [{ error: leaveSweepError }, { error: absenceSweepError }] = await Promise.all([
        supabase.rpc('settle_overdue_leave_days'),
        supabase.rpc('settle_overdue_absences'),
      ]);
      if (leaveSweepError) console.error('Error settling overdue leave days:', leaveSweepError);
      if (absenceSweepError) console.error('Error settling overdue absences:', absenceSweepError);

      refreshAllData();
      fetchLeaveRequests();
    };
    // Attendance is read-only; keep catch-up writes on the dashboard.
    if (isAttendancePage) { void refreshAllData(); void fetchLeaveRequests(); }
    else void runStartupSweeps();
    fetchAppSettings();
    fetchAnnouncement();
    fetchDisputes();
    setLeaveCreditsFetched(true);
    fetchLeaveCreditsOverview();
    setHolidaysFetched(true);
    fetchHolidays();
    fetchHrSupportRequests();
    fetchHrDocuments();
  }, [isAttendancePage]);

  const {
    todayManila, todaysLogs, presentTodayCount, lateTodayCount, notYetTimedInToday, onLeaveTodayCount,
  } = useHrDashboardStats({ attendance, profiles, leaveRequests });
  const lowLeaveCreditsCount = leaveCreditsData.filter((employee) => {
    if (employee.employment_status !== 'Regular') return false;
    const total = employee.total_credits ?? fallbackLeaveCredits;
    return total - (employee.used_credits ?? 0) <= 3;
  }).length;
  const upcomingHolidaysCount = holidays.filter((holiday) => holiday.holiday_date >= todayManila).length;
  const announcementModuleLabel = announcementUpdatedAt
    ? `Updated ${new Date(announcementUpdatedAt).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' })}`
    : 'Create an announcement';

  // Keep the HR dashboard current without repeatedly refetching every table.
  // One initial load is already performed above; relevant DB changes trigger
  // a targeted dashboard refresh while this page is open.
  useEffect(() => {
    let refreshTimer: number | null = null;
    const scheduleRefresh = () => {
      if (document.visibilityState !== 'visible' || refreshTimer !== null) return;
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        void refreshAllData();
      }, 350);
    };
    const channel = supabase
      .channel('hr-dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_disputes' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_support_requests' }, scheduleRefresh)
      .subscribe();
    return () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, []);

  const calendarData = useMemo(() => {
    const [year, month] = leaveCalendarMonth.split('-').map(Number);
    if (!year || !month) return { blanks: 0, days: [] as { date: string; day: number; leaves: any[]; holiday: { id: string; holiday_date: string; name: string } | null }[] };
    const daysInMonth = new Date(year, month, 0).getDate();
    const blanks = new Date(year, month - 1, 1).getDay();
    const days = Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const date = `${leaveCalendarMonth}-${String(day).padStart(2, '0')}`;
      return {
        date,
        day,
        leaves: leaveRequests.filter((leave) => leave.status === 'Approved' && leave.start_date <= date && leave.end_date >= date),
        holiday: holidays.find((holiday) => holiday.holiday_date === date) ?? null,
      };
    });
    return { blanks, days };
  }, [leaveCalendarMonth, leaveRequests, holidays]);
  const selectedCalendarDay = selectedCalendarDate
    ? calendarData.days.find((day) => day.date === selectedCalendarDate) ?? null
    : null;


  const {
    attendanceChartMonth, setAttendanceChartMonth,
    attendanceChartMode, setAttendanceChartMode,
    activeAttendanceSlice, setActiveAttendanceSlice,
    attendanceInsights, attendanceChartData, attendanceTrendData,
    chartTextColor, chartLineColor,
  } = useHrAttendanceChart({ attendance, darkMode });

  const openAttendanceChartDetail = (kind: 'attendance' | 'late' | 'leave' | 'absent', row: { start?: string | number; end?: string | number; label?: string | number }) => {
    if (!row.start || !row.end) return;
    setAnalyticsOpen(false);
    setAttendanceInsightRange({ start: String(row.start), end: String(row.end), label: row.label == null ? 'Selected period' : String(row.label) });
    setAttendanceInsightModal(kind);
  };

  const pendingDisputesCount = disputes.filter((dispute) => dispute.status === 'Pending').length;
  const pendingLeaveCount = leaveRequests.filter((leave) => leave.status === 'Pending').length;
  const openHrSupportCount = hrSupportRequests.filter((request) => !['Resolved', 'Cancelled'].includes(request.status)).length;
  const activeHrDocumentsCount = hrDocuments.filter((document) => document.is_active).length;

  const employeesTotalPages = Math.max(1, Math.ceil(profiles.length / PAGE_SIZE));
  const paginatedProfiles = profiles.slice(
    (employeesPage - 1) * PAGE_SIZE,
    employeesPage * PAGE_SIZE
  );

  useEffect(() => {
    let dismissTimer: number | null = null;
    const showIncomingAlert = (alert: { type: 'dispute' | 'leave'; title: string; detail: string }) => {
      setIncomingRequestAlert(alert);
      if (dismissTimer) window.clearTimeout(dismissTimer);
      dismissTimer = window.setTimeout(() => setIncomingRequestAlert(null), 10_000);
    };
    const channel = supabase
      .channel('hr-incoming-requests')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance_disputes' }, () => {
        void fetchDisputes();
        showIncomingAlert({ type: 'dispute', title: 'New attendance dispute', detail: 'An employee submitted an attendance correction for HR review.' });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leave_requests' }, () => {
        void fetchLeaveRequests();
        showIncomingAlert({ type: 'leave', title: 'New leave request', detail: 'An employee submitted a leave request for HR approval.' });
      })
      .subscribe();
    return () => {
      if (dismissTimer) window.clearTimeout(dismissTimer);
      void supabase.removeChannel(channel);
    };
  }, []);

  const applyTheme = (useDark: boolean) => {
    applyPortalTheme(useDark);
    try { localStorage.setItem('theme', useDark ? 'dark' : 'light'); } catch { /* storage can be unavailable */ }
    setDarkMode(useDark);
  };
  const toggleTheme = () => applyTheme(!darkMode);
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  useEffect(() => {
    queueMicrotask(() => setDarkMode(document.documentElement.classList.contains('dark')));
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('hr-app-settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, () => { void fetchAppSettings(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [fetchAppSettings]);

  const pendingHrActionCount = pendingDisputesCount + pendingLeaveCount + openHrSupportCount;
  const openDocuments = () => { setHrDocumentsModalOpen(true); fetchHrDocuments(); };
  const openHelpdesk = () => { setHrSupportModalOpen(true); fetchHrSupportRequests(); };
  const openLeaveCalendar = () => { setSelectedCalendarDate(null); setLeaveCalendarOpen(true); };
  const openHolidays = () => { if (!holidaysOpen) toggleHolidays(); };
  const openAttendanceLog = () => router.push('/hr/attendance');
  const goDashboard = () => router.push('/hr');
  // Opens the choice modal Ã¢â‚¬â€ HR picks Edit Profile or Payslips
  const openProfileChoice = (p: Profile) => {
    setSelectedProfile(p);
    setModalMode('choice');
  };
  const closeModal = () => {
    setModalMode(null);
    setSelectedProfile(null);
  };
  const openAttendanceSummary = (kind: 'attendance' | 'late' | 'leave' | 'absent') => {
    setAnalyticsOpen(false);
    setAttendanceInsightRange(null);
    setAttendanceInsightModal(kind);
  };

  const analyticsContent = (
    <HRAttendanceAnalyticsView
      attendanceTrendData={attendanceTrendData}
      attendanceChartData={attendanceChartData}
      currentMonthLogCount={attendanceInsights.current.logs.length}
      profilesCount={profiles.length}
      darkMode={darkMode}
      chartTextColor={chartTextColor}
      chartLineColor={chartLineColor}
      attendanceChartMonth={attendanceChartMonth}
      setAttendanceChartMonth={setAttendanceChartMonth}
      attendanceChartMode={attendanceChartMode}
      setAttendanceChartMode={setAttendanceChartMode}
      activeAttendanceSlice={activeAttendanceSlice}
      setActiveAttendanceSlice={setActiveAttendanceSlice}
      openAttendanceChartDetail={openAttendanceChartDetail}
      openAttendanceSummary={openAttendanceSummary}
    />
  );

  return (
    <main id="hr-dashboard-top" data-attendance-open={isAttendancePage} className={`dashboard-shell hr-dashboard relative min-h-screen overflow-x-hidden transition-colors ${hrStyles.dashboard} ${seasonalTheme.active ? `seasonal-theme seasonal-${seasonalTheme.variant} seasonal-${seasonalTheme.intensity}` : ''}`}>
      {seasonalTheme.active && seasonalTheme.snowEnabled ? <SeasonalDecor variant={seasonalTheme.variant} intensity={seasonalTheme.intensity} particle={seasonalPresentation.particle} /> : null}
      <HRDesktopSidebar attendanceOpen={isAttendancePage} darkMode={darkMode} leaveRequestCount={pendingLeaveCount} disputeCount={pendingDisputesCount} onDashboard={goDashboard} onAttendance={openAttendanceLog} onEmployees={() => setEmployeesListOpen(true)} onLeave={() => { setSelectedLeaveDetail(null); setLeaveHistoryModalOpen(true); }} onDisputes={() => { setSelectedDisputeDetail(null); setDisputesHistoryModalOpen(true); }} onPayslips={() => setEmployeesListOpen(true)} onDocuments={openDocuments} onAnnouncements={() => setAnnouncementOpen(true)} onHolidays={openHolidays} onReports={openReports} onHelpdesk={openHelpdesk} onToggleTheme={toggleTheme} onLogout={handleLogout} />
      <div className={`seasonal-content relative z-[3] ${hrStyles.content}`}>
        {incomingRequestAlert ? <div role="status" aria-live="polite" className="fixed inset-x-3 top-3 z-[80] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-green-300 bg-white p-3 shadow-2xl dark:border-green-800 dark:!bg-[#17231b] sm:left-auto sm:right-5 sm:top-5 sm:mx-0"><span className={`grid h-11 w-11 flex-none place-items-center rounded-2xl text-white shadow ${incomingRequestAlert.type === 'dispute' ? 'bg-gradient-to-br from-orange-500 to-red-700' : 'bg-gradient-to-br from-blue-500 to-indigo-700'}`}>{incomingRequestAlert.type === 'dispute' ? <BadgeAlert size={22} strokeWidth={2.8}/> : <CalendarCheck2 size={22} strokeWidth={2.8}/>}</span><button type="button" onClick={() => { if (incomingRequestAlert.type === 'dispute') { setSelectedDisputeDetail(null); setDisputesHistoryModalOpen(true); } else { setSelectedLeaveDetail(null); setLeaveHistoryModalOpen(true); } setIncomingRequestAlert(null); }} className="min-w-0 flex-1 text-left"><span className="block text-xs font-extrabold text-slate-950 dark:!text-white">{incomingRequestAlert.title}</span><span className="mt-0.5 block text-[10px] leading-relaxed text-slate-600 dark:!text-slate-300">{incomingRequestAlert.detail}</span><span className="mt-1 block text-[10px] font-bold text-green-700 dark:!text-green-300">Tap to review</span></button><button type="button" onClick={() => setIncomingRequestAlert(null)} className="grid h-9 w-9 flex-none place-items-center rounded-full bg-slate-100 text-lg text-slate-600 dark:!bg-[#29362d] dark:!text-white" aria-label="Dismiss notification">Ãƒâ€”</button></div> : null}

        {errorMsg && <div role="alert" className={`p-3 rounded-xl text-xs font-bold bg-red-50 text-red-700 ${hrStyles.notice}`}>{errorMsg}</div>}
        {!isAttendancePage && <>
        <HRDashboardHeader darkMode={darkMode} pendingCount={pendingHrActionCount} onToggleTheme={toggleTheme} onNotifications={() => setActionCenterOpen(true)} onTools={() => setMobileToolsOpen(true)} />

        <HRDashboardStats present={presentTodayCount} late={lateTodayCount} leave={onLeaveTodayCount} notTimedIn={notYetTimedInToday.length} loading={loadingData} onSelect={setDailyOverviewModal} />

        {/* Global employee search + live refresh */}
        <div className={hrStyles.toolbar}>
          <div className="relative flex-1 min-w-0">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="search"
              value={globalEmployeeSearch}
              onChange={(e) => setGlobalEmployeeSearch(e.target.value)}
              placeholder="Search employee name, ID, or designation..." aria-label="Search employees"
              className="input-field !pl-9 !py-2 !text-xs !min-h-0 w-full"
            />
            {globalEmployeeSearch.trim() && (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                {globalEmployeeMatches.length === 0 ? (
                  <p className="p-4 text-slate-400 text-xs text-center">No matching employee found.</p>
                ) : globalEmployeeMatches.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => { setQuickViewProfile(profile); setGlobalEmployeeSearch(''); }}
                    className="flex w-full items-center gap-3 border-b border-slate-100 p-3 text-left transition last:border-0 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    <span className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0">{initials(profile.full_name)}</span>
                    <span className="min-w-0"><span className="block text-xs font-bold text-slate-900 truncate">{profile.full_name || 'Unknown'}{profile.resigned_date ? <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">RESIGNED</span> : null}</span><span className="block text-[10px] text-slate-400 truncate">{profile.employee_id || 'No ID'} Ã‚Â· {profile.designation || 'No designation'}</span></span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className={hrStyles.refreshGroup}>
            <span className="text-[10px] text-slate-400 font-medium">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
              {lastUpdatedAt ? `Updated ${lastUpdatedAt.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' })}` : 'Loading live data'}
            </span>
            <button type="button" onClick={refreshAllData} disabled={refreshing} aria-label="Refresh HR dashboard">
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> <span>Refresh</span>
            </button>
          </div>
        </div>

        <HRDashboardAnnouncement content={announcementContent} imageUrl={announcementImageUrl} updatedAt={announcementUpdatedAt} loading={announcementLoading} onManage={() => setAnnouncementOpen(true)} />

        <HRDashboardAnalytics open={analyticsOpen} onClose={() => setAnalyticsOpen(false)}>{analyticsContent}</HRDashboardAnalytics>
        <div className={hrStyles.bottom}>
          <HRDashboardQuickActions onAnalytics={() => setAnalyticsOpen(true)} actions={[
            { title: 'Leave Requests', description: pendingLeaveCount ? `${pendingLeaveCount} pending` : 'All clear', icon: CalendarCheck2, action: () => { setSelectedLeaveDetail(null); setLeaveHistoryModalOpen(true); }, count: pendingLeaveCount },
            { title: 'Attendance Disputes', description: pendingDisputesCount ? `${pendingDisputesCount} pending` : 'All clear', icon: BadgeAlert, action: () => { setSelectedDisputeDetail(null); setDisputesHistoryModalOpen(true); }, count: pendingDisputesCount },
            { title: 'Leave Credits', description: leaveCreditsLoading ? 'Checking...' : lowLeaveCreditsCount ? `${lowLeaveCreditsCount} low` : 'Healthy', icon: Coins, action: openLeaveCreditsModal },
            { title: 'Export Reports', description: 'CSV & PDF', icon: FileChartColumn, action: openReports },
            { title: 'Announcements', description: announcementModuleLabel, icon: Megaphone, action: () => setAnnouncementOpen(true) },
            { title: 'Holidays', description: holidaysLoading ? 'Checking...' : `${upcomingHolidaysCount} upcoming`, icon: CalendarDays, action: openHolidays },
            { title: 'Employees', description: `${profiles.length} total`, icon: ContactRound, action: () => setEmployeesListOpen(true) },
            { title: 'Leave Calendar', description: 'Leaves & holidays', icon: CalendarRange, action: openLeaveCalendar },
            { title: 'Help Desk', description: openHrSupportCount ? `${openHrSupportCount} open` : 'All clear', icon: LifeBuoy, action: openHelpdesk, count: openHrSupportCount },
            { title: 'Documents', description: `${activeHrDocumentsCount} published`, icon: FolderDown, action: openDocuments },
          ]} />
          <HRDashboardPending leaveCount={pendingLeaveCount} disputeCount={pendingDisputesCount} helpdeskCount={openHrSupportCount} onLeave={() => { setSelectedLeaveDetail(null); setLeaveHistoryModalOpen(true); }} onDisputes={() => { setSelectedDisputeDetail(null); setDisputesHistoryModalOpen(true); }} onHelpdesk={openHelpdesk} onReview={() => setActionCenterOpen(true)} />
        </div>
        </>}
        {isAttendancePage && <HRAttendanceHistory key={initialEmployeeId} records={attendance} profiles={profiles} loading={loadingData} refreshing={refreshing} updatedAt={lastUpdatedAt} initialEmployeeId={initialEmployeeId} timeOutHour={timeOutReminderHour} lateCutoffHour={lateCutoffHour} lateCutoffMinute={lateCutoffMinute} disputes={disputes} darkMode={darkMode} onToggleTheme={toggleTheme} onTools={() => setMobileToolsOpen(true)} onRefresh={refreshAllData} onDashboard={goDashboard} />}

        <HRAttendanceInsightsOverlay modal={attendanceInsightModal} setModal={setAttendanceInsightModal} attendance={attendance} attendanceChartMonth={attendanceChartMonth} range={attendanceInsightRange} />

        <HRDailyOverviewOverlay modal={dailyOverviewModal} setModal={setDailyOverviewModal} attendance={attendance} profiles={profiles} leaveRequests={leaveRequests} todayManila={todayManila} />

        <EmployeeQuickViewModal fallbackLeaveCredits={fallbackLeaveCredits} formatPh={formatPh} initials={initials} openPayslipsModal={openPayslipsModal} openProfileChoice={openProfileChoice} quickViewAttendance={quickViewAttendance} quickViewCredits={quickViewCredits} quickViewProfile={quickViewProfile} onAttendance={(profile) => { setQuickViewProfile(null); router.push(`/hr/attendance?employee=${encodeURIComponent(profile.id)}`); }} setQuickViewProfile={setQuickViewProfile} timeOutReminderHour={timeOutReminderHour} todayManila={todayManila} />

        <TeamLeaveCalendarModal open={leaveCalendarOpen} onClose={() => setLeaveCalendarOpen(false)} calendarData={calendarData} leaveCalendarMonth={leaveCalendarMonth} selectedCalendarDate={selectedCalendarDate} selectedCalendarDay={selectedCalendarDay} setLeaveCalendarMonth={setLeaveCalendarMonth} setSelectedCalendarDate={setSelectedCalendarDate} todayManila={todayManila} />

        <AnnouncementsModal announcementAlreadyPublished={announcementAlreadyPublished} open={announcementOpen} onClose={() => setAnnouncementOpen(false)} announcementContent={announcementContent} announcementId={announcementId} announcementImageInputRef={announcementImageInputRef} announcementImagePreview={announcementImagePreview} announcementImageUrl={announcementImageUrl} announcementLoading={announcementLoading} announcementMsg={announcementMsg} announcementRemoveImage={announcementRemoveImage} announcementSaving={announcementSaving} announcementUpdatedAt={announcementUpdatedAt} clearAnnouncementImage={clearAnnouncementImage} handleAnnouncementImageChange={handleAnnouncementImageChange} publishAnnouncement={() => saveAnnouncement(true)} saveAnnouncement={() => saveAnnouncement(false)} setAnnouncementContent={setAnnouncementContent} />

        <HolidaysModal open={holidaysOpen} onClose={() => setHolidaysOpen(false)} addHoliday={addHoliday} deleteHoliday={deleteHoliday} holidayMsg={holidayMsg} holidaySaving={holidaySaving} holidays={holidays} holidaysLoading={holidaysLoading} newHolidayDate={newHolidayDate} newHolidayName={newHolidayName} setNewHolidayDate={setNewHolidayDate} setNewHolidayName={setNewHolidayName} />

        {/* Requests are managed from Quick Actions; retained here only as a non-rendered fallback. */}
        <HrPendingRequestsSections disputes={disputes} disputesLoading={disputesLoading} disputeMsg={disputeMsg} disputeActionLoadingId={disputeActionLoadingId} approveDispute={approveDispute} rejectDispute={rejectDispute} setSelectedDisputeDetail={setSelectedDisputeDetail} setDisputesHistoryModalOpen={setDisputesHistoryModalOpen} leaveRequests={leaveRequests} leaveRequestsLoading={leaveRequestsLoading} leaveMsg={leaveMsg} leaveActionLoadingId={leaveActionLoadingId} approveLeave={approveLeave} rejectLeave={rejectLeave} countLeaveDays={countLeaveDays} getLeaveBalance={getLeaveBalance} leaveHrNotes={leaveHrNotes} setLeaveHrNotes={setLeaveHrNotes} setSelectedLeaveDetail={setSelectedLeaveDetail} setLeaveHistoryModalOpen={setLeaveHistoryModalOpen} />

        <div className="contents">
          <EmployeesModal open={employeesListOpen} onClose={() => setEmployeesListOpen(false)} pageSize={PAGE_SIZE} employeesPage={employeesPage} employeesTotalPages={employeesTotalPages} initials={initials} loadingData={loadingData} openProfileChoice={openProfileChoice} paginatedProfiles={paginatedProfiles} profiles={profiles} setEmployeesPage={setEmployeesPage} />




        </div>
      </div>

      <HRMobileBottomNav attendanceOpen={isAttendancePage} requestCount={pendingHrActionCount} onHome={goDashboard} onAttendance={openAttendanceLog} onRequests={() => setActionCenterOpen(true)} onEmployees={() => setEmployeesListOpen(true)} onMore={() => setMobileToolsOpen(true)} />
      <HRMobileToolsSheet open={mobileToolsOpen} darkMode={darkMode} onClose={() => setMobileToolsOpen(false)} onToggleTheme={toggleTheme} onLogout={handleLogout} onAnnouncements={() => setAnnouncementOpen(true)} onHolidays={openHolidays} onLeaveCalendar={openLeaveCalendar} onLeaveCredits={openLeaveCreditsModal} onReports={openReports} onDocuments={openDocuments} onHelpdesk={openHelpdesk} />

      <EmployeeChoiceModal open={modalMode === 'choice'} onClose={closeModal} initials={initials} openEdit={openEdit} openPayslipsModal={openPayslipsModal} selectedProfile={selectedProfile} />

      <EmployeeEditModal open={modalMode === 'edit'} onClose={closeModal} avatarInputRef={avatarInputRef} avatarPreview={avatarPreview} avatarUploading={avatarUploading} currentAvatarUrl={currentAvatarUrl} editing={editing} editingEmployeeIdConflict={editingEmployeeIdConflict} handleAvatarChange={handleAvatarChange} saveEdit={saveEdit} saveLoading={saveLoading} setEditing={setEditing} setModalMode={setModalMode} />

      <PayslipManagementModal open={modalMode === 'payslips'} onClose={closeModal} onBack={() => setModalMode('choice')} deletePayslip={deletePayslip} employeePayslips={employeePayslips} employeePayslipsLoading={employeePayslipsLoading} generateCutoffOptions={generateCutoffOptions} payslipCutoff={payslipCutoff} payslipFile={payslipFile} payslipFileRef={payslipFileRef} payslipMsg={payslipMsg} payslipUploading={payslipUploading} publishMsg={publishMsg} publishPayslip={publishPayslip} publishingId={publishingId} selectedProfile={selectedProfile} setPayslipCutoff={setPayslipCutoff} setPayslipFile={setPayslipFile} uploadPayslip={uploadPayslip} />

      <DisputeHistoryModal open={disputesHistoryModalOpen} onClose={() => setDisputesHistoryModalOpen(false)} approveDispute={approveDispute} rejectDispute={rejectDispute} actionLoadingId={disputeActionLoadingId} message={disputeMsg} loading={disputesLoading} disputeClaimed={disputeClaimed} disputeFieldLabel={disputeFieldLabel} disputeOriginal={disputeOriginal} disputeTypeLabel={disputeTypeLabel} disputes={disputes} formatPh={formatPh} selectedDisputeDetail={selectedDisputeDetail} setSelectedDisputeDetail={setSelectedDisputeDetail} />

      <HRActionCenterModal open={actionCenterOpen} onClose={() => setActionCenterOpen(false)} pendingDisputesCount={pendingDisputesCount} pendingLeaveCount={pendingLeaveCount} openHrSupportCount={openHrSupportCount} onDisputes={() => { setSelectedDisputeDetail(null); setDisputesHistoryModalOpen(true); }} onLeaveRequests={() => { setSelectedLeaveDetail(null); setLeaveHistoryModalOpen(true); }} onHelpDesk={openHelpdesk} />

      <LeaveHistoryModal open={leaveHistoryModalOpen} onClose={() => setLeaveHistoryModalOpen(false)} approveLeave={approveLeave} rejectLeave={rejectLeave} cancelApprovedLeave={cancelApprovedLeave} actionLoadingId={leaveActionLoadingId} message={leaveMsg} loading={leaveRequestsLoading} countLeaveDays={countLeaveDays} leaveRequests={leaveRequests} leaveHrNotes={leaveHrNotes} setLeaveHrNotes={setLeaveHrNotes} selectedLeaveDetail={selectedLeaveDetail} setSelectedLeaveDetail={setSelectedLeaveDetail} />

      {/* HELP DESK REQUESTS MANAGEMENT MODAL */}
      <HelpDeskRequestsModal open={hrSupportModalOpen} onClose={() => setHrSupportModalOpen(false)} loading={hrSupportLoading} requests={hrSupportRequests} drafts={hrSupportDrafts} setDrafts={setHrSupportDrafts} savingId={hrSupportSavingId} onSave={saveHrSupportRequest} />

      {/* EMPLOYEE DOCUMENTS MANAGEMENT MODAL */}
      <EmployeeDocumentsModal open={hrDocumentsModalOpen} onClose={() => setHrDocumentsModalOpen(false)} saving={hrDocumentSaving} loading={hrDocumentsLoading} title={hrDocumentTitle} setTitle={setHrDocumentTitle} category={hrDocumentCategory} setCategory={setHrDocumentCategory} file={hrDocumentFile} setFile={setHrDocumentFile} fileRef={hrDocumentFileRef} documents={hrDocuments} onUpload={uploadHrDocument} onToggle={toggleHrDocument} onDelete={deleteHrDocument} />

      <LeaveCreditsModal open={leaveCreditsModalOpen} onClose={() => setLeaveCreditsModalOpen(false)} fallbackLeaveCredits={fallbackLeaveCredits} leaveCreditsLoading={leaveCreditsLoading} sortedLeaveCreditsData={sortedLeaveCreditsData} />

      <ExportReportsModal employees={profiles} exportEmployeeId={exportEmployeeId} setExportEmployeeId={setExportEmployeeId} open={exportModalOpen} onClose={() => setExportModalOpen(false)} availableCutoffs={availableCutoffs} exportCutoff={exportCutoff} exportEmployeeMasterListCSV={exportEmployeeMasterListCSV} exportEmployeeMasterListPDF={exportEmployeeMasterListPDF} exportMsg={exportMsg} exportPayrollSummaryCSV={exportPayrollSummaryCSV} exportPayrollSummaryPDF={exportPayrollSummaryPDF} exportRawAttendanceCSV={exportRawAttendanceCSV} exportRawAttendancePDF={exportRawAttendancePDF} exportingType={exportingType} formatCutoffLabel={formatCutoffLabel} rawExportMonth={rawExportMonth} rawExportPeriod={rawExportPeriod} rawExportPreviewCount={rawExportPreviewCount} setExportCutoff={setExportCutoff} setExportMsg={setExportMsg} setRawExportMonth={setRawExportMonth} setRawExportPeriod={setRawExportPeriod} />

      {verificationDialog}

    </main>
  );
}
