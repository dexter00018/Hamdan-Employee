# Employee Ask AI

The employee dashboard has a floating bottom-right Ask AI chat panel with in-memory message bubbles and automatic language matching, without filter dropdowns. The panel is backed by `app/api/employee-ask-ai/route.ts`. Two n8n workflows perform intent classification and PDF extraction. The server authorizes every data query and formats the final response.

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

- Own profile: "Sino ako?", "Anong pangalan ko?", own designation or work email. The server queries only approved profile columns using the verified session ID, without another model call.
- Current-month leave history spans the first through last calendar day in Asia/Manila, including scheduled requests later in the month. Current-year spans January 1 through December 31. Leave counts and details use requests whose start_date falls in that range; attendance remains capped at today. Payroll cutoff dates are resolved separately.

Identity is resolved silently from the request cookies with `supabase.auth.getUser()` at the start of every POST. Missing or invalid sessions receive HTTP 401 before chat input is processed. The classifier receives the question, language, request ID, and up to 8 recent user/assistant messages (at most 1,000 characters each); it must never ask for the caller's name or employee number. All private queries use the verified session user ID and the user's RLS-scoped client. Names typed in chat cannot change that identity. Clarification may still be needed for payroll dates or a colleague's directory name.

After updating the classifier JSON, re-import it into the existing n8n classifier workflow (or replace its `Build Classifier Prompt` node code), retain its credentials, and publish it. Local JSON changes do not update a running n8n workflow automatically.

- Latest own absence: "Kelan ako huling nag absent?" uses last_absent_date, only status Absent, newest log_date first, excluding future dates. Without an explicit period it searches all available history; a stated current month/year/today limits the search. Missing time-in never implies absence.
- Group directory lookup: "Ano ang email ng mga architect?" returns names, work emails, and designations for active employees whose designation contains Architect, including Project Architect and Junior Architect / Interior Designer. Only approved directory fields are selected. At most 100 matches are shown with an explicit truncation notice; private group questions remain refused.
- Own recorded attendance today, current month, or current year: absences, lateness, present/leave days, time-in and time-out. Missing logs are not inferred as absences. Time lists show at most the latest 31 recorded days, with an explicit notice.
- Own annual recorded leave credits. Missing balance rows produce an explicit unavailable message rather than invented credits.
- Counts of own leave requests whose start dates fall within the selected period.
- One active employee's approved directory work email and/or designation. Ambiguous names require clarification. No fallback to personal/login email.
- Basic pay, gross compensation, net pay, deduction rows, or summary from the selected own published payslip. The latest published cutoff is the default; newest upload wins if a cutoff has multiple versions. Explicit month/date/year cutoffs are resolved from the question and still bound to the session owner.

Name historical cutoffs directly in chat, for example ?What are my deductions for August 16?31, 2026?? Incomplete or unsupported dates produce a clarification response instead of silently choosing the latest PDF. Re-ask with the complete question and cutoff. Messages stay visible when minimized, and New conversation clears them. The chat sends the last 8 non-error messages for follow-up context. These may include previous payroll answers; n8n and Gemini process this recent history. The classifier returns a standalone resolved_question for cutoff parsing. History is untrusted and cannot authorize access or supply database facts. New conversation clears this memory; account changes reset the keyed chat component. Memory is kept only in React state and is lost on reload. Re-import the updated classifier JSON to recognize explicit payslip dates.

## PDF processing and limits

The sample reviewed in this session was one image-only, unencrypted PDF page. The reader uses Gemini's native PDF vision via inline base64; no extraction library or OCR package is added to the app. Both workflows use the already selected `gemini-3.5-flash-lite` model.

The server verifies the selected payslip's session owner, published status and owner-prefixed storage path before download. It sends only PDF bytes and a random request ID to the reader. The reader has no Supabase credentials, database tools, external-URL download step, employee question, or session token. **n8n and Google Gemini process the payslip contents.** The UI discloses this.

PDF size is limited to 4 MB; encrypted/unreadable/ambiguous or multiple-employee documents must be refused. The server validates the returned fields, matches the employee name (order-independent exact normalized tokens) and cutoff dates, checks cents precision, and checks gross-minus-deductions versus net pay when all three are readable. A nickname or missing middle name can cause a safe refusal; contact HR rather than guessing identity. Numeric checks cannot prove OCR accuracy; Ask AI displays the requested amounts and deductions directly in chat, with no PDF attachment or download link. Its former PDF download endpoint returns HTTP 410.

Blank/dash/unclear amounts remain null and display as “Not stated / unclear”. Currency is not inferred if the PDF does not state it. Basic pay is labelled as cutoff pay, never extrapolated to a monthly salary. No actual employee PDF, salary fixture, or extracted amount is committed to this repository.

## Security and deployment state

- Strict active-employee session check; client-supplied identity fields are rejected.
- Fixed allowlisted intents, fields and queries; no model-generated SQL or authorization decisions.
- A maximum of five questions per employee per minute, backed by the existing database rate limiter. Limiter errors fail closed.
- Private no-store responses, bounded input/upstream output, HTTPS-only webhook URLs, redirects rejected, and timeouts.
- No persistent chat history, PDF extraction database, embeddings, or AI memory.
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
