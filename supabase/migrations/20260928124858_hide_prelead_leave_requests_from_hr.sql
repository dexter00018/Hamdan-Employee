drop policy if exists "View own admin or assigned lead leave requests" on public.leave_requests;
create policy "View routed leave requests"
on public.leave_requests for select to authenticated
using (
  (select auth.uid()) = user_id
  or (select auth.uid()) = lead_approver_id
  or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and lead_approval_status in ('Not Required','Approved')
  )
  or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'super_admin'
  )
);
