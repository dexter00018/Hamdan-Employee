'use client';

import { useEffect, useEffectEvent } from 'react';
import { useSearchParams } from 'next/navigation';

export default function EmployeeNavigationIntent({ ready, onOpen }: { ready: boolean; onOpen: (tool: string) => void }) {
  const searchParams = useSearchParams();
  const tool = searchParams.get('tool');
  const openTool = useEffectEvent(onOpen);

  useEffect(() => {
    if (!ready || !tool) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('tool') !== tool) return;
    openTool(tool);
    url.searchParams.delete('tool');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, [ready, tool]);

  return null;
}
