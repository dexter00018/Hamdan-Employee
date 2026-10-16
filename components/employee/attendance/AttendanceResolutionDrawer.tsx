"use client";

import { AlertCircle, CalendarDays, CheckCircle2, Clock3, Send, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export type ResolvableAttendanceRecord = {
  id: string;
  log_date: string;
  time_in: string | null;
  time_out: string | null;
  status: string | null;
};

type ResolutionKind = "late" | "early-out" | "absent";
type ResolutionMethod = "offset" | "leave";

type Props = {
  open: boolean;
  record: ResolvableAttendanceRecord | null;
  timeOutHour: number;
  leaveCredits: { total_credits: number; used_credits: number } | null;
  onClose: () => void;
  onSubmitted: () => void | Promise<void>;
};

const FULL_DAY_OFFSET_MINUTES = 9 * 60;

function formatMinutes(value: number) {
  const minutes = Math.max(0, Math.round(value));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours && remainder) return `${hours}h ${remainder}m`;
  if (hours) return `${hours}h`;
  return `${remainder}m`;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
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

function workHours(timeIn: string | null, timeOut: string | null) {
  if (!timeIn) return "0h 0m";
  if (!timeOut) return "In progress";
  return formatMinutes(
    Math.max(0, Math.round((new Date(timeOut).getTime() - new Date(timeIn).getTime()) / 60_000)),
  );
}

function resolutionKind(record: ResolvableAttendanceRecord, timeOutHour: number): ResolutionKind | null {
  const status = record.status?.trim().toLowerCase();
  if (status === "absent") return "absent";
  if (status === "late") return "late";
  if (!record.time_out) return null;
  const manilaTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    hour12: false,
  }).format(new Date(record.time_out));
  return Number(manilaTime) < timeOutHour ? "early-out" : null;
}

function requiredMinutes(record: ResolvableAttendanceRecord, kind: ResolutionKind, timeOutHour: number) {
  if (kind === "absent") return FULL_DAY_OFFSET_MINUTES;
  if (kind === "late" && record.time_in) {
    const [year, month, day] = record.log_date.split("-").map(Number);
    const scheduledStart = new Date(Date.UTC(year, month - 1, day, 1, 0, 0)); // 9:00 AM Manila
    return Math.max(1, Math.floor((new Date(record.time_in).getTime() - scheduledStart.getTime()) / 60_000));
  }
  if (kind === "early-out" && record.time_out) {
    const [year, month, day] = record.log_date.split("-").map(Number);
    const scheduledEnd = new Date(Date.UTC(year, month - 1, day, timeOutHour - 8, 0, 0));
    return Math.max(0, Math.ceil((scheduledEnd.getTime() - new Date(record.time_out).getTime()) / 60_000));
  }
  return 0;
}

export default function AttendanceResolutionDrawer({
  open,
  record,
  timeOutHour,
  leaveCredits,
  onClose,
  onSubmitted,
}: Props) {
  const kind = record ? resolutionKind(record, timeOutHour) : null;
  const [method, setMethod] = useState<ResolutionMethod>("offset");
  const [leaveType, setLeaveType] = useState<"Sick" | "Vacation" | "Emergency">("Sick");
  const [reason, setReason] = useState("");
  const [balanceMinutes, setBalanceMinutes] = useState(0);
  const [reservedMinutes, setReservedMinutes] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const neededMinutes = useMemo(
    () => (record && kind ? requiredMinutes(record, kind, timeOutHour) : 0),
    [kind, record, timeOutHour],
  );
  const availableMinutes = Math.max(0, balanceMinutes - reservedMinutes);
  const remainingCredits = leaveCredits
    ? Math.max(0, leaveCredits.total_credits - leaveCredits.used_credits)
    : null;
  const enoughOffset = availableMinutes >= neededMinutes;
  const enoughLeave = remainingCredits === null || remainingCredits >= 1;

  useEffect(() => {
    if (!open || !record) return;
    let active = true;
    setMethod(kind === "absent" ? "offset" : "offset");
    setLeaveType("Sick");
    setReason("");
    setMessage(null);
    setLoading(true);

    const loadBalances = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) {
        if (active) {
          setMessage("Your session could not be verified. Please sign in again.");
          setLoading(false);
        }
        return;
      }
      const [transactions, usageRequests, earlyRequests, offsetLeaves] = await Promise.all([
        supabase.from("offset_transactions").select("kind,hours,minutes").eq("user_id", user.id),
        supabase.from("offset_usage_requests").select("hours,required_minutes").eq("user_id", user.id).eq("status", "Pending"),
        supabase.from("early_out_offset_requests").select("required_minutes").eq("user_id", user.id).eq("status", "Pending"),
        supabase.from("leave_requests").select("offset_minutes_required").eq("user_id", user.id).eq("funding_source", "offset").eq("status", "Pending"),
      ]);
      if (!active) return;
      if (transactions.error || usageRequests.error || earlyRequests.error || offsetLeaves.error) {
        setMessage("Unable to load your available Offset balance right now.");
        setLoading(false);
        return;
      }
      const balance = (transactions.data || []).reduce((total, row) => {
        const minutes = Number(row.hours || 0) * 60 + Number(row.minutes || 0);
        return total + (row.kind === "earned" ? minutes : -minutes);
      }, 0);
      const usageReserved = (usageRequests.data || []).reduce(
        (total, row) => total + Number(row.required_minutes ?? Number(row.hours || 0) * 60),
        0,
      );
      const earlyReserved = (earlyRequests.data || []).reduce(
        (total, row) => total + Number(row.required_minutes || 0),
        0,
      );
      const leaveReserved = (offsetLeaves.data || []).reduce(
        (total, row) => total + Number(row.offset_minutes_required || 0),
        0,
      );
      setBalanceMinutes(balance);
      setReservedMinutes(usageReserved + earlyReserved + leaveReserved);
      setLoading(false);
    };

    void loadBalances();
    return () => {
      active = false;
    };
  }, [kind, open, record]);

  const submit = async () => {
    if (!record || !kind) return;
    if (method === "offset" && !enoughOffset) {
      setMessage("Your available Offset balance is not enough for this record.");
      return;
    }
    if (method === "leave" && !enoughLeave) {
      setMessage("You do not have enough leave credits for this day.");
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      if (method === "offset") {
        const result = kind === "early-out"
          ? await supabase.rpc("submit_early_out_offset_request", { p_attendance_log_id: Number(record.id) })
          : await supabase.rpc("submit_offset_usage_request", { p_attendance_log_id: Number(record.id) });
        if (result.error) throw result.error;
      } else {
        const { data: authData } = await supabase.auth.getUser();
        const user = authData.user;
        if (!user) throw new Error("Your session could not be verified. Please sign in again.");
        const { error } = await supabase.from("leave_requests").insert({
          user_id: user.id,
          leave_type: leaveType,
          start_date: record.log_date,
          end_date: record.log_date,
          reason: reason.trim() || `Attendance resolution for ${formatDate(record.log_date)}.`,
        });
        if (error) throw error;
      }
      await onSubmitted();
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to submit this request.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !record || !kind) return null;

  const title = kind === "early-out" ? "Early Out" : kind === "late" ? "Late" : "Absent";
  const statusTone = kind === "absent"
    ? "bg-rose-50 text-rose-700"
    : kind === "early-out"
      ? "bg-amber-50 text-amber-700"
      : "bg-orange-50 text-orange-700";

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-slate-950/25 backdrop-blur-[1px]" role="dialog" aria-modal="true" aria-label="Resolve Attendance Issue">
      <aside className="flex h-full w-full max-w-[430px] flex-col bg-white shadow-2xl dark:bg-[#292f2b]">
        <header className="flex items-start justify-between border-b border-slate-100 px-5 py-5 dark:border-[#465049]">
          <div>
            <h2 className="text-lg font-black tracking-tight">Resolve Attendance Issue</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">Submit a request for HR approval.</p>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-[#343b36]" aria-label="Close resolution drawer"><X size={18} /></button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {message && <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/35 dark:text-rose-200">{message}</div>}

          <section className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-[#465049] dark:bg-[#343b36]">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-[#465049]">
              <span className="inline-flex items-center gap-2 text-sm font-extrabold"><CalendarDays size={16} className="text-green-700" />{formatDate(record.log_date)}</span>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${statusTone}`}>{title.toUpperCase()}</span>
            </div>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Time In → Time Out</dt><dd className="font-bold tabular-nums">{formatTime(record.time_in)} → {formatTime(record.time_out)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Total Hours</dt><dd className="font-bold tabular-nums">{workHours(record.time_in, record.time_out)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">{kind === "early-out" ? "Early Out" : kind === "late" ? "Late" : "Required coverage"}</dt><dd className="font-bold tabular-nums">{formatMinutes(neededMinutes)}</dd></div>
            </dl>
          </section>

          <section>
            <h3 className="text-sm font-extrabold">Resolution options</h3>
            <div className="mt-3 space-y-2">
              <button type="button" onClick={() => setMethod("offset")} className={`w-full rounded-2xl border p-4 text-left transition ${method === "offset" ? "border-orange-300 bg-orange-50/70 ring-1 ring-orange-200 dark:border-orange-700 dark:bg-orange-950/20" : "border-slate-200 hover:bg-slate-50 dark:border-[#465049] dark:hover:bg-[#343b36]"}`}>
                <span className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-sm font-extrabold"><Clock3 size={17} className="text-orange-600" />Use Offset</span>{method === "offset" && <CheckCircle2 size={18} className="text-orange-600" />}</span>
                <span className="mt-2 block text-xs text-slate-500 dark:text-slate-300">Use your approved Offset balance to cover this {title.toLowerCase()} record.</span>
                <span className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-white p-2.5 text-[10px] dark:bg-[#292f2b]">
                  <span><b className="block text-slate-500">Available</b><strong className="text-emerald-700 dark:text-emerald-300">{loading ? "…" : formatMinutes(availableMinutes)}</strong></span>
                  <span><b className="block text-slate-500">Required</b><strong className="text-orange-700 dark:text-orange-300">{formatMinutes(neededMinutes)}</strong></span>
                  <span><b className="block text-slate-500">After approval</b><strong>{loading ? "…" : formatMinutes(Math.max(0, availableMinutes - neededMinutes))}</strong></span>
                </span>
              </button>

              {kind === "absent" && <button type="button" onClick={() => setMethod("leave")} className={`w-full rounded-2xl border p-4 text-left transition ${method === "leave" ? "border-violet-300 bg-violet-50/70 ring-1 ring-violet-200 dark:border-violet-700 dark:bg-violet-950/20" : "border-slate-200 hover:bg-slate-50 dark:border-[#465049] dark:hover:bg-[#343b36]"}`}>
                <span className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-sm font-extrabold"><CalendarDays size={17} className="text-violet-600" />Use Leave</span>{method === "leave" && <CheckCircle2 size={18} className="text-violet-600" />}</span>
                <span className="mt-2 block text-xs text-slate-500 dark:text-slate-300">File one Sick, Vacation, or Emergency Leave for this exact absent date.</span>
                <span className="mt-3 block rounded-xl bg-white p-2.5 text-[10px] dark:bg-[#292f2b]"><b className="text-slate-500">Leave credits</b><strong className="ml-2 text-violet-700 dark:text-violet-300">{remainingCredits === null ? "HR will confirm eligibility" : `${remainingCredits} day${remainingCredits === 1 ? "" : "s"} available`}</strong></span>
              </button>}
            </div>
          </section>

          {kind === "absent" && method === "leave" && <section className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4 dark:border-violet-900/50 dark:bg-violet-950/20">
            <p className="text-xs font-extrabold text-violet-900 dark:text-violet-100">Leave type</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(["Sick", "Vacation", "Emergency"] as const).map((option) => <button key={option} type="button" onClick={() => setLeaveType(option)} className={`rounded-xl px-2 py-2.5 text-[11px] font-bold transition ${leaveType === option ? "bg-violet-700 text-white" : "bg-white text-slate-600 shadow-sm dark:bg-[#343b36] dark:text-slate-200"}`}>{option}</button>)}
            </div>
            <label className="mt-4 block text-xs font-extrabold text-violet-900 dark:text-violet-100">Note for HR <span className="font-medium text-slate-400">(optional)</span></label>
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 min-h-[72px] w-full resize-y rounded-xl border border-violet-100 bg-white p-3 text-xs outline-none ring-violet-200 focus:ring-2 dark:border-violet-900/50 dark:bg-[#292f2b]" placeholder="Briefly explain the leave request…" />
          </section>}

          <div className="flex gap-2 rounded-2xl bg-blue-50 p-3 text-xs text-blue-800 dark:bg-blue-950/30 dark:text-blue-200"><AlertCircle size={17} className="mt-0.5 shrink-0" /><p><b>This request requires HR approval.</b> Your attendance status will remain unchanged until approved.</p></div>
        </div>

        <footer className="grid grid-cols-2 gap-3 border-t border-slate-100 p-5 dark:border-[#465049]">
          <button type="button" onClick={onClose} disabled={submitting} className="h-11 rounded-xl border border-slate-200 text-sm font-bold transition hover:bg-slate-50 disabled:opacity-40 dark:border-[#465049] dark:hover:bg-[#343b36]">Cancel</button>
          <button type="button" onClick={() => void submit()} disabled={submitting || loading || (method === "offset" && !enoughOffset) || (method === "leave" && !enoughLeave)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-orange-600 text-sm font-extrabold text-white shadow-sm transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-300"><Send size={16} />{submitting ? "Submitting…" : "Submit to HR"}</button>
        </footer>
      </aside>
    </div>
  );
}
