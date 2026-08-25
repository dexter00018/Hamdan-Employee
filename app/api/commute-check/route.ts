import { NextRequest, NextResponse } from 'next/server';

// app/api/commute-check/route.ts

const ALLOWED_ADVICE_OPTIONS = new Set([
  'route_weather',
  'rain_risk',
  'traffic_delays',
  'best_departure',
]);

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

const unwrapWorkflowPayload = (rawPayload: unknown): any => {
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

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

    if (!webhookUrl) {
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
          ...(webhookSecret
            ? { 'x-commute-secret': webhookSecret }
            : {}),
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

      let parsedPayload: any = {};
      try {
        parsedPayload = raw ? JSON.parse(raw) : {};
      } catch {
        parsedPayload = {
          error: raw || 'Invalid response from commute workflow.',
        };
      }
      const payload = unwrapWorkflowPayload(parsedPayload);

      if (!n8nResponse.ok) {
        const message =
          payload?.error || 'Unable to check this route right now.';

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
          payload?.error ||
            'The commute workflow returned an incomplete response. Check that the active n8n workflow ends at Format Response or Format Weather Only Partial.',
          502,
          'route_failed'
        );
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
  } catch (error: any) {
    if (error?.name === 'AbortError') {
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