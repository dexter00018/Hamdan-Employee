import { Moon, Sun } from 'lucide-react';
import styles from './employee-theme-toggle.module.css';

type Props = { darkMode: boolean; onToggle: () => void; compact?: boolean; className?: string };

export default function EmployeeThemeToggle({ darkMode, onToggle, compact = false, className = '' }: Props) {
  return <button type="button" role="switch" aria-checked={darkMode} aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'} title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'} onClick={onToggle} data-dark={darkMode} className={`${styles.toggle} ${compact ? styles.compact : ''} ${className}`}>
    <span className={styles.icon}>{darkMode ? <Moon size={compact ? 17 : 19} aria-hidden="true" /> : <Sun size={compact ? 17 : 19} aria-hidden="true" />}</span>
    {!compact && <><span className={styles.copy}><strong>Appearance</strong><small>{darkMode ? 'Dark mode' : 'Light mode'}</small></span><span className={styles.track} aria-hidden="true"><Sun size={13} /><Moon size={13} /><span className={styles.thumb} /></span></>}
  </button>;
}
