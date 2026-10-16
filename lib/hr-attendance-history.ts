import { getAttendanceStatusDisplay } from './attendance-status-display';
import { computeLateMinutes } from './attendance-rules';

export const HR_ATTENDANCE_PAGE_SIZE = 6;
export type HRAttendanceFilter = 'all' | 'present' | 'late' | 'early-out' | 'absent' | 'leave' | 'offset';
export type HRAttendanceRecord = {
  id: string;
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

export function manilaAttendanceDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(now);
}

export function formatHRAttendanceTime(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  return new Date(value).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatHRAttendanceHours(record: HRAttendanceRecord) {
  if (!record.time_in) return '—';
  if (!record.time_out) return 'In progress';
  const elapsed = Date.parse(record.time_out) - Date.parse(record.time_in);
  if (!Number.isFinite(elapsed) || elapsed < 0) return '—';
  const minutes = Math.round(elapsed / 60_000);
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function hrAttendanceLateMinutes(record: HRAttendanceRecord, cutoffHour: number, cutoffMinute: number) {
  if (!hrAttendancePresentation(record, 23).late) return 0;
  return computeLateMinutes(record.time_in, cutoffHour, cutoffMinute);
}

export function hrAttendancePresentation(record: HRAttendanceRecord, timeOutHour: number) {
  const display = getAttendanceStatusDisplay({ status: record.status, logDate: record.log_date, timeOut: record.time_out, lateOffsetMinutes: record.late_offset_minutes, earlyOutOffsetMinutes: record.early_out_offset_minutes, absentOffsetMinutes: record.absent_offset_minutes, timeOutHour });
  const normalized = display.label.toLowerCase();
  const late = normalized.includes('late');
  const earlyOut = normalized.includes('early out');
  const absent = normalized === 'absent';
  const leave = normalized.includes('leave');
  const offset = record.status?.trim().toLowerCase() === 'offset applied' || Number(record.late_offset_minutes || 0) > 0 || Number(record.early_out_offset_minutes || 0) > 0 || Number(record.absent_offset_minutes || 0) > 0;
  const category = absent ? 'absent' : late ? 'late' : earlyOut ? 'early-out' : leave ? 'leave' : 'present';
  const remarks = offset ? 'Resolved with Offset' : record.early_out_offset_requests?.some(request => request.status === 'Pending') ? 'Offset pending' : leave ? record.status || 'Leave' : !record.time_in ? 'No time in' : !record.time_out ? 'No time out' : earlyOut ? 'Early time out' : '—';
  return { display, late, earlyOut, absent, leave, offset, category, remarks, present: !late && !earlyOut && !absent && !leave };
}

export function matchesHRAttendanceStatus(record: HRAttendanceRecord, filter: HRAttendanceFilter, timeOutHour: number) {
  if (filter === 'all') return true;
  const item = hrAttendancePresentation(record, timeOutHour);
  if (filter === 'early-out') return item.earlyOut;
  return item[filter];
}

export type HRAttendanceFilters = { employeeId: string; month: string; half: 'all' | 'H1' | 'H2'; date: string; status: HRAttendanceFilter; search: string };

export function filterHRAttendance(records: HRAttendanceRecord[], filters: HRAttendanceFilters, timeOutHour: number, includeStatus = true) {
  const search = filters.search.trim().toLowerCase();
  return records.filter(record => {
    if (filters.employeeId && record.user_id !== filters.employeeId) return false;
    if (filters.date && record.log_date !== filters.date) return false;
    if (filters.month && !record.log_date.startsWith(filters.month)) return false;
    const day = Number(record.log_date.slice(8, 10));
    if (filters.half === 'H1' && day > 15) return false;
    if (filters.half === 'H2' && day < 16) return false;
    if (includeStatus && !matchesHRAttendanceStatus(record, filters.status, timeOutHour)) return false;
    const item = hrAttendancePresentation(record, timeOutHour);
    return !search || `${record.profiles?.full_name || ''} ${record.profiles?.employee_id || ''} ${record.log_date} ${item.display.label} ${item.remarks}`.toLowerCase().includes(search);
  }).sort((left, right) => right.log_date.localeCompare(left.log_date) || (right.time_in || '').localeCompare(left.time_in || '') || left.id.localeCompare(right.id));
}
