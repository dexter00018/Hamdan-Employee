create index if not exists manpower_projects_created_by_idx
  on public.manpower_projects(created_by);

drop policy if exists "Employees read own manpower sessions" on public.manpower_sessions;
drop policy if exists "Super Admin read all manpower sessions" on public.manpower_sessions;

create policy "Read manpower sessions by owner or Super Admin"
on public.manpower_sessions for select to authenticated
using (
  (select auth.uid()) = user_id
  or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'super_admin'
  )
);
