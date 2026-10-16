import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { filterHRAttendance, formatHRAttendanceHours, formatHRAttendanceTime, HR_ATTENDANCE_PAGE_SIZE, hrAttendanceLateMinutes, hrAttendancePresentation, matchesHRAttendanceStatus, type HRAttendanceFilters, type HRAttendanceRecord } from '../lib/hr-attendance-history';

const base: HRAttendanceRecord = { id: 'one', user_id: 'employee-1', log_date: '2026-10-15', time_in: '2026-10-15T01:20:04Z', time_out: '2026-10-15T11:00:07Z', status: 'Late', profiles: { full_name: 'Same Name', employee_id: 'HE-001' } };
const all: HRAttendanceFilters = { employeeId: '', month: '', half: 'all', date: '', status: 'all', search: '' };

describe('HR attendance filters and presentation', () => {
  it('shows full Late minutes from 9:00 AM, including after Offset approval', () => {
    const record = { ...base, time_in: '2026-10-15T01:16:00Z' };
    expect(hrAttendanceLateMinutes(record, 9, 15)).toBe(16);
    expect(hrAttendanceLateMinutes({ ...record, status: 'Offset Applied', late_offset_minutes: 16 }, 9, 15)).toBe(16);
    expect(hrAttendanceLateMinutes({ ...record, status: 'Present' }, 9, 15)).toBe(0);
    expect(hrAttendanceLateMinutes({ ...record, time_in: '2026-10-15T01:15:59Z' }, 9, 15)).toBe(0);
    expect(hrAttendanceLateMinutes({ ...record, time_in: null }, 9, 15)).toBe(0);
  });

  it('keeps late records in the Late filter after Offset approval', () => {
    const record = { ...base, status: 'Offset Applied', late_offset_minutes: 20 };
    expect(matchesHRAttendanceStatus(record, 'late', 19)).toBe(true);
    expect(matchesHRAttendanceStatus(record, 'offset', 19)).toBe(true);
    expect(hrAttendancePresentation(record, 19).remarks).toBe('Resolved with Offset');
  });

  it('keeps early-out records in their original filter after Offset approval', () => {
    const record = { ...base, status: 'Present', time_out: '2026-10-15T09:30:00Z', early_out_offset_minutes: 90 };
    expect(matchesHRAttendanceStatus(record, 'early-out', 19)).toBe(true);
    expect(matchesHRAttendanceStatus(record, 'present', 19)).toBe(false);
    expect(hrAttendancePresentation(record, 19).display.label).toBe('EARLY OUT');
  });

  it('matches combined late and early-out records in both filters', () => {
    const record = { ...base, time_out: '2026-10-15T09:30:00Z' };
    expect(matchesHRAttendanceStatus(record, 'late', 19)).toBe(true);
    expect(matchesHRAttendanceStatus(record, 'early-out', 19)).toBe(true);
  });

  it('preserves the original Absent issue after Offset approval', () => {
    const record = { ...base, time_in: null, time_out: null, status: 'Absent', absent_offset_minutes: 600 };
    expect(hrAttendancePresentation(record, 19).display.label).toBe('ABSENT');
    expect(matchesHRAttendanceStatus(record, 'absent', 19)).toBe(true);
    expect(matchesHRAttendanceStatus(record, 'offset', 19)).toBe(true);
  });

  it('keeps Leave separate from Present and shows its remarks', () => {
    const record = { ...base, status: 'Sick Leave', time_in: null, time_out: null };
    expect(matchesHRAttendanceStatus(record, 'leave', 19)).toBe(true);
    expect(matchesHRAttendanceStatus(record, 'present', 19)).toBe(false);
    expect(hrAttendancePresentation(record, 19).remarks).toBe('Sick Leave');
  });

  it('selects employees by ID rather than matching duplicate names', () => {
    const other = { ...base, id: 'two', user_id: 'employee-2' };
    expect(filterHRAttendance([base, other], { ...all, employeeId: 'employee-1' }, 19).map(row => row.id)).toEqual(['one']);
  });

  it('handles the exact 15th/16th payroll boundary within the selected month', () => {
    const rows = [base, { ...base, id: 'sixteenth', log_date: '2026-10-16' }, { ...base, id: 'other-month', log_date: '2026-09-16' }];
    expect(filterHRAttendance(rows, { ...all, month: '2026-10', half: 'H1' }, 19).map(row => row.id)).toEqual(['one']);
    expect(filterHRAttendance(rows, { ...all, month: '2026-10', half: 'H2' }, 19).map(row => row.id)).toEqual(['sixteenth']);
  });

  it('filters a specific Manila log_date without using the UTC timestamp prefix', () => {
    const record = { ...base, log_date: '2026-10-16', time_in: '2026-10-15T17:00:00Z' };
    expect(filterHRAttendance([record], { ...all, date: '2026-10-16' }, 19)).toHaveLength(1);
    expect(filterHRAttendance([record], { ...all, date: '2026-10-15' }, 19)).toHaveLength(0);
  });

  it('searches employee IDs and Offset remarks', () => {
    expect(filterHRAttendance([base], { ...all, search: 'he-001' }, 19)).toHaveLength(1);
    expect(filterHRAttendance([{ ...base, late_offset_minutes: 20 }], { ...all, search: 'resolved with offset' }, 19)).toHaveLength(1);
  });

  it('can count the selected period independently of the current status filter', () => {
    const rows = [base, { ...base, id: 'present', status: 'Present' }];
    expect(filterHRAttendance(rows, { ...all, status: 'late' }, 19)).toHaveLength(1);
    expect(filterHRAttendance(rows, { ...all, status: 'late' }, 19, false)).toHaveLength(2);
  });

  it('formats Philippine timestamps with seconds', () => {
    expect(formatHRAttendanceTime('2026-10-15T01:20:04Z')).toBe('09:20:04 AM');
    expect(formatHRAttendanceTime(null)).toBe('—');
    expect(formatHRAttendanceTime('invalid')).toBe('—');
  });

  it('shows in-progress records and rejects invalid negative durations', () => {
    expect(formatHRAttendanceHours(base)).toBe('9h 40m');
    expect(formatHRAttendanceHours({ ...base, time_out: null })).toBe('In progress');
    expect(formatHRAttendanceHours({ ...base, time_out: '2026-10-15T00:00:00Z' })).toBe('—');
  });

  it('puts the seventh attendance record on the next page', () => {
    const records = Array.from({ length: 7 }, (_, index) => ({ ...base, id: String(index) }));
    expect(HR_ATTENDANCE_PAGE_SIZE).toBe(6);
    expect(records.slice(0, HR_ATTENDANCE_PAGE_SIZE)).toHaveLength(6);
    expect(records.slice(HR_ATTENDANCE_PAGE_SIZE)).toHaveLength(1);
  });
});

describe('dedicated HR Attendance route', () => {
  const portal = readFileSync(new URL('../components/hr/HRPortal.tsx', import.meta.url), 'utf8');
  it('navigates to its own page rather than expanding a dashboard section', () => {
    expect(portal).toContain("router.push('/hr/attendance')");
    expect(portal).toContain('router.push(`/hr/attendance?employee=${encodeURIComponent(profile.id)}`)');
    expect(portal.includes('id="attendance-history"')).toBe(false);
    expect(portal).not.toContain('setAttendanceHistoryOpen');
    expect(readFileSync(new URL('../app/hr/attendance/page.tsx', import.meta.url), 'utf8')).toContain('<HRPortal view="attendance"');
  });

  it('inherits the HR role guard and retains the employee-only active profile query', () => {
    const proxy = readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8');
    expect(proxy).toContain("'/hr': ['admin']");
    expect(proxy).toContain("'/hr/:path*'");
    expect(portal).toContain(".eq('profiles.role', 'employee')");
    expect(portal).toContain(".eq('profiles.is_active', true)");
    expect(portal).toContain('if (isAttendancePage) { void refreshAllData(); void fetchLeaveRequests(); }');
  });
});
