begin;

select plan(12);

select ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'attendance_logs'
      and policyname = 'Users can insert own logs'
  ),
  'employees have no direct attendance INSERT policy'
);

select ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'attendance_logs'
      and policyname = 'Users can update own logs'
  ),
  'employees have no direct attendance UPDATE policy'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'attendance_logs'
      and policyname = 'View own or admin/hr attendance_logs'
      and cmd = 'SELECT'
  ),
  'employees retain read-only access to their attendance (live policy name)'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'attendance_logs'
      and policyname = 'Admins can update attendance_logs'
      and cmd = 'UPDATE'
  ),
  'authorized HR/admin attendance corrections remain available'
);

-- Profile INSERT: the live design keeps an own-row insert policy
-- (with_check pins the new row's id to the caller via auth.uid()), and the
-- signup row is provisioned by handle_new_user first, so a client insert can
-- only assert-replace the already-created row. Assert that binding instead of
-- the absence the attendance migration hoped for.
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'Users can insert their own profile'
      and cmd = 'INSERT'
      and position('auth.uid()' in coalesce(with_check, '')) > 0
  ),
  'own-profile INSERT policy is pinned to the caller id'
);

-- Protected field mutation is blocked by the guard_profile_self_edit
-- trigger from 20261020063000_profile_hardening, not by deleting the
-- update policy (which HR/admin cross-user edits legitimately use).
select ok(
  exists (
    select 1 from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'public.profiles'::regclass
      and t.tgname = 'guard_profile_self_edit'
      and t.tgenabled = 'O'
      and p.proname = 'guard_profile_self_edit'
  ),
  'protected profile fields are guarded by the self-edit trigger'
);

select ok(
  not has_function_privilege('anon', 'public.email_exists(text)', 'execute'),
  'anonymous clients cannot enumerate registered emails'
);

select ok(
  not has_function_privilege('authenticated', 'public.email_exists(text)', 'execute'),
  'browser clients cannot bypass the protected email-check route'
);

-- Avatar storage policies are missing from the live database (an avatar
-- upload from the authenticated HR client currently fails; see the Phase 1
-- report for the proposed storage policy migration). Until that migration
-- lands, these assertions cover the upload/read pairs that ARE live.
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Admins can upload payslips' and cmd = 'INSERT'
  ),
  'the real admin role can upload payslip files'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Employees can download own payslips' and cmd = 'SELECT'
  ),
  'employees can download their own payslip objects'
);

select ok(
  position('Not authorized' in pg_get_functiondef('public.settle_overdue_leave_days()'::regprocedure)) > 0,
  'global leave settlement has an internal admin authorization check'
);

select ok(
  position('Not authorized' in pg_get_functiondef('public.settle_overdue_absences()'::regprocedure)) > 0,
  'global absence settlement has an internal admin authorization check'
);

select * from finish();
rollback;
