import type { Metadata } from "next";
import HROffsetApprovalNotifier from "@/components/hr/HROffsetApprovalNotifier";
import HRLeaveHierarchyManager from "@/components/hr/HRLeaveHierarchyManager";

export const metadata: Metadata = {
  title: "HR Portal | Hamdan Engineering",
};

export default function HRLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <HRLeaveHierarchyManager />
      <HROffsetApprovalNotifier />
    </>
  );
}
