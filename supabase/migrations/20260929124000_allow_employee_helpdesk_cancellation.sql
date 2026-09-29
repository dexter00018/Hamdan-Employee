begin;

alter table public.employee_support_requests
  drop constraint if exists employee_support_requests_status_check;

alter table public.employee_support_requests
  add constraint employee_support_requests_status_check
  check (status in ('Submitted','In Progress','Resolved','Cancelled'));

drop policy if exists "Employees cancel own support requests" on public.employee_support_requests;
create policy "Employees cancel own support requests"
on public.employee_support_requests
for update
to authenticated
using (
  user_id = (select auth.uid())
  and status in ('Submitted','In Progress')
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'employee'
  )
)
with check (
  user_id = (select auth.uid())
  and status = 'Cancelled'
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'employee'
  )
);

commit;
