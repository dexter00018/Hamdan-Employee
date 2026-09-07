import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyPortalTheme } from '@/lib/portal-theme';
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('portal theme switch', () => {
  it('switches the root class and native controls together, then restores transitions', () => {
    vi.useFakeTimers();
    const classes = new Set<string>();
    const root = { classList: { add: (value: string) => classes.add(value), remove: (value: string) => classes.delete(value), toggle: (value: string, on: boolean) => on ? classes.add(value) : classes.delete(value) }, style: { colorScheme: 'light' } };
    vi.stubGlobal('document', { documentElement: root });
    applyPortalTheme(true);
    expect(classes.has('dark')).toBe(true);
    expect(root.style.colorScheme).toBe('dark');
    expect(classes.has('theme-switching')).toBe(true);
    vi.advanceTimersByTime(50);
    applyPortalTheme(false);
    expect(classes.has('dark')).toBe(false);
    expect(root.style.colorScheme).toBe('light');
    vi.advanceTimersByTime(50);
    expect(classes.has('theme-switching')).toBe(true);
    vi.advanceTimersByTime(50);
    expect(classes.has('theme-switching')).toBe(false);
  });
});
