# Supabase Database Backup — HAMDAN-EMPLOYEE

This folder is a version-controlled snapshot of the **entire database structure**
(tables, indexes, functions, triggers, RLS policies, and storage buckets) for
the HAMDAN-EMPLOYEE Supabase project (`msoomcjzzudibiyezclj`).

**Why this exists:** the project is on Supabase's free tier, which does not
include automatic database backups (that's a paid Pro-plan feature). This
folder is a manual substitute — a snapshot you can restore from if something
ever goes wrong with the live database.

**What this is NOT:** this does not back up your actual *data* (employee
records, attendance logs, leave requests, etc.) — only the *structure*
(schema, functions, security rules). Your data itself is only in Supabase.
If you need actual data backups too, look into `pg_dump` via the Supabase
CLI, or upgrading to the Pro plan for automatic daily backups.

## Files (run in this order if rebuilding from scratch)

| File | What it does |
|---|---|
| `01_tables.sql` | All tables: profiles, attendance_logs, leave system, holidays, archive tables, etc. |
| `02_indexes.sql` | Performance indexes beyond the primary/unique keys already in the table definitions |
| `03_functions_and_triggers.sql` | All business logic: leave credit deduction, auto-absence marking, data archival, plus the triggers that wire them up |
| `04_rls_policies.sql` | Row Level Security — who can read/write what |
| `05_storage.sql` | Storage buckets (avatars, payslips, announcements) and their access policies |

## When to update this backup

Any time significant database changes are made going forward (new tables,
new functions, changed security rules), it's worth re-exporting and
updating these files so this backup doesn't go stale. Ask Claude to
"update the Supabase backup files" and it can re-pull the current live
state and refresh these files.

## Known issues in the live database (as of this snapshot)

These are flagged inline in the SQL files too, but summarized here:

1. **A leftover diagnostic RLS policy** lets unauthenticated (anon)
   requests read all attendance logs (`"Anon can read attendance_logs (diag)"`
   on `attendance_logs`). This looks like debug leftovers from before this
   backup existed and is a real security gap — recommend dropping it:
   ```sql
   drop policy "Anon can read attendance_logs (diag)" on public.attendance_logs;
   ```

2. **Several older policies check `role = 'hr'`**, but no profile in this
   app ever actually has that exact role string — real roles are
   `employee`, `admin`, and `super_admin`. These policies fail closed
   (nobody matches them), so they're not a security hole, just dead
   weight worth cleaning up eventually.

## How to restore (disaster recovery)

If you ever need to rebuild this database from scratch (e.g. a brand new
Supabase project):

1. Create the new Supabase project.
2. Open the SQL Editor in the Supabase dashboard.
3. Run each file in this folder in order (01 → 02 → 03 → 04 → 05), pasting
   the contents into the SQL Editor and executing.
4. Update your app's environment variables (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, service role key) to point at the new
   project.
5. Re-create your storage bucket contents (payslip PDFs, announcement
   images) separately — this backup only recreates the *buckets*, not
   their file contents.

Note: this restores structure only. Your actual employee/attendance/leave
*data* would need to come from a separate data export (see the "What this
is NOT" note above).
