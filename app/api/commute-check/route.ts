import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createSupabaseAdminClient } from '@/lib/server/supabase-admin';

// app/api/commute-check/route.ts

const ALLOWED_ADVICE_OPTIONS = new Set([
  'route_weather',
  'rain_risk',
  'traffic_delays',
  'best_departure',
]);

const MAX_REQUEST_BYTES = 8_192;
const COMMUTE_RATE_LIMIT = 10;
const COMMUTE_RATE_WINDOW_SECONDS = 60;

type JsonRecord = Record<string, unknown>;

const isJsonRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const inputError = (error: string, status = 400) =>
  NextResponse.json(
    { success: false, error_type: 'input_error', error },
    { status }
  );

const serviceError = (
  error: string,
  status: number,
  errorType: 'route_failed' | 'timeout' | 'configuration_error' | 'service_error'
) =>
  NextResponse.json(
    { success: false, error_type: errorType, error },
    { status }
  );

const unwrapWorkflowPayload = (rawPayload: unknown): JsonRecord => {
  let current: unknown = rawPayload;

  for (let depth = 0; depth < 5; depth += 1) {
    if (Array.isArray(current)) {
      current = current[0];
      continue;
    }

    if (!isJsonRecord(current)) break;
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

  return isJsonRecord(current) ? current : {};
};

const normalizePoint = (value: unknown) => {
  if (!isJsonRecord(value)) return null;

  const lat = Number(value.lat);
  const lon = Number(value.lon);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return null;
  }

  return {
    name: typeof value.name === 'string' ? value.name : '',
    lat,
    lon,
  };
};

const deriveTrafficLevel = (delaySeconds: number, normalSeconds: number) => {
  const ratio = normalSeconds > 0 ? delaySeconds / normalSeconds : 0;

  if (ratio >= 0.6) return 'Severe';
  if (ratio >= 0.3) return 'Heavy';
  if (ratio >= 0.1) return 'Moderate';
  return 'Light';
};

const fetchTomTomRouteFallback = async ({
  origin,
  destination,
  requestedDepartureAt,
  signal,
}: {
  origin: { name: string; lat: number; lon: number };
  destination: { name: string; lat: number; lon: number };
  requestedDepartureAt: string;
  signal: AbortSignal;
}) => {
  const apiKey = process.env.TOMTOM_API_KEY || process.env.NEXT_PUBLIC_TOMTOM_API_KEY;
  if (!apiKey) return null;

  const url = new URL(
    `https://api.tomtom.com/routing/1/calculateRoute/${origin.lat},${origin.lon}:${destination.lat},${destination.lon}/json`
  );
  url.searchParams.set('key', apiKey);
  url.searchParams.set('traffic', 'true');
  url.searchParams.set('computeTravelTimeFor', 'all');
  url.searchParams.set('routeRepresentation', 'polyline');
  url.searchParams.set('travelMode', 'car');
  url.searchParams.set('departAt', requestedDepartureAt);

  const response = await fetch(url, { signal, cache: 'no-store' });
  if (!response.ok) return null;

  const data = await response.json();
  const route = Array.isArray(data?.routes) ? data.routes[0] : null;
  const summary = route?.summary;

  if (!summary || typeof summary !== 'object') return null;

  const travelSeconds = Math.max(0, Number(summary.travelTimeInSeconds ?? 0));
  const normalSeconds = Math.max(
    0,
    Number(summary.noTrafficTravelTimeInSeconds ?? summary.historicTrafficTravelTimeInSeconds ?? travelSeconds)
  );
  const delaySeconds = Math.max(
    0,
    Number(summary.trafficDelayInSeconds ?? Math.max(travelSeconds - normalSeconds, 0))
  );
  const distanceMeters = Math.max(0, Number(summary.lengthInMeters ?? 0));
  const points = Array.isArray(route?.legs)
    ? route.legs.flatMap((leg: JsonRecord) =>
        Array.isArray(leg?.points)
          ? leg.points
              .map((point: JsonRecord) => ({
                lat: Number(point?.latitude),
                lon: Number(point?.longitude),
              }))
              .filter((point: { lat: number; lon: number }) =>
                Number.isFinite(point.lat) && Number.isFinite(point.lon)
              )
          : []
      )
    : [];

  return {
    eta_minutes: Math.round(travelSeconds / 60),
    normal_minutes: Math.round(normalSeconds / 60),
    delay_minutes: Math.round(delaySeconds / 60),
    distance_km: Math.round((distanceMeters / 1000) * 10) / 10,
    traffic_level: deriveTrafficLevel(delaySeconds, normalSeconds),
    coordinates: points,
    departure_time: requestedDepartureAt,
    arrival_time: new Date(new Date(requestedDepartureAt).getTime() + travelSeconds * 1000).toISOString(),
    weather_checkpoint_count: points.length,
  };
};

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
        },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { success: false, error_type: 'authentication_error', error: 'Not authenticated.' },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single();

    if (
      profileError ||
      !['employee', 'admin', 'super_admin'].includes(profile?.role ?? '') ||
      profile?.is_active === false
    ) {
      return NextResponse.json(
        { success: false, error_type: 'authorization_error', error: 'Account is not authorized.' },
        { status: 403 }
      );
    }

    const supabaseAdmin = createSupabaseAdminClient();
    const { data: rateAllowed, error: rateLimitError } = await supabaseAdmin.rpc(
      'consume_api_rate_limit',
      {
        p_scope: 'commute-check',
        p_user_id: user.id,
        p_limit: COMMUTE_RATE_LIMIT,
        p_window_seconds: COMMUTE_RATE_WINDOW_SECONDS,
      }
    );

    if (rateLimitError) {
      console.error('Commute rate-limit check failed:', rateLimitError.code);
      return serviceError(
        'Commute checker is temporarily unavailable.',
        503,
        'configuration_error'
      );
    }

    if (!rateAllowed) {
      return NextResponse.json(
        {
          success: false,
          error_type: 'rate_limited',
          error: 'Too many commute checks. Please wait a minute and try again.',
        },
        { status: 429, headers: { 'Retry-After': String(COMMUTE_RATE_WINDOW_SECONDS) } }
      );
    }

    const declaredLength = Number(request.headers.get('content-length') ?? 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
      return inputError('Request is too large.', 413);
    }

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).length > MAX_REQUEST_BYTES) {
      return inputError('Request is too large.', 413);
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return inputError('Invalid JSON body.');
    }

    const origin = String(body?.origin ?? '').trim();
    const destination = String(body?.destination ?? '').trim();

    const requestedLanguage = String(body?.language ?? 'auto').toLowerCase();
    const language =
      requestedLanguage === 'en' ||
      requestedLanguage === 'tl' ||
      requestedLanguage === 'auto'
        ? requestedLanguage
        : 'auto';

    const normalizePosition = (value: unknown) => {
      const position = value as {
        lat?: unknown;
        lon?: unknown;
      } | null;

      const lat = Number(position?.lat);
      const lon = Number(position?.lon);

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lon) ||
        lat < -90 ||
        lat > 90 ||
        lon < -180 ||
        lon > 180
      ) {
        return null;
      }

      return { lat, lon };
    };

    const originPosition = normalizePosition(body?.origin_position);
    const destinationPosition = normalizePosition(body?.destination_position);

    if (!origin || !destination) {
      return inputError('Both origin and destination are required.');
    }

    if (origin.length > 250 || destination.length > 250) {
      return inputError('Origin or destination is too long.');
    }

    if (!body?.requested_departure_at) {
      return inputError('A departure date and time are required.');
    }

    const requestedDate = new Date(
      String(body.requested_departure_at)
    );

    if (!Number.isFinite(requestedDate.getTime())) {
      return inputError('Invalid departure date or time.');
    }

    const now = Date.now();
    const earliestAllowed = now - 24 * 60 * 60 * 1000;
    const latestAllowed = now + 7 * 24 * 60 * 60 * 1000;

    if (
      requestedDate.getTime() < earliestAllowed ||
      requestedDate.getTime() > latestAllowed
    ) {
      return inputError(
        'Departure time must be within the available seven-day forecast.'
      );
    }

    const requestedDepartureAt = requestedDate.toISOString();

    const adviceOptions = Array.isArray(body?.advice_options)
      ? body.advice_options
          .map((option: unknown) =>
            String(option ?? '').trim().toLowerCase()
          )
          .filter((option: string) =>
            ALLOWED_ADVICE_OPTIONS.has(option)
          )
      : [];

    const normalizedAdviceOptions = [...new Set(adviceOptions)];

    // Do not silently default to every topic. Requiring a real selection is
    // what keeps the downstream AI prompt focused and smaller.
    if (normalizedAdviceOptions.length === 0) {
      return inputError('Select at least one advice option.');
    }

    const webhookUrl = process.env.N8N_COMMUTE_WEBHOOK_URL;
    const webhookSecret = process.env.N8N_COMMUTE_WEBHOOK_SECRET;

    if (!webhookUrl || !webhookSecret) {
      return serviceError(
        'Commute checker is not configured yet.',
        503,
        'configuration_error'
      );
    }

    const controller = new AbortController();
    // Route checkpoints, weather calls, and AI advice can take longer than
    // the previous destination-only workflow.
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const n8nResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Must match the commute workflow's Header Auth credential.
          'x-commute-secret': webhookSecret,
        },
        body: JSON.stringify({
          origin,
          destination,
          language,
          origin_position: originPosition,
          destination_position: destinationPosition,
          requested_departure_at: requestedDepartureAt,
          advice_options: normalizedAdviceOptions,
        }),
        signal: controller.signal,
        cache: 'no-store',
      });

      const raw = await n8nResponse.text();

      let parsedPayload: unknown = {};
      try {
        parsedPayload = raw ? JSON.parse(raw) : {};
      } catch {
        parsedPayload = {
          error: raw || 'Invalid response from commute workflow.',
        };
      }
      const payload = unwrapWorkflowPayload(parsedPayload);

      if (!n8nResponse.ok) {
        const message = typeof payload.error === 'string'
          ? payload.error
          : 'Unable to check this route right now.';

        if (n8nResponse.status === 400 || n8nResponse.status === 422) {
          return inputError(message, n8nResponse.status);
        }

        return serviceError(
          message,
          n8nResponse.status,
          n8nResponse.status === 502 ? 'route_failed' : 'service_error'
        );
      }

      if (!payload?.data_status || !payload?.origin || !payload?.destination) {
        return serviceError(
          typeof payload.error === 'string'
            ? payload.error
            : 'The commute workflow returned an incomplete response. Check that the active n8n workflow ends at Format Response or Format Weather Only Partial.',
          502,
          'route_failed'
        );
      }

      const wantsTraffic =
        normalizedAdviceOptions.includes('traffic_delays') ||
        normalizedAdviceOptions.includes('best_departure');

      if (wantsTraffic && !payload.route) {
        const payloadOrigin = normalizePoint(payload.origin);
        const payloadDestination = normalizePoint(payload.destination);
        const fallbackOrigin = payloadOrigin || (
          originPosition ? { ...originPosition, name: origin } : null
        );
        const fallbackDestination = payloadDestination || (
          destinationPosition ? { ...destinationPosition, name: destination } : null
        );

        if (fallbackOrigin && fallbackDestination) {
          const fallbackRoute = await fetchTomTomRouteFallback({
            origin: fallbackOrigin,
            destination: fallbackDestination,
            requestedDepartureAt,
            signal: controller.signal,
          });

          if (fallbackRoute) {
            payload.route = fallbackRoute;
            payload.data_status = 'partial';
            const partial = isJsonRecord(payload.partial) ? payload.partial : {};
            partial.traffic_available = true;
            payload.partial = partial;
          }
        }
      }

      return NextResponse.json(payload, {
        status: 200,
        headers: {
          'Cache-Control':
            'no-store, no-cache, must-revalidate',
        },
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      return serviceError(
        'Traffic and weather services timed out. Please try again.',
        504,
        'timeout'
      );
    }

    console.error('Commute check API error:', error);

    return serviceError(
      'Unable to check the route right now.',
      500,
      'service_error'
    );
  }
}
