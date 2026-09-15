begin;
-- Manila helpdesk only. No attendance, timezone, settings or webhook changes.
-- Requires the existing employee_support_requests table.
alter table public.employee_support_requests enable row level security;
do $$ declare r record; begin
 for r in select policyname from pg_policies where schemaname='public' and tablename='employee_support_requests' loop
  execute format('drop policy %I on public.employee_support_requests',r.policyname);
 end loop;
 for r in select conname from pg_constraint where conrelid='public.employee_support_requests'::regclass and contype='c' and pg_get_constraintdef(oid) like '%status%' loop
  execute format('alter table public.employee_support_requests drop constraint %I',r.conname);
 end loop;
end $$;
update public.employee_support_requests set status='Open' where status='Submitted';
alter table public.employee_support_requests alter column status set default 'Open';
grant select,insert,update on public.employee_support_requests to authenticated;


drop policy if exists "Users can view own or admins view support requests" on public.employee_support_requests;
drop policy if exists "Admins can update support requests" on public.employee_support_requests;
drop policy if exists "Users can create own support requests" on public.employee_support_requests;

create policy "Helpdesk owner or assigned department reads" on public.employee_support_requests
for select to authenticated using (
 user_id = (select auth.uid()) or exists (
  select 1 from public.profiles p where p.id = (select auth.uid()) and (
   (p.role = 'super_admin' and category = 'IT Concern') or
   (p.role = 'admin' and category <> 'IT Concern')
  )
 )
);
create policy "Helpdesk employees submit clean requests" on public.employee_support_requests
for insert to authenticated with check (
 user_id = (select auth.uid()) and status = 'Open' and hr_notes is null
 and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'employee')
);
create policy "Helpdesk assigned department updates active requests" on public.employee_support_requests
for update to authenticated using (
 status <> 'Resolved' and exists (
  select 1 from public.profiles p where p.id = (select auth.uid()) and (
   (p.role = 'super_admin' and category = 'IT Concern') or (p.role = 'admin' and category <> 'IT Concern')
  )
 )
) with check (
 exists (select 1 from public.profiles p where p.id = (select auth.uid()) and (
  (p.role = 'super_admin' and category = 'IT Concern') or (p.role = 'admin' and category <> 'IT Concern')
 ))
);

create or replace function public.guard_helpdesk_history() returns trigger
language plpgsql set search_path = '' as $$
begin
 if old.status = 'Resolved' then
  raise exception 'Resolved tickets are read-only.' using errcode = '23514';
 end if;
 if new.id is distinct from old.id or new.user_id is distinct from old.user_id
 or new.category is distinct from old.category or new.subject is distinct from old.subject
 or new.description is distinct from old.description or new.created_at is distinct from old.created_at then
  raise exception 'Request identity and original content cannot be changed.' using errcode = '23514';
 end if;
 return new;
end;
$$;
revoke all on function public.guard_helpdesk_history() from public, anon, authenticated;
drop trigger if exists guard_helpdesk_history on public.employee_support_requests;
create trigger guard_helpdesk_history before update on public.employee_support_requests
for each row execute function public.guard_helpdesk_history();


-- Extend the existing status domain without changing historical rows.
do $$ declare constraint_name text; begin
 for constraint_name in select conname from pg_constraint where conrelid='public.employee_support_requests'::regclass and contype='c' and pg_get_constraintdef(oid) like '%status%' loop
  execute format('alter table public.employee_support_requests drop constraint %I', constraint_name);
 end loop;
end $$;
alter table public.employee_support_requests add constraint employee_support_requests_status_check
check (status in ('Open','In Progress','Resolved','Cancelled'));

drop policy if exists "Helpdesk assigned department updates active requests" on public.employee_support_requests;
create policy "Helpdesk assigned department updates active requests" on public.employee_support_requests
for update to authenticated using (
 status in ('Open','In Progress') and exists (
  select 1 from public.profiles p where p.id=(select auth.uid()) and (
   (p.role='super_admin' and category='IT Concern') or (p.role='admin' and category<>'IT Concern')
  )
 )
) with check (
 status in ('Open','In Progress','Resolved') and exists (
  select 1 from public.profiles p where p.id=(select auth.uid()) and (
   (p.role='super_admin' and category='IT Concern') or (p.role='admin' and category<>'IT Concern')
  )
 )
);
create policy "Helpdesk employees cancel own active requests" on public.employee_support_requests
for update to authenticated using (
 user_id=(select auth.uid()) and status in ('Open','In Progress')
 and exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='employee')
) with check (
 user_id=(select auth.uid()) and status='Cancelled'
 and exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='employee')
);

create or replace function public.guard_helpdesk_history() returns trigger
language plpgsql set search_path = '' as $$
begin
 if old.status in ('Resolved','Cancelled') then
  raise exception 'Resolved and cancelled tickets are read-only.' using errcode='23514';
 end if;
 if new.id is distinct from old.id or new.user_id is distinct from old.user_id
 or new.category is distinct from old.category or new.subject is distinct from old.subject
 or new.description is distinct from old.description or new.created_at is distinct from old.created_at then
  raise exception 'Request identity and original content cannot be changed.' using errcode='23514';
 end if;
 if exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='employee') then
  if old.user_id<>auth.uid() or new.status<>'Cancelled' or new.hr_notes is distinct from old.hr_notes then
   raise exception 'Employees may only cancel their own active request.' using errcode='23514';
  end if;
 end if;
 new.updated_at := now();
 return new;
end;
$$;
revoke all on function public.guard_helpdesk_history() from public,anon,authenticated;


alter policy "Helpdesk assigned department updates active requests"
on public.employee_support_requests
with check (
 exists (
  select 1 from public.profiles p where p.id=(select auth.uid()) and (
   (p.role='admin' and category<>'IT Concern' and status in ('Open','In Progress','Resolved','Cancelled'))
   or (p.role='super_admin' and category='IT Concern' and status in ('Open','In Progress','Resolved'))
  )
 )
);
commit;
