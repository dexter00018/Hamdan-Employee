alter table public.attendance_logs
  add column if not exists early_out_offset_minutes integer not null default 0;

alter table public.attendance_logs drop constraint if exists attendance_logs_early_out_offset_minutes_check;
alter table public.attendance_logs
  add constraint attendance_logs_early_out_offset_minutes_check
  check (early_out_offset_minutes >= 0);

create table if not exists public.early_out_offset_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  attendance_log_id bigint not null references public.attendance_logs(id) on delete cascade,
  required_minutes integer not null check (required_minutes > 0),
  cutoff_hour integer not null check (cutoff_hour between 0 and 23),
  status text not null default 'Pending' check (status in ('Pending','Approved','Rejected')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  hr_notes text
);

alter table public.early_out_offset_requests enable row level security;
revoke all on public.early_out_offset_requests from anon;
grant select on public.early_out_offset_requests to authenticated;

create unique index if not exists early_out_offset_requests_log_idx
  on public.early_out_offset_requests(attendance_log_id);
create index if not exists early_out_offset_requests_user_created_idx
  on public.early_out_offset_requests(user_id, created_at desc);
create index if not exists early_out_offset_requests_status_created_idx
  on public.early_out_offset_requests(status, created_at);
create index if not exists early_out_offset_requests_reviewed_by_idx
  on public.early_out_offset_requests(reviewed_by) where reviewed_by is not null;

drop policy if exists "Employees read own early out offset requests" on public.early_out_offset_requests;
create policy "Employees read own early out offset requests"
on public.early_out_offset_requests for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "HR read early out offset requests" on public.early_out_offset_requests;
create policy "HR read early out offset requests"
on public.early_out_offset_requests for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid()) and p.role in ('admin','super_admin')
));

create or replace function public.record_early_out_with_offset(
  p_user_id uuid,
  p_cutoff_hour integer
)
returns table(request_id uuid, time_out timestamptz, required_minutes integer)
language plpgsql
security definer
set search_path = ''
as $$
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
  if p_cutoff_hour < 0 or p_cutoff_hour > 23 then
    raise exception 'Invalid early-out cutoff';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = p_user_id and p.role = 'employee' and p.is_active = true
  ) then
    raise exception 'Only active employees can use Offset for Early Out';
  end if;

  v_cutoff := (v_date + make_time(p_cutoff_hour, 0, 0)) at time zone 'Asia/Manila';
  if v_now >= v_cutoff then
    raise exception 'This is no longer an Early Out';
  end if;

  select * into v_log
  from public.attendance_logs a
  where a.user_id = p_user_id and a.log_date = v_date
  for update;

  if not found or v_log.time_in is null then
    raise exception 'You have not timed in today';
  end if;
  if v_log.time_out is not null then
    raise exception 'You have already timed out today';
  end if;

  v_required_minutes := ceil(extract(epoch from (v_cutoff - v_now)) / 60.0)::integer;
  if v_required_minutes <= 0 then
    raise exception 'This is no longer an Early Out';
  end if;

  select coalesce(sum(
    case when t.kind = 'earned'
      then (t.hours * 60 + t.minutes)
      else -(t.hours * 60 + t.minutes)
    end
  ), 0)::integer
  into v_balance_minutes
  from public.offset_transactions t
  where t.user_id = p_user_id;

  select
    coalesce((select sum(r.hours * 60) from public.offset_usage_requests r where r.user_id = p_user_id and r.status = 'Pending'), 0)
    + coalesce((select sum(l.offset_minutes_required) from public.leave_requests l where l.user_id = p_user_id and l.status = 'Pending' and l.funding_source = 'offset'), 0)
    + coalesce((select sum(e.required_minutes) from public.early_out_offset_requests e where e.user_id = p_user_id and e.status = 'Pending'), 0)
  into v_reserved_minutes;

  if v_balance_minutes - v_reserved_minutes < v_required_minutes then
    raise exception 'Not enough unreserved approved Offset. Early Out needs % minute(s); % minute(s) available.',
      v_required_minutes, greatest(0, v_balance_minutes - v_reserved_minutes);
  end if;

  update public.attendance_logs
  set time_out = v_now
  where id = v_log.id and time_out is null;

  if not found then
    raise exception 'You have already timed out today';
  end if;

  insert into public.early_out_offset_requests(
    user_id, attendance_log_id, required_minutes, cutoff_hour
  ) values (
    p_user_id, v_log.id, v_required_minutes, p_cutoff_hour
  ) returning id into v_request_id;

  request_id := v_request_id;
  time_out := v_now;
  required_minutes := v_required_minutes;
  return next;
end;
$$;

revoke all on function public.record_early_out_with_offset(uuid,integer) from public, anon, authenticated;
grant execute on function public.record_early_out_with_offset(uuid,integer) to service_role;

create or replace function public.review_early_out_offset_request(
  p_request_id uuid,
  p_approve boolean,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.early_out_offset_requests;
  v_log public.attendance_logs;
  v_balance_minutes integer := 0;
  v_other_reserved_minutes integer := 0;
  v_hours integer;
  v_minutes integer;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin','super_admin')
  ) then
    raise exception 'Not authorized';
  end if;

  select * into v_request
  from public.early_out_offset_requests r
  where r.id = p_request_id
  for update;

  if not found or v_request.status <> 'Pending' then
    raise exception 'Early Out Offset request is not pending';
  end if;

  if not p_approve then
    update public.early_out_offset_requests
    set status = 'Rejected', reviewed_by = (select auth.uid()), reviewed_at = now(), hr_notes = p_notes
    where id = v_request.id;
    perform public.log_audit_event(
      'early_out_offset_rejected', 'attendance_log', null,
      'Rejected Early Out Offset request for attendance log #' || v_request.attendance_log_id::text
    );
    return;
  end if;

  select * into v_log
  from public.attendance_logs a
  where a.id = v_request.attendance_log_id
  for update;

  if not found or v_log.user_id <> v_request.user_id or v_log.time_out is null then
    raise exception 'Early Out attendance record is no longer eligible';
  end if;

  select coalesce(sum(
    case when t.kind = 'earned'
      then (t.hours * 60 + t.minutes)
      else -(t.hours * 60 + t.minutes)
    end
  ), 0)::integer
  into v_balance_minutes
  from public.offset_transactions t
  where t.user_id = v_request.user_id;

  select
    coalesce((select sum(r.hours * 60) from public.offset_usage_requests r where r.user_id = v_request.user_id and r.status = 'Pending'), 0)
    + coalesce((select sum(l.offset_minutes_required) from public.leave_requests l where l.user_id = v_request.user_id and l.status = 'Pending' and l.funding_source = 'offset'), 0)
    + coalesce((select sum(e.required_minutes) from public.early_out_offset_requests e where e.user_id = v_request.user_id and e.status = 'Pending' and e.id <> v_request.id), 0)
  into v_other_reserved_minutes;

  if v_balance_minutes - v_other_reserved_minutes < v_request.required_minutes then
    raise exception 'Employee no longer has enough unreserved approved Offset balance';
  end if;

  v_hours := v_request.required_minutes / 60;
  v_minutes := v_request.required_minutes % 60;

  insert into public.offset_transactions(
    user_id, kind, hours, minutes, usage_date, created_by, source, note
  ) values (
    v_request.user_id, 'used', v_hours, v_minutes, v_log.log_date,
    (select auth.uid()), 'system', 'Early Out Offset approved'
  );

  update public.attendance_logs
  set early_out_offset_minutes = v_request.required_minutes
  where id = v_log.id;

  update public.early_out_offset_requests
  set status = 'Approved', reviewed_by = (select auth.uid()), reviewed_at = now(), hr_notes = p_notes
  where id = v_request.id;

  perform public.log_audit_event(
    'early_out_offset_approved', 'attendance_log', null,
    'Applied ' || v_request.required_minutes::text || ' Offset minute(s) to Early Out attendance log #' || v_request.attendance_log_id::text
  );
end;
$$;

revoke all on function public.review_early_out_offset_request(uuid,boolean,text) from public, anon;
grant execute on function public.review_early_out_offset_request(uuid,boolean,text) to authenticated;
