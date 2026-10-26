// My Leave icon: custom inline SVG of a wall-planner calendar with
// used/available day blocks and a briefcase badge.
export default function IconLeavePlanner({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={`cc-art pointer-events-none ${className}`}
      fill="none"
      aria-hidden="true"
    >
      {/* planner pad + hangers */}
      <rect x="36" y="64" width="334" height="380" rx="36" fill="#e6e9ee" />
      <rect x="62" y="16" width="34" height="66" rx="17" fill="#6d6f7c" />
      <rect x="136" y="16" width="34" height="66" rx="17" fill="#6d6f7c" />
      <rect x="210" y="16" width="34" height="66" rx="17" fill="#6d6f7c" />
      <rect x="284" y="16" width="34" height="66" rx="17" fill="#6d6f7c" />

      {/* day grid: red = used, blue = available */}
      <g>
        <rect x="64" y="112" width="46" height="46" rx="10" fill="#f4514e" />
        <path d="M75 123l24 24M99 123l-24 24" stroke="#fff" strokeWidth="10" strokeLinecap="round" />
        <rect x="124" y="112" width="46" height="46" rx="10" fill="#f4514e" />
        <path d="M135 123l24 24M159 123l-24 24" stroke="#fff" strokeWidth="10" strokeLinecap="round" />
        <rect x="184" y="112" width="46" height="46" rx="10" fill="#6ba4f7" />
        <rect x="244" y="112" width="46" height="46" rx="10" fill="#6ba4f7" />
        <rect x="304" y="112" width="46" height="46" rx="10" fill="#6ba4f7" />

        <rect x="64" y="176" width="46" height="46" rx="10" fill="#f4514e" />
        <rect x="124" y="176" width="46" height="46" rx="10" fill="#f4514e" />
        <rect x="184" y="176" width="46" height="46" rx="10" fill="#6ba4f7" />
        <rect x="244" y="176" width="46" height="46" rx="10" fill="#6ba4f7" />
        <rect x="304" y="176" width="46" height="46" rx="10" fill="#6ba4f7" />

        <rect x="64" y="240" width="46" height="46" rx="10" fill="#f4514e" />
        <rect x="124" y="240" width="46" height="46" rx="10" fill="#f4514e" />
        <rect x="184" y="240" width="46" height="46" rx="10" fill="#6ba4f7" />
        <rect x="244" y="240" width="46" height="46" rx="10" fill="#6ba4f7" />
      </g>

      {/* emerald briefcase badge */}
      <circle cx="366" cy="360" r="102" fill="#3fdf8f" />
      <rect x="342" y="302" width="48" height="44" rx="10" stroke="#6d6f7c" strokeWidth="14" />
      <rect x="298" y="330" width="136" height="102" rx="16" fill="#d5a25e" />
      <rect x="298" y="330" width="136" height="36" rx="12" fill="#c98f45" />
      <circle cx="366" cy="384" r="12" fill="#5f6672" />
    </svg>
  );
}
