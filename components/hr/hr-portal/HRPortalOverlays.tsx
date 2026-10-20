'use client';

// The two "records list" overlays on the HR dashboard: attendance
// insight records (from the analytics drawer) and today's daily
// overview. Each computes its meta/record lists internally so the
// portal shell stays small.
import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import { initials, toManilaDateString, type AttendanceLog, type AttendanceChartSelection, type Profile } from './shared';
import type { LeaveRequest } from '@/lib/types/hr';

const AttendanceInsightsModal = dynamic(() => import('@/components/hr/modals/AttendanceInsightsModal'));
const DailyOverviewModal = dynamic(() => import('@/components/hr/modals/DailyOverviewModal'));

export function HRAttendanceInsightsOverlay({ modal, setModal, attendance, attendanceChartMonth, range }: {
  modal: null | 'attendance' | 'late' | 'absent' | 'leave';
  setModal: Dispatch<SetStateAction<null | 'attendance' | 'late' | 'absent' | 'leave'>>;
  attendance: AttendanceLog[];
  attendanceChartMonth: string;
  range: AttendanceChartSelection | null;
}) {
  const scopeLabel = range?.label || 'This Month';
  const scopeLogs = range
    ? attendance.filter((log) => log.log_date >= range.start && log.log_date <= range.end)
    : attendance.filter((log) => log.log_date?.startsWith(attendanceChartMonth));
  const meta = modal ? {
    attendance: { title: `Present Records · ${scopeLabel}`, description: 'On-time attendance records in the selected period.', tone: 'text-emerald-600', empty: 'No on-time attendance records for this period.' },
    late: { title: `Late Records · ${scopeLabel}`, description: 'Attendance records tagged Late in the selected period.', tone: 'text-orange-600', empty: 'No late records for this period.' },
    absent: { title: `Absent Records · ${scopeLabel}`, description: 'Attendance records tagged Absent in the selected period.', tone: 'text-rose-600', empty: 'No absent records for this period.' },
    leave: { title: `Leave Records · ${scopeLabel}`, description: 'Leave-day attendance records in the selected period.', tone: 'text-blue-600', empty: 'No leave records for this period.' },
  }[modal] : null;

  const records = modal === 'attendance'
    ? scopeLogs.filter((log) => {
        const status = log.status?.toLowerCase() ?? '';
        return status !== 'late' && status !== 'absent' && !status.includes('leave');
      })
    : modal === 'late'
      ? scopeLogs.filter((log) => log.status?.toLowerCase() === 'late')
      : modal === 'absent'
        ? scopeLogs.filter((log) => log.status?.toLowerCase() === 'absent')
        : modal === 'leave'
          ? scopeLogs.filter((log) => log.status?.toLowerCase().includes('leave'))
          : [];

  return <AttendanceInsightsModal modal={modal} meta={meta} records={records} initials={initials} setModal={setModal} />;
}

export function HRDailyOverviewOverlay({ modal, setModal, attendance, profiles, leaveRequests, todayManila }: {
  modal: null | 'present' | 'late' | 'leave' | 'notTimedIn';
  setModal: Dispatch<SetStateAction<null | 'present' | 'late' | 'leave' | 'notTimedIn'>>;
  attendance: AttendanceLog[];
  profiles: Profile[];
  leaveRequests: LeaveRequest[];
  todayManila: string;
}) {
  // Employees with no time-in yet today. This is intentionally a live,
  // frontend-only view -- it does NOT create a real 'Absent' attendance_logs
  // row (that only happens for days that have already fully passed, via
  // settle_overdue_absences). It just naturally clears an employee off this
  // list the moment their time-in shows up in `attendance`.
  // Employees on an approved leave that covers today shouldn't show up as
  // "not yet timed in" -- they're expected to be out, not tardy/absent.
  const approvedLeavesToday = leaveRequests.filter(
    (leave) => leave.status === 'Approved' && leave.start_date <= todayManila && leave.end_date >= todayManila
  );

  const todaysLogs = useMemo(
    () => attendance.filter((log) => log.time_in && toManilaDateString(log.time_in) === todayManila),
    [attendance, todayManila]
  );
  const notYetTimedInToday = useMemo(
    () => profiles.filter((p) => !todaysLogs.some((log) => log.user_id === p.id) && !approvedLeavesToday.some((leave) => leave.employee?.id === p.id)),
    [profiles, todaysLogs, approvedLeavesToday]
  );

  const meta = modal ? {
    present: { title: 'Present Today', description: 'All employees who have timed in today.', tone: 'text-emerald-600', empty: 'No employees have timed in today.' },
    late: { title: 'Late Today', description: 'Employees tagged Late for today.', tone: 'text-orange-600', empty: 'No late records today.' },
    leave: { title: 'On Leave Today', description: 'Approved leave requests covering today.', tone: 'text-blue-600', empty: 'No employees are on approved leave today.' },
    notTimedIn: { title: 'Not Timed In Today', description: 'Employees with no time-in and no approved leave today.', tone: 'text-amber-600', empty: 'Everyone expected today has already timed in.' },
  }[modal] : null;

  const records = modal === 'present'
    ? todaysLogs
    : modal === 'late'
      ? todaysLogs.filter((log) => log.status?.toLowerCase() === 'late')
      : modal === 'leave'
        ? approvedLeavesToday
        : modal === 'notTimedIn'
          ? notYetTimedInToday
          : [];

  return <DailyOverviewModal modal={modal} meta={meta} records={records} initials={initials} setModal={setModal} />;
}
