-- Employees must be able to withdraw their own pending attendance disputes.
--
-- The client already calls supabase.rpc('cancel_my_attendance_dispute', ...)
-- (app/employee/page.tsx cancelDispute), but no function was ever created:
-- every dispute cancel attempt has been failing at runtime with
-- "Could not find the function public.cancel_my_attendance_dispute".
--
-- RLS grants employees no DELETE policy on attendance_disputes (by design --
-- deletion is only valid while the row is still Pending), so this
-- SECURITY DEFINER function performs the delete with explicit
-- ownership and status checks inside.
create or replace function public.cancel_my_attendance_dispute(p_dispute_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  delete from public.attendance_disputes
  where id = p_dispute_id
    and user_id = auth.uid()
    and status = 'Pending';

  if not found then
    raise exception 'Dispute not found, not yours, or no longer pending.';
  end if;
end;
$function$;

revoke all on function public.cancel_my_attendance_dispute(uuid) from public, anon;
grant execute on function public.cancel_my_attendance_dispute(uuid) to authenticated;
