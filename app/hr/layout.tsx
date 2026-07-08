import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HR Portal | Hamdan Engineering",
};

export default function HRLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
