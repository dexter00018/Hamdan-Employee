// Payslips icon: custom inline SVG illustration of a salary slip on a
// monitor with a coin and envelope, matching the reference mock.
// Inline keeps it crisp at any size and adds nothing to the bundle.
export default function IconPayslip({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={`pointer-events-none ${className}`}
      fill="none"
      aria-hidden="true"
    >
      {/* monitor */}
      <rect x="36" y="76" width="396" height="288" rx="24" fill="#3d4145" />
      <rect x="62" y="102" width="344" height="236" rx="12" fill="#878c92" />
      <path d="M218 364h72l28 74H190z" fill="#3d4145" />
      <ellipse cx="256" cy="442" rx="118" ry="14" fill="#3d4145" />

      {/* salary paper */}
      <rect x="120" y="14" width="256" height="310" rx="30" fill="#ccd8f3" />
      <text x="248" y="72" textAnchor="middle" fontSize="50" fontWeight="700" fill="#2757ba" fontFamily="Arial, sans-serif">Salary</text>

      {/* check rows */}
      <g>
        <rect x="140" y="106" width="36" height="36" rx="9" fill="#2e64d2" />
        <path d="M148 124l8 8 14-15" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="140" y="164" width="36" height="36" rx="9" fill="#2e64d2" />
        <path d="M148 182l8 8 14-15" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="140" y="222" width="36" height="36" rx="9" fill="#2e64d2" />
        <path d="M148 240l8 8 14-15" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g fill="#8ba5e2">
        <rect x="196" y="112" width="112" height="7" rx="3.5" />
        <rect x="224" y="128" width="128" height="7" rx="3.5" />
        <rect x="196" y="170" width="120" height="7" rx="3.5" />
        <rect x="216" y="186" width="136" height="7" rx="3.5" />
        <rect x="196" y="228" width="104" height="7" rx="3.5" />
        <rect x="224" y="244" width="132" height="7" rx="3.5" />
      </g>

      {/* coin */}
      <circle cx="86" cy="398" r="62" fill="#f7a41d" />
      <circle cx="86" cy="398" r="50" fill="#fcb23a" />
      <circle cx="58" cy="398" r="7" fill="#fff" opacity=".9" />
      <circle cx="114" cy="398" r="7" fill="#fff" opacity=".9" />
      <text x="86" y="418" textAnchor="middle" fontSize="62" fontWeight="700" fill="#fff" fontFamily="Arial, sans-serif">$</text>

      {/* envelope */}
      <rect x="338" y="320" width="142" height="118" rx="16" fill="#b6402e" />
      <path d="M338 320h142l-71 62z" fill="#9e3323" />

      {/* badge */}
      <circle cx="442" cy="112" r="50" fill="#2e64d2" />
      <path d="M418 112l17 17 30-33" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
