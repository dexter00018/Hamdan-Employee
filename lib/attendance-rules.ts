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
