import Image from 'next/image';

// 3D dashboard icons: bundled Microsoft Fluent Emoji 3D renders (MIT
// license) served from public/icons3d/<name>.png. Decorative by default
// (alt text empty, no dragging, no lazy-layout shift). `size` sets the
// intrinsic pixel size; pass a className with utility height/width
// classes to make it responsive.
export default function Icon3D({ name, size = 24, className = '' }: { name: string; size?: number; className?: string }) {
  return (
    <Image
      src={`/icons3d/${name}.png`}
      alt=""
      width={size}
      height={size}
      draggable={false}
      className={`pointer-events-none ${className}`}
    />
  );
}
