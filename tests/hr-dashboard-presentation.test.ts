import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(new URL('../components/hr/HRPortal.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

describe('HR dashboard analytics navigation', () => {
  it('closes mobile analytics before opening the current-month summary and clears the prior selected range', () => {
    const body = source.match(/const openAttendanceSummary = [^\n]+=> \{\n([\s\S]*?)\n  \};/)?.[1];
    expect(body).toBeDefined();
    const setAnalyticsOpen = vi.fn();
    const setAttendanceInsightRange = vi.fn();
    const setAttendanceInsightModal = vi.fn();
    runInNewContext(body!, { kind: 'late', setAnalyticsOpen, setAttendanceInsightRange, setAttendanceInsightModal });
    expect(setAnalyticsOpen).toHaveBeenCalledWith(false);
    expect(setAttendanceInsightRange).toHaveBeenCalledWith(null);
    expect(setAttendanceInsightModal).toHaveBeenCalledWith('late');
  });

  it('retains the exact chart-selected range while closing the analytics dialog', () => {
    const body = source.match(/const openAttendanceChartDetail = [^\n]+=> \{\n([\s\S]*?)\n  \};/)?.[1];
    expect(body).toBeDefined();
    const setAnalyticsOpen = vi.fn();
    const setAttendanceInsightRange = vi.fn();
    const setAttendanceInsightModal = vi.fn();
    runInNewContext(`(function() { ${body} })()`, {
      row: { start: '2026-09-07', end: '2026-09-13', label: 'Week 2' }, kind: 'leave',
      setAnalyticsOpen, setAttendanceInsightRange, setAttendanceInsightModal,
    });
    expect(setAnalyticsOpen).toHaveBeenCalledWith(false);
    expect(setAttendanceInsightRange).toHaveBeenCalledWith({ start: '2026-09-07', end: '2026-09-13', label: 'Week 2' });
    expect(setAttendanceInsightModal).toHaveBeenCalledWith('leave');
  });

  it('keeps original HR daily-count semantics and the explicit announcement email action', () => {
    expect(source).toContain('leave={onLeaveTodayCount} notTimedIn={notYetTimedInToday.length}');
    expect(source).toContain('publishAnnouncement={() => saveAnnouncement(true)} saveAnnouncement={() => saveAnnouncement(false)}');
    expect(source).toContain('<HRDashboardQuickActions');
    expect(source).not.toContain('<section hidden aria-labelledby="hr-quick-actions-title"');
  });
});
