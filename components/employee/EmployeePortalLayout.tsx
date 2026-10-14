import type { ReactNode } from 'react';

export const EMPLOYEE_PORTAL_SHELL_CLASSNAME = 'dashboard-shell employee-portal-shell relative min-h-screen p-3 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:p-4 sm:pb-[calc(6rem+env(safe-area-inset-bottom))] md:p-6 md:pb-[calc(6rem+env(safe-area-inset-bottom))] lg:p-8';

export default function EmployeePortalLayout({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  return (
    <div className="employee-portal-layout mx-auto max-w-[1600px]">
      {sidebar}
      <div className="seasonal-content employee-portal-content min-w-0 space-y-3 md:space-y-4">
        {children}
      </div>
    </div>
  );
}
