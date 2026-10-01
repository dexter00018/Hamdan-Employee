-- Keep Offset available through the following month, so September attendance
-- can still be requested in October. Approval remains valid after submission.
create or replace function public.submit_offset_usage_request(p_attendance_log_id bigint)
returns uuid
language plpgsql
set search_path to ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_balance_minutes integer;
  v_pending_usage_minutes integer;
  v_pending_early_out_minutes integer;
  v_pending_leave_minutes integer;
  v_request_id uuid;
  v_period_start date := (date_trunc('month', (now() at time zone 'Asia/Manila')) - interval '1 month')::date;
  v_period_end date := (date_trunc('month', (now() at time zone 'Asia/Manila')) + interval '1 month - 1 day')::date;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.profiles p where p.id=v_user_id and p.role='employee' and p.is_active=true) then raise exception 'Only active employees can request offset usage'; end if;
  if not exists (select 1 from public.attendance_logs a where a.id=p_attendance_log_id and a.user_id=v_user_id and lower(coalesce(a.status,''))='late' and a.log_date between v_period_start and v_period_end) then
    raise exception 'Only Late records from the current or previous month can use offset';
  end if;
  if exists (select 1 from public.offset_usage_requests r where r.attendance_log_id=p_attendance_log_id and r.status='Pending') then raise exception 'An offset usage request is already pending for this Late record'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  select coalesce(sum(case when t.kind='earned' then (t.hours*60+t.minutes) else -(t.hours*60+t.minutes) end),0)::integer into v_balance_minutes from public.offset_transactions t where t.user_id=v_user_id;
  select coalesce(sum(r.hours*60),0)::integer into v_pending_usage_minutes from public.offset_usage_requests r where r.user_id=v_user_id and r.status='Pending';
  select coalesce(sum(r.required_minutes),0)::integer into v_pending_early_out_minutes from public.early_out_offset_requests r where r.user_id=v_user_id and r.status='Pending';
  select coalesce(sum(lr.offset_minutes_required),0)::integer into v_pending_leave_minutes from public.leave_requests lr where lr.user_id=v_user_id and lr.funding_source='offset' and lr.status='Pending';
  if v_balance_minutes-v_pending_usage_minutes-v_pending_early_out_minutes-v_pending_leave_minutes < 60 then raise exception 'You do not have an unreserved approved offset hour available'; end if;
  insert into public.offset_usage_requests(user_id,attendance_log_id,hours) values(v_user_id,p_attendance_log_id,1) returning id into v_request_id;
  return v_request_id;
end;
$function$;

drop policy if exists "Employees submit own offset usage requests" on public.offset_usage_requests;
create policy "Employees submit own offset usage requests"
on public.offset_usage_requests for insert to authenticated
with check (
  (select auth.uid()) = user_id and status = 'Pending' and reviewed_by is null and reviewed_at is null and hours = 1
  and exists (
    select 1 from public.attendance_logs a
    where a.id = offset_usage_requests.attendance_log_id
      and a.user_id = (select auth.uid())
      and lower(coalesce(a.status,'')) = 'late'
      and a.log_date between (date_trunc('month', (now() at time zone 'Asia/Manila')) - interval '1 month')::date
        and (date_trunc('month', (now() at time zone 'Asia/Manila')) + interval '1 month - 1 day')::date
  )
);

create or replace function public.submit_early_out_offset_request(p_attendance_log_id bigint)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_log public.attendance_logs;
  v_period_start date := (date_trunc('month', (clock_timestamp() at time zone 'Asia/Manila')) - interval '1 month')::date;
  v_period_end date := (date_trunc('month', (clock_timestamp() at time zone 'Asia/Manila')) + interval '1 month - 1 day')::date;
  v_cutoff_hour integer := 19;
  v_cutoff_at timestamptz;
  v_required_minutes integer := 0;
  v_balance_minutes integer := 0;
  v_reserved_minutes integer := 0;
  v_request_id uuid;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.profiles p where p.id=v_user_id and p.role='employee' and p.is_active=true) then raise exception 'Only active employees can request Early Out Offset'; end if;
  select a.* into v_log from public.attendance_logs a where a.id=p_attendance_log_id and a.user_id=v_user_id for update;
  if not found then raise exception 'Attendance record not found'; end if;
  if v_log.log_date not between v_period_start and v_period_end then raise exception 'Only Early Out records from the current or previous month can use Offset'; end if;
  if v_log.time_out is null then raise exception 'This attendance record has no Time Out'; end if;
  if coalesce(v_log.early_out_offset_minutes,0) > 0 then raise exception 'Offset is already applied to this Early Out'; end if;
  if exists (select 1 from public.early_out_offset_requests r where r.attendance_log_id=v_log.id) then raise exception 'This Early Out already has an Offset request'; end if;
  select case when jsonb_typeof(s.value)='number' then (s.value #>> '{}')::integer else 19 end into v_cutoff_hour from public.app_settings s where s.key='time_out_reminder_hour';
  v_cutoff_hour := coalesce(v_cutoff_hour,19);
  if v_cutoff_hour < 0 or v_cutoff_hour > 23 then v_cutoff_hour := 19; end if;
  v_cutoff_at := (v_log.log_date + make_time(v_cutoff_hour,0,0)) at time zone 'Asia/Manila';
  if v_log.time_out >= v_cutoff_at then raise exception 'This attendance record is not Early Out'; end if;
  v_required_minutes := ceil(extract(epoch from (v_cutoff_at-v_log.time_out))/60.0)::integer;
  if v_required_minutes <= 0 then raise exception 'This attendance record is not Early Out'; end if;
  select coalesce(sum(case when t.kind='earned' then (t.hours*60+t.minutes) else -(t.hours*60+t.minutes) end),0)::integer into v_balance_minutes from public.offset_transactions t where t.user_id=v_user_id;
  select coalesce((select sum(r.hours*60) from public.offset_usage_requests r where r.user_id=v_user_id and r.status='Pending'),0) + coalesce((select sum(l.offset_minutes_required) from public.leave_requests l where l.user_id=v_user_id and l.status='Pending' and l.funding_source='offset'),0) + coalesce((select sum(e.required_minutes) from public.early_out_offset_requests e where e.user_id=v_user_id and e.status='Pending'),0) into v_reserved_minutes;
  if v_balance_minutes-v_reserved_minutes < v_required_minutes then raise exception 'Not enough available Offset. Early Out needs % minute(s); % minute(s) available.', v_required_minutes, greatest(0,v_balance_minutes-v_reserved_minutes); end if;
  insert into public.early_out_offset_requests(user_id,attendance_log_id,required_minutes,cutoff_hour) values(v_user_id,v_log.id,v_required_minutes,v_cutoff_hour) returning id into v_request_id;
  return v_request_id;
end;
$function$;

revoke all on function public.submit_offset_usage_request(bigint) from public, anon;
grant execute on function public.submit_offset_usage_request(bigint) to authenticated;
revoke all on function public.submit_early_out_offset_request(bigint) from public, anon;
grant execute on function public.submit_early_out_offset_request(bigint) to authenticated;
