# Dashboard dark-mode audit

Scope: employee, HR, super-admin, shared dashboard components. Read-only synthetic browser preview; no employee records or authenticated browser sessions were used.

## Findings and corrections

| Finding | Affected areas | Correction |
|---|---|---|
| Super-admin excluded from theme initialization and route guard | Reload and navigation into super-admin | Include super-admin in both route checks |
| Inverted Slate surface variables used as dark text | Modal close icons, mobile tools, form labels, secondary text | Explicit text utility colors independent of surface variables |
| Inverted Slate text variables used as dark backgrounds | ModalShell, menus, form fields, notification surfaces | Explicit surface utility colors independent of text variables |
| Brightened green/blue/rose fills with white button text | Primary/danger actions and status toast backgrounds | Darker filled surfaces while preserving bright status text |
| Dark status text on unchanged pastel surfaces | Badges, status cards, warning panels | Paired dark tinted surfaces and light status text |
| Hardcoded cream sticky header with inherited light text | PlanMyCommuteModal.tsx:646 | Explicit dark header background |
| Background and text animate independently during theme switch | All three dashboard theme buttons | Briefly suppress transitions during the switch; restore afterwards |

## Verification

914 static class samples from 70 TSX files rendered in a browser with the shared stylesheet. The first pass checked opaque backgrounds only. A second pass included alpha compositing and the 11 gradient endpoints, identifying the hardcoded cream commute-header surface at PlanMyCommuteModal.tsx:646; that header now has an explicit dark surface. This is a sample-level result, not a WCAG certification or a claim that every live screen passes. Samples use a shared card background when their original parent is absent. Dynamic class expressions, nested parent backgrounds, gradients, images, opacity/disabled states, third-party maps/charts, and actual authenticated flows need contextual review.

The employee page also contains local dark overrides. Shared utility corrections use higher specificity to avoid those reversing text and surface roles. Existing explicit seasonal/commute component styles are retained.

## Per-file static coverage

| File | Static color samples |
|---|---:|
| [components/employee/commute/CommuteResultExperience.tsx](../components/employee/commute/CommuteResultExperience.tsx) | 65 |
| [components/employee/commute/PlanMyCommuteModal.tsx](../components/employee/commute/PlanMyCommuteModal.tsx) | 83 |
| [components/employee/EmployeeAskAI.tsx](../components/employee/EmployeeAskAI.tsx) | 22 |
| [components/employee/EmployeeDesktopSidebar.tsx](../components/employee/EmployeeDesktopSidebar.tsx) | 10 |
| [components/employee/EmployeeQuickActions.tsx](../components/employee/EmployeeQuickActions.tsx) | 4 |
| [components/employee/EmployeeSummaryCard.tsx](../components/employee/EmployeeSummaryCard.tsx) | 4 |
| [components/employee/EmployeeWorkClock.tsx](../components/employee/EmployeeWorkClock.tsx) | 5 |
| [components/employee/MobileAllToolsSheet.tsx](../components/employee/MobileAllToolsSheet.tsx) | 19 |
| [components/employee/MobileBottomNav.tsx](../components/employee/MobileBottomNav.tsx) | 2 |
| [components/employee/modals/AttendanceCalendarModal.tsx](../components/employee/modals/AttendanceCalendarModal.tsx) | 15 |
| [components/employee/modals/AttendanceDisputeFormModal.tsx](../components/employee/modals/AttendanceDisputeFormModal.tsx) | 20 |
| [components/employee/modals/AttendanceDisputesModal.tsx](../components/employee/modals/AttendanceDisputesModal.tsx) | 16 |
| [components/employee/modals/CompanyCalendarModal.tsx](../components/employee/modals/CompanyCalendarModal.tsx) | 10 |
| [components/employee/modals/EarlyTimeOutModal.tsx](../components/employee/modals/EarlyTimeOutModal.tsx) | 3 |
| [components/employee/modals/EmployeeActionCenterModal.tsx](../components/employee/modals/EmployeeActionCenterModal.tsx) | 8 |
| [components/employee/modals/EmployeeDirectoryModal.tsx](../components/employee/modals/EmployeeDirectoryModal.tsx) | 9 |
| [components/employee/modals/EmployeeDocumentsModal.tsx](../components/employee/modals/EmployeeDocumentsModal.tsx) | 4 |
| [components/employee/modals/EmployeeGovernmentIdsModal.tsx](../components/employee/modals/EmployeeGovernmentIdsModal.tsx) | 4 |
| [components/employee/modals/HelpDeskModal.tsx](../components/employee/modals/HelpDeskModal.tsx) | 6 |
| [components/employee/modals/LeaveChoiceModal.tsx](../components/employee/modals/LeaveChoiceModal.tsx) | 9 |
| [components/employee/modals/LeaveRequestModal.tsx](../components/employee/modals/LeaveRequestModal.tsx) | 12 |
| [components/employee/modals/LeaveRequestsModal.tsx](../components/employee/modals/LeaveRequestsModal.tsx) | 14 |
| [components/employee/modals/NotificationsModal.tsx](../components/employee/modals/NotificationsModal.tsx) | 3 |
| [components/employee/modals/PayslipsModal.tsx](../components/employee/modals/PayslipsModal.tsx) | 8 |
| [components/employee/modals/SummaryDetailModal.tsx](../components/employee/modals/SummaryDetailModal.tsx) | 6 |
| [components/hr/HRDesktopSidebar.tsx](../components/hr/HRDesktopSidebar.tsx) | 9 |
| [components/hr/HRMobileBottomNav.tsx](../components/hr/HRMobileBottomNav.tsx) | 2 |
| [components/hr/HRMobileToolsSheet.tsx](../components/hr/HRMobileToolsSheet.tsx) | 14 |
| [components/hr/modals/AnnouncementsModal.tsx](../components/hr/modals/AnnouncementsModal.tsx) | 4 |
| [components/hr/modals/AttendanceInsightsModal.tsx](../components/hr/modals/AttendanceInsightsModal.tsx) | 7 |
| [components/hr/modals/DailyOverviewModal.tsx](../components/hr/modals/DailyOverviewModal.tsx) | 7 |
| [components/hr/modals/DisputeHistoryModal.tsx](../components/hr/modals/DisputeHistoryModal.tsx) | 14 |
| [components/hr/modals/EmployeeChoiceModal.tsx](../components/hr/modals/EmployeeChoiceModal.tsx) | 3 |
| [components/hr/modals/EmployeeDocumentsModal.tsx](../components/hr/modals/EmployeeDocumentsModal.tsx) | 6 |
| [components/hr/modals/EmployeeEditModal.tsx](../components/hr/modals/EmployeeEditModal.tsx) | 6 |
| [components/hr/modals/EmployeeQuickViewModal.tsx](../components/hr/modals/EmployeeQuickViewModal.tsx) | 15 |
| [components/hr/modals/EmployeesModal.tsx](../components/hr/modals/EmployeesModal.tsx) | 8 |
| [components/hr/modals/ExportReportsModal.tsx](../components/hr/modals/ExportReportsModal.tsx) | 20 |
| [components/hr/modals/HelpDeskRequestsModal.tsx](../components/hr/modals/HelpDeskRequestsModal.tsx) | 5 |
| [components/hr/modals/HolidaysModal.tsx](../components/hr/modals/HolidaysModal.tsx) | 7 |
| [components/hr/modals/HRActionCenterModal.tsx](../components/hr/modals/HRActionCenterModal.tsx) | 6 |
| [components/hr/modals/LeaveCreditsModal.tsx](../components/hr/modals/LeaveCreditsModal.tsx) | 9 |
| [components/hr/modals/LeaveHistoryModal.tsx](../components/hr/modals/LeaveHistoryModal.tsx) | 15 |
| [components/hr/modals/PayslipManagementModal.tsx](../components/hr/modals/PayslipManagementModal.tsx) | 11 |
| [components/hr/modals/TeamLeaveCalendarModal.tsx](../components/hr/modals/TeamLeaveCalendarModal.tsx) | 17 |
| [components/super-admin/modals/AccountFormModal.tsx](../components/super-admin/modals/AccountFormModal.tsx) | 9 |
| [components/super-admin/modals/AdminAttentionModal.tsx](../components/super-admin/modals/AdminAttentionModal.tsx) | 5 |
| [components/super-admin/modals/AppSettingsModal.tsx](../components/super-admin/modals/AppSettingsModal.tsx) | 26 |
| [components/super-admin/modals/ArchivePasswordModal.tsx](../components/super-admin/modals/ArchivePasswordModal.tsx) | 3 |
| [components/super-admin/modals/AttendanceRecordsModal.tsx](../components/super-admin/modals/AttendanceRecordsModal.tsx) | 15 |
| [components/super-admin/modals/AuditLogModal.tsx](../components/super-admin/modals/AuditLogModal.tsx) | 11 |
| [components/super-admin/modals/BackupPasswordModal.tsx](../components/super-admin/modals/BackupPasswordModal.tsx) | 3 |
| [components/super-admin/modals/DataArchiveModal.tsx](../components/super-admin/modals/DataArchiveModal.tsx) | 2 |
| [components/super-admin/modals/DatabaseBackupModal.tsx](../components/super-admin/modals/DatabaseBackupModal.tsx) | 2 |
| [components/super-admin/modals/EditAttendanceModal.tsx](../components/super-admin/modals/EditAttendanceModal.tsx) | 2 |
| [components/super-admin/modals/ResetPasswordModal.tsx](../components/super-admin/modals/ResetPasswordModal.tsx) | 0 |
| [components/super-admin/modals/SystemHealthModal.tsx](../components/super-admin/modals/SystemHealthModal.tsx) | 7 |
| [components/super-admin/modals/UserAccountsModal.tsx](../components/super-admin/modals/UserAccountsModal.tsx) | 12 |
| [components/super-admin/SuperAdminDesktopSidebar.tsx](../components/super-admin/SuperAdminDesktopSidebar.tsx) | 8 |
| [components/super-admin/SuperAdminMobileBottomNav.tsx](../components/super-admin/SuperAdminMobileBottomNav.tsx) | 1 |
| [components/super-admin/SuperAdminMobileToolsSheet.tsx](../components/super-admin/SuperAdminMobileToolsSheet.tsx) | 14 |
| [components/super-admin/SuperAdminQuickActions.tsx](../components/super-admin/SuperAdminQuickActions.tsx) | 4 |
| [components/shared/BentoGrid.tsx](../components/shared/BentoGrid.tsx) | 2 |
| [components/shared/EmptyState.tsx](../components/shared/EmptyState.tsx) | 4 |
| [components/shared/ModalShell.tsx](../components/shared/ModalShell.tsx) | 5 |
| [components/shared/useVerificationDialog.tsx](../components/shared/useVerificationDialog.tsx) | 0 |
| [components/shared/VerificationDialog.tsx](../components/shared/VerificationDialog.tsx) | 4 |
| [app/employee/page.tsx](../app/employee/page.tsx) | 93 |
| [app/hr/page.tsx](../app/hr/page.tsx) | 80 |
| [app/super-admin/page.tsx](../app/super-admin/page.tsx) | 56 |

## Locations using the problematic explicit dark Slate utilities

These are source-level candidates covered by the shared fix; not every occurrence was unreadable in its original parent context.

- components/employee/EmployeeQuickActions.tsx:65 ? `text-balance text-[10px] text-slate-800 dark:text-slate-100`
- components/employee/MobileAllToolsSheet.tsx:134 ? `text-[10px] text-slate-800 dark:text-slate-100`
- components/employee/modals/EmployeeActionCenterModal.tsx:38 ? `bg-white dark:bg-slate-900`
- components/employee/modals/EmployeeActionCenterModal.tsx:38 ? `bg-slate-100 text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-200`
- components/employee/modals/EmployeeDirectoryModal.tsx:14 ? `bg-slate-200 dark:bg-slate-700`
- components/employee/modals/EmployeeDirectoryModal.tsx:14 ? `bg-slate-200 dark:bg-slate-700`
- components/employee/modals/EmployeeDirectoryModal.tsx:14 ? `bg-slate-200 dark:bg-slate-700`
- components/employee/modals/EmployeeGovernmentIdsModal.tsx:21 ? `bg-white text-slate-500 dark:bg-slate-900`
- components/employee/modals/PayslipsModal.tsx:24 ? `bg-slate-200 text-[10px] text-slate-800 dark:bg-slate-700 dark:text-white`
- components/hr/HRMobileToolsSheet.tsx:24 ? `bg-slate-200 dark:bg-slate-600`
- components/hr/modals/AttendanceInsightsModal.tsx:16 ? `bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100`
- components/hr/modals/DailyOverviewModal.tsx:20 ? `bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100`
- components/hr/modals/DisputeHistoryModal.tsx:21 ? `bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-200`
- components/hr/modals/LeaveHistoryModal.tsx:22 ? `bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-200`
- components/super-admin/modals/AppSettingsModal.tsx:64 ? `bg-slate-200 text-[9px] text-slate-700 dark:bg-slate-700 dark:!text-white`
- components/super-admin/modals/AuditLogModal.tsx:10 ? `bg-slate-200 dark:bg-slate-700`
- components/super-admin/modals/AuditLogModal.tsx:10 ? `bg-slate-200 dark:bg-slate-700`
- components/super-admin/modals/AuditLogModal.tsx:10 ? `bg-white dark:bg-slate-900`
- components/super-admin/modals/UserAccountsModal.tsx:16 ? `bg-slate-200 dark:bg-slate-700`
- components/super-admin/SuperAdminMobileToolsSheet.tsx:16 ? `bg-slate-200 dark:bg-slate-600`
- components/super-admin/SuperAdminQuickActions.tsx:39 ? `text-balance text-[10px] text-slate-800 dark:text-slate-100`
- components/shared/EmptyState.tsx:13 ? `bg-white dark:bg-slate-900`
- components/shared/ModalShell.tsx:137 ? `bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-200`
- components/shared/ModalShell.tsx:149 ? `bg-white dark:bg-slate-900`
- components/shared/VerificationDialog.tsx:20 ? `text-[11px] text-slate-700 dark:text-slate-200`
- app/employee/page.tsx:2007 ? `bg-white dark:bg-slate-900`
- app/hr/page.tsx:1993 ? `bg-white dark:bg-slate-900`
- app/hr/page.tsx:2015 ? `bg-slate-100 text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-100`
- app/hr/page.tsx:2061 ? `text-[10px] text-slate-600 dark:text-slate-200`
