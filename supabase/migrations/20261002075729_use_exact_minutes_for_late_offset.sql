-- Offset is earned in whole hours after the scheduled end time, but spending it
-- against a Late or Early Out record is always measured in the exact minutes
-- that the record needs to be corrected.
begin;

alter table public.offset_usage_requests
  add column if not exists required_minutes integer;

alter table public.offset_usage_requests
  drop constraint if exists offset_usage_requests_required_minutes_check;
alter table public.offset_usage_requests
  add constraint offset_usage_requests_required_minutes_check
  check (required_minutes is null or required_minutes > 0);

alter table public.attendance_logs
  add column if not exists late_offset_minutes integer not null default 0;

alter table public.attendance_logs
  drop constraint if exists attendance_logs_late_offset_minutes_check;
alter table public.attendance_logs
  add constraint attendance_logs_late_offset_minutes_check
  check (late_offset_minutes >= 0);

-- Backfill the real minute requirement for every existing Late Offset request.
-- A 09:20:01 Time In consumes 20 minutes, not 60 minutes.
with calculated as (
  select
    r.id as request_id,
    r.attendance_log_id,
    greatest(
      1,
      floor(extract(epoch from (
        a.time_in - ((a.log_date + time '09:00') at time zone 'Asia/Manila')
      )) / 60.0)::integer
    ) as required_minutes
  from public.offset_usage_requests r
  join public.attendance_logs a on a.id = r.attendance_log_id
  where a.time_in is not null
)
update public.offset_usage_requests r
set required_minutes = calculated.required_minutes
from calculated
where r.id = calculated.request_id
  and r.required_minutes is distinct from calculated.required_minutes;

with applied as (
  select r.attendance_log_id, r.required_minutes
  from public.offset_usage_requests r
  where r.status = 'Approved'
    and r.required_minutes is not null
)
update public.attendance_logs a
set late_offset_minutes = applied.required_minutes
from applied
where a.id = applied.attendance_log_id
  and a.late_offset_minutes is distinct from applied.required_minutes;

-- Preserve the original 1-hour audit rows and add a clear, idempotent
-- correction. Positive differences are refunds; negative differences are the
-- missing debit for a Late record that exceeds one hour.
with corrections as (
  select
    r.id as request_id,
    r.user_id,
    r.attendance_log_id,
    a.log_date,
    r.hours * 60 - r.required_minutes as correction_minutes
  from public.offset_usage_requests r
  join public.attendance_logs a on a.id = r.attendance_log_id
  where r.status = 'Approved'
    and r.required_minutes is not null
)
insert into public.offset_transactions (
  user_id,
  kind,
  hours,
  minutes,
  usage_date,
  source,
  note
)
select
  c.user_id,
  case when c.correction_minutes > 0 then 'earned' else 'used' end,
  abs(c.correction_minutes) / 60,
  abs(c.correction_minutes) % 60,
  c.log_date,
  'system',
  format(
    'Late Offset minute correction for request %s (attendance log #%s): %s %s minute(s).',
    c.request_id,
    c.attendance_log_id,
    case when c.correction_minutes > 0 then 'refunded' else 'additional debit' end,
    abs(c.correction_minutes)
  )
from corrections c
where c.correction_minutes <> 0
  and not exists (
    select 1
    from public.offset_transactions t
    where t.note = format(
      'Late Offset minute correction for request %s (attendance log #%s): %s %s minute(s).',
      c.request_id,
      c.attendance_log_id,
      case when c.correction_minutes > 0 then 'refunded' else 'additional debit' end,
      abs(c.correction_minutes)
    )
  );

create or replace function public.submit_offset_usage_request(p_attendance_log_id bigint)
returns uuid
language plpgsql
set search_path to ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_log public.attendance_logs;
  v_balance_minutes integer;
  v_pending_usage_minutes integer;
  v_pending_early_out_minutes integer;
  v_pending_leave_minutes integer;
  v_required_minutes integer;
  v_request_id uuid;
  v_period_start date := (date_trunc('month', (now() at time zone 'Asia/Manila')) - interval '1 month')::date;
  v_period_end date := (date_trunc('month', (now() at time zone 'Asia/Manila')) + interval '1 month - 1 day')::date;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.profiles p where p.id = v_user_id and p.role = 'employee' and p.is_active = true) then
    raise exception 'Only active employees can request offset usage';
  end if;

  select a.* into v_log
  from public.attendance_logs a
  where a.id = p_attendance_log_id
    and a.user_id = v_user_id
    and lower(coalesce(a.status, '')) = 'late'
    and a.log_date between v_period_start and v_period_end
  for update;
  if not found then
    raise exception 'Only Late records from the current or previous month can use offset';
  end if;
  if v_log.time_in is null then raise exception 'Late attendance record has no Time In'; end if;

  v_required_minutes := greatest(
    1,
    floor(extract(epoch from (
      v_log.time_in - ((v_log.log_date + time '09:00') at time zone 'Asia/Manila')
    )) / 60.0)::integer
  );

  if exists (select 1 from public.offset_usage_requests r where r.attendance_log_id = p_attendance_log_id and r.status = 'Pending') then
    raise exception 'An offset usage request is already pending for this Late record';
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
  select coalesce(sum(lr.offset_minutes_required), 0)::integer
    into v_pending_leave_minutes
  from public.leave_requests lr
  where lr.user_id = v_user_id and lr.funding_source = 'offset' and lr.status = 'Pending';

  if v_balance_minutes - v_pending_usage_minutes - v_pending_early_out_minutes - v_pending_leave_minutes < v_required_minutes then
    raise exception 'Not enough available Offset. Late needs % minute(s); % minute(s) available.', v_required_minutes, greatest(0, v_balance_minutes - v_pending_usage_minutes - v_pending_early_out_minutes - v_pending_leave_minutes);
  end if;

  insert into public.offset_usage_requests(user_id, attendance_log_id, hours, required_minutes)
  values(v_user_id, p_attendance_log_id, 1, v_required_minutes)
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
  v_balance_minutes integer;
  v_required_minutes integer;
  v_hours integer;
  v_minutes integer;
begin
  if not exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'super_admin')) then
    raise exception 'Not authorized';
  end if;
  select * into v_request from public.offset_usage_requests where id = p_request_id for update;
  if not found or v_request.status <> 'Pending' then raise exception 'Offset usage request is not pending'; end if;
  if not p_approve then
    update public.offset_usage_requests
    set status = 'Rejected', reviewed_by = (select auth.uid()), reviewed_at = now(), hr_notes = p_notes
    where id = v_request.id;
    return;
  end if;

  select * into v_log from public.attendance_logs where id = v_request.attendance_log_id for update;
  if not found or v_log.user_id <> v_request.user_id or lower(coalesce(v_log.status, '')) <> 'late' then
    raise exception 'Late attendance record is no longer eligible';
  end if;
  if v_log.time_in is null then raise exception 'Late attendance record has no Time In'; end if;

  v_required_minutes := coalesce(
    v_request.required_minutes,
    greatest(1, floor(extract(epoch from (
      v_log.time_in - ((v_log.log_date + time '09:00') at time zone 'Asia/Manila')
    )) / 60.0)::integer)
  );
  select coalesce(sum(case when t.kind = 'earned' then (t.hours * 60 + t.minutes) else -(t.hours * 60 + t.minutes) end), 0)::integer
    into v_balance_minutes
  from public.offset_transactions t
  where t.user_id = v_request.user_id;
  if v_balance_minutes < v_required_minutes then
    raise exception 'Employee no longer has enough approved offset balance';
  end if;

  v_hours := v_required_minutes / 60;
  v_minutes := v_required_minutes % 60;
  insert into public.offset_transactions(user_id, kind, hours, minutes, usage_date, created_by, source, note)
  values(v_request.user_id, 'used', v_hours, v_minutes, v_log.log_date, (select auth.uid()), 'system', format('Late Offset approved: %s minute(s).', v_required_minutes));
  update public.attendance_logs
  set status = 'Offset Applied', late_offset_minutes = v_required_minutes
  where id = v_log.id;
  update public.offset_usage_requests
  set status = 'Approved', required_minutes = v_required_minutes, reviewed_by = (select auth.uid()), reviewed_at = now(), hr_notes = p_notes
  where id = v_request.id;
  perform public.log_audit_event('late_offset_approved', 'attendance_log', null, 'Applied ' || v_required_minutes::text || ' Offset minute(s) to Late attendance log #' || v_log.id::text);
end;
$function$;

-- Keep direct table inserts from bypassing the minute calculation.
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
  and exists (
    select 1
    from public.attendance_logs a
    where a.id = offset_usage_requests.attendance_log_id
      and a.user_id = (select auth.uid())
      and a.time_in is not null
      and lower(coalesce(a.status, '')) = 'late'
      and a.log_date between (date_trunc('month', (now() at time zone 'Asia/Manila')) - interval '1 month')::date
        and (date_trunc('month', (now() at time zone 'Asia/Manila')) + interval '1 month - 1 day')::date
      and offset_usage_requests.required_minutes = greatest(
        1,
        floor(extract(epoch from (
          a.time_in - ((a.log_date + time '09:00') at time zone 'Asia/Manila')
        )) / 60.0)::integer
      )
  )
);

-- The same exact Late reservation must be respected by every other Offset flow.
create or replace function public.get_hr_offset_balances()
returns table(user_id uuid, full_name text, employee_id text, approved_minutes integer, reserved_minutes integer, available_minutes integer)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'super_admin') and p.is_active = true) then
    raise exception 'Not authorized';
  end if;
  return query
  with tx as (
    select t.user_id, coalesce(sum(case when t.kind = 'earned' then (t.hours * 60 + t.minutes) else -(t.hours * 60 + t.minutes) end), 0)::integer as approved
    from public.offset_transactions t group by t.user_id
  ), late_pending as (
    select r.user_id, coalesce(sum(coalesce(r.required_minutes, r.hours * 60)), 0)::integer as minutes
    from public.offset_usage_requests r where r.status = 'Pending' group by r.user_id
  ), early_pending as (
    select r.user_id, coalesce(sum(r.required_minutes), 0)::integer as minutes
    from public.early_out_offset_requests r where r.status = 'Pending' group by r.user_id
  ), leave_pending as (
    select l.user_id, coalesce(sum(l.offset_minutes_required), 0)::integer as minutes
    from public.leave_requests l where l.funding_source = 'offset' and l.status = 'Pending' group by l.user_id
  )
  select p.id, coalesce(p.full_name, ''), p.employee_id, coalesce(tx.approved, 0)::integer,
    (coalesce(late_pending.minutes, 0) + coalesce(early_pending.minutes, 0) + coalesce(leave_pending.minutes, 0))::integer,
    greatest(0, coalesce(tx.approved, 0) - coalesce(late_pending.minutes, 0) - coalesce(early_pending.minutes, 0) - coalesce(leave_pending.minutes, 0))::integer
  from public.profiles p
  left join tx on tx.user_id = p.id
  left join late_pending on late_pending.user_id = p.id
  left join early_pending on early_pending.user_id = p.id
  left join leave_pending on leave_pending.user_id = p.id
  where p.role = 'employee' and p.is_active = true
  order by lower(coalesce(p.full_name, '')), p.employee_id nulls last;
end;
$function$;

create or replace function public.validate_offset_leave_insert()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_balance_minutes integer;
  v_pending_usage_minutes integer;
  v_pending_leave_minutes integer;
begin
  if new.funding_source <> 'offset' then
    new.offset_minutes_required := 0;
    new.offset_charged_at := null;
    new.offset_refunded_at := null;
    return new;
  end if;
  if (select auth.uid()) is null or new.user_id <> (select auth.uid()) then raise exception 'Offset-funded leave can only be filed by the employee'; end if;
  if not exists (select 1 from public.profiles p where p.id = new.user_id and p.role = 'employee' and p.is_active = true) then raise exception 'Only active employees can file offset-funded leave'; end if;
  if new.start_date <> new.end_date then raise exception 'Leave Using Offset is limited to one working day per request'; end if;
  if extract(dow from new.start_date) in (0, 6) or exists (select 1 from public.holidays h where h.holiday_date = new.start_date) then raise exception 'Leave Using Offset must be filed for a chargeable working day'; end if;
  if exists (select 1 from public.leave_requests lr where lr.user_id = new.user_id and lr.status in ('Pending', 'Approved') and lr.start_date <= new.start_date and lr.end_date >= new.start_date) then raise exception 'You already have an active leave request covering this date'; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  select coalesce(sum(case when t.kind = 'earned' then (t.hours * 60 + t.minutes) else -(t.hours * 60 + t.minutes) end), 0)::integer into v_balance_minutes from public.offset_transactions t where t.user_id = new.user_id;
  select coalesce(sum(coalesce(r.required_minutes, r.hours * 60)), 0)::integer into v_pending_usage_minutes from public.offset_usage_requests r where r.user_id = new.user_id and r.status = 'Pending';
  select coalesce(sum(lr.offset_minutes_required), 0)::integer into v_pending_leave_minutes from public.leave_requests lr where lr.user_id = new.user_id and lr.funding_source = 'offset' and lr.status = 'Pending';
  if v_balance_minutes - v_pending_usage_minutes - v_pending_leave_minutes < 540 then raise exception 'At least 9 unreserved approved offset hours are required'; end if;
  new.offset_minutes_required := 540;
  new.offset_charged_at := null;
  new.offset_refunded_at := null;
  return new;
end;
$function$;

create or replace function public.apply_offset_to_late(p_attendance_log_id bigint)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_log public.attendance_logs;
  v_balance_minutes integer;
  v_required_minutes integer;
begin
  if not exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'super_admin')) then raise exception 'Not authorized'; end if;
  select * into v_log from public.attendance_logs where id = p_attendance_log_id for update;
  if not found then raise exception 'Attendance record not found'; end if;
  if lower(coalesce(v_log.status, '')) <> 'late' or v_log.time_in is null then raise exception 'Only Late attendance records with a Time In can be scrubbed with offset'; end if;
  v_required_minutes := greatest(1, floor(extract(epoch from (v_log.time_in - ((v_log.log_date + time '09:00') at time zone 'Asia/Manila'))) / 60.0)::integer);
  select coalesce(sum(case when t.kind = 'earned' then (t.hours * 60 + t.minutes) else -(t.hours * 60 + t.minutes) end), 0)::integer into v_balance_minutes from public.offset_transactions t where t.user_id = v_log.user_id;
  if v_balance_minutes < v_required_minutes then raise exception 'Employee does not have enough approved offset available'; end if;
  insert into public.offset_transactions(user_id, kind, hours, minutes, usage_date, created_by, source, note)
  values(v_log.user_id, 'used', v_required_minutes / 60, v_required_minutes % 60, v_log.log_date, (select auth.uid()), 'system', format('Late Offset applied: %s minute(s).', v_required_minutes));
  update public.attendance_logs set status = 'Offset Applied', late_offset_minutes = v_required_minutes where id = v_log.id;
  perform public.log_audit_event('offset_applied_to_late', 'attendance_log', null, 'Applied ' || v_required_minutes::text || ' Offset minute(s) to Late attendance log #' || v_log.id::text || ' for ' || v_log.log_date::text);
end;
$function$;

create or replace function public.submit_early_out_offset_request(p_attendance_log_id bigint)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_log public.attendance_logs;
  v_period_start date := (date_trunc('month', (clock_timestamp() at time zone 'Asia/Manila')) - interval '1 month')::date;
  v_period_end date := (date_trunc('month', (clock_timestamp() at time zone 'Asia/Manila')) + interval '1 month - 1 day')::date;
  v_cutoff_hour integer := 19;
  v_cutoff_at timestamptz;
  v_required_minutes integer := 0;
  v_balance_minutes integer := 0;
  v_reserved_minutes integer := 0;
  v_request_id uuid;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.profiles p where p.id = v_user_id and p.role = 'employee' and p.is_active = true) then raise exception 'Only active employees can request Early Out Offset'; end if;
  select a.* into v_log from public.attendance_logs a where a.id = p_attendance_log_id and a.user_id = v_user_id for update;
  if not found then raise exception 'Attendance record not found'; end if;
  if v_log.log_date not between v_period_start and v_period_end then raise exception 'Only Early Out records from the current or previous month can use Offset'; end if;
  if v_log.time_out is null then raise exception 'This attendance record has no Time Out'; end if;
  if coalesce(v_log.early_out_offset_minutes, 0) > 0 then raise exception 'Offset is already applied to this Early Out'; end if;
  if exists (select 1 from public.early_out_offset_requests r where r.attendance_log_id = v_log.id) then raise exception 'This Early Out already has an Offset request'; end if;
  select case when jsonb_typeof(s.value) = 'number' then (s.value #>> '{}')::integer else 19 end into v_cutoff_hour from public.app_settings s where s.key = 'time_out_reminder_hour';
  v_cutoff_hour := coalesce(v_cutoff_hour, 19);
  if v_cutoff_hour < 0 or v_cutoff_hour > 23 then v_cutoff_hour := 19; end if;
  v_cutoff_at := (v_log.log_date + make_time(v_cutoff_hour, 0, 0)) at time zone 'Asia/Manila';
  if v_log.time_out >= v_cutoff_at then raise exception 'This attendance record is not Early Out'; end if;
  v_required_minutes := ceil(extract(epoch from (v_cutoff_at - v_log.time_out)) / 60.0)::integer;
  if v_required_minutes <= 0 then raise exception 'This attendance record is not Early Out'; end if;
  select coalesce(sum(case when t.kind = 'earned' then (t.hours * 60 + t.minutes) else -(t.hours * 60 + t.minutes) end), 0)::integer into v_balance_minutes from public.offset_transactions t where t.user_id = v_user_id;
  select
    coalesce((select sum(coalesce(r.required_minutes, r.hours * 60)) from public.offset_usage_requests r where r.user_id = v_user_id and r.status = 'Pending'), 0)
    + coalesce((select sum(l.offset_minutes_required) from public.leave_requests l where l.user_id = v_user_id and l.status = 'Pending' and l.funding_source = 'offset'), 0)
    + coalesce((select sum(e.required_minutes) from public.early_out_offset_requests e where e.user_id = v_user_id and e.status = 'Pending'), 0)
  into v_reserved_minutes;
  if v_balance_minutes - v_reserved_minutes < v_required_minutes then raise exception 'Not enough available Offset. Early Out needs % minute(s); % minute(s) available.', v_required_minutes, greatest(0, v_balance_minutes - v_reserved_minutes); end if;
  insert into public.early_out_offset_requests(user_id, attendance_log_id, required_minutes, cutoff_hour) values(v_user_id, v_log.id, v_required_minutes, v_cutoff_hour) returning id into v_request_id;
  return v_request_id;
end;
$function$;

create or replace function public.review_early_out_offset_request(p_request_id uuid, p_approve boolean, p_notes text default null)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_request public.early_out_offset_requests;
  v_log public.attendance_logs;
  v_balance_minutes integer := 0;
  v_other_reserved_minutes integer := 0;
  v_hours integer;
  v_minutes integer;
begin
  if not exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'super_admin')) then raise exception 'Not authorized'; end if;
  select r.* into v_request from public.early_out_offset_requests r where r.id = p_request_id for update;
  if not found or v_request.status <> 'Pending' then raise exception 'Early Out Offset request is not pending'; end if;
  select a.* into v_log from public.attendance_logs a where a.id = v_request.attendance_log_id for update;
  if not found or v_log.user_id <> v_request.user_id or v_log.time_out is null then raise exception 'Early Out attendance record is no longer eligible'; end if;
  if not p_approve then
    update public.early_out_offset_requests set status = 'Rejected', reviewed_by = (select auth.uid()), reviewed_at = now(), hr_notes = p_notes where id = v_request.id;
    perform public.log_audit_event('early_out_offset_rejected', 'attendance_log', null, 'Rejected Early Out Offset request for attendance log #' || v_request.attendance_log_id::text);
    return;
  end if;
  select coalesce(sum(case when t.kind = 'earned' then (t.hours * 60 + t.minutes) else -(t.hours * 60 + t.minutes) end), 0)::integer into v_balance_minutes from public.offset_transactions t where t.user_id = v_request.user_id;
  select
    coalesce((select sum(coalesce(r.required_minutes, r.hours * 60)) from public.offset_usage_requests r where r.user_id = v_request.user_id and r.status = 'Pending'), 0)
    + coalesce((select sum(l.offset_minutes_required) from public.leave_requests l where l.user_id = v_request.user_id and l.status = 'Pending' and l.funding_source = 'offset'), 0)
    + coalesce((select sum(e.required_minutes) from public.early_out_offset_requests e where e.user_id = v_request.user_id and e.status = 'Pending' and e.id <> v_request.id), 0)
  into v_other_reserved_minutes;
  if v_balance_minutes - v_other_reserved_minutes < v_request.required_minutes then raise exception 'Employee no longer has enough unreserved approved Offset balance'; end if;
  v_hours := v_request.required_minutes / 60;
  v_minutes := v_request.required_minutes % 60;
  insert into public.offset_transactions(user_id, kind, hours, minutes, usage_date, created_by, source, note)
  values(v_request.user_id, 'used', v_hours, v_minutes, v_log.log_date, (select auth.uid()), 'system', 'Early Out Offset approved');
  update public.attendance_logs set early_out_offset_minutes = v_request.required_minutes where id = v_log.id;
  update public.early_out_offset_requests set status = 'Approved', reviewed_by = (select auth.uid()), reviewed_at = now(), hr_notes = p_notes where id = v_request.id;
  perform public.log_audit_event('early_out_offset_approved', 'attendance_log', null, 'Applied ' || v_request.required_minutes::text || ' Offset minute(s) to Early Out attendance log #' || v_request.attendance_log_id::text);
end;
$function$;

create or replace function public.record_early_out_with_offset(p_user_id uuid, p_cutoff_hour integer)
returns table(request_id uuid, time_out timestamptz, required_minutes integer)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_date date := (v_now at time zone 'Asia/Manila')::date;
  v_cutoff timestamptz;
  v_log public.attendance_logs;
  v_balance_minutes integer := 0;
  v_reserved_minutes integer := 0;
  v_required_minutes integer := 0;
  v_request_id uuid;
begin
  if p_cutoff_hour < 0 or p_cutoff_hour > 23 then raise exception 'Invalid early-out cutoff'; end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id and p.role = 'employee' and p.is_active = true) then raise exception 'Only active employees can use Offset for Early Out'; end if;
  v_cutoff := (v_date + make_time(p_cutoff_hour, 0, 0)) at time zone 'Asia/Manila';
  if v_now >= v_cutoff then raise exception 'This is no longer an Early Out'; end if;
  select a.* into v_log from public.attendance_logs a where a.user_id = p_user_id and a.log_date = v_date for update;
  if not found or v_log.time_in is null then raise exception 'You have not timed in today'; end if;
  if v_log.time_out is not null then raise exception 'You have already timed out today'; end if;
  v_required_minutes := ceil(extract(epoch from (v_cutoff - v_now)) / 60.0)::integer;
  if v_required_minutes <= 0 then raise exception 'This is no longer an Early Out'; end if;
  select coalesce(sum(case when t.kind = 'earned' then (t.hours * 60 + t.minutes) else -(t.hours * 60 + t.minutes) end), 0)::integer into v_balance_minutes from public.offset_transactions t where t.user_id = p_user_id;
  select
    coalesce((select sum(coalesce(r.required_minutes, r.hours * 60)) from public.offset_usage_requests r where r.user_id = p_user_id and r.status = 'Pending'), 0)
    + coalesce((select sum(l.offset_minutes_required) from public.leave_requests l where l.user_id = p_user_id and l.status = 'Pending' and l.funding_source = 'offset'), 0)
    + coalesce((select sum(e.required_minutes) from public.early_out_offset_requests e where e.user_id = p_user_id and e.status = 'Pending'), 0)
  into v_reserved_minutes;
  if v_balance_minutes - v_reserved_minutes < v_required_minutes then raise exception 'Not enough unreserved approved Offset. Early Out needs % minute(s); % minute(s) available.', v_required_minutes, greatest(0, v_balance_minutes - v_reserved_minutes); end if;
  update public.attendance_logs a set time_out = v_now where a.id = v_log.id and a.time_out is null;
  if not found then raise exception 'You have already timed out today'; end if;
  insert into public.early_out_offset_requests(user_id, attendance_log_id, required_minutes, cutoff_hour) values(p_user_id, v_log.id, v_required_minutes, p_cutoff_hour) returning id into v_request_id;
  request_id := v_request_id;
  time_out := v_now;
  required_minutes := v_required_minutes;
  return next;
end;
$function$;

create or replace function public.convert_offset_to_paid_leave(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_balance_minutes integer;
  v_pending_usage_minutes integer;
  v_pending_leave_minutes integer;
  v_year integer := extract(year from now() at time zone 'Asia/Manila');
begin
  if not exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'super_admin')) then raise exception 'Not authorized'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select coalesce(sum(case when t.kind = 'earned' then (t.hours * 60 + t.minutes) else -(t.hours * 60 + t.minutes) end), 0)::integer into v_balance_minutes from public.offset_transactions t where t.user_id = p_user_id;
  select coalesce(sum(coalesce(r.required_minutes, r.hours * 60)), 0)::integer into v_pending_usage_minutes from public.offset_usage_requests r where r.user_id = p_user_id and r.status = 'Pending';
  select coalesce(sum(lr.offset_minutes_required), 0)::integer into v_pending_leave_minutes from public.leave_requests lr where lr.user_id = p_user_id and lr.funding_source = 'offset' and lr.status = 'Pending';
  if v_balance_minutes - v_pending_usage_minutes - v_pending_leave_minutes < 540 then raise exception 'At least 9 unreserved approved offset hours are required'; end if;
  insert into public.offset_transactions(user_id, kind, hours, minutes, created_by, source, note)
  values(p_user_id, 'converted', 9, 0, (select auth.uid()), 'system', 'Converted 9 approved offset hours to one paid leave credit');
  insert into public.leave_credits(user_id, year, total_credits, used_credits)
  values(p_user_id, v_year, 1, 0)
  on conflict(user_id, year) do update set total_credits = public.leave_credits.total_credits + 1;
end;
$function$;

-- Preserve access to the existing RPCs after replacing their definitions.
revoke all on function public.submit_offset_usage_request(bigint) from public, anon;
grant execute on function public.submit_offset_usage_request(bigint) to authenticated;
revoke all on function public.review_offset_usage_request(uuid, boolean, text) from public, anon;
grant execute on function public.review_offset_usage_request(uuid, boolean, text) to authenticated;
revoke all on function public.apply_offset_to_late(bigint) from public, anon;
grant execute on function public.apply_offset_to_late(bigint) to authenticated;
revoke all on function public.submit_early_out_offset_request(bigint) from public, anon;
grant execute on function public.submit_early_out_offset_request(bigint) to authenticated;
revoke all on function public.review_early_out_offset_request(uuid, boolean, text) from public, anon;
grant execute on function public.review_early_out_offset_request(uuid, boolean, text) to authenticated;
revoke all on function public.record_early_out_with_offset(uuid, integer) from public, anon, authenticated;
grant execute on function public.record_early_out_with_offset(uuid, integer) to service_role;
revoke all on function public.convert_offset_to_paid_leave(uuid) from public, anon;
grant execute on function public.convert_offset_to_paid_leave(uuid) to authenticated;
revoke all on function public.get_hr_offset_balances() from public, anon;
grant execute on function public.get_hr_offset_balances() to authenticated;

notify pgrst, 'reload schema';

commit;
