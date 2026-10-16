'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, LogOut, RefreshCw, Search, SlidersHorizontal, TriangleAlert, UserRound } from 'lucide-react';
import EmployeeThemeToggle from '@/components/employee/EmployeeThemeToggle';
import ModalShell from '@/components/shared/ModalShell';
import { filterHRAttendance, formatHRAttendanceHours, formatHRAttendanceTime, HR_ATTENDANCE_PAGE_SIZE, hrAttendancePresentation, manilaAttendanceDate, type HRAttendanceFilters, type HRAttendanceRecord } from '@/lib/hr-attendance-history';
import type { AttendanceDispute } from '@/lib/types/hr';
import styles from './hr-attendance-history.module.css';

type Employee = { id: string; full_name: string | null; employee_id: string | null };
type Props = { records: HRAttendanceRecord[]; profiles: Employee[]; loading: boolean; refreshing: boolean; updatedAt: Date | null; initialEmployeeId?: string; timeOutHour: number; lateCutoffHour: number; lateCutoffMinute: number; disputes: AttendanceDispute[]; darkMode: boolean; onToggleTheme: () => void; onTools: () => void; onRefresh: () => void; onDashboard: () => void };

const subscribeToMount = () => () => {};
const mountedSnapshot = () => true;
const serverSnapshot = () => false;

function displayDate(value: string) {
  return new Date(`${value}T12:00:00+08:00`).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric' });
}

function displayMonth(value: string) {
  return value ? new Date(`${value}-01T12:00:00+08:00`).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'long', year: 'numeric' }) : 'All months';
}

function lateMinutes(record: HRAttendanceRecord, hour: number, minute: number) {
  if (!record.time_in || !Number.isFinite(Date.parse(record.time_in)) || !hrAttendancePresentation(record, 23).late) return 0;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(record.time_in));
  const value = (name: string) => Number(parts.find(part => part.type === name)?.value || 0);
  return Math.max(0, value('hour') * 60 + value('minute') - hour * 60 - minute);
}

export default function HRAttendanceHistory(props: Props) {
  const mounted = useSyncExternalStore(subscribeToMount, mountedSnapshot, serverSnapshot);
  const [filters, setFilters] = useState<HRAttendanceFilters>(() => {
    const today = manilaAttendanceDate();
    return { employeeId: props.initialEmployeeId || '', month: props.initialEmployeeId ? '' : today.slice(0, 7), date: props.initialEmployeeId ? '' : today, half: 'all', status: 'all', search: '' };
  });
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const setFilter = (patch: Partial<HRAttendanceFilters>) => { setFilters(current => ({ ...current, ...patch })); setPage(1); };
  const records = useMemo(() => {
    const employees = new Map(props.profiles.map(employee => [employee.id, employee]));
    return props.records.map(record => { const employee = employees.get(record.user_id); return { ...record, profiles: { full_name: employee?.full_name || record.profiles?.full_name || null, employee_id: employee?.employee_id || record.profiles?.employee_id || null } }; });
  }, [props.records, props.profiles]);
  const months = useMemo(() => [...new Set([manilaAttendanceDate().slice(0, 7), ...records.map(record => record.log_date.slice(0, 7))])].sort().reverse(), [records]);
  const periodRecords = useMemo(() => filterHRAttendance(records, filters, props.timeOutHour, false), [records, filters, props.timeOutHour]);
  const visibleRecords = useMemo(() => filterHRAttendance(records, filters, props.timeOutHour), [records, filters, props.timeOutHour]);
  const counts = useMemo(() => periodRecords.reduce((total, record) => {
    const item = hrAttendancePresentation(record, props.timeOutHour);
    if (item.present) total.present += 1;
    if (item.late) total.late += 1;
    if (item.earlyOut) total['early-out'] += 1;
    if (item.absent) total.absent += 1;
    if (item.leave) total.leave += 1;
    return total;
  }, { present: 0, late: 0, 'early-out': 0, absent: 0, leave: 0 }), [periodRecords, props.timeOutHour]);
  const totalLateMinutes = useMemo(() => periodRecords.reduce((sum, record) => sum + lateMinutes(record, props.lateCutoffHour, props.lateCutoffMinute), 0), [periodRecords, props.lateCutoffHour, props.lateCutoffMinute]);
  const pages = Math.max(1, Math.ceil(visibleRecords.length / HR_ATTENDANCE_PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const start = (currentPage - 1) * HR_ATTENDANCE_PAGE_SIZE;
  const pageRecords = visibleRecords.slice(start, start + HR_ATTENDANCE_PAGE_SIZE);
  const selected = records.find(record => record.id === selectedId);
  const selectedPresentation = selected ? hrAttendancePresentation(selected, props.timeOutHour) : null;
  const selectedDisputes = selected ? props.disputes.filter(dispute => dispute.attendance_log_id === selected.id || (dispute.employee?.id === selected.user_id && dispute.dispute_date === selected.log_date)) : [];
  const periodLabel = filters.date ? displayDate(filters.date) : `${displayMonth(filters.month)}${filters.half === 'all' ? '' : filters.half === 'H1' ? ' · 1st half' : ' · 2nd half'}`;
  const viewToday = () => { const today = manilaAttendanceDate(); setFilter({ date: today, month: today.slice(0, 7), half: 'all' }); };

  return <div className={styles.history}>
    <header className={styles.header}>
      <div className={styles.title}><button type="button" onClick={props.onDashboard} className={styles.back} aria-label="Back to HR dashboard"><ArrowLeft size={19} /></button><div><h1>Attendance History</h1><p>Review employee attendance records and discrepancies.</p></div></div>
      <div className={styles.headerActions}><label className={styles.monthPicker}><CalendarDays size={17} /><select aria-label="Attendance month" value={filters.month} onChange={event => setFilter({ month: event.target.value, date: '', half: 'all' })}><option value="">All months</option>{months.map(month => <option key={month} value={month}>{displayMonth(month)}</option>)}</select></label><button type="button" onClick={viewToday} className={styles.today}>Today</button><EmployeeThemeToggle compact darkMode={props.darkMode} onToggle={props.onToggleTheme} className={styles.mobileTheme} /><button type="button" className={styles.mobileTools} onClick={props.onTools} aria-label="Open HR tools"><UserRound size={19} /></button></div>
    </header>

    <section className={styles.summary} aria-label="Attendance summary" aria-busy={props.loading}>
      {[
        { key: 'present' as const, label: 'Present', value: counts.present, icon: Check, tone: 'green' },
        { key: 'late' as const, label: 'Late', value: counts.late, icon: Clock3, tone: 'orange' },
        { key: 'early-out' as const, label: 'Early Out', value: counts['early-out'], icon: LogOut, tone: 'yellow' },
        { key: 'absent' as const, label: 'Absent', value: counts.absent, icon: TriangleAlert, tone: 'red' },
      ].map(({ key, label, value, icon: Icon, tone }) => <button key={key} type="button" data-tone={tone} className={styles.summaryCard} aria-pressed={filters.status === key} onClick={() => setFilter({ status: filters.status === key ? 'all' : key })}><span><Icon size={20} /></span><div><strong>{props.loading ? '—' : value}</strong><small>{label}</small></div></button>)}
    </section>

    <section className={styles.records} aria-labelledby="hr-attendance-records-title" aria-busy={props.loading}>
      <div className={styles.recordsHeader}><div><h2 id="hr-attendance-records-title">{periodLabel}</h2><p>{periodRecords.length} records · {counts.leave} leave · {counts.absent} absent{totalLateMinutes ? ` · ${totalLateMinutes} late minutes` : ''}</p></div><div className={styles.searchAndStatus}><label className={styles.search}><Search size={16} /><input type="search" aria-label="Search attendance records" placeholder="Search employee, date, status, or remarks…" value={filters.search} onChange={event => setFilter({ search: event.target.value })} /></label><label className={styles.statusPicker}><SlidersHorizontal size={15} /><select aria-label="Attendance status" value={filters.status} onChange={event => setFilter({ status: event.target.value as HRAttendanceFilters['status'] })}><option value="all">All status</option><option value="present">Present</option><option value="late">Late</option><option value="early-out">Early Out</option><option value="absent">Absent</option><option value="leave">Leave</option><option value="offset">Resolved with Offset</option></select></label></div></div>
      <div className={styles.filters}>
        <label className={styles.employeePicker}><UserRound size={15} /><select aria-label="Filter employee" value={filters.employeeId} onChange={event => setFilter({ employeeId: event.target.value })}><option value="">All employees</option>{props.profiles.map(employee => <option key={employee.id} value={employee.id}>{employee.full_name || 'Unknown'}{employee.employee_id ? ` · ${employee.employee_id}` : ''}</option>)}</select></label>
        <div className={styles.cutoff} role="group" aria-label="Payroll cutoff">{(['all', 'H1', 'H2'] as const).map(half => <button key={half} type="button" disabled={!filters.month && half !== 'all'} aria-pressed={filters.half === half} onClick={() => setFilter({ half, date: '' })}>{half === 'all' ? 'Full month' : half === 'H1' ? '1st half' : '2nd half'}</button>)}</div>
        <input type="date" aria-label="Attendance date" value={filters.date} onChange={event => setFilter({ date: event.target.value, ...(event.target.value ? { month: event.target.value.slice(0, 7), half: 'all' as const } : {}) })} />
        <button type="button" onClick={() => setFilter({ month: '', date: '', half: 'all' })} className={styles.textButton}>All dates</button>
        <button type="button" onClick={() => { const today = manilaAttendanceDate(); setFilter({ employeeId: '', month: today.slice(0, 7), date: today, half: 'all', status: 'all', search: '' }); }} className={styles.textButton}>Reset</button>
        <button type="button" className={styles.refresh} onClick={props.onRefresh} disabled={props.refreshing} aria-label="Refresh attendance records"><RefreshCw size={14} className={props.refreshing ? 'animate-spin' : ''} /><span>Refresh</span></button>
      </div>

      <div className={styles.desktopTable} role="region" aria-label="Employee attendance records" tabIndex={0}><table><thead><tr><th>Employee</th><th>Date</th><th>Time In → Time Out</th><th>Total Hours</th><th>Status</th><th>Remarks</th><th>Action</th></tr></thead><tbody>
        {pageRecords.map(record => { const item = hrAttendancePresentation(record, props.timeOutHour); return <tr key={record.id} onClick={() => setSelectedId(record.id)} className={styles.tableRow}><td><span className={styles.employeeName}><i data-tone={item.category} /><span><b>{record.profiles?.full_name || 'Unknown employee'}</b><small>{record.profiles?.employee_id || 'No employee ID'}</small></span></span></td><td><b>{displayDate(record.log_date)}</b><small>{record.log_date}</small></td><td className={styles.times}>{formatHRAttendanceTime(record.time_in)} <span>→</span> {formatHRAttendanceTime(record.time_out)}</td><td className={styles.hours}>{formatHRAttendanceHours(record)}</td><td><span className={`${item.display.className} ${styles.badge}`}>{item.display.label}</span></td><td className={styles.remarks}>{item.remarks}</td><td><button type="button" className={styles.detailsButton} onClick={event => { event.stopPropagation(); setSelectedId(record.id); }} aria-label={`View attendance details for ${record.profiles?.full_name || 'employee'} on ${record.log_date}`}>View details</button></td></tr>; })}
        {props.loading && pageRecords.length === 0 && <tr><td colSpan={7} className={styles.empty}>Loading attendance records…</td></tr>}
        {!props.loading && pageRecords.length === 0 && <tr><td colSpan={7} className={styles.empty}>No attendance records match your filters.</td></tr>}
      </tbody></table></div>

      <div className={styles.mobileList}>{pageRecords.map(record => { const item = hrAttendancePresentation(record, props.timeOutHour); return <button type="button" key={record.id} className={styles.mobileRecord} data-tone={item.category} onClick={() => setSelectedId(record.id)} aria-label={`View attendance details for ${record.profiles?.full_name || 'employee'} on ${record.log_date}`}><span className={styles.mobileTop}><span><b>{record.profiles?.full_name || 'Unknown employee'}</b><small>{displayDate(record.log_date)} · {record.log_date}</small></span><span className={`${item.display.className} ${styles.badge}`}>{item.display.label}</span></span><span className={styles.mobileTime}><Clock3 size={13} />{formatHRAttendanceTime(record.time_in)} → {formatHRAttendanceTime(record.time_out)}<ChevronRight size={15} /></span><span className={styles.mobileBottom}><b>{formatHRAttendanceHours(record)}</b><span>{item.remarks}</span><strong>View details</strong></span></button>; })}{pageRecords.length === 0 && <p className={styles.empty}>{props.loading ? 'Loading attendance records…' : 'No attendance records match your filters.'}</p>}</div>

      <footer className={styles.pagination}><span>Showing {visibleRecords.length ? start + 1 : 0}–{Math.min(start + HR_ATTENDANCE_PAGE_SIZE, visibleRecords.length)} of {visibleRecords.length}</span><div><button type="button" aria-label="Previous attendance page" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={16} /></button><span>Page {currentPage} of {pages}</span><button type="button" aria-label="Next attendance page" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}><ChevronRight size={16} /></button></div></footer>
    </section>
    <p className={styles.updated}>{props.updatedAt ? `Updated ${props.updatedAt.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' })} · Philippine Time` : 'Loading attendance data…'} · Original attendance issues remain visible after Offset approval.</p>

    {mounted && createPortal(<div className={props.darkMode ? 'dark' : ''}><ModalShell open={Boolean(selected)} onClose={() => setSelectedId(null)} title="Attendance Details" description="Employee attendance record · Read-only HR view" placement="right" size="md" footer={<button type="button" onClick={() => setSelectedId(null)} className={styles.closeDetails}>Close details</button>}>
      {selected && selectedPresentation && <div className={styles.detailBody}>
        <div className={styles.detailEmployee}><UserRound size={22} /><div><h3>{selected.profiles?.full_name || 'Unknown employee'}</h3><p>{selected.profiles?.employee_id || 'No employee ID'} · {displayDate(selected.log_date)} · {selected.log_date}</p></div></div>
        <div className={styles.detailFacts}><span>Status<strong className={`${selectedPresentation.display.className} ${styles.badge}`}>{selectedPresentation.display.label}</strong></span><span>Time In<b>{formatHRAttendanceTime(selected.time_in)}</b></span><span>Time Out<b>{formatHRAttendanceTime(selected.time_out)}</b></span><span>Total Hours<b>{formatHRAttendanceHours(selected)}</b></span>{selectedPresentation.late && <span>Late minutes<b>{lateMinutes(selected, props.lateCutoffHour, props.lateCutoffMinute)}m</b></span>}{selectedPresentation.earlyOut && selected.time_out && <span>Early Out<b>{Math.max(0, Math.ceil((Date.parse(`${selected.log_date}T${String(props.timeOutHour).padStart(2, '0')}:00:00+08:00`) - Date.parse(selected.time_out)) / 60_000))}m</b></span>}<span>Remarks<b>{selectedPresentation.remarks}</b></span></div>
        {selectedPresentation.offset && <section className={styles.resolution}><h3>Resolved with Offset</h3><p>The original attendance issue is retained in history and filters.</p>{[['Late', selected.late_offset_minutes], ['Early Out', selected.early_out_offset_minutes], ['Absent', selected.absent_offset_minutes]].map(([label, minutes]) => Number(minutes) > 0 ? <p key={String(label)}><b>{label}:</b> {Number(minutes)} minutes applied</p> : null)}</section>}
        {selected.early_out_offset_requests?.map((request, index) => <section key={index} className={styles.resolution}><h3>Early-out Offset request</h3><p>{request.status} · {request.required_minutes} minutes</p></section>)}
        {selectedDisputes.length > 0 && <section className={styles.reviewHistory}><h3>HR Review History</h3>{selectedDisputes.map(dispute => <article key={dispute.id}><b>{dispute.dispute_type === 'TimeOut' ? 'Time Out' : 'Time In'} dispute · {dispute.status}</b>{dispute.original_time_in && <p>Original Time In: {formatHRAttendanceTime(dispute.original_time_in)}</p>}{dispute.original_time_out && <p>Original Time Out: {formatHRAttendanceTime(dispute.original_time_out)}</p>}{dispute.reviewed_at && <p>Reviewed: {new Date(dispute.reviewed_at).toLocaleString('en-US', { timeZone: 'Asia/Manila' })}</p>}{dispute.reviewer?.full_name && <p>Reviewed by: {dispute.reviewer.full_name}</p>}{dispute.hr_notes && <p>HR notes: {dispute.hr_notes}</p>}</article>)}</section>}
      </div>}
    </ModalShell></div>, document.body)}
  </div>;
}
