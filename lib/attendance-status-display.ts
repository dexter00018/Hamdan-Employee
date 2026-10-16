import { isEarlyOut } from '@/lib/attendance-rules';

export type AttendanceStatusDisplay = {
  label: string;
  className: string;
};

type AttendanceStatusDisplayInput = {
  status: string | null | undefined;
  logDate: string | null | undefined;
  timeOut: string | null | undefined;
  lateOffsetMinutes?: number | null;
  earlyOutOffsetMinutes?: number | null;
  absentOffsetMinutes?: number | null;
  timeOutHour: number;
};

/**
 * Provides exactly one attendance status pill while preserving the underlying
 * Late, Early Out, or Absent attendance issue after Offset is approved.
 */
export function getAttendanceStatusDisplay({
  status,
  logDate,
  timeOut,
  lateOffsetMinutes = 0,
  earlyOutOffsetMinutes = 0,
  absentOffsetMinutes = 0,
  timeOutHour,
}: AttendanceStatusDisplayInput): AttendanceStatusDisplay {
  const normalizedStatus = status?.trim().toLowerCase() ?? '';
  const earlyOut = isEarlyOut(logDate || '', timeOut, timeOutHour);
  const lateOffsetApplied = normalizedStatus === 'offset applied' || Number(lateOffsetMinutes) > 0;
  const earlyOutOffsetAppliedMinutes = earlyOut ? Number(earlyOutOffsetMinutes) : 0;
  const earlyOutOffsetApplied = earlyOutOffsetAppliedMinutes > 0;
  const absentOffsetApplied = Number(absentOffsetMinutes) > 0;
  // An approved Offset clears the attendance consequence, but it does not
  // erase the original issue from the employee's attendance history/filter.
  if (absentOffsetApplied) {
    return { label: 'ABSENT', className: 'tag-absent' };
  }
  if (earlyOutOffsetApplied) {
    return { label: 'EARLY OUT', className: 'tag-early-out' };
  }
  if (lateOffsetApplied) {
    return { label: 'LATE', className: 'tag-late' };
  }
  if (normalizedStatus === 'late' && earlyOut) {
    return { label: 'LATE + EARLY OUT', className: 'tag-late-early' };
  }
  if (normalizedStatus === 'late') {
    return { label: 'LATE', className: 'tag-late' };
  }
  if (earlyOut) {
    return { label: 'EARLY OUT', className: 'tag-early-out' };
  }
  if (normalizedStatus === 'absent') {
    return { label: 'ABSENT', className: 'tag-absent' };
  }
  if (normalizedStatus.includes('leave')) {
    return { label: (status || 'Leave').toUpperCase(), className: 'tag-leave' };
  }
  if (normalizedStatus === 'excused') {
    return { label: 'EXCUSED', className: 'tag-excused' };
  }
  return { label: (status || 'Present').toUpperCase(), className: 'tag-present' };
}
