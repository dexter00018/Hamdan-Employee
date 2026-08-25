import { NextRequest, NextResponse } from 'next/server';

// Copy this file to: app/api/address-search/route.ts
// Photon is a public fair-use service, so this route limits duplicate traffic,
// times out cleanly, and returns stable error codes to the Employee page.

export const runtime = 'nodejs';

const PHOTON_ENDPOINT = 'https://photon.komoot.io/api/';
const PHOTON_REVERSE_ENDPOINT = 'https://photon.komoot.io/reverse';
const REQUEST_TIMEOUT_MS = 8_000;

type PhotonPayload = {
  features?: any[];
};

const parseJson = (value: string): PhotonPayload | null => {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = String(searchParams.get('q') ?? '').trim();
  const reverseLatParam = searchParams.get('lat');
  const reverseLonParam = searchParams.get('lon');
  const reverseLat = Number(reverseLatParam);
  const reverseLon = Number(reverseLonParam);
  const isReverseLookup =
    reverseLatParam !== null &&
    reverseLonParam !== null &&
    Number.isFinite(reverseLat) &&
    Number.isFinite(reverseLon) &&
    reverseLat >= -90 && reverseLat <= 90 &&
    reverseLon >= -180 && reverseLon <= 180;

  if (isReverseLookup) {
    const reverseUrl = new URL(PHOTON_REVERSE_ENDPOINT);
    reverseUrl.searchParams.set('lat', String(reverseLat));
    reverseUrl.searchParams.set('lon', String(reverseLon));
    const reverseController = new AbortController();
    const reverseTimeout = setTimeout(
      () => reverseController.abort(),
      REQUEST_TIMEOUT_MS
    );

    try {
      const response = await fetch(reverseUrl.toString(), {
        signal: reverseController.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Hamdan-Employee-Commute/1.0',
        },
        cache: 'no-store',
      });
      const payload = parseJson(await response.text());
      const feature = payload?.features?.[0];
      const props = feature?.properties ?? {};

      if (!response.ok || !feature) {
        return NextResponse.json(
          { error: 'Unable to identify the current location.', code: 'REVERSE_GEOCODE_UNAVAILABLE' },
          { status: response.ok ? 404 : 502, headers: { 'Cache-Control': 'no-store' } }
        );
      }

      const name = props.name || props.street || props.locality || props.city || 'Current location';
      const addressParts = [
        props.housenumber && props.street ? `${props.housenumber} ${props.street}` : props.street,
        props.district,
        props.locality,
        props.city,
        props.county,
        props.state,
        props.postcode,
        props.country,
      ].filter((part, index, array) => Boolean(part) && array.indexOf(part) === index);
      const result = {
        id: `reverse-${reverseLat}-${reverseLon}`,
        name: String(name),
        address: String(addressParts.join(', ') || name),
        municipality: String(props.city || props.locality || props.district || ''),
        latitude: reverseLat,
        longitude: reverseLon,
        type: 'reverse_geocoded',
      };

      return NextResponse.json(
        { result, results: [result], provider: 'Photon / OpenStreetMap' },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    } catch (error: any) {
      return NextResponse.json(
        {
          error: error?.name === 'AbortError'
            ? 'Current-location lookup timed out.'
            : 'Unable to identify the current location.',
          code: error?.name === 'AbortError' ? 'REVERSE_GEOCODE_TIMEOUT' : 'REVERSE_GEOCODE_UNAVAILABLE',
        },
        { status: error?.name === 'AbortError' ? 504 : 503, headers: { 'Cache-Control': 'no-store' } }
      );
    } finally {
      clearTimeout(reverseTimeout);
    }
  }

  if (query.length < 3) {
    return NextResponse.json(
      { results: [] },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }

  const url = new URL(PHOTON_ENDPOINT);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '8');
  url.searchParams.set('lat', '14.5547');
  url.searchParams.set('lon', '121.0244');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    // Next.js caches identical queries briefly. This reduces calls to Photon's
    // shared endpoint while keeping autocomplete results reasonably fresh.
    const response = await fetch(url.toString(), {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Hamdan-Employee-Commute/1.0',
      },
      next: { revalidate: 300 },
    });

    const raw = await response.text();
    const payload = parseJson(raw);

    if (!response.ok) {
      console.warn('Photon address search unavailable:', response.status);

      return NextResponse.json(
        {
          error: 'Address suggestions are temporarily unavailable. You can still type the complete address.',
          code: response.status === 429 ? 'ADDRESS_SEARCH_RATE_LIMITED' : 'ADDRESS_PROVIDER_UNAVAILABLE',
        },
        {
          status: response.status === 429 ? 503 : 502,
          headers: {
            'Cache-Control': 'no-store',
            ...(response.status === 429 ? { 'Retry-After': '30' } : {}),
          },
        }
      );
    }

    if (!payload || !Array.isArray(payload.features)) {
      return NextResponse.json(
        {
          error: 'The address provider returned an invalid response. You can still type the complete address.',
          code: 'INVALID_ADDRESS_PROVIDER_RESPONSE',
        },
        {
          status: 502,
          headers: { 'Cache-Control': 'no-store' },
        }
      );
    }

    const seen = new Set<string>();
    const results = payload.features
      .map((feature: any) => {
        const props = feature?.properties ?? {};
        const coordinates = feature?.geometry?.coordinates ?? [];
        const longitude = Number(coordinates?.[0]);
        const latitude = Number(coordinates?.[1]);

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          return null;
        }

        const countryCode = String(
          props.countrycode ?? props.country_code ?? ''
        ).toLowerCase();

        if (countryCode && countryCode !== 'ph') {
          return null;
        }

        const name =
          props.name ||
          props.street ||
          props.city ||
          props.locality ||
          'Location';

        const addressParts = [
          props.housenumber && props.street
            ? `${props.housenumber} ${props.street}`
            : props.street,
          props.district,
          props.locality,
          props.city,
          props.county,
          props.state,
          props.postcode,
          props.country,
        ].filter(
          (part, index, array) =>
            Boolean(part) && array.indexOf(part) === index
        );

        const address = addressParts.join(', ') || name;
        const id = `${props.osm_type || 'osm'}-${props.osm_id || ''}-${latitude}-${longitude}`;
        const duplicateKey = `${id}|${String(address).toLowerCase()}`;

        if (seen.has(duplicateKey)) return null;
        seen.add(duplicateKey);

        return {
          id,
          name: String(name),
          address: String(address),
          municipality: String(
            props.city || props.locality || props.district || ''
          ),
          latitude,
          longitude,
          type: String(
            props.type || props.osm_value || props.osm_key || ''
          ),
        };
      })
      .filter(Boolean)
      .slice(0, 6);

    return NextResponse.json(
      {
        results,
        provider: 'Photon / OpenStreetMap',
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error: any) {
    const timedOut = error?.name === 'AbortError';

    console.warn(
      timedOut
        ? 'Photon address search timed out.'
        : 'Address autocomplete API unavailable:',
      timedOut ? undefined : error instanceof Error ? error.message : error
    );

    return NextResponse.json(
      {
        error: timedOut
          ? 'Address search timed out. You can still type the complete address.'
          : 'Address suggestions are temporarily unavailable. You can still type the complete address.',
        code: timedOut ? 'ADDRESS_SEARCH_TIMEOUT' : 'ADDRESS_PROVIDER_UNAVAILABLE',
      },
      {
        status: timedOut ? 504 : 503,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  } finally {
    clearTimeout(timeout);
  }
}