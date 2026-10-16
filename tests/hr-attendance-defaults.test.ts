import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';

const source = readFileSync(new URL('../app/hr/page.tsx', import.meta.url), 'utf8');

afterEach(() => vi.useRealTimers());

describe('HR raw attendance initial filters', () => {
  it.each([
    ['2026-10-15T15:59:00Z', '2026-10-15'],
    ['2026-10-15T16:01:00Z', '2026-10-16'],
    ['2026-12-31T16:01:00Z', '2027-01-01'],
  ])('uses the Manila date when opened at %s', (now, expected) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    // Exercise the actual lazy initializer without mounting the dashboard
    // or making any authenticated attendance/database requests.
    const initializer = source.match(/const \[selectedDate, setSelectedDate\] = useState\(\(\) =>\s*([\s\S]*?)\n  \);/)?.[1];
    expect(initializer).toBeDefined();
    expect(runInNewContext(initializer!, { Date, Intl })).toBe(expected);
  });

  it('starts without a name or cutoff and does not restore saved filters', () => {
    expect(source).toContain("const [searchTerm, setSearchTerm] = useState('');");
    expect(source).toContain("const [cutoffFilter, setCutoffFilter] = useState('');");
    expect(source).not.toContain('hamdan-hr-attendance-filters');
    expect(source).not.toContain('filtersHydrated');
  });
});
