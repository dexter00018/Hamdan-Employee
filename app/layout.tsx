import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter, Oswald } from "next/font/google";
import "./globals.css";

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
      className={`${jakarta.variable} ${inter.variable} ${oswald.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
