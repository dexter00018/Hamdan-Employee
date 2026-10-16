export type AttendanceStatus = 'Present' | 'Late';

export function isEarlyOut(logDate: string, timeOut: string | null | undefined, endHour: number): boolean {
  if (!timeOut || !/^\d{4}-\d{2}-\d{2}$/.test(logDate) || !Number.isInteger(endHour) || endHour < 0 || endHour > 23) return false;
  const actual = Date.parse(timeOut);
  const end = Date.parse(`${logDate}T${String(endHour).padStart(2, '0')}:00:00+08:00`);
  const start = Date.parse(`${logDate}T00:00:00+08:00`);
  return Number.isFinite(actual) && actual >= start && actual < end;
}

export function computeAttendanceStatus(hour: number, minute: number, cutoffHour: number, cutoffMinute: number): AttendanceStatus {
  return hour > cutoffHour || (hour === cutoffHour && minute > cutoffMinute) ? 'Late' : 'Present';
}

const manilaTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const SCHEDULED_START_MINUTES = 9 * 60;

/**
 * The cutoff determines whether a time-in is Late, not where its duration starts.
 * Once outside the grace period, count whole minutes from 9:00 AM Manila,
 * matching the existing Late Offset request/approval calculation.
 */
export function computeLateMinutes(timeIn: string | null | undefined, cutoffHour = 9, cutoffMinute = 15): number {
  if (!timeIn || !Number.isFinite(Date.parse(timeIn))) return 0;
  if (!Number.isInteger(cutoffHour) || cutoffHour < 0 || cutoffHour > 23 ||
      !Number.isInteger(cutoffMinute) || cutoffMinute < 0 || cutoffMinute > 59) return 0;
  const parts = manilaTimeFormatter.formatToParts(new Date(timeIn));
  const hour = Number(parts.find(part => part.type === 'hour')?.value);
  const minute = Number(parts.find(part => part.type === 'minute')?.value);
  if (computeAttendanceStatus(hour, minute, cutoffHour, cutoffMinute) !== 'Late') return 0;
  return Math.max(0, hour * 60 + minute - SCHEDULED_START_MINUTES);
}
