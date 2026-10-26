import { ChevronLeft, ChevronRight } from 'lucide-react';
import Icon3D from './Icon3D';

type SummaryType = 'present' | 'late' | 'early-out' | 'absent';
type CalendarDay = { date: string; day: number; status: string; holiday: string | null } | null;
type Props = {
  summary: { present: number; late: number; earlyOut: number; absent: number };
  lateDuration: string;
  monthLabel: string;
  today: string;
  days: CalendarDay[];
  onSummary: (type: SummaryType) => void;
  onAttendance: () => void;
  onChangeMonth: (direction: number) => void;
  onOpenCalendar: () => void;
  onSelectDate: (date: string) => void;
};

export default function EmployeeDashboardInsights(props: Props) {
  const rows: { type: SummaryType; label: string; value: number; tone: string; detail: string }[] = [
    { type: 'present', label: 'Present', value: props.summary.present, tone: 'bg-emerald-500', detail: 'Working days' },
    { type: 'late', label: 'Late', value: props.summary.late, tone: 'bg-orange-500', detail: `${props.lateDuration} total` },
    { type: 'early-out', label: 'Early Out', value: props.summary.earlyOut, tone: 'bg-amber-400', detail: 'This cutoff' },
    { type: 'absent', label: 'Absent', value: props.summary.absent, tone: 'bg-rose-500', detail: 'This cutoff' },
  ];
  return <div className="dashboard-insight-panels">
    <section className="dashboard-today-status" aria-labelledby="today-status-title">
      <div className="dashboard-panel-heading">
        <div className="flex items-center gap-2"><Icon3D name="chart_increasing" size={52} className="h-7 w-7" /><div><h2 id="today-status-title">Cutoff Status</h2><p>Attendance overview</p></div></div>
        <button type="button" onClick={props.onAttendance}>View Details</button>
      </div>
      <div className="dashboard-status-list">{rows.map((row) => <button key={row.type} type="button" className="dashboard-status-row" onClick={() => props.onSummary(row.type)} aria-label={`View ${row.label}: ${row.value}`}>
        <span className={`h-3 w-3 rounded-full ${row.tone}`} aria-hidden="true" />
        <span className="dashboard-status-copy"><strong>{row.label}</strong><span><b>{row.value}</b><small>{row.detail}</small></span></span>
        <ChevronRight size={16} className="text-slate-500" aria-hidden="true" />
      </button>)}</div>
    </section>
    <section className="dashboard-schedule" aria-labelledby="dashboard-schedule-title">
      <div className="dashboard-panel-heading">
        <div className="flex items-center gap-2"><Icon3D name="calendar" size={52} className="h-7 w-7" /><div><h2 id="dashboard-schedule-title">My Schedule</h2><p>Your monthly attendance</p></div></div>
        <div className="dashboard-calendar-nav">
          <button type="button" onClick={() => props.onChangeMonth(-1)} aria-label="Previous month"><ChevronLeft size={16} /></button>
          <button type="button" onClick={props.onOpenCalendar} aria-label={`Open attendance calendar for ${props.monthLabel}`}>{props.monthLabel}</button>
          <button type="button" onClick={() => props.onChangeMonth(1)} aria-label="Next month"><ChevronRight size={16} /></button>
        </div>
      </div>
      <div className="dashboard-calendar-weekdays">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="dashboard-calendar-days">{props.days.map((day, index) => {
        if (!day) return <span key={`empty-${index}`} />;
        const dot = day.status.includes('LATE') ? 'bg-orange-500' : day.status.includes('EARLY OUT') ? 'bg-amber-400' : day.status === 'ABSENT' ? 'bg-rose-500' : day.status.includes('LEAVE') ? 'bg-violet-500' : day.status ? 'bg-emerald-500' : '';
        const today = day.date === props.today;
        return <button key={day.date} type="button" onClick={() => props.onSelectDate(day.date)} className={`dashboard-calendar-day relative grid place-items-center rounded-full transition hover:ring-1 hover:ring-green-400 ${today ? 'bg-green-600 text-white' : 'text-slate-700 dark:text-slate-200'}`} aria-label={`${day.date}: ${day.holiday || day.status || 'No record'}`} aria-current={today ? 'date' : undefined}>{day.day}{dot && <span className={`absolute bottom-0.5 h-1 w-1 rounded-full ${today ? 'bg-white' : dot}`} aria-hidden="true" />}</button>;
      })}</div>
      <div className="dashboard-calendar-legend">{[{ label: 'Present', tone: 'bg-emerald-500' }, { label: 'Late', tone: 'bg-orange-500' }, { label: 'Early Out', tone: 'bg-amber-400' }, { label: 'Absent', tone: 'bg-rose-500' }, { label: 'Leave', tone: 'bg-violet-500' }].map((item) => <span key={item.label} className="inline-flex items-center gap-1"><i className={`rounded-full ${item.tone}`} aria-hidden="true" />{item.label}</span>)}</div>
    </section>
  </div>;
}
