// Leave Credits icon: custom inline SVG of a vacation calendar with
// palm tree, sea and sand under a sky-blue header.
export default function IconBeachCalendar({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={`cc-art pointer-events-none ${className}`}
      fill="none"
      aria-hidden="true"
    >
      {/* frame + body */}
      <rect x="12" y="12" width="488" height="488" rx="58" fill="#56452f" />
      <rect x="34" y="34" width="444" height="444" rx="40" fill="#f7f4ec" />

      {/* header band + rings */}
      <path d="M34 74C34 50 52 34 74 34h364c22 0 40 16 40 40v76H34z" fill="#54c2f0" />
      <rect x="66" y="8" width="32" height="66" rx="16" stroke="#56452f" strokeWidth="11" fill="#c1392b" />
      <rect x="186" y="8" width="32" height="66" rx="16" stroke="#56452f" strokeWidth="11" fill="#c1392b" />
      <rect x="306" y="8" width="32" height="66" rx="16" stroke="#56452f" strokeWidth="11" fill="#c1392b" />
      <rect x="426" y="8" width="32" height="66" rx="16" stroke="#56452f" strokeWidth="11" fill="#c1392b" />

      {/* sun */}
      <circle cx="398" cy="176" r="34" fill="#ff8a1b" />
      <circle cx="388" cy="166" r="12" fill="#ffb45c" />
      <g stroke="#56452f" strokeWidth="11" strokeLinecap="round">
        <path d="M398 118v16M398 218v16M350 176h16M430 176h16M360 138l12 12M424 202l12 12M362 214l12-12M426 138l-12 12" />
      </g>

      {/* sea + sand */}
      <path d="M34 300c120-24 220-10 444 4v174H34z" fill="#43c1e9" />
      <path d="M34 478c58-70 176-84 272-56 66 19 132 32 172 30v26z" fill="#eab04e" />
      <g stroke="#56452f" strokeWidth="12" strokeLinecap="round">
        <path d="M92 350c30 8 60 6 88-4" />
        <path d="M310 352c24-6 48-8 70-4" />
        <path d="M116 452c34 10 70 12 104 6" />
        <path d="M270 456c26-4 50-6 74-2" />
      </g>

      {/* palm tree */}
      <path d="M230 460c8-66 20-118 48-160" stroke="#7a4a24" strokeWidth="28" strokeLinecap="round" />
      <path d="M278 300c-76-40-124-38-170-4 64 14 116 12 170 4z" fill="#3f8031" />
      <path d="M278 300c76-40 124-38 170-4-64 14-116 12-170 4z" fill="#3f8031" />
      <path d="M278 300c-38-66-68-80-122-76 50 36 92 56 122 76z" fill="#76b23d" />
      <path d="M278 300c38-66 68-80 122-76-50 36-92 56-122 76z" fill="#76b23d" />
      <path d="M278 300c-8-56-4-84 16-110-4 40-10 68-16 110z" fill="#76b23d" />
    </svg>
  );
}
