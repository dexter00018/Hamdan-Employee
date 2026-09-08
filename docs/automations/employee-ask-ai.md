# Employee Ask AI

The employee dashboard has a floating bottom-right Ask AI chat panel with in-memory message bubbles and automatic language matching, without filter dropdowns. The panel is backed by `app/api/employee-ask-ai/route.ts`. Two n8n workflows perform intent classification and PDF extraction. The server authorizes every data query and formats the final response. Safe portal workflow knowledge lives in `lib/employee/system-knowledge.ts`, with the human-readable source in `docs/automations/employee-ask-ai-system-knowledge.md`.

## Import and connect

1. Import `employee-ask-ai-classifier.json` and `employee-ask-ai-payslip-reader.json` into n8n.
2. In BOTH webhook nodes, select a Header Auth credential with header name `x-employee-ai-secret`. Copy the generated `N8N_EMPLOYEE_AI_WEBHOOK_SECRET` value from local `.env.local` into that credential. Never paste it in chat or commit it.
3. In BOTH Gemini HTTP nodes, select a Query Auth credential with parameter name `key` and your Gemini API key. Placeholder credential IDs must be replaced in the n8n editor.
4. Publish/activate the workflows after credentials are selected. Copy their HTTPS **production** webhook URLs into:

   ```dotenv
   N8N_EMPLOYEE_AI_CLASSIFIER_URL=https://YOUR-N8N/webhook/employee-ask-ai-classify
   N8N_EMPLOYEE_AI_PAYSLIP_URL=https://YOUR-N8N/webhook/employee-ask-ai-payslip
   N8N_EMPLOYEE_AI_WEBHOOK_SECRET=YOUR-SHARED-SECRET
   ```

5. Restart local development if environment changes are not picked up. For production, set the same three server-only variables in Vercel and deploy the application changes. Do not prefix them with `NEXT_PUBLIC_`.
6. Sign in with an active employee account, open Ask AI, choose a published payslip, and ask “Ano ang deductions sa selected payslip ko?” Compare against the original PDF. Test absent/late, leave balance, directory, and a refused colleague salary question too.

The API requires existing `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. The service-role client is used ONLY for the existing shared `consume_api_rate_limit` RPC. Private records and PDFs use the authenticated user's RLS-scoped client.

## Supported questions

Expanded scope supports yesterday, last month, last year, named months/years, and explicit date ranges. Relative dates are computed on the server in Asia/Manila. Custom dates are validated as real ISO dates in chronological order. A month without a year uses the current year; the returned answer shows the actual range. Follow-ups preserve the previous metric and scope. Clarifications ask for a period, topic, payroll cutoff, or designation rather than repeating generic help.

Directory shorthand includes IT, HR, architects/arkitekto, engineers, accounting, payroll, admin, operations, designers, and related work-role terms. IT/HR use title prefixes to avoid substring matches inside unrelated titles. Other employees remain limited to name, work email, and designation. Own attendance supports absence_dates, late_dates, and attendance_history in addition to counts and latest absence. Existing size limits remain: large attendance/leave queries fail rather than return incomplete totals; date lists display up to 100 matching records.

- Own profile: "Sino ako?", "Anong pangalan ko?", own designation or work email. The server queries only approved profile columns using the verified session ID, without another model call.
- Current-month leave history spans the first through last calendar day in Asia/Manila, including scheduled requests later in the month. Current-year spans January 1 through December 31. Leave counts and details use requests whose start_date falls in that range; attendance remains capped at today. Payroll cutoff dates are resolved separately.
- General system workflow questions are classified as `how_to` and answered from the safe system knowledge pack. Covered topics include dashboard overview, Time In / Time Out, attendance history, attendance status meanings, File Dispute, Report Missing Log, leave requests, leave credits, leave history, My Payslips, payslip password confirmation, Plan My Commute, profile updates, work directory rules, Ask AI privacy rules, notifications, announcements, holidays, birthdays, theme/display behavior, HR workflow overview, super-admin workflow overview, and general navigation.

Identity is resolved silently from the request cookies with `supabase.auth.getUser()` at the start of every POST. Missing or invalid sessions receive HTTP 401 before chat input is processed. The classifier receives the question, language, request ID, and up to 8 recent user/assistant messages (at most 1,000 characters each); it must never ask for the caller's name or employee number. All private queries use the verified session user ID and the user's RLS-scoped client. Names typed in chat cannot change that identity. Clarification may still be needed for payroll dates or a colleague's directory name.

After updating the classifier JSON, re-import it into the existing n8n classifier workflow (or replace its `Build Classifier Prompt` node code), retain its credentials, and publish it. Local JSON changes do not update a running n8n workflow automatically.

- Latest own absence: "Kelan ako huling nag absent?" uses last_absent_date, only status Absent, newest log_date first, excluding future dates. Without an explicit period it searches all available history; a stated current month/year/today limits the search. Missing time-in never implies absence.
- Group directory lookup: "Ano ang email ng mga architect?" returns names, work emails, and designations for active employees whose designation contains Architect, including Project Architect and Junior Architect / Interior Designer. Only approved directory fields are selected. At most 100 matches are shown with an explicit truncation notice; private group questions remain refused.
- Own recorded attendance today, current month, or current year: absences, lateness, present/leave days, time-in and time-out. Missing logs are not inferred as absences. Time lists show at most the latest 31 recorded days, with an explicit notice.
- Own annual recorded leave credits. Missing balance rows produce an explicit unavailable message rather than invented credits.
- Counts of own leave requests whose start dates fall within the selected period.
- One active employee's approved directory work email and/or designation. Ambiguous names require clarification. No fallback to personal/login email.
- Basic pay, gross compensation, net pay, deduction rows, or summary from the selected own published payslip. The default "latest payslip" is the newest uploaded published payslip for the signed-in employee. Explicit month/date/year cutoffs are resolved from the question and still bound to the session owner.

Name historical cutoffs directly in chat, for example "What are my deductions for August 16-31, 2026?" Incomplete or unsupported dates produce a clarification response instead of silently choosing the latest PDF. Re-ask with the complete question and cutoff. Messages stay visible when minimized, and New conversation clears them. The chat sends the last 8 non-error messages for follow-up context. These may include previous payroll answers; n8n and Gemini process this recent history. The classifier returns a standalone resolved_question for cutoff parsing. History is untrusted and cannot authorize access or supply database facts. New conversation clears this memory; account changes reset the keyed chat component. Memory is kept only in React state and is lost on reload. Re-import the updated classifier JSON to recognize explicit payslip dates and system workflow questions.

## PDF processing and limits

The sample reviewed in this session was one image-only, unencrypted PDF page. The reader uses Gemini's native PDF vision via inline base64; no extraction library or OCR package is added to the app. Both workflows use the already selected `gemini-3.5-flash-lite` model.

The server verifies the selected payslip's session owner, published status and owner-prefixed storage path before download. It sends only PDF bytes and a random request ID to the reader. The reader has no Supabase credentials, database tools, external-URL download step, employee question, or session token. **n8n and Google Gemini process the payslip contents.** The UI discloses this.

PDF size is limited to 4 MB; encrypted/unreadable or multiple-employee documents must be refused. The reader should not mark the whole PDF unreadable only because one amount or deduction row is unclear; unclear values remain null. The server validates the returned fields, requires the verified employee's first and last name tokens when a name is extracted, validates cutoff dates for explicit cutoff questions, and checks amount formats and cents precision. Latest-payslip questions use the database-selected newest uploaded published payslip as the source of truth, so unclear extracted name/date text does not block an otherwise readable own PDF unless OCR returns a different employee name. Numeric checks cannot prove OCR accuracy; Ask AI displays the requested amounts and deductions directly in chat, with no PDF attachment or download link. Its former PDF download endpoint returns HTTP 410.

Blank/dash/unclear amounts remain null and display as “Not stated / unclear”. Currency is not inferred if the PDF does not state it. Basic pay is labelled as cutoff pay, never extrapolated to a monthly salary. No actual employee PDF, salary fixture, or extracted amount is committed to this repository.

## Security and deployment state

- Strict active-employee session check; client-supplied identity fields are rejected.
- Fixed allowlisted intents, fields and queries; no model-generated SQL or authorization decisions.
- A maximum of five questions per employee per minute, backed by the existing database rate limiter. Limiter errors fail closed.
- Private no-store responses, bounded input/upstream output, HTTPS-only webhook URLs, redirects rejected, and timeouts.
- No persistent chat history, PDF extraction database, embeddings, or private employee AI memory. The only durable AI knowledge is the approved non-private system workflow knowledge pack.
- n8n execution saving is disabled in both exports. Existing execution history and instance/proxy/provider retention are separate; do not pin real payslips.
- Database migration `20260907024148_employee_payslip_published_reads.sql` was applied to project `msoomcjzzudibiyezclj`. Employees can read only their own published payslip metadata and matching storage files; HR retains draft access.
- `.env.local` contains generated secret and blank URL entries. No n8n workflows were imported/activated remotely and no Vercel application deployment was performed in this session.

## Verification

- `npm test`: unit, exported-classifier, service authorization, extraction validation and HTTP authentication/rate-limit tests.
- `npx tsc --noEmit`, targeted ESLint, and `npm run build` passed.
- `supabase/checks/employee_payslip_read_access.sql` ran against the live project after migration. It creates synthetic metadata inside a rolled-back transaction: two employees each see only one own published record/file, and HR sees all four synthetic published/draft records/files. No real PDFs were uploaded or modified.
- Browser: unauthenticated employee navigation redirects to login; the real API returns 401 with no-store headers. Mobile/desktop floating chat views, dark-mode contrast and synthetic message rendering were checked in an isolated temporary route that was removed afterward. No employee login credentials were available, so a full authenticated dashboard-to-n8n-to-Gemini test remains pending.
- The actual sample PDF has not been sent to the new n8n/Gemini workflow. Validate live OCR after configuring the endpoints; fixture tests do not establish model accuracy.

Supabase's security advisor still reports existing callable SECURITY DEFINER functions (including archive/settlement functions) and disabled leaked-password protection; these were not introduced or changed here. See [function advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) and [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). The rate-limit table intentionally has RLS with no employee policies.

References: [Gemini PDF processing](https://ai.google.dev/gemini-api/docs/generate-content/document-processing), [Supabase Storage RLS](https://supabase.com/docs/guides/storage/security/access-control).

## Shared Ask AI baseline

Apply these rules together across the chat templates, server handlers, classifier, PDF reader, and system knowledge whenever changing Ask AI:

- Bind private queries to the authenticated employee. Password confirmation unlocks only that employee's payslip access; it never authorizes another employee's records.
- Allow only approved active-employee directory fields for other people: name, work email, and designation.
- Resolve follow-ups from recent conversation while treating history as untrusted context, never identity or database evidence.
- Keep English starter prompts supported end to end. ?What are the deductions in my latest payslip?? selects the newest uploaded published own payslip without requesting a cutoff. Explicit cutoffs remain explicit.
- Return actual queried/extracted values. Missing or unreadable values must be identified as unavailable, never invented or replaced with zero. Partial PDF extraction may answer supported fields; a different extracted employee name still fails validation.
- Count absences only from saved Absent status. Preserve requested dates and use complete calendar months for month queries.
- Keep workflow guidance free of private records and credentials. Passwords stay in the application authentication flow, never chat history or n8n/Gemini.
- Update classifier prompt and validator together when extending the schema; update the server validator, handler, documentation, and relevant regression tests in the same change.

Canonical n8n imports are `employee-ask-ai-classifier.json` and `employee-ask-ai-payslip-reader.json` in this directory. Downloaded exports are deployment copies. Deploy application changes and update both affected workflows together; preserve the configured credentials when importing. Local tests do not prove that the live n8n workflows have been updated.
