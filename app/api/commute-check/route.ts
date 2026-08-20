import { NextRequest, NextResponse } from 'next/server';

// app/api/commute-check/route.ts

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

    const normalizePosition = (value: any) => {
      const lat = Number(value?.lat);
      const lon = Number(value?.lon);

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
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

    const webhookUrl = process.env.N8N_COMMUTE_WEBHOOK_URL;
    const webhookSecret = process.env.N8N_COMMUTE_WEBHOOK_SECRET;

    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'Commute checker is not configured yet.' },
        { status: 503 }
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

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
        headers: { 'Cache-Control': 'no-store' },
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Traffic service timed out. Please try again.' },
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