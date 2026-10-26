// Work Clock globe: custom inline SVG of a flat earth globe — blue ocean,
// bright green continents with darker drop shadows, and dark teal islands
// along the right edge.
'use client';

import { useId } from 'react';

const LAND_MAIN = 'M244 8c-40 34-52 84-34 124 16 34 48 40 50 76 2 34-26 46-22 78 4 32 32 40 36 72 4 30-16 52-8 80 8 28 36 34 52 16 14-16 8-40-2-64-10-26 8-46 20-70 12-24 30-40 22-66-8-26-38-34-42-62-4-30 20-52 4-84C290 8 268-8 244 8Z';
const LAND_TOPLEFT = 'M26 148C60 92 132 62 196 62c30 0 44 20 26 40-22 24-62 18-82 42-16 20-8 44-32 56-24 12-56 4-78-16z';
const LAND_BOTTOMLEFT = 'M6 330c22-16 56-8 72 14 16 24 8 56-16 70-24 14-52 4-62-20-8-20-6-46 6-64z';

export default function IconGlobeArt({ size = 24, className = '' }: { size?: number; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const oceanId = `globe-ocean-${uid}`;
  const clipId = `globe-clip-${uid}`;
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
        <linearGradient id={oceanId} x1="0" y1="0" x2="1" y2="0.6">
          <stop offset="0" stopColor="#3aa6ec" />
          <stop offset="0.55" stopColor="#2589dc" />
          <stop offset="1" stopColor="#1269c4" />
        </linearGradient>
        <clipPath id={clipId}>
          <circle cx="256" cy="256" r="250" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        {/* ocean + deep edge shading */}
        <circle cx="256" cy="256" r="250" fill={`url(#${oceanId})`} />
        <circle cx="320" cy="266" r="250" fill="#0a55a6" />

        {/* continent shadows behind the main landmasses */}
        <path d={LAND_MAIN} transform="translate(20 12)" fill="#3f8f1b" />
        <path d={LAND_TOPLEFT} transform="translate(16 12)" fill="#3f8f1b" />

        {/* continents */}
        <path d={LAND_MAIN} fill="#6fb92e" />
        <path d={LAND_TOPLEFT} fill="#77c132" />
        <path d={LAND_BOTTOMLEFT} fill="#85c93b" />

        {/* dark teal islands along the right edge */}
        <circle cx="514" cy="276" r="64" fill="#16704c" />
        <circle cx="492" cy="446" r="58" fill="#16704c" />
      </g>
    </svg>
  );
}
