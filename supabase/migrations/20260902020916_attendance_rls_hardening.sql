-- Close direct Data API write paths that bypass authoritative server routes.
-- Time In/Out writes must pass through /api/time-in and /api/time-out, where
-- active-account, office-network, settings, duplicate, and server-clock checks
-- are enforced before the server-only client writes the row.
drop policy if exists "Users can insert own logs" on public.attendance_logs;
drop policy if exists "Users can update own logs" on public.attendance_logs;

-- Profiles are provisioned by the auth trigger and managed by protected
-- admin/server workflows. These permissive self-write policies allowed a
-- crafted Data API request to choose protected fields on INSERT, or to restore
-- is_active on UPDATE while preserving only the role value.
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

-- Never derive authorization from raw_user_meta_data: users can edit it. New
-- auth identities always start as employees; the authenticated admin API
-- explicitly promotes an account after validating the caller and role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, employee_id, full_name, role)
  values (
    new.id,
    'HSM-' || substr(md5(random()::text), 1, 6),
    coalesce(new.raw_user_meta_data->>'full_name', 'Bagong Empleyado'),
    'employee'
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- email_exists reads auth.users and is intentionally called only with the
-- server secret after the route authenticates an admin. Do not expose it as a
-- public RPC that permits account enumeration.
revoke execute on function public.email_exists(text) from public, anon, authenticated;

-- Fix the stale `hr` role checks used by avatar management. The application
-- uses `admin` for HR accounts and `super_admin` for the owner role.
drop policy if exists "HR can upload avatars" on storage.objects;
drop policy if exists "HR can update avatars" on storage.objects;
drop policy if exists "HR can view avatars objects" on storage.objects;
drop policy if exists "Admins can upload avatars" on storage.objects;
drop policy if exists "Admins can update avatars" on storage.objects;
drop policy if exists "Authenticated can view avatars" on storage.objects;

create policy "Admins can upload avatars"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = any (array['admin', 'super_admin'])
  )
);

create policy "Admins can update avatars"
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = any (array['admin', 'super_admin'])
  )
)
with check (
  bucket_id = 'avatars'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = any (array['admin', 'super_admin'])
  )
);

create policy "Authenticated can view avatars"
on storage.objects for select to authenticated
using (bucket_id = 'avatars');

-- These global settlement sweeps are legitimate HR operations, but their old
-- SECURITY DEFINER bodies allowed any authenticated employee to trigger them.
create or replace function public.settle_overdue_leave_days()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_today date := (current_timestamp at time zone 'Asia/Manila')::date;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = any (array['admin','super_admin'])
  ) then
    raise exception 'Not authorized';
  end if;

  for r in
    select user_id, leave_date
    from public.leave_request_days
    where status = 'Pending' and leave_date < v_today
  loop
    perform public.settle_leave_day(r.user_id, r.leave_date);
  end loop;
end;
$$;

create or replace function public.settle_overdue_absences()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (current_timestamp at time zone 'Asia/Manila')::date;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = any (array['admin','super_admin'])
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
    and coalesce(p.is_active, true) = true
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
$$;

revoke execute on function public.settle_overdue_leave_days() from public, anon;
revoke execute on function public.settle_overdue_absences() from public, anon;
grant execute on function public.settle_overdue_leave_days() to authenticated;
grant execute on function public.settle_overdue_absences() to authenticated;
