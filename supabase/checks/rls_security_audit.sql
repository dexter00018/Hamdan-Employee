-- RLS security audit (read-only: no DDL, no DML, no live-locking queries).
-- Answers, from inside the database:
--   1. Any public table WITHOUT row-level security enabled?
--   2. The full policy inventory: command, roles, permissive/restrictive,
--      and the actual USING / WITH CHECK expressions -- so over-wide
--      policies (e.g. INSERT policy with no WITH CHECK) can be reviewed.
--   3. Default privileges that would grant table DML (INSERT/UPDATE/
--      DELETE/TRUNCATE) to anon/authenticated/public -- the classic
--      "policies look right but default privileges leak" gap.
--   4. SECURITY DEFINER functions that are callable by anon/authenticated
--      but do not pin search_path (a search_path hijack vector).
--
-- Run with: supabase db query --linked -f supabase/checks/rls_security_audit.sql

-- =========================================================================
-- 1) Public tables with RLS disabled -- MUST be empty
-- =========================================================================
select
  'RLS_DISABLED' as finding,
  format('%s.%s', schemaname, tablename) as object
from pg_tables
where schemaname = 'public'
  and not rowsecurity
order by tablename;

-- =========================================================================
-- 2) Total RLS coverage summary (expect every public table = enabled)
-- =========================================================================
select
  count(*) filter (where rowsecurity) as rls_enabled,
  count(*) filter (where not rowsecurity) as rls_disabled,
  count(*) as total_tables
from pg_tables
where schemaname = 'public';

-- =========================================================================
-- 3) Full policy inventory -- review the WITH CHECK of every
--    INSERT/UPDATE policy and the USING of every SELECT/DELETE policy
-- =========================================================================
select
  n.nspname as schema,
  c.relname as table_name,
  p.polname as policy,
  case p.polcmd
    when 'r' then 'SELECT'
    when 'a' then 'INSERT'
    when 'w' then 'UPDATE'
    when 'd' then 'DELETE'
    when '*' then 'ALL'
    else p.polcmd::text
  end as command,
  case when p.polpermissive then 'PERMISSIVE' else 'RESTRICTIVE' end as mode,
  array_to_string(p.polroles::regrole[], ', ') as roles,
  coalesce(pg_get_expr(p.polqual, p.polrelid), '-') as using_expr,
  coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '-') as with_check_expr
from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
order by c.relname, command, p.polname;

-- =========================================================================
-- 4) Default privileges granting table DML to anon/authenticated/public
--    -- MUST be empty (SELECT grants here are acceptable; write DML is not)
-- =========================================================================
select
  'DEFAULT_DML_GRANT' as finding,
  coalesce(d.defaclnamespace::regnamespace::text, 'public') || ' <- by ' ||
    pg_get_userbyid(d.defaclrole) as grantor,
  a.grantee::regrole::text as grantee,
  a.privilege_type as privilege
from pg_default_acl d
  cross join lateral aclexplode(d.defaclacl) a
where d.defaclobjtype = 'r'
  and a.grantee::regrole::text in ('anon', 'authenticated', 'public')
  and a.privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
order by grantee, privilege;

-- =========================================================================
-- 5) SECURITY DEFINER functions callable by anon/authenticated WITHOUT a
--    pinned search_path -- hijackable via search_path unless SET search_path
-- =========================================================================
select
  'DEFINER_NO_SEARCH_PATH' as finding,
  format('%s(%s)', p.proname, pg_get_function_identity_arguments(p.oid)) as object
from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
  and not coalesce(p.proconfig, '{}') && array['search_path']
  and has_function_privilege('anon', p.oid::regprocedure::text, 'execute');
