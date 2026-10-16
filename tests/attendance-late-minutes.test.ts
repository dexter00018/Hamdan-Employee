import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { computeAttendanceStatus, computeLateMinutes } from '../lib/attendance-rules';

describe('Late grace period versus full Late duration', () => {
  it.each([
    ['08:59:59', 'Present', 0],
    ['09:00:00', 'Present', 0],
    ['09:14:59', 'Present', 0],
    ['09:15:00', 'Present', 0],
    ['09:15:59', 'Present', 0],
    ['09:16:00', 'Late', 16],
    ['09:16:59', 'Late', 16],
    ['09:30:00', 'Late', 30],
    ['10:05:00', 'Late', 65],
  ] as const)('%s is %s with %i Late minutes', (time, status, minutes) => {
    const [hour, minute] = time.split(':').map(Number);
    expect(computeAttendanceStatus(hour, minute, 9, 15)).toBe(status);
    expect(computeLateMinutes(`2026-10-16T${time}+08:00`, 9, 15)).toBe(minutes);
  });

  it('uses Manila time rather than the browser or UTC clock', () => {
    expect(computeLateMinutes('2026-10-16T01:16:00Z')).toBe(16);
    expect(computeLateMinutes('2026-10-16T09:16:00+08:00')).toBe(16);
    expect(computeLateMinutes('2026-10-15T16:00:00Z')).toBe(0);
  });

  it('uses a configured grace cutoff only to decide eligibility, not to subtract minutes', () => {
    expect(computeLateMinutes('2026-10-16T09:20:00+08:00', 9, 30)).toBe(0);
    expect(computeLateMinutes('2026-10-16T09:31:00+08:00', 9, 30)).toBe(31);
    expect(computeLateMinutes('2026-10-16T09:01:00+08:00', 9, 0)).toBe(1);
  });

  it('does not produce NaN for missing/invalid timestamps or invalid cutoffs', () => {
    for (const timestamp of [null, undefined, '', 'invalid']) {
      expect(computeLateMinutes(timestamp)).toBe(0);
    }
    expect(computeLateMinutes('2026-10-16T09:16:00+08:00', 24, 15)).toBe(0);
    expect(computeLateMinutes('2026-10-16T09:16:00+08:00', 9, 60)).toBe(0);
  });

  it('sums full Late durations, without subtracting the grace period from each record', () => {
    const times = ['09:16:00', '09:30:00', '10:05:00'];
    expect(times.reduce((sum, time) => sum + computeLateMinutes(`2026-10-16T${time}+08:00`), 0)).toBe(111);
  });
});

describe('Employee and HR Late calculation wiring', () => {
  it.each(['../app/employee/page.tsx', '../components/hr/HRPortal.tsx'])(
    '%s uses the shared full-duration calculation', path => {
      const source = readFileSync(new URL(path, import.meta.url), 'utf8');
      expect(source).toContain('computeLateMinutes(timeInIso, lateCutoffHour, lateCutoffMinute)');
      expect(source).not.toContain('minutesSinceMidnight - cutoffMinutes');
    },
  );
});
