import { APP_SETTING_DEFINITIONS, normalizeAppSettings, type AppSettingsValues } from '@/lib/app-settings';

export const EMPLOYEE_APPEARANCE_KEYS = APP_SETTING_DEFINITIONS
  .filter((setting) => setting.category === 'seasonal' || setting.key === 'time_out_reminder_hour')
  .map((setting) => setting.key);

// Only public appearance preferences are cached; routes refresh on entry.
export function readEmployeeAppearance(): AppSettingsValues | null {
  try {
    const value = sessionStorage.getItem('employee-portal-appearance-v1');
    if (!value) return null;
    const rows: unknown = JSON.parse(value);
    if (!Array.isArray(rows)) return null;
    const normalized = normalizeAppSettings(rows.filter((row) => row && typeof row.key === 'string' && EMPLOYEE_APPEARANCE_KEYS.includes(row.key)));
    return Object.fromEntries(EMPLOYEE_APPEARANCE_KEYS.map((key) => [key, normalized[key]]));
  } catch {
    return null;
  }
}

export function saveEmployeeAppearance(settings: AppSettingsValues) {
  try {
    sessionStorage.setItem('employee-portal-appearance-v1', JSON.stringify(
      EMPLOYEE_APPEARANCE_KEYS.map((key) => ({ key, value: settings[key] })),
    ));
  } catch { /* Appearance caching is optional. */ }
}
