-- ============================================================================
-- Functions and triggers — exact current definitions
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Pre-existing functions (created before this backup system existed).
-- Kept as-is for completeness; note the known issues called out below.
-- ----------------------------------------------------------------------------

-- Auto-creates a profiles row whenever a new auth.users row appears.
-- KNOWN RISK: this defaults role to 'employee' for ANY new signup with no
-- gatekeeping. If you ever enable public/OAuth signups, make sure "Allow
-- new users to sign up" is OFF in Supabase Auth settings, or add an
-- allow-list check here first -- otherwise anyone who signs up gets
-- automatic employee-level access.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, employee_id, full_name, role)
  VALUES (
    NEW.id,
    'HSM-' || SUBSTR(md5(random()::text), 1, 6),
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Bagong Empleyado'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'employee')
  );
  RETURN NEW;
END;
$function$;

-- SECURITY FIX: this is a trigger-only function (it relies on NEW, which
-- only exists inside a trigger context), but Supabase exposes every
-- public-schema function as a callable RPC endpoint by default. Revoke
-- direct execute access from anon/authenticated -- the trigger itself
-- still runs fine since it executes as the table owner regardless of
-- these grants.
revoke execute on function public.handle_new_user() from anon, authenticated;

CREATE OR REPLACE FUNCTION public.email_exists(check_email text)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE email = check_email
  );
$function$;

-- KNOWN ISSUE: checks role = 'hr', but no profile ever has that exact role
-- string (actual roles used app-wide are 'employee' / 'admin' /
-- 'super_admin'). This function -- and the several storage/attendance_logs
-- policies that copy this same 'hr' check -- effectively never match
-- anyone. Harmless (fails closed, not open) but worth cleaning up.
CREATE OR REPLACE FUNCTION public.is_hr()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET row_security TO 'off'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND lower(coalesce(p.role, '')) = 'hr'
  );
$function$;

CREATE OR REPLACE FUNCTION public.set_attendance_status()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.time_in IS NOT NULL AND (NEW.status IS NULL OR btrim(NEW.status) = '') THEN
    NEW.status := 'Present';
  END IF;
  RETURN NEW;
END;
$function$;

-- ----------------------------------------------------------------------------
-- Leave credit system
-- ----------------------------------------------------------------------------

-- Called once, right after HR approves a leave request: creates one
-- 'Pending' leave_request_days row per weekday in the leave's date range
-- (skipping Sat/Sun and declared holidays). Does NOT touch leave_credits
-- yet -- that only happens later, per day, via settle_leave_day.
CREATE OR REPLACE FUNCTION public.generate_leave_request_days(p_leave_request_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid;
  v_start date;
  v_end date;
  d date;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = any (array['admin','super_admin'])
  ) then
    raise exception 'Not authorized';
  end if;

  select user_id, start_date, end_date into v_user_id, v_start, v_end
  from public.leave_requests where id = p_leave_request_id;

  if v_user_id is null then
    return;
  end if;

  d := v_start;
  while d <= v_end loop
    if extract(dow from d) not in (0, 6) -- skip Sat/Sun
      and not exists (select 1 from public.holidays h where h.holiday_date = d) -- skip holidays: not charged as leave
    then
      insert into public.leave_request_days (leave_request_id, user_id, leave_date)
      values (p_leave_request_id, v_user_id, d)
      on conflict (leave_request_id, leave_date) do nothing;
    end if;
    d := d + 1;
  end loop;
end;
$function$;

-- Resolves ONE pending leave day for one user:
-- - if there's an attendance time-in that day -> Voided, no deduction
--   (they came to work despite the approved leave)
-- - if there's no time-in -> Deducted, leave_credits.used_credits +1
--   (only for Regular employees), AND a real attendance_logs row is
--   created with status 'Leave' so the day shows up in attendance
--   history instead of just being a gap.
-- NOT directly callable by clients (see grants at the bottom of this
-- file) -- only ever invoked internally by settle_overdue_leave_days()
-- and the time-in trigger below.
CREATE OR REPLACE FUNCTION public.settle_leave_day(p_user_id uuid, p_leave_date date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_day record;
  v_has_timein boolean;
  v_year int;
  v_employment_status text;
  v_credits record;
begin
  select * into v_day
  from public.leave_request_days
  where user_id = p_user_id and leave_date = p_leave_date and status = 'Pending'
  limit 1;

  if v_day.id is null then
    return;
  end if;

  select exists(
    select 1 from public.attendance_logs
    where user_id = p_user_id and log_date = p_leave_date and time_in is not null
  ) into v_has_timein;

  if v_has_timein then
    update public.leave_request_days
    set status = 'Voided', resolved_at = now()
    where id = v_day.id;
    return;
  end if;

  select employment_status into v_employment_status
  from public.employee_government_ids where user_id = p_user_id;

  if v_employment_status is distinct from 'Regular' then
    insert into public.attendance_logs (user_id, log_date, status, time_in, time_out)
    values (p_user_id, p_leave_date, 'Leave', null, null)
    on conflict (user_id, log_date) do nothing;

    update public.leave_request_days
    set status = 'Deducted', resolved_at = now()
    where id = v_day.id;
    return;
  end if;

  v_year := extract(year from p_leave_date);

  select id, used_credits, total_credits into v_credits
  from public.leave_credits
  where user_id = p_user_id and year = v_year;

  if v_credits.id is null then
    insert into public.leave_credits (user_id, year, total_credits, used_credits)
    values (p_user_id, v_year, 15, 1);
  else
    update public.leave_credits
    set used_credits = least(v_credits.used_credits + 1, v_credits.total_credits)
    where id = v_credits.id;
  end if;

  insert into public.attendance_logs (user_id, log_date, status, time_in, time_out)
  values (p_user_id, p_leave_date, 'Leave', null, null)
  on conflict (user_id, log_date) do nothing;

  update public.leave_request_days
  set status = 'Deducted', resolved_at = now()
  where id = v_day.id;
end;
$function$;

-- Catch-up sweep: resolves every Pending leave day whose date has already
-- fully passed (Philippine time). Called by both the HR and Employee
-- dashboards on load.
CREATE OR REPLACE FUNCTION public.settle_overdue_leave_days()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
  v_today date := (current_timestamp at time zone 'Asia/Manila')::date;
begin
  for r in
    select user_id, leave_date
    from public.leave_request_days
    where status = 'Pending' and leave_date < v_today
  loop
    perform public.settle_leave_day(r.user_id, r.leave_date);
  end loop;
end;
$function$;

-- Real-time: void a leave day the instant an employee times in that day.
-- NOT directly callable by clients -- only ever fires via the trigger below.
CREATE OR REPLACE FUNCTION public.void_leave_day_on_timein()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.time_in is not null then
    perform public.settle_leave_day(new.user_id, new.log_date);
  end if;
  return new;
end;
$function$;

-- ----------------------------------------------------------------------------
-- Auto-absence marking
-- ----------------------------------------------------------------------------

-- Auto-marks 'Absent' for any past weekday an employee has no attendance_logs
-- row at all, skipping: days covered by an approved/pending leave, days
-- before the employee's hired_date, declared holidays, today (still in
-- progress), and weekends. Called by both dashboards on load.
CREATE OR REPLACE FUNCTION public.settle_overdue_absences()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_today date := (current_timestamp at time zone 'Asia/Manila')::date;
begin
  insert into public.attendance_logs (user_id, log_date, status, time_in, time_out)
  select p.id, d::date, 'Absent', null, null
  from public.profiles p
  left join public.employee_government_ids g on g.user_id = p.id
  cross join lateral generate_series(
    greatest(coalesce(g.hired_date, v_today - 90), v_today - 90),
    v_today - 1,
    interval '1 day'
  ) as d
  where lower(coalesce(p.role, '')) = 'employee'
    and extract(dow from d) not in (0, 6)
    and not exists (
      select 1 from public.attendance_logs al
      where al.user_id = p.id and al.log_date = d::date
    )
    and not exists (
      select 1 from public.leave_request_days lrd
      where lrd.user_id = p.id and lrd.leave_date = d::date
    )
    and not exists (
      select 1 from public.holidays h
      where h.holiday_date = d::date
    )
  on conflict (user_id, log_date) do nothing;
end;
$function$;

-- ----------------------------------------------------------------------------
-- Data archival (1-year retention)
-- ----------------------------------------------------------------------------

-- Moves attendance, dispute, and leave records older than 1 year out of the
-- live tables and into the *_archive tables. Nothing is permanently
-- deleted -- archived rows stay readable under the same owner/admin RLS
-- rules as the live data. Admin/super_admin only; manually triggered from
-- the super-admin dashboard (with a password re-confirmation step in the UI).
CREATE OR REPLACE FUNCTION public.archive_old_records()
 RETURNS TABLE(archived_attendance_logs bigint, archived_disputes bigint, archived_leave_requests bigint, archived_leave_request_days bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cutoff date := (current_timestamp at time zone 'Asia/Manila')::date - interval '1 year';
  v_logs bigint;
  v_disputes_a bigint;
  v_disputes_b bigint;
  v_leaves bigint;
  v_leave_days bigint;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = any (array['admin','super_admin'])
  ) then
    raise exception 'Not authorized';
  end if;

  with moved as (
    delete from public.attendance_disputes d
    using public.attendance_logs a
    where d.attendance_log_id = a.id and a.log_date < v_cutoff
    returning d.*
  )
  insert into public.attendance_disputes_archive select * from moved;
  get diagnostics v_disputes_a = row_count;

  with moved as (
    delete from public.attendance_disputes
    where attendance_log_id is null and dispute_date < v_cutoff
    returning *
  )
  insert into public.attendance_disputes_archive select * from moved;
  get diagnostics v_disputes_b = row_count;

  with moved as (
    delete from public.attendance_logs
    where log_date < v_cutoff
    returning *
  )
  insert into public.attendance_logs_archive select * from moved;
  get diagnostics v_logs = row_count;

  with moved as (
    delete from public.leave_request_days
    where leave_date < v_cutoff
    returning *
  )
  insert into public.leave_request_days_archive select * from moved;
  get diagnostics v_leave_days = row_count;

  with moved as (
    delete from public.leave_requests
    where end_date < v_cutoff and status <> 'Pending'
    returning *
  )
  insert into public.leave_requests_archive select * from moved;
  get diagnostics v_leaves = row_count;

  return query select v_logs, (v_disputes_a + v_disputes_b), v_leaves, v_leave_days;
end;
$function$;

-- ----------------------------------------------------------------------------
-- Triggers
-- ----------------------------------------------------------------------------

drop trigger if exists trg_set_attendance_status on public.attendance_logs;
create trigger trg_set_attendance_status
  before insert or update of time_in, status on public.attendance_logs
  for each row execute function set_attendance_status();

drop trigger if exists trg_void_leave_day_on_timein on public.attendance_logs;
create trigger trg_void_leave_day_on_timein
  after insert or update of time_in on public.attendance_logs
  for each row execute function void_leave_day_on_timein();

-- Standard Supabase pattern: fires on every new auth.users row.
-- drop/create guarded since this trigger predates this backup file.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Function-level grants (who can call what directly via the API)
-- ----------------------------------------------------------------------------

-- settle_leave_day and void_leave_day_on_timein are internal-only: they
-- have no caller-identity check of their own, so they must NEVER be
-- directly callable by anon or authenticated clients. Other SECURITY
-- DEFINER functions and the trigger can still call them internally
-- without needing an explicit grant.
revoke all on function public.settle_leave_day(uuid, date) from public, anon, authenticated;
revoke all on function public.void_leave_day_on_timein() from public, anon, authenticated;

-- These ARE called directly by the client dashboards, but only for
-- signed-in users -- anon has no legitimate reason to trigger them.
revoke all on function public.archive_old_records() from anon;
revoke all on function public.generate_leave_request_days(uuid) from anon;
revoke all on function public.settle_overdue_absences() from anon;
revoke all on function public.settle_overdue_leave_days() from anon;

grant execute on function public.archive_old_records() to authenticated;
grant execute on function public.generate_leave_request_days(uuid) to authenticated;
grant execute on function public.settle_overdue_absences() to authenticated;
grant execute on function public.settle_overdue_leave_days() to authenticated;
