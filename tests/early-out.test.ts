import { expect, it } from 'vitest';
import { isEarlyOut } from '../lib/attendance-rules';

it('uses Manila official out, not the Jeddah cutoff', () => {
 expect(isEarlyOut('2026-09-15', '2026-09-15T10:59:59Z', 19)).toBe(true);
 expect(isEarlyOut('2026-09-15', '2026-09-15T11:00:00Z', 19)).toBe(false);
 expect(isEarlyOut('2026-09-15', '2026-09-15T11:01:00Z', 19)).toBe(false);
 expect(isEarlyOut('2026-09-15', '2026-09-16T01:00:00Z', 19)).toBe(false);
});
it('uses the existing configured hour and requires a valid recorded exit', () => {
 expect(isEarlyOut('2026-09-15', '2026-09-15T10:00:00Z', 17)).toBe(false);
 expect(isEarlyOut('2026-09-15', null, 19)).toBe(false);
 expect(isEarlyOut('2026-09-15', 'invalid', 19)).toBe(false);
 expect(isEarlyOut('2026-09-15', '2026-09-15T10:00:00Z', NaN)).toBe(false);
});
