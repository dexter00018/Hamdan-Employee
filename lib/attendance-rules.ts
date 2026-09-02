export type AttendanceStatus = 'Present' | 'Late';

export function computeAttendanceStatus(hour: number, minute: number, cutoffHour: number, cutoffMinute: number): AttendanceStatus {
  return hour > cutoffHour || (hour === cutoffHour && minute > cutoffMinute) ? 'Late' : 'Present';
}
