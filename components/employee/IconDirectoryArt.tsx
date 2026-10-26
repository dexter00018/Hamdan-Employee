// Employee Directory icon: custom inline SVG of a flat three-person team
// (left blue-shirt man, right yellow-top woman, front suit-and-tie man).
export default function IconDirectoryArt({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={`cc-art pointer-events-none ${className}`}
      fill="none"
      aria-hidden="true"
    >
      {/* left man — cyan shirt */}
      <rect x="88" y="190" width="64" height="54" fill="#dfa87e" />
      <path d="M28 372v-46c0-48 40-84 92-84h8c52 0 92 36 92 84v46z" fill="#47c0e2" />
      <path d="M128 240l-30 34 30 98 30-98z" fill="#eef4f6" />
      <circle cx="120" cy="134" r="62" fill="#e8b58c" />
      <path d="M120 72a62 62 0 0 0-62 62c0 7 0 13 2 20 6-27 32-42 60-42s54 15 60 42c2-7 2-13 2-20a62 62 0 0 0-62-62z" fill="#35475a" />

      {/* right woman — long dark hair, yellow top */}
      <path d="M400 88c-58 0-96 44-96 102v182h192V190c0-58-38-102-96-102z" fill="#35475a" />
      <path d="M338 372v-76c0-36 28-62 62-62s62 26 62 62v76z" fill="#f7c331" />
      <circle cx="400" cy="160" r="44" fill="#d8a075" />
      <path d="M358 152c2-24 20-42 42-42s40 18 42 42c-8-16-24-26-42-26s-34 10-42 26z" fill="#35475a" />

      {/* front man — dark suit, red tie */}
      <rect x="218" y="248" width="76" height="56" fill="#e7b78e" />
      <path d="M148 468v-84c0-56 48-100 108-100s108 44 108 100v84z" fill="#2f3d4c" />
      <path d="M256 288l-38 42v138h76V330z" fill="#f2f3f5" />
      <path d="M256 290l-20 16 20 22 20-22z" fill="#dfe3e8" />
      <path d="M256 306l-13 20 9 96 4 26 4-26 9-96z" fill="#e4573d" />
      <circle cx="256" cy="182" r="68" fill="#e7b78e" />
      <path d="M256 114a68 68 0 0 0-68 68c0 8 0 15 2 22 8-30 34-44 66-44s58 14 66 44c2-7 2-14 2-22a68 68 0 0 0-68-68z" fill="#2f3d4c" />
    </svg>
  );
}
