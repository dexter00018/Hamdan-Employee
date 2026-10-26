// Holidays icon: custom inline SVG of a hanging HOLIDAYS sign board.
export default function IconHolidays({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={`cc-art pointer-events-none ${className}`}
      fill="none"
      aria-hidden="true"
    >
      {/* hanger strings + pivot */}
      <path d="M256 92L88 246M256 92l168 154" stroke="#9e9e9e" strokeWidth="18" strokeLinecap="round" />
      <circle cx="256" cy="84" r="30" fill="#f2b34a" />
      <circle cx="256" cy="84" r="30" fill="#f89b30" opacity=".55" />

      {/* board with offset back panel */}
      <rect x="92" y="228" width="392" height="212" rx="30" fill="#f0a94e" />
      <rect x="58" y="212" width="392" height="212" rx="30" fill="#fbcf8f" />
      <circle cx="98" cy="250" r="13" fill="#a3a3a3" />
      <circle cx="408" cy="250" r="13" fill="#a3a3a3" />
      <text x="254" y="346" textAnchor="middle" fontSize="74" fontWeight="700" letterSpacing="4" fill="#f49b1f" fontFamily="Arial, sans-serif">HOLIDAYS</text>
      <rect x="58" y="398" width="46" height="26" rx="8" fill="#f0a84e" />
      <rect x="404" y="398" width="46" height="26" rx="8" fill="#f0a84e" />
    </svg>
  );
}
