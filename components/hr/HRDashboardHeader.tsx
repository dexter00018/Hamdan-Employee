'use client';

import { Bell, UserRound } from 'lucide-react';
import { HeaderClock, OfficeIllustration } from '@/components/employee/EmployeeDashboardHeader';
import EmployeeThemeToggle from '@/components/employee/EmployeeThemeToggle';
import styles from './hr-dashboard.module.css';

type Props = { darkMode: boolean; pendingCount: number; onToggleTheme: () => void; onNotifications: () => void; onTools: () => void };

export default function HRDashboardHeader(props: Props) {
  return <header className={styles.hero}>
    <OfficeIllustration />
    <div className={styles.heading}><p>Hamdan Engineering</p><h1>HR Dashboard</h1><span>People, attendance, and employee operations.</span></div>
    <div className={styles.utilities}>
      <div className={styles.clock}><HeaderClock /></div>
      <EmployeeThemeToggle compact darkMode={props.darkMode} onToggle={props.onToggleTheme} className={styles.mobileTheme} />
      <button type="button" className={styles.roundButton} onClick={props.onNotifications} aria-label={`Open notifications, ${props.pendingCount} pending HR actions`}><Bell size={20} />{props.pendingCount > 0 && <b>{props.pendingCount > 9 ? '9+' : props.pendingCount}</b>}</button>
      <button type="button" className={`${styles.roundButton} ${styles.account}`} onClick={props.onTools} aria-label="Open HR tools"><UserRound size={20} /><span>HR</span></button>
    </div>
  </header>;
}
