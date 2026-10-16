import { AlertTriangle, CalendarClock, Clock3, UsersRound } from 'lucide-react';
import styles from './hr-dashboard.module.css';

export type DailyOverviewKey = 'present' | 'late' | 'leave' | 'notTimedIn';
type Props = { present: number; late: number; leave: number; notTimedIn: number; loading: boolean; onSelect: (key: DailyOverviewKey) => void };

export default function HRDashboardStats(props: Props) {
  return <section className={styles.stats} aria-label="Daily attendance overview" aria-busy={props.loading}>
    {[
      { key: 'present' as const, label: 'Present', value: props.present, icon: UsersRound, tone: 'green' },
      { key: 'late' as const, label: 'Late', value: props.late, icon: Clock3, tone: 'orange' },
      { key: 'leave' as const, label: 'On Leave', value: props.leave, icon: CalendarClock, tone: 'blue' },
      { key: 'notTimedIn' as const, label: 'Not Timed In', value: props.notTimedIn, icon: AlertTriangle, tone: 'red' },
    ].map(({ key, label, value, icon: Icon, tone }) => <button key={key} type="button" className={styles.stat} data-tone={tone} onClick={() => props.onSelect(key)} aria-label={`View ${label} records`}>
      <span className={styles.statIcon}><Icon size={27} strokeWidth={2} /></span><span className={styles.statCopy}><span>{label}</span><strong>{props.loading ? '—' : value}</strong></span>
    </button>)}
  </section>;
}
