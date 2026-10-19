-- Transfer time by recording an equal negative and positive adjustment in one
-- audited, atomic transaction. Original manpower timer sessions stay intact.

alter table public.manpower_time_adjustments
  add column if not exists transfer_id uuid;

create index if not exists manpower_time_adjustments_transfer_id_idx
  on public.manpower_time_adjustments(transfer_id)
  where transfer_id is not null;

create or replace function public.transfer_manpower_time(
  p_user_id uuid,
  p_source_project_id uuid,
  p_destination_project_id uuid,
  p_work_date date,
  p_minutes integer,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_transfer_id uuid := gen_random_uuid();
  v_today date := (statement_timestamp() at time zone 'Asia/Manila')::date;
  v_now timestamptz := statement_timestamp();
  v_start timestamptz := (p_work_date + time '00:00') at time zone 'Asia/Manila';
  v_end timestamptz := ((p_work_date + 1) + time '00:00') at time zone 'Asia/Manila';
  v_source_minutes integer := 0;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'super_admin'
      and p.is_active = true
  ) then
    raise exception 'Only an active Super Admin can transfer manpower time';
  end if;

  if p_work_date is null or p_work_date > v_today then
    raise exception 'A manpower transfer cannot use a future work date';
  end if;
  if p_minutes is null or p_minutes < 1 or p_minutes > 1440 then
    raise exception 'Transfer must be between 1 and 1440 minutes';
  end if;
  if char_length(v_reason) < 3 then
    raise exception 'A reason of at least 3 characters is required';
  end if;
  if p_source_project_id is null or p_destination_project_id is null or p_source_project_id = p_destination_project_id then
    raise exception 'Choose two different projects for a manpower transfer';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id and p.role = 'employee') then
    raise exception 'Employee not found';
  end if;
  if not exists (select 1 from public.manpower_projects mp where mp.id = p_source_project_id)
     or not exists (select 1 from public.manpower_projects mp where mp.id = p_destination_project_id) then
    raise exception 'Project not found';
  end if;

  select coalesce(sum(greatest(
    0,
    floor(extract(epoch from (
      least(coalesce(ms.ended_at, v_now), v_end) - greatest(ms.started_at, v_start)
    )) / 60)
  )), 0)::integer
  into v_source_minutes
  from public.manpower_sessions ms
  where ms.user_id = p_user_id
    and ms.project_id = p_source_project_id
    and ms.started_at < v_end
    and coalesce(ms.ended_at, v_now) > v_start;

  select v_source_minutes + coalesce(sum(a.delta_minutes), 0)::integer
  into v_source_minutes
  from public.manpower_time_adjustments a
  where a.user_id = p_user_id
    and a.project_id = p_source_project_id
    and a.work_date = p_work_date;

  if v_source_minutes < p_minutes then
    raise exception 'The source project only has % available minute(s) on this work date', greatest(v_source_minutes, 0);
  end if;

  insert into public.manpower_time_adjustments(
    user_id, project_id, work_date, delta_minutes, transfer_id, reason, created_by
  )
  values
    (p_user_id, p_source_project_id, p_work_date, -p_minutes, v_transfer_id, v_reason, (select auth.uid())),
    (p_user_id, p_destination_project_id, p_work_date, p_minutes, v_transfer_id, v_reason, (select auth.uid()));

  perform public.log_audit_event(
    'manpower_time_transferred',
    'manpower_project',
    p_source_project_id,
    'Transferred ' || p_minutes::text || ' manpower minute(s) for employee ' || p_user_id::text
      || ' on ' || p_work_date::text || ' from project ' || p_source_project_id::text
      || ' to project ' || p_destination_project_id::text || '. Reason: ' || v_reason
  );

  return v_transfer_id;
end;
$function$;

revoke all on function public.transfer_manpower_time(uuid, uuid, uuid, date, integer, text) from public, anon;
grant execute on function public.transfer_manpower_time(uuid, uuid, uuid, date, integer, text) to authenticated;
