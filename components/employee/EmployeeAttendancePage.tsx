"use client";

import { getAttendanceStatusDisplay } from "@/lib/attendance-status-display";
import EmployeeDesktopSidebar from "@/components/employee/EmployeeDesktopSidebar";
import MobileBottomNav from "@/components/employee/MobileBottomNav";
import frameStyles from "@/components/employee/employee-portal-frame.module.css";
import AttendanceResolutionDrawer, {
  type ResolvableAttendanceRecord,
} from "@/components/employee/attendance/AttendanceResolutionDrawer";
import { applyPortalTheme } from "@/lib/portal-theme";
import { supabase } from "@/lib/supabase";
import CenterLoader from "@/components/shared/CenterLoader";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type AttendanceLog = {
  id: number;
  log_date: string;
  time_in: string | null;
  time_out: string | null;
  status: string | null;
  late_offset_minutes: number | null;
  early_out_offset_minutes: number | null;
  absent_offset_minutes?: number | null;
};

type AttendanceFilter =
  "all" | "present" | "late" | "early-out" | "offset" | "leave" | "absent";

const manilaMonth = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" })
    .format(new Date())
    .slice(0, 7);

function formatMonth(month: string) {
  const [year, value] = month.split("-").map(Number);
  return new Date(year, value - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function shiftMonth(month: string, amount: number) {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(year, value - 1 + amount, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function currentPayrollCutoff() {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const day = Number(today.slice(8, 10));
  const startDay = day <= 15 ? 1 : 16;
  const endDay = day <= 15 ? 15 : new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthText = new Intl.DateTimeFormat("en-US", {
    month: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00+08:00`));
  return {
    start: `${year}-${String(month).padStart(2, "0")}-${String(startDay).padStart(2, "0")}`,
    end: `${year}-${String(month).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`,
    label: `${monthText} ${startDay}–${endDay}, ${year}`,
  };
}

const monthNames = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Shared select list for attendance_logs reads (initial bounded read and
// the on-demand older-month read must return the same shape).
const ATTENDANCE_LOG_COLUMNS =
  "id, log_date, time_in, time_out, status, late_offset_minutes, early_out_offset_minutes, absent_offset_minutes";

function formatDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(value: string | null) {
  if (!value) return "--:--";
  return new Date(value).toLocaleTimeString("en-US", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatWorkHours(timeIn: string | null, timeOut: string | null) {
  if (!timeIn) return "--";
  if (!timeOut) return "In progress";
  const minutes = Math.max(
    0,
    Math.round(
      (new Date(timeOut).getTime() - new Date(timeIn).getTime()) / 60_000,
    ),
  );
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function isLeave(log: AttendanceLog) {
  return log.status?.toLowerCase().includes("leave") ?? false;
}

function categoryFor(
  log: AttendanceLog,
  timeOutHour: number,
): Exclude<AttendanceFilter, "all"> {
  const display = getAttendanceStatusDisplay({
    status: log.status,
    logDate: log.log_date,
    timeOut: log.time_out,
    lateOffsetMinutes: log.late_offset_minutes,
    earlyOutOffsetMinutes: log.early_out_offset_minutes,
    absentOffsetMinutes: log.absent_offset_minutes,
    timeOutHour,
  });
  const status = log.status?.trim().toLowerCase() ?? "";
  if (display.label.startsWith("OFFSET")) return "offset";
  if (display.label.includes("EARLY OUT")) return "early-out";
  if (status === "late") return "late";
  if (status === "absent") return "absent";
  if (isLeave(log)) return "leave";
  return "present";
}

function remarksFor(
  log: AttendanceLog,
  category: Exclude<AttendanceFilter, "all">,
) {
  if (isApprovedOffset(log)) return "Resolved with Offset";
  if (!log.time_in) return "No time in";
  if (!log.time_out) return "No time out";
  if (category === "offset") return "Offset applied";
  if (category === "early-out") return "Early time out";
  if (category === "leave") return log.status || "Leave";
  return "—";
}

function resolutionKind(
  log: AttendanceLog,
  timeOutHour: number,
): "late" | "early-out" | "absent" | null {
  const normalizedStatus = log.status?.trim().toLowerCase();
  if (
    normalizedStatus === "offset applied" ||
    normalizedStatus?.includes("leave") ||
    Number(log.early_out_offset_minutes || 0) > 0 ||
    Number(log.absent_offset_minutes || 0) > 0
  ) return null;
  if (normalizedStatus === "absent") return "absent";
  if (normalizedStatus === "late") return "late";
  if (!log.time_out) return null;
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Manila",
      hour: "2-digit",
      hour12: false,
    }).format(new Date(log.time_out)),
  );
  return hour < timeOutHour ? "early-out" : null;
}

function isApprovedOffset(log: AttendanceLog) {
  return (
    log.status?.trim().toLowerCase() === "offset applied" ||
    Number(log.late_offset_minutes || 0) > 0 ||
    Number(log.early_out_offset_minutes || 0) > 0 ||
    Number(log.absent_offset_minutes || 0) > 0
  );
}

function detailKind(
  log: AttendanceLog,
  timeOutHour: number,
): "late" | "early-out" | "absent" | null {
  if (Number(log.absent_offset_minutes || 0) > 0) return "absent";
  if (Number(log.early_out_offset_minutes || 0) > 0) return "early-out";
  if (isApprovedOffset(log)) return "late";
  return resolutionKind(log, timeOutHour);
}

const dotTone: Record<Exclude<AttendanceFilter, "all">, string> = {
  present: "bg-emerald-500",
  late: "bg-orange-500",
  "early-out": "bg-amber-400",
  offset: "bg-violet-500",
  leave: "bg-teal-500",
  absent: "bg-rose-500",
};

export default function EmployeeAttendancePage() {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [employeeName, setEmployeeName] = useState("Employee");
  const [designation, setDesignation] = useState("Employee");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [records, setRecords] = useState<AttendanceLog[]>([]);
  const [timeOutHour, setTimeOutHour] = useState(19);
  const [selectedMonth, setSelectedMonth] = useState(manilaMonth);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AttendanceFilter>("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  // First completed load flips this; realtime-triggered reloads afterward
  // must not re-show the centered loading screen.
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Earliest log_date already held in memory (YYYY-MM-DD). Months older
  // than this are fetched per-month when the picker selects them.
  const [coveredFrom, setCoveredFrom] = useState(
    () => `${new Date().getFullYear()}-01-01`,
  );
  const [monthLoading, setMonthLoading] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [monthPickerYear, setMonthPickerYear] = useState(() =>
    Number(manilaMonth().slice(0, 4)),
  );
  const [darkMode, setDarkMode] = useState(false);
  const [selectedResolution, setSelectedResolution] = useState<AttendanceLog | null>(null);
  const [pendingResolutionLogIds, setPendingResolutionLogIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [leaveCredits, setLeaveCredits] = useState<{
    total_credits: number;
    used_credits: number;
  } | null>(null);
  const pageSize = 6;
  const payrollCutoff = useMemo(() => currentPayrollCutoff(), []);

  const applyTheme = useCallback((nextDark: boolean) => {
    applyPortalTheme(nextDark);
    try {
      localStorage.setItem("theme", nextDark ? "dark" : "light");
    } catch {
      // Theme persistence is optional when browser storage is unavailable.
    }
    setDarkMode(nextDark);
  }, []);

  useEffect(() => {
    queueMicrotask(() =>
      setDarkMode(document.documentElement.classList.contains("dark")),
    );
  }, []);

  // This route fetches once on entry. The initial read is bounded to the
  // current year -- the record set used to be unbounded and grew with every
  // month of employment, which made each entry onto this page slower on
  // phones and desktops alike. Older months (previous years) are fetched
  // on demand by the picker below. Attendance changes reach this route
  // through the employee-scoped Realtime subscriptions, never polling.
  const loadAttendance = useCallback(async () => {
    setLoading(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      window.location.replace("/");
      return;
    }

    setEmployeeId(user.id);
    const currentYear = new Date().getFullYear();
    const [
      profileResult,
      recordsResult,
      settingResult,
      usageRequestsResult,
      earlyOutRequestsResult,
      pendingLeavesResult,
      leaveCreditsResult,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, designation, avatar_url")
        .eq("id", user.id)
        .single(),
      supabase
        .from("attendance_logs")
        .select(ATTENDANCE_LOG_COLUMNS)
        .eq("user_id", user.id)
        .gte("log_date", `${currentYear}-01-01`)
        .order("log_date", { ascending: false }),
      supabase
        .from("app_settings")
        .select("value")
        .eq("key", "time_out_reminder_hour")
        .maybeSingle(),
      supabase
        .from("offset_usage_requests")
        .select("attendance_log_id")
        .eq("user_id", user.id)
        .eq("status", "Pending"),
      supabase
        .from("early_out_offset_requests")
        .select("attendance_log_id")
        .eq("user_id", user.id)
        .eq("status", "Pending"),
      supabase
        .from("leave_requests")
        .select("start_date, end_date")
        .eq("user_id", user.id)
        .eq("status", "Pending"),
      supabase
        .from("leave_credits")
        .select("total_credits, used_credits")
        .eq("user_id", user.id)
        .eq("year", currentYear)
        .maybeSingle(),
    ]);

    if (profileResult.error) setError(profileResult.error.message);
    else {
      setEmployeeName(profileResult.data?.full_name || "Employee");
      setDesignation(profileResult.data?.designation || "Employee");
      setAvatarUrl(profileResult.data?.avatar_url || null);
    }

    if (recordsResult.error) setError(recordsResult.error.message);
    else {
      const nextRecords = (recordsResult.data || []) as AttendanceLog[];
      // Keep any older-month records previously loaded on demand (dates
      // before the current-year bound) instead of replacing wholesale --
      // a realtime-triggered reload must not wipe the month being viewed.
      setRecords((current) => {
        const keptOlder = current.filter(
          (record) => record.log_date < `${currentYear}-01-01`,
        );
        if (keptOlder.length === 0) return nextRecords;
        return [...keptOlder, ...nextRecords].sort((left, right) =>
          right.log_date.localeCompare(left.log_date),
        );
      });
      const pendingIds = new Set<string>();
      (usageRequestsResult.data || []).forEach((request) =>
        pendingIds.add(String(request.attendance_log_id)),
      );
      (earlyOutRequestsResult.data || []).forEach((request) =>
        pendingIds.add(String(request.attendance_log_id)),
      );
      (pendingLeavesResult.data || []).forEach((leave) => {
        nextRecords.forEach((record) => {
          if (record.log_date >= leave.start_date && record.log_date <= leave.end_date) {
            pendingIds.add(String(record.id));
          }
        });
      });
      setPendingResolutionLogIds(pendingIds);
    }

    if (typeof settingResult.data?.value === "number")
      setTimeOutHour(settingResult.data.value);
    setLeaveCredits(leaveCreditsResult.data ?? null);
    setHasLoaded(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Queue one initial read after mount. Realtime below handles subsequent
    // changes, so this route has no interval or polling timer.
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadAttendance();
    });
    return () => {
      cancelled = true;
    };
  }, [loadAttendance]);

  useEffect(() => {
    if (!employeeId) return;
    const channel = supabase
      .channel(`employee-attendance-history-${employeeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance_logs",
          filter: `user_id=eq.${employeeId}`,
        },
        (payload) => {
          const changed = (
            payload.eventType === "DELETE" ? payload.old : payload.new
          ) as Partial<AttendanceLog>;
          if (!changed.id) return;
          setRecords((current) => {
            if (payload.eventType === "DELETE")
              return current.filter((record) => record.id !== changed.id);
            const next = changed as AttendanceLog;
            const index = current.findIndex((record) => record.id === next.id);
            const merged =
              index === -1
                ? [next, ...current]
                : current.map((record) =>
                    record.id === next.id ? { ...record, ...next } : record,
                  );
            return merged.sort((left, right) =>
              right.log_date.localeCompare(left.log_date),
            );
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [employeeId]);

  // Resolution state changes are delivered by Realtime. There is deliberately
  // no timer here: a new request, HR decision, or cancellation triggers the
  // targeted refresh that updates the pending badge and final status.
  useEffect(() => {
    if (!employeeId) return;
    const channel = supabase
      .channel(`employee-attendance-resolution-${employeeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "offset_usage_requests", filter: `user_id=eq.${employeeId}` },
        () => void loadAttendance(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "early_out_offset_requests", filter: `user_id=eq.${employeeId}` },
        () => void loadAttendance(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leave_requests", filter: `user_id=eq.${employeeId}` },
        () => void loadAttendance(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [employeeId, loadAttendance]);

  // On-demand read of a single older month. Fires only when the picker
  // selects a month before coveredFrom (i.e., a previous year), so within
  // the current year every month switch stays pure in-memory and instant.
  useEffect(() => {
    if (!employeeId) return;
    const monthStart = `${selectedMonth}-01`;
    if (monthStart >= coveredFrom) return;
    let cancelled = false;
    setMonthLoading(true);
    void (async () => {
      const [year, month] = selectedMonth.split("-").map(Number);
      const monthEnd = `${selectedMonth}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;
      const { data, error } = await supabase
        .from("attendance_logs")
        .select(ATTENDANCE_LOG_COLUMNS)
        .eq("user_id", employeeId)
        .gte("log_date", monthStart)
        .lte("log_date", monthEnd)
        .order("log_date", { ascending: false });
      if (!cancelled && !error && data) {
        const fetched = data as AttendanceLog[];
        setRecords((current) => {
          const merged = new Map(current.map((record) => [record.id, record]));
          fetched.forEach((record) => {
            if (!merged.has(record.id)) merged.set(record.id, record);
          });
          return Array.from(merged.values()).sort((left, right) =>
            right.log_date.localeCompare(left.log_date),
          );
        });
      } else if (!cancelled && error) {
        console.error("Error fetching older month:", error.message);
      }
      if (!cancelled) {
        setCoveredFrom(monthStart);
        setMonthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedMonth, employeeId, coveredFrom]);

  const pickerMonths = useMemo(
    () => monthNames.map((_, index) => `${monthPickerYear}-${String(index + 1).padStart(2, "0")}`),
    [monthPickerYear],
  );

  const selectedRecords = useMemo(
    () => records.filter((record) => record.log_date.startsWith(selectedMonth)),
    [records, selectedMonth],
  );
  const counts = useMemo(
    () =>
      selectedRecords.reduce(
        (total, record) => {
          total[categoryFor(record, timeOutHour)] += 1;
          return total;
        },
        {
          present: 0,
          late: 0,
          "early-out": 0,
          offset: 0,
          leave: 0,
          absent: 0,
        } as Record<Exclude<AttendanceFilter, "all">, number>,
      ),
    [selectedRecords, timeOutHour],
  );

  const visibleRecords = useMemo(() => {
    const search = query.trim().toLowerCase();
    return selectedRecords.filter((record) => {
      const category = categoryFor(record, timeOutHour);
      const display = getAttendanceStatusDisplay({
        status: record.status,
        logDate: record.log_date,
        timeOut: record.time_out,
        lateOffsetMinutes: record.late_offset_minutes,
        earlyOutOffsetMinutes: record.early_out_offset_minutes,
        absentOffsetMinutes: record.absent_offset_minutes,
        timeOutHour,
      });
      return (
        (filter === "all" || category === filter) &&
        (!search ||
          `${formatDate(record.log_date)} ${record.log_date} ${display.label} ${remarksFor(record, category)}`
            .toLowerCase()
            .includes(search))
      );
    });
  }, [filter, query, selectedRecords, timeOutHour]);

  const totalPages = Math.max(1, Math.ceil(visibleRecords.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRecords = visibleRecords.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const summaryCards = [
    {
      key: "present" as const,
      label: "Present",
      value: counts.present,
      icon: "✓",
      tone: "border-emerald-100 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300",
    },
    {
      key: "late" as const,
      label: "Late",
      value: counts.late,
      icon: "◷",
      tone: "border-orange-100 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-300",
    },
    {
      key: "early-out" as const,
      label: "Early Out",
      value: counts["early-out"],
      icon: "↪",
      tone: "border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300",
    },
    {
      key: "absent" as const,
      label: "Absent",
      value: counts.absent,
      icon: "!",
      tone: "border-rose-100 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300",
    },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.replace("/");
  };

  const renderRecord = (record: AttendanceLog, mobile = false) => {
    const category = categoryFor(record, timeOutHour);
    const status = getAttendanceStatusDisplay({
      status: record.status,
      logDate: record.log_date,
      timeOut: record.time_out,
      lateOffsetMinutes: record.late_offset_minutes,
      earlyOutOffsetMinutes: record.early_out_offset_minutes,
      absentOffsetMinutes: record.absent_offset_minutes,
      timeOutHour,
    });
    const resolve = resolutionKind(record, timeOutHour);
    const approvedOffset = isApprovedOffset(record);
    const disputePending = pendingResolutionLogIds.has(String(record.id));
    const hasIssue = Boolean(detailKind(record, timeOutHour) || disputePending);
    const withinPayrollCutoff = record.log_date >= payrollCutoff.start && record.log_date <= payrollCutoff.end;
    if (mobile)
      return (
        <article
          key={record.id}
          onClick={() => hasIssue && setSelectedResolution(record)}
          onKeyDown={(event) => {
            if (hasIssue && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
              setSelectedResolution(record);
            }
          }}
          role={hasIssue ? "button" : undefined}
          tabIndex={hasIssue ? 0 : undefined}
          className={`relative overflow-hidden rounded-xl border border-slate-100 bg-white p-2 shadow-sm dark:border-[#465049] dark:bg-[#343b36] ${hasIssue ? "cursor-pointer transition hover:border-green-200 hover:bg-green-50/60 focus:outline-none focus:ring-2 focus:ring-green-500 dark:hover:border-green-800" : ""}`}
        >
          <i
            className={`absolute bottom-0 left-0 top-0 w-1 ${dotTone[category]}`}
          />
          <div className="pl-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-start gap-1.5">
                <i className={`mt-1 h-2 w-2 shrink-0 rounded-full ${dotTone[category]}`} />
                <div>
                  <h3 className="text-[13px] font-black leading-tight">
                    {formatDate(record.log_date)}
                  </h3>
                  <p className="mt-0.5 text-[9px] leading-none text-slate-500">{record.log_date}</p>
                </div>
              </div>
              <span className={`${status.className} shrink-0 !px-2 !py-1 !text-[9px]`}>{status.label}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <p className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold tabular-nums">
                <Clock3 size={14} className="shrink-0 text-slate-400" />
                {formatTime(record.time_in)} → {formatTime(record.time_out)}
              </p>
              {hasIssue && <ChevronRight size={16} className="shrink-0 text-slate-400" />}
            </div>
            <div className="mt-1 flex min-h-4 items-center justify-between gap-2 pl-5 text-[10px]">
              <span className="shrink-0 font-bold tabular-nums text-slate-800 dark:text-slate-100">{formatWorkHours(record.time_in, record.time_out)}</span>
              <span className="flex min-w-0 items-center gap-1.5 text-right text-slate-500 dark:text-slate-300">
                <span className="truncate">{remarksFor(record, category)}</span>
                {hasIssue && <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[8px] font-bold ${disputePending ? "bg-blue-50 text-blue-700 dark:bg-blue-950/35 dark:text-blue-200" : approvedOffset ? "bg-violet-50 text-violet-700 dark:bg-violet-950/35 dark:text-violet-200" : withinPayrollCutoff ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-400"}`}>
                  {disputePending ? "Pending" : approvedOffset || !withinPayrollCutoff ? "Details" : "Resolve"}
                </span>}
              </span>
            </div>
          </div>
        </article>
      );
    return (
      <div
        key={record.id}
        onClick={() => hasIssue && setSelectedResolution(record)}
        onKeyDown={(event) => {
          if (hasIssue && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            setSelectedResolution(record);
          }
        }}
        role={hasIssue ? "button" : undefined}
        tabIndex={hasIssue ? 0 : undefined}
        className={`grid grid-cols-[1.25fr_1.35fr_.75fr_.9fr_1fr_.75fr] items-center gap-3 border-b border-slate-100 px-5 py-3 text-xs last:border-0 dark:border-[#465049] ${hasIssue ? "cursor-pointer transition hover:bg-green-50/55 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green-500 dark:hover:bg-green-950/15" : ""}`}
      >
        <span className="flex items-center gap-3">
          <i className={`h-2.5 w-2.5 rounded-full ${dotTone[category]}`} />
          <span>
            <b className="block">{formatDate(record.log_date)}</b>
            <span className="text-[10px] text-slate-500">
              {record.log_date}
            </span>
          </span>
        </span>
        <span className="font-semibold tabular-nums">
          {formatTime(record.time_in)}{" "}
          <span className="mx-1 text-slate-400">→</span>{" "}
          {formatTime(record.time_out)}
        </span>
        <span className="font-semibold tabular-nums">
          {formatWorkHours(record.time_in, record.time_out)}
        </span>
        <span>
          <span className={status.className}>{status.label}</span>
        </span>
        <span className="text-slate-500 dark:text-slate-300">
          {remarksFor(record, category)}
        </span>
        <span>
          {disputePending ? (
            <span className="inline-flex whitespace-nowrap rounded-full bg-blue-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:bg-blue-950/35 dark:text-blue-200">Dispute Pending</span>
          ) : resolve ? (
            <span className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${withinPayrollCutoff ? "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/25 dark:text-orange-200" : "border-slate-200 bg-slate-100 text-slate-400 dark:border-[#465049] dark:bg-[#343b36] dark:text-slate-400"}`}>{withinPayrollCutoff ? "Resolve" : "View details"}</span>
          ) : approvedOffset ? (
            <span className="inline-flex whitespace-nowrap rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/25 dark:text-violet-200">View details</span>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </span>
      </div>
    );
  };

  return (
    <main className={`${frameStyles.page} dashboard-shell employee-attendance min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-[#202521] dark:text-white`}>
      <CenterLoader placement="fixed" show={loading && !hasLoaded} label="Loading attendance…" />
      <div className={`${frameStyles.frame} grid`}>
        <EmployeeDesktopSidebar
          employeeName={employeeName}
          designation={designation}
          avatarUrl={avatarUrl}
          darkMode={darkMode}
          actionCount={0}
          activeItem="My Attendance"
          onDashboard={() => router.push("/employee")}
          onAttendance={() => undefined}
          onLeave={() => router.push("/employee")}
          onDisputes={() => router.push("/employee")}
          onPayslips={() => router.push("/employee")}
          onDocuments={() => router.push("/employee")}
          onActionCenter={() => router.push("/employee")}
          onCommute={() => router.push("/employee")}
          onHelpdesk={() => router.push("/employee")}
          onProfile={() => router.push("/employee")}
          onToggleTheme={() => applyTheme(!darkMode)}
          onLogout={handleLogout}
        />
        <section className="min-w-0">
          <header className="mb-3 flex flex-col gap-3 rounded-xl bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.05)] dark:bg-[#292f2b] sm:mb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:rounded-2xl sm:p-4 lg:mb-3 lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none dark:lg:bg-transparent">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => router.push("/employee")}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-700 transition hover:bg-slate-100 dark:bg-[#343b36] dark:text-slate-200 dark:hover:bg-[#3d463f] lg:hidden"
                aria-label="Back to dashboard"
              >
                <ChevronLeft size={23} />
              </button>
              <div>
                <h1 className="text-xl font-black tracking-tight sm:text-2xl lg:text-[26px]">
                  Attendance History
                </h1>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-300 sm:mt-1 sm:text-sm">
                  View your daily attendance records and manage any discrepancies.
                </p>
              </div>
            </div>
            <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-1.5 sm:w-auto sm:min-w-[380px] sm:gap-2">
              <div className="min-w-0">
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-expanded={monthPickerOpen}
                  onClick={() => {
                    setMonthPickerYear(Number(selectedMonth.slice(0, 4)));
                    setMonthPickerOpen(true);
                  }}
                  className="flex h-9 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 text-left text-xs font-bold shadow-sm transition hover:bg-slate-50 dark:border-[#465049] dark:bg-[#343b36] dark:text-white dark:hover:bg-[#3d463f] sm:h-10 sm:px-3"
                >
                  <CalendarDays size={16} className="shrink-0 text-green-700 dark:text-green-300" />
                  <span className="min-w-0 flex-1 truncate">{formatMonth(selectedMonth)}</span>
                  <ChevronDown size={16} className="shrink-0" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedMonth(manilaMonth());
                  setPage(1);
                }}
                className="h-9 rounded-xl bg-green-700 px-2.5 text-xs font-bold text-white transition hover:bg-green-800 sm:h-10 sm:px-3"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedMonth((month) => shiftMonth(month, -1));
                  setPage(1);
                }}
                className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-[#465049] dark:bg-[#343b36] dark:text-slate-200 dark:hover:bg-[#3d463f] sm:h-10 sm:w-10"
                aria-label="Previous month"
              >
                <ChevronLeft size={17} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedMonth((month) => shiftMonth(month, 1));
                  setPage(1);
                }}
                className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-[#465049] dark:bg-[#343b36] dark:text-slate-200 dark:hover:bg-[#3d463f] sm:h-10 sm:w-10"
                aria-label="Next month"
              >
                <ChevronRight size={17} />
              </button>
            </div>
          </header>
          {monthPickerOpen && (
            <div
              className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/20 px-4 pt-24 backdrop-blur-[1px]"
              onClick={(event) => {
                if (event.target === event.currentTarget) setMonthPickerOpen(false);
              }}
            >
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="reporting-month-title"
                className="w-full max-w-[520px] rounded-2xl bg-white p-5 shadow-2xl dark:bg-[#292f2b]"
              >
                <div className="grid grid-cols-[40px_1fr_40px] items-center">
                  <button
                    type="button"
                    onClick={() => setMonthPickerYear((year) => year - 1)}
                    className="grid h-10 w-10 place-items-center rounded-xl text-slate-600 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-[#343b36]"
                    aria-label="Previous year"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <div className="text-center">
                    <h2 id="reporting-month-title" className="text-sm font-black">Choose a reporting month</h2>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-300">Select a month in {monthPickerYear}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMonthPickerYear((year) => year + 1)}
                    className="grid h-10 w-10 place-items-center rounded-xl text-slate-600 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-[#343b36]"
                    aria-label="Next year"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
                <div className="mt-5 grid grid-cols-4 gap-2 sm:gap-3">
                  {pickerMonths.map((month, index) => {
                    const selected = month === selectedMonth;
                    return (
                      <button
                        key={month}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          setSelectedMonth(month);
                          setPage(1);
                          setMonthPickerOpen(false);
                        }}
                        className={`h-10 rounded-xl text-sm font-bold transition ${selected ? "bg-green-700 text-white shadow-lg shadow-green-700/20" : "text-slate-700 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-[#343b36]"}`}
                      >
                        {monthNames[index]}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs dark:border-[#465049]">
                  <p className="text-slate-500 dark:text-slate-300">Showing data for <b className="text-slate-800 dark:text-white">{formatMonth(selectedMonth)}</b></p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMonth(manilaMonth());
                      setPage(1);
                      setMonthPickerOpen(false);
                    }}
                    className="font-bold text-green-700 underline underline-offset-4 dark:text-green-300"
                  >
                    This month
                  </button>
                </div>
              </section>
            </div>
          )}
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"
            >
              Unable to load attendance: {error}
            </div>
          )}
          <section className="mb-3 grid grid-cols-4 gap-1.5 sm:mb-4 sm:gap-2 lg:gap-3">
            {summaryCards.map((card) => (
              <button
                key={card.key}
                type="button"
                onClick={() => {
                  setFilter((current) =>
                    current === card.key ? "all" : card.key,
                  );
                  setPage(1);
                }}
                className={`flex min-h-[54px] items-center gap-1.5 rounded-xl border p-1.5 text-left transition hover:-translate-y-0.5 lg:min-h-[68px] lg:gap-3 lg:px-4 lg:py-3 ${card.tone} ${filter === card.key ? "ring-2 ring-offset-2 ring-green-500 dark:ring-offset-[#202521]" : ""}`}
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-white/80 text-xs font-black shadow-sm dark:bg-black/10 lg:h-8 lg:w-8 lg:text-base">
                  {card.icon}
                </span>
                <span className="block min-w-0">
                  <span className="block text-base font-black leading-none lg:text-xl">
                    {card.value}
                  </span>
                  <span className="mt-0.5 block truncate text-[8px] font-bold uppercase tracking-wide lg:text-xs">
                    {card.label}
                  </span>
                </span>
              </button>
            ))}
          </section>
          {monthLoading && (
            <p className="mb-2 px-1 text-[11px] font-bold text-slate-400" role="status">
              Loading older month...
            </p>
          )}
          <section className="overflow-hidden rounded-xl bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)] dark:bg-[#292f2b] sm:rounded-[1.5rem]">
            <div className="flex flex-col gap-2 border-b border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:p-4 lg:px-4 lg:py-3.5 dark:border-[#465049]">
              <div>
                <h2 className="text-base font-black">
                  {formatMonth(selectedMonth)}
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-300 sm:text-xs">
                  {selectedRecords.length} record
                  {selectedRecords.length === 1 ? "" : "s"} · {counts.leave}{" "}
                  leave · {counts.absent} absent
                </p>
              </div>
              <div className="flex w-full items-center gap-1.5 sm:w-auto sm:gap-2">
                <label className="flex h-9 min-w-0 flex-1 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-slate-500 dark:border-[#465049] dark:bg-[#343b36] sm:min-h-10 sm:flex-none sm:px-3">
                  <Search size={15} />
                  <input
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Search date, status, or remarks..."
                    className="min-w-0 flex-1 bg-transparent text-[11px] text-slate-800 outline-none placeholder:text-slate-400 dark:text-white sm:w-36 sm:flex-none sm:text-xs"
                  />
                </label>
                <label className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-slate-600 dark:border-[#465049] dark:bg-[#343b36] dark:text-slate-200 sm:min-h-10 sm:px-3">
                  <SlidersHorizontal size={15} />
                  <select
                    aria-label="Attendance status filter"
                    value={filter}
                    onChange={(event) => {
                      setFilter(event.target.value as AttendanceFilter);
                      setPage(1);
                    }}
                    className="max-w-[88px] bg-transparent text-[11px] font-bold outline-none dark:[color-scheme:dark] sm:max-w-none sm:text-xs"
                  >
                    <option value="all">All status</option>
                    <option value="present">Present</option>
                    <option value="late">Late</option>
                    <option value="early-out">Early Out</option>
                    <option value="leave">Leave</option>
                    <option value="absent">Absent</option>
                  </select>
                </label>
              </div>
            </div>
            {loading ? (
              <div className="p-8 text-center text-sm font-semibold text-slate-500">
                Loading attendance records…
              </div>
            ) : pageRecords.length === 0 ? (
              <div className="p-8 text-center text-sm font-semibold text-slate-500">
                No attendance records match this view.
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <div className="min-w-[880px]">
                    <div className="grid grid-cols-[1.25fr_1.35fr_.75fr_.9fr_1fr_.75fr] gap-3 border-b border-slate-100 bg-emerald-50/55 px-5 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:border-[#465049] dark:bg-[#343b36]">
                      <span>Date</span>
                      <span>Time In → Time Out</span>
                      <span>Total Hours</span>
                      <span>Status</span>
                      <span>Remarks</span>
                      <span>Action</span>
                    </div>
                    {pageRecords.map((record) => renderRecord(record))}
                  </div>
                </div>
                <div className="space-y-1.5 p-2 md:hidden">
                  {pageRecords.map((record) => renderRecord(record, true))}
                </div>
              </>
            )}
            <footer className="flex items-center justify-between border-t border-slate-100 px-3 py-2.5 text-[11px] font-semibold text-slate-500 dark:border-[#465049] dark:text-slate-300 sm:px-4 sm:py-3 sm:text-xs">
              <span>
                Showing{" "}
                {visibleRecords.length ? (currentPage - 1) * pageSize + 1 : 0}–
                {Math.min(currentPage * pageSize, visibleRecords.length)} of{" "}
                {visibleRecords.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#465049]"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>
                <span>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() =>
                    setPage((value) => Math.min(totalPages, value + 1))
                  }
                  className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#465049]"
                  aria-label="Next page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </footer>
          </section>
        </section>
      </div>
      <AttendanceResolutionDrawer
        open={Boolean(selectedResolution)}
        record={selectedResolution as ResolvableAttendanceRecord | null}
        timeOutHour={timeOutHour}
        leaveCredits={leaveCredits}
        withinPayrollCutoff={selectedResolution ? selectedResolution.log_date >= payrollCutoff.start && selectedResolution.log_date <= payrollCutoff.end : false}
        payrollCutoffLabel={payrollCutoff.label}
        resolutionPending={selectedResolution ? pendingResolutionLogIds.has(String(selectedResolution.id)) : false}
        onClose={() => setSelectedResolution(null)}
        onSubmitted={loadAttendance}
      />
      <MobileBottomNav
        activeTab="attendance"
        onHome={() => router.push("/employee")}
        onAttendance={() => undefined}
        onLeave={() => router.push("/employee")}
        onActionCenter={() => router.push("/employee")}
        onProfile={() => router.push("/employee")}
      />
    </main>
  );
}
