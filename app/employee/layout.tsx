import type { Metadata } from "next";
import LeadLeaveApprovalNotifier from "@/components/employee/LeadLeaveApprovalNotifier";
import OffsetLeaveRequestBridge from "@/components/employee/OffsetLeaveRequestBridge";

export const metadata: Metadata = {
  title: "Employee Portal | Hamdan Engineering",
};

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <LeadLeaveApprovalNotifier />
      <OffsetLeaveRequestBridge />
    </>
  );
}
