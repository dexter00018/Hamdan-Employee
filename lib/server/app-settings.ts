import type { SupabaseClient } from '@supabase/supabase-js';

type SettingRow = { key: string; value: unknown };

export async function readServerAppSettings(client: SupabaseClient, keys: string[]) {
  const { data, error } = await client
    .from('app_settings')
    .select('key, value')
    .in('key', keys);

  if (error) throw error;
  return Object.fromEntries(((data ?? []) as SettingRow[]).map(({ key, value }) => [key, value]));
}

export function isMaintenanceMode(settings: Record<string, unknown>) {
  return settings.maintenance_mode === true;
}
