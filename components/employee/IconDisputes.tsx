// Disputes icon: custom inline SVG of a rejected-request clipboard
// (orange clipboard, X-marked rows, parcel box, red X badge).
export default function IconDisputes({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={`cc-art pointer-events-none ${className}`}
      fill="none"
      aria-hidden="true"
    >
      {/* clipboard */}
      <rect x="88" y="30" width="328" height="440" rx="44" fill="#f5a34a" />
      <rect x="122" y="84" width="260" height="332" rx="18" fill="#eaedf4" />
      <rect x="186" y="4" width="140" height="62" rx="22" fill="#4a70dc" />

      {/* X rows */}
      <g stroke="#5b5b5b" strokeWidth="15" strokeLinecap="round">
        <path d="M170 116l34 34M204 116l-34 34" />
        <path d="M170 192l34 34M204 192l-34 34" />
        <path d="M170 268l34 34M204 268l-34 34" />
      </g>
      <g fill="#5b5b5b">
        <rect x="226" y="124" width="132" height="17" rx="8.5" />
        <rect x="226" y="194" width="150" height="17" rx="8.5" />
        <rect x="226" y="270" width="118" height="17" rx="8.5" />
      </g>

      {/* parcel box */}
      <rect x="38" y="332" width="152" height="140" rx="12" fill="#f5c76f" />
      <rect x="38" y="332" width="152" height="34" rx="10" fill="#f9d98f" />
      <rect x="92" y="332" width="44" height="34" rx="6" fill="#fce9ae" />
      <rect x="72" y="396" width="92" height="12" rx="6" fill="#a97c4c" />
      <rect x="72" y="422" width="92" height="12" rx="6" fill="#a97c4c" />

      {/* red badge */}
      <circle cx="404" cy="402" r="72" fill="#f0503a" />
      <path d="M376 374l56 56M432 374l-56 56" stroke="#fff" strokeWidth="17" strokeLinecap="round" />
    </svg>
  );
}
