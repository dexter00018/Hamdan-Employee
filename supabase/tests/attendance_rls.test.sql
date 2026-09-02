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
      and policyname = 'Users can read own attendance logs'
      and cmd = 'SELECT'
  ),
  'employees retain read-only access to their attendance'
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

select ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'Users can insert their own profile'
  ),
  'clients cannot provision their own privileged profile fields'
);

select ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'Users can update own profile'
  ),
  'clients cannot reactivate or mutate protected profile fields directly'
);

select ok(
  not has_function_privilege('anon', 'public.email_exists(text)', 'execute'),
  'anonymous clients cannot enumerate registered emails'
);

select ok(
  not has_function_privilege('authenticated', 'public.email_exists(text)', 'execute'),
  'browser clients cannot bypass the protected email-check route'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Admins can upload avatars' and cmd = 'INSERT'
  ),
  'the real admin role can upload employee avatars'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Authenticated can view avatars' and cmd = 'SELECT'
  ),
  'authenticated directory users can view avatar objects'
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
