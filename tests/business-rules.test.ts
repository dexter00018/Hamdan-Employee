import { describe, expect, it } from 'vitest';
import { canChangeAccountActivation } from '@/lib/account-rules';
import { computeAttendanceStatus } from '@/lib/attendance-rules';
import { countChargeableLeaveDays } from '@/lib/leave-rules';
import { isMaintenanceMode } from '@/lib/server/app-settings';
import { resolveSeasonalTheme } from '@/lib/seasonal-theme';
import { DEFAULT_APP_SETTINGS } from '@/lib/app-settings';

describe('attendance rules', () => {
  it('marks the exact cutoff as present and the next minute as late', () => {
    expect(computeAttendanceStatus(9, 15, 9, 15)).toBe('Present');
    expect(computeAttendanceStatus(9, 16, 9, 15)).toBe('Late');
  });

  it('blocks attendance when maintenance mode is strictly enabled', () => {
    expect(isMaintenanceMode({ maintenance_mode: true })).toBe(true);
    expect(isMaintenanceMode({ maintenance_mode: false })).toBe(false);
    expect(isMaintenanceMode({ maintenance_mode: 'true' })).toBe(false);
  });
});

describe('leave rules', () => {
  it('excludes weekends and configured holidays', () => {
    expect(countChargeableLeaveDays('2026-09-04', '2026-09-08', ['2026-09-07'])).toBe(2);
  });

  it('counts an ordinary single workday', () => {
    expect(countChargeableLeaveDays('2026-09-02', '2026-09-02')).toBe(1);
  });
});

describe('account activation permissions', () => {
  it('allows only super admins to change non-super-admin accounts', () => {
    expect(canChangeAccountActivation('super_admin', 'employee')).toBe(true);
    expect(canChangeAccountActivation('super_admin', 'admin')).toBe(true);
    expect(canChangeAccountActivation('admin', 'employee')).toBe(false);
    expect(canChangeAccountActivation('super_admin', 'super_admin')).toBe(false);
  });
});

describe('seasonal portal scope', () => {
  it('enables HR only when Employee and HR scope is selected', () => {
    const settings = { ...DEFAULT_APP_SETTINGS, seasonal_theme_enabled: true, seasonal_theme_scope: 'employee_and_hr' };
    expect(resolveSeasonalTheme(settings, 'hr', new Date('2026-12-15T00:00:00+08:00')).active).toBe(true);
    expect(resolveSeasonalTheme({ ...settings, seasonal_theme_scope: 'employee_only' }, 'hr', new Date('2026-12-15T00:00:00+08:00')).active).toBe(false);
  });
});
