'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Clock3,
  CloudRain,
  Droplets,
  ExternalLink,
  MapPin,
  Navigation,
  Pencil,
  RefreshCw,
  Route,
  Thermometer,
  Wind,
} from 'lucide-react';
import {
  formatCommuteClock,
  formatCommuteDistance,
  formatCommuteMinutes,
  formatCommuteUpdatedAt,
  formatRainAmount,
  getRouteCheckpointVisual,
  getTrafficLevelStyle,
  shortCommutePlace,
  type CommuteCheckResult,
  type CommuteUIState,
  type RouteWeatherCheckpoint,
} from '@/lib/employee/commute';

type ResultView = 'overview' | 'weather' | 'traffic';
type TrafficFilter = 'All' | 'Severe' | 'Heavy' | 'Moderate';

type Props = {
  result: CommuteCheckResult;
  uiState: CommuteUIState;
  loading: boolean;
  originLabel: string;
  destinationLabel: string;
  onEdit: () => void;
  onRefresh: () => void;
};

const severityRank: Record<string, number> = { Severe: 0, Heavy: 1, Moderate: 2, Light: 3 };

const rainPercent = (checkpoint?: RouteWeatherCheckpoint | null) =>
  Math.round(Number(checkpoint?.rain_probability ?? 0));

const formatOptionalDelay = (minutes: number | null | undefined) =>
  minutes == null ? 'N/A' : `+${formatCommuteMinutes(minutes)}`;

const sortedRainCheckpoints = (checkpoints: RouteWeatherCheckpoint[]) =>
  [...checkpoints]
    .filter((checkpoint) => checkpoint.available !== false)
    .sort((a, b) => rainPercent(b) - rainPercent(a));

const rainTone = (chance: number) => {
  if (chance >= 85) {
    return {
      label: 'Very likely',
      badge: 'border-red-200 bg-red-50 text-red-700',
      panel: 'border-red-200 bg-red-50/80',
      dot: 'bg-red-500',
      bar: 'bg-red-500',
    };
  }

  if (chance >= 70) {
    return {
      label: 'Rain likely',
      badge: 'border-orange-200 bg-orange-50 text-orange-700',
      panel: 'border-orange-200 bg-orange-50/80',
      dot: 'bg-orange-500',
      bar: 'bg-orange-500',
    };
  }

  if (chance >= 50) {
    return {
      label: 'Rain watch',
      badge: 'border-amber-200 bg-amber-50 text-amber-700',
      panel: 'border-amber-200 bg-amber-50/80',
      dot: 'bg-amber-500',
      bar: 'bg-amber-500',
    };
  }

  return {
    label: 'Low risk',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    panel: 'border-emerald-200 bg-emerald-50/80',
    dot: 'bg-emerald-500',
    bar: 'bg-emerald-500',
  };
};

function ViewHeader({ title, route, onBack }: { title: string; route: string; onBack: () => void }) {
  return (
    <div className="mb-3 flex items-start gap-3">
      <button type="button" onClick={onBack} className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" aria-label="Back to commute overview">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      </button>
      <div className="min-w-0 pt-1">
        <h4 className="text-base font-black text-slate-950">{title}</h4>
        <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-slate-500">{route}</p>
      </div>
    </div>
  );
}

function StickyActions({ loading, onEdit, onRefresh }: Pick<Props, 'loading' | 'onEdit' | 'onRefresh'>) {
  return (
    <div className="commute-result-actions sticky bottom-0 z-40 -mx-3.5 mt-3 grid grid-cols-2 gap-2 border-t border-slate-200 bg-white/95 px-3.5 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:-mx-5 sm:px-5">
      <button type="button" onClick={onEdit} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-500 bg-white px-3 text-[11px] font-extrabold text-blue-700 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        Edit trip
      </button>
      <button type="button" onClick={onRefresh} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 px-3 text-[11px] font-extrabold text-white shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50">
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
        {loading ? 'Refreshing' : 'Refresh advice'}
      </button>
    </div>
  );
}

function RainRouteTimeline({ checkpoints, selectedIndex }: { checkpoints: RouteWeatherCheckpoint[]; selectedIndex?: number | null }) {
  if (checkpoints.length === 0) return null;

  return (
    <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-3.5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[.14em] text-slate-500">Rain by location</p>
          <p className="mt-0.5 text-xs font-black text-slate-950">Route weather checkpoints</p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9px] font-extrabold text-slate-600">{checkpoints.length} stops</span>
      </div>

      <div className="space-y-2">
        {checkpoints.map((checkpoint, index) => {
          const chance = rainPercent(checkpoint);
          const tone = rainTone(chance);
          const isSelected = checkpoint.index === selectedIndex;
          const name =
            index === 0
              ? 'Origin'
              : index === checkpoints.length - 1
                ? 'Destination'
                : shortCommutePlace(checkpoint.location_name, `Checkpoint ${index + 1}`);

          return (
            <div key={checkpoint.index} className={`rounded-xl border p-2.5 ${isSelected ? tone.panel : 'border-slate-100 bg-slate-50/70'}`}>
              <div className="flex items-start gap-2.5">
                <span className={`mt-1 h-2.5 w-2.5 flex-none rounded-full ${tone.dot}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-1 text-[11px] font-black text-slate-900">{name}</p>
                    <span className={`flex-none rounded-full border px-2 py-0.5 text-[8px] font-black ${tone.badge}`}>{chance}%</span>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-[9px] font-semibold text-slate-500">
                    {checkpoint.condition_label || checkpoint.rain_intensity_label || 'Forecast available'} at {formatCommuteClock(checkpoint.arrival_time)}
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                    <span className={`block h-full rounded-full ${tone.bar}`} style={{ width: `${Math.min(100, Math.max(4, chance))}%` }} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RainHotspots({ checkpoints, onOpenDetails }: { checkpoints: RouteWeatherCheckpoint[]; onOpenDetails: () => void }) {
  const hotspots = sortedRainCheckpoints(checkpoints).slice(0, 3);

  if (hotspots.length === 0) {
    return (
      <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-3.5">
        <p className="text-xs font-black text-slate-950">Rain checkpoints unavailable</p>
        <p className="mt-1 text-[10px] leading-relaxed text-slate-500">The route was checked, but location-by-location weather did not come back from the workflow.</p>
      </section>
    );
  }

  return (
    <section className="mt-3 rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[.14em] text-sky-700">Where rain may hit</p>
          <p className="mt-1 text-sm font-black text-slate-950">Wettest parts of your trip</p>
        </div>
        <button type="button" onClick={onOpenDetails} className="inline-flex min-h-9 flex-none items-center gap-1 rounded-full border border-sky-200 bg-white px-3 text-[9px] font-extrabold text-sky-700">
          Full detail
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {hotspots.map((checkpoint, index) => {
          const chance = rainPercent(checkpoint);
          const tone = rainTone(chance);
          const visual = getRouteCheckpointVisual(checkpoint);

          return (
            <article key={checkpoint.index} className={`rounded-xl border p-3 ${tone.panel}`}>
              <div className="flex items-start justify-between gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white text-sky-700 shadow-sm" aria-hidden="true">
                  {index === 0 ? <CloudRain className="h-4 w-4" /> : <Droplets className="h-4 w-4" />}
                </span>
                <span className={`rounded-full border px-2 py-0.5 text-[8px] font-black ${tone.badge}`}>{tone.label}</span>
              </div>
              <p className="mt-3 line-clamp-2 min-h-[2rem] text-[11px] font-black leading-tight text-slate-950">{shortCommutePlace(checkpoint.location_name, `Checkpoint ${index + 1}`)}</p>
              <p className="mt-1 text-2xl font-black text-slate-950">{chance}%</p>
              <p className="mt-0.5 text-[9px] font-semibold text-slate-500">
                {visual.label} - {formatRainAmount(checkpoint.precipitation_mm)} - {formatCommuteClock(checkpoint.arrival_time)}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function WeatherDetails({ result, route, onBack }: { result: CommuteCheckResult; route: string; onBack: () => void }) {
  const checkpoints = result.route_weather_checkpoints ?? [];
  const initial = result.route_weather_summary?.wettest_checkpoint?.index ?? sortedRainCheckpoints(checkpoints)[0]?.index ?? checkpoints[0]?.index ?? null;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(initial);
  const selected = checkpoints.find((item) => item.index === selectedIndex) ?? checkpoints[0];
  const visual = selected ? getRouteCheckpointVisual(selected) : null;

  if (!selected || !visual) {
    return <><ViewHeader title="Weather Details" route={route} onBack={onBack} /><div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">Detailed route weather is unavailable for this trip.</div></>;
  }

  const selectedRain = rainPercent(selected);
  const selectedTone = rainTone(selectedRain);

  return (
    <div>
      <ViewHeader title="Weather Details" route={route} onBack={onBack} />

      <div className="mb-3 overflow-x-auto rounded-2xl border border-emerald-100 bg-white p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Weather checkpoints" role="tablist">
        <div className="flex min-w-max items-start">
          {checkpoints.map((checkpoint, index) => {
            const active = checkpoint.index === selected.index;
            return (
              <div key={checkpoint.index} className="flex items-start">
                <button type="button" role="tab" onClick={() => setSelectedIndex(checkpoint.index)} aria-selected={active} className="flex min-h-14 w-24 flex-col items-center rounded-xl px-1 py-1.5 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                  <span className={`h-4 w-4 rounded-full border-[3px] ${active ? 'border-blue-600 bg-white ring-4 ring-blue-100' : index === checkpoints.length - 1 ? 'border-fuchsia-500 bg-white' : 'border-emerald-500 bg-white'}`} />
                  <span className={`mt-2 max-w-24 truncate text-[9px] font-extrabold ${active ? 'text-blue-700' : 'text-slate-600'}`}>{index === 0 ? 'Origin' : index === checkpoints.length - 1 ? 'Destination' : shortCommutePlace(checkpoint.location_name, `Stop ${index}`)}</span>
                </button>
                {index < checkpoints.length - 1 && <span className="mt-3.5 h-0.5 w-8 bg-gradient-to-r from-emerald-400 to-blue-400" aria-hidden="true" />}
              </div>
            );
          })}
        </div>
      </div>

      <section className={`overflow-hidden rounded-2xl border p-4 ${selectedTone.panel}`}>
        <div className="flex items-center gap-4">
          <span className="flex h-20 w-20 flex-none items-center justify-center rounded-2xl bg-white/80 text-sky-700 shadow-sm" aria-hidden="true">
            <CloudRain className="h-9 w-9" />
          </span>
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm font-black text-slate-950">{shortCommutePlace(selected.location_name, 'Route checkpoint')}</p>
            <p className="mt-1 text-xs font-bold text-slate-600">{visual.label}</p>
            <p className="mt-1 text-3xl font-black text-blue-700">{selected.rain_probability != null ? `${selectedRain}%` : 'N/A'}</p>
            <p className="text-[10px] text-slate-500">Passing {formatCommuteClock(selected.arrival_time)}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-xl border border-white/80 bg-white/80">
          <WeatherMetric icon={<Droplets className="h-4 w-4" />} label="Expected rain" value={selected.precipitation_mm != null ? formatRainAmount(selected.precipitation_mm) : 'N/A'} />
          <WeatherMetric icon={<Thermometer className="h-4 w-4" />} label="Temperature" value={selected.temperature_c != null ? `${Math.round(selected.temperature_c)} deg C` : 'N/A'} />
          <WeatherMetric icon={<Wind className="h-4 w-4" />} label="Wind" value={selected.wind_speed_kmh != null ? `${Math.round(selected.wind_speed_kmh)} km/h` : 'N/A'} />
          <WeatherMetric icon={<Thermometer className="h-4 w-4" />} label="Feels like" value={selected.apparent_temperature_c != null ? `${Math.round(selected.apparent_temperature_c)} deg C` : 'N/A'} helper={selected.wind_gust_kmh != null ? `Gusts ${Math.round(selected.wind_gust_kmh)} km/h` : undefined} />
        </div>
      </section>

      <RainRouteTimeline checkpoints={checkpoints} selectedIndex={selected.index} />

      <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 flex-none text-slate-400" aria-hidden="true" />
          <p className="line-clamp-3 text-[10px] font-semibold leading-relaxed text-slate-600">{selected.resolved_address || selected.location_name}</p>
        </div>
        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selected.lat},${selected.lon}`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 flex-none items-center justify-center gap-2 rounded-xl border border-blue-300 bg-blue-50 px-4 text-[10px] font-extrabold text-blue-700">
          Open Maps
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>

      {result.route_weather_summary?.recommendation && <div className="mt-3 rounded-2xl border border-indigo-100 bg-gradient-to-r from-blue-50 to-violet-50 p-3.5 text-xs font-semibold leading-relaxed text-slate-700">{result.route_weather_summary.recommendation}</div>}
      <button type="button" onClick={onBack} className="mt-5 min-h-11 w-full rounded-xl border border-blue-500 bg-white text-xs font-extrabold text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">Back to overview</button>
    </div>
  );
}

function WeatherMetric({ icon, label, value, helper }: { icon: ReactNode; label: string; value: string; helper?: string }) {
  return <div className="min-h-20 border-b border-r border-slate-200 p-3 even:border-r-0 [&:nth-last-child(-n+2)]:border-b-0"><div className="flex items-center gap-2 text-slate-500">{icon}<p className="text-sm font-black text-slate-900">{value}</p></div><p className="mt-1 text-[9px] font-semibold text-slate-500">{label}</p>{helper && <p className="mt-0.5 text-[8px] text-slate-400">{helper}</p>}</div>;
}

function TrafficDetails({ result, route, onBack }: { result: CommuteCheckResult; route: string; onBack: () => void }) {
  const [filter, setFilter] = useState<TrafficFilter>('All');
  const [showAll, setShowAll] = useState(false);
  const incidents = useMemo(() => [...(result.incidents ?? [])].sort((a, b) => (severityRank[a.severity || ''] ?? 9) - (severityRank[b.severity || ''] ?? 9)), [result.incidents]);
  const severeCount = incidents.filter((item) => item.severity === 'Severe').length;
  const availableFilters = (['All', 'Severe', 'Heavy', 'Moderate'] as TrafficFilter[]).filter((name) => name === 'All' || incidents.some((item) => item.severity === name));
  const filtered = filter === 'All' ? incidents : incidents.filter((item) => item.severity === filter);
  const visible = showAll ? filtered : filtered.slice(0, 3);

  return (
    <div>
      <ViewHeader title="Traffic Details" route={route} onBack={onBack} />
      <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <TrafficMetric icon={<Navigation className="h-4 w-4" />} value={String(incidents.length)} label="incidents" />
        <TrafficMetric icon={<AlertTriangle className="h-4 w-4" />} value={String(severeCount)} label="severe" />
        <TrafficMetric icon={<Clock3 className="h-4 w-4" />} value={formatOptionalDelay(result.route?.delay_minutes)} label="route delay" />
      </div>
      {result.partial?.traffic_available === false || result.partial?.incidents_available === false ? (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-semibold leading-relaxed text-amber-800">
          Live incident feed is limited right now. Route ETA, delay, and traffic level are still shown when available.
        </div>
      ) : null}
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Filter traffic incidents">
        {availableFilters.map((name) => <button key={name} type="button" onClick={() => { setFilter(name); setShowAll(false); }} aria-pressed={filter === name} className={`min-h-11 min-w-24 rounded-full border px-4 text-[10px] font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${filter === name ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600'}`}>{name}</button>)}
      </div>
      <div className="mt-3 space-y-2">
        {visible.map((incident, index) => {
          const style = getTrafficLevelStyle(incident.severity);
          return <article key={incident.id || `${incident.type}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-3.5"><div className="flex items-start gap-3"><span className={`flex h-10 w-10 flex-none items-center justify-center rounded-full ${incident.severity === 'Severe' ? 'bg-red-50 text-red-700' : incident.severity === 'Heavy' ? 'bg-orange-50 text-orange-700' : 'bg-amber-50 text-amber-700'}`} aria-hidden="true"><AlertTriangle className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="line-clamp-2 text-xs font-black text-slate-900">{index + 1}. {incident.location_label || incident.from || incident.category_label || 'Traffic incident'}</p>{incident.severity && <span className={`flex-none rounded-full border px-2 py-1 text-[9px] font-extrabold ${style.badge}`}>{incident.severity}</span>}</div><p className="mt-1 text-[10px] text-slate-600">{incident.category_label || incident.type || 'Reported incident'}{incident.delay_minutes ? ` - +${incident.delay_minutes} min impact` : ''}</p>{incident.distance_from_route_km != null && <p className="mt-1 text-[9px] text-slate-400">{incident.distance_from_route_km <= .05 ? 'On your route' : `${incident.distance_from_route_km.toFixed(2)} km from route`}</p>}</div></div></article>;
        })}
        {visible.length === 0 && <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">No {filter.toLowerCase()} incidents reported.</div>}
      </div>
      {!showAll && filtered.length > 3 && <button type="button" onClick={() => setShowAll(true)} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 text-xs font-extrabold text-blue-700">View {filtered.length - 3} remaining incidents <ChevronDown className="h-4 w-4" aria-hidden="true" /></button>}
      {result.route?.traffic_level === 'Light' && incidents.length > 0 && <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-3.5 text-[11px] font-semibold leading-relaxed text-slate-700">Route traffic remains light. These incidents are nearby and may not directly affect the selected route.</div>}
      <button type="button" onClick={onBack} className="mt-5 min-h-11 w-full rounded-xl border border-blue-500 bg-white text-xs font-extrabold text-blue-700">Back to overview</button>
    </div>
  );
}

function TrafficMetric({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return <div className="border-r border-slate-200 p-3 text-center last:border-r-0"><div className="inline-flex items-center gap-1 text-base font-black text-slate-950">{icon}{value}</div><p className="mt-1 text-[9px] font-semibold text-slate-500">{label}</p></div>;
}

export default function CommuteResultExperience({ result, uiState, loading, originLabel, destinationLabel, onEdit, onRefresh }: Props) {
  const [view, setView] = useState<ResultView>('overview');
  const route = `${originLabel} -> ${destinationLabel}`;
  const checkpoints = result.route_weather_checkpoints ?? [];
  const rainCheckpoints = sortedRainCheckpoints(checkpoints);
  const weatherCheckpoint: RouteWeatherCheckpoint | undefined = result.route_weather_summary?.wettest_checkpoint ?? rainCheckpoints[0] ?? checkpoints[0];
  const incidents = result.incidents ?? [];
  const severeCount = incidents.filter((item) => item.severity === 'Severe').length;
  const nearestIncident = incidents.reduce<number | null>((nearest, item) => item.distance_from_route_km == null ? nearest : nearest == null ? item.distance_from_route_km : Math.min(nearest, item.distance_from_route_km), null);

  if (view === 'weather') return <WeatherDetails result={result} route={route} onBack={() => setView('overview')} />;
  if (view === 'traffic') return <TrafficDetails result={result} route={route} onBack={() => setView('overview')} />;

  const advisory = result.ai_advisory;
  const extraMinutes = Math.round(Number(advisory?.recommended_extra_minutes ?? result.route_weather_summary?.recommended_extra_minutes ?? 0));
  const wettestChance = rainPercent(weatherCheckpoint);
  const wettestTone = rainTone(wettestChance);
  const wettestPlace = weatherCheckpoint ? shortCommutePlace(weatherCheckpoint.location_name, 'your route') : 'your route';
  const decision = advisory?.status === 'consider_alternate_route' ? 'CONSIDER ALTERNATE ROUTE' : advisory?.status === 'expect_delays' ? 'EXPECT DELAYS' : advisory?.status === 'leave_early' ? 'LEAVE NOW' : wettestChance >= 70 ? 'BRING RAIN GEAR' : 'GOOD TO GO';
  const mainAction = advisory?.headline || (extraMinutes > 0 ? `Leave now - add ${extraMinutes} min` : wettestChance >= 70 ? `Rain likely near ${wettestPlace}` : 'Your route looks manageable');
  const weatherSummary = weatherCheckpoint
    ? `${wettestChance}% rain near ${wettestPlace} around ${formatCommuteClock(weatherCheckpoint.arrival_time)}. Expected rain ${formatRainAmount(weatherCheckpoint.precipitation_mm)}, wind ${weatherCheckpoint.wind_speed_kmh != null ? `${Math.round(weatherCheckpoint.wind_speed_kmh)} km/h` : 'N/A'}.`
    : advisory?.summary || advisory?.recommendation || 'Live route, weather, and traffic data are ready.';
  const weatherAvailable = checkpoints.length > 0 && result.route_weather_summary?.available !== false;
  const trafficWasRequested = result.advice_options?.includes('traffic_delays') === true || result.advice_options?.includes('best_departure') === true;
  const trafficAvailable = trafficWasRequested || Boolean(result.route) || incidents.length > 0 || result.partial?.incidents_available === true || result.partial?.traffic_available === true;
  const trafficSummary = result.partial?.traffic_available === false && result.route
    ? `${result.route.traffic_level} route - +${formatCommuteMinutes(result.route.delay_minutes)} delay. Live incident feed is limited.`
    : result.partial?.traffic_available === false || result.partial?.incidents_available === false
      ? `Live traffic feed is limited. ${incidents.length} reported incidents available.`
      : `${severeCount} severe ${severeCount === 1 ? 'incident' : 'incidents'}${nearestIncident != null ? ` - nearest ${nearestIncident.toFixed(2)} km` : ''} - ${formatOptionalDelay(result.route?.delay_minutes)} delay`;

  return (
    <div aria-busy={loading} className="rounded-3xl border border-emerald-100 bg-white p-3.5 pb-0 shadow-sm sm:p-5 sm:pb-0">
      <section className="rounded-2xl border border-emerald-100 bg-white p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={`text-[9px] font-black uppercase tracking-wide ${uiState === 'partial' ? 'text-amber-700' : 'text-emerald-600'}`}>
              {uiState === 'partial' ? 'Partial data' : uiState === 'updating' ? 'Updating' : uiState === 'failed' ? 'Last result' : 'Live'} <span className="font-semibold normal-case text-slate-400">- Updated {formatCommuteUpdatedAt(result.freshness?.overall_updated_at || result.generated_at)}</span>
            </p>
            <p className="mt-1 line-clamp-2 text-xs font-black leading-snug text-slate-950">{route}</p>
            <p className="mt-1 text-[10px] text-slate-500">Depart {formatCommuteClock(result.route?.departure_time || checkpoints[0]?.arrival_time)}</p>
          </div>
          <button type="button" onClick={onEdit} className="inline-flex min-h-11 flex-none items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-extrabold text-blue-700 shadow-sm">
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            Edit
          </button>
        </div>
      </section>

      <section className={`mt-3 rounded-2xl border p-3.5 ${wettestTone.panel}`}>
        <p className="text-[9px] font-black uppercase tracking-[.14em] text-blue-700">AI commute decision</p>
        <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[9px] font-black ${wettestTone.badge}`}>{advisory?.status_label || decision}</span>
        <h4 className="mt-2 text-xl font-black leading-tight text-slate-950">{mainAction}</h4>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-700">{weatherSummary}</p>
        {advisory?.recommendation && <p className="mt-2 rounded-xl bg-white/70 p-2.5 text-[10px] font-semibold leading-relaxed text-slate-600">{advisory.recommendation}</p>}
        <p className="mt-2 text-[9px] font-semibold text-slate-500">TomTom + Open-Meteo <span className="text-emerald-600">- Live</span></p>
      </section>

      {result.route && <div className="mt-3 grid grid-cols-4 overflow-hidden rounded-2xl border border-slate-200 bg-white"><OverviewMetric icon={<Clock3 className="h-3.5 w-3.5" />} value={formatCommuteMinutes(result.route.eta_minutes)} label="ETA" /><OverviewMetric icon={<MapPin className="h-3.5 w-3.5" />} value={formatCommuteDistance(result.route.distance_km)} label="Distance" /><OverviewMetric icon={<Navigation className="h-3.5 w-3.5" />} value={`+${formatCommuteMinutes(result.route.delay_minutes)}`} label="Delay" /><OverviewMetric icon={<Route className="h-3.5 w-3.5" />} value={result.route.traffic_level} label="Traffic" /></div>}

      <RainHotspots checkpoints={checkpoints} onOpenDetails={() => setView('weather')} />
      <RainRouteTimeline checkpoints={checkpoints} selectedIndex={weatherCheckpoint?.index} />

      <button type="button" onClick={() => setView('weather')} disabled={!weatherAvailable} className="mt-3 flex min-h-16 w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-blue-300 hover:bg-blue-50/40 disabled:cursor-not-allowed disabled:opacity-50"><span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-blue-50 text-blue-700" aria-hidden="true"><CloudRain className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-xs font-black text-slate-900">All weather checkpoints</span><span className="mt-0.5 block truncate text-[10px] text-slate-500">{weatherCheckpoint ? `${wettestChance}% rain near ${wettestPlace} - ${formatRainAmount(weatherCheckpoint.precipitation_mm)} - ${weatherCheckpoint.temperature_c != null ? `${Math.round(weatherCheckpoint.temperature_c)} deg C` : 'Temp N/A'} - Wind ${weatherCheckpoint.wind_speed_kmh != null ? `${Math.round(weatherCheckpoint.wind_speed_kmh)} km/h` : 'N/A'}` : 'Detailed weather unavailable'}</span></span><ChevronRight className="h-5 w-5 flex-none text-slate-500" aria-hidden="true" /></button>
      <button type="button" onClick={() => setView('traffic')} disabled={!trafficAvailable} className="mt-2 flex min-h-16 w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-blue-300 hover:bg-blue-50/40 disabled:cursor-not-allowed disabled:opacity-50"><span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-violet-50 text-violet-700" aria-hidden="true"><Navigation className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-xs font-black text-slate-900">Traffic status</span><span className="mt-0.5 block truncate text-[10px] text-slate-500">{trafficSummary}</span></span><ChevronRight className="h-5 w-5 flex-none text-slate-500" aria-hidden="true" /></button>
      <StickyActions loading={loading} onEdit={onEdit} onRefresh={onRefresh} />
    </div>
  );
}

function OverviewMetric({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return <div className="min-w-0 border-r border-slate-200 px-1.5 py-3 text-center last:border-r-0"><span className="inline-flex text-slate-500" aria-hidden="true">{icon}</span><p className="mt-1 truncate text-[11px] font-black text-slate-950">{value}</p><p className="mt-0.5 text-[8px] font-semibold text-slate-500">{label}</p></div>;
}
