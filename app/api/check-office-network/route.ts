import { NextResponse } from 'next/server';

// Checks whether the request's public IP matches the office's known
// public IP address(es). This is the practical stand-in for "connected
// to office WiFi" -- browsers have no API to read which WiFi network a
// device is on, but every request DOES carry the public IP of whatever
// network it left from, which Vercel forwards to us via headers.
//
// LIMITATION: this only works reliably if your office internet has a
// STATIC public IP. If your ISP gives you a dynamic IP that changes
// periodically, this will start rejecting valid office connections
// until you update OFFICE_ALLOWED_IPS. Ask your ISP for a static IP
// (usually available on business plans) if this becomes an issue.
//
// Set OFFICE_ALLOWED_IPS in Vercel's environment variables as a
// comma-separated list, e.g. "203.177.xxx.xxx,203.177.yyy.yyy" if you
// have more than one office location or ISP line.

function getClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can be a comma-separated list; the first entry is
    // the original client IP.
    return forwardedFor.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip');
}

export async function GET(request: Request) {
  // In local development there's no real public IP to check against,
  // so we skip the restriction entirely to avoid blocking testing.
  if (process.env.NODE_ENV !== 'production') {
    return NextResponse.json(
      { allowed: true, dev: true },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }

  const allowedIps = (process.env.OFFICE_ALLOWED_IPS || '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);

  if (allowedIps.length === 0) {
    // Fail closed in production. The rest of the employee portal remains
    // available, but attendance recording is disabled until IT restores
    // the allowlist configuration.
    return NextResponse.json(
      {
        allowed: false,
        code: 'ATTENDANCE_NETWORK_UNAVAILABLE',
        error: 'Attendance recording is temporarily unavailable. Please contact HR or IT.',
      },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store, max-age=0' },
      }
    );
  }

  const clientIp = getClientIp(request);
  const allowed = !!clientIp && allowedIps.includes(clientIp);

  return NextResponse.json(
    {
      allowed,
      code: allowed ? 'OFFICE_NETWORK_ALLOWED' : 'OUTSIDE_OFFICE_NETWORK',
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}