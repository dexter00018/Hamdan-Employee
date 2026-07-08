import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Employee Portal | Hamdan Engineering",
};

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
