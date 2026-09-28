alter table public.offset_transactions
  add column if not exists source text not null default 'system',
  add column if not exists note text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'offset_transactions_source_check'
      and conrelid = 'public.offset_transactions'::regclass
  ) then
    alter table public.offset_transactions
      add constraint offset_transactions_source_check
      check (source in ('system','manual_adjustment'));
  end if;
end $$;

create or replace function public.adjust_offset_balance(
  p_user_id uuid,
  p_delta_hours integer,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance integer;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'super_admin'
  ) then
    raise exception 'Only Super Admin can adjust offset balances';
  end if;

  if p_delta_hours = 0 then
    raise exception 'Adjustment cannot be zero';
  end if;

  if char_length(v_reason) < 3 then
    raise exception 'A reason is required';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = p_user_id and p.role = 'employee'
  ) then
    raise exception 'Employee not found';
  end if;

  select coalesce(sum(case when t.kind = 'earned' then t.hours else -t.hours end), 0)
    into v_balance
  from public.offset_transactions t
  where t.user_id = p_user_id;

  if v_balance + p_delta_hours < 0 then
    raise exception 'Adjustment would make the offset balance negative';
  end if;

  insert into public.offset_transactions(
    user_id, kind, hours, created_by, source, note
  ) values (
    p_user_id,
    case when p_delta_hours > 0 then 'earned' else 'used' end,
    abs(p_delta_hours),
    (select auth.uid()),
    'manual_adjustment',
    v_reason
  );

  perform public.log_audit_event(
    'offset_balance_adjusted',
    'profile',
    p_user_id,
    case when p_delta_hours > 0 then 'Added ' else 'Deducted ' end
      || abs(p_delta_hours)::text || ' offset hour(s). Reason: ' || v_reason
  );
end;
$$;

revoke all on function public.adjust_offset_balance(uuid, integer, text) from public, anon;
grant execute on function public.adjust_offset_balance(uuid, integer, text) to authenticated;

create table if not exists public.manpower_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  project_code text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists manpower_projects_name_unique_ci
  on public.manpower_projects (lower(btrim(name)));
create index if not exists manpower_projects_active_name_idx
  on public.manpower_projects (is_active, name);

alter table public.manpower_projects enable row level security;
grant select, insert, update on public.manpower_projects to authenticated;
revoke all on public.manpower_projects from anon;

drop policy if exists "Authenticated read manpower projects" on public.manpower_projects;
create policy "Authenticated read manpower projects"
on public.manpower_projects for select to authenticated
using (
  is_active
  or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'super_admin'
  )
);

drop policy if exists "Super Admin insert manpower projects" on public.manpower_projects;
create policy "Super Admin insert manpower projects"
on public.manpower_projects for insert to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'super_admin'
  )
);

drop policy if exists "Super Admin update manpower projects" on public.manpower_projects;
create policy "Super Admin update manpower projects"
on public.manpower_projects for update to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'super_admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'super_admin'
  )
);

create table if not exists public.manpower_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.manpower_projects(id) on delete restrict,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);

create unique index if not exists manpower_sessions_one_active_per_user_idx
  on public.manpower_sessions(user_id)
  where ended_at is null;
create index if not exists manpower_sessions_user_started_idx
  on public.manpower_sessions(user_id, started_at desc);
create index if not exists manpower_sessions_project_started_idx
  on public.manpower_sessions(project_id, started_at desc);

alter table public.manpower_sessions enable row level security;
grant select on public.manpower_sessions to authenticated;
revoke all on public.manpower_sessions from anon;

drop policy if exists "Employees read own manpower sessions" on public.manpower_sessions;
create policy "Employees read own manpower sessions"
on public.manpower_sessions for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Super Admin read all manpower sessions" on public.manpower_sessions;
create policy "Super Admin read all manpower sessions"
on public.manpower_sessions for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'super_admin'
  )
);

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

create or replace function public.stop_manpower_tracking()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_user_id and p.role = 'employee' and p.is_active = true
  ) then
    raise exception 'Only active employees can stop manpower tracking';
  end if;

  update public.manpower_sessions
    set ended_at = now()
  where user_id = v_user_id and ended_at is null;
end;
$$;

revoke all on function public.stop_manpower_tracking() from public, anon;
grant execute on function public.stop_manpower_tracking() to authenticated;
