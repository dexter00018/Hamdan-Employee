'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function ThemeRouteGuard() {
  const pathname = usePathname();

  useEffect(() => {
    const supportsPortalTheme = pathname === '/employee' || pathname.startsWith('/employee/') || pathname === '/hr' || pathname.startsWith('/hr/');
    if (!supportsPortalTheme) {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
      return;
    }

    let savedTheme: string | null = null;
    try { savedTheme = localStorage.getItem('theme'); } catch { /* use system preference below */ }
    const useDark = savedTheme === 'dark' || (savedTheme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', useDark);
    document.documentElement.style.colorScheme = useDark ? 'dark' : 'light';
  }, [pathname]);

  return null;
}
