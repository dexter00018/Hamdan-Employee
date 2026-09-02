begin;

select plan(12);

select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'attendance_disputes' and policyname = 'Employees can file own disputes' and cmd = 'INSERT'), 'employees can file attendance disputes');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'attendance_disputes' and policyname = 'Admins can review disputes' and cmd = 'UPDATE'), 'only the review policy updates attendance disputes');
select ok(not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'attendance_disputes' and cmd = 'UPDATE' and policyname <> 'Admins can review disputes'), 'employees have no dispute update policy');

select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'leave_requests' and policyname = 'Employees can file leave' and cmd = 'INSERT'), 'employees can file their own leave request');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'leave_requests' and policyname = 'Admins can review leave' and cmd = 'UPDATE'), 'admins can review leave requests');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'leave_requests' and policyname = 'Employees can cancel own pending leave' and cmd = 'DELETE'), 'employees can cancel only through the pending-leave policy');

select ok(not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and cmd in ('INSERT', 'UPDATE') and policyname in ('Users can insert their own profile', 'Users can update own profile')), 'employees cannot directly change protected profile activation fields');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'Admins can update profiles, only super_admin can change role' and cmd = 'UPDATE'), 'admins retain protected profile management');

select ok(not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'attendance_logs' and policyname in ('Users can insert own logs', 'Users can update own logs')), 'attendance writes cannot bypass server routes');
select ok(exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'attendance_logs' and policyname = 'Users can read own attendance logs' and cmd = 'SELECT'), 'employees retain own attendance visibility');

select ok(position('Not authorized' in pg_get_functiondef('public.generate_leave_request_days(uuid)'::regprocedure)) > 0, 'leave-day generation has an internal authorization check');
select ok(not has_function_privilege('anon', 'public.generate_leave_request_days(uuid)', 'execute'), 'anonymous clients cannot generate leave request days');

select * from finish();
rollback;
