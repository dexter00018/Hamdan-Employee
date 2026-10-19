-- Resigned employee status.
-- profiles.resigned_date = last working day. NOT NULL means "resigned":
--   * history (attendance, leave, payroll data) stays in the database untouched
--   * settle_overdue_absences() no longer creates Absent rows after that date
--   * resign_employee() also removes untouched Absent placeholders already created
--     after that date (rows with a dispute/offset request attached are kept)
-- employment_status (Regular/Probationary/Contractual) is a different thing and is not changed.

alter table public.profiles add column if not exists resigned_date date;
comment on column public.profiles.resigned_date is
  'Last working day. Not null = resigned: nothing is recorded and no Absent is generated after this date; history stays readable.';

create or replace function public.settle_overdue_absences()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_today date := (current_timestamp at time zone 'Asia/Manila')::date;
begin
  if not (
    auth.role() = 'service_role'
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and role = any (array['admin','super_admin'])
    )
  ) then
    raise exception 'Not authorized';
  end if;

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
    and (p.resigned_date is null or d::date <= p.resigned_date)
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

-- Tag an employee as resigned. Returns how many empty Absent rows were removed.
create or replace function public.resign_employee(p_user_id uuid, p_last_day date)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_today date := (statement_timestamp() at time zone 'Asia/Manila')::date;
  v_removed integer := 0;
  v_name text;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'super_admin' and p.is_active = true
  ) then
    raise exception 'Only an active Super Admin can mark an employee as resigned';
  end if;

  if p_last_day is null or p_last_day > v_today then
    raise exception 'The last working day cannot be in the future';
  end if;

  select p.full_name into v_name from public.profiles p where p.id = p_user_id and p.role = 'employee';
  if not found then
    raise exception 'Employee not found';
  end if;

  update public.profiles
  set resigned_date = p_last_day, is_active = false
  where id = p_user_id;

  with removed as (
    delete from public.attendance_logs al
    where al.user_id = p_user_id
      and al.log_date > p_last_day
      and al.status = 'Absent'
      and al.time_in is null
      and al.time_out is null
      and al.absent_offset_minutes = 0
      and not exists (select 1 from public.attendance_disputes x where x.attendance_log_id = al.id)
      and not exists (select 1 from public.offset_requests x where x.attendance_log_id = al.id)
      and not exists (select 1 from public.early_out_offset_requests x where x.attendance_log_id = al.id)
      and not exists (select 1 from public.offset_usage_requests x where x.attendance_log_id = al.id)
    returning 1
  )
  select count(*)::integer into v_removed from removed;

  perform public.log_audit_event(
    'employee_resigned',
    'profile',
    p_user_id,
    'Marked ' || coalesce(v_name, 'employee') || ' as resigned, last working day ' || p_last_day::text
      || '. Removed ' || v_removed::text || ' empty Absent placeholder(s) after that date.'
  );

  return v_removed;
end;
$function$;

-- Undo a resignation (for mistakes or an immediate re-hire).
-- WARNING: once resigned_date is cleared, weekdays since the last working day (up to
-- 90 days back) have no attendance row, so the next settle_overdue_absences() run will
-- tag them Absent. For a later re-hire, also update the hired date first.
create or replace function public.reinstate_employee(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_name text;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'super_admin' and p.is_active = true
  ) then
    raise exception 'Only an active Super Admin can reinstate an employee';
  end if;

  select p.full_name into v_name
  from public.profiles p
  where p.id = p_user_id and p.role = 'employee' and p.resigned_date is not null;
  if not found then
    raise exception 'This employee is not marked as resigned';
  end if;

  update public.profiles set resigned_date = null, is_active = true where id = p_user_id;

  perform public.log_audit_event(
    'employee_reinstated',
    'profile',
    p_user_id,
    'Removed the resigned status of ' || coalesce(v_name, 'employee')
  );
end;
$function$;

revoke all on function public.resign_employee(uuid, date) from public, anon;
grant execute on function public.resign_employee(uuid, date) to authenticated;
revoke all on function public.reinstate_employee(uuid) from public, anon;
grant execute on function public.reinstate_employee(uuid) to authenticated;
