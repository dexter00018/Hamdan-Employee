import { isEarlyOut } from '@/lib/attendance-rules';

export type AttendanceStatusDisplay = {
  label: string;
  className: string;
};

type AttendanceStatusDisplayInput = {
  status: string | null | undefined;
  logDate: string | null | undefined;
  timeOut: string | null | undefined;
  earlyOutOffsetMinutes?: number | null;
  timeOutHour: number;
};

/**
 * Provides exactly one attendance status pill. An approved late correction is
 * stored as "Offset Applied"; an approved early-out correction is stored as
 * `early_out_offset_minutes` on the attendance log.
 */
export function getAttendanceStatusDisplay({
  status,
  logDate,
  timeOut,
  earlyOutOffsetMinutes = 0,
  timeOutHour,
}: AttendanceStatusDisplayInput): AttendanceStatusDisplay {
  const normalizedStatus = status?.trim().toLowerCase() ?? '';
  const earlyOut = isEarlyOut(logDate || '', timeOut, timeOutHour);
  const lateOffsetApplied = normalizedStatus === 'offset applied';
  const earlyOutOffsetApplied = earlyOut && Number(earlyOutOffsetMinutes) > 0;

  if (lateOffsetApplied && earlyOutOffsetApplied) {
    return { label: 'Offset', className: 'tag-offset-combined' };
  }
  if (lateOffsetApplied) {
    return { label: 'Offset', className: 'tag-offset' };
  }
  if (earlyOutOffsetApplied) {
    return { label: 'Offset', className: 'tag-offset-early' };
  }
  if (normalizedStatus === 'late' && earlyOut) {
    return { label: 'Late + Early Out', className: 'tag-late-early' };
  }
  if (normalizedStatus === 'late') {
    return { label: 'Late', className: 'tag-late' };
  }
  if (earlyOut) {
    return { label: 'Early Out', className: 'tag-early-out' };
  }
  if (normalizedStatus === 'absent') {
    return { label: 'Absent', className: 'tag-absent' };
  }
  if (normalizedStatus.includes('leave')) {
    return { label: status || 'Leave', className: 'tag-leave' };
  }
  if (normalizedStatus === 'excused') {
    return { label: 'Excused', className: 'tag-excused' };
  }
  return { label: status || 'Present', className: 'tag-present' };
}
