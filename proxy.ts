// proxy.ts
// Place this file at the ROOT of your project (same level as app/, not inside app/).
// (Next.js 16 renamed the "middleware" convention to "proxy" — same behavior,
// new file name and function name.)
//
// This runs on EVERY request to the protected routes, BEFORE the page loads.
// It checks:
// 1. Is there a valid logged-in session at all? If not -> redirect to "/" (login page)
// 2. Does the session's profile role match the route they're trying to access?
//    (e.g. an "employee" role trying to open /hr or /super-admin gets bounced back)
//
// This closes the gap where someone could type /employee, /hr, or /super-admin
// directly in the browser and see the page UI even without logging in.

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const ROUTE_ROLES: Record<string, string[]> = {
  '/employee': ['employee'],
  '/hr': ['admin'],
  '/super-admin': ['super_admin'],
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only run this logic for protected route prefixes
  const matchedRoute = Object.keys(ROUTE_ROLES).find((route) =>
    pathname.startsWith(route)
  );

  if (!matchedRoute) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  let user;
  try {
    const { data, error: getUserError } = await supabase.auth.getUser();
    if (getUserError) throw getUserError;
    user = data.user;
  } catch {
    // Covers both a normal "no session" result AND cases where Supabase
    // throws instead of returning an error -- e.g. "Invalid Refresh Token:
    // Refresh Token Not Found" when a stale/cleared cookie is presented.
    // Either way, the safe move is the same: clear the bad cookies and
    // send them back to login instead of letting this bubble up as an
    // unhandled 500 in the proxy.
    const loginUrl = new URL('/', request.url);
    const redirectResponse = NextResponse.redirect(loginUrl);
    request.cookies.getAll().forEach(({ name }) => {
      if (name.startsWith('sb-')) {
        redirectResponse.cookies.delete(name);
      }
    });
    return redirectResponse;
  }

  // Not logged in at all -> straight back to login
  if (!user) {
    const loginUrl = new URL('/', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Logged in -> check their role against what this route allows
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    // Couldn't verify role -> safest is to bounce to login
    const loginUrl = new URL('/', request.url);
    return NextResponse.redirect(loginUrl);
  }

  const allowedRoles = ROUTE_ROLES[matchedRoute];
  if (!allowedRoles.includes(profile.role)) {
    // Wrong role for this specific page — no exceptions, no "helpful"
    // redirect to their own dashboard. Straight back to login.
    const loginUrl = new URL('/', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ['/employee/:path*', '/hr/:path*', '/super-admin/:path*'],
};
