'use client';

// Dashboard stats derived from the raw attendance/leave loads: today's
// totals, the "not yet timed in" list, and on-leave detection. Pure
// memos -- no fetching here.
import { useMemo } from 'react';
import { toManilaDateString, type AttendanceLog, type Profile } from './shared';
import type { LeaveRequest } from '@/lib/types/hr';

export function useHrDashboardStats({ attendance, profiles, leaveRequests }: {
  attendance: AttendanceLog[];
  profiles: Profile[];
  leaveRequests: LeaveRequest[];
}) {
  const todayManila = useMemo(() => {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' });
    return fmt.format(new Date()); // "YYYY-MM-DD"
  }, []);

  const todaysLogs = useMemo(
    () => attendance.filter((log) => log.time_in && toManilaDateString(log.time_in) === todayManila),
    [attendance, todayManila]
  );
  // Present = every employee who has successfully timed in today.
  // Late is a subset of Present, so late employees remain included here.
  // Example: 13 on-time + 1 late = 14 Present, while Late still shows 1.
  const presentTodayCount = useMemo(
    () => new Set(todaysLogs.map((log) => log.user_id)).size,
    [todaysLogs]
  );

  const lateTodayCount = useMemo(
    () => new Set(
      todaysLogs
        .filter((log) => log.status?.toLowerCase() === 'late')
        .map((log) => log.user_id)
    ).size,
    [todaysLogs]
  );

  // Employees with no time-in yet today. This is intentionally a live,
  // frontend-only view -- it does NOT create a real 'Absent' attendance_logs
  // row (that only happens for days that have already fully passed, via
  // settle_overdue_absences). It just naturally clears an employee off this
  // list the moment their time-in shows up in `attendance`.
  // Employees on an approved leave that covers today shouldn't show up as
  // "not yet timed in" -- they're expected to be out, not tardy/absent.
  const onApprovedLeaveToday = useMemo(
    () =>
      new Set(
        leaveRequests
          .filter((l) => l.status === 'Approved' && l.start_date <= todayManila && l.end_date >= todayManila)
          .map((l) => l.employee?.id)
      ),
    [leaveRequests, todayManila]
  );

  const notYetTimedInToday = useMemo(
    () => profiles.filter((p) => !todaysLogs.some((log) => log.user_id === p.id) && !onApprovedLeaveToday.has(p.id)),
    [profiles, todaysLogs, onApprovedLeaveToday]
  );
  const onLeaveTodayCount = onApprovedLeaveToday.size;

  return { todayManila, todaysLogs, presentTodayCount, lateTodayCount, onApprovedLeaveToday, notYetTimedInToday, onLeaveTodayCount };
}
