'use client';

// Chart JSX for the HR dashboard analytics drawer. Presentational only --
// all data memos and chart state live in HRPortal, passed down as props.
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { BarRectangleItem, TooltipContentProps } from 'recharts';
import { ChevronRight } from 'lucide-react';

import MonthCalendarPicker from '@/components/hr/MonthCalendarPicker';
import hrStyles from '@/components/hr/hr-dashboard.module.css';

type TrendRow = {
  key: string;
  label: string;
  start: string;
  end: string;
  isWeekend: boolean;
  present: number;
  late: number;
  leave: number;
  absent: number;
};

export function HRAttendanceAnalyticsView({
  attendanceTrendData,
  attendanceChartData,
  currentMonthLogCount,
  profilesCount,
  darkMode,
  chartTextColor,
  chartLineColor,
  attendanceChartMonth,
  setAttendanceChartMonth,
  attendanceChartMode,
  setAttendanceChartMode,
  activeAttendanceSlice,
  setActiveAttendanceSlice,
  openAttendanceChartDetail,
  openAttendanceSummary,
}: {
  attendanceTrendData: TrendRow[];
  attendanceChartData: { key: string; name: string; value: number; color: string }[];
  currentMonthLogCount: number;
  profilesCount: number;
  darkMode: boolean;
  chartTextColor: string;
  chartLineColor: string;
  attendanceChartMonth: string;
  setAttendanceChartMonth: (month: string) => void;
  attendanceChartMode: 'daily' | 'weekly' | 'monthly';
  setAttendanceChartMode: (mode: 'daily' | 'weekly' | 'monthly') => void;
  activeAttendanceSlice: number | undefined;
  setActiveAttendanceSlice: (index: number | undefined) => void;
  openAttendanceChartDetail: (kind: 'attendance' | 'late' | 'leave' | 'absent', row: { start?: string | number; end?: string | number; label?: string | number }) => void;
  openAttendanceSummary: (kind: 'attendance' | 'late' | 'leave' | 'absent') => void;
}) {
  const chartTooltipStyle = { backgroundColor: darkMode ? '#1e293b' : '#ffffff', borderColor: darkMode ? '#475569' : '#cbd5e1', color: darkMode ? '#f8fafc' : '#0f172a', borderRadius: 12, fontSize: 12 };
  const attendanceLegend = [
    { key: 'present', label: 'Present', color: '#16a34a' },
    { key: 'late', label: 'Late', color: '#f59e0b' },
    { key: 'leave', label: 'Leave', color: '#3b82f6' },
    { key: 'absent', label: 'Absent', color: '#f43f5e' },
  ] as const;
  const attendanceTooltipContent = ({ active, payload, label }: TooltipContentProps) => {
    if (!active || !label) return null;
    return <div style={chartTooltipStyle} className="min-w-28 border px-3 py-2 shadow-lg"><p className="mb-1.5 text-[11px] font-bold">{label}</p><div className="space-y-1">{attendanceLegend.map((item) => {
      const value = Number(payload?.find((entry) => entry.name === item.label)?.value ?? 0);
      return <div key={item.key} className="flex items-center justify-between gap-5 text-[11px]"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</span><b className="tabular-nums">{value}</b></div>;
    })}</div></div>;
  };

  return (
    <div className={hrStyles.analytics}>
          <section className="card-style min-w-0 !p-4" aria-labelledby="attendance-trend-title">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="attendance-trend-title" className="text-base font-semibold">Attendance Trend</h2><p className="mt-0.5 text-xs text-slate-500">Attendance records across the selected period</p></div><div className="flex flex-wrap items-center justify-end gap-2"><MonthCalendarPicker value={attendanceChartMonth} onChange={setAttendanceChartMonth} /><div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">{(['daily', 'weekly', 'monthly'] as const).map((mode) => <button type="button" key={mode} onClick={() => setAttendanceChartMode(mode)} className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold capitalize transition ${attendanceChartMode === mode ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>{mode}</button>)}</div></div></div>
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold text-slate-500"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-green-600" />Present</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-amber-500" />Late</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-blue-500" />Leave</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-rose-500" />Absent</span></div>
            <div className="attendance-analytics-chart mt-2 h-64 min-w-0">{attendanceTrendData.some((row) => row.present || row.late || row.leave || row.absent) ? <ResponsiveContainer width="100%" height="100%"><BarChart data={attendanceTrendData} tabIndex={-1} style={{ outline: 'none' }} margin={{ top: 10, right: 6, left: -18, bottom: 0 }} barCategoryGap={attendanceChartMode === 'daily' ? '18%' : '28%'}><CartesianGrid stroke={chartLineColor} strokeDasharray="4 4" vertical={false} />{attendanceChartMode === 'daily' && attendanceTrendData.filter((row) => row.isWeekend).map((row) => <ReferenceArea key={row.key} x1={row.label} x2={row.label} fill="#94a3b8" fillOpacity={darkMode ? 0.22 : 0.14} stroke="none" />)}<XAxis dataKey="label" interval={attendanceChartMode === 'daily' ? 2 : 0} tick={({ x, y, payload }: { x?: string | number; y?: string | number; payload?: { value?: string } }) => { const label = String(payload?.value ?? ''); const weekend = attendanceTrendData.find((row) => row.label === label)?.isWeekend; return <text x={x} y={(Number(y) || 0) + 14} textAnchor="middle" fontSize={10} fontWeight={weekend ? 700 : 500} fill={weekend ? (darkMode ? '#cbd5e1' : '#475569') : chartTextColor}>{label}</text>; }} tickLine={false} axisLine={{ stroke: chartLineColor }} /><YAxis domain={[0, Math.max(1, profilesCount)]} tick={{ fontSize: 10, fill: chartTextColor }} tickLine={false} axisLine={false} allowDecimals={false} /><Tooltip content={attendanceTooltipContent} cursor={{ fill: darkMode ? 'rgba(148,163,184,.16)' : 'rgba(148,163,184,.08)' }} /><Bar dataKey="present" name="Present" stackId="attendance" fill="#16a34a" isAnimationActive animationDuration={550} className="cursor-pointer" onClick={(row: BarRectangleItem) => openAttendanceChartDetail('attendance', row)} /><Bar dataKey="late" name="Late" stackId="attendance" fill="#f59e0b" isAnimationActive animationDuration={550} className="cursor-pointer" onClick={(row: BarRectangleItem) => openAttendanceChartDetail('late', row)} /><Bar dataKey="leave" name="Leave" stackId="attendance" fill="#3b82f6" isAnimationActive animationDuration={550} className="cursor-pointer" onClick={(row: BarRectangleItem) => openAttendanceChartDetail('leave', row)} /><Bar dataKey="absent" name="Absent" stackId="attendance" fill="#f43f5e" radius={[5, 5, 0, 0]} isAnimationActive animationDuration={550} className="cursor-pointer" onClick={(row: BarRectangleItem) => openAttendanceChartDetail('absent', row)} /></BarChart></ResponsiveContainer> : <div className="grid h-full place-items-center text-center text-sm text-slate-400">No attendance records for this period.</div>}</div>
          </section>

          <section className="card-style min-w-0 !p-4" aria-labelledby="attendance-distribution-title">
            <div className="flex items-start justify-between gap-3"><div><h2 id="attendance-distribution-title" className="text-base font-semibold">Attendance Overview</h2><p className="mt-0.5 text-xs text-slate-500">Current-month attendance logs</p></div><button type="button" onClick={() => openAttendanceSummary('attendance')} className="inline-flex min-h-9 items-center gap-1 rounded-full px-2 text-[10px] font-bold text-green-700 hover:bg-green-50 dark:text-green-300">Details <ChevronRight size={14}/></button></div>
            <div className="attendance-analytics-chart relative mx-auto mt-2 h-48 max-w-[290px]" aria-label="Current-month attendance record distribution">{attendanceChartData.length > 0 ? <ResponsiveContainer width="100%" height="100%"><PieChart style={{ outline: 'none' }}><Pie data={attendanceChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="58%" outerRadius="82%" paddingAngle={4} stroke="none" isAnimationActive animationDuration={620} onMouseLeave={() => setActiveAttendanceSlice(undefined)} rootTabIndex={-1}>{attendanceChartData.map((item, index) => <Cell key={item.key} fill={item.color} opacity={activeAttendanceSlice === undefined || activeAttendanceSlice === index ? 1 : 0.32} onMouseEnter={() => setActiveAttendanceSlice(index)} />)}</Pie></PieChart></ResponsiveContainer> : <div className="grid h-full place-items-center text-center text-sm text-slate-400">No attendance records<br />this month.</div>}{attendanceChartData.length > 0 && <div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><p className="stat-number text-3xl leading-none text-slate-900 dark:text-white">{currentMonthLogCount}</p></div>}</div>
            {attendanceChartData.length > 0 && <div className="mt-1 grid grid-cols-2 gap-1.5">{attendanceChartData.map((item) => <button type="button" key={item.key} onClick={() => openAttendanceSummary(item.key as 'attendance' | 'late' | 'leave' | 'absent')} className="flex items-center justify-between rounded-xl px-2 py-1.5 text-left text-[11px] transition hover:bg-slate-50 dark:hover:bg-slate-800"><span className="flex min-w-0 items-center gap-2 text-slate-600 dark:text-slate-300"><i className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} /><span className="truncate">{item.name}</span></span><b className="tabular-nums text-slate-800 dark:text-white">{item.value} · {Math.round(item.value / currentMonthLogCount * 100)}%</b></button>)}</div>}
          </section>
        </div>
  );
}

export default HRAttendanceAnalyticsView;
