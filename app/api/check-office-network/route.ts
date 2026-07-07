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
    return NextResponse.json({ allowed: true, dev: true });
  }

  const allowedIps = (process.env.OFFICE_ALLOWED_IPS || '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);

  if (allowedIps.length === 0) {
    // Fail open with a clear signal in the response so this isn't a
    // silent misconfiguration -- but don't block time-in entirely just
    // because the admin hasn't set this up yet.
    return NextResponse.json({ allowed: true, unconfigured: true });
  }

  const clientIp = getClientIp(request);
  const allowed = !!clientIp && allowedIps.includes(clientIp);

  return NextResponse.json({ allowed, clientIp });
}
