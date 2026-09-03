-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Revoking
-- only from anon leaves that inherited PUBLIC privilege in place, so remove
-- both paths and explicitly restore access for signed-in application users.
revoke execute on function public.generate_leave_request_days(uuid) from public, anon;
grant execute on function public.generate_leave_request_days(uuid) to authenticated;
