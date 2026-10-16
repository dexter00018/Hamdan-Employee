import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { manilaAttendanceDate } from '../lib/hr-attendance-history';

const source = readFileSync(new URL('../components/hr/HRAttendanceHistory.tsx', import.meta.url), 'utf8');

afterEach(() => vi.useRealTimers());

describe('HR attendance initial filters', () => {
  it.each([
    ['2026-10-15T15:59:00Z', '2026-10-15'],
    ['2026-10-15T16:01:00Z', '2026-10-16'],
    ['2026-12-31T16:01:00Z', '2027-01-01'],
  ])('uses the Manila date when opened at %s', (now, expected) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    expect(manilaAttendanceDate()).toBe(expected);
  });

  it('defaults to today unless opening a specific employee history and never restores stale browser filters', () => {
    expect(source).toContain("date: props.initialEmployeeId ? '' : today");
    expect(source).toContain("half: 'all', status: 'all', search: ''");
    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('sessionStorage');
  });
});
