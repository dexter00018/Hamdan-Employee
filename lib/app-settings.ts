export type AppSettingValue = number | boolean | string;
export type AppSettingsValues = Record<string, AppSettingValue>;
export type AppSettingCategory = 'attendance' | 'leave' | 'services' | 'notifications' | 'features' | 'seasonal' | 'system' | 'security';
export type AppSettingStatus = 'active' | 'future';
export type AppSettingType = 'number' | 'boolean' | 'string' | 'select' | 'time' | 'date';

export type AppSettingDefinition = {
  key: string;
  category: AppSettingCategory;
  label: string;
  description: string;
  type: AppSettingType;
  defaultValue: AppSettingValue;
  status: AppSettingStatus;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  dangerous?: boolean;
  options?: Array<{ value: string; label: string }>;
};

export const APP_SETTING_CATEGORIES: Record<AppSettingCategory, string> = {
  attendance: 'Attendance & Workday',
  leave: 'Leave Management',
  services: 'Employee Services',
  notifications: 'Notifications',
  features: 'Feature Controls',
  seasonal: 'Seasonal Theme',
  system: 'System & Performance',
  security: 'Security & Maintenance',
};

const numberSetting = (definition: Omit<AppSettingDefinition, 'type'>): AppSettingDefinition => ({ ...definition, type: 'number' });
const booleanSetting = (definition: Omit<AppSettingDefinition, 'type'>): AppSettingDefinition => ({ ...definition, type: 'boolean' });

const APP_SETTING_DEFINITIONS_SOURCE: AppSettingDefinition[] = [
  numberSetting({ key: 'late_cutoff_hour', category: 'attendance', label: 'Late Cutoff Hour', description: 'Time-ins after this Philippine hour are marked Late. Applies to new Time Ins immediately.', defaultValue: 9, min: 0, max: 23, unit: 'hour', status: 'active' }),
  numberSetting({ key: 'late_cutoff_minute', category: 'attendance', label: 'Late Cutoff Minute', description: 'Minute component of the active Late cutoff. Applies to new Time Ins immediately.', defaultValue: 15, min: 0, max: 59, unit: 'minute', status: 'active' }),
  numberSetting({ key: 'time_out_reminder_hour', category: 'attendance', label: 'Time-Out Reminder', description: 'Starts the Employee time-out reminder at this Philippine hour.', defaultValue: 19, min: 0, max: 23, unit: 'hour', status: 'active' }),
  booleanSetting({ key: 'attendance_recording_enabled', category: 'attendance', label: 'Attendance Recording', description: 'Allows new Time In and Time Out records. Disabling is enforced by the server immediately.', defaultValue: true, status: 'active', dangerous: true }),
  numberSetting({ key: 'work_start_hour', category: 'attendance', label: 'Work Start Hour', description: 'Reserved workday start hour for future scheduling rules.', defaultValue: 9, min: 0, max: 23, unit: 'hour', status: 'future' }),
  numberSetting({ key: 'work_start_minute', category: 'attendance', label: 'Work Start Minute', description: 'Reserved minute component for future scheduling rules.', defaultValue: 0, min: 0, max: 59, unit: 'minute', status: 'future' }),
  numberSetting({ key: 'work_end_hour', category: 'attendance', label: 'Work End Hour', description: 'Reserved workday end hour for future scheduling rules.', defaultValue: 18, min: 0, max: 23, unit: 'hour', status: 'future' }),
  numberSetting({ key: 'work_end_minute', category: 'attendance', label: 'Work End Minute', description: 'Reserved minute component for future scheduling rules.', defaultValue: 0, min: 0, max: 59, unit: 'minute', status: 'future' }),
  numberSetting({ key: 'attendance_dispute_window_days', category: 'attendance', label: 'Dispute Window', description: 'Reserved maximum age for future attendance-dispute validation.', defaultValue: 7, min: 1, max: 90, unit: 'days', status: 'future' }),
  numberSetting({ key: 'attendance_history_default_months', category: 'attendance', label: 'Default History Range', description: 'Reserved default attendance-history range.', defaultValue: 3, min: 1, max: 24, unit: 'months', status: 'future' }),
  numberSetting({ key: 'late_grace_minutes', category: 'attendance', label: 'Late Grace Period', description: 'Saved for a future cutoff rule; it does not alter the current Late calculation.', defaultValue: 0, min: 0, max: 60, unit: 'minutes', status: 'future' }),
  numberSetting({ key: 'default_leave_credits', category: 'leave', label: 'Default Leave Credits', description: 'Applied to new Regular employees; existing balances are unchanged.', defaultValue: 10, min: 0, max: 365, unit: 'days/year', status: 'active' }),
  numberSetting({ key: 'leave_request_min_notice_days', category: 'leave', label: 'Minimum Notice', description: 'Reserved minimum notice for future leave-request validation.', defaultValue: 0, min: 0, max: 90, unit: 'days', status: 'future' }),
  numberSetting({ key: 'max_consecutive_leave_days', category: 'leave', label: 'Maximum Consecutive Leave', description: 'Reserved maximum duration for future leave validation.', defaultValue: 30, min: 1, max: 365, unit: 'days', status: 'future' }),
  booleanSetting({ key: 'leave_cancellation_allowed', category: 'leave', label: 'Leave Cancellation', description: 'Reserved control for a future employee cancellation workflow.', defaultValue: true, status: 'future' }),
  numberSetting({ key: 'leave_cancel_before_start_hours', category: 'leave', label: 'Cancellation Lead Time', description: 'Reserved cutoff before an approved leave can be cancelled.', defaultValue: 24, min: 0, max: 720, unit: 'hours', status: 'future' }),
  numberSetting({ key: 'support_response_target_hours', category: 'services', label: 'Helpdesk Response Target', description: 'Saved target for a future enforced employee support response workflow.', defaultValue: 24, min: 1, max: 168, unit: 'hours', status: 'future' }),
  numberSetting({ key: 'payslip_ack_reminder_days', category: 'services', label: 'Payslip Reminder', description: 'Saved age threshold for a future enforced payslip reminder workflow.', defaultValue: 3, min: 1, max: 30, unit: 'days', status: 'future' }),
  numberSetting({ key: 'support_auto_close_days', category: 'services', label: 'Support Auto-Close', description: 'Reserved age for a future automatic helpdesk close workflow.', defaultValue: 7, min: 1, max: 90, unit: 'days', status: 'future' }),
  booleanSetting({ key: 'document_download_enabled', category: 'services', label: 'Document Downloads', description: 'Reserved employee document-download control.', defaultValue: true, status: 'future' }),
  booleanSetting({ key: 'employee_directory_enabled', category: 'services', label: 'Employee Directory', description: 'Reserved employee directory availability control.', defaultValue: true, status: 'future' }),
  booleanSetting({ key: 'company_calendar_enabled', category: 'services', label: 'Company Calendar', description: 'Reserved company calendar availability control.', defaultValue: true, status: 'future' }),
  booleanSetting({ key: 'helpdesk_enabled', category: 'services', label: 'Helpdesk', description: 'Reserved employee helpdesk availability control.', defaultValue: true, status: 'future' }),
  numberSetting({ key: 'announcement_default_expiry_days', category: 'notifications', label: 'Announcement Expiry', description: 'Reserved default lifetime for future expiring announcements.', defaultValue: 30, min: 1, max: 365, unit: 'days', status: 'future' }),
  numberSetting({ key: 'notification_retention_days', category: 'notifications', label: 'Notification Retention', description: 'Reserved retention period for a future cleanup workflow.', defaultValue: 30, min: 1, max: 365, unit: 'days', status: 'future' }),
  booleanSetting({ key: 'notification_sound_enabled', category: 'notifications', label: 'Notification Sound', description: 'Reserved sound preference for future notification delivery.', defaultValue: true, status: 'future' }),
  booleanSetting({ key: 'timeout_reminder_enabled', category: 'notifications', label: 'Time-Out Reminders', description: 'Reserved master switch for future reminder delivery.', defaultValue: true, status: 'future' }),
  booleanSetting({ key: 'payslip_reminders_enabled', category: 'notifications', label: 'Payslip Reminders', description: 'Reserved master switch for future payslip reminders.', defaultValue: true, status: 'future' }),
  ...['commute', 'helpdesk', 'documents', 'directory', 'company_calendar', 'leave', 'disputes'].map((feature) => booleanSetting({ key: `feature_${feature}_enabled`, category: 'features', label: `${feature.split('_').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ')} Feature`, description: 'Saved feature control. It remains visible until every direct-entry path is safely guarded.', defaultValue: true, status: 'future' })),
  booleanSetting({ key: 'seasonal_theme_enabled', category: 'seasonal', label: 'Enable Seasonal Theme', description: 'Turns the selected seasonal appearance on when its optional schedule is active.', defaultValue: false, status: 'active' }),
  { key: 'seasonal_theme_variant', category: 'seasonal', label: 'Theme Variant', description: 'Selects the active seasonal visual layer without changing Employee workflows.', type: 'select', defaultValue: 'christmas', status: 'active', options: [{ value: 'christmas', label: 'Christmas Special' }, { value: 'halloween', label: 'Halloween Special' }, { value: 'new_year', label: 'New Year Special' }, { value: 'rainy', label: 'Rainy Day' }, { value: 'sunny', label: 'Sunny Day' }] },
  { key: 'seasonal_theme_scope', category: 'seasonal', label: 'Apply To', description: 'Employee scope is active. Employee and HR is stored as a future control until HR styling is fully wired.', type: 'select', defaultValue: 'employee_only', status: 'active', options: [{ value: 'employee_only', label: 'Employee only' }, { value: 'employee_and_hr', label: 'Employee and HR (future)' }] },
  { key: 'seasonal_theme_start_date', category: 'seasonal', label: 'Start Date', description: 'Optional Philippine date when the theme begins. Leave empty to start immediately.', type: 'date', defaultValue: '', status: 'active' },
  { key: 'seasonal_theme_end_date', category: 'seasonal', label: 'End Date', description: 'Optional Philippine date through which the theme remains active.', type: 'date', defaultValue: '', status: 'active' },
  { key: 'seasonal_theme_intensity', category: 'seasonal', label: 'Theme Intensity', description: 'Subtle keeps accents restrained; Festive adds a little more holiday detail.', type: 'select', defaultValue: 'subtle', status: 'active', options: [{ value: 'subtle', label: 'Subtle' }, { value: 'festive', label: 'Festive' }] },
  booleanSetting({ key: 'seasonal_snow_enabled', category: 'seasonal', label: 'Seasonal Particles', description: 'Shows lightweight snow, sparkles, or floating accents for the selected theme and respects reduced-motion preferences.', defaultValue: true, status: 'active' }),
  booleanSetting({ key: 'seasonal_banner_enabled', category: 'seasonal', label: 'Holiday Banner', description: 'Shows a compact, session-dismissible holiday greeting on the Employee dashboard.', defaultValue: true, status: 'active' }),
  numberSetting({ key: 'dashboard_refresh_seconds', category: 'system', label: 'Dashboard Auto Refresh', description: 'Saved interval for a future shared dashboard refresh scheduler.', defaultValue: 60, min: 30, max: 600, step: 10, unit: 'seconds', status: 'future' }),
  numberSetting({ key: 'archive_after_months', category: 'system', label: 'Archive After', description: 'Reserved retention threshold; the protected archive RPC currently remains fixed at one year.', defaultValue: 12, min: 6, max: 120, unit: 'months', status: 'future' }),
  numberSetting({ key: 'backup_reminder_days', category: 'system', label: 'Backup Reminder', description: 'Reserved reminder threshold for future health warnings.', defaultValue: 7, min: 1, max: 90, unit: 'days', status: 'future' }),
  numberSetting({ key: 'audit_log_retention_days', category: 'system', label: 'Audit Log Retention', description: 'Reserved retention period; no audit records are automatically deleted.', defaultValue: 365, min: 90, max: 3650, unit: 'days', status: 'future' }),
  numberSetting({ key: 'directory_page_size', category: 'system', label: 'Directory Page Size', description: 'Reserved page size for a future paginated directory.', defaultValue: 25, min: 5, max: 100, unit: 'records', status: 'future' }),
  numberSetting({ key: 'attendance_page_size', category: 'system', label: 'Attendance Page Size', description: 'Reserved page size for future attendance views.', defaultValue: 25, min: 5, max: 100, unit: 'records', status: 'future' }),
  { key: 'maintenance_message', category: 'security', label: 'Maintenance Message', description: 'Saved message for a future maintenance-mode enforcement layer.', type: 'string', defaultValue: 'Scheduled maintenance is in progress. Please try again shortly.', status: 'future' },
  booleanSetting({ key: 'maintenance_mode', category: 'security', label: 'Maintenance Mode', description: 'Saved only; it cannot lock out Employee or HR until recovery-safe enforcement is implemented.', defaultValue: false, status: 'future', dangerous: true }),
  numberSetting({ key: 'session_idle_timeout_minutes', category: 'security', label: 'Session Idle Timeout', description: 'Reserved for a future session architecture update.', defaultValue: 60, min: 15, max: 1440, unit: 'minutes', status: 'future' }),
  booleanSetting({ key: 'require_reauth_for_backup', category: 'security', label: 'Backup Reauthentication', description: 'Existing password confirmation remains mandatory; this saved control cannot disable it.', defaultValue: true, status: 'future', dangerous: true }),
  booleanSetting({ key: 'require_reauth_for_archive', category: 'security', label: 'Archive Reauthentication', description: 'Existing password confirmation remains mandatory; this saved control cannot disable it.', defaultValue: true, status: 'future', dangerous: true }),
];

const newlyActivatedSettings = new Set([
  'attendance_dispute_window_days', 'leave_request_min_notice_days', 'max_consecutive_leave_days',
  'leave_cancellation_allowed', 'leave_cancel_before_start_hours', 'helpdesk_enabled',
  'document_download_enabled', 'notification_retention_days', 'notification_sound_enabled',
  'timeout_reminder_enabled', 'payslip_reminders_enabled', 'payslip_ack_reminder_days',
  'feature_helpdesk_enabled', 'feature_documents_enabled', 'feature_leave_enabled',
  'feature_disputes_enabled', 'maintenance_message', 'maintenance_mode',
  'session_idle_timeout_minutes', 'directory_page_size', 'attendance_page_size',
]);

// Promote only settings that have a real consumer. This deliberately avoids
// presenting a saved value as operational before its enforcement exists.
export const APP_SETTING_DEFINITIONS: AppSettingDefinition[] = APP_SETTING_DEFINITIONS_SOURCE.map((setting) => ({
  ...setting,
  status: setting.status === 'active' || newlyActivatedSettings.has(setting.key) ? 'active' : 'future',
  description: newlyActivatedSettings.has(setting.key) ? setting.description
    .replace(/^Reserved /, '')
    .replace(/^Saved for a future /, '')
    .replace(/^Saved /, '')
    .replace(/ for future /g, ' for ')
    .replace(/future /g, '')
    .replace(/Future /g, '') : setting.description,
}));

export const DEFAULT_APP_SETTINGS: AppSettingsValues = Object.fromEntries(APP_SETTING_DEFINITIONS.map((setting) => [setting.key, setting.defaultValue]));
export const ACTIVE_APP_SETTINGS_COUNT = APP_SETTING_DEFINITIONS.filter((setting) => setting.status === 'active').length;

export function normalizeAppSettings(rows: Array<{ key: string; value: unknown }> | null | undefined): AppSettingsValues {
  const values = { ...DEFAULT_APP_SETTINGS };
  for (const row of rows || []) {
    const definition = APP_SETTING_DEFINITIONS.find((item) => item.key === row.key);
    if (!definition) continue;
    const valid = definition.type === 'number' ? typeof row.value === 'number' : definition.type === 'boolean' ? typeof row.value === 'boolean' : typeof row.value === 'string';
    if (valid) values[row.key] = row.value as AppSettingValue;
  }
  return values;
}
