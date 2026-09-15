# Manila module transfer from Jeddah

Target: Hamdan-Employee-Repo. Source: Hamdan-Jeddah. Prepared 2026-09-15.

## Included

- Dedicated IT Help Desk for Super Admin, reachable from Quick Actions and mobile tools. Attendance Records remains accessible through its existing tools.
- HR queries exclude IT Concern; IT queries include only IT Concern.
- Compact shared list/detail UI, search/category/status sorting, Active and History views.
- Employee cancellation of own active requests; HR cancellation of HR requests. Resolved/cancelled entries show read-only history.
- New Manila announcement and helpdesk email builders, templates, exports, and synthetic tests.

## Preserved

Existing Manila attendance APIs and rules, time-in/time-out settings, app settings, timezone configuration, environment files, credentials, existing automations, branding settings, payslip/leave/commute modules and language configuration were not replaced. New helpdesk timestamps and email templates use Asia/Manila.

AttendanceSection/useAttendance in Jeddah are a refactor of an existing Manila feature, not a missing module. Password recovery, Ask AI, employee documents, announcements, payslips and commute already exist in Manila; their implementations were not overwritten. Jeddah's Arabic UI infrastructure and Saudi schedule changes were not imposed on Manila.

## Required database rollout before deploying

Apply `supabase/migrations/20260915015818_manila_helpdesk_routing_history.sql` to the Manila database after reviewing current helpdesk schema/policies. It requires the existing employee_support_requests table. It replaces policies only on that table, normalizes Submitted to Open, extends the status constraint and locks terminal history. No attendance or application settings are changed.

The CLI could not connect to the Manila database on this network (IPv6 connection error). The migration is **not applied or live-tested**. Do not deploy the new cancellation UI without applying and validating its database dependency. `tests/helpdesk-routing.sql` is a rollback-only integration check to run afterward; no rows should be committed by that test.

## New email workflows

Regenerate with:

```
node scripts/build-announcement-workflow.mjs
node scripts/build-helpdesk-workflow.mjs
```

Import `docs/automations/manila-announcement-email.json` and `manila-helpdesk-email.json` as separate workflows. Both exports are inactive and in test mode; no credentials or live send were installed.

- Assign Manila Supabase credentials (project msoomcjzzudibiyezclj).
- Set Config's SMTP-authorized fromEmail and testEmail. Helpdesk also requires hrEmail and portalUrl (HTTPS origin without trailing slash). Announcement portalUrl must be the actual HTTPS employee page URL ending in /employee.
- Helpdesk subject: Category - Subject. Requests go to configured hrEmail; changed replies go to the requestor's Auth email. Status-only changes do not email. IT dashboard routing does not automatically redirect emails to another inbox.
- Select separate Header Auth credentials and copy the exact Production URLs from the imported nodes. Suggested headers: x-helpdesk-secret and x-announcement-secret. Connect the matching Manila database table INSERT/UPDATE events only after choosing secrets and checking for existing duplicate webhooks.
- Test with a designated address before disabling testMode. Existing Manila SMTP credentials and workflow settings have not been modified.

Templates use direct webhook delivery, not a durable outbox. HTTP acknowledgement is not proof of SMTP delivery; retries/replays can duplicate sends. No live email was sent during implementation.

## Validation

136 tests passed across 7 test files; TypeScript and production build passed. No authenticated browser, database integration, or live email verification was completed. No commit, push, deployment or live database mutation was performed.
