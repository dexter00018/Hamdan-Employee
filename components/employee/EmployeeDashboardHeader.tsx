'use client';

import { memo, useEffect, useId, useState } from 'react';
import Image from 'next/image';
import { Bell, CalendarDays, UserRound } from 'lucide-react';
import EmployeeThemeToggle from './EmployeeThemeToggle';
import styles from './employee-dashboard.module.css';

type Props = {
  employeeName: string;
  designation: string;
  avatarUrl?: string | null;
  unreadCount: number;
  darkMode: boolean;
  onNotifications: () => void;
  onProfile: () => void;
  onMobileMenu: () => void;
  onToggleTheme: () => void;
};

export function HeaderClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);
  return <div className={styles.headerClock}>
    <span className={styles.headerCalendarIcon}><CalendarDays size={30} aria-hidden="true" /></span>
    <div><p>{now?.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) || 'Philippine Time'}</p>
      <time>{now?.toLocaleTimeString('en-GB', { timeZone: 'Asia/Manila', hour12: false }) || '--:--:--'}</time>
      <small>Philippine Time</small></div>
  </div>;
}

// A lightweight, decorative architectural illustration kept inside the hero.
// It represents the company brand, rather than a photograph of a real office.
export function OfficeIllustration() {
  const id = useId().replaceAll(':', '');
  return <svg className={styles.office} viewBox="0 0 620 220" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-glass`} x1="180" y1="0" x2="460" y2="220" gradientUnits="userSpaceOnUse"><stop stopColor="#d8f6ec" /><stop offset="1" stopColor="#4bb599" /></linearGradient>
      <linearGradient id={`${id}-side`} x1="300" y1="0" x2="520" y2="220" gradientUnits="userSpaceOnUse"><stop stopColor="#1c806e" /><stop offset="1" stopColor="#b8e8d9" /></linearGradient>
      <linearGradient id={`${id}-fade`}><stop stopColor="white" stopOpacity="0" /><stop offset=".3" stopColor="white" /><stop offset=".9" stopColor="white" /><stop offset="1" stopColor="white" stopOpacity="0" /></linearGradient>
      <mask id={`${id}-mask`}><rect width="620" height="220" fill={`url(#${id}-fade)`} /></mask>
    </defs>
    <g mask={`url(#${id}-mask)`}>
      <path d="M0 197 130 160 230 177 360 136 620 177V220H0Z" fill="#a9ddce" opacity=".32" />
      <path d="M383 89 467 34 514 64V220H383Z" fill="#bee5dd" stroke="#76bba9" />
      <path d="M399 98 467 55 499 76M399 126 467 85 499 105M399 155 467 114 499 136M399 184 467 144 499 166M425 79V220M447 65V220M467 34V220M489 48V220" stroke="#f2fffa" strokeWidth="2" opacity=".65" />
      <path d="M132 112 297 15 407 79V220H132Z" fill={`url(#${id}-glass)`} stroke="#338c79" strokeWidth="1.5" />
      <path d="M297 15 407 79V220H297Z" fill={`url(#${id}-side)`} />
      <path d="M132 112 297 15 407 79M132 141 297 53 407 110M132 171 297 92 407 142M132 199 297 131 407 174M183 82V220M218 61V220M256 39V220M297 15V220M335 37V220M371 58V220" stroke="#236c60" strokeWidth="1.4" opacity=".75" />
      <path d="M141 114 287 29M141 144 287 67M141 175 287 106M308 29 398 82M308 68 398 113" stroke="#f0fff9" strokeWidth="2" opacity=".55" />
      <text x="311" y="61" transform="rotate(29 311 61)" fill="#075d47" fontSize="17" fontFamily="Arial, sans-serif" fontWeight="700" letterSpacing="1">HAMDAN</text>
      <path d="M90 194V159M82 173 90 159 98 173M111 215V173M100 190 111 173 122 190M439 218V181M429 194 439 181 449 194M546 215V165M530 186 546 165 562 186" stroke="#247f62" strokeWidth="7" strokeLinecap="round" opacity=".5" />
      <path d="M81 217H564" stroke="#6bb89e" strokeWidth="3" />
    </g>
  </svg>;
}

function EmployeeDashboardHeader(props: Props) {
  return <header className={`dashboard-primary-content ${styles.hero}`}>
    <OfficeIllustration />
    <div className={styles.welcome}>
      <p className={styles.desktopGreeting}>Welcome back,</p>
      <p className={styles.mobileBrand}>Hamdan Engineering</p>
      <h1 title={props.employeeName}>{props.employeeName}</h1>
      <span>{props.designation}<span className={styles.desktopCompany}> <b aria-hidden="true">·</b> Hamdan Engineering</span></span>
    </div>
    <div className={styles.heroUtilities}>
      <div className={styles.heroTop}>
        <HeaderClock />
        <EmployeeThemeToggle darkMode={props.darkMode} onToggle={props.onToggleTheme} compact className={styles.mobileTheme} />
        <button type="button" onClick={props.onNotifications} className={styles.roundButton} aria-label={`Notifications${props.unreadCount ? `, ${props.unreadCount} unread` : ''}`}><Bell size={22} />{props.unreadCount > 0 && <span className={styles.notificationBadge}>{props.unreadCount > 9 ? '9+' : props.unreadCount}</span>}</button>
        <button type="button" onClick={props.onProfile} className={`${styles.roundButton} ${styles.desktopProfile}`} aria-label="Open employee profile">{props.avatarUrl ? <Image src={props.avatarUrl} alt="" width={48} height={48} /> : <UserRound size={22} />}</button>
        <button type="button" onClick={props.onMobileMenu} className={`${styles.roundButton} ${styles.mobileOnly}`} aria-label="Open employee menu">{props.avatarUrl ? <Image src={props.avatarUrl} alt="" width={36} height={36} /> : <UserRound size={20} />}</button>
      </div>
      <blockquote>“Discipline creates progress.”<cite>— Hamdan Engineering</cite></blockquote>
    </div>
  </header>;
}

export default memo(EmployeeDashboardHeader);
