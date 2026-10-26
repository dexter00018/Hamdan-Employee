'use client';

import { useEffect, useState } from 'react';

// Company Calendar icon: flip-calendar with red header. The big number
// is the live current day-of-month in Philippine time (Asia/Manila),
// set after mount to avoid server/client hydration mismatch.
function currentPhilippineDay() {
  return Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', day: '2-digit' }).format(new Date()));
}

export default function IconCalendarLive({ size = 24, className = '' }: { size?: number; className?: string }) {
  const [day, setDay] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setDay(currentPhilippineDay());
    update();
    // Refresh right after the PH day rolls over; minute ticks are enough.
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={`cc-art pointer-events-none ${className}`}
      fill="none"
      aria-hidden="true"
    >
      <rect x="10" y="34" width="492" height="462" rx="80" fill="#e7e7e7" />
      <rect x="26" y="50" width="460" height="430" rx="66" fill="#fbfbfb" />
      <path d="M26 118C26 72 57 50 94 50h324c37 0 68 22 68 68v92H26z" fill="#ef5350" />

      {/* hangers */}
      <circle cx="126" cy="92" r="30" fill="#964042" />
      <rect x="115" y="6" width="22" height="102" rx="11" fill="#f4f2ec" />
      <circle cx="388" cy="92" r="30" fill="#964042" />
      <rect x="377" y="6" width="22" height="102" rx="11" fill="#f4f2ec" />

      {/* live date */}
      <text x="256" y="372" textAnchor="middle" fontSize="218" fontWeight="600" fill="#4c4c4c" fontFamily="Arial, sans-serif">
        {day ?? ''}
      </text>
    </svg>
  );
}
