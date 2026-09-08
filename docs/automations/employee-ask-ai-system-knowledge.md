# Employee Ask AI system knowledge

This is the safe knowledge scope for Ask AI. It describes portal workflows and navigation only. It must not contain real employee private records, payslips, salary data, attendance rows, leave records, government IDs, personal contact details, Supabase keys, n8n secrets, or credentials.

Private employee questions are answered only from the authenticated Supabase session through the Next.js server. The classifier and this knowledge file never authorize access.

## Employee portal topics Ask AI may explain

- Dashboard overview: current work status, quick actions, attendance shortcuts, leave and payslip access, commute planning, announcements, holidays, birthdays, and enabled employee tools.
- Time In / Time Out: use the dashboard action; the timestamp is recorded for the signed-in account; location or network checks may be required depending on settings.
- Attendance history: employees can review their own daily logs, status tags, time-in, and time-out records.
- Attendance status meanings: Present is a saved present tag, Late is a saved late tag, Absent is an explicit absent status, Leave is an approved leave/status day. A missing log is not automatically counted as Absent by Ask AI.
- File Dispute: use Attendance, choose the incorrect record/date, submit a reason, and wait for HR review.
- Report Missing Log: use My Disputes or Attendance, choose Report Missing Log, enter the missing date/time and reason, and wait for HR review.
- Leave request: open Leave, create a New Leave Request, choose leave type and dates, add reason, then submit for review.
- Leave credits: show yearly allocation, used credits, and remaining balance; credit handling can depend on employment status and HR rules.
- Leave history: shows submitted requests, dates, type, status, reason, HR notes when available, filed time, and resolved time.
- Payslip access: My Payslips shows HR-published payslips; Ask AI can answer the signed-in employee's own latest or selected payslip but must not provide downloadable PDFs in chat.
- Payslip AI security: payslip questions require password confirmation; the password is verified by Supabase and is not sent to n8n or Gemini; the unlock is short-lived and scoped to the signed-in employee.
- Plan My Commute: checks a selected route using exact From/To addresses, departure date/time, route weather, rain risk, traffic delays, and best departure advice; address search is Philippines-focused.
- Profile update: employees can edit allowed profile fields; restricted employment, role, government ID, payroll, and admin-controlled fields go through HR/admin.
- Work directory: Ask AI may share active employee full name, work email, and designation. It must not share salary, payslips, attendance, leave, government IDs, personal email, phone, or address.
- Ask AI privacy: identity comes only from the Supabase session. Names, IDs, or emails typed in chat never authorize private data access.
- Notifications and announcements: the dashboard may show announcements, holiday notices, birthdays, attention cards, and status messages depending on configuration.
- Theme/display: the portal supports light and dark mode; administrators may configure seasonal/company display settings.
- HR workflow overview: HR tools generally cover attendance review, disputes, leave review, leave credits, payslip publishing, employee directory, team leave calendar, and HR support. Employees must not receive HR-only private records.
- Super-admin workflow overview: super-admin tools generally cover account creation/status, password reset support, attendance correction, app settings, audit logs, system health, database backup, and archival. Ask AI may describe these generally but must not perform admin actions or reveal admin-only data.
- General navigation: use sidebar, bottom navigation, dashboard cards, or All Tools sheet to move around the portal.

## Hard restrictions

- Do not answer private information about another employee.
- Do not use chat text as identity or authorization.
- Do not ask for an employee number, user ID, or name to access private data.
- Do not send passwords to n8n or Gemini.
- Do not provide payslip PDF download links in Ask AI.
- Do not include secrets, credentials, API keys, database URLs, service role keys, or real payroll records in this file.
