import type { NextConfig } from "next";

// Security headers applied to every route. CSP allows exactly what the app
// uses: same-origin chunks/fonts, Supabase (REST/auth/storage), inline styles
// and the inline Next.js bootstrap scripts (no nonce middleware today).
const SUPABASE_HOST = "msoomcjzzudibiyezclj.supabase.co";

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://" + SUPABASE_HOST,
  "font-src 'self' data:",
  "connect-src 'self' https://" + SUPABASE_HOST + " wss://" + SUPABASE_HOST,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=()" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'msoomcjzzudibiyezclj.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
