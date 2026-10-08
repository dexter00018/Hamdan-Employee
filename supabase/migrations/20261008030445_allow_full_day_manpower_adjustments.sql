-- Historical cleanup sometimes needs more than 12 hours removed from a single
-- calendar day when a tracker was left open.  Keep each correction bounded to
-- one day and allow Super Admin to correct today's already-recorded portion.

alter table public.manpower_time_adjustments
  drop constraint if exists manpower_time_adjustments_delta_minutes_check;
alter table public.manpower_time_adjustments
  add constraint manpower_time_adjustments_delta_minutes_check
  check (delta_minutes <> 0 and delta_minutes between -1440 and 1440);

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
  v_now timestamptz := statement_timestamp();
  v_today date := (v_now at time zone 'Asia/Manila')::date;
  v_start timestamptz := (p_work_date + time '00:00') at time zone 'Asia/Manila';
  v_end timestamptz := ((p_work_date + 1) + time '00:00') at time zone 'Asia/Manila';
  v_recorded_minutes integer := 0;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'super_admin'
  ) then
    raise exception 'Only Super Admin can adjust manpower time';
  end if;
  if p_work_date is null or p_work_date > v_today then
    raise exception 'A manpower adjustment cannot use a future work date';
  end if;
  if p_delta_minutes is null or p_delta_minutes = 0 or p_delta_minutes < -1440 or p_delta_minutes > 1440 then
    raise exception 'Adjustment must be between -1440 and 1440 minutes';
  end if;
  if char_length(v_reason) < 3 then
    raise exception 'A reason of at least 3 characters is required';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id and p.role = 'employee') then
    raise exception 'Employee not found';
  end if;
  if not exists (select 1 from public.manpower_projects mp where mp.id = p_project_id) then
    raise exception 'Project not found';
  end if;

  select coalesce(sum(greatest(
    0,
    floor(extract(epoch from (
      least(coalesce(ms.ended_at, v_now), v_end) - greatest(ms.started_at, v_start)
    )) / 60)
  )), 0)::integer
  into v_recorded_minutes
  from public.manpower_sessions ms
  where ms.user_id = p_user_id
    and ms.project_id = p_project_id
    and ms.started_at < v_end
    and coalesce(ms.ended_at, v_now) > v_start;

  select v_recorded_minutes + coalesce(sum(a.delta_minutes), 0)::integer
  into v_recorded_minutes
  from public.manpower_time_adjustments a
  where a.user_id = p_user_id
    and a.project_id = p_project_id
    and a.work_date = p_work_date;

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
