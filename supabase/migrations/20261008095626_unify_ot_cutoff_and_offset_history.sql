-- One source of truth for shift close, OT eligibility, and earned Offset:
-- 7:00 PM Asia/Manila. Only completed whole hours after this point are eligible.
-- Existing requests retain their original snapshot for audit accuracy.

insert into public.app_settings(key, value)
values ('time_out_reminder_hour', '19'::jsonb)
on conflict (key) do update
  set value = excluded.value,
      updated_at = now();

create or replace function public.close_manpower_at_daily_cutoff()
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_now timestamptz := statement_timestamp();
  v_work_date date := (v_now at time zone 'Asia/Manila')::date;
  v_cutoff_at timestamptz := (v_work_date + time '19:00') at time zone 'Asia/Manila';
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
  '0 11 * * *',
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
  v_cutoff_at timestamptz := ((v_now at time zone 'Asia/Manila')::date + time '19:00') at time zone 'Asia/Manila';
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.profiles p where p.id = v_user_id and p.role = 'employee' and p.is_active = true) then raise exception 'Only active employees can track manpower time'; end if;
  if exists (select 1 from public.profiles p where p.id = v_user_id and upper(trim(coalesce(p.designation, ''))) in ('IT MANAGER', 'HR MANAGER')) then raise exception 'Manpower Tracker is not assigned to your designation'; end if;
  if not exists (select 1 from public.attendance_logs a where a.user_id = v_user_id and a.log_date = v_today and a.time_in is not null and a.time_out is null) then raise exception 'Manpower Tracker is only available during your active attendance shift'; end if;
  if v_now >= v_cutoff_at then raise exception 'Manpower tracking closes at 7:00 PM Manila time. Approved OT is assigned to your final project after HR approval.'; end if;
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
  v_cutoff_at timestamptz := (new.log_date + time '19:00') at time zone 'Asia/Manila';
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

create or replace function public.capture_offset_manpower_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_cutoff_at timestamptz := ((new.time_out_at at time zone 'Asia/Manila')::date + time '19:00') at time zone 'Asia/Manila';
  v_eligible_hours integer := floor(greatest(0, extract(epoch from (new.time_out_at - v_cutoff_at)) / 3600))::integer;
  v_project_id uuid;
begin
  -- A partial hour never earns Offset: 7:59 PM earns 0h, 8:00 PM earns 1h.
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

create or replace function public.review_offset_request(
  p_request_id uuid,
  p_approve boolean,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  r public.offset_requests;
begin
  if not exists(select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin')) then
    raise exception 'Not authorized';
  end if;

  select * into r from public.offset_requests where id = p_request_id for update;
  if not found or r.status <> 'Pending' then
    raise exception 'Offset request is not pending';
  end if;

  update public.offset_requests
  set status = case when p_approve then 'Approved' else 'Rejected' end,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      hr_notes = nullif(btrim(coalesce(p_notes, '')), '')
  where id = p_request_id;

  if p_approve then
    insert into public.offset_transactions(user_id, offset_request_id, kind, hours, created_by)
    values(r.user_id, r.id, 'earned', r.eligible_hours, auth.uid());
  end if;

  perform public.log_audit_event(
    case when p_approve then 'offset_earned_approved' else 'offset_earned_rejected' end,
    'offset_request',
    r.id,
    case when p_approve then 'Approved ' else 'Rejected ' end
      || r.eligible_hours::text || ' earned Offset hour(s) from Time Out '
      || r.time_out_at::text || ' (7:00 PM Manila baseline).'
  );
end;
$function$;

create index if not exists offset_requests_reviewed_at_idx
  on public.offset_requests(reviewed_at desc)
  where status in ('Approved', 'Rejected');
