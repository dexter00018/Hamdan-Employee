'use client';

// Attendance analytics chart state + derived series (trend/day breakdown
// and current-month distribution). Chart month/mode/slice belong to this
// domain; the drawing itself lives in HRAttendanceAnalyticsView.
import { useMemo, useState } from 'react';
import type { AttendanceLog } from './shared';

export function useHrAttendanceChart({ attendance, darkMode }: {
  attendance: AttendanceLog[];
  darkMode: boolean;
}) {
  const [attendanceChartMonth, setAttendanceChartMonth] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7));
  const [attendanceChartMode, setAttendanceChartMode] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [activeAttendanceSlice, setActiveAttendanceSlice] = useState<number | undefined>(undefined);

  const attendanceInsights = useMemo(() => {
    const currentMonth = attendanceChartMonth;
    const [year, month] = currentMonth.split('-').map(Number);
    const previousDate = new Date(year, month - 2, 1);
    const previousMonth = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, '0')}`;
    const summarize = (monthKey: string) => {
      const logs = attendance.filter((log) => log.log_date?.startsWith(monthKey));
      const late = logs.filter((log) => log.status?.toLowerCase() === 'late').length;
      const absent = logs.filter((log) => log.status?.toLowerCase() === 'absent').length;
      const leave = logs.filter((log) => log.status?.toLowerCase().includes('leave')).length;
      const worked = logs.filter((log) => {
        const status = log.status?.toLowerCase() ?? '';
        return status !== 'absent' && !status.includes('leave');
      }).length;
      const total = worked + absent + leave;
      return { logs, late, absent, leave, worked, attendanceRate: total ? Math.round((worked / total) * 100) : 0 };
    };
    const current = summarize(currentMonth);
    const previous = summarize(previousMonth);
    const lateByEmployee = new Map<string, number>();
    current.logs.filter((log) => log.status?.toLowerCase() === 'late').forEach((log) => {
      const name = log.profiles?.full_name || 'Unknown';
      lateByEmployee.set(name, (lateByEmployee.get(name) ?? 0) + 1);
    });
    const topLateEmployees = Array.from(lateByEmployee.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { currentMonth, current, previous, topLateEmployees };
  }, [attendance, attendanceChartMonth]);

  const attendanceChartData = useMemo(() => {
    const { worked, late, absent, leave } = attendanceInsights.current;
    return [
      { key: 'attendance', name: 'Present', value: Math.max(0, worked - late), color: '#16a34a' },
      { key: 'late', name: 'Late', value: late, color: '#f59e0b' },
      { key: 'leave', name: 'Leave', value: leave, color: '#3b82f6' },
      { key: 'absent', name: 'Absent', value: absent, color: '#f43f5e' },
    ].filter((item) => item.value > 0);
  }, [attendanceInsights]);

  const attendanceTrendData = useMemo(() => {
    const categoryFor = (log: AttendanceLog) => {
      const status = log.status?.toLowerCase() ?? '';
      if (status === 'late') return 'late' as const;
      if (status === 'absent') return 'absent' as const;
      if (status.includes('leave')) return 'leave' as const;
      return 'present' as const;
    };
    const emptyRow = (label: string, key: string, start = key, end = start) => ({ key, label, start, end, isWeekend: false, present: 0, late: 0, leave: 0, absent: 0 });
    const currentMonth = attendanceChartMonth;

    if (attendanceChartMode === 'daily') {
      const daysInMonth = new Date(Number(currentMonth.slice(0, 4)), Number(currentMonth.slice(5, 7)), 0).getDate();
      const rows = Array.from({ length: daysInMonth }, (_, index) => {
        const date = new Date(Number(currentMonth.slice(0, 4)), Number(currentMonth.slice(5, 7)) - 1, index + 1);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        return { ...emptyRow(new Intl.DateTimeFormat('en-PH', { weekday: 'short', day: 'numeric' }).format(date), key), isWeekend: date.getDay() === 0 || date.getDay() === 6 };
      });
      const byDate = new Map(rows.map((row) => [row.key, row]));
      attendance.forEach((log) => {
        const row = byDate.get(log.log_date);
        if (row) row[categoryFor(log)] += 1;
      });
      return rows;
    }

    if (attendanceChartMode === 'weekly') {
      const weeksInMonth = Math.ceil(new Date(Number(currentMonth.slice(0, 4)), Number(currentMonth.slice(5, 7)), 0).getDate() / 7);
      const rows = Array.from({ length: weeksInMonth }, (_, index) => {
        const startDay = index * 7 + 1;
        const endDay = Math.min((index + 1) * 7, new Date(Number(currentMonth.slice(0, 4)), Number(currentMonth.slice(5, 7)), 0).getDate());
        return emptyRow(`Week ${index + 1}`, `week-${index + 1}`, `${currentMonth}-${String(startDay).padStart(2, '0')}`, `${currentMonth}-${String(endDay).padStart(2, '0')}`);
      });
      attendance.filter((log) => log.log_date?.startsWith(currentMonth)).forEach((log) => {
        const week = Math.min(rows.length - 1, Math.floor((Number(log.log_date.slice(8, 10)) - 1) / 7));
        rows[week][categoryFor(log)] += 1;
      });
      return rows;
    }

    const selectedYear = Number(currentMonth.slice(0, 4));
    const rows = Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      const key = `${selectedYear}-${String(month).padStart(2, '0')}`;
      const date = new Date(selectedYear, index, 1);
      const endDay = new Date(selectedYear, month, 0).getDate();
      return emptyRow(new Intl.DateTimeFormat('en-PH', { month: 'short' }).format(date), key, `${key}-01`, `${key}-${String(endDay).padStart(2, '0')}`);
    });
    const byMonth = new Map(rows.map((row) => [row.key, row]));
    attendance.forEach((log) => {
      const row = byMonth.get(log.log_date?.slice(0, 7));
      if (row) row[categoryFor(log)] += 1;
    });
    return rows;
  }, [attendance, attendanceChartMode, attendanceChartMonth]);

  const chartTextColor = darkMode ? '#e2e8f0' : '#475569';
  const chartLineColor = darkMode ? '#475569' : '#cbd5e1';

  return {
    attendanceChartMonth, setAttendanceChartMonth,
    attendanceChartMode, setAttendanceChartMode,
    activeAttendanceSlice, setActiveAttendanceSlice,
    attendanceInsights, attendanceChartData, attendanceTrendData,
    chartTextColor, chartLineColor,
  };
}
