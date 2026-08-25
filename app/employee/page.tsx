'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import Spinner, { LoadingRow } from '@/components/Spinner';

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.8 21.8 0 0 1 5.06-6.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.8 21.8 0 0 1-3.16 4.66M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}

// Fallback values used only if app_settings hasn't loaded yet or a row
// is missing -- normal operation always uses the configurable values
// fetched from the database (editable via Super Admin -> App Settings).
const FALLBACK_LATE_CUTOFF_HOUR = 9;
const FALLBACK_LATE_CUTOFF_MINUTE = 15;
const FALLBACK_LEAVE_CREDITS = 10;
const FALLBACK_TIME_OUT_REMINDER_HOUR = 19;

const getManilaDateTimeInputs = () => {
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

const formatManilaClockValue = (isoValue: string | null | undefined) => {
  if (!isoValue) return '--';
  const date = new Date(isoValue);
  if (!Number.isFinite(date.getTime())) return '--';
  return date.toLocaleTimeString('en-PH', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const getManilaForecastMaxDate = () => {
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


type CommutePoint = {
  name: string;
  lat: number;
  lon: number;
};

type AddressSuggestion = {
  id: string;
  name: string;
  address: string;
  municipality: string;
  latitude: number;
  longitude: number;
  type: string;
};

type CommuteRainAlert = {
  active?: boolean;
  threshold_percent?: number;
  level?: 'none' | 'watch' | 'likely' | 'very_likely' | string;
  tone?: 'neutral' | 'amber' | 'orange' | 'red' | string;
  highlight_destination?: boolean;
  message?: string | null;
};

type RouteWeatherCheckpoint = {
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

type CommuteCheckResult = {
  success: boolean;
  data_status?: 'complete' | 'partial' | 'unavailable' | string;
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

function TrafficRouteMap({ result }: { result: CommuteCheckResult }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [zoomOffset, setZoomOffset] = useState(0);
  const [tileFailures, setTileFailures] = useState(0);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setSize({
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
      });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(element);

    window.addEventListener('resize', updateSize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  useEffect(() => {
    setZoomOffset(0);
    setTileFailures(0);
  }, [result]);

  const apiKey = process.env.NEXT_PUBLIC_TOMTOM_API_KEY || '';
  const googleMapsDirectionsUrl = useMemo(() => {
    const originLat = Number(result.origin?.lat);
    const originLon = Number(result.origin?.lon);
    const destinationLat = Number(result.destination?.lat);
    const destinationLon = Number(result.destination?.lon);

    if (
      !Number.isFinite(originLat) ||
      !Number.isFinite(originLon) ||
      !Number.isFinite(destinationLat) ||
      !Number.isFinite(destinationLon)
    ) {
      return null;
    }

    const params = new URLSearchParams({
      api: '1',
      origin: `${originLat},${originLon}`,
      destination: `${destinationLat},${destinationLon}`,
      travelmode: 'driving',
    });

    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }, [result.destination?.lat, result.destination?.lon, result.origin?.lat, result.origin?.lon]);


  const mapData = useMemo(() => {
    if (!size.width || !size.height) return null;

    const clampLat = (lat: number) => Math.max(-85.05112878, Math.min(85.05112878, lat));

    const toWorldPixel = (lon: number, lat: number, zoom: number) => {
      const worldSize = 256 * Math.pow(2, zoom);
      const safeLat = clampLat(lat);
      const sin = Math.sin((safeLat * Math.PI) / 180);

      return {
        x: ((lon + 180) / 360) * worldSize,
        y:
          (0.5 -
            Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) *
          worldSize,
      };
    };

    const rawRoute = (result.route?.coordinates ?? [])
      .filter(
        (point) =>
          Number.isFinite(Number(point?.lat)) &&
          Number.isFinite(Number(point?.lon))
      )
      .map((point) => ({
        lat: Number(point.lat),
        lon: Number(point.lon),
      }));

    const origin = {
      lat: Number(result.origin?.lat),
      lon: Number(result.origin?.lon),
    };

    const destination = {
      lat: Number(result.destination?.lat),
      lon: Number(result.destination?.lon),
    };

    const route =
      rawRoute.length > 1 ? rawRoute : [origin, destination];

    const allPoints = [...route, origin, destination].filter(
      (point) =>
        Number.isFinite(point.lat) &&
        Number.isFinite(point.lon)
    );

    if (!allPoints.length) return null;

    const horizontalPadding = Math.min(80, Math.max(34, size.width * 0.08));
    const verticalPadding = Math.min(70, Math.max(32, size.height * 0.12));
    const usableWidth = Math.max(120, size.width - horizontalPadding * 2);
    const usableHeight = Math.max(120, size.height - verticalPadding * 2);

    let fittedZoom = 12;

    for (let candidate = 18; candidate >= 3; candidate -= 1) {
      const pixels = allPoints.map((point) =>
        toWorldPixel(point.lon, point.lat, candidate)
      );

      const xs = pixels.map((point) => point.x);
      const ys = pixels.map((point) => point.y);
      const spanX = Math.max(...xs) - Math.min(...xs);
      const spanY = Math.max(...ys) - Math.min(...ys);

      if (spanX <= usableWidth && spanY <= usableHeight) {
        fittedZoom = candidate;
        break;
      }
    }

    const zoom = Math.max(3, Math.min(19, fittedZoom + zoomOffset));
    const pixelPoints = allPoints.map((point) =>
      toWorldPixel(point.lon, point.lat, zoom)
    );

    const xs = pixelPoints.map((point) => point.x);
    const ys = pixelPoints.map((point) => point.y);

    const boundsCenter = {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2,
    };

    const topLeft = {
      x: boundsCenter.x - size.width / 2,
      y: boundsCenter.y - size.height / 2,
    };

    const minTileX = Math.floor(topLeft.x / 256) - 1;
    const maxTileX = Math.floor((topLeft.x + size.width) / 256) + 1;
    const minTileY = Math.floor(topLeft.y / 256) - 1;
    const maxTileY = Math.floor((topLeft.y + size.height) / 256) + 1;

    const tileCount = Math.pow(2, zoom);
    const tiles: Array<{
      key: string;
      x: number;
      y: number;
      left: number;
      top: number;
      url: string;
    }> = [];

    for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
      if (tileY < 0 || tileY >= tileCount) continue;

      for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
        const wrappedX = ((tileX % tileCount) + tileCount) % tileCount;

        tiles.push({
          key: `${zoom}-${tileX}-${tileY}`,
          x: wrappedX,
          y: tileY,
          left: tileX * 256 - topLeft.x,
          top: tileY * 256 - topLeft.y,
          url:
            `https://api.tomtom.com/maps/orbis/display/raster/tile/${zoom}/${wrappedX}/${tileY}` +
            `?apiVersion=2` +
            `&style=street-light` +
            `&tileSize=256` +
            `&geopoliticalView=PH` +
            `&key=${encodeURIComponent(apiKey)}`,
        });
      }
    }

    const toScreen = (point: { lat: number; lon: number }) => {
      const world = toWorldPixel(point.lon, point.lat, zoom);
      return {
        x: world.x - topLeft.x,
        y: world.y - topLeft.y,
      };
    };

    const routeScreen = route.map(toScreen);
    const originScreen = toScreen(origin);
    const destinationScreen = toScreen(destination);
    const checkpointScreens = (result.route_weather_checkpoints ?? [])
      .filter((checkpoint) =>
        Number.isFinite(Number(checkpoint.lat)) &&
        Number.isFinite(Number(checkpoint.lon))
      )
      .map((checkpoint) => ({
        checkpoint,
        screen: toScreen({ lat: Number(checkpoint.lat), lon: Number(checkpoint.lon) }),
      }));

    const path =
      routeScreen.length > 1
        ? routeScreen
            .map(
              (point, index) =>
                `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`
            )
            .join(' ')
        : '';

    return {
      zoom,
      tiles,
      path,
      originScreen,
      destinationScreen,
      checkpointScreens,
    };
  }, [apiKey, result, size.height, size.width, zoomOffset]);

  if (!apiKey) {
    return (
      <div className="h-64 sm:h-80 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center p-5 text-center">
        <div>
          <p className="font-bold text-slate-700 text-sm">Map preview unavailable</p>
          <p className="text-slate-500 text-xs mt-1">
            NEXT_PUBLIC_TOMTOM_API_KEY is not configured.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      role={googleMapsDirectionsUrl ? 'link' : undefined}
      tabIndex={googleMapsDirectionsUrl ? 0 : undefined}
      title={googleMapsDirectionsUrl ? 'Open this route in Google Maps' : undefined}
      onClick={(event) => {
        if (!googleMapsDirectionsUrl) return;
        if ((event.target as HTMLElement).closest('button')) return;
        window.open(googleMapsDirectionsUrl, '_blank', 'noopener,noreferrer');
      }}
      onKeyDown={(event) => {
        if (!googleMapsDirectionsUrl) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          window.open(googleMapsDirectionsUrl, '_blank', 'noopener,noreferrer');
        }
      }}
      className={`relative w-full h-64 sm:h-80 rounded-2xl overflow-hidden bg-[#e8ece8] border border-slate-200 ${googleMapsDirectionsUrl ? 'cursor-pointer' : ''}`}
    >
      {mapData && (
        <>
          {/* Direct TomTom image tiles: no WebGL, MapLibre worker, or Assets Style endpoint. */}
          <div className="absolute inset-0 overflow-hidden">
            {mapData.tiles.map((tile) => (
              <img
                key={tile.key}
                src={tile.url}
                alt=""
                draggable={false}
                onError={() => setTileFailures((count) => count + 1)}
                className="absolute block max-w-none select-none pointer-events-none"
                style={{
                  width: 256,
                  height: 256,
                  left: `${tile.left}px`,
                  top: `${tile.top}px`,
                }}
              />
            ))}
          </div>

          {/* Route overlay */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox={`0 0 ${size.width} ${size.height}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {mapData.path && (
              <>
                <path
                  d={mapData.path}
                  fill="none"
                  stroke="rgba(255,255,255,.96)"
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d={mapData.path}
                  fill="none"
                  stroke="#16a34a"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}
          </svg>

          {/* Origin marker */}
          <button
            type="button"
            title={result.origin?.name || 'Origin'}
            className="absolute z-20 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-900 text-white border-[3px] border-white shadow-lg text-[11px] font-extrabold flex items-center justify-center"
            style={{
              left: `${mapData.originScreen.x}px`,
              top: `${mapData.originScreen.y}px`,
            }}
          >
            A
          </button>

          {mapData.checkpointScreens
            .filter(({ checkpoint }) => checkpoint.available && checkpoint.index > 0 && checkpoint.index < checkpoint.total - 1)
            .map(({ checkpoint, screen }) => {
              const rainChance = Number(checkpoint.rain_probability ?? 0);
              const alertClass = rainChance >= 85
                ? 'bg-red-600 ring-red-200'
                : rainChance >= 70
                  ? 'bg-orange-500 ring-orange-200'
                  : rainChance >= 50
                    ? 'bg-amber-500 ring-amber-200'
                    : 'bg-emerald-600 ring-emerald-200';
              return (
                <button
                  key={`map-checkpoint-${checkpoint.index}-${checkpoint.lat}-${checkpoint.lon}`}
                  type="button"
                  title={`${checkpoint.location_name} · ${formatManilaClockValue(checkpoint.arrival_time)} · ${checkpoint.rain_probability ?? 'N/A'}% rain`}
                  className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 min-w-7 h-7 px-1 rounded-full text-white border-2 border-white shadow-lg ring-4 text-[8px] font-extrabold flex items-center justify-center ${alertClass}`}
                  style={{ left: `${screen.x}px`, top: `${screen.y}px` }}
                >
                  {checkpoint.rain_probability != null ? `${Math.round(checkpoint.rain_probability)}%` : '•'}
                </button>
              );
            })}

          {/* Destination marker */}
          <button
            type="button"
            title={`${result.destination?.name || 'Destination'}${result.highlight_destination_for_rain ? ' · Rain alert' : ''}`}
            className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full text-white border-[3px] border-white shadow-lg text-[11px] font-extrabold flex items-center justify-center ${
              result.highlight_destination_for_rain
                ? Number(result.weather?.rain_probability ?? 0) >= 85
                  ? 'bg-red-600 ring-4 ring-red-300/70'
                  : Number(result.weather?.rain_probability ?? 0) >= 70
                    ? 'bg-orange-500 ring-4 ring-orange-300/70'
                    : 'bg-amber-500 ring-4 ring-amber-300/70'
                : 'bg-green-600'
            }`}
            style={{
              left: `${mapData.destinationScreen.x}px`,
              top: `${mapData.destinationScreen.y}px`,
            }}
          >
            B
          </button>

          {/* Simple preview zoom controls */}
          <div className="absolute top-3 right-3 z-30 overflow-hidden rounded-xl border border-black/10 bg-white/95 shadow-md">
            <button
              type="button"
              className="block w-9 h-9 text-slate-800 font-bold hover:bg-slate-100 border-b border-slate-200"
              onClick={() => setZoomOffset((value) => Math.min(value + 1, 3))}
              aria-label="Zoom map in"
            >
              +
            </button>
            <button
              type="button"
              className="block w-9 h-9 text-slate-800 font-bold hover:bg-slate-100"
              onClick={() => setZoomOffset((value) => Math.max(value - 1, -3))}
              aria-label="Zoom map out"
            >
              −
            </button>
          </div>

          <div className="absolute left-3 bottom-3 z-30 rounded-lg bg-white/90 px-2 py-1 text-[9px] font-semibold text-slate-600 shadow-sm">
            A {result.origin?.name || 'Origin'} → B {result.destination?.name || 'Destination'}
          </div>

          <div className="absolute right-2 bottom-2 z-30 rounded bg-white/85 px-1.5 py-0.5 text-[9px] text-slate-600">
            © TomTom
          </div>

          {googleMapsDirectionsUrl && (
            <div className="absolute top-3 left-3 z-30 rounded-full bg-white/95 border border-slate-200 px-3 py-1.5 text-[9px] font-extrabold text-slate-700 shadow-sm pointer-events-none">
              📍 Click map to open in Google Maps
            </div>
          )}

          {tileFailures > Math.max(3, mapData.tiles.length / 2) && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-100/90 p-5 text-center">
              <div>
                <p className="font-bold text-slate-700 text-sm">Map tiles could not be displayed</p>
                <p className="text-slate-500 text-xs mt-1">
                  Route data is still available above.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function EmployeeDashboard() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeOutLoading, setTimeOutLoading] = useState(false);
  const [todayLog, setTodayLog] = useState<{ id: string; time_in: string | null; time_out: string | null; status: string | null } | null>(null);

  // App-wide configurable settings (late cutoff, leave credits default,
  // time-out reminder hour) -- fetched once on load from app_settings,
  // editable by Super Admin without needing a code change/redeploy.
  // Falls back to the constants above until the fetch resolves.
  const [lateCutoffHour, setLateCutoffHour] = useState(FALLBACK_LATE_CUTOFF_HOUR);
  const [lateCutoffMinute, setLateCutoffMinute] = useState(FALLBACK_LATE_CUTOFF_MINUTE);
  const [fallbackLeaveCredits, setFallbackLeaveCredits] = useState(FALLBACK_LEAVE_CREDITS);
  const [timeOutReminderHour, setTimeOutReminderHour] = useState(FALLBACK_TIME_OUT_REMINDER_HOUR);

  const fetchAppSettings = async () => {
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['late_cutoff_hour', 'late_cutoff_minute', 'default_leave_credits', 'time_out_reminder_hour']);
    if (error) {
      console.error('Error fetching app settings:', error);
      return;
    }
    const map = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
    if (typeof map.late_cutoff_hour === 'number') setLateCutoffHour(map.late_cutoff_hour);
    if (typeof map.late_cutoff_minute === 'number') setLateCutoffMinute(map.late_cutoff_minute);
    if (typeof map.default_leave_credits === 'number') setFallbackLeaveCredits(map.default_leave_credits);
    if (typeof map.time_out_reminder_hour === 'number') setTimeOutReminderHour(map.time_out_reminder_hour);
  };

  // --- Dark Mode ---
  // Persisted in localStorage (falls back to the OS/browser preference on
  // first visit). Toggles a `dark` class on <html> itself (via
  // document.documentElement) rather than on <main> -- your body
  // background gradient in globals.css is set on the <body> tag, which
  // is an ANCESTOR of <main>, not a descendant, so ".dark body { }"
  // would never match if "dark" only lived on <main>. Putting it on
  // <html> makes <body> (and everything else) a proper descendant, so
  // the CSS override actually applies. The matching dark-theme colors
  // for the custom classes (card-style, input-field, tag-*, btn-*,
  // branding-box, etc.) live in the CSS snippet provided alongside this
  // file -- paste it at the end of globals.css.
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark') {
      setDarkMode(true);
    } else if (!stored && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true);
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // 7PM time-out reminder -- an in-page toast, not a real push
  // notification, so it only appears while this tab is open. Uses a
  // ref for todayLog because the interval below is set up once on
  // mount and would otherwise always see the stale (null) value from
  // that first render.
  const [showTimeOutReminder, setShowTimeOutReminder] = useState(false);
  const todayLogRef = useRef(todayLog);
  const timeOutReminderHourRef = useRef(timeOutReminderHour);
  const reminderDismissedRef = useRef(false);
  const soundPlayedRef = useRef(false);

  // Browsers (esp. Chrome) block audio from a freshly-created
  // AudioContext unless it was created/resumed directly inside a user
  // gesture (a click/tap). Our sounds get triggered from a timer and a
  // Realtime event -- neither counts as a gesture. The fix: create ONE
  // AudioContext and "unlock" it on the very first click/tap/keypress
  // anywhere on the page (which will already have happened long before
  // 7PM or an announcement update in normal use), then keep reusing
  // that same already-running context for every sound after that.
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const unlockAudio = () => {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
      }
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
    };

    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
    window.addEventListener('keydown', unlockAudio);

    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  useEffect(() => {
    todayLogRef.current = todayLog;
  }, [todayLog]);

  useEffect(() => {
    timeOutReminderHourRef.current = timeOutReminderHour;
  }, [timeOutReminderHour]);

  // Two-tone chime generated with the Web Audio API -- no audio file
  // needed. Browsers generally allow this once the person has already
  // interacted with the page at all (e.g. logging in, clicking
  // anything), which will already be true by 7PM in normal use.
  const playNotificationSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const now = ctx.currentTime;

      // A limiter/compressor so we can safely push the individual tone
      // volumes higher for a louder chime, without the peaks clipping
      // into harsh distortion the way a raw gain increase would.
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-14, now);
      compressor.knee.setValueAtTime(6, now);
      compressor.ratio.setValueAtTime(12, now);
      compressor.attack.setValueAtTime(0.003, now);
      compressor.release.setValueAtTime(0.15, now);
      compressor.connect(ctx.destination);

      const playTone = (_freq: number, _start: number, _duration: number, _peakVolume = 0.15) => {
        // reserved for future use
      };

      // Soft "pop" tone with a gentle downward pitch bend -- this is
      // what gives it that bubbly/bouncy Messenger-style feel instead
      // of a flat, robotic beep.
      const playPop = (startFreq: number, endFreq: number, start: number, duration: number, peakVolume = 0.7) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(startFreq, now + start);
        osc.frequency.exponentialRampToValueAtTime(endFreq, now + start + duration);
        gain.gain.setValueAtTime(0.0001, now + start);
        gain.gain.exponentialRampToValueAtTime(peakVolume, now + start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
        osc.connect(gain);
        gain.connect(compressor);
        osc.start(now + start);
        osc.stop(now + start + duration);
      };

      // Two soft ascending "bloop-bloop" pops, Messenger-style: the
      // second pop is higher-pitched than the first, each with a
      // slight downward glide for that bubbly character. Volumes go
      // through the compressor above, so pushing these past 1.0 makes
      // it louder without distorting.
      playPop(900, 700, 0, 0.28, 1.8);
      playPop(1300, 1000, 0.24, 0.4, 1.8);
    } catch (err) {
      console.error('Error playing notification sound:', err);
    }
  };

  const dismissReminder = () => {
    reminderDismissedRef.current = true;
    setShowTimeOutReminder(false);
  };
  const [message, setMessage] = useState('');
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');
  const [profile, setProfile] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [initLoading, setInitLoading] = useState(true);

  // Government ID numbers / employment details -- fetched from a
  // separate, more strictly-secured table. See add_government_ids.sql
  // and add_tin_and_hired_date.sql.
  const [governmentIds, setGovernmentIds] = useState<{ sss_number: string | null; philhealth_number: string | null; pagibig_number: string | null; tin_number: string | null; hired_date: string | null; employment_status: string | null } | null>(null);
  const [showGovIdsSection, setShowGovIdsSection] = useState(false);
  const [visibleFields, setVisibleFields] = useState<{ sss: boolean; philhealth: boolean; pagibig: boolean; tin: boolean }>({
    sss: false,
    philhealth: false,
    pagibig: false,
    tin: false,
  });

  // History filter (month picker, e.g. "2026-07:H1") -- defaults to the
  // current cutoff period so employees land on "this cutoff" instead of
  // their entire history.
  const [monthFilter, setMonthFilter] = useState(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const half = now.getDate() <= 15 ? 'H1' : 'H2';
    return `${ym}:${half}`;
  });

  // Collapsed by default so the dashboard opens short and uncluttered;
  // the employee taps to expand when they actually want to look at it.
  const [attendanceHistoryOpen, setAttendanceHistoryOpen] = useState(false);

  // Announcements
  const [announcement, setAnnouncement] = useState<string>('');
  const [announcementImageUrl, setAnnouncementImageUrl] = useState<string | null>(null);
  const [announcementLoading, setAnnouncementLoading] = useState(true);
  const [announcementError, setAnnouncementError] = useState<string | null>(null);
  const [announcementUpdatedAt, setAnnouncementUpdatedAt] = useState<string | null>(null);
  const [showAnnouncementToast, setShowAnnouncementToast] = useState(false);
  const [disputeResultToast, setDisputeResultToast] = useState<{ status: string; date: string; disputeType: string } | null>(null);

  // AI Weather & Commute Advisory
  // n8n writes the latest advisory to `weather_advisories`; employees only
  // read the latest active row. The weather provider/API key never needs to
  // be exposed in the browser.
  const [weatherAdvisory, setWeatherAdvisory] = useState<{
    id: string;
    location_name: string;
    advisory_date: string;
    headline: string;
    message: string;
    severity: 'normal' | 'info' | 'watch' | 'warning' | 'critical';
    temperature_c: number | null;
    precipitation_probability: number | null;
    weather_code: number | null;
    commute_window: string | null;
    source_name: string | null;
    generated_at: string;
  } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  // Manual Weather + Live Traffic route checker.
  const [commuteModalOpen, setCommuteModalOpen] = useState(false);
  const [commuteOrigin, setCommuteOrigin] = useState('');
  const [commuteDestination, setCommuteDestination] = useState('');
  const [commuteDepartureDate, setCommuteDepartureDate] = useState(() => getManilaDateTimeInputs().date);
  const [commuteDepartureTime, setCommuteDepartureTime] = useState(() => getManilaDateTimeInputs().time);
  const [commuteLoading, setCommuteLoading] = useState(false);
  const [commuteHasAttempted, setCommuteHasAttempted] = useState(false);
  const [showCommuteIncidents, setShowCommuteIncidents] = useState(false);
  const [commuteError, setCommuteError] = useState<string | null>(null);
  const [commuteResult, setCommuteResult] = useState<CommuteCheckResult | null>(null);
  const [commuteLanguage, setCommuteLanguage] = useState<'en' | 'tl'>('en');
  const [originSuggestions, setOriginSuggestions] = useState<AddressSuggestion[]>([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState<AddressSuggestion[]>([]);
  const [selectedOriginAddress, setSelectedOriginAddress] = useState<AddressSuggestion | null>(null);
  const [selectedDestinationAddress, setSelectedDestinationAddress] = useState<AddressSuggestion | null>(null);
  const [originSearchLoading, setOriginSearchLoading] = useState(false);
  const [destinationSearchLoading, setDestinationSearchLoading] = useState(false);
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false);
  const originSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destinationSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commuteAutoRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commuteRequestController = useRef<AbortController | null>(null);

  const fetchAddressSuggestions = async (
    query: string,
    kind: 'origin' | 'destination'
  ) => {
    const trimmed = query.trim();

    if (trimmed.length < 3) {
      if (kind === 'origin') {
        setOriginSuggestions([]);
        setOriginSearchLoading(false);
      } else {
        setDestinationSuggestions([]);
        setDestinationSearchLoading(false);
      }
      return;
    }

    if (kind === 'origin') {
      setOriginSearchLoading(true);
    } else {
      setDestinationSearchLoading(true);
    }

    try {
      const response = await fetch(
        `/api/address-search?q=${encodeURIComponent(trimmed)}`,
        { cache: 'no-store' }
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to search addresses.');
      }

      const rawResults = Array.isArray(payload?.results)
        ? payload.results
        : [];

      // Remove exact duplicate Photon results so React does not render
      // identical address cards with the same identity.
      const seen = new Set<string>();
      const results = rawResults.filter((place: AddressSuggestion) => {
        const key = [
          String(place?.id ?? ''),
          Number(place?.latitude ?? 0).toFixed(6),
          Number(place?.longitude ?? 0).toFixed(6),
          String(place?.address ?? '').trim().toLowerCase(),
        ].join('|');

        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (kind === 'origin') {
        setOriginSuggestions(results);
        setShowOriginSuggestions(true);
      } else {
        setDestinationSuggestions(results);
        setShowDestinationSuggestions(true);
      }
    } catch (error) {
      console.error('Address autocomplete error:', error);

      if (kind === 'origin') {
        setOriginSuggestions([]);
      } else {
        setDestinationSuggestions([]);
      }
    } finally {
      if (kind === 'origin') {
        setOriginSearchLoading(false);
      } else {
        setDestinationSearchLoading(false);
      }
    }
  };

  const scheduleAddressSearch = (
    query: string,
    kind: 'origin' | 'destination'
  ) => {
    const timer =
      kind === 'origin'
        ? originSearchTimer
        : destinationSearchTimer;

    if (timer.current) {
      clearTimeout(timer.current);
    }

    if (query.trim().length < 3) {
      if (kind === 'origin') {
        setOriginSuggestions([]);
        setShowOriginSuggestions(false);
      } else {
        setDestinationSuggestions([]);
        setShowDestinationSuggestions(false);
      }
      return;
    }

    timer.current = setTimeout(() => {
      fetchAddressSuggestions(query, kind);
    }, 350);
  };

  const selectAddressSuggestion = (
    suggestion: AddressSuggestion,
    kind: 'origin' | 'destination'
  ) => {
    // Keep the human-readable address for the input, but preserve the
    // selected Photon coordinates separately. The commute workflow will use
    // the coordinates directly instead of trying to geocode this text again.
    const exactAddress =
      suggestion.address ||
      [suggestion.name, suggestion.municipality].filter(Boolean).join(', ') ||
      suggestion.name;

    if (kind === 'origin') {
      setCommuteOrigin(exactAddress);
      setSelectedOriginAddress(suggestion);
      setOriginSuggestions([]);
      setShowOriginSuggestions(false);
    } else {
      setCommuteDestination(exactAddress);
      setSelectedDestinationAddress(suggestion);
      setDestinationSuggestions([]);
      setShowDestinationSuggestions(false);
    }
  };

  const fetchWeatherAdvisory = async () => {
    setWeatherLoading(true);
    try {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
      const { data, error } = await supabase
        .from('weather_advisories')
        .select('id, location_name, advisory_date, headline, message, severity, temperature_c, precipitation_probability, weather_code, commute_window, source_name, generated_at')
        .eq('is_active', true)
        .eq('advisory_date', today)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setWeatherAdvisory((data as any) ?? null);
    } catch (err) {
      console.error('Error fetching weather advisory:', err);
      setWeatherAdvisory(null);
    } finally {
      setWeatherLoading(false);
    }
  };

  const openCommuteChecker = () => {
    setCommuteError(null);
    setCommuteResult(null);
    setCommuteHasAttempted(false);
    const currentManila = getManilaDateTimeInputs();
    setCommuteDepartureDate(currentManila.date);
    setCommuteDepartureTime(currentManila.time);
    setOriginSuggestions([]);
    setDestinationSuggestions([]);
    setSelectedOriginAddress(null);
    setSelectedDestinationAddress(null);
    setShowOriginSuggestions(false);
    setShowDestinationSuggestions(false);
    setCommuteDestination((current) => current || weatherAdvisory?.location_name || 'Makati City');
    setCommuteModalOpen(true);
  };

  const useCurrentLocationForCommute = () => {
    if (!navigator.geolocation) {
      setCommuteError('Location access is not supported by this browser.');
      return;
    }
    setCommuteError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = Number(position.coords.latitude);
        const longitude = Number(position.coords.longitude);

        setCommuteOrigin(`${latitude.toFixed(6)},${longitude.toFixed(6)}`);
        setSelectedOriginAddress({
          id: `browser-geolocation-${latitude}-${longitude}`,
          name: 'Current location',
          address: `${latitude.toFixed(6)},${longitude.toFixed(6)}`,
          municipality: '',
          latitude,
          longitude,
          type: 'geolocation',
        });
        setOriginSuggestions([]);
        setShowOriginSuggestions(false);
      },
      () => setCommuteError('Unable to read your current location. You can type your starting place instead.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const checkCommuteRoute = async () => {
    setShowCommuteIncidents(false);
    if (!commuteOrigin.trim() || !commuteDestination.trim()) {
      setCommuteError('Enter both From and To locations.');
      return;
    }
    commuteRequestController.current?.abort();
    const controller = new AbortController();
    commuteRequestController.current = controller;
    setCommuteLoading(true);
    setCommuteHasAttempted(true);
    setCommuteError(null);
    try {
      const requestedDeparture = new Date(
        `${commuteDepartureDate}T${commuteDepartureTime}:00+08:00`
      );
      const response = await fetch('/api/commute-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          origin: commuteOrigin.trim(),
          destination: commuteDestination.trim(),
          language: commuteLanguage,
          requested_departure_at: Number.isFinite(requestedDeparture.getTime())
            ? requestedDeparture.toISOString()
            : null,
          advice_options: ['route_weather', 'rain_risk', 'traffic_delays', 'best_departure'],
          origin_position: selectedOriginAddress
            ? {
                lat: selectedOriginAddress.latitude,
                lon: selectedOriginAddress.longitude,
              }
            : null,
          destination_position: selectedDestinationAddress
            ? {
                lat: selectedDestinationAddress.latitude,
                lon: selectedDestinationAddress.longitude,
              }
            : null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Unable to check this route.');
      if (!payload?.success || (!payload?.route && !payload?.weather) || !payload?.origin || !payload?.destination) {
        throw new Error(payload?.error || 'The commute service returned an incomplete response.');
      }
      setCommuteResult(payload as CommuteCheckResult);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setCommuteError(err?.message || 'Unable to check this route.');
    } finally {
      if (commuteRequestController.current === controller) {
        setCommuteLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!commuteModalOpen) return;
    if (commuteOrigin.trim().length < 3 || commuteDestination.trim().length < 3) return;
    if (!commuteDepartureDate || !commuteDepartureTime) return;

    if (commuteAutoRefreshTimer.current) {
      clearTimeout(commuteAutoRefreshTimer.current);
    }

    commuteAutoRefreshTimer.current = setTimeout(() => {
      checkCommuteRoute();
    }, 900);

    return () => {
      if (commuteAutoRefreshTimer.current) {
        clearTimeout(commuteAutoRefreshTimer.current);
      }
    };
    // Route checks are intentionally debounced from these user-controlled fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    commuteModalOpen,
    commuteOrigin,
    commuteDestination,
    commuteDepartureDate,
    commuteDepartureTime,
    commuteLanguage,
    selectedOriginAddress?.id,
    selectedDestinationAddress?.id,
  ]);

  const formatCommuteMinutes = (minutes: number | null | undefined) => {
    const value = Number(minutes ?? 0);
    return `${Math.max(0, Math.round(value))} min`;
  };

  const formatCommuteDistance = (kilometers: number | null | undefined) => {
    const value = Number(kilometers ?? 0);
    return `${value.toFixed(value >= 10 ? 0 : 1)} km`;
  };

  const formatCommuteClock = (isoValue: string | null | undefined) => {
    return formatManilaClockValue(isoValue);
  };

  const formatCommuteUpdatedAt = (isoValue: string | null | undefined) => {
    if (!isoValue) return '--';
    const date = new Date(isoValue);
    if (!Number.isFinite(date.getTime())) return '--';
    return date.toLocaleTimeString('en-PH', {
      timeZone: 'Asia/Manila',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const shortCommutePlace = (value: string | null | undefined, fallback: string) => {
    const firstPart = String(value || '').split(',')[0]?.trim();
    return firstPart || fallback;
  };

  const getCommuteWeatherHighlight = (weather: CommuteCheckResult['weather']) => {
    const rain = Number(weather?.rain_probability ?? 0);
    const feels = Number(weather?.apparent_temperature_c ?? weather?.temperature_c ?? 0);
    const wind = Number(weather?.wind_speed_kmh ?? 0);
    const alertActive = weather?.rain_alert?.active === true || rain >= 50;

    if (alertActive && rain >= 85) {
      return {
        label: 'Very likely rain',
        icon: '⛈️',
        card: 'bg-red-50 border-red-200',
        badge: 'bg-red-600 text-white',
        text: 'text-red-950',
        accent: 'bg-red-500',
      };
    }

    if (alertActive && rain >= 70) {
      return {
        label: 'Rain likely',
        icon: '🌧️',
        card: 'bg-orange-50 border-orange-200',
        badge: 'bg-orange-500 text-white',
        text: 'text-orange-950',
        accent: 'bg-orange-500',
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

  const formatWeatherBucketTime = (value?: string | null) => {
    if (!value) return 'Latest available';
    const time = String(value).match(/T(\d{2}):(\d{2})/);
    if (!time) return value;
    const hour = Number(time[1]);
    const minute = time[2];
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minute} ${hour >= 12 ? 'PM' : 'AM'}`;
  };

  const formatRainAmount = (value?: number | null) => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '—';
    return `${amount < 10 ? amount.toFixed(1) : Math.round(amount)} mm`;
  };

  const getTrafficLevelStyle = (level?: string | null) => {
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


  // Office network check -- Time In is only enabled when the request is
  // coming from the office's known public IP. See
  // app/api/check-office-network/route.ts for how this is determined.
  const [officeNetworkAllowed, setOfficeNetworkAllowed] = useState<boolean | null>(null);
  const [checkingNetwork, setCheckingNetwork] = useState(true);
  const [officeNetworkIssue, setOfficeNetworkIssue] = useState<'outside' | 'unavailable' | null>(null);

  const checkOfficeNetwork = async () => {
    setCheckingNetwork(true);
    setOfficeNetworkIssue(null);
    try {
      const res = await fetch('/api/check-office-network', { cache: 'no-store' });
      const result = await res.json();
      if (result.allowed) {
        setOfficeNetworkAllowed(true);
        setOfficeNetworkIssue(null);
      } else {
        setOfficeNetworkAllowed(false);
        setOfficeNetworkIssue(
          result.code === 'ATTENDANCE_NETWORK_UNAVAILABLE' || res.status === 503
            ? 'unavailable'
            : 'outside'
        );
      }
    } catch (err) {
      console.error('Error checking office network:', err);
      // Fail closed when the network cannot be verified. Only attendance
      // recording is disabled; the rest of the employee portal stays usable.
      setOfficeNetworkAllowed(false);
      setOfficeNetworkIssue('unavailable');
    } finally {
      setCheckingNetwork(false);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-GB', { hour12: false }));
      setDate(now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));

      // Check Philippine time specifically (not the device's local
      // time) so the reminder is correct regardless of how the
      // employee's device clock/timezone is set.
      const manilaHour = parseInt(
        new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', hour12: false }).format(now),
        10
      );

      if (
        manilaHour >= timeOutReminderHourRef.current &&
        todayLogRef.current?.time_in &&
        !todayLogRef.current?.time_out &&
        !reminderDismissedRef.current
      ) {
        if (!soundPlayedRef.current) {
          playNotificationSound();
          soundPlayedRef.current = true;
        }
        setShowTimeOutReminder(true);
      }
    }, 1000);

    const runStartupSweeps = async () => {
      // Catch-up sweeps, run once per login/page load, before pulling
      // attendance history or the leave credit balance -- so anything they
      // generate (a fresh 'Absent' row for a day with no time-in, a
      // newly-deducted leave credit) is already reflected in what loads
      // right after.
      const [{ error: leaveSweepError }, { error: absenceSweepError }] = await Promise.all([
        supabase.rpc('settle_overdue_leave_days'),
        supabase.rpc('settle_overdue_absences'),
      ]);
      if (leaveSweepError) console.error('Error settling overdue leave days:', leaveSweepError);
      if (absenceSweepError) console.error('Error settling overdue absences:', absenceSweepError);

      initializeDashboard();
      fetchLeaveCredits();
    };
    runStartupSweeps();
    fetchAppSettings();
    fetchAnnouncement();
    fetchWeatherAdvisory();
    checkOfficeNetwork();
    fetchMyDisputes();
    fetchPayslips();
    fetchMyLeaves();
    fetchCompanyHolidays();
    fetchSupportRequests();
    fetchEmployeeDocuments();
    return () => clearInterval(timer);
  }, []);

  // Live announcement updates -- listens for INSERT/UPDATE on the
  // announcements table via Supabase Realtime, so a new/edited
  // announcement from HR shows up (with a sound + toast) immediately,
  // without the employee needing to refresh the page. Requires Realtime
  // to be enabled for this table (see enable_announcements_realtime.sql).
  useEffect(() => {
    const channel = supabase
      .channel('employee-announcements')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcements' },
        (payload) => {
          if (payload.eventType === 'DELETE') return;

          const newRow = payload.new as { content?: string; image_url?: string; updated_at?: string };
          setAnnouncement(newRow.content || '');
          setAnnouncementImageUrl(newRow.image_url || null);
          setAnnouncementError(null);
          setAnnouncementUpdatedAt(
            newRow.updated_at
              ? new Date(newRow.updated_at).toLocaleString('en-US', {
                  timeZone: 'Asia/Manila',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : null
          );

          playNotificationSound();
          setShowAnnouncementToast(true);
          setTimeout(() => setShowAnnouncementToast(false), 6000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Live dispute + leave status updates via Supabase Realtime.
  // Runs only once currentUserId is known (set during initializeDashboard),
  // so .on() and .subscribe() are always called synchronously — no async gap.
  useEffect(() => {
    if (!currentUserId) return;

    const disputeChannel = supabase
      .channel('employee-dispute-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'attendance_disputes', filter: `user_id=eq.${currentUserId}` },
        (payload) => {
          const newRow = payload.new as { status?: string; dispute_date?: string; dispute_type?: string };
          if (newRow.status === 'Approved' || newRow.status === 'Rejected') {
            setDisputeResultToast({ status: newRow.status, date: newRow.dispute_date || '', disputeType: newRow.dispute_type || 'TimeIn' });
            playNotificationSound();
            fetchMyDisputes();
            initializeDashboard();
            setTimeout(() => setDisputeResultToast(null), 8000);
          }
        }
      )
      .subscribe();

    const leaveChannel = supabase
      .channel('employee-leave-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'leave_requests', filter: `user_id=eq.${currentUserId}` },
        (payload) => {
          const newRow = payload.new as { status?: string; leave_type?: string };
          if (newRow.status === 'Approved' || newRow.status === 'Rejected') {
            setLeaveResultToast({ status: newRow.status, leave_type: newRow.leave_type || 'Leave' });
            playNotificationSound();
            fetchMyLeaves();
            fetchLeaveCredits();
            setTimeout(() => setLeaveResultToast(null), 8000);
          }
        }
      )
      .subscribe();

    const supportChannel = supabase
      .channel('employee-support-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'employee_support_requests', filter: `user_id=eq.${currentUserId}` },
        () => {
          fetchSupportRequests();
          playNotificationSound();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(disputeChannel);
      supabase.removeChannel(leaveChannel);
      supabase.removeChannel(supportChannel);
    };
  }, [currentUserId]);

  // Weather advisories are generated by n8n, but the Employee Dashboard
  // updates immediately when n8n inserts/updates today's row.
  useEffect(() => {
    const channel = supabase
      .channel('employee-weather-advisories')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'weather_advisories' },
        () => fetchWeatherAdvisory()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const initializeDashboard = async () => {
    setInitLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setInitLoading(false);
      return;
    }
    setCurrentUserId(user.id);

    // Use the Manila calendar date, not the browser's local/UTC date --
    // otherwise an employee whose device is set to a timezone behind
    // UTC could see the wrong "today" near midnight.
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, employee_id, designation, role, avatar_url')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      setMessage('Error: ' + profileError.message);
    }

    setProfile(profileData);

    // Government IDs live in a separate table with its own RLS -- if
    // no row exists yet (admin hasn't entered these for the employee),
    // this just comes back null and the section shows "Not set".
    const { data: govIdData, error: govIdError } = await supabase
      .from('employee_government_ids')
      .select('sss_number, philhealth_number, pagibig_number, tin_number, hired_date, employment_status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (govIdError) {
      console.error('Error fetching government IDs:', govIdError);
    }
    setGovernmentIds(govIdData ?? null);

    const { data: historyData, error: historyError } = await supabase
      .from('attendance_logs')
      .select('id, log_date, time_in, time_out, status')
      .eq('user_id', user.id)
      .order('log_date', { ascending: false });

    if (historyError) {
      console.error('Error fetching history:', historyError);
      setMessage('Error: ' + historyError.message);
    }

    setHistory(historyData || []);
    const foundTodayLog = historyData?.find(log => log.log_date === today);
    setTodayLog(foundTodayLog ?? null);
    setInitLoading(false);
  };

  // Fetches the latest announcement straight from Supabase. RLS on the
  // `announcements` table should allow SELECT to any authenticated user
  // but only allow INSERT/UPDATE from admin/super_admin roles (see the
  // SQL setup notes shared alongside this file).
  const fetchAnnouncement = async () => {
    setAnnouncementLoading(true);
    setAnnouncementError(null);
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('content, image_url, updated_at')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      setAnnouncement(data?.content || '');
      setAnnouncementImageUrl(data?.image_url || null);
      setAnnouncementUpdatedAt(
        data?.updated_at
          ? new Date(data.updated_at).toLocaleString('en-US', {
              timeZone: 'Asia/Manila',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : null
      );
    } catch (err: any) {
      console.error('Error fetching announcement:', err);
      setAnnouncementError('Failed to load the announcement right now.');
    } finally {
      setAnnouncementLoading(false);
    }
  };

  const handleTimeIn = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/time-in', { method: 'POST' });
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Failed to record time-in.');
      }

      setMessage(
        result.status === 'Late'
          ? 'Time in recorded, but you are marked as late today.'
          : 'Success! Attendance recorded.'
      );
      await initializeDashboard();
    } catch (err: any) {
      setMessage("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Called when the employee clicks Time Out.
  // If it's before 7PM Manila time, show a warning first.
  const handleTimeOutClick = () => {
    const now = new Date();
    const manilaHour = parseInt(
      new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', hour12: false }).format(now),
      10
    );
    if (manilaHour < timeOutReminderHour) {
      setShowEarlyTimeOutWarning(true);
    } else {
      handleTimeOut();
    }
  };

  const handleTimeOut = async () => {
    setTimeOutLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/time-out', { method: 'POST' });
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Failed to record time-out.');
      }

      setMessage('Time out recorded. See you tomorrow!');
      setShowTimeOutReminder(false);
      await initializeDashboard();
    } catch (err: any) {
      setMessage("Error: " + err.message);
    } finally {
      setTimeOutLoading(false);
    }
  };

  // Type-specific leave statuses (e.g. "Sick Leave", "Vacation Leave",
  // "Emergency Leave") all get the same tag styling as the old generic
  // "Leave" status -- match by substring instead of exact equality.
  const statusTagClass = (s: string | null) => {
    const v = s?.toLowerCase() ?? '';
    if (v === 'late') return 'tag-late';
    if (v === 'absent') return 'tag-absent';
    if (v.includes('leave')) return 'tag-leave';
    return 'tag-present';
  };

  // --- Early time-out warning (before 7PM) ---
  const [showEarlyTimeOutWarning, setShowEarlyTimeOutWarning] = useState(false);

  // --- Employee Directory ---
  // Read-only list of colleagues -- employees only (no HR admins or
  // super-admins), showing name, designation, photo, and email so an
  // employee can look someone up. Pulls straight from `profiles`; the
  // government-ID table (SSS/PhilHealth/etc.) is a separate, more
  // strictly-secured table and is never touched here.
  const [directoryModalOpen, setDirectoryModalOpen] = useState(false);
  const [directoryEmployees, setDirectoryEmployees] = useState<{ id: string; full_name: string | null; designation: string | null; avatar_url: string | null; employee_email: string | null }[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [directorySearch, setDirectorySearch] = useState('');

  const fetchDirectory = async () => {
    setDirectoryLoading(true);
    // NOTE: this selects OTHER employees' basic profile info, not just the
    // logged-in user's own row -- make sure the `profiles` table's RLS
    // has a SELECT policy that lets any authenticated user read these
    // columns (full_name, designation, avatar_url, employee_email, role)
    // for all rows, e.g.:
    //   create policy "Employees can view the directory"
    //   on profiles for select
    //   to authenticated
    //   using (true);
    // (Sensitive fields like SSS/PhilHealth/TIN live in
    // employee_government_ids, a separate table, and are unaffected.)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, designation, avatar_url, employee_email, role')
      // Employees only -- HR admins and the super-admin account don't
      // belong in a colleague directory.
      .eq('role', 'employee')
      .order('full_name', { ascending: true });

    if (error) {
      console.error('Error fetching directory:', error);
      setDirectoryLoading(false);
      return;
    }
    setDirectoryEmployees(data || []);
    setDirectoryLoading(false);
  };

  // --- Company Calendar (Holidays) ---
  // Read-only view of the holidays HR has set up (the same `holidays`
  // table Super Admin manages). NOTE: like the Directory above, this
  // selects rows the logged-in employee doesn't own, so `holidays` needs
  // a SELECT policy allowing any authenticated user to read it, e.g.:
  //   create policy "Employees can view holidays"
  //   on holidays for select
  //   to authenticated
  //   using (true);
  const [companyHolidays, setCompanyHolidays] = useState<{ id: string; holiday_date: string; name: string }[]>([]);
  const [holidaysLoading, setHolidaysLoading] = useState(true);
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);

  const fetchCompanyHolidays = async () => {
    setHolidaysLoading(true);
    const { data, error } = await supabase
      .from('holidays')
      .select('id, holiday_date, name')
      .order('holiday_date', { ascending: true });

    if (error) {
      console.error('Error fetching holidays:', error);
      setHolidaysLoading(false);
      return;
    }
    setCompanyHolidays(data || []);
    setHolidaysLoading(false);
  };

  const directoryInitials = (name: string | null) =>
    (name || '?')
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  const filteredDirectory = useMemo(() => {
    const q = directorySearch.trim().toLowerCase();
    if (!q) return directoryEmployees;
    return directoryEmployees.filter((e) =>
      e.full_name?.toLowerCase().includes(q) ||
      e.designation?.toLowerCase().includes(q)
    );
  }, [directoryEmployees, directorySearch]);

  // --- Payslips modal ---
  const [payslipsModalOpen, setPayslipsModalOpen] = useState(false);
  const [payslips, setPayslips] = useState<{ id: string; cutoff_label: string; cutoff_period: string; file_name: string; file_path: string; uploaded_at: string; published_at: string | null; acknowledged_at: string | null }[]>([]);
  const [payslipsLoading, setPayslipsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [acknowledgingPayslipId, setAcknowledgingPayslipId] = useState<string | null>(null);

  const fetchPayslips = async () => {
    setPayslipsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPayslipsLoading(false); return; }
    const { data, error } = await supabase
      .from('payslips')
      .select('id, cutoff_label, cutoff_period, file_name, file_path, uploaded_at, published_at, acknowledged_at')
      .eq('user_id', user.id)
      .eq('published', true)
      .order('uploaded_at', { ascending: false });
    if (error) console.error('Error fetching payslips:', error);
    setPayslips((data || []) as typeof payslips);
    setPayslipsLoading(false);
  };

  const acknowledgePayslip = async (payslipId: string) => {
    setAcknowledgingPayslipId(payslipId);
    const acknowledgedAt = new Date().toISOString();
    const { error } = await supabase.rpc('acknowledge_my_payslip', {
      p_payslip_id: payslipId,
    });
    if (error) {
      alert('Unable to acknowledge this payslip: ' + error.message);
    } else {
      setPayslips((current) => current.map((p) => p.id === payslipId ? { ...p, acknowledged_at: acknowledgedAt } : p));
    }
    setAcknowledgingPayslipId(null);
  };

  const downloadPayslip = async (payslip: { id: string; file_path: string; file_name: string }) => {
    setDownloadingId(payslip.id);
    try {
      const { data, error } = await supabase.storage
        .from('payslips')
        .download(payslip.file_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = payslip.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Error downloading payslip:', err);
      alert('Failed to download payslip: ' + err.message);
    } finally {
      setDownloadingId(null);
    }
  };

  // --- Help Desk / HR Requests ---
  type SupportRequest = {
    id: string;
    category: string;
    subject: string;
    description: string;
    status: 'Submitted' | 'In Progress' | 'Resolved';
    hr_notes: string | null;
    created_at: string;
    updated_at: string;
  };
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([]);
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportSaving, setSupportSaving] = useState(false);
  const [supportMessage, setSupportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [supportForm, setSupportForm] = useState({ category: 'IT Concern', subject: '', description: '' });

  const fetchSupportRequests = async () => {
    setSupportLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSupportLoading(false); return; }
    const { data, error } = await supabase
      .from('employee_support_requests')
      .select('id, category, subject, description, status, hr_notes, created_at, updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) console.error('Error fetching support requests:', error);
    setSupportRequests((data || []) as SupportRequest[]);
    setSupportLoading(false);
  };

  const submitSupportRequest = async () => {
    if (!supportForm.subject.trim() || !supportForm.description.trim()) {
      setSupportMessage({ type: 'error', text: 'Please enter a subject and description.' });
      return;
    }
    setSupportSaving(true);
    setSupportMessage(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSupportMessage({ type: 'error', text: 'You are not logged in.' });
      setSupportSaving(false);
      return;
    }
    const { error } = await supabase.from('employee_support_requests').insert([{
      user_id: user.id,
      category: supportForm.category,
      subject: supportForm.subject.trim(),
      description: supportForm.description.trim(),
    }]);
    if (error) {
      setSupportMessage({ type: 'error', text: error.message });
    } else {
      setSupportMessage({ type: 'success', text: 'Request submitted. HR or IT can now review it.' });
      setSupportForm({ category: 'IT Concern', subject: '', description: '' });
      await fetchSupportRequests();
    }
    setSupportSaving(false);
  };

  // --- Employee Documents ---
  type EmployeeDocument = {
    id: string;
    title: string;
    category: string;
    file_name: string;
    file_path: string;
    published_at: string;
  };
  const [documentsModalOpen, setDocumentsModalOpen] = useState(false);
  const [employeeDocuments, setEmployeeDocuments] = useState<EmployeeDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [downloadingDocumentId, setDownloadingDocumentId] = useState<string | null>(null);

  const fetchEmployeeDocuments = async () => {
    setDocumentsLoading(true);
    const { data, error } = await supabase
      .from('employee_documents')
      .select('id, title, category, file_name, file_path, published_at')
      .eq('is_active', true)
      .order('published_at', { ascending: false });
    if (error) console.error('Error fetching employee documents:', error);
    setEmployeeDocuments((data || []) as EmployeeDocument[]);
    setDocumentsLoading(false);
  };

  const downloadEmployeeDocument = async (document: EmployeeDocument) => {
    setDownloadingDocumentId(document.id);
    const { data, error } = await supabase.storage
      .from('employee-documents')
      .download(document.file_path);
    if (error) {
      alert('Unable to download this document: ' + error.message);
    } else {
      const url = URL.createObjectURL(data);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = document.file_name;
      anchor.click();
      URL.revokeObjectURL(url);
    }
    setDownloadingDocumentId(null);
  };

  // --- Leave Requests ---
  const [myLeaves, setMyLeaves] = useState<any[]>([]);
  const [myLeavesModalOpen, setMyLeavesModalOpen] = useState(false);
  const [leaveCredits, setLeaveCredits] = useState<{ total_credits: number; used_credits: number } | null>(null);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  // Single "Leave" quick action opens this small choice screen first --
  // "Request Leave" or "My Leave Requests" -- instead of two separate
  // buttons on the dashboard.
  const [leaveChoiceModalOpen, setLeaveChoiceModalOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ leave_type: 'Sick', start_date: '', end_date: '', reason: '' });
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [leaveMsg, setLeaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [leaveResultToast, setLeaveResultToast] = useState<{ status: string; leave_type: string } | null>(null);
  // Which leave request is currently expanded into the detail view inside
  // the "My Leave Requests" modal (null = showing the list).
  const [selectedMyLeaveDetail, setSelectedMyLeaveDetail] = useState<any>(null);
  const isRegular = governmentIds?.employment_status === 'Regular';
  // Configurable default (Super Admin -> App Settings) -- matches the
  // DB column default and the fallback used server-side in
  // settle_leave_day() when a leave_credits row doesn't exist yet for
  // the employee/year.
  const remainingCredits = leaveCredits ? leaveCredits.total_credits - leaveCredits.used_credits : fallbackLeaveCredits;

  const fetchMyLeaves = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from('leave_requests')
      .select('id, leave_type, start_date, end_date, reason, status, hr_notes, created_at, reviewed_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) { console.error('Error fetching leaves:', error); return; }
    setMyLeaves(data || []);
  };

  const fetchLeaveCredits = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const year = new Date().getFullYear();
    const { data } = await supabase
      .from('leave_credits')
      .select('total_credits, used_credits')
      .eq('user_id', user.id)
      .eq('year', year)
      .maybeSingle();
    setLeaveCredits(data ?? null);
  };

  const submitLeave = async () => {
    if (!leaveForm.start_date || !leaveForm.end_date) {
      setLeaveMsg({ type: 'error', text: 'Please fill in the start and end date.' });
      return;
    }
    if (leaveForm.end_date < leaveForm.start_date) {
      setLeaveMsg({ type: 'error', text: 'End date cannot be before start date.' });
      return;
    }
    setLeaveSaving(true);
    setLeaveMsg(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You are not logged in.');
      const { error } = await supabase.from('leave_requests').insert([{
        user_id: user.id,
        leave_type: leaveForm.leave_type,
        start_date: leaveForm.start_date,
        end_date: leaveForm.end_date,
        reason: leaveForm.reason.trim() || null,
      }]);
      if (error) throw error;
      setLeaveMsg({ type: 'success', text: 'Leave request submitted! HR will review it soon.' });
      await fetchMyLeaves();
      setTimeout(() => setLeaveModalOpen(false), 1200);
    } catch (err: any) {
      console.error('Error submitting leave:', err);
      setLeaveMsg({ type: 'error', text: err?.message || 'Failed to submit leave request.' });
    } finally {
      setLeaveSaving(false);
    }
  };

  const cancelLeave = async (leaveId: string) => {
    if (!confirm('Cancel this leave request?')) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { alert('You are not logged in.'); return; }
    const { error } = await supabase
      .from('leave_requests')
      .delete()
      .eq('id', leaveId)
      .eq('user_id', user.id)
      .eq('status', 'Pending');
    if (error) { alert('Failed to cancel: ' + error.message); return; }
    await fetchMyLeaves();
  };

  const companyHolidayDateSet = useMemo(
    () => new Set(companyHolidays.map((holiday) => holiday.holiday_date)),
    [companyHolidays]
  );

  // Count chargeable leave days: Monday-Friday, excluding company holidays.
  const countLeaveDays = (start: string, end: string) => {
    if (!start || !end || end < start) return 0;
    let count = 0;
    const [sy, sm, sd] = start.split('-').map(Number);
    const [ey, em, ed] = end.split('-').map(Number);
    const d = new Date(Date.UTC(sy, sm - 1, sd));
    const endDate = new Date(Date.UTC(ey, em - 1, ed));
    while (d <= endDate) {
      const day = d.getUTCDay();
      const dateKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      if (day !== 0 && day !== 6 && !companyHolidayDateSet.has(dateKey)) count++;
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return count;
  };

  const countLeaveHolidays = (start: string, end: string) => {
    if (!start || !end || end < start) return 0;
    return companyHolidays.filter((holiday) => holiday.holiday_date >= start && holiday.holiday_date <= end).length;
  };

  // --- Attendance Disputes ---
  // Employees can dispute a day tagged "Late" (claiming they actually
  // arrived earlier), a day with no time-in at all (they forgot to time
  // in), or a day where they timed in but forgot to time out. All three
  // go through the same request table; HR approves/rejects.
  const [myDisputes, setMyDisputes] = useState<any[]>([]);
  const [myDisputesModalOpen, setMyDisputesModalOpen] = useState(false);
  // Which dispute is currently expanded into the detail view inside the
  // "My Disputes" modal (null = showing the list).
  const [selectedMyDisputeDetail, setSelectedMyDisputeDetail] = useState<any>(null);
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  // Three-step flow:
  // "choice"  -> pick Time In or Time Out dispute (only shown when the
  //              modal was opened generically, i.e. type isn't locked yet)
  // "form"    -> fill in date / time / reason
  // "confirm" -> review everything highlighted before actually submitting
  const [disputeStep, setDisputeStep] = useState<'choice' | 'form' | 'confirm'>('form');
  const [disputeForm, setDisputeForm] = useState<{ attendanceLogId: string | null; date: string; timeLocal: string; reason: string; type: 'TimeIn' | 'TimeOut' }>({
    attendanceLogId: null,
    date: '',
    timeLocal: '',
    reason: '',
    type: 'TimeIn',
  });
  const [disputeSaving, setDisputeSaving] = useState(false);
  const [cancelingDisputeId, setCancelingDisputeId] = useState<string | null>(null);
  const [disputeMsg, setDisputeMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchMyDisputes = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from('attendance_disputes')
      .select('id, attendance_log_id, dispute_date, dispute_type, claimed_time_in, original_time_in, claimed_time_out, original_time_out, reason, status, hr_notes, created_at, reviewed_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching disputes:', error);
      return;
    }
    setMyDisputes(data || []);
  };

  const cancelDispute = async (disputeId: string) => {
    if (!confirm('Cancel this pending attendance dispute?')) return;
    setCancelingDisputeId(disputeId);
    try {
      const { error } = await supabase.rpc('cancel_my_attendance_dispute', { p_dispute_id: disputeId });
      if (error) throw error;
      setMyDisputes((current) => current.filter((dispute) => dispute.id !== disputeId));
      setSelectedMyDisputeDetail(null);
      await fetchMyDisputes();
    } catch (error: any) {
      alert('Failed to cancel dispute: ' + (error?.message || 'Please try again.'));
    } finally {
      setCancelingDisputeId(null);
    }
  };

  // Opens the dispute modal. If a log already exists for that day
  // (disputing a wrong "Late" tag, or a missed time-out), pass it in;
  // otherwise leave it null (the "I forgot to time in" case) and just
  // prefill the date. `type` controls which field (time-in or time-out)
  // is being disputed. `locked` = true means this was opened from a
  // specific row (Late tag / missed time-out link) and the type can't
  // be switched; false means it was opened from the generic
  // "+ Missed time-in / time-out" action and the employee can toggle
  // between the two.
  const openDisputeModal = (attendanceLogId: string | null, date: string, type: 'TimeIn' | 'TimeOut' = 'TimeIn', locked: boolean = true) => {
    disputeTypeLocked.current = locked;
    setDisputeForm({ attendanceLogId, date, timeLocal: '', reason: '', type });
    setDisputeMsg(null);
    // Locked (opened from a specific row -- type already known): skip
    // straight to the form. Unlocked (generic "+ Missed time-in /
    // time-out" action): make the employee choose the type first.
    setDisputeStep(locked ? 'form' : 'choice');
    setDisputeModalOpen(true);
  };

  const hasPendingDispute = (dateStr: string, type: 'TimeIn' | 'TimeOut') =>
    myDisputes.some((d) => d.dispute_date === dateStr && d.status === 'Pending' && (d.dispute_type || 'TimeIn') === type);

  // Human-friendly label + before/after times for a dispute, regardless
  // of whether it's a TimeIn or TimeOut dispute -- shared by the "My
  // Disputes" list and its detail view.
  const disputeTypeLabel = (d: any) => {
    const dType = d.dispute_type || 'TimeIn';
    if (dType === 'TimeOut') return 'Missed time-out';
    return d.attendance_log_id ? 'Late tag dispute' : 'Missed time-in';
  };
  const disputeOriginal = (d: any) => ((d.dispute_type || 'TimeIn') === 'TimeOut' ? d.original_time_out : d.original_time_in);
  const disputeClaimed = (d: any) => ((d.dispute_type || 'TimeIn') === 'TimeOut' ? d.claimed_time_out : d.claimed_time_in);
  const disputeFieldLabel = (d: any) => ((d.dispute_type || 'TimeIn') === 'TimeOut' ? 'Time-Out' : 'Time-In');
  const formatDisputeTimePh = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' });

  // Whether the currently-open dispute modal was launched from a
  // specific row (Late tag / missed time-out link -- type is fixed) or
  // from the generic "Dispute" action, where the employee picks the
  // type themselves on the "choice" screen (type is toggleable). When
  // toggleable, both a date change and a type change re-look-up that
  // day's log from already-loaded history and attach its id when one
  // applies -- e.g. correcting an existing "Late" log's time-in, or
  // adding a missing time-out to a day that already has a time-in.
  const disputeTypeLocked = useRef(true);

  // Given a target date + dispute type, figures out which existing
  // attendance_logs row (if any) this dispute should be tied to.
  // - TimeOut: only makes sense if that date's log already has a
  //   time-in on record (nothing to attach a missed time-out to
  //   otherwise).
  // - TimeIn: if a log already exists for that date (e.g. tagged
  //   "Late"), we're correcting it; otherwise this is a brand-new
  //   missed time-in entry (attendanceLogId stays null, which the
  //   dispute-approval flow treats as "create a new log").
  const resolveDisputeLogId = (dateStr: string, type: 'TimeIn' | 'TimeOut') => {
    if (!dateStr) return null;
    const match = history.find((h) => h.log_date === dateStr);
    if (type === 'TimeOut') return match?.time_in ? match.id : null;
    return match?.id ?? null;
  };

  const handleDisputeDateChange = (newDate: string) => {
    if (disputeTypeLocked.current) {
      setDisputeForm((f) => ({ ...f, date: newDate }));
      return;
    }
    setDisputeForm((f) => ({ ...f, date: newDate, attendanceLogId: resolveDisputeLogId(newDate, f.type) }));
  };

  // Only ever called from the toggleable (non-locked) modal.
  const handleDisputeTypeChange = (type: 'TimeIn' | 'TimeOut') => {
    setDisputeForm((f) => ({ ...f, type, attendanceLogId: resolveDisputeLogId(f.date, type) }));
  };

  // Called from the "choice" step -- sets the chosen type (reusing the
  // same lookup logic as handleDisputeTypeChange) then advances to the
  // form step where the employee fills in date/time/reason.
  const selectDisputeType = (type: 'TimeIn' | 'TimeOut') => {
    handleDisputeTypeChange(type);
    setDisputeMsg(null);
    setDisputeStep('form');
  };

  // Same cutoffs used everywhere else in this file (configurable late
  // cutoff, configurable time-out cutoff -- Super Admin -> App
  // Settings) -- used here to decide whether each option on the
  // "choice" screen is actually worth disputing.
  const isTimeInOnTime = (timeInIso: string) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date(timeInIso)).reduce((acc: any, p) => { acc[p.type] = p.value; return acc; }, {});
    const minutesSinceMidnight = parseInt(parts.hour, 10) * 60 + parseInt(parts.minute, 10);
    return minutesSinceMidnight < lateCutoffHour * 60 + lateCutoffMinute;
  };

  const isTimeOutComplete = (timeOutIso: string) => {
    const manilaHour = parseInt(
      new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', hour12: false }).format(new Date(timeOutIso)),
      10
    );
    return manilaHour >= timeOutReminderHour;
  };

  // Whether each dispute type is actually worth offering on the "choice"
  // screen for the date currently selected. If no date is chosen yet
  // (e.g. opened via the generic top button before the form is filled
  // in), both stay enabled -- there's nothing to check against yet.
  const disputeChoiceEligibility = useMemo(() => {
    if (!disputeForm.date) {
      return {
        timeIn: { eligible: true, reason: '' },
        timeOut: { eligible: true, reason: '' },
      };
    }
    const match = history.find((h) => h.log_date === disputeForm.date);

    const timeIn = match?.time_in && isTimeInOnTime(match.time_in)
      ? { eligible: false, reason: 'Already on time -- nothing to dispute.' }
      : { eligible: true, reason: '' };

    const timeOut = !match?.time_in
      ? { eligible: false, reason: 'No time-in recorded yet for this date.' }
      : match?.time_out && isTimeOutComplete(match.time_out)
        ? { eligible: false, reason: 'Already timed out -- nothing to dispute.' }
        : { eligible: true, reason: '' };

    return { timeIn, timeOut };
  }, [disputeForm.date, history, lateCutoffHour, lateCutoffMinute, timeOutReminderHour]);

  // Validates the form and, if everything checks out, moves to the
  // highlighted review/confirm screen instead of submitting right away.
  const proceedToDisputeConfirm = () => {
    if (!disputeForm.date || !disputeForm.timeLocal) {
      setDisputeMsg({ type: 'error', text: disputeForm.type === 'TimeOut' ? 'Please fill in the date and the time you actually left.' : 'Please fill in the date and the time you actually arrived.' });
      return;
    }
    if (disputeForm.type === 'TimeOut' && !disputeForm.attendanceLogId) {
      setDisputeMsg({ type: 'error', text: "You don't have a time-in recorded on that date yet, so there's no time-out to correct. File a missed time-in dispute for that date first." });
      return;
    }
    setDisputeMsg(null);
    setDisputeStep('confirm');
  };

  const submitDispute = async () => {
    if (!disputeForm.date || !disputeForm.timeLocal) {
      setDisputeMsg({ type: 'error', text: disputeForm.type === 'TimeOut' ? 'Please fill in the date and the time you actually left.' : 'Please fill in the date and the time you actually arrived.' });
      return;
    }
    if (disputeForm.type === 'TimeOut' && !disputeForm.attendanceLogId) {
      setDisputeMsg({ type: 'error', text: "You don't have a time-in recorded on that date yet, so there's no time-out to correct. File a missed time-in dispute for that date first." });
      return;
    }
    setDisputeSaving(true);
    setDisputeMsg(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You are not logged in.');

      // disputeForm.timeLocal is a PH wall-clock time like "08:05";
      // combine with the date and convert to a real UTC timestamp,
      // same +08:00 fixed-offset approach used elsewhere in the app.
      const claimedTimeISO = new Date(`${disputeForm.date}T${disputeForm.timeLocal}:00+08:00`).toISOString();

      // Snapshot what time_in/time_out currently is (if a log already
      // exists for this day), so we can show a clear "before -> after"
      // comparison even after HR approves and the real record gets
      // overwritten.
      const existingLog = disputeForm.attendanceLogId
        ? history.find((h) => h.id === disputeForm.attendanceLogId)
        : null;

      const payload: Record<string, any> = {
        attendance_log_id: disputeForm.attendanceLogId,
        user_id: user.id,
        dispute_date: disputeForm.date,
        dispute_type: disputeForm.type,
        reason: disputeForm.reason.trim() || null,
      };

      if (disputeForm.type === 'TimeOut') {
        payload.claimed_time_out = claimedTimeISO;
        payload.original_time_out = existingLog?.time_out ?? null;
      } else {
        payload.claimed_time_in = claimedTimeISO;
        payload.original_time_in = existingLog?.time_in ?? null;
      }

      const { error } = await supabase.from('attendance_disputes').insert([payload]);

      if (error) throw error;

      setDisputeMsg({ type: 'success', text: 'Dispute submitted! HR will review it soon.' });
      await fetchMyDisputes();
      setTimeout(() => setDisputeModalOpen(false), 1200);
    } catch (err: any) {
      console.error('Error submitting dispute:', err);
      const msg = err?.message?.includes('one_pending_dispute_per_user_date')
        ? 'You already have a pending dispute for this date.'
        : (err?.message || 'Failed to submit dispute.');
      setDisputeMsg({ type: 'error', text: msg });
    } finally {
      setDisputeSaving(false);
    }
  };

  // Masks a value except for its first 2 characters, e.g. "34" + dots
  // for the rest -- shows just enough to help the employee recognize
  // "yes, this is my number" without exposing the whole thing.
  const maskValue = (value: string) => {
    if (value.length <= 2) return value;
    return value.slice(0, 2) + '•'.repeat(value.length - 2);
  };

  // Renders one masked/unmaskable government ID row, e.g. SSS Number.
  const renderGovIdRow = (label: string, value: string | null, fieldKey: 'sss' | 'philhealth' | 'pagibig' | 'tin') => (
    <div>
      <p className="label-branded mb-1">{label}</p>
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-slate-700 tabular-nums">
          {value ? (visibleFields[fieldKey] ? value : maskValue(value)) : 'Not set'}
        </p>
        {value && (
          <button
            type="button"
            onClick={() => setVisibleFields((v) => ({ ...v, [fieldKey]: !v[fieldKey] }))}
            className="text-slate-400 hover:text-slate-600 flex-shrink-0 transition"
            aria-label={visibleFields[fieldKey] ? `Hide ${label}` : `Show ${label}`}
          >
            {visibleFields[fieldKey] ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
    </div>
  );

  // Hired Date isn't sensitive like a government ID number, so it's
  // just shown plainly -- no masking/eye icon needed.
  const formatHiredDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  // --- Summary card calculations ---
  // log_date is a plain "YYYY-MM-DD" string, so we parse it manually
  // instead of `new Date(log_date)` to avoid the browser's local
  // timezone shifting it into the wrong day/month.
  //
  // Period key format: "YYYY-MM:ALL" (whole month), "YYYY-MM:H1"
  // (days 1-15), or "YYYY-MM:H2" (days 16 to end of month).
  const matchesCutoff = (logDate: string | undefined, cutoffKey: string) => {
    if (!logDate || !cutoffKey) return false;
    const [ym, half] = cutoffKey.split(':');
    if (!logDate.startsWith(ym)) return false;
    if (half === 'ALL') return true;
    const day = parseInt(logDate.split('-')[2], 10);
    return half === 'H1' ? day <= 15 : day >= 16;
  };

  const currentCutoffKey = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const half = now.getDate() <= 15 ? 'H1' : 'H2';
    return `${ym}:${half}`;
  }, []);

  // Today's date in Manila -- used to decide whether a "no time out"
  // row is eligible for a missed-time-out dispute (only past days;
  // today's row already has its own Time Out button/reminder).
  const todayManila = useMemo(
    () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date()),
    []
  );

  const upcomingApprovedLeaves = myLeaves
    .filter((leave) => leave.status === 'Approved' && leave.end_date >= todayManila)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 3);

  // --- Attendance Streak badge ---
  // Counts consecutive work days (most recent first) that are neither
  // "Late" nor "Absent" -- an approved Leave day doesn't break the streak,
  // it's just skipped over.
  const attendanceStreak = useMemo(() => {
    const sorted = [...history]
      .filter((l) => l.log_date && l.log_date <= todayManila)
      .sort((a, b) => (a.log_date < b.log_date ? 1 : -1));
    let streak = 0;
    for (const log of sorted) {
      const status = log.status?.toLowerCase() ?? '';
      if (status === 'late' || status === 'absent') break;
      if (status.includes('leave')) continue;
      streak += 1;
    }
    return streak;
  }, [history, todayManila]);

  const streakMessage =
    attendanceStreak === 0 ? 'Start your streak today!' :
    attendanceStreak < 5 ? 'Nice start!' :
    attendanceStreak < 10 ? 'Great job!' :
    attendanceStreak < 20 ? 'Impressive!' : 'Outstanding!';

  // Split holidays into upcoming (today included) and past, each sorted
  // nearest-first, for the Company Calendar modal.
  const { upcomingHolidays, pastHolidays } = useMemo(() => {
    const upcoming = companyHolidays
      .filter((h) => h.holiday_date >= todayManila)
      .sort((a, b) => (a.holiday_date < b.holiday_date ? -1 : 1));
    const past = companyHolidays
      .filter((h) => h.holiday_date < todayManila)
      .sort((a, b) => (a.holiday_date < b.holiday_date ? 1 : -1));
    return { upcomingHolidays: upcoming, pastHolidays: past };
  }, [companyHolidays, todayManila]);

  const formatHolidayDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const daysUntilHoliday = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const [ty, tm, td] = todayManila.split('-').map(Number);
    return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86400000);
  };

  // If the employee has filtered Attendance History to a specific
  // cutoff, the summary cards follow that same cutoff. Otherwise,
  // default to the current cutoff period.
  const summaryCutoffKey = monthFilter || currentCutoffKey;

  // Minutes late for a single Late log, derived from the configurable
  // late cutoff (Super Admin -> App Settings) -- same threshold
  // app/api/time-in/route.ts uses to decide Present vs Late, since we
  // don't store an exact minutes-late value anywhere.
  const getMinutesLate = (timeInIso: string) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .formatToParts(new Date(timeInIso))
      .reduce((acc: any, p) => { acc[p.type] = p.value; return acc; }, {});
    const minutesSinceMidnight = parseInt(parts.hour, 10) * 60 + parseInt(parts.minute, 10);
    const cutoffMinutes = lateCutoffHour * 60 + lateCutoffMinute;
    return Math.max(0, minutesSinceMidnight - cutoffMinutes);
  };

  const formatLateDuration = (mins: number) => {
    if (mins <= 0) return '0 min';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h === 0 ? `${m} min` : `${h}h ${m}m`;
  };

  const formatLateCutoffLabel = () => {
    const period = lateCutoffHour >= 12 ? 'PM' : 'AM';
    const hour12 = lateCutoffHour % 12 === 0 ? 12 : lateCutoffHour % 12;
    return `${hour12}:${String(lateCutoffMinute).padStart(2, '0')} ${period}`;
  };

  // "Leave" here now covers any type-specific status ("Sick Leave",
  // "Vacation Leave", "Emergency Leave") set by settle_leave_day(), not
  // just the literal word "Leave" -- match by substring.
  const isLeaveStatus = (s: string | null | undefined) => (s ?? '').toLowerCase().includes('leave');

  const summary = useMemo(() => {
    const cutoffLogs = history.filter(log => matchesCutoff(log.log_date, summaryCutoffKey));
    // "Present" here means the employee actually showed up (on-time or late) --
    // it must exclude 'Absent' and any Leave-type rows, which now also live in
    // attendance_logs. Status is compared case-insensitively since it can
    // also be hand-edited directly in Supabase (e.g. "late" instead of "Late").
    const presentLogs = cutoffLogs.filter(l => l.status?.toLowerCase() !== 'absent' && !isLeaveStatus(l.status));
    const lateLogs = cutoffLogs.filter(l => l.status?.toLowerCase() === 'late');
    const absentLogs = cutoffLogs.filter(l => l.status?.toLowerCase() === 'absent');
    const onTime = presentLogs.length - lateLogs.length;
    const totalLateMinutes = lateLogs
      .filter(l => l.time_in)
      .reduce((sum, l) => sum + getMinutesLate(l.time_in), 0);
    // presentLogs/lateLogs/absentLogs carried along so the stat cards can
    // list the exact dates behind each number when tapped.
    return { present: presentLogs.length, late: lateLogs.length, absent: absentLogs.length, onTime, totalLateMinutes, presentLogs, lateLogs, absentLogs };
  }, [history, summaryCutoffKey, lateCutoffHour, lateCutoffMinute]);

  // Which stat card's detail list is currently open (null = none).
  const [summaryDetailType, setSummaryDetailType] = useState<'present' | 'late' | 'absent' | null>(null);

  const summaryDetailInfo = useMemo(() => {
    if (!summaryDetailType) return null;
    const map: Record<'present' | 'late' | 'absent', { title: string; accent: string; logs: any[]; emptyNote: string }> = {
      present: { title: 'Present Days', accent: 'text-blue-600', logs: summary.presentLogs, emptyNote: "No present days on record for this period yet." },
      late: { title: 'Late Days', accent: 'text-orange-600', logs: summary.lateLogs, emptyNote: "No late days this period -- keep it up!" },
      absent: { title: 'Absent Days', accent: 'text-red-600', logs: summary.absentLogs, emptyNote: "No absences this period -- perfect attendance!" },
    };
    return map[summaryDetailType];
  }, [summaryDetailType, summary]);

  // --- History filtering ---
  const availableCutoffs = useMemo(() => {
    const months = new Set<string>();
    history.forEach(log => {
      if (log.log_date) months.add(log.log_date.slice(0, 7));
    });
    // Always include the current cutoff's month, even if there's no
    // attendance log for it yet, so the dropdown (defaulted to this
    // cutoff) always has a matching option to display.
    months.add(currentCutoffKey.split(':')[0]);
    const opts: string[] = [];
    months.forEach(ym => {
      opts.push(`${ym}:H1`);
      opts.push(`${ym}:H2`);
    });
    // String sort works here since "YYYY-MM:H1" < "YYYY-MM:H2"
    // alphabetically, and the zero-padded YYYY-MM sorts correctly too.
    return opts.sort().reverse();
  }, [history, currentCutoffKey]);

  // Just the distinct months (no H1/H2 duplication) for a shorter, easier
  // to scan month picker -- the half is chosen separately via the two
  // pill buttons next to it.
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    availableCutoffs.forEach((c) => months.add(c.split(':')[0]));
    return Array.from(months).sort().reverse();
  }, [availableCutoffs]);

  const [selectedYm, selectedHalf] = monthFilter ? (monthFilter.split(':') as [string, string]) : ['', ''];

  const formatMonthOnly = (ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const handleMonthChange = (ym: string) => {
    if (!ym) { setMonthFilter(''); return; }
    setMonthFilter(`${ym}:${selectedHalf || 'H1'}`);
  };

  const handleHalfChange = (half: 'ALL' | 'H1' | 'H2') => {
    const ym = selectedYm || currentCutoffKey.split(':')[0];
    setMonthFilter(`${ym}:${half}`);
  };

  const filteredHistory = useMemo(() => {
    if (!monthFilter) return history;
    return history.filter(log => matchesCutoff(log.log_date, monthFilter));
  }, [history, monthFilter]);

  const formatMonthLabel = (key: string) => {
    const [ym, half] = key.split(':');
    const [y, m] = ym.split('-').map(Number);
    const monthName = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long' });
    if (half === 'ALL') return `${monthName} ${y} (Whole Month)`;
    const lastDay = new Date(y, m, 0).getDate();
    return half === 'H1' ? `${monthName} 1-15, ${y}` : `${monthName} 16-${lastDay}, ${y}`;
  };

  // --- Monthly Attendance Calendar ---
  const [attendanceCalendarOpen, setAttendanceCalendarOpen] = useState(false);
  const [attendanceCalendarMonth, setAttendanceCalendarMonth] = useState(() => currentCutoffKey.split(':')[0]);
  const [selectedAttendanceCalendarDate, setSelectedAttendanceCalendarDate] = useState<string | null>(null);

  const attendanceCalendarDays = useMemo(() => {
    const [year, month] = attendanceCalendarMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstWeekday = new Date(year, month - 1, 1).getDay();
    const cells: Array<{ date: string; day: number; log: any | null; holiday: string | null } | null> = [];
    for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${attendanceCalendarMonth}-${String(day).padStart(2, '0')}`;
      cells.push({
        date,
        day,
        log: history.find((item) => item.log_date === date) || null,
        holiday: companyHolidays.find((item) => item.holiday_date === date)?.name || null,
      });
    }
    return cells;
  }, [attendanceCalendarMonth, history, companyHolidays]);

  const selectedAttendanceCalendarDay = selectedAttendanceCalendarDate
    ? {
        date: selectedAttendanceCalendarDate,
        log: history.find((item) => item.log_date === selectedAttendanceCalendarDate) || null,
        holiday: companyHolidays.find((item) => item.holiday_date === selectedAttendanceCalendarDate)?.name || null,
      }
    : null;

  // --- Profile completeness ---
  const profileCompleteness = useMemo(() => {
    const fields = [
      profile?.full_name,
      profile?.employee_id,
      profile?.designation,
      profile?.avatar_url,
      governmentIds?.sss_number,
      governmentIds?.philhealth_number,
      governmentIds?.pagibig_number,
      governmentIds?.tin_number,
      governmentIds?.hired_date,
      governmentIds?.employment_status,
    ];
    const completed = fields.filter(Boolean).length;
    return {
      completed,
      total: fields.length,
      percent: Math.round((completed / fields.length) * 100),
      missing: fields.length - completed,
    };
  }, [profile, governmentIds]);

  // --- Persistent Notification Inbox ---
  type EmployeeNotification = {
    id: string;
    title: string;
    message: string;
    date: string;
    target: 'leave' | 'dispute' | 'payslip' | 'announcement' | 'holiday' | 'support';
  };
  const [notificationsModalOpen, setNotificationsModalOpen] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);

  useEffect(() => {
    if (!currentUserId) return;
    try {
      const stored = localStorage.getItem(`employee-notifications-read:${currentUserId}`);
      setReadNotificationIds(stored ? JSON.parse(stored) : []);
    } catch {
      setReadNotificationIds([]);
    }
  }, [currentUserId]);

  const employeeNotifications = useMemo<EmployeeNotification[]>(() => {
    const items: EmployeeNotification[] = [];
    myLeaves
      .filter((leave) => leave.status === 'Approved' || leave.status === 'Rejected')
      .forEach((leave) => items.push({
        id: `leave:${leave.id}:${leave.status}`,
        title: `Leave ${leave.status}`,
        message: `${leave.leave_type} leave · ${leave.start_date} to ${leave.end_date}`,
        date: leave.reviewed_at || leave.created_at,
        target: 'leave',
      }));
    myDisputes
      .filter((dispute) => dispute.status === 'Approved' || dispute.status === 'Rejected')
      .forEach((dispute) => items.push({
        id: `dispute:${dispute.id}:${dispute.status}`,
        title: `Attendance dispute ${dispute.status}`,
        message: `${disputeTypeLabel(dispute)} · ${dispute.dispute_date}`,
        date: dispute.reviewed_at || dispute.created_at,
        target: 'dispute',
      }));
    payslips
      .filter((payslip) => !payslip.acknowledged_at)
      .forEach((payslip) => items.push({
        id: `payslip:${payslip.id}`,
        title: 'New payslip available',
        message: payslip.cutoff_label,
        date: payslip.published_at || payslip.uploaded_at,
        target: 'payslip',
      }));
    supportRequests
      .filter((request) => request.status === 'In Progress' || request.status === 'Resolved')
      .forEach((request) => items.push({
        id: `support:${request.id}:${request.status}`,
        title: `Request ${request.status}`,
        message: request.subject,
        date: request.updated_at,
        target: 'support',
      }));
    if (announcement && announcementUpdatedAt) {
      items.push({
        id: `announcement:${announcementUpdatedAt}`,
        title: 'Company announcement',
        message: announcement,
        date: announcementUpdatedAt,
        target: 'announcement',
      });
    }
    if (upcomingHolidays[0]) {
      items.push({
        id: `holiday:${upcomingHolidays[0].id}`,
        title: 'Upcoming holiday',
        message: `${upcomingHolidays[0].name} · ${formatHolidayDate(upcomingHolidays[0].holiday_date)}`,
        date: upcomingHolidays[0].holiday_date,
        target: 'holiday',
      });
    }
    return items.sort((a, b) => {
      const aTime = Date.parse(a.date) || 0;
      const bTime = Date.parse(b.date) || 0;
      return bTime - aTime;
    });
  }, [myLeaves, myDisputes, payslips, supportRequests, announcement, announcementUpdatedAt, upcomingHolidays]);

  const unreadNotificationCount = employeeNotifications.filter((item) => !readNotificationIds.includes(item.id)).length;

  const markNotificationRead = (notificationId: string) => {
    if (!currentUserId || readNotificationIds.includes(notificationId)) return;
    const next = [...readNotificationIds, notificationId];
    setReadNotificationIds(next);
    localStorage.setItem(`employee-notifications-read:${currentUserId}`, JSON.stringify(next));
  };

  const markAllNotificationsRead = () => {
    if (!currentUserId) return;
    const next = employeeNotifications.map((item) => item.id);
    setReadNotificationIds(next);
    localStorage.setItem(`employee-notifications-read:${currentUserId}`, JSON.stringify(next));
  };

  const openNotificationTarget = (notification: EmployeeNotification) => {
    markNotificationRead(notification.id);
    setNotificationsModalOpen(false);
    if (notification.target === 'leave') setMyLeavesModalOpen(true);
    if (notification.target === 'dispute') setMyDisputesModalOpen(true);
    if (notification.target === 'payslip') setPayslipsModalOpen(true);
    if (notification.target === 'holiday') setCalendarModalOpen(true);
    if (notification.target === 'support') setSupportModalOpen(true);
  };

  const pendingLeavesCount = myLeaves.filter((leave) => leave.status === 'Pending').length;
  const pendingDisputesCount = myDisputes.filter((dispute) => dispute.status === 'Pending').length;
  const newPayslipsCount = payslips.filter((payslip) => !payslip.acknowledged_at).length;
  const openSupportCount = supportRequests.filter((request) => request.status !== 'Resolved').length;

  const todayWorkStatus = !todayLog
    ? { label: 'Not Timed In', color: 'bg-slate-100 text-slate-600' }
    : todayLog.time_out
      ? { label: 'Completed', color: 'bg-green-100 text-green-700' }
      : todayLog.status?.toLowerCase() === 'late'
        ? { label: 'Working · Late', color: 'bg-orange-100 text-orange-700' }
        : { label: 'Working', color: 'bg-blue-100 text-blue-700' };

  const expectedTimeOutLabel = (() => {
    const period = timeOutReminderHour >= 12 ? 'PM' : 'AM';
    const hour = timeOutReminderHour % 12 || 12;
    return `${hour}:00 ${period}`;
  })();

  // --- Export Attendance History ---
  // Both exports respect whatever the employee currently has the history
  // filtered to (monthFilter) via filteredHistory.
  const exportFileLabel = () => {
    const idPart = profile?.employee_id ? `-${profile.employee_id}` : '';
    const periodPart = monthFilter ? `-${monthFilter.replace(':', '-')}` : '-all';
    return `attendance${idPart}${periodPart}`;
  };

  const exportAttendanceCSV = () => {
    const escapeCsv = (val: string) => `"${(val ?? '').replace(/"/g, '""')}"`;
    const headers = ['Date', 'Day', 'Status', 'Time In', 'Time Out'];
    const rows = filteredHistory.map((log) => {
      const weekday = new Date(log.log_date).toLocaleDateString('en-US', { weekday: 'long' });
      const timeIn = log.time_in ? new Date(log.time_in).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }) : '';
      const timeOut = log.time_out ? new Date(log.time_out).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }) : '';
      return [log.log_date, weekday, log.status ?? '', timeIn, timeOut];
    });
    const csv = [headers, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportFileLabel()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Opens a print-formatted view in a new tab and triggers the browser's
  // print dialog -- the employee can "Save as PDF" from there. Avoids
  // needing a PDF-generation library as a project dependency.
  const exportAttendancePDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to export as PDF.');
      return;
    }
    const rowsHtml = filteredHistory.map((log) => {
      const weekday = new Date(log.log_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const timeIn = log.time_in ? new Date(log.time_in).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }) : '--:--';
      const timeOut = log.time_out ? new Date(log.time_out).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }) : '--:--';
      return `<tr><td>${weekday}</td><td>${log.log_date}</td><td><span class="tag ${(log.status ?? '').toLowerCase()}">${log.status ?? ''}</span></td><td>${timeIn}</td><td>${timeOut}</td></tr>`;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>${exportFileLabel()}</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #1e293b; padding: 32px; }
            h1 { font-size: 18px; margin: 0 0 2px; }
            .sub { color: #64748b; font-size: 12px; margin: 0 0 20px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
            th { color: #64748b; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
            .tag { padding: 3px 8px; border-radius: 999px; font-weight: bold; font-size: 10px; text-transform: uppercase; }
            .tag.present { background: #e4fbea; color: #0c7a34; }
            .tag.late { background: #ffeee2; color: #c23f0e; }
            .tag.absent { background: #ffe1e1; color: #b91c1c; }
            .tag.sick.leave, .tag.vacation.leave, .tag.emergency.leave { background: #f3ecfd; color: #6d28d9; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <h1>${profile?.full_name || 'Employee'} -- Attendance History</h1>
          <p class="sub">${profile?.employee_id ? `ID: ${profile.employee_id} · ` : ''}${monthFilter ? formatMonthLabel(monthFilter) : 'All records'} · Generated ${new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric' })}</p>
          <table>
            <thead><tr><th>Day</th><th>Date</th><th>Status</th><th>Time In</th><th>Time Out</th></tr></thead>
            <tbody>${rowsHtml || '<tr><td colspan="5">No records.</td></tr>'}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  // Formats "HH:MM" (24h) into a readable 12h time, e.g. "8:05 AM" --
  // used on the dispute confirmation screen.
  const formatTimeLocal = (hhmm: string) => {
    if (!hhmm) return '--';
    return new Date(`2000-01-01T${hhmm}:00`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  return (
    <main className="min-h-screen p-3 sm:p-4 md:p-6 lg:p-8">
      <style jsx global>{`
        /* DARK MODE — neutral dark gray, not pure black. */
        .dark { color-scheme: dark; }
        .dark body { background-color: #202522; color: #f1f5f2; }
        .dark .card-style { background: #292f2b !important; border-color: #414944 !important; color: #f1f5f2; }
        .dark .branding-box { background: #2c332e !important; border-color: #465049 !important; color: #f7faf8; }
        .dark .input-field { background: #252b27 !important; border-color: #4b554e !important; color: #f7faf8 !important; }
        .dark .input-field::placeholder { color: #aeb8b1 !important; opacity: 1; }
        .dark input, .dark select, .dark textarea { color-scheme: dark; }

        .dark .text-slate-950, .dark .text-slate-900, .dark .text-slate-800 { color: #f8faf9 !important; }
        .dark .text-slate-700, .dark .text-slate-600 { color: #dce3de !important; }
        .dark .text-slate-500 { color: #bec8c1 !important; }
        .dark .text-slate-400 { color: #a7b2aa !important; }
        .dark .text-slate-300 { color: #94a098 !important; }

        .dark .bg-white { background-color: #2d342f !important; }
        .dark .bg-white\/20 { background-color: rgba(75, 84, 78, .45) !important; }
        .dark .bg-white\/70, .dark .bg-white\/80, .dark .bg-white\/85, .dark .bg-white\/90, .dark .bg-white\/95 { background-color: rgba(49, 57, 51, .96) !important; }
        .dark .bg-slate-50, .dark .bg-slate-50\/80 { background-color: #282e2a !important; }
        .dark .bg-slate-100 { background-color: #333a35 !important; }
        .dark .bg-slate-100\/90 { background-color: rgba(51, 58, 53, .96) !important; }
        .dark .bg-slate-300 { background-color: #68726b !important; }
        .dark .bg-slate-400 { background-color: #7c8780 !important; }
        .dark .bg-slate-200 { background-color: #444c46 !important; }
        .dark .bg-slate-900 { background-color: #343a36 !important; }
        .dark .bg-slate-950 { background-color: #303632 !important; }
        .dark .border-slate-100 { border-color: #3e4741 !important; }
        .dark .border-slate-200 { border-color: #4b554e !important; }
        .dark .border-slate-200\/80 { border-color: rgba(75, 85, 78, .88) !important; }
        .dark .border-white\/70 { border-color: #505a53 !important; }
        .dark .border-black\/5 { border-color: #4b554e !important; }
        .dark .hover\:bg-slate-50:hover { background-color: #343b36 !important; }
        .dark .hover\:bg-slate-100:hover { background-color: #3b433d !important; }
        .dark .hover\:bg-slate-200:hover { background-color: #48514a !important; }

        .dark .bg-green-50, .dark .bg-emerald-50 { background-color: #263b2f !important; }
        .dark .bg-green-100, .dark .bg-emerald-100 { background-color: #31503c !important; }
        .dark .border-green-100, .dark .border-green-200, .dark .border-emerald-100, .dark .border-emerald-200 { border-color: #4b7458 !important; }
        .dark .text-green-950, .dark .text-green-900, .dark .text-green-800, .dark .text-green-700,
        .dark .text-emerald-950, .dark .text-emerald-900, .dark .text-emerald-800, .dark .text-emerald-700 { color: #c8f2d3 !important; }
        .dark .text-green-600, .dark .text-emerald-600 { color: #8ee6a7 !important; }

        .dark .bg-blue-50, .dark .bg-sky-50 { background-color: #263443 !important; }
        .dark .bg-sky-50\/40 { background-color: rgba(38, 52, 67, .94) !important; }
        .dark .bg-blue-100, .dark .bg-sky-100 { background-color: #304760 !important; }
        .dark .border-blue-100, .dark .border-blue-200, .dark .border-sky-100, .dark .border-sky-200 { border-color: #4b6f94 !important; }
        .dark .text-blue-950, .dark .text-blue-900, .dark .text-blue-800, .dark .text-blue-700, .dark .text-blue-600,
        .dark .text-sky-950, .dark .text-sky-900, .dark .text-sky-800, .dark .text-sky-700, .dark .text-sky-600 { color: #c5ddff !important; }

        .dark .bg-amber-50, .dark .bg-orange-50 { background-color: #403525 !important; }
        .dark .bg-amber-50\/60 { background-color: rgba(64, 53, 37, .96) !important; }
        .dark .bg-orange-50\/60 { background-color: rgba(64, 53, 37, .96) !important; }
        .dark .bg-amber-100, .dark .bg-orange-100 { background-color: #57432b !important; }
        .dark .border-amber-100, .dark .border-amber-200, .dark .border-orange-100, .dark .border-orange-200 { border-color: #84633a !important; }
        .dark .text-amber-950, .dark .text-amber-900, .dark .text-amber-800, .dark .text-amber-700, .dark .text-amber-600,
        .dark .text-orange-950, .dark .text-orange-900, .dark .text-orange-800, .dark .text-orange-700, .dark .text-orange-600 { color: #ffe2a3 !important; }

        /* Realtime red alerts: light text on muted dark-red surface. */
        .dark .bg-red-50, .dark .bg-rose-50 { background-color: #44292b !important; }
        .dark .bg-red-50\/60 { background-color: rgba(68, 41, 43, .96) !important; }
        .dark .bg-red-100, .dark .bg-rose-100 { background-color: #5a3034 !important; }
        .dark .bg-red-200, .dark .bg-rose-200 { background-color: #67373c !important; }
        .dark .border-red-100, .dark .border-red-200, .dark .border-rose-100, .dark .border-rose-200 { border-color: #8b4d53 !important; }
        .dark .text-red-950, .dark .text-red-900, .dark .text-red-800, .dark .text-red-700, .dark .text-red-600, .dark .text-red-500,
        .dark .text-rose-950, .dark .text-rose-900, .dark .text-rose-800, .dark .text-rose-700, .dark .text-rose-600, .dark .text-rose-500 { color: #ffd1d5 !important; }

        .dark .bg-purple-50, .dark .bg-violet-50 { background-color: #382e42 !important; }
        .dark .bg-purple-100, .dark .bg-violet-100 { background-color: #493758 !important; }
        .dark .border-purple-100, .dark .border-purple-200, .dark .border-violet-100, .dark .border-violet-200 { border-color: #705885 !important; }
        .dark .text-purple-950, .dark .text-purple-900, .dark .text-purple-800, .dark .text-purple-700, .dark .text-purple-600,
        .dark .text-violet-950, .dark .text-violet-900, .dark .text-violet-800, .dark .text-violet-700, .dark .text-violet-600 { color: #ead8ff !important; }

        .dark .bg-teal-50, .dark .bg-cyan-50 { background-color: #263b3a !important; }
        .dark .border-teal-100, .dark .border-teal-200, .dark .border-cyan-100, .dark .border-cyan-200 { border-color: #4d7774 !important; }
        .dark .text-teal-950, .dark .text-teal-900, .dark .text-teal-800, .dark .text-teal-700, .dark .text-teal-600,
        .dark .text-cyan-950, .dark .text-cyan-900, .dark .text-cyan-800, .dark .text-cyan-700, .dark .text-cyan-600 { color: #c6f3ef !important; }

        .dark .employee-notification-unread { background: #29394a !important; border-color: #45617d !important; }
        .dark .employee-notification-read { background: #2a302c !important; border-color: #414a44 !important; opacity: 1 !important; }
        .dark .employee-notification-unread .text-slate-900,
        .dark .employee-notification-read .text-slate-900 { color: #f7faf8 !important; }
        .dark .employee-notification-unread .text-slate-500,
        .dark .employee-notification-read .text-slate-500 { color: #c2ccc5 !important; }

        .dark .hover\:bg-red-100:hover, .dark .hover\:bg-rose-100:hover { background-color: #60363a !important; }
        .dark .hover\:bg-amber-100:hover, .dark .hover\:bg-orange-100:hover { background-color: #604a30 !important; }
        .dark .hover\:bg-blue-50:hover, .dark .hover\:bg-sky-50:hover { background-color: #31455a !important; }
        .dark .hover\:bg-emerald-50:hover, .dark .hover\:bg-green-50:hover { background-color: #304a39 !important; }

        .dark .tag-present, .dark .tag-late, .dark .tag-absent, .dark .tag-leave, .dark .tag-excused { border: 1px solid currentColor; }
        .dark button:disabled { opacity: .55; }
      `}</style>
      <div className="max-w-7xl mx-auto space-y-3 sm:space-y-4 md:space-y-5">

        {/* Header */}
        <header className="branding-box flex items-center justify-between gap-3 !p-3 sm:!p-4">
          <div>
            <h1 className="text-base sm:text-lg md:text-2xl leading-tight">HAMDAN ENGINEERING</h1>
            <p className="text-slate-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mt-0.5">Employee Portal</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-4">
              <button type="button" onClick={() => setSummaryDetailType('present')} className="text-center hover:opacity-70 transition"><p className="stat-number text-xl text-[#15803d] dark:text-[#5ee28b] leading-none">{summary.present}</p><p className="label-branded mt-0.5 mb-0 dark:text-[#aab8ad]">Present</p></button>
              <div className="w-px h-8 bg-slate-200"/>
              <button type="button" onClick={() => setSummaryDetailType('late')} className="text-center hover:opacity-70 transition"><p className="stat-number text-xl text-[#c2410c] dark:text-[#fb923c] leading-none">{summary.late}</p><p className="label-branded mt-0.5 mb-0 dark:text-[#aab8ad]">Late</p></button>
              <div className="w-px h-8 bg-slate-200"/>
              <button type="button" onClick={() => setSummaryDetailType('absent')} className="text-center hover:opacity-70 transition"><p className="stat-number text-xl text-[#b91c1c] dark:text-[#f87171] leading-none">{summary.absent}</p><p className="label-branded mt-0.5 mb-0 dark:text-[#aab8ad]">Absent</p></button>
            </div>
            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              className="text-slate-400 hover:text-slate-600 transition p-1.5 rounded-full hover:bg-slate-100 flex-shrink-0"
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? <SunIcon /> : <MoonIcon />}
            </button>
            <button onClick={() => supabase.auth.signOut().then(() => window.location.href = '/')} className="text-slate-500 font-medium text-xs hover:text-red-600 transition whitespace-nowrap">Log Out</button>
          </div>
        </header>

        {message && <div className={`p-3 rounded-xl text-xs font-bold ${message.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{message}</div>}

        {/* Mobile summary cards -- tap any of these to see which dates were counted. */}
        <div className="grid grid-cols-3 gap-2 lg:hidden">
          <button type="button" onClick={() => setSummaryDetailType('present')} className="card-style !p-3 text-center hover:bg-slate-50 transition"><p className="stat-number text-xl text-[#15803d] dark:text-[#5ee28b]">{summary.present}</p><p className="label-branded mt-0.5 dark:text-[#aab8ad]">Present</p></button>
          <button type="button" onClick={() => setSummaryDetailType('late')} className="card-style !p-3 text-center hover:bg-slate-50 transition"><p className="stat-number text-xl text-[#c2410c] dark:text-[#fb923c]">{summary.late}</p><p className="label-branded mt-0.5 dark:text-[#aab8ad]">Late</p></button>
          <button type="button" onClick={() => setSummaryDetailType('absent')} className="card-style !p-3 text-center hover:bg-slate-50 transition"><p className="stat-number text-xl text-[#b91c1c] dark:text-[#f87171]">{summary.absent}</p><p className="label-branded mt-0.5 dark:text-[#aab8ad]">Absent</p></button>
        </div>

        {/* Main layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
          {/* Profile Sidebar */}
          <div className="lg:col-span-1">
            <div className="card-style lg:sticky lg:top-6 !p-4">
              <div className="flex items-center gap-3 lg:flex-col lg:text-center lg:gap-0">
                <div className="w-14 h-14 lg:w-20 lg:h-20 lg:mx-auto lg:mb-3 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 flex-shrink-0">
                  {profile?.avatar_url ? <Image src={profile.avatar_url} alt="Profile" width={80} height={80} className="object-cover w-full h-full"/> : <div className="text-slate-400 font-bold text-xs">Logo</div>}
                </div>
                <div className="flex-1 min-w-0 lg:w-full">
                  <h2 className="text-sm lg:text-base font-semibold text-slate-900 truncate lg:text-center">
                    {initLoading ? <span className="text-slate-400">Loading...</span> : (profile?.full_name || 'Unknown')}
                  </h2>
                  <p className="text-blue-600 font-medium text-xs truncate lg:text-center">{profile?.designation || '---'}</p>
                  <p className="text-slate-400 text-[10px] lg:hidden">ID: {profile?.employee_id || '---'}</p>
                </div>
              </div>
              <div className="hidden lg:block text-left border-t border-slate-100 pt-3 mt-3">
                <p className="label-branded">Employee ID</p>
                <p className="font-medium text-slate-700 text-sm">{profile?.employee_id || '---'}</p>
              </div>

              {/* Attendance Streak badge -- consecutive work days without a
                  Late or Absent tag (approved Leave doesn't break it). */}
              {!initLoading && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2.5 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100 rounded-2xl p-3">
                    <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center flex-shrink-0 text-lg shadow-sm">🔥</div>
                    <div className="min-w-0">
                      <p className="font-extrabold text-slate-900 text-sm leading-none">{attendanceStreak}-day streak</p>
                      <p className="text-orange-600 text-[10px] font-bold uppercase tracking-wide mt-1">{streakMessage}</p>
                    </div>
                  </div>
                </div>
              )}

              {!initLoading && (
                <div className="mt-3">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wide">Profile completeness</p>
                    <p className="text-slate-700 text-[10px] font-extrabold">{profileCompleteness.percent}%</p>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-green-500 transition-all" style={{ width: `${profileCompleteness.percent}%` }} />
                  </div>
                </div>
              )}

              <button type="button" onClick={() => setShowGovIdsSection((s) => !s)} className="mt-3 text-blue-600 text-xs font-bold hover:underline w-full text-left lg:text-center">
                {showGovIdsSection ? 'Hide Details' : 'See More Details'}
              </button>
              {showGovIdsSection && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
                  {renderGovIdRow('SSS Number', governmentIds?.sss_number ?? null, 'sss')}
                  {renderGovIdRow('PhilHealth Number', governmentIds?.philhealth_number ?? null, 'philhealth')}
                  {renderGovIdRow('Pag-IBIG Number', governmentIds?.pagibig_number ?? null, 'pagibig')}
                  {renderGovIdRow('TIN Number', governmentIds?.tin_number ?? null, 'tin')}
                  <div><p className="label-branded mb-1">Hired Date</p><p className="font-medium text-slate-700 text-sm">{governmentIds?.hired_date ? formatHiredDate(governmentIds.hired_date) : 'Not set'}</p></div>
                  <div>
                    <p className="label-branded mb-1">Employment Status</p>
                    {governmentIds?.employment_status ? (
                      <span className={governmentIds.employment_status === 'Regular' ? 'tag-present' : governmentIds.employment_status === 'Probationary' ? 'tag-late' : 'tag-excused'}>{governmentIds.employment_status}</span>
                    ) : <p className="font-medium text-slate-700 text-sm">Not set</p>}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-3 sm:space-y-4 md:space-y-5">

            {/* Clock + Time buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="card-style !p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${todayWorkStatus.color}`}>
                    {todayWorkStatus.label}
                  </span>
                </div>
                <h1 className="stat-number text-blue-600 text-3xl md:text-4xl lg:text-5xl tracking-tight normal-case">{time || '--:--:--'}</h1>
                <p className="mt-1 text-slate-400 font-medium uppercase text-[9px] tracking-widest">{date}</p>
                <p className="mt-1 text-[10px] text-slate-400">Late cutoff: {formatLateCutoffLabel()} (PH Time)</p>
                <p className="mt-1 text-[10px] text-slate-400">Expected Time Out: {expectedTimeOutLabel}</p>
              </div>
              <div className="flex flex-col gap-2 justify-center">
                {!todayLog ? (
                  <button onClick={handleTimeIn} disabled={loading || initLoading || checkingNetwork || officeNetworkAllowed === false} className="btn-primary !py-3">
                    {loading ? <span className="flex items-center justify-center gap-2"><Spinner size="sm"/>Processing...</span> : checkingNetwork ? <span className="flex items-center justify-center gap-2"><Spinner size="sm"/>Checking...</span> : officeNetworkAllowed === false ? (officeNetworkIssue === 'unavailable' ? 'Attendance Unavailable' : 'Not on Office Network') : 'Time In'}
                  </button>
                ) : !todayLog.time_out ? (
                  <button onClick={handleTimeOutClick} disabled={timeOutLoading || checkingNetwork || officeNetworkAllowed === false} className="btn-danger !py-3">
                    {timeOutLoading ? <span className="flex items-center justify-center gap-2"><Spinner size="sm"/>Processing...</span> : checkingNetwork ? <span className="flex items-center justify-center gap-2"><Spinner size="sm"/>Checking...</span> : officeNetworkAllowed === false ? (officeNetworkIssue === 'unavailable' ? 'Attendance Unavailable' : 'Not on Office Network') : 'Time Out'}
                  </button>
                ) : (
                  <button disabled className="btn-primary !py-3 opacity-50 cursor-not-allowed">Completed for Today</button>
                )}
                {todayLog?.time_in && (
                  <p className="text-center text-slate-400 text-xs">
                    In: {new Date(todayLog.time_in).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    {todayLog.time_out && <> · Out: {new Date(todayLog.time_out).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</>}
                  </p>
                )}
                {!checkingNetwork && officeNetworkAllowed === false && !(todayLog?.time_out) && (
                  <div className={`flex items-start justify-between gap-3 rounded-xl border p-3 ${officeNetworkIssue === 'unavailable' ? 'bg-red-50 border-red-100' : 'bg-orange-50 border-orange-100'}`}>
                    <div className="min-w-0">
                      <p className={`text-xs font-bold ${officeNetworkIssue === 'unavailable' ? 'text-red-700' : 'text-orange-700'}`}>
                        {officeNetworkIssue === 'unavailable' ? 'Attendance recording is temporarily unavailable.' : 'You are not connected to an authorized office network.'}
                      </p>
                      <p className="text-slate-500 text-[10px] mt-1">
                        {officeNetworkIssue === 'unavailable'
                          ? 'Please contact HR or IT. You can still use the rest of the Employee Portal.'
                          : 'Time In and Time Out are available only through the office network. Other portal features remain available.'}
                      </p>
                    </div>
                    <button onClick={checkOfficeNetwork} className="text-blue-600 text-xs font-bold hover:underline flex-shrink-0">Retry</button>
                  </div>
                )}
                {/* Total Minutes Late (accumulated for the cutoff) */}
                <div className="flex items-center gap-3 card-style !p-3">
                  <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-xs">{formatLateDuration(summary.totalLateMinutes)} Late</p>
                    <p className="text-slate-400 text-[10px]">{formatMonthLabel(summaryCutoffKey)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Employee Action Center */}
            <section className="card-style !p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <h3 className="mb-0 text-sm">Action Center</h3>
                  <p className="text-slate-400 text-[10px] mt-0.5">Items that may need your attention</p>
                </div>
                <button type="button" onClick={() => setNotificationsModalOpen(true)} className="text-blue-600 text-[11px] font-bold hover:underline">
                  Notifications{unreadNotificationCount > 0 ? ` (${unreadNotificationCount})` : ''}
                </button>
              </div>
              {(todayLog?.time_in && !todayLog.time_out) || pendingLeavesCount > 0 || pendingDisputesCount > 0 || newPayslipsCount > 0 || openSupportCount > 0 || (!initLoading && profileCompleteness.percent < 100) ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {todayLog?.time_in && !todayLog.time_out && (
                    <button type="button" onClick={handleTimeOutClick} disabled={officeNetworkAllowed === false || timeOutLoading} className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-left disabled:opacity-50">
                      <p className="font-bold text-amber-800 text-xs">Time Out pending</p>
                      <p className="text-amber-600 text-[10px] mt-1">Remember to complete today&apos;s attendance.</p>
                    </button>
                  )}
                  {pendingLeavesCount > 0 && (
                    <button type="button" onClick={() => setMyLeavesModalOpen(true)} className="p-3 rounded-xl bg-green-50 border border-green-100 text-left">
                      <p className="font-bold text-green-800 text-xs">{pendingLeavesCount} pending leave request{pendingLeavesCount === 1 ? '' : 's'}</p>
                      <p className="text-green-600 text-[10px] mt-1">Tap to view the status.</p>
                    </button>
                  )}
                  {pendingDisputesCount > 0 && (
                    <button type="button" onClick={() => setMyDisputesModalOpen(true)} className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-left">
                      <p className="font-bold text-rose-800 text-xs">{pendingDisputesCount} pending dispute{pendingDisputesCount === 1 ? '' : 's'}</p>
                      <p className="text-rose-600 text-[10px] mt-1">Tap to review your request.</p>
                    </button>
                  )}
                  {newPayslipsCount > 0 && (
                    <button type="button" onClick={() => setPayslipsModalOpen(true)} className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-left">
                      <p className="font-bold text-blue-800 text-xs">{newPayslipsCount} new payslip{newPayslipsCount === 1 ? '' : 's'}</p>
                      <p className="text-blue-600 text-[10px] mt-1">Review and acknowledge receipt.</p>
                    </button>
                  )}
                  {openSupportCount > 0 && (
                    <button type="button" onClick={() => setSupportModalOpen(true)} className="p-3 rounded-xl bg-violet-50 border border-violet-100 text-left">
                      <p className="font-bold text-violet-800 text-xs">{openSupportCount} open help request{openSupportCount === 1 ? '' : 's'}</p>
                      <p className="text-violet-600 text-[10px] mt-1">Check the latest status.</p>
                    </button>
                  )}
                  {!initLoading && profileCompleteness.percent < 100 && (
                    <button type="button" onClick={() => setShowGovIdsSection(true)} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-left">
                      <p className="font-bold text-slate-800 text-xs">Profile {profileCompleteness.percent}% complete</p>
                      <p className="text-slate-500 text-[10px] mt-1">{profileCompleteness.missing} detail{profileCompleteness.missing === 1 ? '' : 's'} still missing.</p>
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-green-50 border border-green-100 text-center">
                  <p className="font-bold text-green-700 text-sm">You&apos;re all caught up!</p>
                  <p className="text-green-600 text-[10px] mt-1">No pending employee actions right now.</p>
                </div>
              )}
            </section>
            {/* Announcements */}
            {announcementLoading ? (
              <div className="card-style !p-4"><LoadingRow label="Loading announcement..." /></div>
            ) : announcementError ? (
              <div className="card-style !p-4 border border-red-100"><p className="text-red-500 text-sm">{announcementError}</p></div>
            ) : announcement ? (
              <div className="card-dark !p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-green-500 flex items-center justify-center text-sm">📣</div>
                  <div className="flex-1 min-w-0">
                    <span className="inline-block bg-green-500 text-slate-950 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mb-2">Announcement</span>
                    <p className="text-white text-sm font-medium whitespace-pre-wrap leading-relaxed">{announcement}</p>
                    {announcementImageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a static asset
                      <img
                        src={announcementImageUrl}
                        alt="Announcement attachment"
                        className="mt-3 w-full max-h-[420px] rounded-2xl object-contain bg-black/10 border border-white/10"
                      />
                    )}
                    {announcementUpdatedAt && <p className="text-green-100/70 text-[10px] font-medium uppercase tracking-widest mt-2">Updated: {announcementUpdatedAt}</p>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="card-style !p-3 border-2 border-dashed border-slate-200 text-center">
                <p className="text-slate-400 text-xs">No announcements right now.</p>
              </div>
            )}

            {/* AI Weather & Commute Advisory */}
            {weatherLoading ? (
              <div className="card-style !p-4">
                <LoadingRow label="Loading weather advisory..." />
              </div>
            ) : weatherAdvisory ? (
              <section
                className={`card-style !p-4 border ${
                  weatherAdvisory.severity === 'critical'
                    ? 'border-red-200 bg-red-50/60'
                    : weatherAdvisory.severity === 'warning'
                      ? 'border-orange-200 bg-orange-50/60'
                      : weatherAdvisory.severity === 'watch'
                        ? 'border-amber-200 bg-amber-50/60'
                        : 'border-sky-100 bg-sky-50/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg flex-shrink-0 ${
                      weatherAdvisory.severity === 'critical'
                        ? 'bg-red-100'
                        : weatherAdvisory.severity === 'warning'
                          ? 'bg-orange-100'
                          : weatherAdvisory.severity === 'watch'
                            ? 'bg-amber-100'
                            : 'bg-sky-100'
                    }`}
                  >
                    {weatherAdvisory.precipitation_probability != null && weatherAdvisory.precipitation_probability >= 60 ? '🌧️' : '🌤️'}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-[9px] font-extrabold uppercase tracking-widest text-sky-700">
                        AI Weather & Commute Advisory
                      </span>
                      <span
                        className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          weatherAdvisory.severity === 'critical'
                            ? 'bg-red-100 text-red-700'
                            : weatherAdvisory.severity === 'warning'
                              ? 'bg-orange-100 text-orange-700'
                              : weatherAdvisory.severity === 'watch'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-sky-100 text-sky-700'
                        }`}
                      >
                        {weatherAdvisory.severity}
                      </span>
                    </div>

                    <p className="font-bold text-slate-900 text-sm leading-snug">
                      {weatherAdvisory.headline}
                    </p>
                    <p className="text-slate-600 text-xs mt-1 leading-relaxed whitespace-pre-wrap">
                      {weatherAdvisory.message}
                    </p>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[10px] text-slate-500">
                      <span>📍 {weatherAdvisory.location_name}</span>
                      {weatherAdvisory.temperature_c != null && (
                        <span>🌡️ {Math.round(weatherAdvisory.temperature_c)}°C</span>
                      )}
                      {weatherAdvisory.precipitation_probability != null && (
                        <span>☔ {Math.round(weatherAdvisory.precipitation_probability)}% rain chance</span>
                      )}
                      {weatherAdvisory.commute_window && (
                        <span>🚗 {weatherAdvisory.commute_window}</span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={openCommuteChecker}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-slate-900 text-white text-[10px] font-bold hover:opacity-90 transition"
                    >
                      🚗 Check Weather & Live Traffic
                    </button>

                    <p className="text-slate-400 text-[9px] mt-2">
                      Updated {new Date(weatherAdvisory.generated_at).toLocaleString('en-US', {
                        timeZone: 'Asia/Manila',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {weatherAdvisory.source_name ? ` · ${weatherAdvisory.source_name}` : ''}
                    </p>
                  </div>
                </div>
              </section>
            ) : null}

            {!weatherLoading && !weatherAdvisory && (
              <button type="button" onClick={openCommuteChecker} className="card-style !p-4 w-full flex items-center justify-between gap-3 text-left hover:bg-slate-50 transition">
                <span className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 rounded-2xl bg-sky-50 flex items-center justify-center text-lg">🌦️</span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-slate-900">Weather & Live Traffic</span>
                    <span className="block text-[10px] text-slate-400 mt-0.5">30-minute weather and live traffic for any PH route.</span>
                  </span>
                </span>
                <span className="text-slate-400">→</span>
              </button>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              <button type="button" onClick={() => setLeaveChoiceModalOpen(true)} className="card-style !p-3 flex items-center gap-2 hover:bg-slate-50 transition text-left">
                <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 text-xs">Leave</p>
                  <p className="text-slate-400 text-[10px] truncate">{isRegular ? `${remainingCredits} credits left` : 'Request or view leaves'}</p>
                </div>
              </button>
              <button type="button" onClick={() => { setPayslipsModalOpen(true); fetchPayslips(); }} className="card-style !p-3 flex items-center gap-2 hover:bg-slate-50 transition text-left">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 text-xs">My Payslips</p>
                  <p className="text-slate-400 text-[10px] truncate">{payslips.length > 0 ? `${payslips.length} available` : 'No payslips yet'}</p>
                </div>
              </button>
              <button type="button" onClick={() => { setSelectedMyDisputeDetail(null); setMyDisputesModalOpen(true); fetchMyDisputes(); }} className="card-style !p-3 flex items-center gap-2 hover:bg-slate-50 transition text-left">
                <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center flex-shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-600"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 text-xs">My Disputes</p>
                  <p className="text-slate-400 text-[10px] truncate">{myDisputes.length > 0 ? `${myDisputes.length} dispute${myDisputes.length === 1 ? '' : 's'}` : 'No disputes yet'}</p>
                </div>
              </button>
              <button type="button" onClick={() => { setDirectoryModalOpen(true); setDirectorySearch(''); fetchDirectory(); }} className="card-style !p-3 flex items-center gap-2 hover:bg-slate-50 transition text-left">
                <div className="w-8 h-8 rounded-xl bg-sky-50 flex items-center justify-center flex-shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-sky-600"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 text-xs">Employee Directory</p>
                  <p className="text-slate-400 text-[10px] truncate">Look up a colleague</p>
                </div>
              </button>
              <button type="button" onClick={() => { setCalendarModalOpen(true); fetchCompanyHolidays(); }} className="card-style !p-3 flex items-center gap-2 hover:bg-slate-50 transition text-left">
                <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 text-xs">Company Calendar</p>
                  <p className="text-slate-400 text-[10px] truncate">
                    {!holidaysLoading && upcomingHolidays.length > 0
                      ? `Next: ${upcomingHolidays[0].name}`
                      : 'View holidays'}
                  </p>
                </div>
              </button>
              <button type="button" onClick={() => setNotificationsModalOpen(true)} className="card-style !p-3 flex items-center gap-2 hover:bg-slate-50 transition text-left">
                <div className="relative w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0 text-sm">
                  🔔
                  {unreadNotificationCount > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}</span>}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 text-xs">Notifications</p>
                  <p className="text-slate-400 text-[10px] truncate">{unreadNotificationCount > 0 ? `${unreadNotificationCount} unread` : 'You are up to date'}</p>
                </div>
              </button>
              <button type="button" onClick={() => { setSupportModalOpen(true); fetchSupportRequests(); }} className="card-style !p-3 flex items-center gap-2 hover:bg-slate-50 transition text-left">
                <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center flex-shrink-0 text-sm">🎫</div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 text-xs">Help Desk / HR</p>
                  <p className="text-slate-400 text-[10px] truncate">{openSupportCount > 0 ? `${openSupportCount} open request${openSupportCount === 1 ? '' : 's'}` : 'Submit a concern'}</p>
                </div>
              </button>
              <button type="button" onClick={() => { setDocumentsModalOpen(true); fetchEmployeeDocuments(); }} className="card-style !p-3 flex items-center gap-2 hover:bg-slate-50 transition text-left">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0 text-sm">📚</div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 text-xs">My Documents</p>
                  <p className="text-slate-400 text-[10px] truncate">{employeeDocuments.length > 0 ? `${employeeDocuments.length} available` : 'Policies and memorandums'}</p>
                </div>
              </button>
            </div>

            {/* Attendance History -- collapsed by default; tap the header to expand. */}
            <div className="card-style !p-4">
              <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAttendanceHistoryOpen((v) => !v)}
                className="flex-1 flex items-center justify-between gap-2 text-left"
              >
                <h3 className="mb-0 text-sm">
                  Attendance History
                  {!attendanceHistoryOpen && (
                    <span className="block text-[10px] font-medium text-slate-400 normal-case tracking-normal mt-0.5">
                      {monthFilter ? formatMonthLabel(monthFilter) : `${filteredHistory.length} record${filteredHistory.length === 1 ? '' : 's'}`}
                    </span>
                  )}
                </h3>
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className={`text-slate-400 flex-shrink-0 transition-transform ${attendanceHistoryOpen ? 'rotate-180' : ''}`}
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
                <button
                  type="button"
                  onClick={() => {
                    setAttendanceCalendarMonth(selectedYm || currentCutoffKey.split(':')[0]);
                    setSelectedAttendanceCalendarDate(null);
                    setAttendanceCalendarOpen(true);
                  }}
                  className="px-3 py-2 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold hover:bg-blue-100 transition flex-shrink-0"
                >
                  Calendar
                </button>
              </div>

              {attendanceHistoryOpen && (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 mt-4 mb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <select className="input-field !py-1.5 !text-xs !min-h-0 w-auto" value={selectedYm} onChange={(e) => handleMonthChange(e.target.value)}>
                        <option value="">All months</option>
                        {availableMonths.map((ym) => <option key={ym} value={ym}>{formatMonthOnly(ym)}</option>)}
                      </select>
                      {selectedYm && (
                        <div className="flex flex-wrap rounded-2xl bg-slate-100 p-0.5">
                          <button
                            type="button"
                            onClick={() => handleHalfChange('ALL')}
                            className={`px-3 py-1 rounded-full text-[11px] font-bold transition whitespace-nowrap ${selectedHalf === 'ALL' ? 'bg-white shadow text-slate-900' : 'text-slate-400'}`}
                          >
                            Whole Month
                          </button>
                          <button
                            type="button"
                            onClick={() => handleHalfChange('H1')}
                            className={`px-3 py-1 rounded-full text-[11px] font-bold transition whitespace-nowrap ${selectedHalf === 'H1' ? 'bg-white shadow text-slate-900' : 'text-slate-400'}`}
                          >
                            1st Half
                          </button>
                          <button
                            type="button"
                            onClick={() => handleHalfChange('H2')}
                            className={`px-3 py-1 rounded-full text-[11px] font-bold transition whitespace-nowrap ${selectedHalf === 'H2' ? 'bg-white shadow text-slate-900' : 'text-slate-400'}`}
                          >
                            2nd Half
                          </button>
                        </div>
                      )}
                      {monthFilter && <button onClick={() => setMonthFilter('')} className="text-slate-400 text-xs font-bold hover:text-slate-600">Clear</button>}
                    </div>
                  </div>
                  {filteredHistory.length > 0 && (
                    <div className="flex items-center justify-end gap-2 mb-3">
                      <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wide mr-1">Export:</span>
                      <button
                        type="button"
                        onClick={exportAttendanceCSV}
                        className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-[11px] font-bold px-3 py-1.5 rounded-full hover:bg-slate-200 transition"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        CSV
                      </button>
                      <button
                        type="button"
                        onClick={exportAttendancePDF}
                        className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-[11px] font-bold px-3 py-1.5 rounded-full hover:bg-slate-200 transition"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        PDF
                      </button>
                    </div>
                  )}
                  <div className="space-y-2">
                    {initLoading && <LoadingRow label="Loading..." />}
                    {!initLoading && filteredHistory.length === 0 && <p className="text-slate-400 text-xs">No records{monthFilter ? ' for this selected period' : ''}.</p>}
                    {filteredHistory.map((log, index) => (
                      <div key={index} className="flex items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 text-xs">{new Date(log.log_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                          <div className="text-slate-400 text-[10px]">{log.log_date}</div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={statusTagClass(log.status)}>{log.status}</span>
                          <div className="text-right">
                            <div className="font-semibold text-slate-700 text-xs">
                              {log.time_in ? new Date(log.time_in).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }) : '--:--'}
                              {log.time_out && <> – {new Date(log.time_out).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' })}</>}
                            </div>
                            {/* Single "Dispute" button -- lets the employee pick Time In or
                                Time Out on the choice screen, instead of two separate,
                                cramped buttons. Only one pending dispute is allowed per
                                date, so a single pending badge covers either type. */}
                            <div className="mt-1.5 flex justify-end">
                              {(() => {
                                const canDisputeTimeOut = !log.time_out && log.time_in;
                                const canDisputeLate = log.status?.toLowerCase() === 'late';
                                const isPending = hasPendingDispute(log.log_date, 'TimeIn') || hasPendingDispute(log.log_date, 'TimeOut');

                                if (isPending) {
                                  return (
                                    <span className="inline-flex items-center gap-1 text-orange-600 text-[9px] font-bold uppercase tracking-wide">
                                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                                      Dispute Pending
                                    </span>
                                  );
                                }

                                if (canDisputeTimeOut || canDisputeLate) {
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => openDisputeModal(log.id, log.log_date, canDisputeLate ? 'TimeIn' : 'TimeOut', false)}
                                      className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 text-[9px] font-bold uppercase tracking-wide px-3 py-1 rounded-full hover:bg-blue-100 transition whitespace-nowrap"
                                    >
                                      Dispute
                                    </button>
                                  );
                                }

                                // No time-in at all that day -- nothing to dispute yet.
                                if (!log.time_out && !log.time_in) {
                                  return <span className="text-slate-400 text-[9px] uppercase tracking-wide">No time out</span>;
                                }

                                return null;
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Summary Stat Detail Modal -- lists the exact dates behind the
          Present / Late / Absent number for the current cutoff. */}
      {summaryDetailType && summaryDetailInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm card-style shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-1 flex-shrink-0">
              <h3 className="mb-0">{summaryDetailInfo.title}</h3>
              <button
                type="button"
                onClick={() => setSummaryDetailType(null)}
                className="text-slate-400 hover:text-slate-600 transition"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <p className="text-slate-400 text-xs mb-4 flex-shrink-0">{formatMonthLabel(summaryCutoffKey)}</p>

            <div className="overflow-y-auto flex-1">
              {summaryDetailInfo.logs.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl">
                  <p className="text-2xl mb-2">📋</p>
                  <p className="text-slate-400 text-sm font-medium">{summaryDetailInfo.emptyNote}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {summaryDetailInfo.logs
                    .slice()
                    .sort((a, b) => (a.log_date < b.log_date ? 1 : -1))
                    .map((log) => (
                      <div key={log.id} className="flex items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 text-xs">{new Date(log.log_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                          <div className="text-slate-400 text-[10px]">{log.log_date}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className={statusTagClass(log.status)}>{log.status}</span>
                          {log.time_in && (
                            <div className="text-slate-500 text-[10px] mt-1">
                              {new Date(log.time_in).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' })}
                              {log.time_out && <> – {new Date(log.time_out).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' })}</>}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSummaryDetailType(null)}
              className="mt-6 w-full py-3 rounded-full bg-[#edf4ef] text-[#405047] border border-[#dce7df] font-medium text-sm hover:bg-[#e1ece4] hover:text-[#253229] transition flex-shrink-0 dark:bg-[#323833] dark:text-[#dbe7de] dark:border-[#33443a] dark:hover:bg-[#3c443e] dark:hover:text-[#f2f8f3]"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* New Announcement Toast (auto-dismisses after 6s) */}
      {showAnnouncementToast && (
        <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-6 sm:top-6 sm:max-w-sm z-50">
          <div className="rounded-2xl bg-slate-900 text-white p-4 shadow-2xl flex items-start gap-3">
            <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-green-500 flex items-center justify-center text-lg">
              📣
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">New announcement posted!</p>
              <p className="text-white/60 text-xs mt-1 line-clamp-2">{announcement}</p>
            </div>
            <button
              onClick={() => setShowAnnouncementToast(false)}
              className="text-white/40 hover:text-white flex-shrink-0"
              aria-label="Close notification"
              type="button"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* File a Dispute Modal -- two steps: "form" then a highlighted
          "confirm" review screen before the dispute is actually submitted. */}
      {disputeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm card-style shadow-2xl max-h-[90vh] overflow-y-auto">

            {disputeStep === 'choice' ? (
              <>
                {/* ── STEP 1: CHOOSE DISPUTE TYPE ── */}
                <h3 className="mb-2">File a Dispute</h3>
                <p className="text-sm text-slate-400 mb-6">
                  What would you like to report?
                </p>

                {disputeMsg && (
                  <div className={`p-3 rounded-xl text-sm font-bold mb-4 ${disputeMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {disputeMsg.text}
                  </div>
                )}

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => disputeChoiceEligibility.timeIn.eligible && selectDisputeType('TimeIn')}
                    disabled={!disputeChoiceEligibility.timeIn.eligible}
                    className={`w-full flex items-center gap-3 p-4 rounded-2xl border border-slate-100 bg-slate-50 transition text-left ${
                      disputeChoiceEligibility.timeIn.eligible ? 'hover:bg-slate-100' : 'opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 text-lg">🕗</div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 text-sm">Time In Dispute</p>
                      <p className="text-slate-400 text-xs mt-0.5">
                        {disputeChoiceEligibility.timeIn.eligible
                          ? 'Forgot to time in, or tagged Late by mistake'
                          : disputeChoiceEligibility.timeIn.reason}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => disputeChoiceEligibility.timeOut.eligible && selectDisputeType('TimeOut')}
                    disabled={!disputeChoiceEligibility.timeOut.eligible}
                    className={`w-full flex items-center gap-3 p-4 rounded-2xl border border-slate-100 bg-slate-50 transition text-left ${
                      disputeChoiceEligibility.timeOut.eligible ? 'hover:bg-slate-100' : 'opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center flex-shrink-0 text-lg">🕕</div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 text-sm">Time Out Dispute</p>
                      <p className="text-slate-400 text-xs mt-0.5">
                        {disputeChoiceEligibility.timeOut.eligible
                          ? 'Forgot to time out before leaving'
                          : disputeChoiceEligibility.timeOut.reason}
                      </p>
                    </div>
                  </button>
                </div>

                <button
                  type="button"
                  className="w-full mt-6 p-3 bg-slate-100 rounded-full font-medium text-sm"
                  onClick={() => setDisputeModalOpen(false)}
                >
                  Cancel
                </button>
              </>
            ) : disputeStep === 'form' ? (
              <>
                {/* ── STEP 2: FILL IN DETAILS ── */}
                <h3 className="mb-2">
                  {disputeForm.type === 'TimeOut'
                    ? 'Report Missed Time-Out'
                    : disputeForm.attendanceLogId ? 'Dispute Late Tag' : 'Report Missed Time-In'}
                </h3>
                <p className="text-sm text-slate-400 mb-4">
                  {disputeForm.type === 'TimeOut'
                    ? "Forgot to time out that day? Tell us what time you actually left, and HR will review it."
                    : disputeForm.attendanceLogId
                      ? "Tell us what time you actually arrived, and HR will review it."
                      : "Forgot to time in on a previous day? Let us know when you actually arrived."}
                </p>

                {disputeMsg && (
                  <div className={`p-3 rounded-xl text-sm font-bold mb-4 ${disputeMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {disputeMsg.text}
                  </div>
                )}

                {!disputeTypeLocked.current && (
                  <div className="flex items-center justify-between gap-2 mb-4 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-xs font-bold text-slate-600">
                      {disputeForm.type === 'TimeOut' ? '🕕 Time Out Dispute' : '🕗 Time In Dispute'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDisputeStep('choice')}
                      className="text-blue-600 text-xs font-bold hover:underline"
                    >
                      Change
                    </button>
                  </div>
                )}

                <label className="label-branded">Date</label>
                <input
                  type="date"
                  className="input-field mb-1"
                  value={disputeForm.date}
                  onChange={(e) => handleDisputeDateChange(e.target.value)}
                  disabled={disputeTypeLocked.current && !!disputeForm.attendanceLogId}
                  max={new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())}
                />
                {!disputeTypeLocked.current && disputeForm.type === 'TimeOut' && disputeForm.date && !disputeForm.attendanceLogId && (
                  <p className="text-orange-600 text-[11px] font-medium mb-3 ml-1">⚠️ No time-in recorded on that date yet — you can't dispute a time-out without one.</p>
                )}
                <div className="mb-3" />

                <label className="label-branded">{disputeForm.type === 'TimeOut' ? 'Time You Actually Left (Philippine Time)' : 'Time You Actually Arrived (Philippine Time)'}</label>
                <input
                  type="time"
                  className="input-field mb-4"
                  value={disputeForm.timeLocal}
                  onChange={(e) => setDisputeForm({ ...disputeForm, timeLocal: e.target.value })}
                />

                <label className="label-branded">Reason (optional)</label>
                <textarea
                  className="input-field mb-6 min-h-[80px] resize-y"
                  value={disputeForm.reason}
                  onChange={(e) => setDisputeForm({ ...disputeForm, reason: e.target.value })}
                  placeholder={disputeForm.type === 'TimeOut' ? 'e.g. I forgot to time out before leaving.' : 'e.g. I forgot to time in when I arrived.'}
                />

                <div className="flex gap-3">
                  <button
                    type="button"
                    className="flex-1 p-3 bg-slate-100 rounded-full font-medium text-sm"
                    onClick={() => {
                      if (!disputeTypeLocked.current) {
                        setDisputeStep('choice');
                      } else {
                        setDisputeModalOpen(false);
                      }
                    }}
                  >
                    {disputeTypeLocked.current ? 'Cancel' : '← Back'}
                  </button>
                  <button
                    type="button"
                    className="flex-1 btn-primary disabled:opacity-50"
                    onClick={proceedToDisputeConfirm}
                    disabled={!disputeForm.date || !disputeForm.timeLocal}
                  >
                    Review Dispute
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* ── STEP 3: CONFIRMATION -- highlighted summary before actually submitting ── */}
                <h3 className="mb-2">Confirm Your Dispute</h3>
                <p className="text-sm text-slate-400 mb-6">
                  Please review the details below before submitting. HR will see exactly this.
                </p>

                {disputeMsg && (
                  <div className={`p-3 rounded-xl text-sm font-bold mb-4 ${disputeMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {disputeMsg.text}
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="label-branded mb-0">Dispute Type</span>
                    <span className="tag-excused">
                      {disputeForm.type === 'TimeOut' ? 'Missed Time-Out' : disputeForm.attendanceLogId ? 'Late Tag' : 'Missed Time-In'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="label-branded mb-0">Date</span>
                    <span className="font-bold text-slate-800 text-sm">{disputeForm.date}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="label-branded mb-0">
                      {disputeForm.type === 'TimeOut' ? 'Time You Left' : 'Time You Arrived'}
                    </span>
                    <span className="font-bold text-slate-800 text-sm tabular-nums">
                      {formatTimeLocal(disputeForm.timeLocal)}
                    </span>
                  </div>
                  {disputeForm.reason && (
                    <div>
                      <span className="label-branded block mb-1">Reason</span>
                      <p className="text-slate-700 text-sm bg-white rounded-xl p-3 border border-blue-100">{disputeForm.reason}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    className="flex-1 p-3 bg-slate-100 rounded-full font-medium text-sm"
                    onClick={() => setDisputeStep('form')}
                    disabled={disputeSaving}
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    className="flex-1 btn-primary disabled:opacity-50"
                    onClick={submitDispute}
                    disabled={disputeSaving}
                  >
                    {disputeSaving ? (
                      <span className="flex items-center justify-center gap-2">
                        <Spinner size="sm" />
                        Submitting...
                      </span>
                    ) : 'Confirm & Submit'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Dispute Result Toast (auto-dismisses after 8s) */}
      {disputeResultToast && (
        <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-6 sm:top-24 sm:max-w-sm z-50">
          <div className={`rounded-2xl text-white p-4 shadow-2xl flex items-start gap-3 ${disputeResultToast.status === 'Approved' ? 'bg-green-600' : 'bg-rose-600'}`}>
            <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-lg">
              {disputeResultToast.status === 'Approved' ? '✅' : '❌'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">
                Dispute {disputeResultToast.status === 'Approved' ? 'Approved' : 'Declined'}
              </p>
              <p className="text-white/80 text-xs mt-1">
                Your {disputeResultToast.disputeType === 'TimeOut' ? 'time-out' : 'time-in'} dispute for {disputeResultToast.date} was {disputeResultToast.status === 'Approved' ? 'approved' : 'declined'} by HR.
              </p>
            </div>
            <button
              onClick={() => setDisputeResultToast(null)}
              className="text-white/60 hover:text-white flex-shrink-0"
              aria-label="Close notification"
              type="button"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Configurable Time-Out Reminder (in-page only) */}
      {showTimeOutReminder && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm z-50">
          <div className="rounded-2xl bg-slate-900 text-white p-4 shadow-2xl flex items-start gap-3">
            <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-lg">
              🔔
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">Don&apos;t forget to time out!</p>
              <p className="text-white/60 text-xs mt-1">It&apos;s already past {expectedTimeOutLabel}.</p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleTimeOut}
                  disabled={timeOutLoading}
                  className="text-xs font-bold bg-white text-slate-900 px-3 py-1.5 rounded-full hover:bg-white/90 transition disabled:opacity-50"
                >
                  {timeOutLoading ? 'Processing...' : 'Time Out Now'}
                </button>
                <button
                  onClick={dismissReminder}
                  className="text-xs font-bold text-white/60 hover:text-white px-3 py-1.5 transition"
                >
                  Dismiss
                </button>
              </div>
            </div>
            <button
              onClick={dismissReminder}
              className="text-white/40 hover:text-white flex-shrink-0"
              aria-label="Close reminder"
              type="button"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {/* Payslips Modal */}
      {payslipsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm card-style shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-6 flex-shrink-0">
              <h3 className="mb-0">My Payslips</h3>
              <button
                type="button"
                onClick={() => setPayslipsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {payslipsLoading ? (
                <LoadingRow label="Loading payslips..." />
              ) : payslips.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl">
                  <p className="text-2xl mb-2">📄</p>
                  <p className="text-slate-400 text-sm font-medium">No payslips yet</p>
                  <p className="text-slate-300 text-xs mt-1">HR will upload your payslip each cutoff period.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {payslips.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-3 p-4 bg-[#f8fbf8] rounded-xl border border-[#e0e9e1] dark:bg-[#2b312d] dark:border-[#25362b]">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-[#1f2a23] dark:text-[#edf6ef] text-sm truncate">{p.cutoff_label}</p>
                          {!p.acknowledged_at && <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[8px] font-extrabold uppercase tracking-wide">New</span>}
                        </div>
                        <p className="text-[#5f6f63] dark:text-[#a9b9ad] text-xs mt-0.5 truncate">{p.file_name}</p>
                        <p className="text-[#708073] dark:text-[#8fa596] text-[10px] font-semibold uppercase tracking-widest mt-1">
                          {new Date(p.uploaded_at).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        {p.acknowledged_at && <p className="text-green-600 text-[9px] font-bold mt-1">Acknowledged</p>}
                      </div>
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => downloadPayslip(p)}
                          disabled={downloadingId === p.id}
                          className="flex items-center justify-center gap-1.5 bg-[#e8f1ea] text-[#1f2a23] border border-[#d2e0d5] text-[10px] font-bold px-3 py-2 rounded-full hover:bg-[#dce9df] transition disabled:opacity-50 dark:bg-[#343b36] dark:text-[#eaf3ec] dark:border-[#3a5040] dark:hover:bg-[#404943]"
                        >
                          {downloadingId === p.id ? <><Spinner size="sm" />Downloading...</> : 'Download'}
                        </button>
                        {!p.acknowledged_at && (
                          <button
                            type="button"
                            onClick={() => acknowledgePayslip(p.id)}
                            disabled={acknowledgingPayslipId === p.id}
                            className="text-blue-600 text-[9px] font-bold hover:underline disabled:opacity-50"
                          >
                            {acknowledgingPayslipId === p.id ? 'Saving...' : 'Acknowledge'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setPayslipsModalOpen(false)}
              className="mt-6 w-full py-3 rounded-full bg-[#e8f1ea] text-[#2b3a30] font-semibold text-sm hover:bg-[#dce9df] transition flex-shrink-0 dark:bg-[#343b36] dark:text-[#eaf3ec] dark:hover:bg-[#404943]"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Weather + Live Traffic Route Checker */}
      {commuteModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 backdrop-blur-sm p-3 sm:p-4">
          <div className="w-full max-w-2xl card-style shadow-2xl max-h-[92vh] overflow-y-auto !p-4 sm:!p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0 text-lg">
                  🚗
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="mb-0">Plan My Commute</h3>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[8px] font-extrabold uppercase tracking-wider">
                      Live
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs mt-1">
                    Weather and traffic advice across your selected route.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCommuteModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition flex-shrink-0"
                aria-label="Close commute assistant"
              >
                ×
              </button>
            </div>

            <section className="rounded-3xl bg-slate-50/80 border border-slate-200 p-3.5 sm:p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.16em] font-extrabold text-slate-500">
                    Plan your route
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Select an exact address for better route accuracy.
                  </p>
                </div>
                <span className="hidden sm:inline-flex rounded-full bg-white border border-slate-200 px-2.5 py-1 text-[8px] font-extrabold text-slate-500">
                  PH
                </span>
              </div>
            <div className="grid sm:grid-cols-[1fr_auto_1fr] gap-2.5 items-end">
              <div className="relative">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label-branded mb-0">From</label>
                  <span className="text-[9px] font-bold text-slate-400">Starting point</span>
                </div>
                <div className="relative">
                  <div className="relative">
                    <input
                      value={commuteOrigin}
                      onChange={(e) => {
                        const value = e.target.value;
                        setCommuteOrigin(value);
                        setSelectedOriginAddress(null);
                        setShowOriginSuggestions(true);
                        scheduleAddressSearch(value, 'origin');
                      }}
                      onFocus={() => {
                        if (originSuggestions.length > 0) {
                          setShowOriginSuggestions(true);
                        } else if (commuteOrigin.trim().length >= 3) {
                          scheduleAddressSearch(commuteOrigin, 'origin');
                        }
                      }}
                      onBlur={() => {
                        window.setTimeout(() => {
                          setShowOriginSuggestions(false);
                        }, 180);
                      }}
                      autoComplete="off"
                      className="input-field w-full"
                      placeholder="Type an exact address..."
                    />

                    {originSearchLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Spinner size="sm" />
                      </div>
                    )}

                    {showOriginSuggestions && originSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full z-[100] mt-1.5 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
                        {originSuggestions.map((place, index) => (
                          <button
                            key={`origin-${place.id}-${place.latitude}-${place.longitude}-${index}`}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selectAddressSuggestion(place, 'origin')}
                            className="w-full px-3.5 py-3 text-left border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition"
                          >
                            <div className="flex items-start gap-2.5">
                              <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs">
                                📍
                              </span>
                              <div className="min-w-0">
                                <p className="text-xs font-extrabold text-slate-900 truncate">
                                  {place.name}
                                </p>
                                {place.address && (
                                  <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                                    {place.address}
                                  </p>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              </div>

              <button
                type="button"
                onClick={useCurrentLocationForCommute}
                className="hidden sm:flex w-10 h-11 mb-[1px] rounded-2xl bg-white border border-slate-200 text-slate-600 text-sm font-bold items-center justify-center hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition shadow-sm"
                title="Use my current location"
                aria-label="Use my current location"
              >
                ◎
              </button>

              <div className="relative">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label-branded mb-0">To</label>
                  <span className="text-[9px] font-bold text-slate-400">Destination</span>
                </div>
                <div className="relative">
                  <input
                    value={commuteDestination}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCommuteDestination(value);
                      setSelectedDestinationAddress(null);
                      setShowDestinationSuggestions(true);
                      scheduleAddressSearch(value, 'destination');
                    }}
                    onFocus={() => {
                      if (destinationSuggestions.length > 0) {
                        setShowDestinationSuggestions(true);
                      } else if (commuteDestination.trim().length >= 3) {
                        scheduleAddressSearch(commuteDestination, 'destination');
                      }
                    }}
                    onBlur={() => {
                      window.setTimeout(() => {
                        setShowDestinationSuggestions(false);
                      }, 180);
                    }}
                    autoComplete="off"
                    className={`input-field w-full transition-shadow ${
                      commuteResult?.highlight_route_for_rain ||
                      commuteResult?.highlight_destination_for_rain ||
                      commuteResult?.weather?.rain_alert?.active ||
                      Number(commuteResult?.weather?.rain_probability ?? 0) >= 50
                        ? Number(commuteResult?.route_weather_summary?.highest_rain_probability ?? commuteResult?.weather?.rain_probability ?? 0) >= 85
                          ? '!border-red-400 ring-2 ring-red-200/70'
                          : Number(commuteResult?.route_weather_summary?.highest_rain_probability ?? commuteResult?.weather?.rain_probability ?? 0) >= 70
                            ? '!border-orange-400 ring-2 ring-orange-200/70'
                            : '!border-amber-400 ring-2 ring-amber-200/70'
                        : ''
                    }`}
                    placeholder="Type an exact address..."
                  />

                  {destinationSearchLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Spinner size="sm" />
                    </div>
                  )}

                  {showDestinationSuggestions && destinationSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-[100] mt-1.5 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
                      {destinationSuggestions.map((place, index) => (
                        <button
                          key={`destination-${place.id}-${place.latitude}-${place.longitude}-${index}`}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectAddressSuggestion(place, 'destination')}
                          className="w-full px-3.5 py-3 text-left border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition"
                        >
                          <div className="flex items-start gap-2.5">
                            <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs">
                              📍
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-extrabold text-slate-900 truncate">
                                {place.name}
                              </p>
                              {place.address && (
                                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                                  {place.address}
                                </p>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {commuteResult && (() => {
                    const routeWettest = commuteResult.route_weather_summary?.wettest_checkpoint;
                    const rainChance = Number(
                      routeWettest?.rain_probability ?? commuteResult.weather?.rain_probability ?? 0
                    );
                    const active = commuteResult.highlight_route_for_rain ||
                      commuteResult.destination_weather_alert?.active ||
                      commuteResult.weather?.rain_alert?.active ||
                      rainChance >= 50;
                    if (!active) return null;
                    return (
                      <div className={`mt-2 rounded-xl border px-3 py-2 ${
                        rainChance >= 85
                          ? 'bg-red-50 border-red-200'
                          : rainChance >= 70
                            ? 'bg-orange-50 border-orange-200'
                            : 'bg-amber-50 border-amber-200'
                      }`}>
                        <p className="text-[10px] font-extrabold text-slate-900">
                          ☔ {Math.round(rainChance)}% rain chance
                          {routeWettest?.location_name ? ` near ${shortCommutePlace(routeWettest.location_name, 'your route')}` : ' at the destination'}
                        </p>
                        <p className="text-[9px] text-slate-600 mt-0.5">
                          {routeWettest?.rain_intensity_label || commuteResult.weather?.rain_intensity_label || 'Rain possible'}
                          {routeWettest?.arrival_time ? ` · around ${formatCommuteClock(routeWettest.arrival_time)}` : ''}
                          {routeWettest?.precipitation_mm != null
                            ? ` · ${formatRainAmount(routeWettest.precipitation_mm)} possible`
                            : ''}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

              <button
                type="button"
                onClick={useCurrentLocationForCommute}
                className="sm:hidden mt-2 w-full py-2 rounded-xl bg-white border border-slate-200 text-[10px] font-extrabold text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition"
              >
                ◎ Use my current location
              </button>

              <div className="grid grid-cols-2 gap-2.5 mt-3">
                <div>
                  <label className="label-branded mb-1.5 block">Date</label>
                  <input
                    type="date"
                    value={commuteDepartureDate}
                    min={getManilaDateTimeInputs().date}
                    max={getManilaForecastMaxDate()}
                    onChange={(event) => setCommuteDepartureDate(event.target.value)}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="label-branded mb-1.5 block">Departure</label>
                  <input
                    type="time"
                    step="1800"
                    value={commuteDepartureTime}
                    onChange={(event) => setCommuteDepartureTime(event.target.value)}
                    className="input-field w-full"
                  />
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-200/80">
                <p className="text-[9px] uppercase tracking-[0.16em] font-extrabold text-slate-500">
                  Advice includes
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                  {[
                    ['☁️', 'Route weather'],
                    ['🌧️', 'Rain risk'],
                    ['🚗', 'Traffic delays'],
                    ['◷', 'Best departure'],
                  ].map(([icon, label]) => {
                    const trafficUnavailable = label === 'Traffic delays' && commuteResult?.partial?.traffic_available === false;
                    return (
                      <div
                        key={label}
                        className={`min-h-10 rounded-xl border px-2.5 py-2 flex items-center gap-2 text-[9px] font-extrabold ${
                          trafficUnavailable
                            ? 'bg-slate-100 border-slate-200 text-slate-400'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        }`}
                      >
                        <span aria-hidden="true">{icon}</span>
                        <span>{label}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2.5 flex items-center gap-2 text-[9px] font-bold text-emerald-700">
                  <span className={commuteLoading ? 'animate-spin' : ''} aria-hidden="true">↻</span>
                  <span>{commuteLoading ? 'Updating your route…' : 'Auto-updates when your trip changes'}</span>
                </div>
              </div>

            <div className="mt-3 pt-3 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-xs">
                    ✨
                  </span>
                  <div>
                    <p className="text-[10px] font-extrabold text-slate-700 leading-none">
                      AI advisory
                    </p>
                    <p className="text-[9px] text-slate-400 mt-1">
                      Choose recommendation language
                    </p>
                  </div>
                </div>
              </div>

              <div className="inline-flex w-full sm:w-auto items-center rounded-xl bg-slate-100 p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setCommuteLanguage('en')}
                  aria-pressed={commuteLanguage === 'en'}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[10px] font-extrabold transition-all ${
                    commuteLanguage === 'en'
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setCommuteLanguage('tl')}
                  aria-pressed={commuteLanguage === 'tl'}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[10px] font-extrabold transition-all ${
                    commuteLanguage === 'tl'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Filipino
                </button>
              </div>
            </div>

            </section>

            {commuteError && (
              <div className={`mt-3 rounded-2xl border p-3.5 ${commuteResult ? 'bg-orange-50 border-orange-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-start gap-2.5">
                  <span className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 ${commuteResult ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`} aria-hidden="true">
                    {commuteResult ? '!' : '×'}
                  </span>
                  <div className="min-w-0">
                    <p className={`text-xs font-extrabold ${commuteResult ? 'text-orange-900' : 'text-red-900'}`}>
                      {commuteResult ? 'Some live data could not be refreshed' : 'Unable to load this trip'}
                    </p>
                    <p className={`text-[10px] mt-1 ${commuteResult ? 'text-orange-700' : 'text-red-700'}`}>{commuteError}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={checkCommuteRoute}
                  disabled={commuteLoading}
                  className={`mt-3 w-full min-h-10 rounded-xl text-[10px] font-extrabold transition disabled:opacity-50 ${
                    commuteResult
                      ? 'bg-orange-600 text-white hover:bg-orange-700'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  {commuteLoading ? 'Retrying…' : 'Retry live update'}
                </button>
              </div>
            )}

            {commuteLoading && !commuteResult && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4" aria-live="polite">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-slate-700">
                    <Spinner size="sm" />
                    Updating route…
                  </div>
                  <span className="text-[9px] font-bold text-slate-400">Live forecast</span>
                </div>
                <div className="mt-4 space-y-3 animate-pulse">
                  <div className="h-3 w-2/3 rounded-full bg-slate-200" />
                  <div className="h-2.5 w-1/3 rounded-full bg-slate-100" />
                  <div className="flex items-center gap-2 py-3">
                    {[0, 1, 2].map((index) => (
                      <div key={index} className="flex-1 flex items-center gap-2">
                        <div className="h-9 w-9 rounded-full bg-slate-200 flex-shrink-0" />
                        {index < 2 && <div className="h-1 flex-1 rounded-full bg-slate-200" />}
                      </div>
                    ))}
                  </div>
                  <div className="h-14 rounded-xl bg-slate-100" />
                </div>
                <p className="text-[9px] text-slate-400 mt-3">TomTom route · Open-Meteo forecast</p>
              </div>
            )}

            {!commuteHasAttempted && !commuteLoading && (
              <p className="mt-3 text-center text-[9px] text-slate-400">
                Select your route and departure time. Advice will load automatically.
              </p>
            )}

            {commuteResult && (
              <div className="mt-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-3.5 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${
                        commuteLoading || commuteResult.data_status === 'partial'
                          ? 'bg-orange-500 animate-pulse'
                          : 'bg-emerald-500'
                      }`} />
                      <p className="text-[10px] font-extrabold text-emerald-800">
                        {commuteLoading
                          ? 'Updating route…'
                          : commuteResult.data_status === 'partial'
                            ? `Partial data · Updated ${formatCommuteUpdatedAt(commuteResult.freshness?.overall_updated_at || commuteResult.generated_at)}`
                            : `Live · Updated ${formatCommuteUpdatedAt(commuteResult.freshness?.overall_updated_at || commuteResult.generated_at)}`}
                      </p>
                    </div>
                    <p className="text-[9px] text-slate-500 mt-1 truncate">
                      {shortCommutePlace(commuteResult.origin?.name, 'Origin')} → {shortCommutePlace(commuteResult.destination?.name, 'Destination')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={checkCommuteRoute}
                    disabled={commuteLoading}
                    className="min-h-9 px-3 rounded-xl bg-white border border-emerald-200 text-emerald-700 text-[9px] font-extrabold hover:bg-emerald-100 transition disabled:opacity-50"
                  >
                    {commuteLoading ? 'Refreshing…' : '↻ Refresh'}
                  </button>
                </div>

                {commuteResult.route ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="label-branded">ETA</p>
                    <p className="stat-number text-lg text-slate-900">{formatCommuteMinutes(commuteResult.route?.eta_minutes)}</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="label-branded">Distance</p>
                    <p className="stat-number text-lg text-slate-900">{formatCommuteDistance(commuteResult.route?.distance_km)}</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="label-branded">Traffic Delay</p>
                    <p className="stat-number text-lg text-orange-600">+{formatCommuteMinutes(commuteResult.route?.delay_minutes)}</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="label-branded">Traffic</p>
                    <p
                      className={`stat-number text-lg ${
                        commuteResult.route?.traffic_level === 'Light'
                          ? 'text-green-600'
                          : commuteResult.route?.traffic_level === 'Moderate'
                            ? 'text-orange-600'
                            : 'text-red-600'
                      }`}
                    >
                      {commuteResult.route?.traffic_level ?? 'Unknown'}
                    </p>
                  </div>
                </div>
                ) : (
                  <div className="rounded-2xl border border-orange-200 bg-orange-50 p-3.5 flex items-start gap-3">
                    <span className="w-8 h-8 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center flex-shrink-0" aria-hidden="true">🚗</span>
                    <div>
                      <p className="text-xs font-extrabold text-orange-900">Live traffic unavailable</p>
                      <p className="text-[10px] text-orange-700 mt-1">Destination weather is available, but ETA and traffic delay could not be refreshed.</p>
                    </div>
                  </div>
                )}

                {commuteResult.route_weather_summary?.available && commuteResult.route_weather_checkpoints && commuteResult.route_weather_checkpoints.length > 0 && (
                  <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                    <div className="px-3.5 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                      <div>
                        <p className="text-xs font-extrabold text-slate-900">Weather along your route</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">
                          Forecast matched to your estimated passing time
                        </p>
                      </div>
                      <span className="text-[8px] font-extrabold text-slate-500">
                        {commuteResult.route_weather_checkpoints.length} checkpoints · max 5
                      </span>
                    </div>

                    <div className="p-3 sm:p-3.5">
                      <div className="flex flex-col sm:flex-row sm:items-stretch gap-2">
                        {commuteResult.route_weather_checkpoints.map((checkpoint, index) => {
                          const rainChance = Number(checkpoint.rain_probability ?? 0);
                          const isAlert = checkpoint.rain_alert === true || rainChance >= 50;
                          const isStrongAlert = rainChance >= 70;
                          return (
                            <div key={`${checkpoint.index}-${checkpoint.lat}-${checkpoint.lon}`} className="contents">
                              <div
                                className={`relative flex-1 min-w-0 rounded-2xl border p-3 ${
                                  !checkpoint.available
                                    ? 'bg-slate-50 border-slate-200'
                                    : isStrongAlert
                                      ? 'bg-orange-50 border-orange-300'
                                      : isAlert
                                        ? 'bg-amber-50 border-amber-200'
                                        : 'bg-emerald-50/50 border-emerald-100'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className="text-base" aria-hidden="true">
                                    {!checkpoint.available ? '–' : isStrongAlert ? '🌧️' : isAlert ? '🌦️' : '☁️'}
                                  </span>
                                  <span className={`text-[9px] font-extrabold ${isStrongAlert ? 'text-orange-700' : isAlert ? 'text-amber-700' : 'text-emerald-700'}`}>
                                    {checkpoint.available && checkpoint.rain_probability != null ? `${Math.round(checkpoint.rain_probability)}%` : 'N/A'}
                                  </span>
                                </div>
                                <p className={`text-[10px] font-extrabold mt-2 truncate ${isStrongAlert ? 'text-orange-900' : 'text-slate-900'}`} title={checkpoint.location_name}>
                                  {shortCommutePlace(checkpoint.location_name, `Checkpoint ${index + 1}`)}
                                </p>
                                <p className="text-[9px] text-slate-500 mt-0.5">{formatCommuteClock(checkpoint.arrival_time)}</p>
                                <p className="text-[9px] font-semibold text-slate-600 mt-2">
                                  {checkpoint.available ? checkpoint.condition_label || checkpoint.rain_intensity_label || 'Forecast available' : 'Forecast unavailable'}
                                </p>
                                {checkpoint.available && checkpoint.precipitation_mm != null && checkpoint.precipitation_mm >= 0.1 && (
                                  <p className={`text-[9px] font-extrabold mt-1 ${isStrongAlert ? 'text-orange-700' : 'text-amber-700'}`}>
                                    {formatRainAmount(checkpoint.precipitation_mm)} possible
                                  </p>
                                )}
                              </div>
                              {index < commuteResult.route_weather_checkpoints!.length - 1 && (
                                <div className="hidden sm:flex w-4 items-center justify-center" aria-hidden="true">
                                  <span className="h-0.5 w-full bg-emerald-300" />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {commuteResult.route_weather_summary?.recommendation && (
                        <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2.5 flex items-start gap-2">
                          <span className="text-base flex-shrink-0" aria-hidden="true">☂️</span>
                          <p className="text-[10px] font-semibold text-slate-700 leading-relaxed">
                            {commuteResult.route_weather_summary.recommendation}
                          </p>
                        </div>
                      )}

                      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[8px] text-slate-400">
                        <span>TomTom route</span>
                        <span>·</span>
                        <span>Open-Meteo forecast</span>
                        <span>·</span>
                        <span>Asia/Manila</span>
                        <span className="sm:ml-auto">Forecast may change.</span>
                      </div>
                    </div>
                  </section>
                )}

                {commuteResult.data_status === 'partial' && (
                  <div className="rounded-2xl border border-orange-200 bg-orange-50 p-3.5">
                    <p className="text-xs font-extrabold text-orange-900">Partial data</p>
                    <p className="text-[10px] text-orange-700 mt-1">
                      {commuteResult.partial?.traffic_available === false
                        ? 'Weather is available, but live traffic could not be refreshed. ETA may be less accurate.'
                        : commuteResult.partial?.route_weather_available === false
                          ? 'Live traffic is available, but weather checkpoints could not be refreshed. ETA remains usable.'
                          : 'Some destination weather details could not be refreshed. Available route data remains usable.'}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[8px] font-bold text-orange-700/80">
                      <span>Traffic updated {formatCommuteUpdatedAt(commuteResult.freshness?.traffic_updated_at)}</span>
                      <span>Weather updated {formatCommuteUpdatedAt(commuteResult.freshness?.weather_updated_at)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={checkCommuteRoute}
                      disabled={commuteLoading}
                      className="mt-3 w-full min-h-10 rounded-xl bg-orange-600 text-white text-[10px] font-extrabold hover:bg-orange-700 transition disabled:opacity-50"
                    >
                      {commuteLoading ? 'Retrying…' : 'Retry missing live data'}
                    </button>
                  </div>
                )}

                {commuteResult.ai_advisory && (() => {
                  const advisory = commuteResult.ai_advisory;
                  const isTl = advisory.language === 'tl';

                  const status = advisory.status || 'good_to_go';
                  const statusMeta =
                    status === 'consider_alternate_route'
                      ? {
                          icon: '🔴',
                          label: isTl ? 'ISIPIN ANG IBANG RUTA' : 'CONSIDER ALTERNATE ROUTE',
                          card: 'bg-red-50 border-red-200',
                          badge: 'bg-red-600 text-white',
                          title: 'text-red-950',
                        }
                      : status === 'expect_delays'
                        ? {
                            icon: '🟠',
                            label: isTl ? 'ASAHAN ANG PAGKAANTALA' : 'EXPECT DELAYS',
                            card: 'bg-orange-50 border-orange-200',
                            badge: 'bg-orange-500 text-white',
                            title: 'text-orange-950',
                          }
                        : status === 'leave_early'
                          ? {
                              icon: '🟡',
                              label: isTl ? 'UMALIS NANG MAS MAAGA' : 'LEAVE EARLY',
                              card: 'bg-amber-50 border-amber-200',
                              badge: 'bg-amber-500 text-white',
                              title: 'text-amber-950',
                            }
                          : {
                              icon: '🟢',
                              label: isTl ? 'MAAYOS ANG BIYAHE' : 'GOOD TO GO',
                              card: 'bg-emerald-50 border-emerald-200',
                              badge: 'bg-emerald-600 text-white',
                              title: 'text-emerald-950',
                            };

                  return (
                    <div className={`p-4 rounded-2xl border ${statusMeta.card}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[9px] uppercase tracking-[0.18em] font-extrabold text-slate-500">
                            {isTl ? 'AI Desisyon sa Biyahe' : 'AI Commute Decision'}
                          </p>

                          <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-extrabold ${statusMeta.badge}`}>
                              <span>{statusMeta.icon}</span>
                              {advisory.status_label || statusMeta.label}
                            </span>

                            <span className="rounded-full bg-white/80 border border-black/5 px-2 py-1 text-[9px] font-extrabold text-slate-600">
                              {isTl ? 'FILIPINO' : 'ENGLISH'}
                            </span>
                          </div>

                          <p className={`text-sm font-extrabold mt-2 ${statusMeta.title}`}>
                            {advisory.headline || (isTl ? 'Abiso sa Biyahe' : 'Commute Advisory')}
                          </p>
                        </div>

                        {Number(advisory.recommended_extra_minutes ?? 0) > 0 && (
                          <div className="flex-shrink-0 rounded-2xl bg-white/80 border border-black/5 px-3 py-2 text-center shadow-sm">
                            <p className="text-[8px] uppercase tracking-wider font-extrabold text-slate-400">
                              {isTl ? 'Allowance' : 'Extra Time'}
                            </p>
                            <p className="text-lg font-black text-slate-900 leading-none mt-1">
                              +{Math.round(Number(advisory.recommended_extra_minutes))}
                              <span className="text-[9px] ml-0.5">min</span>
                            </p>
                          </div>
                        )}
                      </div>

                      {advisory.summary && (
                        <p className="text-xs text-slate-700 leading-relaxed mt-3">
                          {advisory.summary}
                        </p>
                      )}

                      {Array.isArray(advisory.key_reasons) && advisory.key_reasons.length > 0 && (
                        <div className="mt-3 rounded-xl bg-white/70 border border-black/5 p-3">
                          <p className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500">
                            {isTl ? 'Bakit ito ang rekomendasyon' : 'Why this recommendation'}
                          </p>
                          <div className="mt-2 space-y-1.5">
                            {advisory.key_reasons.slice(0, 3).map((reason, index) => (
                              <div key={`${reason}-${index}`} className="flex items-start gap-2 text-[10px] text-slate-700 leading-relaxed">
                                <span className="mt-[5px] h-1.5 w-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                                <span>{reason}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="grid sm:grid-cols-2 gap-2 mt-3">
                        {advisory.traffic_summary && (
                          <div className="rounded-xl bg-white/70 border border-black/5 p-3">
                            <p className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500">
                              {isTl ? 'Trapiko' : 'Traffic'}
                            </p>
                            <p className="text-[10px] text-slate-700 mt-1 leading-relaxed">
                              {advisory.traffic_summary}
                            </p>
                          </div>
                        )}

                        {advisory.weather_summary && (
                          <div className="rounded-xl bg-white/70 border border-black/5 p-3">
                            <p className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500">
                              {isTl ? 'Panahon' : 'Weather'}
                            </p>
                            <p className="text-[10px] text-slate-700 mt-1 leading-relaxed">
                              {advisory.weather_summary}
                            </p>
                          </div>
                        )}
                      </div>

                      {advisory.recommendation && (
                        <div className="mt-3 rounded-xl bg-slate-950 dark:bg-[#343a36] text-white dark:text-[#f7faf8] border border-transparent dark:border-[#4b554e] p-3.5">
                          <p className="text-[9px] uppercase tracking-wider font-extrabold text-white/60">
                            {isTl ? 'Gawin ngayon' : 'What to do'}
                          </p>
                          <p className="text-xs font-semibold mt-1 leading-relaxed">
                            {advisory.recommendation}
                          </p>
                        </div>
                      )}

                      <p className="text-[9px] text-slate-400 mt-3 leading-relaxed">
                        {isTl
                          ? 'Ang AI advice ay base lamang sa route, traffic incident, at weather data na ipinakita sa itaas. Ang incident delay ay hindi awtomatikong idinadagdag sa kabuuang ETA.'
                          : 'AI advice is based only on the route, traffic incident, and weather data shown above. Individual incident delays are not automatically added to the total ETA.'}
                      </p>
                    </div>
                  );
                })()}

                {commuteResult.weather && (!commuteResult.route_weather_checkpoints || commuteResult.route_weather_checkpoints.length === 0) && (() => {
                  const weatherHighlight = getCommuteWeatherHighlight(commuteResult.weather);
                  const rainChance = Number(commuteResult.weather.rain_probability ?? 0);
                  const rainAlertActive = commuteResult.weather.rain_alert?.active === true || rainChance >= 50;
                  return (
                    <section className={`relative overflow-hidden p-3.5 sm:p-4 rounded-2xl border ${weatherHighlight.card}`}>
                      <span className={`absolute inset-y-0 left-0 w-1 ${weatherHighlight.accent}`} aria-hidden="true" />

                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 pl-1">
                        <div className="flex items-center gap-2">
                          <span className="w-9 h-9 rounded-xl bg-white/70 border border-white/70 flex items-center justify-center text-lg flex-shrink-0" aria-hidden="true">{weatherHighlight.icon}</span>
                          <div className="min-w-0">
                            <p className={`text-xs font-extrabold ${weatherHighlight.text}`}>Destination Weather</p>
                            <p className={`text-[10px] font-semibold mt-0.5 truncate ${weatherHighlight.text} opacity-75`}>
                              {commuteResult.destination?.name || 'Destination'}
                            </p>
                          </div>
                        </div>

                        <span className={`self-start sm:self-auto px-2.5 py-1 rounded-full text-[10px] font-extrabold ${weatherHighlight.badge}`}>
                          {weatherHighlight.label}
                        </span>
                      </div>

                      {rainAlertActive && (
                        <div className="mt-3 ml-1 rounded-xl bg-white/80 border border-white/70 px-3 py-2.5">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                            <div>
                              <p className={`text-xs font-extrabold ${weatherHighlight.text}`}>
                                ☔ {Math.round(rainChance)}% chance of rain
                              </p>
                              <p className="text-[10px] text-slate-600 mt-0.5">
                                {commuteResult.weather.rain_intensity_label || 'Rain possible at the destination.'}
                              </p>
                            </div>
                            {commuteResult.weather.expected_precipitation_next_hour_mm != null && (
                              <div className="sm:text-right">
                                <p className="text-[8px] uppercase tracking-wider font-extrabold text-slate-500">Possible next hour</p>
                                <p className={`text-sm font-black ${weatherHighlight.text}`}>
                                  {formatRainAmount(commuteResult.weather.expected_precipitation_next_hour_mm)}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 ml-1">
                        {commuteResult.weather.temperature_c != null && (
                          <div className="rounded-xl bg-white/70 border border-white/70 px-2.5 py-2">
                            <p className="text-[9px] uppercase tracking-wider font-bold text-slate-500">Temperature</p>
                            <p className="text-sm font-extrabold text-slate-900 mt-0.5">
                              🌡️ {Math.round(commuteResult.weather.temperature_c)}°C
                            </p>
                          </div>
                        )}

                        {commuteResult.weather.apparent_temperature_c != null && (
                          <div className="rounded-xl bg-white/70 border border-white/70 px-2.5 py-2">
                            <p className="text-[9px] uppercase tracking-wider font-bold text-slate-500">Feels Like</p>
                            <p className={`text-sm font-extrabold mt-0.5 ${
                              Number(commuteResult.weather.apparent_temperature_c) >= 35
                                ? 'text-orange-600'
                                : 'text-slate-900'
                            }`}>
                              ☀️ {Math.round(commuteResult.weather.apparent_temperature_c)}°C
                            </p>
                          </div>
                        )}

                        {commuteResult.weather.rain_probability != null && (
                          <div className="rounded-xl bg-white/70 border border-white/70 px-2.5 py-2">
                            <p className="text-[9px] uppercase tracking-wider font-bold text-slate-500">Rain Chance</p>
                            <p className={`text-sm font-extrabold mt-0.5 ${
                              Number(commuteResult.weather.rain_probability) >= 85
                                ? 'text-red-600'
                                : Number(commuteResult.weather.rain_probability) >= 70
                                  ? 'text-orange-600'
                                  : Number(commuteResult.weather.rain_probability) >= 50
                                    ? 'text-amber-700'
                                    : 'text-slate-900'
                            }`}>
                              ☔ {Math.round(commuteResult.weather.rain_probability)}%
                            </p>
                          </div>
                        )}

                        {commuteResult.weather.expected_precipitation_next_30_minutes_mm != null && (
                          <div className="rounded-xl bg-white/70 border border-white/70 px-2.5 py-2">
                            <p className="text-[9px] uppercase tracking-wider font-bold text-slate-500">Next 30 Min</p>
                            <p className="text-sm font-extrabold text-slate-900 mt-0.5">
                              🌧️ {formatRainAmount(commuteResult.weather.expected_precipitation_next_30_minutes_mm)}
                            </p>
                          </div>
                        )}

                        {commuteResult.weather.expected_precipitation_next_hour_mm != null && (
                          <div className="rounded-xl bg-white/70 border border-white/70 px-2.5 py-2">
                            <p className="text-[9px] uppercase tracking-wider font-bold text-slate-500">Next Hour</p>
                            <p className={`text-sm font-extrabold mt-0.5 ${rainAlertActive ? weatherHighlight.text : 'text-slate-900'}`}>
                              💧 {formatRainAmount(commuteResult.weather.expected_precipitation_next_hour_mm)}
                            </p>
                          </div>
                        )}

                        {commuteResult.weather.wind_speed_kmh != null && (
                          <div className="rounded-xl bg-white/70 border border-white/70 px-2.5 py-2">
                            <p className="text-[9px] uppercase tracking-wider font-bold text-slate-500">Wind</p>
                            <p className={`text-sm font-extrabold mt-0.5 ${
                              Number(commuteResult.weather.wind_speed_kmh) >= 35
                                ? 'text-cyan-700'
                                : 'text-slate-900'
                            }`}>
                              💨 {Math.round(commuteResult.weather.wind_speed_kmh)} km/h
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="mt-2.5 ml-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-slate-500">
                        <span className="font-bold">Updated {formatWeatherBucketTime(commuteResult.weather.weather_time)}</span>
                        <span>· {commuteResult.weather.bucket_minutes || 30}-minute weather bucket</span>
                        {commuteResult.weather.relative_humidity_percent != null && (
                          <span>· Humidity {Math.round(commuteResult.weather.relative_humidity_percent)}%</span>
                        )}
                        {commuteResult.weather.wind_gust_kmh != null && (
                          <span>· Gusts {Math.round(commuteResult.weather.wind_gust_kmh)} km/h</span>
                        )}
                        {commuteResult.weather.rain_probability_method?.includes('estimate') && (
                          <span className="w-full text-slate-400">The :30 rain chance is estimated from the surrounding hourly ensemble forecast.</span>
                        )}
                      </div>
                    </section>
                  );
                })()}

                {commuteResult.route && <TrafficRouteMap result={commuteResult} />}

                {(commuteResult.incidents?.length ?? 0) > 0 && (
                  <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowCommuteIncidents((value) => !value)}
                      className="w-full p-3.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="label-branded mb-0">Traffic Incidents</p>
                          <span className="px-2 py-0.5 rounded-full bg-slate-900 dark:bg-[#3a413c] text-white text-[9px] font-extrabold border border-transparent dark:border-[#525b54]">
                            {commuteResult.incidents?.length ?? 0} LIVE
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">
                          {showCommuteIncidents ? 'Hide reported incidents' : 'View reported incidents near your route'}
                        </p>
                      </div>
                      <span className={`text-slate-500 text-lg transition-transform ${showCommuteIncidents ? 'rotate-180' : ''}`}>
                        ⌄
                      </span>
                    </button>

                    {showCommuteIncidents && (
                      <div className="px-3.5 pb-3.5 border-t border-slate-100">
                        <div className="space-y-2 mt-3">
                      {(commuteResult.incidents ?? []).slice(0, 5).map((incident, index) => {
                        const style = getTrafficLevelStyle(incident.severity);

                        return (
                          <div
                            key={incident.id || `${incident.type || 'incident'}-${index}`}
                            className="rounded-xl bg-slate-50 border border-slate-100 p-3"
                          >
                            <div className="flex items-start gap-2.5">
                              <span
                                className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${style.dot}`}
                              />

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-xs font-extrabold text-slate-900">
                                    {incident.location_label ||
                                      incident.category_label ||
                                      incident.type ||
                                      'Traffic incident'}
                                  </p>

                                  {incident.severity && (
                                    <span
                                      className={`px-2 py-0.5 rounded-full border text-[9px] font-extrabold ${style.badge}`}
                                    >
                                      {incident.severity}
                                    </span>
                                  )}
                                </div>

                                <p className="text-[10px] text-slate-600 mt-1">
                                  {incident.category_label ||
                                    incident.type ||
                                    'Traffic incident'}
                                  {incident.delay_minutes
                                    ? ` · about +${incident.delay_minutes} min`
                                    : ''}
                                  {incident.length_meters
                                    ? ` · ${Math.round(incident.length_meters)} m affected`
                                    : ''}
                                </p>

                                {(incident.from || incident.to) && (
                                  <p className="text-[10px] text-slate-500 mt-1">
                                    {incident.from || 'Start'} → {incident.to || 'End'}
                                  </p>
                                )}

                                {incident.distance_from_route_km != null && (
                                  <p className="text-[9px] text-slate-400 mt-1">
                                    {incident.distance_from_route_km <= 0.05
                                      ? 'On your route'
                                      : `${incident.distance_from_route_km.toFixed(2)} km from route`}
                                  </p>
                                )}

                                {incident.last_report_time && (
                                  <p className="text-[9px] text-slate-400 mt-1">
                                    TomTom update:{' '}
                                    {new Date(incident.last_report_time).toLocaleTimeString(
                                      'en-US',
                                      {
                                        timeZone: 'Asia/Manila',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      }
                                    )}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                        <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-slate-100 text-[9px] font-bold text-slate-500">
                          <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 mr-1" />Light</span>
                          <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 mr-1" />Moderate</span>
                          <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 mr-1" />Heavy</span>
                          <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-800 mr-1" />Severe / road closed</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}


                <div className="flex items-center gap-3 text-[10px] text-slate-500 flex-wrap">
                  <span className="font-semibold">
                    Route traffic: {commuteResult.route?.traffic_level ?? 'Unknown'}
                  </span>
                  <span>
                    Live ETA/delay from TomTom Routing
                  </span>
                  <span className="ml-auto">{commuteResult.origin?.name ?? 'Origin'} → {commuteResult.destination?.name ?? 'Destination'}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Leave Choice Modal -- pick "Request Leave" or "My Leave Requests" */}
      {leaveChoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm card-style shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <h3 className="mb-0">Leave</h3>
              <button type="button" onClick={() => setLeaveChoiceModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition" aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <p className="text-sm text-slate-400 mb-6">What would you like to do?</p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setLeaveChoiceModalOpen(false);
                  setLeaveMsg(null);
                  setLeaveForm({ leave_type: 'Sick', start_date: '', end_date: '', reason: '' });
                  setLeaveModalOpen(true);
                }}
                className="w-full flex items-center gap-3 p-4 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-slate-100 transition text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0 text-lg">📝</div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 text-sm">Request Leave</p>
                  <p className="text-slate-400 text-xs mt-0.5">{isRegular ? `${remainingCredits} credits left` : 'File a new leave request'}</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLeaveChoiceModalOpen(false);
                  setSelectedMyLeaveDetail(null);
                  setMyLeavesModalOpen(true);
                  fetchMyLeaves();
                }}
                className="w-full flex items-center gap-3 p-4 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-slate-100 transition text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0 text-lg">🗓️</div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 text-sm">My Leave Requests</p>
                  <p className="text-slate-400 text-xs mt-0.5">{myLeaves.length > 0 ? `${myLeaves.length} request${myLeaves.length === 1 ? '' : 's'}` : 'No leave requests yet'}</p>
                </div>
              </button>
            </div>

            <button
              type="button"
              className="w-full mt-6 p-3 bg-slate-100 rounded-full font-medium text-sm"
              onClick={() => setLeaveChoiceModalOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* My Leave Requests Modal -- tap a request to see its full details. */}
      {myLeavesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm card-style shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h3 className="mb-0">{selectedMyLeaveDetail ? 'Leave Details' : 'My Leave Requests'}</h3>
              <button
                type="button"
                onClick={() => { setMyLeavesModalOpen(false); setSelectedMyLeaveDetail(null); }}
                className="text-slate-400 hover:text-slate-600 transition"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {selectedMyLeaveDetail ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setSelectedMyLeaveDetail(null)}
                    className="text-blue-600 text-xs font-bold hover:underline flex items-center gap-1 mb-2"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    Back to list
                  </button>

                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 text-sm">{selectedMyLeaveDetail.leave_type} Leave</span>
                    <span className={selectedMyLeaveDetail.status === 'Approved' ? 'tag-present' : selectedMyLeaveDetail.status === 'Rejected' ? 'tag-late' : 'tag-excused'}>{selectedMyLeaveDetail.status}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                    <div>
                      <p className="label-branded mb-0.5">Dates</p>
                      <p className="text-slate-700 text-xs">
                        {selectedMyLeaveDetail.start_date === selectedMyLeaveDetail.end_date ? selectedMyLeaveDetail.start_date : `${selectedMyLeaveDetail.start_date} → ${selectedMyLeaveDetail.end_date}`}
                        {' '}({countLeaveDays(selectedMyLeaveDetail.start_date, selectedMyLeaveDetail.end_date)}d)
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="label-branded mb-1">Your Reason</p>
                    <p className="text-slate-600 text-xs bg-slate-50 rounded-xl border border-slate-100 p-3">{selectedMyLeaveDetail.reason || 'No reason provided.'}</p>
                  </div>

                  <div>
                    <p className="label-branded mb-1">HR Response</p>
                    <p className="text-slate-600 text-xs bg-slate-50 rounded-xl border border-slate-100 p-3">{selectedMyLeaveDetail.hr_notes || 'No notes were left.'}</p>
                  </div>

                  <div className="text-slate-400 text-[10px] pt-1">
                    {selectedMyLeaveDetail.reviewed_at && (
                      <p>Resolved: {new Date(selectedMyLeaveDetail.reviewed_at).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    )}
                    <p>Filed: {new Date(selectedMyLeaveDetail.created_at).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>

                  {selectedMyLeaveDetail.status === 'Pending' && (
                    <button
                      onClick={() => { cancelLeave(selectedMyLeaveDetail.id); setSelectedMyLeaveDetail(null); }}
                      className="w-full py-2.5 rounded-full bg-rose-50 text-rose-600 text-xs font-bold hover:bg-rose-100 transition"
                    >
                      Cancel This Request
                    </button>
                  )}
                </div>
              ) : myLeaves.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl">
                  <p className="text-2xl mb-2">🗓️</p>
                  <p className="text-slate-400 text-sm font-medium">No leave requests yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {myLeaves.map((l) => (
                    <div key={l.id} className="w-full flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition">
                      <button type="button" onClick={() => setSelectedMyLeaveDetail(l)} className="min-w-0 flex-1 text-left">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900 text-xs">{l.leave_type} Leave</span>
                          <span className={l.status === 'Approved' ? 'tag-present' : l.status === 'Rejected' ? 'tag-late' : 'tag-excused'}>{l.status}</span>
                        </div>
                        <div className="text-slate-400 text-[10px] mt-0.5">{l.start_date === l.end_date ? l.start_date : `${l.start_date} → ${l.end_date}`} · {countLeaveDays(l.start_date, l.end_date)}d</div>
                      </button>
                      {l.status === 'Pending' && (
                        <button
                          type="button"
                          onClick={() => cancelLeave(l.id)}
                          className="text-rose-500 hover:text-rose-700 text-xs font-bold flex-shrink-0"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                if (selectedMyLeaveDetail) {
                  setSelectedMyLeaveDetail(null);
                } else {
                  setMyLeavesModalOpen(false);
                  setLeaveChoiceModalOpen(true);
                }
              }}
              className="mt-6 w-full py-3 rounded-full bg-slate-100 text-slate-600 font-medium text-sm hover:bg-slate-200 transition flex-shrink-0"
            >
              ← Back
            </button>
          </div>
        </div>
      )}

      {/* My Disputes Modal -- tap a dispute to see its full details. */}
      {myDisputesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm card-style shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h3 className="mb-0">{selectedMyDisputeDetail ? 'Dispute Details' : 'My Disputes'}</h3>
              <button
                type="button"
                onClick={() => { setMyDisputesModalOpen(false); setSelectedMyDisputeDetail(null); }}
                className="text-slate-400 hover:text-slate-600 transition"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Filing a new dispute lives here now, instead of cluttering
                the Attendance History section -- opens the same choice
                screen (Time In / Time Out) as disputing from a specific row. */}
            {!selectedMyDisputeDetail && (
              <button
                type="button"
                onClick={() => openDisputeModal(null, '', 'TimeIn', false)}
                className="inline-flex items-center justify-center gap-1.5 w-full bg-blue-600 text-white text-xs font-bold px-3.5 py-2.5 rounded-full hover:bg-blue-700 active:scale-95 transition mb-4 flex-shrink-0 shadow-sm"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Report Missing Log
              </button>
            )}

            <div className="overflow-y-auto flex-1">
              {selectedMyDisputeDetail ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setSelectedMyDisputeDetail(null)}
                    className="text-blue-600 text-xs font-bold hover:underline flex items-center gap-1 mb-2"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    Back to list
                  </button>

                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 text-sm">{disputeTypeLabel(selectedMyDisputeDetail)}</span>
                    <span className={selectedMyDisputeDetail.status === 'Approved' ? 'tag-present' : selectedMyDisputeDetail.status === 'Rejected' ? 'tag-late' : 'tag-excused'}>{selectedMyDisputeDetail.status}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                    <div>
                      <p className="label-branded mb-0.5">Dispute Date</p>
                      <p className="text-slate-700 text-xs">{selectedMyDisputeDetail.dispute_date}</p>
                    </div>
                    {disputeOriginal(selectedMyDisputeDetail) && (
                      <div>
                        <p className="label-branded mb-0.5">Original {disputeFieldLabel(selectedMyDisputeDetail)}</p>
                        <p className="text-slate-700 text-xs">{formatDisputeTimePh(disputeOriginal(selectedMyDisputeDetail))}</p>
                      </div>
                    )}
                    <div>
                      <p className="label-branded mb-0.5">Claimed {disputeFieldLabel(selectedMyDisputeDetail)}</p>
                      <p className="text-slate-700 text-xs">{disputeClaimed(selectedMyDisputeDetail) ? formatDisputeTimePh(disputeClaimed(selectedMyDisputeDetail)) : '—'}</p>
                    </div>
                  </div>

                  <div>
                    <p className="label-branded mb-1">Your Reason</p>
                    <p className="text-slate-600 text-xs bg-slate-50 rounded-xl border border-slate-100 p-3">{selectedMyDisputeDetail.reason || 'No reason provided.'}</p>
                  </div>

                  <div>
                    <p className="label-branded mb-1">HR Response</p>
                    <p className="text-slate-600 text-xs bg-slate-50 rounded-xl border border-slate-100 p-3">{selectedMyDisputeDetail.hr_notes || 'No notes were left.'}</p>
                  </div>

                  <div className="text-slate-400 text-[10px] pt-1">
                    {selectedMyDisputeDetail.reviewed_at && (
                      <p>Resolved: {new Date(selectedMyDisputeDetail.reviewed_at).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    )}
                    <p>Filed: {new Date(selectedMyDisputeDetail.created_at).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>

                  {selectedMyDisputeDetail.status === 'Pending' && (
                    <button
                      type="button"
                      onClick={() => cancelDispute(selectedMyDisputeDetail.id)}
                      disabled={cancelingDisputeId === selectedMyDisputeDetail.id}
                      className="w-full py-2.5 rounded-full bg-rose-50 text-rose-600 text-xs font-bold hover:bg-rose-100 transition disabled:opacity-50"
                    >
                      {cancelingDisputeId === selectedMyDisputeDetail.id ? 'Cancelling...' : 'Cancel This Dispute'}
                    </button>
                  )}
                </div>
              ) : myDisputes.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl">
                  <p className="text-2xl mb-2">⚠️</p>
                  <p className="text-slate-400 text-sm font-medium">No disputes yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {myDisputes.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setSelectedMyDisputeDetail(d)}
                      className="w-full flex items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition text-left"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 text-xs truncate">{disputeTypeLabel(d)} — {d.dispute_date}</div>
                        <div className="text-slate-400 text-[10px] mt-0.5">
                          {disputeOriginal(d) && <>{formatDisputeTimePh(disputeOriginal(d))} → </>}
                          {disputeClaimed(d) && formatDisputeTimePh(disputeClaimed(d))}
                        </div>
                      </div>
                      <span className={d.status === 'Approved' ? 'tag-present' : d.status === 'Rejected' ? 'tag-late' : 'tag-excused'}>{d.status}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                if (selectedMyDisputeDetail) {
                  setSelectedMyDisputeDetail(null);
                } else {
                  setMyDisputesModalOpen(false);
                }
              }}
              className="mt-6 w-full py-3 rounded-full bg-slate-100 text-slate-600 font-medium text-sm hover:bg-slate-200 transition flex-shrink-0"
            >
              {selectedMyDisputeDetail ? '← Back' : 'Close'}
            </button>
          </div>
        </div>
      )}

      {/* Employee Directory Modal */}
      {directoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm card-style shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <div>
                <h3 className="mb-0">Employee Directory</h3>
                <p className="text-slate-400 text-xs mt-1">{directoryEmployees.length} account{directoryEmployees.length === 1 ? '' : 's'}</p>
              </div>
              <button
                type="button"
                onClick={() => setDirectoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <input
              type="text"
              placeholder="Search name or designation..."
              value={directorySearch}
              onChange={(e) => setDirectorySearch(e.target.value)}
              className="input-field !py-2 !text-xs !min-h-0 mb-4 flex-shrink-0"
            />

            <div className="overflow-y-auto flex-1 space-y-2">
              {directoryLoading && (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={`dir-skel-${i}`} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-2/3 bg-slate-200 rounded" />
                      <div className="h-3 w-1/3 bg-slate-200 rounded" />
                    </div>
                  </div>
                ))
              )}
              {!directoryLoading && filteredDirectory.length === 0 && (
                <p className="py-10 text-center text-slate-400 text-sm">
                  {directorySearch ? 'No matches found.' : 'No employees found.'}
                </p>
              )}
              {!directoryLoading && filteredDirectory.map((emp) => (
                <div key={emp.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-50 text-blue-600 font-bold text-xs flex items-center justify-center overflow-hidden">
                    {emp.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a static asset
                      <img src={emp.avatar_url} alt={emp.full_name ?? 'Employee'} className="w-full h-full object-cover" />
                    ) : (
                      directoryInitials(emp.full_name)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900 text-sm truncate">{emp.full_name || 'Unknown'}</p>
                    <p className="text-blue-600 text-xs truncate">{emp.designation || '---'}</p>
                    {emp.employee_email && (
                      <a
                        href={`mailto:${emp.employee_email}`}
                        className="text-slate-400 text-[10px] hover:text-blue-600 hover:underline truncate block mt-0.5"
                      >
                        {emp.employee_email}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setDirectoryModalOpen(false)}
              className="mt-6 w-full py-3 rounded-full bg-slate-100 text-slate-600 font-medium text-sm hover:bg-slate-200 transition flex-shrink-0"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Company Calendar Modal */}
      {calendarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm card-style shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h3 className="mb-0">Company Calendar</h3>
              <button
                type="button"
                onClick={() => setCalendarModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {holidaysLoading ? (
                <LoadingRow label="Loading holidays..." />
              ) : companyHolidays.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl">
                  <p className="text-2xl mb-2">🗓️</p>
                  <p className="text-slate-400 text-sm font-medium">No holidays set up yet.</p>
                </div>
              ) : (
                <>
                  {/* Next holiday, highlighted */}
                  {upcomingHolidays.length > 0 && (
                    <div className="bg-purple-50 border border-purple-100 rounded-2xl p-3 mb-4">
                      <p className="text-purple-600 text-[10px] font-bold uppercase tracking-widest mb-1">Next Holiday</p>
                      <p className="font-extrabold text-slate-900 text-sm">{upcomingHolidays[0].name}</p>
                      <p className="text-slate-500 text-xs mt-0.5">
                        {formatHolidayDate(upcomingHolidays[0].holiday_date)}
                        {' · '}
                        {daysUntilHoliday(upcomingHolidays[0].holiday_date) === 0
                          ? 'Today!'
                          : `${daysUntilHoliday(upcomingHolidays[0].holiday_date)} day${daysUntilHoliday(upcomingHolidays[0].holiday_date) === 1 ? '' : 's'} away`}
                      </p>
                    </div>
                  )}

                  {upcomingHolidays.length > 0 && (
                    <>
                      <p className="label-branded mb-2">Upcoming</p>
                      <div className="space-y-2 mb-4">
                        {upcomingHolidays.map((h) => (
                          <div key={h.id} className="flex items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="font-medium text-slate-900 text-xs">{h.name}</span>
                            <span className="text-slate-400 text-[10px] flex-shrink-0">{formatHolidayDate(h.holiday_date)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {pastHolidays.length > 0 && (
                    <>
                      <p className="label-branded mb-2">Past This Year</p>
                      <div className="space-y-2">
                        {pastHolidays.map((h) => (
                          <div key={h.id} className="flex items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 opacity-60">
                            <span className="font-medium text-slate-900 text-xs">{h.name}</span>
                            <span className="text-slate-400 text-[10px] flex-shrink-0">{formatHolidayDate(h.holiday_date)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setCalendarModalOpen(false)}
              className="mt-6 w-full py-3 rounded-full bg-slate-100 text-slate-600 font-medium text-sm hover:bg-slate-200 transition flex-shrink-0"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Leave Request Modal */}
      {leaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm card-style shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="mb-0">File a Leave Request</h3>
              <button type="button" onClick={() => setLeaveModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition" aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Credits badge for Regular employees */}
            {isRegular && (
              <div className={`flex items-center justify-between p-3 rounded-xl mb-4 ${remainingCredits <= 3 ? 'bg-orange-50 border border-orange-100' : 'bg-green-50 border border-green-100'}`}>
                <p className={`text-xs font-bold ${remainingCredits <= 3 ? 'text-orange-700' : 'text-green-700'}`}>
                  Leave Credits ({new Date().getFullYear()})
                </p>
                <p className={`text-sm font-extrabold ${remainingCredits <= 3 ? 'text-orange-700' : 'text-green-700'}`}>
                  {remainingCredits} / {leaveCredits?.total_credits ?? fallbackLeaveCredits} remaining
                </p>
              </div>
            )}

            {upcomingApprovedLeaves.length > 0 && (
              <div className="p-3 rounded-xl mb-4 bg-blue-50 border border-blue-100">
                <p className="text-blue-700 text-[10px] font-extrabold uppercase tracking-wide mb-2">Upcoming approved leave</p>
                <div className="space-y-1.5">
                  {upcomingApprovedLeaves.map((leave) => (
                    <div key={leave.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-slate-700">{leave.leave_type}</span>
                      <span className="text-slate-500">{leave.start_date}{leave.end_date !== leave.start_date ? ` – ${leave.end_date}` : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isRegular && (
              <div className="flex items-start gap-2 p-3 rounded-xl mb-4 bg-sky-50 border border-sky-100">
                <p className="text-xs text-sky-700 font-medium">ℹ️ Leave credits apply to Regular employees only. Your request will still be reviewed by HR.</p>
              </div>
            )}

            {leaveMsg && (
              <div className={`p-3 rounded-xl text-sm font-bold mb-4 ${leaveMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {leaveMsg.text}
              </div>
            )}

            <label className="label-branded">Leave Type</label>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {(['Sick', 'Vacation', 'Emergency'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setLeaveForm({ ...leaveForm, leave_type: t })}
                  className={`py-2.5 rounded-full text-xs font-bold transition border ${leaveForm.leave_type === t ? 'bg-[#17211b] text-white border-[#17211b] dark:bg-[#e5eee7] dark:text-[#17211b] dark:border-[#c9d9cc]' : 'bg-[#eef3ef] text-[#526054] border-transparent hover:bg-[#e2ebe4] dark:bg-[#303631] dark:text-[#c7d5ca] dark:hover:bg-[#29382f]'}`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Start/End Date -- no `min` restriction to today anymore, so
                past dates can be filed retroactively (e.g. forgot to file
                before a day already tagged "Absent" by the overnight
                sweep). Once HR approves, settle_overdue_leave_days() will
                flip that Absent tag to the specific leave type filed here. */}
            <label className="label-branded">Start Date</label>
            <input
              type="date"
              className="input-field mb-3"
              value={leaveForm.start_date}
              onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value, end_date: e.target.value })}
            />

            <label className="label-branded">End Date</label>
            <input
              type="date"
              className="input-field mb-3"
              value={leaveForm.end_date}
              onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
              min={leaveForm.start_date || undefined}
            />

            {leaveForm.start_date && leaveForm.end_date && (
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 mb-3">
                <p className="text-slate-700 text-xs font-bold">
                  📅 {countLeaveDays(leaveForm.start_date, leaveForm.end_date)} chargeable working day{countLeaveDays(leaveForm.start_date, leaveForm.end_date) === 1 ? '' : 's'}
                </p>
                <p className="text-slate-400 text-[10px] mt-1">
                  Weekends and company holidays are excluded.
                  {countLeaveHolidays(leaveForm.start_date, leaveForm.end_date) > 0 && ` ${countLeaveHolidays(leaveForm.start_date, leaveForm.end_date)} holiday${countLeaveHolidays(leaveForm.start_date, leaveForm.end_date) === 1 ? '' : 's'} excluded.`}
                </p>
                {isRegular && (
                  <p className={`text-[10px] font-bold mt-1 ${remainingCredits - countLeaveDays(leaveForm.start_date, leaveForm.end_date) < 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    Estimated balance after approval: {remainingCredits - countLeaveDays(leaveForm.start_date, leaveForm.end_date)} credit{Math.abs(remainingCredits - countLeaveDays(leaveForm.start_date, leaveForm.end_date)) === 1 ? '' : 's'}
                  </p>
                )}
                {leaveForm.start_date < todayManila && (
                  <p className="text-blue-600 text-[10px] font-bold mt-1">Filing for a past date</p>
                )}
                {isRegular && remainingCredits < countLeaveDays(leaveForm.start_date, leaveForm.end_date) && (
                  <p className="text-orange-600 text-[10px] font-bold mt-1">⚠️ This request exceeds your remaining credits.</p>
                )}
              </div>
            )}

            <label className="label-branded">Reason (optional)</label>
            <textarea
              className="input-field mb-6 min-h-[72px] resize-y"
              value={leaveForm.reason}
              onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
              placeholder="e.g. Medical appointment, family emergency..."
            />

            <div className="flex gap-3">
              <button
                type="button"
                className="flex-1 p-3 bg-slate-100 rounded-full font-medium text-sm"
                onClick={() => { setLeaveModalOpen(false); setLeaveChoiceModalOpen(true); }}
              >
                ← Back
              </button>
              <button
                type="button"
                className="flex-1 btn-primary disabled:opacity-50"
                onClick={submitLeave}
                disabled={leaveSaving || !leaveForm.start_date || !leaveForm.end_date}
              >
                {leaveSaving ? <span className="flex items-center justify-center gap-2"><Spinner size="sm" />Submitting...</span> : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Result Toast */}
      {leaveResultToast && (
        <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-6 sm:top-36 sm:max-w-sm z-50">
          <div className={`rounded-2xl text-white p-4 shadow-2xl flex items-start gap-3 ${leaveResultToast.status === 'Approved' ? 'bg-green-600' : 'bg-rose-600'}`}>
            <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-lg">
              {leaveResultToast.status === 'Approved' ? '✅' : '❌'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">Leave {leaveResultToast.status === 'Approved' ? 'Approved' : 'Declined'}</p>
              <p className="text-white/80 text-xs mt-1">Your {leaveResultToast.leave_type} leave request was {leaveResultToast.status === 'Approved' ? 'approved' : 'declined'} by HR.</p>
            </div>
            <button onClick={() => setLeaveResultToast(null)} className="text-white/60 hover:text-white flex-shrink-0" type="button">✕</button>
          </div>
        </div>
      )}

      {/* Notification Inbox Modal */}
      {notificationsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setNotificationsModalOpen(false); }}>
          <section className="w-full max-w-lg card-style shadow-2xl max-h-[88vh] flex flex-col" role="dialog" aria-modal="true" aria-label="Employee notifications">
            <div className="flex items-center justify-between gap-3 mb-4 flex-shrink-0">
              <div>
                <h3 className="mb-0">Notifications</h3>
                <p className="text-slate-400 text-xs mt-1">{unreadNotificationCount} unread</p>
              </div>
              <div className="flex items-center gap-3">
                {employeeNotifications.length > 0 && <button type="button" onClick={markAllNotificationsRead} className="text-blue-600 text-[10px] font-bold hover:underline">Mark all as read</button>}
                <button type="button" onClick={() => setNotificationsModalOpen(false)} className="text-slate-400 hover:text-slate-600" aria-label="Close notifications">✕</button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 space-y-2">
              {employeeNotifications.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
                  <p className="text-2xl mb-2">🔔</p>
                  <p className="text-slate-500 text-sm font-bold">No notifications yet</p>
                </div>
              ) : employeeNotifications.map((notification) => {
                const isUnread = !readNotificationIds.includes(notification.id);
                return (
                  <button key={notification.id} type="button" onClick={() => openNotificationTarget(notification)} className={`w-full text-left p-3 rounded-xl border transition ${isUnread ? 'employee-notification-unread bg-blue-50 border-blue-100' : 'employee-notification-read bg-slate-50 border-slate-100 opacity-75'}`}>
                    <div className="flex items-start gap-2">
                      <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${isUnread ? 'bg-blue-500' : 'bg-slate-300'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 text-xs">{notification.title}</p>
                        <p className="text-slate-500 text-[10px] mt-1 line-clamp-2">{notification.message}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* Attendance Calendar Modal */}
      {attendanceCalendarOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setAttendanceCalendarOpen(false); }}>
          <section className="w-full max-w-2xl card-style shadow-2xl max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" aria-label="Monthly attendance calendar">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="mb-0">Attendance Calendar</h3>
                <p className="text-slate-400 text-xs mt-1">Monthly attendance overview</p>
              </div>
              <button type="button" onClick={() => setAttendanceCalendarOpen(false)} className="text-slate-400 hover:text-slate-600" aria-label="Close calendar">✕</button>
            </div>
            <select value={attendanceCalendarMonth} onChange={(e) => { setAttendanceCalendarMonth(e.target.value); setSelectedAttendanceCalendarDate(null); }} className="input-field !py-2 !text-xs mb-4">
              {availableMonths.map((month) => <option key={month} value={month}>{formatMonthOnly(month)}</option>)}
            </select>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div key={day} className="text-center text-[9px] font-extrabold uppercase tracking-wide text-slate-400 py-1">{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {attendanceCalendarDays.map((cell, index) => {
                if (!cell) return <div key={`empty-${index}`} className="min-h-[66px]" />;
                const status = cell.log?.status?.toLowerCase() || '';
                const color = cell.holiday
                  ? 'bg-purple-50 border-purple-100 text-purple-700'
                  : status === 'late'
                    ? 'bg-orange-50 border-orange-100 text-orange-700'
                    : status === 'absent'
                      ? 'bg-red-50 border-red-100 text-red-700'
                      : status.includes('leave')
                        ? 'bg-blue-50 border-blue-100 text-blue-700'
                        : cell.log
                          ? 'bg-green-50 border-green-100 text-green-700'
                          : 'bg-slate-50 border-slate-100 text-slate-400';
                return (
                  <button type="button" key={cell.date} onClick={() => setSelectedAttendanceCalendarDate(cell.date)} className={`min-h-[66px] rounded-xl border p-1.5 text-left hover:-translate-y-0.5 transition ${selectedAttendanceCalendarDate === cell.date ? 'ring-2 ring-blue-400' : ''} ${color}`}>
                    <p className="text-[10px] font-extrabold">{cell.day}</p>
                    <p className="text-[8px] font-bold leading-tight mt-1 line-clamp-2">{cell.holiday || cell.log?.status || '—'}</p>
                    {cell.log?.time_in && <p className="text-[8px] mt-1">{new Date(cell.log.time_in).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' })}</p>}
                  </button>
                );
              })}
            </div>
            {selectedAttendanceCalendarDay && (
              <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="font-extrabold text-slate-900 text-xs">{selectedAttendanceCalendarDay.date}</p>
                {selectedAttendanceCalendarDay.holiday && <p className="text-purple-700 text-[10px] font-bold mt-1">{selectedAttendanceCalendarDay.holiday}</p>}
                {selectedAttendanceCalendarDay.log ? (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10px] text-slate-600">
                    <span><strong>Status:</strong> {selectedAttendanceCalendarDay.log.status}</span>
                    <span><strong>Time In:</strong> {selectedAttendanceCalendarDay.log.time_in ? new Date(selectedAttendanceCalendarDay.log.time_in).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' }) : '—'}</span>
                    <span><strong>Time Out:</strong> {selectedAttendanceCalendarDay.log.time_out ? new Date(selectedAttendanceCalendarDay.log.time_out).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' }) : '—'}</span>
                  </div>
                ) : <p className="text-slate-400 text-[10px] mt-1">No attendance record for this date.</p>}
              </div>
            )}
            <div className="flex flex-wrap gap-2 mt-4 text-[9px] font-bold">
              <span className="text-green-700">● Present</span><span className="text-orange-700">● Late</span><span className="text-red-700">● Absent</span><span className="text-blue-700">● Leave</span><span className="text-purple-700">● Holiday</span>
            </div>
          </section>
        </div>
      )}

      {/* Help Desk / HR Request Modal */}
      {supportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !supportSaving) setSupportModalOpen(false); }}>
          <section className="w-full max-w-2xl card-style shadow-2xl max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" aria-label="Help Desk and HR requests">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div><h3 className="mb-0">Help Desk / HR Request</h3><p className="text-slate-400 text-xs mt-1">Submit and track your concerns</p></div>
              <button type="button" onClick={() => setSupportModalOpen(false)} className="text-slate-400 hover:text-slate-600" aria-label="Close requests">✕</button>
            </div>
            {supportMessage && <div className={`p-3 rounded-xl mb-3 text-xs font-bold ${supportMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{supportMessage.text}</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label-branded">Category</label>
                <select value={supportForm.category} onChange={(e) => setSupportForm({ ...supportForm, category: e.target.value })} className="input-field mb-3">
                  {['IT Concern', 'Payroll Concern', 'Profile Correction', 'Government ID Correction', 'General HR Concern'].map((category) => <option key={category}>{category}</option>)}
                </select>
                <label className="label-branded">Subject</label>
                <input value={supportForm.subject} onChange={(e) => setSupportForm({ ...supportForm, subject: e.target.value })} className="input-field mb-3" maxLength={120} placeholder="Short summary" />
                <label className="label-branded">Description</label>
                <textarea value={supportForm.description} onChange={(e) => setSupportForm({ ...supportForm, description: e.target.value })} className="input-field min-h-[110px] resize-y mb-3" maxLength={2000} placeholder="Describe your concern..." />
                <button type="button" onClick={submitSupportRequest} disabled={supportSaving} className="btn-primary w-full disabled:opacity-50">{supportSaving ? 'Submitting...' : 'Submit Request'}</button>
              </div>
              <div>
                <p className="label-branded mb-2">My Requests</p>
                <div className="space-y-2 max-h-[420px] overflow-y-auto">
                  {supportLoading ? <LoadingRow label="Loading requests..." /> : supportRequests.length === 0 ? (
                    <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs">No requests submitted yet.</div>
                  ) : supportRequests.map((request) => (
                    <div key={request.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0"><p className="font-bold text-slate-900 text-xs">{request.subject}</p><p className="text-slate-400 text-[9px] mt-1">{request.category}</p></div>
                        <span className={`px-2 py-1 rounded-full text-[8px] font-extrabold uppercase ${request.status === 'Resolved' ? 'bg-green-100 text-green-700' : request.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{request.status}</span>
                      </div>
                      <p className="text-slate-500 text-[10px] mt-2 whitespace-pre-wrap">{request.description}</p>
                      {request.hr_notes && <p className="text-blue-700 text-[10px] mt-2 p-2 bg-blue-50 rounded-lg"><strong>Response:</strong> {request.hr_notes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Employee Documents Modal */}
      {documentsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setDocumentsModalOpen(false); }}>
          <section className="w-full max-w-lg card-style shadow-2xl max-h-[88vh] flex flex-col" role="dialog" aria-modal="true" aria-label="Employee documents">
            <div className="flex items-center justify-between gap-3 mb-4 flex-shrink-0">
              <div><h3 className="mb-0">My Documents</h3><p className="text-slate-400 text-xs mt-1">Policies, handbooks, and memorandums</p></div>
              <button type="button" onClick={() => setDocumentsModalOpen(false)} className="text-slate-400 hover:text-slate-600" aria-label="Close documents">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-2">
              {documentsLoading ? <LoadingRow label="Loading documents..." /> : employeeDocuments.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl"><p className="text-2xl mb-2">📚</p><p className="text-slate-500 text-sm font-bold">No documents published yet</p></div>
              ) : employeeDocuments.map((document) => (
                <div key={document.id} className="flex items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                  <div className="min-w-0"><p className="font-bold text-slate-900 text-xs truncate">{document.title}</p><p className="text-slate-400 text-[10px] mt-1">{document.category} · {new Date(document.published_at).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })}</p></div>
                  <button type="button" onClick={() => downloadEmployeeDocument(document)} disabled={downloadingDocumentId === document.id} className="px-3 py-2 rounded-full bg-teal-50 text-teal-700 text-[10px] font-bold hover:bg-teal-100 disabled:opacity-50 flex-shrink-0">{downloadingDocumentId === document.id ? 'Downloading...' : 'Download'}</button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Early Time-Out Warning Modal */}
      {showEarlyTimeOutWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm card-style shadow-2xl text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-amber-50 flex items-center justify-center text-2xl">
              ⚠️
            </div>
            <h3 className="mb-2">Time Out Early?</h3>
            <p className="text-slate-500 text-sm mb-6">
              It&apos;s not yet {expectedTimeOutLabel}. Are you sure you want to time out now?
              <br />
              <span className="text-slate-400 text-xs mt-1 block">
                Current time: {new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: true })} (PH Time)
              </span>
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                className="flex-1 p-3 bg-slate-100 rounded-full font-medium text-sm hover:bg-slate-200 transition"
                onClick={() => setShowEarlyTimeOutWarning(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 btn-danger"
                onClick={() => {
                  setShowEarlyTimeOutWarning(false);
                  handleTimeOut();
                }}
                disabled={timeOutLoading}
              >
                {timeOutLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner size="sm" />
                    Processing...
                  </span>
                ) : 'Yes, Time Out'}
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}