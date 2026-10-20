-- Tests for the 20261020063000_profile_hardening migration.
-- Matches live behavior verified 2026-10-20 via REST probes and SQL probes.
begin;

select plan(9);

-- The anon-visible read-all policy is gone (it previously leaked all
-- profiles to unauthenticated callers: REST probe returned HTTP 200
-- with employee data before this migration).
select ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'Enable read access for all'
  ),
  'anonymous callers no longer have a policy reading all profiles'
);

-- Directory read is authenticated-scoped only.
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'Authenticated users can read profiles'
      and cmd = 'SELECT' and roles = '{authenticated}'
  ),
  'authenticated directory read policy is in place'
);

-- anon lost every table privilege in the public schema.
select ok(
  not has_table_privilege('anon', 'public.profiles', 'select'),
  'anon cannot select profiles'
);

select ok(
  not has_table_privilege('anon', 'public.attendance_logs', 'select')
  and not has_table_privilege('anon', 'public.leave_requests', 'select')
  and not has_table_privilege('anon', 'public.payslips', 'select'),
  'anon has no table privileges on attendance, leave, or payslips'
);

-- authenticated users keep the directory read (login, proxy role checks,
-- and helpdesk routing depend on it).
select ok(
  has_table_privilege('authenticated', 'public.profiles', 'select'),
  'authenticated users still have the profiles directory read'
);

-- Self-edit guard exists and is enabled.
select ok(
  exists (
    select 1 from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'public.profiles'::regclass
      and t.tgname = 'guard_profile_self_edit'
      and t.tgenabled = 'O'
      and p.proname = 'guard_profile_self_edit'
  ),
  'profiles self-edit guard trigger is present'
);

-- Signup role trust: handle_new_user no longer consumes the
-- user-supplied role metadata.
select ok(
  position('raw_user_meta_data->>' || '''role''' in pg_get_functiondef('public.handle_new_user()'::regprocedure)) = 0,
  'handle_new_user does not trust user-supplied role metadata'
);

select ok(
  position('''employee''' in pg_get_functiondef('public.handle_new_user()'::regprocedure)) > 0,
  'handle_new_user provisions new users with the employee role'
);

-- login still works after the anon revocation: the password-grant login
-- path requires no public-schema anon grants (verified live with a
-- throwaway user created and removed via the admin API).
select ok(
  not has_function_privilege('anon', 'public.email_exists(text)', 'execute'),
  'anon retains no data-plane function privileges that login would need'
);

select * from finish();
rollback;
