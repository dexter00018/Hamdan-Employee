import type { LucideIcon } from 'lucide-react';
import styles from './hr-dashboard.module.css';

export type HRQuickAction = { title: string; description: string; icon: LucideIcon; action: () => void; count?: number };
type Props = { actions: HRQuickAction[]; onAnalytics: () => void };

export default function HRDashboardQuickActions({ actions, onAnalytics }: Props) {
  return <section className={styles.quickActions} aria-labelledby="hr-quick-actions-title">
    <div className={styles.quickHeading}><h2 id="hr-quick-actions-title">HR Quick Actions</h2><button type="button" className={styles.analyticsButton} onClick={onAnalytics}>View analytics</button></div>
    <div className={styles.actionGrid}>{actions.map(({ title, description, icon: Icon, action, count }) => <button key={title} type="button" onClick={action} className={styles.action} title={description}>
      <span className={styles.actionIcon}><Icon size={20} />{typeof count === 'number' && count > 0 && <span className={styles.actionCount}>{count > 99 ? '99+' : count}</span>}</span>
      <span className={styles.actionTitle}>{title}</span><span className={styles.actionDescription}>{description}</span>
    </button>)}</div>
  </section>;
}
