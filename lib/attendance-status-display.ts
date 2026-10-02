import { isEarlyOut } from '@/lib/attendance-rules';

export type AttendanceStatusDisplay = {
  label: string;
  className: string;
};

function formatOffsetMinutes(totalMinutes: number) {
  const safeMinutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  if (hours && minutes) return `${hours}H ${minutes}M`;
  if (hours) return `${hours}H`;
  return `${minutes}M`;
}

type AttendanceStatusDisplayInput = {
  status: string | null | undefined;
  logDate: string | null | undefined;
  timeOut: string | null | undefined;
  lateOffsetMinutes?: number | null;
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
  lateOffsetMinutes = 0,
  earlyOutOffsetMinutes = 0,
  timeOutHour,
}: AttendanceStatusDisplayInput): AttendanceStatusDisplay {
  const normalizedStatus = status?.trim().toLowerCase() ?? '';
  const earlyOut = isEarlyOut(logDate || '', timeOut, timeOutHour);
  const lateOffsetApplied = normalizedStatus === 'offset applied';
  const earlyOutOffsetAppliedMinutes = earlyOut ? Number(earlyOutOffsetMinutes) : 0;
  const earlyOutOffsetApplied = earlyOutOffsetAppliedMinutes > 0;
  // Earning Offset remains whole-hour based; clearing Late is minute-exact.
  const lateOffsetAppliedMinutes = lateOffsetApplied ? Math.max(1, Number(lateOffsetMinutes) || 60) : 0;
  const offsetLabel = (minutes: number) => `OFFSET · ${formatOffsetMinutes(minutes)}`;

  if (lateOffsetApplied && earlyOutOffsetApplied) {
    return { label: offsetLabel(lateOffsetAppliedMinutes + earlyOutOffsetAppliedMinutes), className: 'tag-offset-combined' };
  }
  if (lateOffsetApplied) {
    return { label: offsetLabel(lateOffsetAppliedMinutes), className: 'tag-offset' };
  }
  if (earlyOutOffsetApplied) {
    return { label: offsetLabel(earlyOutOffsetAppliedMinutes), className: 'tag-offset-early' };
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
