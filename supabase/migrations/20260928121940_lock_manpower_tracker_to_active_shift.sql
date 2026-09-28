create or replace function public.switch_manpower_project(p_project_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_active_id uuid;
  v_active_project uuid;
  v_new_id uuid;
  v_today date := (now() at time zone 'Asia/Manila')::date;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_user_id and p.role = 'employee' and p.is_active = true
  ) then
    raise exception 'Only active employees can track manpower time';
  end if;

  if not exists (
    select 1
    from public.attendance_logs a
    where a.user_id = v_user_id
      and a.log_date = v_today
      and a.time_in is not null
      and a.time_out is null
  ) then
    raise exception 'Manpower Tracker is only available during your active shift. Time In first, and tracking ends after Time Out.';
  end if;

  if not exists (
    select 1 from public.manpower_projects mp
    where mp.id = p_project_id and mp.is_active = true
  ) then
    raise exception 'Project is not available';
  end if;

  select ms.id, ms.project_id
    into v_active_id, v_active_project
  from public.manpower_sessions ms
  where ms.user_id = v_user_id and ms.ended_at is null
  order by ms.started_at desc
  limit 1
  for update;

  if v_active_id is not null and v_active_project = p_project_id then
    return v_active_id;
  end if;

  if v_active_id is not null then
    update public.manpower_sessions
      set ended_at = now()
    where id = v_active_id;
  end if;

  insert into public.manpower_sessions(user_id, project_id, started_at)
  values(v_user_id, p_project_id, now())
  returning id into v_new_id;

  return v_new_id;
end;
$$;

revoke all on function public.switch_manpower_project(uuid) from public, anon;
grant execute on function public.switch_manpower_project(uuid) to authenticated;

create or replace function public.close_manpower_session_on_timeout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.time_out is null and new.time_out is not null then
    update public.manpower_sessions
      set ended_at = new.time_out
    where user_id = new.user_id
      and ended_at is null;
  end if;
  return new;
end;
$$;

revoke all on function public.close_manpower_session_on_timeout() from public, anon, authenticated;

drop trigger if exists attendance_timeout_closes_manpower_session on public.attendance_logs;
create trigger attendance_timeout_closes_manpower_session
after update of time_out on public.attendance_logs
for each row
when (old.time_out is null and new.time_out is not null)
execute function public.close_manpower_session_on_timeout();
