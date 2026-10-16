'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import ModalShell from '@/components/shared/ModalShell';
import styles from './hr-dashboard.module.css';

const query = '(min-width: 1024px)';
function subscribe(onChange: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}
const getSnapshot = () => window.matchMedia(query).matches;
const getServerSnapshot = () => false;

type Props = { open: boolean; onClose: () => void; children: ReactNode };

export default function HRDashboardAnalytics({ open, onClose, children }: Props) {
  const desktop = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // Do not mount a second, zero-width copy of Recharts on mobile.
  if (desktop && !open) return <div className={styles.analyticsDesktop}>{children}</div>;
  return <ModalShell open={open} onClose={onClose} title="Attendance Analytics" description="Explore attendance trends and the current-month overview." size="xl">{open ? children : null}</ModalShell>;
}
