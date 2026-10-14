"use client";

import { getAttendanceStatusDisplay } from "@/lib/attendance-status-display";
import EmployeeDesktopSidebar from "@/components/employee/EmployeeDesktopSidebar";
import { applyPortalTheme } from "@/lib/portal-theme";
import { supabase } from "@/lib/supabase";
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
  id: string;
  log_date: string;
  time_in: string | null;
  time_out: string | null;
  status: string | null;
  late_offset_minutes: number | null;
  early_out_offset_minutes: number | null;
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
  if (!log.time_in) return "No time in";
  if (!log.time_out) return "No time out";
  if (category === "offset") return "Offset applied";
  if (category === "early-out") return "Early time out";
  if (category === "leave") return log.status || "Leave";
  return "—";
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
  const [error, setError] = useState<string | null>(null);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const pageSize = 8;

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

  // This route fetches once on entry. Attendance changes reach it through the
  // employee-scoped Realtime subscription below, never through timed polling.
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
    const [profileResult, recordsResult, settingResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, designation, avatar_url")
        .eq("id", user.id)
        .single(),
      supabase
        .from("attendance_logs")
        .select(
          "id, log_date, time_in, time_out, status, late_offset_minutes, early_out_offset_minutes",
        )
        .eq("user_id", user.id)
        .order("log_date", { ascending: false }),
      supabase
        .from("app_settings")
        .select("value")
        .eq("key", "time_out_reminder_hour")
        .maybeSingle(),
    ]);

    if (profileResult.error) setError(profileResult.error.message);
    else {
      setEmployeeName(profileResult.data?.full_name || "Employee");
      setDesignation(profileResult.data?.designation || "Employee");
      setAvatarUrl(profileResult.data?.avatar_url || null);
    }

    if (recordsResult.error) setError(recordsResult.error.message);
    else setRecords((recordsResult.data || []) as AttendanceLog[]);

    if (typeof settingResult.data?.value === "number")
      setTimeOutHour(settingResult.data.value);
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

  const months = useMemo(() => {
    const values = new Set(
      records.map((record) => record.log_date.slice(0, 7)),
    );
    values.add(manilaMonth());
    values.add(selectedMonth);
    return Array.from(values).sort().reverse();
  }, [records, selectedMonth]);

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
        timeOutHour,
      });
      return (
        (filter === "all" || category === filter) &&
        (!search ||
          `${formatDate(record.log_date)} ${record.log_date} ${display.label}`
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
      key: "offset" as const,
      label: "Offset",
      value: counts.offset,
      icon: "↻",
      tone: "border-violet-100 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300",
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
      timeOutHour,
    });
    if (mobile)
      return (
        <article
          key={record.id}
          className="relative overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-[#465049] dark:bg-[#343b36]"
        >
          <i
            className={`absolute bottom-0 left-0 top-0 w-1 ${dotTone[category]}`}
          />
          <div className="flex items-start justify-between gap-3 pl-2">
            <div>
              <h3 className="text-sm font-black">
                {formatDate(record.log_date)}
              </h3>
              <p className="text-[10px] text-slate-500">{record.log_date}</p>
            </div>
            <span className={status.className}>{status.label}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 pl-2 text-xs">
            <p className="flex items-center gap-1.5 font-semibold tabular-nums">
              <Clock3 size={14} className="text-slate-400" />
              {formatTime(record.time_in)} → {formatTime(record.time_out)}
            </p>
            <p className="text-right font-bold tabular-nums">
              {formatWorkHours(record.time_in, record.time_out)}
            </p>
          </div>
          <p className="mt-2 pl-2 text-[11px] text-slate-500 dark:text-slate-300">
            {remarksFor(record, category)}
          </p>
        </article>
      );
    return (
      <div
        key={record.id}
        className="grid grid-cols-[1.35fr_1.45fr_.8fr_1fr_1fr] items-center gap-3 border-b border-slate-100 px-5 py-3.5 text-xs last:border-0 dark:border-[#465049]"
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
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-slate-50 p-3 pb-24 text-slate-900 transition-colors dark:bg-[#202521] dark:text-white md:p-5 lg:p-6">
      <div className="mx-auto grid max-w-[1500px] gap-5 lg:grid-cols-[228px_minmax(0,1fr)]">
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
          <header className="mb-4 flex flex-col gap-4 rounded-[1.75rem] bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.06)] dark:bg-[#292f2b] sm:flex-row sm:items-center sm:justify-between">
            <div>
              <button
                type="button"
                onClick={() => router.push("/employee")}
                className="mb-2 inline-flex items-center gap-1 text-xs font-bold text-green-700 hover:text-green-800 lg:hidden"
              >
                <ChevronLeft size={15} /> Dashboard
              </button>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                Attendance
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                Your daily time records
              </p>
            </div>
            <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
              <div className="relative min-w-0 sm:min-w-[184px]">
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={monthPickerOpen}
                  onClick={() => setMonthPickerOpen((isOpen) => !isOpen)}
                  className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-left text-xs font-bold shadow-sm transition hover:bg-slate-50 dark:border-[#465049] dark:bg-[#343b36] dark:text-white dark:hover:bg-[#3d463f]"
                >
                  <CalendarDays size={16} className="shrink-0 text-green-700 dark:text-green-300" />
                  <span className="min-w-0 flex-1 truncate">{formatMonth(selectedMonth)}</span>
                  <ChevronDown size={16} className={`shrink-0 transition ${monthPickerOpen ? "rotate-180" : ""}`} />
                </button>
                {monthPickerOpen && (
                  <div role="listbox" aria-label="Reporting month" className="absolute right-0 z-30 mt-2 max-h-64 w-full min-w-[190px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-[#465049] dark:bg-[#292f2b]">
                    {months.map((month) => {
                      const selected = month === selectedMonth;
                      return (
                        <button
                          key={month}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onClick={() => {
                            setSelectedMonth(month);
                            setPage(1);
                            setMonthPickerOpen(false);
                          }}
                          className={`flex min-h-10 w-full items-center rounded-lg px-3 text-left text-xs font-semibold transition ${selected ? "bg-green-50 text-green-800 dark:bg-[#263b2f] dark:text-[#9be7ae]" : "text-slate-700 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-[#343b36]"}`}
                        >
                          {formatMonth(month)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedMonth(manilaMonth());
                  setPage(1);
                }}
                className="min-h-11 rounded-xl bg-green-700 px-4 text-xs font-bold text-white transition hover:bg-green-800"
              >
                Today
              </button>
              <div className="col-span-2 flex justify-end gap-2 sm:contents">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMonth((month) => shiftMonth(month, -1));
                    setPage(1);
                  }}
                  className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-[#465049] dark:bg-[#343b36] dark:text-slate-200 dark:hover:bg-[#3d463f]"
                  aria-label="Previous month"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMonth((month) => shiftMonth(month, 1));
                    setPage(1);
                  }}
                  className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-[#465049] dark:bg-[#343b36] dark:text-slate-200 dark:hover:bg-[#3d463f]"
                  aria-label="Next month"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </header>
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"
            >
              Unable to load attendance: {error}
            </div>
          )}
          <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
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
                className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${card.tone} ${filter === card.key ? "ring-2 ring-offset-2 ring-green-500 dark:ring-offset-[#202521]" : ""}`}
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/70 text-lg font-black shadow-sm dark:bg-black/10">
                  {card.icon}
                </span>
                <p className="mt-3 text-2xl font-black leading-none">
                  {card.value}
                </p>
                <p className="mt-1 text-xs font-bold uppercase tracking-wide">
                  {card.label}
                </p>
              </button>
            ))}
          </section>
          <section className="overflow-hidden rounded-[1.75rem] bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)] dark:bg-[#292f2b]">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#465049]">
              <div>
                <h2 className="text-base font-black">
                  {formatMonth(selectedMonth)}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-300">
                  {selectedRecords.length} record
                  {selectedRecords.length === 1 ? "" : "s"} · {counts.leave}{" "}
                  leave · {counts.absent} absent
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-slate-500 dark:border-[#465049] dark:bg-[#343b36]">
                  <Search size={15} />
                  <input
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Search date..."
                    className="w-28 bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400 dark:text-white sm:w-36"
                  />
                </label>
                <label className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-600 dark:border-[#465049] dark:bg-[#343b36] dark:text-slate-200">
                  <SlidersHorizontal size={15} />
                  <select
                    aria-label="Attendance status filter"
                    value={filter}
                    onChange={(event) => {
                      setFilter(event.target.value as AttendanceFilter);
                      setPage(1);
                    }}
                    className="bg-transparent text-xs font-bold outline-none dark:[color-scheme:dark]"
                  >
                    <option value="all">All status</option>
                    <option value="present">Present</option>
                    <option value="late">Late</option>
                    <option value="early-out">Early Out</option>
                    <option value="offset">Offset</option>
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
                  <div className="min-w-[760px]">
                    <div className="grid grid-cols-[1.35fr_1.45fr_.8fr_1fr_1fr] gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:border-[#465049] dark:bg-[#343b36]">
                      <span>Date</span>
                      <span>Time In → Time Out</span>
                      <span>Total Hours</span>
                      <span>Status</span>
                      <span>Remarks</span>
                    </div>
                    {pageRecords.map((record) => renderRecord(record))}
                  </div>
                </div>
                <div className="space-y-2 p-3 md:hidden">
                  {pageRecords.map((record) => renderRecord(record, true))}
                </div>
              </>
            )}
            <footer className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs font-semibold text-slate-500 dark:border-[#465049] dark:text-slate-300">
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
    </main>
  );
}
