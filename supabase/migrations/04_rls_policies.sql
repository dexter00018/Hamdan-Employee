-- ============================================================================
-- Row Level Security — enable + all current policies
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.attendance_logs enable row level security;
alter table public.announcements enable row level security;
alter table public.employee_government_ids enable row level security;
alter table public.attendance_disputes enable row level security;
alter table public.payslips enable row level security;
alter table public.leave_requests enable row level security;
alter table public.leave_credits enable row level security;
alter table public.leave_request_days enable row level security;
alter table public.holidays enable row level security;
alter table public.attendance_logs_archive enable row level security;
alter table public.attendance_disputes_archive enable row level security;
alter table public.leave_requests_archive enable row level security;
alter table public.leave_request_days_archive enable row level security;

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------

create policy "Users can insert their own profile"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

create policy "Authenticated can read profiles"
  on public.profiles for select to authenticated
  using (true);

-- Only super_admin can change anything about a profile, including role.
-- Regular 'admin' (HR) can update any OTHER field but must leave role
-- untouched -- prevents privilege escalation via the HR edit-profile form.
create policy "Admins can update profiles, only super_admin can change role"
  on public.profiles for update to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any (array['admin','super_admin']))
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin')
    or (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
      and role = (select p2.role from public.profiles p2 where p2.id = profiles.id)
    )
  );

-- Self-edit path: role must stay identical to its current value (a user
-- can never grant themselves a new role, even via their own profile edit).
create policy "Users can update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (role = (select p.role from public.profiles p where p.id = profiles.id));

-- ----------------------------------------------------------------------------
-- attendance_logs
-- ----------------------------------------------------------------------------

create policy "Users can read own attendance logs"
  on public.attendance_logs for select to authenticated
  using (user_id = auth.uid());

create policy "Authenticated can read attendance_logs"
  on public.attendance_logs for select to authenticated
  using (true);

create policy "Admins can insert attendance_logs"
  on public.attendance_logs for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any (array['admin','super_admin'])));

create policy "Users can insert own logs"
  on public.attendance_logs for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Admins can update attendance_logs"
  on public.attendance_logs for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and lower(coalesce(p.role,'')) = any (array['admin','super_admin','hr'])))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and lower(coalesce(p.role,'')) = any (array['admin','super_admin','hr'])));

create policy "Users can update own logs"
  on public.attendance_logs for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- announcements
-- ----------------------------------------------------------------------------

create policy "Announcements are readable by authenticated users"
  on public.announcements for select to authenticated
  using (true);

create policy "Only admins can write announcements"
  on public.announcements for insert to authenticated
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = any (array['admin','super_admin'])));

create policy "Only admins can update announcements"
  on public.announcements for update to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = any (array['admin','super_admin'])));

-- ----------------------------------------------------------------------------
-- employee_government_ids
-- ----------------------------------------------------------------------------

create policy "Users can view own government IDs"
  on public.employee_government_ids for select to authenticated
  using (auth.uid() = user_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any (array['admin','super_admin'])));

create policy "Admins can insert government IDs"
  on public.employee_government_ids for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any (array['admin','super_admin'])));

create policy "Admins can update government IDs"
  on public.employee_government_ids for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any (array['admin','super_admin'])))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any (array['admin','super_admin'])));

-- ----------------------------------------------------------------------------
-- attendance_disputes
-- ----------------------------------------------------------------------------

create policy "View own or admin disputes"
  on public.attendance_disputes for select to authenticated
  using (auth.uid() = user_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any (array['admin','super_admin'])));

create policy "Employees can file own disputes"
  on public.attendance_disputes for insert to authenticated
  with check (
    auth.uid() = user_id
    and (attendance_log_id is null or exists (select 1 from public.attendance_logs al where al.id = attendance_disputes.attendance_log_id and al.user_id = auth.uid()))
  );

create policy "Admins can review disputes"
  on public.attendance_disputes for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any (array['admin','super_admin'])))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any (array['admin','super_admin'])));

-- ----------------------------------------------------------------------------
-- payslips
-- ----------------------------------------------------------------------------

create policy "Employees can view own payslips"
  on public.payslips for select to authenticated
  using (auth.uid() = user_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any (array['admin','super_admin'])));

create policy "Admins can insert payslips"
  on public.payslips for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any (array['admin','super_admin'])));

create policy "Admins can delete payslips"
  on public.payslips for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any (array['admin','super_admin'])));

-- ----------------------------------------------------------------------------
-- leave_requests
-- ----------------------------------------------------------------------------

create policy "View own or admin leave requests"
  on public.leave_requests for select to authenticated
  using (auth.uid() = user_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any (array['admin','super_admin'])));

create policy "Employees can file leave"
  on public.leave_requests for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Employees can cancel own pending leave"
  on public.leave_requests for delete to authenticated
  using (auth.uid() = user_id and status = 'Pending');

create policy "Admins can review leave"
  on public.leave_requests for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any (array['admin','super_admin'])))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any (array['admin','super_admin'])));

-- ----------------------------------------------------------------------------
-- leave_credits
-- ----------------------------------------------------------------------------

create policy "View own or admin leave credits"
  on public.leave_credits for select to authenticated
  using (auth.uid() = user_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any (array['admin','super_admin'])));

create policy "Admins can manage leave credits"
  on public.leave_credits for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any (array['admin','super_admin'])));

create policy "Admins can update leave credits"
  on public.leave_credits for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any (array['admin','super_admin'])));

-- ----------------------------------------------------------------------------
-- leave_request_days
-- ----------------------------------------------------------------------------

create policy "View own or admin leave_request_days"
  on public.leave_request_days for select
  using (auth.uid() = user_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any (array['admin','super_admin'])));
-- No client-facing INSERT/UPDATE/DELETE policies: all writes happen
-- through the SECURITY DEFINER functions in 03_functions_and_triggers.sql.

-- ----------------------------------------------------------------------------
-- holidays
-- ----------------------------------------------------------------------------

create policy "Anyone authenticated can view holidays"
  on public.holidays for select to authenticated
  using (true);

create policy "Admins can manage holidays"
  on public.holidays for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any (array['admin','super_admin'])))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any (array['admin','super_admin'])));

-- ----------------------------------------------------------------------------
-- *_archive tables — same read rules as their live counterparts
-- ----------------------------------------------------------------------------

create policy "View own or admin attendance_logs_archive" on public.attendance_logs_archive for select
  using (auth.uid() = user_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any (array['admin','super_admin'])));
create policy "View own or admin attendance_disputes_archive" on public.attendance_disputes_archive for select
  using (auth.uid() = user_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any (array['admin','super_admin'])));
create policy "View own or admin leave_requests_archive" on public.leave_requests_archive for select
  using (auth.uid() = user_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any (array['admin','super_admin'])));
create policy "View own or admin leave_request_days_archive" on public.leave_request_days_archive for select
  using (auth.uid() = user_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any (array['admin','super_admin'])));

-- ----------------------------------------------------------------------------
-- KNOWN ISSUES IN THE LIVE DATABASE (present at time of this backup,
-- pre-existing / not something this backup fixes -- flagged here so
-- they're not lost from view):
--
-- 1. "Anon can read attendance_logs (diag)" -- a leftover diagnostic
--    policy that lets the UNAUTHENTICATED (anon) role read ALL attendance
--    logs. This looks like debug leftovers and should probably be
--    dropped:
--      drop policy "Anon can read attendance_logs (diag)" on public.attendance_logs;
--
-- 2. Several older policies (on attendance_logs and storage.objects for
--    the avatars bucket) check role = 'hr', which no profile ever
--    actually has (real roles are 'employee' / 'admin' / 'super_admin').
--    These fail closed (nobody matches), so they're not a security hole,
--    just dead weight: "HR can delete attendance logs", "HR can insert
--    attendance logs", "HR can read attendance logs", "HR can update
--    avatars", "HR can upload avatars", "HR can view avatars objects".
-- ----------------------------------------------------------------------------
