-- ============================================================================
-- Hamdan Employee Portal — Function Grant Check
-- ============================================================================
-- Run this in the Supabase SQL Editor (or via `execute_sql`) BEFORE every
-- deploy that touches supabase/migrations/03_functions_and_triggers.sql,
-- and any time you edit a function directly in the SQL Editor.
--
-- WHY THIS EXISTS:
-- On 2026-08-26 we found `handle_new_user` and `log_audit_event` had
-- EXECUTE granted to anon despite an earlier migration explicitly
-- revoking it. Root cause: those two functions had EXECUTE granted to
-- the PUBLIC pseudo-role (Postgres's implicit "grant to everyone" on
-- function creation). Revoking FROM anon specifically does nothing
-- against a PUBLIC grant — anon (like every role) always inherits
-- PUBLIC's privileges. A plain DROP + CREATE (not CREATE OR REPLACE,
-- which preserves grants) resets a function's ACL back to that default,
-- silently re-opening anon/PUBLIC access with no GRANT statement in
-- sight.
--
-- WHAT TO DO IF THIS FLAGS SOMETHING:
-- For any SECURITY DEFINER function that should NOT be anon-callable,
-- run both of these (either one alone is not enough):
--   revoke execute on function public.<name>(<args>) from anon;
--   revoke execute on function public.<name>(<args>) from public;
-- ============================================================================

-- 1) Every SECURITY DEFINER function in public, with exactly who can
--    execute it right now, plus whether PUBLIC itself has a grant
--    (the thing that caused this bug — should be empty for anything
--    sensitive).
select
  p.proname                                            as function_name,
  pg_get_function_identity_arguments(p.oid)            as args,
  array_agg(distinct r.rolname) filter (
    where has_function_privilege(r.oid, p.oid, 'execute')
  )                                                     as can_execute,
  (p.proacl::text like '%=X/%')                         as public_has_grant
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_roles r on r.rolname in ('anon', 'authenticated', 'service_role')
where n.nspname = 'public'
  and p.prosecdef = true          -- SECURITY DEFINER only
group by p.proname, p.oid
order by p.proname;

-- 2) Quick red-flag version: SECURITY DEFINER functions anon can
--    currently execute. Expect ZERO ROWS. Any row returned here is a
--    live finding to fix immediately.
select
  p.proname                                 as function_name,
  pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef = true
  and has_function_privilege('anon', p.oid, 'execute');
