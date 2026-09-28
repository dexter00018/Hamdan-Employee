create or replace function public.apply_offset_to_late(p_attendance_log_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  rec public.attendance_logs;
  bal integer;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin','super_admin')
  ) then
    raise exception 'Not authorized';
  end if;

  select * into rec
  from public.attendance_logs
  where id = p_attendance_log_id
  for update;

  if not found then
    raise exception 'Attendance record not found';
  end if;

  if lower(coalesce(rec.status, '')) <> 'late' then
    raise exception 'Only Late attendance records can be scrubbed with offset';
  end if;

  select coalesce(sum(case when kind = 'earned' then hours else -hours end), 0)
  into bal
  from public.offset_transactions
  where user_id = rec.user_id;

  if bal < 1 then
    raise exception 'Employee does not have an approved offset hour available';
  end if;

  insert into public.offset_transactions(user_id, kind, hours, usage_date, created_by)
  values(rec.user_id, 'used', 1, rec.log_date, auth.uid());

  update public.attendance_logs
  set status = 'Offset Applied'
  where id = rec.id;

  perform public.log_audit_event(
    'offset_applied_to_late',
    'attendance_log',
    null,
    'Applied 1 approved offset hour to scrub Late attendance log #' || rec.id || ' for ' || rec.log_date::text
  );
end
$function$;

revoke all on function public.apply_offset_to_late(bigint) from public;
grant execute on function public.apply_offset_to_late(bigint) to authenticated;
