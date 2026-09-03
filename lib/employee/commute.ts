/**
 * Pure types and presentation helpers for the employee commute planner.
 * Keeping these outside the dashboard component makes the four-state mapping
 * independently testable and prevents the employee page from becoming a
 * second implementation of the commute workflow.
 */

export const getManilaDateTimeInputs = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
  const minute = Number(get('minute'));
  const roundedMinute = minute >= 30 ? '30' : '00';

  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${roundedMinute}`,
  };
};

export const formatManilaClockValue = (isoValue: string | null | undefined) => {
  if (!isoValue) return '--';
  const date = new Date(isoValue);
  if (!Number.isFinite(date.getTime())) return '--';
  return date.toLocaleTimeString('en-PH', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const getManilaForecastMaxDate = () => {
  const start = getManilaDateTimeInputs().date;
  const date = new Date(`${start}T12:00:00+08:00`);
  date.setUTCDate(date.getUTCDate() + 6);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};


export type CommutePoint = {
  name: string;
  lat: number;
  lon: number;
};

export type AddressSuggestion = {
  id: string;
  name: string;
  address: string;
  municipality: string;
  latitude: number;
  longitude: number;
  type: string;
};

export const getAddressPrimaryLabel = (place: AddressSuggestion) => {
  if (place.type === 'geolocation') return 'Current location';

  const originalName = String(place.name || '').trim();
  const municipality = String(place.municipality || '').trim();
  const addressParts = String(place.address || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const genericName = /^(district|zone|region)\b/i.test(originalName);
  const usefulPart = addressParts.find(
    (part) =>
      part.toLowerCase() !== originalName.toLowerCase() &&
      !/^(metro manila|southern manila district|national capital region|philippines|\d{4,6})$/i.test(part)
  );
  const primary = genericName ? usefulPart || municipality || originalName : originalName || usefulPart || municipality || 'Location';

  if (
    municipality &&
    !primary.toLowerCase().includes(municipality.toLowerCase())
  ) {
    return `${primary}, ${municipality}`;
  }
  return primary;
};

export const getAddressSecondaryLabel = (place: AddressSuggestion) =>
  String(place.address || place.municipality || '').trim();

export type CommuteAdviceOption =
  | 'route_weather'
  | 'rain_risk'
  | 'traffic_delays'
  | 'best_departure';

export type CommuteUIState =
  | 'idle'
  | 'updating'
  | 'live'
  | 'partial'
  | 'input_error'
  | 'failed';

export type CommuteErrorPayload = {
  success?: boolean;
  error_type?: string;
  error?: string;
};

export type CommuteStateMappingInput = {
  requestInFlight?: boolean;
  responseOk?: boolean;
  responseStatus?: number;
  payload?: (CommuteCheckResult & CommuteErrorPayload) | CommuteErrorPayload | null;
  thrownError?: unknown;
};

export type CommuteStateMappingResult = {
  state: CommuteUIState;
  message: string | null;
};

// n8n normally returns the response object directly, but test webhooks,
// proxy nodes, and older workflow versions can wrap it in an array or under
// data/body/result/json. Normalize those harmless transport wrappers before
// applying the four-state UI rules.
export const unwrapCommutePayload = (rawPayload: unknown): any => {
  let current: any = rawPayload;

  for (let depth = 0; depth < 5; depth += 1) {
    if (Array.isArray(current)) {
      current = current[0];
      continue;
    }

    if (!current || typeof current !== 'object') break;
    if (current.data_status || current.error || current.error_type) break;

    const wrapped =
      current.data ??
      current.body ??
      current.result ??
      current.json ??
      current.output;

    if (wrapped == null || wrapped === current) break;

    if (typeof wrapped === 'string') {
      try {
        current = JSON.parse(wrapped);
      } catch {
        break;
      }
    } else {
      current = wrapped;
    }
  }

  return current && typeof current === 'object' ? current : {};
};

export const getCommuteErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message;
  return 'Unable to check this route right now.';
};

// Pure mapping used by the fetch handler and easy to unit-test independently.
export const mapCommuteUIState = ({
  requestInFlight = false,
  responseOk,
  responseStatus,
  payload,
  thrownError,
}: CommuteStateMappingInput): CommuteStateMappingResult => {
  if (requestInFlight) return { state: 'updating', message: null };

  if (thrownError) {
    return { state: 'failed', message: getCommuteErrorMessage(thrownError) };
  }

  if (responseOk === false) {
    const message =
      payload?.error ||
      (responseStatus === 400 || responseStatus === 422
        ? 'Please review the commute form and try again.'
        : 'Unable to check this route right now.');

    return {
      state:
        responseStatus === 400 ||
        responseStatus === 422 ||
        payload?.error_type === 'input_error'
          ? 'input_error'
          : 'failed',
      message,
    };
  }

  const dataStatus = (payload as CommuteCheckResult | null)?.data_status;
  if (responseOk === true && dataStatus === 'complete') {
    return { state: 'live', message: null };
  }
  if (responseOk === true && dataStatus === 'partial') {
    return { state: 'partial', message: null };
  }
  if (responseOk === true && dataStatus === 'unavailable') {
    return {
      state: 'failed',
      message: payload?.error || 'No usable route or weather data was returned.',
    };
  }

  return {
    state: 'failed',
    message: payload?.error || 'The commute service returned an incomplete response.',
  };
};

export type CommuteRainAlert = {
  active?: boolean;
  threshold_percent?: number;
  level?: 'none' | 'watch' | 'likely' | 'very_likely' | string;
  tone?: 'neutral' | 'amber' | 'orange' | 'red' | string;
  highlight_destination?: boolean;
  message?: string | null;
};

export type RouteWeatherCheckpoint = {
  index: number;
  total: number;
  fraction: number;
  lat: number;
  lon: number;
  location_name: string;
  resolved_address?: string | null;
  estimated_minutes_from_departure: number;
  arrival_time: string;
  available: boolean;
  rain_probability?: number | null;
  precipitation_mm?: number | null;
  rain_intensity?: string | null;
  rain_intensity_label?: string | null;
  condition_label?: string | null;
  weather_code?: number | null;
  temperature_c?: number | null;
  apparent_temperature_c?: number | null;
  wind_speed_kmh?: number | null;
  wind_gust_kmh?: number | null;
  rain_alert?: boolean;
  rain_alert_tone?: 'neutral' | 'amber' | 'orange' | 'red' | string;
  forecast_method?: string | null;
  source?: string | null;
};

export const getRouteCheckpointVisual = (checkpoint: RouteWeatherCheckpoint) => {
  const rainChance = Number(checkpoint.rain_probability ?? 0);
  const weatherCode = Number(checkpoint.weather_code ?? -1);
  const condition = String(checkpoint.condition_label || '').toLowerCase();

  if (!checkpoint.available) {
    return { icon: '❔', label: 'Forecast unavailable', tone: 'slate' as const };
  }
  if ([95, 96, 99].includes(weatherCode)) {
    return { icon: '⛈️', label: 'Thunderstorm risk', tone: 'red' as const };
  }
  if (rainChance >= 70 || condition.includes('rain')) {
    return { icon: '🌧️', label: checkpoint.rain_intensity_label || 'Rain likely', tone: 'orange' as const };
  }
  if (rainChance >= 50) {
    return { icon: '🌦️', label: checkpoint.rain_intensity_label || 'Possible showers', tone: 'amber' as const };
  }
  if ([0, 1].includes(weatherCode) || condition.includes('clear')) {
    return { icon: '☀️', label: 'Clear', tone: 'emerald' as const };
  }
  if ([45, 48].includes(weatherCode)) {
    return { icon: '🌫️', label: 'Foggy', tone: 'slate' as const };
  }
  if ([2, 3].includes(weatherCode) || condition.includes('cloud')) {
    return { icon: '☁️', label: 'Cloudy', tone: 'slate' as const };
  }
  return { icon: '🌤️', label: checkpoint.condition_label || 'Forecast available', tone: 'emerald' as const };
};

export type CommuteCheckResult = {
  success: boolean;
  data_status?: 'complete' | 'partial' | 'unavailable' | string;
  advice_options?: CommuteAdviceOption[];
  origin: CommutePoint;
  destination: CommutePoint;
  route: {
    eta_minutes: number;
    normal_minutes: number;
    delay_minutes: number;
    distance_km: number;
    traffic_level: 'Light' | 'Moderate' | 'Heavy' | 'Severe' | string;
    coordinates: Array<{ lat: number; lon: number }>;
    departure_time?: string | null;
    arrival_time?: string | null;
    weather_checkpoint_count?: number;
  } | null;
  weather?: {
    temperature_c?: number | null;
    apparent_temperature_c?: number | null;
    relative_humidity_percent?: number | null;
    precipitation_mm?: number | null;
    expected_precipitation_next_30_minutes_mm?: number | null;
    expected_precipitation_next_hour_mm?: number | null;
    is_raining?: boolean | null;
    rain_probability?: number | null;
    rain_probability_time?: string | null;
    rain_probability_method?: string | null;
    rain_intensity?: 'none' | 'light' | 'moderate' | 'heavy' | 'very_heavy' | 'unknown' | string | null;
    rain_intensity_label?: string | null;
    possible_rain_amount?: string | null;
    rain_alert?: CommuteRainAlert | null;
    weather_code?: number | null;
    wind_speed_kmh?: number | null;
    wind_gust_kmh?: number | null;
    is_day?: boolean | null;
    weather_time?: string | null;
    source_time?: string | null;
    bucket_minutes?: number | null;
    timezone?: string | null;
    source?: string | null;
    data_type?: string | null;
  } | null;
  incidents?: Array<{
    id?: string | null;
    type?: string | null;
    category?: number | string | null;
    category_label?: string | null;
    severity?: 'Light' | 'Moderate' | 'Heavy' | 'Severe' | string;
    magnitude?: number | null;
    delay_seconds?: number | null;
    delay_minutes?: number | null;
    from?: string | null;
    to?: string | null;
    road_numbers?: string[];
    location_label?: string | null;
    length_meters?: number | null;
    start_time?: string | null;
    end_time?: string | null;
    probability?: string | null;
    reports?: number | null;
    last_report_time?: string | null;
    distance_from_route_km?: number | null;
    geometry?: {
      type?: string;
      coordinates?: any;
    } | null;
  }>;
  advisory?: string | null;
  partial?: {
    traffic_available?: boolean;
    destination_weather_available?: boolean;
    route_weather_available?: boolean;
    incidents_available?: boolean;
  };
  freshness?: {
    overall_updated_at?: string | null;
    traffic_updated_at?: string | null;
    weather_updated_at?: string | null;
  };
  route_weather_checkpoints?: RouteWeatherCheckpoint[];
  route_weather_summary?: {
    available?: boolean;
    checkpoint_count?: number;
    highest_rain_probability?: number | null;
    wettest_checkpoint?: RouteWeatherCheckpoint | null;
    rain_alert?: boolean;
    recommended_extra_minutes?: number | null;
    recommendation?: string | null;
    generated_for_departure_at?: string | null;
    timezone?: string | null;
    source?: string | null;
  } | null;
  destination_weather_alert?: CommuteRainAlert | null;
  highlight_destination_for_rain?: boolean;
  highlight_route_for_rain?: boolean;
  ai_advisory?: {
    status?: 'good_to_go' | 'leave_early' | 'expect_delays' | 'consider_alternate_route' | string | null;
    status_label?: string | null;
    headline?: string | null;
    summary?: string | null;
    traffic_summary?: string | null;
    weather_summary?: string | null;
    recommendation?: string | null;
    recommended_extra_minutes?: number | null;
    key_reasons?: string[];
    language?: 'en' | 'tl' | string | null;
  } | null;
  ai_request?: any;
  generated_at: string;
  sources?: {
    traffic?: string | null;
    weather?: string | null;
    ai?: string | null;
  };
};

export const buildPartialCommuteMessage = (
  partial: CommuteCheckResult['partial'],
  requestedOptions: CommuteAdviceOption[]
) => {
  const wantsTraffic =
    requestedOptions.includes('traffic_delays') ||
    requestedOptions.includes('best_departure');
  const wantsWeather =
    requestedOptions.includes('route_weather') ||
    requestedOptions.includes('rain_risk');
  const missing: string[] = [];

  if (wantsTraffic && partial?.traffic_available === false) {
    missing.push('live traffic');
  }
  if (wantsWeather && partial?.destination_weather_available === false) {
    missing.push('destination weather');
  }
  if (wantsWeather && partial?.route_weather_available === false) {
    missing.push('route waypoint weather');
  }
  if (wantsTraffic && partial?.incidents_available === false) {
    missing.push('traffic incident details');
  }

  if (
    wantsTraffic &&
    partial?.traffic_available === false &&
    partial?.destination_weather_available === true &&
    missing.length === 1
  ) {
    return 'Weather is available, but live traffic could not be refreshed.';
  }

  if (
    wantsWeather &&
    partial?.route_weather_available === false &&
    partial?.destination_weather_available === true &&
    missing.length === 1
  ) {
    return 'Route waypoint weather is unavailable, but destination-level weather is still available.';
  }

  if (missing.length === 0) {
    return 'Some requested live details could not be refreshed. The available information is still shown.';
  }

  const missingText =
    missing.length === 1
      ? missing[0]
      : `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}`;

  return `The following requested data could not be refreshed: ${missingText}. Available results are still shown.`;
};

export const getAdviceAvailability = (
  option: CommuteAdviceOption,
  requestedOptions: CommuteAdviceOption[],
  result: CommuteCheckResult
): 'available' | 'unavailable' | 'not_requested' => {
  if (!requestedOptions.includes(option)) return 'not_requested';

  if (option === 'traffic_delays') {
    return result.partial?.traffic_available === true && result.route
      ? 'available'
      : 'unavailable';
  }

  if (option === 'best_departure') {
    return result.partial?.traffic_available === true && result.route
      ? 'available'
      : 'unavailable';
  }

  if (option === 'route_weather') {
    return result.partial?.route_weather_available === true
      ? 'available'
      : 'unavailable';
  }

  return result.partial?.destination_weather_available === true ||
    result.partial?.route_weather_available === true
    ? 'available'
    : 'unavailable';
};



export const formatCommuteMinutes = (minutes: number | null | undefined) => {
  const value = Number(minutes ?? 0);
  return `${Math.max(0, Math.round(value))} min`;
};

export const formatCommuteDistance = (kilometers: number | null | undefined) => {
  const value = Number(kilometers ?? 0);
  return `${value.toFixed(value >= 10 ? 0 : 1)} km`;
};

export const formatCommuteClock = (isoValue: string | null | undefined) => {
  return formatManilaClockValue(isoValue);
};

export const formatCommuteUpdatedAt = (isoValue: string | null | undefined) => {
  if (!isoValue) return '--';
  const date = new Date(isoValue);
  if (!Number.isFinite(date.getTime())) return '--';
  return date.toLocaleTimeString('en-PH', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const shortCommutePlace = (value: string | null | undefined, fallback: string) => {
  const firstPart = String(value || '').split(',')[0]?.trim();
  return firstPart || fallback;
};

export const getCommuteWeatherHighlight = (weather: CommuteCheckResult['weather']) => {
  const rain = Number(weather?.rain_probability ?? 0);
  const feels = Number(weather?.apparent_temperature_c ?? weather?.temperature_c ?? 0);
  const wind = Number(weather?.wind_speed_kmh ?? 0);
  const alertActive = weather?.rain_alert?.active === true || rain >= 50;

  if (alertActive && rain >= 85) {
    return {
      label: 'Very likely rain',
      icon: '⛈️',
      card: 'bg-sky-50 border-sky-300',
      badge: 'bg-sky-700 text-white',
      text: 'text-sky-950',
      accent: 'bg-sky-600',
    };
  }

  if (alertActive && rain >= 70) {
    return {
      label: 'Rain likely',
      icon: '🌧️',
      card: 'bg-cyan-50 border-cyan-300',
      badge: 'bg-cyan-700 text-white',
      text: 'text-cyan-950',
      accent: 'bg-cyan-600',
    };
  }

  if (alertActive) {
    return {
      label: 'Rain watch',
      icon: '🌦️',
      card: 'bg-amber-50 border-amber-200',
      badge: 'bg-amber-500 text-white',
      text: 'text-amber-950',
      accent: 'bg-amber-500',
    };
  }

  if (rain >= 30) {
    return {
      label: 'Possible rain',
      icon: '🌦️',
      card: 'bg-sky-50 border-sky-200',
      badge: 'bg-sky-600 text-white',
      text: 'text-sky-950',
      accent: 'bg-sky-500',
    };
  }

  if (feels >= 35) {
    return {
      label: 'Feels very hot',
      icon: '☀️',
      card: 'bg-orange-50 border-orange-300',
      badge: 'bg-orange-500 text-white',
      text: 'text-orange-950',
      accent: 'bg-orange-500',
    };
  }

  if (wind >= 35) {
    return {
      label: 'Windy',
      icon: '💨',
      card: 'bg-cyan-50 border-cyan-300',
      badge: 'bg-cyan-600 text-white',
      text: 'text-cyan-950',
      accent: 'bg-cyan-500',
    };
  }

  return {
    label: 'Weather looks okay',
    icon: '🌤️',
    card: 'bg-emerald-50 border-emerald-200',
    badge: 'bg-emerald-600 text-white',
    text: 'text-emerald-950',
    accent: 'bg-emerald-500',
  };
};

export const formatWeatherBucketTime = (value?: string | null) => {
  if (!value) return 'Latest available';
  const time = String(value).match(/T(\d{2}):(\d{2})/);
  if (!time) return value;
  const hour = Number(time[1]);
  const minute = time[2];
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${hour >= 12 ? 'PM' : 'AM'}`;
};

export const formatRainAmount = (value?: number | null) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  return `${amount < 10 ? amount.toFixed(1) : Math.round(amount)} mm`;
};

export const getTrafficLevelStyle = (level?: string | null) => {
  if (level === 'Severe') {
    return {
      dot: 'bg-red-800',
      badge: 'bg-red-100 text-red-800 border-red-200'
    };
  }

  if (level === 'Heavy') {
    return {
      dot: 'bg-red-500',
      badge: 'bg-red-50 text-red-700 border-red-200'
    };
  }

  if (level === 'Moderate') {
    return {
      dot: 'bg-amber-500',
      badge: 'bg-amber-50 text-amber-700 border-amber-200'
    };
  }

  return {
    dot: 'bg-green-500',
    badge: 'bg-green-50 text-green-700 border-green-200'
  };
};

