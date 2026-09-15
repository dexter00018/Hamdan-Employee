# Manila announcement webhook

Import `manila-announcement-email.json` as a new n8n workflow. This file does not activate n8n or install a Supabase webhook.

1. In **Announcement Webhook**, create/select Header Auth credential `MANILA Announcement Webhook`: Name `x-announcement-secret`, Value a new random secret. The export contains no secret.
2. Assign Manila Supabase credentials to **Get Profiles** and **Get Employee Email**. Project: `msoomcjzzudibiyezclj`. Auth email lookup requires a server credential kept in n8n.
3. In **Config**, enter the actual Manila employee portal URL in `portalUrl`, the SMTP-authorized sender in `fromEmail`, and your own address in `testEmail`. Keep `testMode: true`.
4. Assign your Manila SMTP credential to **Send Announcement Email**. Save/publish the workflow.
5. Copy **Announcement Webhook → Production URL** exactly. Its path is `/webhook/announcement-published-manila`. With the previously used ngrok hostname, the expected URL is `https://yearly-goggles-proved.ngrok-free.dev/webhook/announcement-published-manila`; the node's displayed URL takes precedence if the host/configuration has changed.
6. In the Manila Supabase dashboard, Database → Webhooks, configure `public.announcements` INSERT and UPDATE events with HTTP POST to that URL. Headers: `Content-Type: application/json`, and `x-announcement-secret` with the same value as n8n. Check for an existing announcement webhook first to avoid duplicate notification sends.
7. Verify one intended announcement with testMode enabled. Confirm the n8n execution and test email, then disable testMode and publish when ready for employee delivery.

Recipients are employees whose Auth email is valid; banned/deleted Auth accounts are excluded. Each employee receives an individual message. Content/image changes trigger mail; unchanged updates are ignored. Times use Asia/Manila. HTML content is escaped, and embedded images are restricted to Manila announcement storage.

Production calls do not appear as test-listener output; inspect the workflow's Executions tab. Opening this POST URL in a browser is not a valid test. HTTP receipt does not confirm completed SMTP delivery. No durable queue or event deduplication is included, so review partial executions before retrying.

Rebuild with `node scripts/build-announcement-workflow.mjs`; test with `npm test -- tests/announcement-email.test.ts`. No frontend deployment is required for database-webhook wiring alone.
