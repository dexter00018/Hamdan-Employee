import type { AppSettingsValues } from '@/lib/app-settings';

export type SeasonalThemePortal = 'employee' | 'hr';
export type SeasonalThemeStatus = 'active' | 'scheduled' | 'disabled';
export type SeasonalThemeVariant = 'christmas' | 'halloween' | 'new_year' | 'rainy' | 'sunny';

export type SeasonalThemeResolution = {
  active: boolean;
  status: SeasonalThemeStatus;
  variant: SeasonalThemeVariant;
  scope: string;
  intensity: 'subtle' | 'festive';
  snowEnabled: boolean;
  bannerEnabled: boolean;
};

export const SEASONAL_THEME_PRESENTATION: Record<SeasonalThemeVariant, { label: string; greeting: string; symbol: string; particle: string; bannerTone: string }> = {
  christmas: { label: 'Filipino Christmas', greeting: 'Maligayang Pasko mula sa Hamdan Engineering', symbol: '✦', particle: '❄', bannerTone: 'from-emerald-900 via-green-800 to-red-900' },
  halloween: { label: 'Folklore Halloween', greeting: 'Ingat at magsaya ngayong gabi, Hamdan team', symbol: '◈', particle: '◆', bannerTone: 'from-slate-950 via-purple-950 to-orange-900' },
  new_year: { label: 'Filipino New Year', greeting: 'Manigong Bagong Taon mula sa Hamdan Engineering', symbol: '✧', particle: '✦', bannerTone: 'from-slate-950 via-blue-950 to-amber-800' },
  rainy: { label: 'Rainy Season', greeting: 'Mag-ingat sa ulan at biyahe, Hamdan team', symbol: '☂', particle: '│', bannerTone: 'from-cyan-950 via-blue-900 to-slate-700' },
  sunny: { label: 'Tropical Sunshine', greeting: 'Maliwanag at masiglang araw, Hamdan team', symbol: '☀', particle: '✿', bannerTone: 'from-amber-700 via-orange-600 to-green-700' },
};

function normalizeVariant(value: AppSettingsValues[string]): SeasonalThemeVariant {
  return value === 'halloween' || value === 'new_year' || value === 'rainy' || value === 'sunny' ? value : 'christmas';
}

function manilaDate(now: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

export function resolveSeasonalTheme(settings: AppSettingsValues, portal: SeasonalThemePortal, now = new Date()): SeasonalThemeResolution {
  const enabled = settings.seasonal_theme_enabled === true;
  const variant = normalizeVariant(settings.seasonal_theme_variant);
  const scope = typeof settings.seasonal_theme_scope === 'string' ? settings.seasonal_theme_scope : 'employee_only';
  const start = typeof settings.seasonal_theme_start_date === 'string' ? settings.seasonal_theme_start_date : '';
  const end = typeof settings.seasonal_theme_end_date === 'string' ? settings.seasonal_theme_end_date : '';
  const today = manilaDate(now);
  const portalAllowed = portal === 'employee' || scope === 'employee_and_hr';
  const beforeStart = Boolean(start && today < start);
  const afterEnd = Boolean(end && today > end);
  const inWindow = !beforeStart && !afterEnd;
  const active = enabled && portalAllowed && inWindow;
  const status: SeasonalThemeStatus = active ? 'active' : enabled && beforeStart ? 'scheduled' : 'disabled';

  return {
    active,
    status,
    variant,
    scope,
    intensity: settings.seasonal_theme_intensity === 'festive' ? 'festive' : 'subtle',
    snowEnabled: active && settings.seasonal_snow_enabled === true,
    bannerEnabled: active && settings.seasonal_banner_enabled === true,
  };
}
