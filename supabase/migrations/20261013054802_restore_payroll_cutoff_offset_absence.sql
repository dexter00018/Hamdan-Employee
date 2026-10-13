-- Offset attendance usage is limited to the active payroll cutoff:
-- days 1-15, or days 16 through the end of the calendar month.
-- An Absent day consumes one full workday (9 hours / 540 minutes) after HR approval.

alter table public.offset_usage_requests
  add column if not exists usage_type text not null default 'late';

update public.offset_usage_requests
set usage_type = 'late'
where usage_type is null or usage_type not in ('late', 'absent');

alter table public.offset_usage_requests
  drop constraint if exists offset_usage_requests_usage_type_check;

alter table public.offset_usage_requests
  add constraint offset_usage_requests_usage_type_check
  check (usage_type in ('late', 'absent'));

alter table public.attendance_logs
  add column if not exists absent_offset_minutes integer not null default 0;

alter table public.attendance_logs
  drop constraint if exists attendance_logs_absent_offset_minutes_check;

alter table public.attendance_logs
  add constraint attendance_logs_absent_offset_minutes_check
  check (absent_offset_minutes >= 0);

create or replace function public.submit_offset_usage_request(p_attendance_log_id bigint)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_log public.attendance_logs;
  v_usage_type text;
  v_balance_minutes integer := 0;
  v_pending_usage_minutes integer := 0;
  v_pending_early_out_minutes integer := 0;
  v_pending_leave_minutes integer := 0;
  v_required_minutes integer := 0;
  v_request_id uuid;
  v_today date := (clock_timestamp() at time zone 'Asia/Manila')::date;
  v_period_start date;
  v_period_end date;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = v_user_id and p.role = 'employee' and p.is_active = true
  ) then
    raise exception 'Only active employees can request Offset usage';
  end if;

  if extract(day from v_today)::integer <= 15 then
    v_period_start := date_trunc('month', v_today)::date;
    v_period_end := v_period_start + 14;
  else
    v_period_start := (date_trunc('month', v_today)::date + 15);
    v_period_end := (date_trunc('month', v_today) + interval '1 month - 1 day')::date;
  end if;

  select a.* into v_log
  from public.attendance_logs a
  where a.id = p_attendance_log_id and a.user_id = v_user_id
  for update;
  if not found then raise exception 'Attendance record not found'; end if;
  if v_log.log_date not between v_period_start and v_period_end then
    raise exception 'Only records from the current payroll cutoff can use Offset';
  end if;

  v_usage_type := case lower(coalesce(v_log.status, ''))
    when 'late' then 'late'
    when 'absent' then 'absent'
    else null
  end;
  if v_usage_type is null then
    raise exception 'Only Late or Absent attendance records can use Offset';
  end if;

  if v_usage_type = 'late' then
    if v_log.time_in is null then raise exception 'Late attendance record has no Time In'; end if;
    v_required_minutes := greatest(
      1,
      floor(extract(epoch from (
        v_log.time_in - ((v_log.log_date + time '09:00') at time zone 'Asia/Manila')
      )) / 60.0)::integer
    );
  else
    v_required_minutes := 540;
  end if;

  if exists (
    select 1 from public.offset_usage_requests r
    where r.attendance_log_id = p_attendance_log_id and r.status = 'Pending'
  ) then
    raise exception 'An Offset request is already pending for this attendance record';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  select coalesce(sum(case when t.kind = 'earned' then (t.hours * 60 + t.minutes) else -(t.hours * 60 + t.minutes) end), 0)::integer
    into v_balance_minutes
  from public.offset_transactions t
  where t.user_id = v_user_id;
  select coalesce(sum(coalesce(r.required_minutes, r.hours * 60)), 0)::integer
    into v_pending_usage_minutes
  from public.offset_usage_requests r
  where r.user_id = v_user_id and r.status = 'Pending';
  select coalesce(sum(r.required_minutes), 0)::integer
    into v_pending_early_out_minutes
  from public.early_out_offset_requests r
  where r.user_id = v_user_id and r.status = 'Pending';
  select coalesce(sum(l.offset_minutes_required), 0)::integer
    into v_pending_leave_minutes
  from public.leave_requests l
  where l.user_id = v_user_id and l.funding_source = 'offset' and l.status = 'Pending';

  if v_balance_minutes - v_pending_usage_minutes - v_pending_early_out_minutes - v_pending_leave_minutes < v_required_minutes then
    raise exception 'Not enough available Offset. % needs % minute(s); % minute(s) available.', initcap(v_usage_type), v_required_minutes, greatest(0, v_balance_minutes - v_pending_usage_minutes - v_pending_early_out_minutes - v_pending_leave_minutes);
  end if;

  insert into public.offset_usage_requests(user_id, attendance_log_id, hours, required_minutes, usage_type)
  values(v_user_id, p_attendance_log_id, 1, v_required_minutes, v_usage_type)
  returning id into v_request_id;
  return v_request_id;
end;
$function$;

create or replace function public.review_offset_usage_request(p_request_id uuid, p_approve boolean, p_notes text default null::text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_request public.offset_usage_requests;
  v_log public.attendance_logs;
  v_balance_minutes integer := 0;
  v_other_reserved_minutes integer := 0;
  v_required_minutes integer := 0;
  v_hours integer;
  v_minutes integer;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin', 'super_admin') and p.is_active = true
  ) then
    raise exception 'Not authorized';
  end if;

  select r.* into v_request from public.offset_usage_requests r where r.id = p_request_id for update;
  if not found or v_request.status <> 'Pending' then raise exception 'Offset usage request is not pending'; end if;

  if not p_approve then
    update public.offset_usage_requests
    set status = 'Rejected', reviewed_by = (select auth.uid()), reviewed_at = now(), hr_notes = p_notes
    where id = v_request.id;
    perform public.log_audit_event('offset_usage_rejected', 'attendance_log', null, format('Rejected %s Offset request for attendance log #%s', v_request.usage_type, v_request.attendance_log_id));
    return;
  end if;

  select a.* into v_log from public.attendance_logs a where a.id = v_request.attendance_log_id for update;
  if not found or v_log.user_id <> v_request.user_id then raise exception 'Attendance record is no longer eligible'; end if;

  if v_request.usage_type = 'late' then
    if lower(coalesce(v_log.status, '')) <> 'late' or v_log.time_in is null then
      raise exception 'Late attendance record is no longer eligible';
    end if;
    v_required_minutes := greatest(
      1,
      floor(extract(epoch from (
        v_log.time_in - ((v_log.log_date + time '09:00') at time zone 'Asia/Manila')
      )) / 60.0)::integer
    );
  elsif v_request.usage_type = 'absent' then
    if lower(coalesce(v_log.status, '')) <> 'absent' then
      raise exception 'Absent attendance record is no longer eligible';
    end if;
    v_required_minutes := 540;
  else
    raise exception 'Unsupported Offset usage type';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_request.user_id::text, 0));
  select coalesce(sum(case when t.kind = 'earned' then (t.hours * 60 + t.minutes) else -(t.hours * 60 + t.minutes) end), 0)::integer
    into v_balance_minutes
  from public.offset_transactions t
  where t.user_id = v_request.user_id;
  select
    coalesce((select sum(coalesce(r.required_minutes, r.hours * 60)) from public.offset_usage_requests r where r.user_id = v_request.user_id and r.status = 'Pending' and r.id <> v_request.id), 0)
    + coalesce((select sum(e.required_minutes) from public.early_out_offset_requests e where e.user_id = v_request.user_id and e.status = 'Pending'), 0)
    + coalesce((select sum(l.offset_minutes_required) from public.leave_requests l where l.user_id = v_request.user_id and l.funding_source = 'offset' and l.status = 'Pending'), 0)
  into v_other_reserved_minutes;
  if v_balance_minutes - v_other_reserved_minutes < v_required_minutes then
    raise exception 'Employee no longer has enough unreserved approved Offset balance';
  end if;

  v_hours := v_required_minutes / 60;
  v_minutes := v_required_minutes % 60;
  insert into public.offset_transactions(user_id, kind, hours, minutes, usage_date, created_by, source, note)
  values(v_request.user_id, 'used', v_hours, v_minutes, v_log.log_date, (select auth.uid()), 'system', format('%s Offset approved: %s minute(s).', initcap(v_request.usage_type), v_required_minutes));

  update public.attendance_logs
  set status = 'Offset Applied',
      late_offset_minutes = case when v_request.usage_type = 'late' then v_required_minutes else late_offset_minutes end,
      absent_offset_minutes = case when v_request.usage_type = 'absent' then v_required_minutes else absent_offset_minutes end
  where id = v_log.id;
  update public.offset_usage_requests
  set status = 'Approved', required_minutes = v_required_minutes, reviewed_by = (select auth.uid()), reviewed_at = now(), hr_notes = p_notes
  where id = v_request.id;
  perform public.log_audit_event(
    case when v_request.usage_type = 'absent' then 'absent_offset_approved' else 'late_offset_approved' end,
    'attendance_log',
    null,
    format('Applied %s Offset minute(s) to %s attendance log #%s', v_required_minutes, initcap(v_request.usage_type), v_log.id)
  );
end;
$function$;

drop policy if exists "Employees submit own offset usage requests" on public.offset_usage_requests;
create policy "Employees submit own offset usage requests"
on public.offset_usage_requests for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'Pending'
  and reviewed_by is null
  and reviewed_at is null
  and hours = 1
  and required_minutes > 0
  and usage_type in ('late', 'absent')
  and exists (
    select 1
    from public.attendance_logs a
    where a.id = offset_usage_requests.attendance_log_id
      and a.user_id = (select auth.uid())
      and a.log_date between
        case when extract(day from (now() at time zone 'Asia/Manila'))::integer <= 15
          then date_trunc('month', (now() at time zone 'Asia/Manila'))::date
          else (date_trunc('month', (now() at time zone 'Asia/Manila'))::date + 15)
        end
        and case when extract(day from (now() at time zone 'Asia/Manila'))::integer <= 15
          then (date_trunc('month', (now() at time zone 'Asia/Manila'))::date + 14)
          else (date_trunc('month', (now() at time zone 'Asia/Manila')) + interval '1 month - 1 day')::date
        end
      and (
        (offset_usage_requests.usage_type = 'late'
          and lower(coalesce(a.status, '')) = 'late'
          and a.time_in is not null
          and offset_usage_requests.required_minutes = greatest(1, floor(extract(epoch from (a.time_in - ((a.log_date + time '09:00') at time zone 'Asia/Manila'))) / 60.0)::integer))
        or
        (offset_usage_requests.usage_type = 'absent'
          and lower(coalesce(a.status, '')) = 'absent'
          and offset_usage_requests.required_minutes = 540)
      )
  )
);

create or replace function public.submit_early_out_offset_request(p_attendance_log_id bigint)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_log public.attendance_logs;
  v_today date := (clock_timestamp() at time zone 'Asia/Manila')::date;
  v_period_start date;
  v_period_end date;
  v_cutoff_hour integer := 19;
  v_cutoff_at timestamptz;
  v_required_minutes integer := 0;
  v_balance_minutes integer := 0;
  v_reserved_minutes integer := 0;
  v_request_id uuid;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = v_user_id and p.role = 'employee' and p.is_active = true
  ) then
    raise exception 'Only active employees can request Early Out Offset';
  end if;
  if extract(day from v_today)::integer <= 15 then
    v_period_start := date_trunc('month', v_today)::date;
    v_period_end := v_period_start + 14;
  else
    v_period_start := date_trunc('month', v_today)::date + 15;
    v_period_end := (date_trunc('month', v_today) + interval '1 month - 1 day')::date;
  end if;

  select a.* into v_log from public.attendance_logs a where a.id = p_attendance_log_id and a.user_id = v_user_id for update;
  if not found then raise exception 'Attendance record not found'; end if;
  if v_log.log_date not between v_period_start and v_period_end then
    raise exception 'Only Early Out records from the current payroll cutoff can use Offset';
  end if;
  if v_log.time_out is null then raise exception 'This attendance record has no Time Out'; end if;
  if coalesce(v_log.early_out_offset_minutes, 0) > 0 then raise exception 'Offset is already applied to this Early Out'; end if;
  if exists (select 1 from public.early_out_offset_requests r where r.attendance_log_id = v_log.id) then
    raise exception 'This Early Out already has an Offset request';
  end if;
  select case when jsonb_typeof(s.value) = 'number' then (s.value #>> '{}')::integer else 19 end
    into v_cutoff_hour
  from public.app_settings s where s.key = 'time_out_reminder_hour';
  v_cutoff_hour := coalesce(v_cutoff_hour, 19);
  if v_cutoff_hour < 0 or v_cutoff_hour > 23 then v_cutoff_hour := 19; end if;
  v_cutoff_at := (v_log.log_date + make_time(v_cutoff_hour, 0, 0)) at time zone 'Asia/Manila';
  if v_log.time_out >= v_cutoff_at then raise exception 'This attendance record is not Early Out'; end if;
  v_required_minutes := ceil(extract(epoch from (v_cutoff_at - v_log.time_out)) / 60.0)::integer;
  if v_required_minutes <= 0 then raise exception 'This attendance record is not Early Out'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  select coalesce(sum(case when t.kind = 'earned' then (t.hours * 60 + t.minutes) else -(t.hours * 60 + t.minutes) end), 0)::integer
    into v_balance_minutes
  from public.offset_transactions t
  where t.user_id = v_user_id;
  select
    coalesce((select sum(coalesce(r.required_minutes, r.hours * 60)) from public.offset_usage_requests r where r.user_id = v_user_id and r.status = 'Pending'), 0)
    + coalesce((select sum(l.offset_minutes_required) from public.leave_requests l where l.user_id = v_user_id and l.status = 'Pending' and l.funding_source = 'offset'), 0)
    + coalesce((select sum(e.required_minutes) from public.early_out_offset_requests e where e.user_id = v_user_id and e.status = 'Pending'), 0)
  into v_reserved_minutes;
  if v_balance_minutes - v_reserved_minutes < v_required_minutes then
    raise exception 'Not enough available Offset. Early Out needs % minute(s); % minute(s) available.', v_required_minutes, greatest(0, v_balance_minutes - v_reserved_minutes);
  end if;
  insert into public.early_out_offset_requests(user_id, attendance_log_id, required_minutes, cutoff_hour)
  values(v_user_id, v_log.id, v_required_minutes, v_cutoff_hour)
  returning id into v_request_id;
  return v_request_id;
end;
$function$;

revoke all on function public.submit_offset_usage_request(bigint) from public, anon;
grant execute on function public.submit_offset_usage_request(bigint) to authenticated;
revoke all on function public.review_offset_usage_request(uuid, boolean, text) from public, anon;
grant execute on function public.review_offset_usage_request(uuid, boolean, text) to authenticated;
revoke all on function public.submit_early_out_offset_request(bigint) from public, anon;
grant execute on function public.submit_early_out_offset_request(bigint) to authenticated;
