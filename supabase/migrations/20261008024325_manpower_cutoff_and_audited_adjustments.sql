-- Manpower is capped at 7:30 PM Asia/Manila.  OT remains an attendance/Offset
-- approval decision: after approval, its eligible whole-hour portion is restored
-- to the employee's final project as a closed, auditable session.

alter table public.manpower_sessions
  add column if not exists source text not null default 'timer',
  add column if not exists offset_request_id uuid unique references public.offset_requests(id) on delete restrict;

alter table public.manpower_sessions
  drop constraint if exists manpower_sessions_source_check;
alter table public.manpower_sessions
  add constraint manpower_sessions_source_check
  check (source in ('timer', 'approved_ot'));

create table if not exists public.manpower_cutoff_snapshots (
  user_id uuid not null references public.profiles(id) on delete cascade,
  work_date date not null,
  project_id uuid references public.manpower_projects(id) on delete restrict,
  cutoff_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, work_date)
);

alter table public.manpower_cutoff_snapshots enable row level security;
revoke all on public.manpower_cutoff_snapshots from anon;
grant select on public.manpower_cutoff_snapshots to authenticated;

drop policy if exists "Employees read own manpower cutoff snapshots" on public.manpower_cutoff_snapshots;
create policy "Employees read own manpower cutoff snapshots"
on public.manpower_cutoff_snapshots for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Super Admin read manpower cutoff snapshots" on public.manpower_cutoff_snapshots;
create policy "Super Admin read manpower cutoff snapshots"
on public.manpower_cutoff_snapshots for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid()) and p.role = 'super_admin'
));

create table if not exists public.manpower_time_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.manpower_projects(id) on delete restrict,
  work_date date not null,
  delta_minutes integer not null check (delta_minutes <> 0 and delta_minutes between -720 and 720),
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists manpower_time_adjustments_work_date_idx
  on public.manpower_time_adjustments(work_date, user_id, project_id);

alter table public.manpower_time_adjustments enable row level security;
revoke all on public.manpower_time_adjustments from anon;
grant select on public.manpower_time_adjustments to authenticated;

drop policy if exists "Employees read own manpower adjustments" on public.manpower_time_adjustments;
create policy "Employees read own manpower adjustments"
on public.manpower_time_adjustments for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Super Admin read manpower adjustments" on public.manpower_time_adjustments;
create policy "Super Admin read manpower adjustments"
on public.manpower_time_adjustments for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = (select auth.uid()) and p.role = 'super_admin'
));

create or replace function public.close_manpower_at_daily_cutoff()
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_now timestamptz := statement_timestamp();
  v_work_date date := (v_now at time zone 'Asia/Manila')::date;
  v_cutoff_at timestamptz := (v_work_date + time '19:30') at time zone 'Asia/Manila';
begin
  if v_now < v_cutoff_at then
    return;
  end if;

  insert into public.manpower_cutoff_snapshots(user_id, work_date, project_id, cutoff_at)
  select ms.user_id, v_work_date, ms.project_id, v_cutoff_at
  from public.manpower_sessions ms
  where ms.ended_at is null
    and ms.started_at <= v_cutoff_at
    and exists (
      select 1
      from public.attendance_logs a
      where a.user_id = ms.user_id
        and a.log_date = v_work_date
        and a.time_in is not null
        and a.time_out is null
    )
  on conflict (user_id, work_date) do nothing;

  update public.manpower_sessions ms
  set ended_at = greatest(ms.started_at, v_cutoff_at)
  where ms.ended_at is null
    and ms.started_at <= v_cutoff_at
    and exists (
      select 1
      from public.attendance_logs a
      where a.user_id = ms.user_id
        and a.log_date = v_work_date
        and a.time_in is not null
        and a.time_out is null
    );
end;
$function$;

revoke all on function public.close_manpower_at_daily_cutoff() from public, anon, authenticated;

-- Existing jobs use UTC (12:00 and 13:00 Manila are scheduled as 04:00/05:00 UTC).
do $block$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'manpower-daily-cutoff-manila';
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
end;
$block$;
select cron.schedule(
  'manpower-daily-cutoff-manila',
  '30 11 * * *',
  'select public.close_manpower_at_daily_cutoff();'
);

create or replace function public.switch_manpower_project(p_project_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_active_id uuid;
  v_active_project uuid;
  v_active_started_at timestamptz;
  v_new_id uuid;
  v_now timestamptz := now();
  v_today date := (v_now at time zone 'Asia/Manila')::date;
  v_local_time time := (v_now at time zone 'Asia/Manila')::time;
  v_tracking_start timestamptz := ((v_now at time zone 'Asia/Manila')::date + time '09:00') at time zone 'Asia/Manila';
  v_cutoff_at timestamptz := ((v_now at time zone 'Asia/Manila')::date + time '19:30') at time zone 'Asia/Manila';
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.profiles p where p.id = v_user_id and p.role = 'employee' and p.is_active = true) then raise exception 'Only active employees can track manpower time'; end if;
  if exists (select 1 from public.profiles p where p.id = v_user_id and upper(trim(coalesce(p.designation, ''))) in ('IT MANAGER', 'HR MANAGER')) then raise exception 'Manpower Tracker is not assigned to your designation'; end if;
  if not exists (select 1 from public.attendance_logs a where a.user_id = v_user_id and a.log_date = v_today and a.time_in is not null and a.time_out is null) then raise exception 'Manpower Tracker is only available during your active attendance shift'; end if;
  if v_now >= v_cutoff_at then raise exception 'Manpower tracking closes at 7:30 PM Manila time. Approved OT is assigned to your final project after HR approval.'; end if;
  if v_local_time >= time '12:00' and v_local_time < time '13:00' then raise exception 'Manpower Tracker is paused for lunch from 12:00 PM to 1:00 PM'; end if;
  if not exists (select 1 from public.manpower_projects mp where mp.id = p_project_id and mp.is_active = true) then raise exception 'Project is not available'; end if;

  select ms.id, ms.project_id, ms.started_at
  into v_active_id, v_active_project, v_active_started_at
  from public.manpower_sessions ms
  where ms.user_id = v_user_id and ms.ended_at is null
  order by ms.started_at desc
  limit 1
  for update;

  if v_active_id is not null and v_active_project = p_project_id then return v_active_id; end if;
  if v_active_id is not null and v_active_started_at > v_now then
    update public.manpower_sessions set project_id = p_project_id where id = v_active_id;
    return v_active_id;
  end if;
  if v_active_id is not null then update public.manpower_sessions set ended_at = v_now where id = v_active_id; end if;
  insert into public.manpower_sessions(user_id, project_id, started_at)
  values(v_user_id, p_project_id, case when v_local_time < time '09:00' then v_tracking_start else v_now end)
  returning id into v_new_id;
  return v_new_id;
end;
$function$;

create or replace function public.close_manpower_session_on_timeout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_cutoff_at timestamptz := (new.log_date + time '19:30') at time zone 'Asia/Manila';
  v_end_at timestamptz := least(new.time_out, v_cutoff_at);
begin
  if old.time_out is null and new.time_out is not null then
    delete from public.manpower_sessions
    where user_id = new.user_id and ended_at is null and started_at > v_end_at;
    update public.manpower_sessions
    set ended_at = greatest(started_at, v_end_at)
    where user_id = new.user_id and ended_at is null and started_at <= v_end_at;
  end if;
  return new;
end;
$function$;

alter table public.offset_requests
  add column if not exists manpower_project_id uuid references public.manpower_projects(id) on delete restrict,
  add column if not exists manpower_ot_start_at timestamptz,
  add column if not exists manpower_ot_end_at timestamptz;

create or replace function public.capture_offset_manpower_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_cutoff_at timestamptz := ((new.time_out_at at time zone 'Asia/Manila')::date + time '19:30') at time zone 'Asia/Manila';
  v_eligible_hours integer := floor(greatest(0, extract(epoch from (new.time_out_at - v_cutoff_at)) / 3600))::integer;
  v_project_id uuid;
begin
  -- Offset remains whole completed hours, but its earning boundary is now 7:30 PM.
  if v_eligible_hours < 1 then
    delete from public.offset_requests where id = new.id;
    return new;
  end if;

  select s.project_id into v_project_id
  from public.manpower_cutoff_snapshots s
  where s.user_id = new.user_id
    and s.work_date = (new.time_out_at at time zone 'Asia/Manila')::date;

  if v_project_id is null then
    select ms.project_id into v_project_id
    from public.manpower_sessions ms
    where ms.user_id = new.user_id
      and ms.started_at <= v_cutoff_at
      and coalesce(ms.ended_at, v_cutoff_at) <= v_cutoff_at
    order by coalesce(ms.ended_at, v_cutoff_at) desc, ms.started_at desc
    limit 1;
  end if;

  update public.offset_requests
  set scheduled_end_at = v_cutoff_at,
      eligible_hours = v_eligible_hours,
      manpower_project_id = v_project_id,
      manpower_ot_start_at = v_cutoff_at,
      manpower_ot_end_at = v_cutoff_at + make_interval(hours => v_eligible_hours)
  where id = new.id;
  return new;
end;
$function$;

drop trigger if exists offset_request_captures_manpower_context on public.offset_requests;
create trigger offset_request_captures_manpower_context
after insert on public.offset_requests
for each row execute function public.capture_offset_manpower_context();

create or replace function public.add_approved_offset_manpower()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.status <> 'Approved'
    and new.status = 'Approved'
    and new.manpower_project_id is not null
    and new.manpower_ot_start_at is not null
    and new.manpower_ot_end_at is not null
    and new.manpower_ot_end_at > new.manpower_ot_start_at then
    insert into public.manpower_sessions(user_id, project_id, started_at, ended_at, source, offset_request_id)
    values(new.user_id, new.manpower_project_id, new.manpower_ot_start_at, new.manpower_ot_end_at, 'approved_ot', new.id)
    on conflict (offset_request_id) do nothing;
  end if;
  return new;
end;
$function$;

drop trigger if exists approved_offset_adds_manpower on public.offset_requests;
create trigger approved_offset_adds_manpower
after update of status on public.offset_requests
for each row
when (old.status is distinct from new.status)
execute function public.add_approved_offset_manpower();

create or replace function public.adjust_manpower_time(
  p_user_id uuid,
  p_project_id uuid,
  p_work_date date,
  p_delta_minutes integer,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_adjustment_id uuid;
  v_today date := (statement_timestamp() at time zone 'Asia/Manila')::date;
  v_start timestamptz := (p_work_date + time '00:00') at time zone 'Asia/Manila';
  v_end timestamptz := ((p_work_date + 1) + time '00:00') at time zone 'Asia/Manila';
  v_recorded_minutes integer := 0;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'super_admin') then
    raise exception 'Only Super Admin can adjust manpower time';
  end if;
  if p_work_date is null or p_work_date >= v_today then raise exception 'Only past work dates can be adjusted'; end if;
  if p_delta_minutes is null or p_delta_minutes = 0 or p_delta_minutes < -720 or p_delta_minutes > 720 then raise exception 'Adjustment must be between -720 and 720 minutes'; end if;
  if char_length(v_reason) < 3 then raise exception 'A reason of at least 3 characters is required'; end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id and p.role = 'employee') then raise exception 'Employee not found'; end if;
  if not exists (select 1 from public.manpower_projects mp where mp.id = p_project_id) then raise exception 'Project not found'; end if;

  select coalesce(sum(greatest(0, floor(extract(epoch from (least(ms.ended_at, v_end) - greatest(ms.started_at, v_start))) / 60))), 0)::integer
    into v_recorded_minutes
  from public.manpower_sessions ms
  where ms.user_id = p_user_id
    and ms.project_id = p_project_id
    and ms.ended_at is not null
    and ms.started_at < v_end
    and ms.ended_at > v_start;

  select v_recorded_minutes + coalesce(sum(a.delta_minutes), 0)::integer
    into v_recorded_minutes
  from public.manpower_time_adjustments a
  where a.user_id = p_user_id and a.project_id = p_project_id and a.work_date = p_work_date;

  if v_recorded_minutes + p_delta_minutes < 0 then
    raise exception 'This deduction would make the project total negative';
  end if;

  insert into public.manpower_time_adjustments(user_id, project_id, work_date, delta_minutes, reason, created_by)
  values(p_user_id, p_project_id, p_work_date, p_delta_minutes, v_reason, (select auth.uid()))
  returning id into v_adjustment_id;

  perform public.log_audit_event(
    'manpower_time_adjusted',
    'manpower_project',
    p_project_id,
    case when p_delta_minutes > 0 then 'Added ' else 'Deducted ' end
      || abs(p_delta_minutes)::text || ' manpower minute(s) for employee ' || p_user_id::text
      || ' on ' || p_work_date::text || '. Reason: ' || v_reason
  );
  return v_adjustment_id;
end;
$function$;

revoke all on function public.adjust_manpower_time(uuid, uuid, date, integer, text) from public, anon;
grant execute on function public.adjust_manpower_time(uuid, uuid, date, integer, text) to authenticated;
