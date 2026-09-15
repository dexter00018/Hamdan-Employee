# Manila announcement webhook

Import `manila-announcement-email.json` as a new n8n workflow. This file does not activate n8n or install a Supabase webhook.

1. Apply `supabase/migrations/20260915033220_announcement_explicit_email_publish.sql` to Manila. It adds a nullable email publication marker and enables full previous-row webhook data; existing rows do not trigger mail. Then in **Announcement Webhook**, create/select Header Auth credential `MANILA Announcement Webhook`: Name `x-announcement-secret`, Value a new random secret. The export contains no secret.
2. Assign Manila Supabase credentials to **Get Profiles** and **Get Employee Email**. Project: `msoomcjzzudibiyezclj`. Auth email lookup requires a server credential kept in n8n.
3. In **Config**, enter the actual Manila employee portal URL in `portalUrl`, the SMTP-authorized sender in `fromEmail`, and your own address in `testEmail`. Keep `testMode: true`.
4. Assign your Manila SMTP credential to **Send Announcement Email**. Save/publish the workflow.
5. Copy **Announcement Webhook → Production URL** exactly. Its path is `/webhook/announcement-published-manila`. With the previously used ngrok hostname, the expected URL is `https://yearly-goggles-proved.ngrok-free.dev/webhook/announcement-published-manila`; the node's displayed URL takes precedence if the host/configuration has changed.
6. In the Manila Supabase dashboard, Database → Webhooks, configure `public.announcements` INSERT and UPDATE events with HTTP POST to that URL. Headers: `Content-Type: application/json`, and `x-announcement-secret` with the same value as n8n. Check for an existing announcement webhook first to avoid duplicate notification sends.
7. Verify one intended announcement with testMode enabled. Confirm the n8n execution and test email, then disable testMode and publish when ready for employee delivery.

Recipients are employees whose Auth email is valid; banned/deleted Auth accounts are excluded. Each employee receives an individual message. Only a new `email_publication_id` from **Publish & Email** triggers mail. Save/Update preserves that marker and never triggers mail, even if text or image changed. Publishing again deliberately requests another email, including for unchanged content. Times use Asia/Manila. HTML content is escaped, and embedded images are restricted to Manila announcement storage.

Production calls do not appear as test-listener output; inspect the workflow's Executions tab. Opening this POST URL in a browser is not a valid test. HTTP receipt does not confirm completed SMTP delivery. No durable queue or event deduplication is included, so review partial executions before retrying.

Rebuild with `node scripts/build-announcement-workflow.mjs`; test with `npm test -- tests/announcement-email.test.ts`. This feature requires the migration, updated n8n validator, and new frontend together. Rollout order: pause the announcement workflow while changing it; apply migration; re-import/update this workflow and retain the actual Manila credentials and Config values; publish it; deploy the frontend. Remove any duplicate old announcement email workflow/webhook. Do not operate Save/Update against the old send-on-every-edit workflow.


## Save versus Publish

Save Announcement / Update Announcement saves the current text/image to the portal without requesting email. This is not a hidden draft feature: the existing employee portal still displays saved content. Publish & Email saves the current editor contents and changes the publication marker atomically in the same row write. Buttons are locked during saving to prevent double-click submissions. A failed database write is reported as a failure, including updates that return no row.

The UI reports a publication request, not confirmed email delivery. The database webhook can still create an n8n execution for an ordinary edit, but Validate Announcement stops it before recipient lookup/email. Manual replay of a genuine publication event can still duplicate mail; the marker is an event gate, not a persistent delivery ledger.

The announcement publication migration was applied to the live Manila project on 2026-09-15 via the Supabase connector. Verified the UUID column, full replica identity, and REST schema access (HTTP 200); schema cache was refreshed. The live n8n workflow update is still not verified. Synthetic validator tests and TypeScript validation passed; no live emails were sent.
