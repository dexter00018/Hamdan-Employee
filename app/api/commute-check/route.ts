import { NextRequest, NextResponse } from 'next/server';

// app/api/commute-check/route.ts

const ALLOWED_ADVICE_OPTIONS = new Set([
  'route_weather',
  'rain_risk',
  'traffic_delays',
  'best_departure',
]);

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
      return NextResponse.json(
        { error: 'Both origin and destination are required.' },
        { status: 400 }
      );
    }

    if (origin.length > 250 || destination.length > 250) {
      return NextResponse.json(
        { error: 'Origin or destination is too long.' },
        { status: 400 }
      );
    }

    if (!body?.requested_departure_at) {
      return NextResponse.json(
        { error: 'A departure date and time are required.' },
        { status: 400 }
      );
    }

    const requestedDate = new Date(
      String(body.requested_departure_at)
    );

    if (!Number.isFinite(requestedDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid departure date or time.' },
        { status: 400 }
      );
    }

    const now = Date.now();
    const earliestAllowed = now - 24 * 60 * 60 * 1000;
    const latestAllowed = now + 7 * 24 * 60 * 60 * 1000;

    if (
      requestedDate.getTime() < earliestAllowed ||
      requestedDate.getTime() > latestAllowed
    ) {
      return NextResponse.json(
        {
          error:
            'Departure time must be within the available seven-day forecast.',
        },
        { status: 400 }
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
      return NextResponse.json(
        { error: 'Select at least one advice option.' },
        { status: 400 }
      );
    }

    const webhookUrl = process.env.N8N_COMMUTE_WEBHOOK_URL;
    const webhookSecret = process.env.N8N_COMMUTE_WEBHOOK_SECRET;

    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'Commute checker is not configured yet.' },
        { status: 503 }
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

      let payload: any = {};
      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch {
        payload = {
          error: raw || 'Invalid response from commute workflow.',
        };
      }

      if (!n8nResponse.ok) {
        return NextResponse.json(
          {
            error:
              payload?.error ||
              'Unable to check this route right now.',
          },
          { status: n8nResponse.status }
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
      return NextResponse.json(
        {
          error:
            'Traffic and weather services timed out. Please try again.',
        },
        { status: 504 }
      );
    }

    console.error('Commute check API error:', error);

    return NextResponse.json(
      { error: 'Unable to check the route right now.' },
      { status: 500 }
    );
  }
}