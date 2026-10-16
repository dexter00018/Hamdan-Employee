import { BadgeAlert, CalendarCheck2, ChevronRight, ClipboardList, Headphones } from 'lucide-react';
import styles from './hr-dashboard.module.css';

type Props = { leaveCount: number; disputeCount: number; helpdeskCount: number; onLeave: () => void; onDisputes: () => void; onHelpdesk: () => void; onReview: () => void };

export default function HRDashboardPending(props: Props) {
  const total = props.leaveCount + props.disputeCount + props.helpdeskCount;
  return <section className={styles.pending} aria-label="Pending HR requests">
    <button type="button" onClick={props.onReview} className={styles.pendingMobile}><ClipboardList size={21} /><span><b>{total}</b> pending HR actions</span><strong>Review</strong><ChevronRight size={17} /></button>
    <div className={styles.pendingDesktop}><h2 id="hr-pending-title">Pending Requests</h2><p>Items that need your attention</p>
      {[
        { label: 'Leave Requests', count: props.leaveCount, icon: CalendarCheck2, action: props.onLeave, tone: 'green' },
        { label: 'Attendance Disputes', count: props.disputeCount, icon: BadgeAlert, action: props.onDisputes, tone: 'orange' },
        { label: 'Helpdesk Requests', count: props.helpdeskCount, icon: Headphones, action: props.onHelpdesk, tone: 'blue' },
      ].map(({ label, count, icon: Icon, action, tone }) => <button key={label} type="button" onClick={action} className={styles.pendingRow} data-tone={tone}><Icon size={19} /><span>{label}</span><b>{count}</b><small>Review</small><ChevronRight size={16} /></button>)}
    </div>
  </section>;
}
