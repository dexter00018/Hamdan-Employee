'use client';

// Shared types and pure helpers used across the HR Portal domain files.
// Everything here is framework-free (no Supabase, no React state) so it
// can be imported by hooks and view components alike.

import type { VerificationTone } from '@/components/shared/VerificationDialog';

// Shape of `verify` from useVerificationDialog -- passed into domain
// hooks so destructive actions can still request confirmation.
export type VerifyFn = (request: {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: VerificationTone;
  details?: string[];
}) => Promise<boolean>;

export type AttendanceLog = {
  id: number;
  user_id: string;
  log_date: string;
  time_in: string | null;
  time_out: string | null;
  status: string | null;
  late_offset_minutes?: number | null;
  early_out_offset_minutes?: number | null;
  absent_offset_minutes?: number | null;
  early_out_offset_requests?: Array<{ status: string; required_minutes: number }>;
  profiles?: { full_name: string | null; employee_id?: string | null };
};

export type Profile = {
  id: string;
  full_name: string | null;
  employee_id: string | null;
  designation: string | null;
  avatar_url: string | null;
  employee_email: string | null;
  is_active?: boolean;
  resigned_date?: string | null;
};

export type AttendanceChartSelection = { start: string; end: string; label: string };

// Must match app/employee/page.tsx and app/api/time-in/route.ts.
// Fallback values only -- normal operation uses the configurable values
// fetched from app_settings (editable via Super Admin -> App Settings).
export const FALLBACK_LATE_CUTOFF_HOUR = 9;
export const FALLBACK_LATE_CUTOFF_MINUTE = 15;

export function formatOffsetMinutes(totalMinutes: number) {
  const safeMinutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
}

export function earlyOutOffsetLabel(log: AttendanceLog) {
  const request = log.early_out_offset_requests?.[0];
  const approvedMinutes = Number(log.early_out_offset_minutes || 0);

  if (approvedMinutes > 0) return { label: `Offset · ${formatOffsetMinutes(approvedMinutes)}`, tone: 'approved' as const };
  if (request?.status === 'Pending') return { label: `Offset pending · ${formatOffsetMinutes(request.required_minutes)}`, tone: 'pending' as const };
  if (request?.status === 'Rejected') return { label: `Offset rejected · ${formatOffsetMinutes(request.required_minutes)}`, tone: 'rejected' as const };
  return null;
}

// Translates a UTC ISO timestamp to its Philippine calendar date
// ("YYYY-MM-DD"). Comparing this instead of the raw UTC prefix avoids
// misfiling records near midnight (PH is UTC+8, so a log_time_in of
// "2026-07-05T17:30:00Z" is already July 6 in Manila).
export const toManilaDateString = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(iso));

// Cutoff key format: "YYYY-MM:H1" (days 1-15) or "YYYY-MM:H2" (days
// 16 to end of month) -- the standard PH semi-monthly payroll split.
export const matchesCutoff = (manilaDate: string, cutoffKey: string) => {
  const [ym, half] = cutoffKey.split(':');
  if (!manilaDate.startsWith(ym)) return false;
  const day = parseInt(manilaDate.split('-')[2], 10);
  return half === 'H1' ? day <= 15 : day >= 16;
};

export const formatCutoffLabel = (key: string) => {
  const [ym, half] = key.split(':');
  const [y, m] = ym.split('-').map(Number);
  const monthName = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long' });
  const finalDay = new Date(y, m, 0).getDate();
  return half === 'H1' ? `${monthName} 1-15, ${y}` : `${monthName} 16-${finalDay}, ${y}`;
};

// Generate cutoff options: current month ± 3 months, both halves.
export const generateCutoffOptions = () => {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let offset = -3; offset <= 3; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const monthName = d.toLocaleDateString('en-US', { month: 'long' });
    const finalDay = new Date(y, d.getMonth() + 1, 0).getDate();
    options.push({ value: `${y}-${m}:H1`, label: `${monthName} 1-15, ${y}` });
    options.push({ value: `${y}-${m}:H2`, label: `${monthName} 16-${finalDay}, ${y}` });
  }
  return options.reverse();
};

export const formatPh = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit' });

export const formatLateDuration = (mins: number) => {
  if (mins <= 0) return '0 min';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h === 0 ? `${m} min` : `${h}h ${m}m`;
};

export const initials = (name: string | null) =>
  (name || '?')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

// Human-friendly label + before/after accessors for an attendance
// dispute, regardless of whether it's a TimeIn or TimeOut dispute --
// used in both the pending list and the history detail view.
export const disputeTypeLabel = (d: AttendanceDisputeLike) => {
  const dType = d.dispute_type || 'TimeIn';
  if (dType === 'TimeOut') return 'Missed time-out';
  return d.attendance_log_id ? 'Late tag dispute' : 'Missed time-in';
};
export const disputeOriginal = (d: AttendanceDisputeLike) => ((d.dispute_type || 'TimeIn') === 'TimeOut' ? d.original_time_out : d.original_time_in);
export const disputeClaimed = (d: AttendanceDisputeLike) => ((d.dispute_type || 'TimeIn') === 'TimeOut' ? d.claimed_time_out : d.claimed_time_in);
export const disputeFieldLabel = (d: AttendanceDisputeLike) => ((d.dispute_type || 'TimeIn') === 'TimeOut' ? 'Time-Out' : 'Time-In');

type AttendanceDisputeLike = {
  dispute_type: 'TimeIn' | 'TimeOut' | null;
  attendance_log_id: number | null;
  original_time_in: string | null;
  original_time_out: string | null;
  claimed_time_in: string | null;
  claimed_time_out: string | null;
};
