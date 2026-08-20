import { NextRequest, NextResponse } from 'next/server';

// app/api/address-search/route.ts
//
// Address autocomplete using Photon (OpenStreetMap-based).
// No TomTom Search entitlement/key is required for this route.
//
// IMPORTANT:
// photon.komoot.io is a public demo/fair-use service. It is fine for light testing
// and modest use, but it does not provide uptime/SLA guarantees. For a larger
// production deployment, use a dedicated geocoding provider or self-host Photon.

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = String(searchParams.get('q') ?? '').trim();

    if (query.length < 3) {
      return NextResponse.json(
        { results: [] },
        {
          status: 200,
          headers: { 'Cache-Control': 'no-store' },
        }
      );
    }

    const url = new URL('https://photon.komoot.io/api/');
    url.searchParams.set('q', query);
    url.searchParams.set('limit', '6');

    // Bias results toward Metro Manila while still allowing searches elsewhere
    // in the Philippines.
    url.searchParams.set('lat', '14.5547');
    url.searchParams.set('lon', '121.0244');

    const response = await fetch(url.toString(), {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Hamdan-Employee-Commute/1.0',
      },
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      console.error(
        'Photon address search failed:',
        response.status,
        payload
      );

      return NextResponse.json(
        { error: 'Unable to search addresses right now.' },
        { status: response.status }
      );
    }

    const features = Array.isArray(payload?.features)
      ? payload.features
      : [];

    const results = features
      .map((feature: any) => {
        const props = feature?.properties ?? {};
        const coordinates = feature?.geometry?.coordinates ?? [];

        const longitude = Number(coordinates?.[0]);
        const latitude = Number(coordinates?.[1]);

        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude)
        ) {
          return null;
        }

        const countryCode = String(
          props.countrycode ??
          props.country_code ??
          ''
        ).toLowerCase();

        // Keep Philippine results when Photon supplies a country code.
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
            Boolean(part) &&
            array.indexOf(part) === index
        );

        const address =
          addressParts.join(', ') ||
          name;

        return {
          id:
            `${props.osm_type || 'osm'}-${props.osm_id || ''}-${latitude}-${longitude}`,
          name: String(name),
          address: String(address),
          municipality: String(
            props.city ||
            props.locality ||
            props.district ||
            ''
          ),
          latitude,
          longitude,
          type: String(
            props.type ||
            props.osm_value ||
            props.osm_key ||
            ''
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
          'Cache-Control':
            'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error) {
    console.error(
      'Address autocomplete API error:',
      error
    );

    return NextResponse.json(
      { error: 'Unable to search addresses right now.' },
      { status: 500 }
    );
  }
}