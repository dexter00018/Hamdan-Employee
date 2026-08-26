# Modular dashboard UI structure

The Employee, HR, and Super Admin page files now act as dashboard containers. Full-screen modal presentation has been moved to feature-specific component files while the existing page remains the source of truth for data fetching, Supabase mutations, and shared dashboard state.

## Shared foundation

```text
components/shared/
├── EmptyState.tsx
└── ModalShell.tsx
```

`ModalShell` provides the reusable responsive, light/dark, keyboard, backdrop, focus-restoration, and body-scroll behavior used by the redesigned modal modules.

## Employee modules

```text
components/employee/
├── commute/
│   └── PlanMyCommuteModal.tsx
└── modals/
    ├── AttendanceCalendarModal.tsx
    ├── AttendanceDisputeFormModal.tsx
    ├── AttendanceDisputesModal.tsx
    ├── CompanyCalendarModal.tsx
    ├── EarlyTimeOutModal.tsx
    ├── EmployeeDirectoryModal.tsx
    ├── EmployeeDocumentsModal.tsx
    ├── HelpDeskModal.tsx
    ├── LeaveChoiceModal.tsx
    ├── LeaveRequestModal.tsx
    ├── LeaveRequestsModal.tsx
    ├── NotificationsModal.tsx
    ├── PayslipsModal.tsx
    └── SummaryDetailModal.tsx
```

The commute planner intentionally remains one complete module file.

## HR modules

```text
components/hr/modals/
├── AnnouncementsModal.tsx
├── AttendanceInsightsModal.tsx
├── DailyOverviewModal.tsx
├── DisputeHistoryModal.tsx
├── EmployeeChoiceModal.tsx
├── EmployeeDocumentsModal.tsx
├── EmployeeEditModal.tsx
├── EmployeeQuickViewModal.tsx
├── EmployeesModal.tsx
├── ExportReportsModal.tsx
├── HelpDeskRequestsModal.tsx
├── HolidaysModal.tsx
├── LeaveCreditsModal.tsx
├── LeaveHistoryModal.tsx
├── PayslipManagementModal.tsx
└── TeamLeaveCalendarModal.tsx
```

## Super Admin modules

```text
components/super-admin/modals/
├── AccountFormModal.tsx
├── AppSettingsModal.tsx
├── ArchivePasswordModal.tsx
├── AttendanceRecordsModal.tsx
├── AuditLogModal.tsx
├── BackupPasswordModal.tsx
├── DataArchiveModal.tsx
├── DatabaseBackupModal.tsx
├── EditAttendanceModal.tsx
├── ResetPasswordModal.tsx
├── SystemHealthModal.tsx
└── UserAccountsModal.tsx
```

## Maintenance rule

New modal UI should be added to the appropriate `components/<dashboard>/modals/` folder. Keep cross-feature queries and mutations in the dashboard container until their API boundary is independently tested. Run `npm run build` after changing a feature module.
