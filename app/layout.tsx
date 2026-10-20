import type { Metadata } from "next";
import localFont from "next/font/local";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import ThemeRouteGuard from "@/components/ThemeRouteGuard";
import "./globals.css";

const themeInitializationScript = `
  (function () {
    try {
      var supportsPortalTheme = location.pathname === '/employee' || location.pathname.indexOf('/employee/') === 0 || location.pathname === '/hr' || location.pathname.indexOf('/hr/') === 0 || location.pathname === '/super-admin' || location.pathname.indexOf('/super-admin/') === 0;
      var savedTheme = supportsPortalTheme ? localStorage.getItem('theme') : 'light';
      var useDark = supportsPortalTheme && (savedTheme === 'dark' ||
        (savedTheme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches));
      document.documentElement.classList.toggle('dark', useDark);
      document.documentElement.style.colorScheme = useDark ? 'dark' : 'light';
    } catch (error) {
      var supportsPortalTheme = location.pathname === '/employee' || location.pathname.indexOf('/employee/') === 0 || location.pathname === '/hr' || location.pathname.indexOf('/hr/') === 0 || location.pathname === '/super-admin' || location.pathname.indexOf('/super-admin/') === 0;
      var useSystemDark = supportsPortalTheme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', useSystemDark);
      document.documentElement.style.colorScheme = useSystemDark ? 'dark' : 'light';
    }
  })();
`;

// Fonts are self-hosted (woff2 vendored under app/fonts) instead of
// next/font/google. Same families, weights, subsets, and CSS variables as
// before -- the switch removes a build-time network dependency on
// fonts.gstatic.com, which made production builds fail intermittently
// (Google font file fetch errors surface as Turbopack "Module not found").
const jakarta = localFont({
  variable: "--font-display",
  display: "swap",
  src: [
    { path: "./fonts/plus-jakarta-sans-500-latin.woff2", weight: "500", style: "normal" },
    { path: "./fonts/plus-jakarta-sans-600-latin.woff2", weight: "600", style: "normal" },
    { path: "./fonts/plus-jakarta-sans-700-latin.woff2", weight: "700", style: "normal" },
    { path: "./fonts/plus-jakarta-sans-800-latin.woff2", weight: "800", style: "normal" },
  ],
});

const inter = localFont({
  variable: "--font-sans",
  display: "swap",
  src: [
    { path: "./fonts/inter-400-latin.woff2", weight: "400", style: "normal" },
    { path: "./fonts/inter-500-latin.woff2", weight: "500", style: "normal" },
    { path: "./fonts/inter-600-latin.woff2", weight: "600", style: "normal" },
    { path: "./fonts/inter-700-latin.woff2", weight: "700", style: "normal" },
  ],
});

// Condensed face reserved only for big stat numbers (the live clock,
// the summary card counts) — see .stat-number in globals.css.
const oswald = localFont({
  variable: "--font-stat",
  display: "swap",
  src: [
    { path: "./fonts/oswald-400-latin.woff2", weight: "400", style: "normal" },
    { path: "./fonts/oswald-500-latin.woff2", weight: "500", style: "normal" },
    { path: "./fonts/oswald-600-latin.woff2", weight: "600", style: "normal" },
    { path: "./fonts/oswald-700-latin.woff2", weight: "700", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: "Hamdan Engineering",
  description: "Employee attendance and account management portal",
  icons: {
    icon: "/images/h.png",
    shortcut: "/images/h.png",
    apple: "/images/h.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${jakarta.variable} ${inter.variable} ${oswald.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeRouteGuard />
        {children}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
