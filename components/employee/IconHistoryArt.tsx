// Attendance History icon: custom inline SVG of a flat attendance record —
// three check-circle rows, one tinted person avatar each, and gray text bars.
const ROWS = [
  { y: 88, color: '#f4695c' },
  { y: 256, color: '#52c4ad' },
  { y: 424, color: '#f5c242' },
];

export default function IconHistoryArt({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={`cc-art pointer-events-none ${className}`}
      fill="none"
      aria-hidden="true"
    >
      {ROWS.map(({ y, color }) => (
        <g key={y}>
          {/* check inside a broken circle */}
          <circle cx="104" cy={y} r="44" stroke="#cdd2d7" strokeWidth="20" />
          <path d={`M74 ${y - 4}l24 26 46-52`} stroke="#2e3f4f" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" />
          {/* tinted avatar */}
          <circle cx="216" cy={y - 56} r="30" fill={color} />
          <path d={`M160 ${y + 60}v-6c0-32 26-58 56-58s56 26 56 58v6z`} fill={color} />
          {/* text bars */}
          <rect x="326" y={y - 34} width="140" height="22" rx="11" fill="#d3d7db" />
          <rect x="326" y={y + 12} width="186" height="22" rx="11" fill="#d3d7db" />
        </g>
      ))}
    </svg>
  );
}
