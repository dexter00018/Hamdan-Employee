import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter, Oswald } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import ThemeRouteGuard from "@/components/ThemeRouteGuard";
import "./globals.css";

const themeInitializationScript = `
  (function () {
    try {
      var isEmployeeRoute = location.pathname === '/employee' || location.pathname.indexOf('/employee/') === 0;
      var savedTheme = isEmployeeRoute ? localStorage.getItem('theme') : 'light';
      var useDark = isEmployeeRoute && (savedTheme === 'dark' ||
        (savedTheme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches));
      document.documentElement.classList.toggle('dark', useDark);
      document.documentElement.style.colorScheme = useDark ? 'dark' : 'light';
    } catch (error) {
      var isEmployeeRoute = location.pathname === '/employee' || location.pathname.indexOf('/employee/') === 0;
      var useSystemDark = isEmployeeRoute && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', useSystemDark);
      document.documentElement.style.colorScheme = useSystemDark ? 'dark' : 'light';
    }
  })();
`;

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Condensed face reserved only for big stat numbers (the live clock,
// the summary card counts) — see .stat-number in globals.css.
const oswald = Oswald({
  variable: "--font-stat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
