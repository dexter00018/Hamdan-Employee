// Pure dashboard formatting and calculation helpers, extracted verbatim
// from app/employee/page.tsx (Phase A of the dashboard split). Everything
// here must stay free of component state, Supabase, and React: plain
// functions of their arguments only, so they can be unit-tested directly
// and reused by other portal surfaces without re-renders.

// --- Directory ---

export function directoryInitials(name: string | null): string {
  return (name || '?')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// Masks a value except for its first 2 characters, e.g. "34" + dots
// for the rest -- shows just enough to help the employee recognize
// "yes, this is my number" without exposing the whole thing.
export function maskValue(value: string): string {
  if (value.length <= 2) return value;
  return value.slice(0, 2) + '•'.repeat(value.length - 2);
}

// Hired Date isn't sensitive like a government ID number, so it's
// just shown plainly -- no masking/eye icon needed.
export function formatHiredDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// --- Cutoff periods ---

// log_date is a plain "YYYY-MM-DD" string, so we parse it manually
// instead of `new Date(log_date)` to avoid the browser's local
// timezone shifting it into the wrong day/month.
//
// Period key format: "YYYY-MM:ALL" (whole month), "YYYY-MM:H1"
// (days 1-15), or "YYYY-MM:H2" (days 16 to end of month).
export function matchesCutoff(logDate: string | undefined, cutoffKey: string): boolean {
  if (!logDate || !cutoffKey) return false;
  const [ym, half] = cutoffKey.split(':');
  if (!logDate.startsWith(ym)) return false;
  if (half === 'ALL') return true;
  const day = parseInt(logDate.split('-')[2], 10);
  return half === 'H1' ? day <= 15 : day >= 16;
}

export function computeCurrentCutoffKey(): string {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const half = now.getDate() <= 15 ? 'H1' : 'H2';
  return `${ym}:${half}`;
}

// --- Attendance streak ---

// Counts consecutive work days (most recent first) that are neither
// "Late" nor "Absent" -- an approved Leave day doesn't break the streak,
// it's just skipped over.
export function computeAttendanceStreak(
  logs: Array<{ log_date?: string | null; status?: string | null }>,
  today: string
): number {
  const sorted = [...logs]
    .filter((l) => l.log_date && l.log_date <= today)
    .sort((a, b) => (a.log_date! < b.log_date! ? 1 : -1));
  let streak = 0;
  for (const log of sorted) {
    const status = log.status?.toLowerCase() ?? '';
    if (status === 'late' || status === 'absent') break;
    if (status.includes('leave')) continue;
    streak += 1;
  }
  return streak;
}

export function streakMessageFor(streak: number): string {
  if (streak === 0) return 'Start your streak today!';
  if (streak < 5) return 'Nice start!';
  if (streak < 10) return 'Great job!';
  if (streak < 20) return 'Impressive!';
  return 'Outstanding!';
}

// --- Company holidays ---

// Split holidays into upcoming (today included) and past, each sorted
// nearest-first, for the Company Calendar modal. Generic so the caller
// keeps richer row shapes (id, created_by, ...) intact.
export function splitHolidays<H extends { holiday_date: string }>(
  holidays: H[],
  today: string
): { upcomingHolidays: H[]; pastHolidays: H[] } {
  const upcoming = holidays
    .filter((h) => h.holiday_date >= today)
    .sort((a, b) => (a.holiday_date < b.holiday_date ? -1 : 1));
  const past = holidays
    .filter((h) => h.holiday_date < today)
    .sort((a, b) => (a.holiday_date < b.holiday_date ? 1 : -1));
  return { upcomingHolidays: upcoming, pastHolidays: past };
}

export function formatHolidayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function daysUntilHoliday(dateStr: string, todayStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [ty, tm, td] = todayStr.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86400000);
}

// Count chargeable leave days: Monday-Friday, excluding company holidays.
export function countLeaveDays(start: string, end: string, holidayDates: Set<string>): number {
  if (!start || !end || end < start) return 0;
  let count = 0;
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const d = new Date(Date.UTC(sy, sm - 1, sd));
  const endDate = new Date(Date.UTC(ey, em - 1, ed));
  while (d <= endDate) {
    const day = d.getUTCDay();
    const dateKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    if (day !== 0 && day !== 6 && !holidayDates.has(dateKey)) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

export function countLeaveHolidays(start: string, end: string, holidays: Array<{ holiday_date: string }>): number {
  if (!start || !end || end < start) return 0;
  return holidays.filter((holiday) => holiday.holiday_date >= start && holiday.holiday_date <= end).length;
}

// --- Top-card formatting (Batch A) ---

export function formatCreditValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

// Compact offset readout, matching the Offset modal's "3h 20m" style.
export function formatOffsetShort(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const hrs = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hrs && mins) return `${hrs}h ${mins}m`;
  if (hrs) return `${hrs}h`;
  return `${mins}m`;
}

export function formatLateDuration(mins: number): string {
  if (mins <= 0) return '0 min';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h === 0 ? `${m} min` : `${h}h ${m}m`;
}

// "Leave" here now covers any type-specific status ("Sick Leave",
// "Vacation Leave", "Emergency Leave") set by settle_leave_day(), not
// just the literal word "Leave" -- match by substring.
export function isLeaveStatus(s: string | null | undefined): boolean {
  return (s ?? '').toLowerCase().includes('leave');
}

// --- Month labels ---

export function formatMonthOnly(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function formatMonthLabel(key: string): string {
  const [ym, half] = key.split(':');
  const [y, m] = ym.split('-').map(Number);
  const monthName = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long' });
  if (half === 'ALL') return `${monthName} ${y} (Whole Month)`;
  const lastDay = new Date(y, m, 0).getDate();
  return half === 'H1' ? `${monthName} 1-15, ${y}` : `${monthName} 16-${lastDay}, ${y}`;
}

// --- Disputes ---

// Human-friendly label + before/after times for a dispute, regardless
// of whether it's a TimeIn or TimeOut dispute -- shared by the "My
// Disputes" list and its detail view.
export function disputeTypeLabel(d: { dispute_type?: string | null; attendance_log_id?: number | null }): string {
  const dType = d.dispute_type || 'TimeIn';
  if (dType === 'TimeOut') return 'Missed time-out';
  return d.attendance_log_id ? 'Late tag dispute' : 'Missed time-in';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function disputeOriginal(d: any) {
  return (d.dispute_type || 'TimeIn') === 'TimeOut' ? d.original_time_out : d.original_time_in;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function disputeClaimed(d: any) {
  return (d.dispute_type || 'TimeIn') === 'TimeOut' ? d.claimed_time_out : d.claimed_time_in;
}

export function disputeFieldLabel(d: { dispute_type?: string | null }): string {
  return (d.dispute_type || 'TimeIn') === 'TimeOut' ? 'Time-Out' : 'Time-In';
}

export function formatDisputeTimePh(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' });
}

// Same cutoffs used everywhere else in this file (configurable late
// cutoff, configurable time-out cutoff -- Super Admin -> App
// Settings) -- used here to decide whether each option on the
// "choice" screen is actually worth disputing.
export function isTimeInOnTime(timeInIso: string, lateCutoffHour: number, lateCutoffMinute: number): boolean {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(timeInIso)).reduce((acc: Record<string, string>, p) => { acc[p.type] = p.value; return acc; }, {});
  const minutesSinceMidnight = parseInt(parts.hour, 10) * 60 + parseInt(parts.minute, 10);
  return minutesSinceMidnight < lateCutoffHour * 60 + lateCutoffMinute;
}

export function isTimeOutComplete(timeOutIso: string, timeOutReminderHour: number): boolean {
  const manilaHour = parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', hour12: false }).format(new Date(timeOutIso)),
    10
  );
  return manilaHour >= timeOutReminderHour;
}
