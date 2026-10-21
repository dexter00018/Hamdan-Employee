-- Tighten the leave_requests INSERT policy.
--
-- The previous check (auth.uid() = user_id) let any employee file a leave
-- row that was already Approved -- even backdated -- which the absence
-- sweep and payroll views would then honor without HR ever approving it.
-- The UI never files anything except a Pending request with empty review
-- fields (app/employee/page.tsx and OffsetLeaveRequestBridge.tsx are the
-- only two insert call sites), so this pin the policy to exactly that
-- shape. Reviewing admins approve through UPDATE, not INSERT; n8n and
-- server routes use the service role, which bypasses RLS entirely.
drop policy if exists "Employees can file leave" on public.leave_requests;

create policy "Employees can file pending leave"
  on public.leave_requests for insert to authenticated
  with check (
    auth.uid() = user_id
    and status = 'Pending'
    and hr_notes is null
    and reviewed_by is null
    and reviewed_at is null
    and lead_reviewed_at is null
    and lead_notes is null
    and offset_charged_at is null
    and offset_refunded_at is null
  );
