// Attendance Streak icon: custom inline SVG of a glossy pink flame with a
// golden core, plus the loose spark droplet at the upper left.
'use client';

import { useId } from 'react';

export default function IconStreakArt({ size = 24, className = '' }: { size?: number; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const outerId = `flame-outer-${uid}`;
  const coreId = `flame-core-${uid}`;
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={`cc-art pointer-events-none ${className}`}
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={outerId} x1="0" y1="0" x2="1" y2="0.35">
          <stop offset="0" stopColor="#ff86a5" />
          <stop offset="0.55" stopColor="#f3437c" />
          <stop offset="1" stopColor="#e60c6e" />
        </linearGradient>
        <linearGradient id={coreId} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#ffe15c" />
          <stop offset="1" stopColor="#f6a72e" />
        </linearGradient>
      </defs>

      {/* outer flame */}
      <path
        d="M298 16c-4 26-2 48 8 74 12 34 44 60 74 102 30 44 36 110 10 164-30 66-96 104-164 94-66-10-120-64-128-134-6-64 22-112 64-146 44-36 92-58 114-106 8-16 12-32 12-48z"
        fill={`url(#${outerId})`}
      />
      {/* golden core */}
      <path
        d="M296 196c-14 34-40 50-58 78-20 30-22 70-6 100 22 42 68 60 106 44 42-18 62-64 52-108-8-36-36-58-52-90-8-16-10-28-8-40-14 4-26 10-34 16z"
        fill={`url(#${coreId})`}
      />
      {/* loose spark */}
      <path
        d="M96 92c-18 12-28 34-20 54 6 16 24 24 40 20-4-24-2-46 12-66-10-8-22-10-32-8z"
        fill="#f43f6b"
      />
    </svg>
  );
}
