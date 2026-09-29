create or replace function public.submit_offset_usage_request(p_attendance_log_id bigint)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_balance_minutes integer;
  v_pending_usage_minutes integer;
  v_pending_leave_minutes integer;
  v_request_id uuid;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.profiles p where p.id=v_user_id and p.role='employee' and p.is_active=true) then
    raise exception 'Only active employees can request offset usage';
  end if;
  if not exists (select 1 from public.attendance_logs a where a.id=p_attendance_log_id and a.user_id=v_user_id and lower(coalesce(a.status,''))='late') then
    raise exception 'Only your own Late attendance record can use offset';
  end if;
  if exists (select 1 from public.offset_usage_requests r where r.attendance_log_id=p_attendance_log_id and r.status='Pending') then
    raise exception 'An offset usage request is already pending for this Late record';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select coalesce(sum(case when t.kind='earned' then (t.hours*60+t.minutes) else -(t.hours*60+t.minutes) end),0)::integer
    into v_balance_minutes
  from public.offset_transactions t
  where t.user_id=v_user_id;

  select coalesce(sum(r.hours*60),0)::integer
    into v_pending_usage_minutes
  from public.offset_usage_requests r
  where r.user_id=v_user_id and r.status='Pending';

  select coalesce(sum(lr.offset_minutes_required),0)::integer
    into v_pending_leave_minutes
  from public.leave_requests lr
  where lr.user_id=v_user_id and lr.funding_source='offset' and lr.status='Pending';

  if v_balance_minutes-v_pending_usage_minutes-v_pending_leave_minutes < 60 then
    raise exception 'You do not have an unreserved approved offset hour available';
  end if;

  insert into public.offset_usage_requests(user_id,attendance_log_id,hours)
  values(v_user_id,p_attendance_log_id,1)
  returning id into v_request_id;
  return v_request_id;
end;
$$;

revoke all on function public.submit_offset_usage_request(bigint) from public,anon;
grant execute on function public.submit_offset_usage_request(bigint) to authenticated;

create or replace function public.convert_offset_to_paid_leave(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance_minutes integer;
  v_pending_usage_minutes integer;
  v_pending_leave_minutes integer;
  v_year integer := extract(year from now() at time zone 'Asia/Manila');
begin
  if not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','super_admin')) then
    raise exception 'Not authorized';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select coalesce(sum(case when t.kind='earned' then (t.hours*60+t.minutes) else -(t.hours*60+t.minutes) end),0)::integer
    into v_balance_minutes
  from public.offset_transactions t
  where t.user_id=p_user_id;

  select coalesce(sum(r.hours*60),0)::integer
    into v_pending_usage_minutes
  from public.offset_usage_requests r
  where r.user_id=p_user_id and r.status='Pending';

  select coalesce(sum(lr.offset_minutes_required),0)::integer
    into v_pending_leave_minutes
  from public.leave_requests lr
  where lr.user_id=p_user_id and lr.funding_source='offset' and lr.status='Pending';

  if v_balance_minutes-v_pending_usage_minutes-v_pending_leave_minutes < 540 then
    raise exception 'At least 9 unreserved approved offset hours are required';
  end if;

  insert into public.offset_transactions(user_id,kind,hours,minutes,created_by,source,note)
  values(p_user_id,'converted',9,0,(select auth.uid()),'system','Converted 9 approved offset hours to one paid leave credit');

  insert into public.leave_credits(user_id,year,total_credits,used_credits)
  values(p_user_id,v_year,1,0)
  on conflict(user_id,year) do update set total_credits=public.leave_credits.total_credits+1;
end;
$$;

revoke all on function public.convert_offset_to_paid_leave(uuid) from public,anon;
grant execute on function public.convert_offset_to_paid_leave(uuid) to authenticated;
