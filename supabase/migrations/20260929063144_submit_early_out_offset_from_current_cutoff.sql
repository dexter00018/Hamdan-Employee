create or replace function public.submit_early_out_offset_request(p_attendance_log_id bigint)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_log public.attendance_logs;
  v_today date := (clock_timestamp() at time zone 'Asia/Manila')::date;
  v_cutoff_start date;
  v_cutoff_end date;
  v_cutoff_hour integer := 19;
  v_cutoff_at timestamptz;
  v_required_minutes integer := 0;
  v_balance_minutes integer := 0;
  v_reserved_minutes integer := 0;
  v_request_id uuid;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.profiles p where p.id=v_user_id and p.role='employee' and p.is_active=true) then
    raise exception 'Only active employees can request Early Out Offset';
  end if;

  if extract(day from v_today) <= 15 then
    v_cutoff_start := date_trunc('month', v_today)::date;
    v_cutoff_end := v_cutoff_start + 14;
  else
    v_cutoff_start := date_trunc('month', v_today)::date + 15;
    v_cutoff_end := (date_trunc('month', v_today) + interval '1 month - 1 day')::date;
  end if;

  select a.* into v_log from public.attendance_logs a
  where a.id=p_attendance_log_id and a.user_id=v_user_id for update;
  if not found then raise exception 'Attendance record not found'; end if;
  if v_log.log_date < v_cutoff_start or v_log.log_date > v_cutoff_end then
    raise exception 'Only Early Out records from the current payroll cutoff can use Offset';
  end if;
  if v_log.time_out is null then raise exception 'This attendance record has no Time Out'; end if;
  if coalesce(v_log.early_out_offset_minutes,0) > 0 then raise exception 'Offset is already applied to this Early Out'; end if;
  if exists (select 1 from public.early_out_offset_requests r where r.attendance_log_id=v_log.id) then
    raise exception 'This Early Out already has an Offset request';
  end if;

  select case when jsonb_typeof(s.value)='number' then (s.value #>> '{}')::integer else 19 end
  into v_cutoff_hour from public.app_settings s where s.key='time_out_reminder_hour';
  v_cutoff_hour := coalesce(v_cutoff_hour,19);
  if v_cutoff_hour < 0 or v_cutoff_hour > 23 then v_cutoff_hour := 19; end if;
  v_cutoff_at := (v_log.log_date + make_time(v_cutoff_hour,0,0)) at time zone 'Asia/Manila';
  if v_log.time_out >= v_cutoff_at then raise exception 'This attendance record is not Early Out'; end if;

  v_required_minutes := ceil(extract(epoch from (v_cutoff_at-v_log.time_out))/60.0)::integer;
  if v_required_minutes <= 0 then raise exception 'This attendance record is not Early Out'; end if;

  select coalesce(sum(case when t.kind='earned' then (t.hours*60+t.minutes) else -(t.hours*60+t.minutes) end),0)::integer
  into v_balance_minutes from public.offset_transactions t where t.user_id=v_user_id;

  select
    coalesce((select sum(r.hours*60) from public.offset_usage_requests r where r.user_id=v_user_id and r.status='Pending'),0)
    + coalesce((select sum(l.offset_minutes_required) from public.leave_requests l where l.user_id=v_user_id and l.status='Pending' and l.funding_source='offset'),0)
    + coalesce((select sum(e.required_minutes) from public.early_out_offset_requests e where e.user_id=v_user_id and e.status='Pending'),0)
  into v_reserved_minutes;

  if v_balance_minutes-v_reserved_minutes < v_required_minutes then
    raise exception 'Not enough available Offset. Early Out needs % minute(s); % minute(s) available.', v_required_minutes, greatest(0,v_balance_minutes-v_reserved_minutes);
  end if;

  insert into public.early_out_offset_requests(user_id,attendance_log_id,required_minutes,cutoff_hour)
  values(v_user_id,v_log.id,v_required_minutes,v_cutoff_hour)
  returning id into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.submit_early_out_offset_request(bigint) from public, anon;
grant execute on function public.submit_early_out_offset_request(bigint) to authenticated;

create or replace function public.review_early_out_offset_request(p_request_id uuid,p_approve boolean,p_notes text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.early_out_offset_requests;
  v_log public.attendance_logs;
  v_balance_minutes integer := 0;
  v_other_reserved_minutes integer := 0;
  v_hours integer;
  v_minutes integer;
  v_today date := (clock_timestamp() at time zone 'Asia/Manila')::date;
  v_cutoff_start date;
  v_cutoff_end date;
begin
  if not exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','super_admin')) then
    raise exception 'Not authorized';
  end if;

  select r.* into v_request from public.early_out_offset_requests r where r.id=p_request_id for update;
  if not found or v_request.status<>'Pending' then raise exception 'Early Out Offset request is not pending'; end if;

  select a.* into v_log from public.attendance_logs a where a.id=v_request.attendance_log_id for update;
  if not found or v_log.user_id<>v_request.user_id or v_log.time_out is null then
    raise exception 'Early Out attendance record is no longer eligible';
  end if;

  if extract(day from v_today) <= 15 then
    v_cutoff_start := date_trunc('month',v_today)::date;
    v_cutoff_end := v_cutoff_start+14;
  else
    v_cutoff_start := date_trunc('month',v_today)::date+15;
    v_cutoff_end := (date_trunc('month',v_today)+interval '1 month - 1 day')::date;
  end if;

  if v_log.log_date < v_cutoff_start or v_log.log_date > v_cutoff_end then
    raise exception 'This Early Out belongs to a closed payroll cutoff';
  end if;

  if not p_approve then
    update public.early_out_offset_requests set status='Rejected',reviewed_by=(select auth.uid()),reviewed_at=now(),hr_notes=p_notes where id=v_request.id;
    perform public.log_audit_event('early_out_offset_rejected','attendance_log',null,'Rejected Early Out Offset request for attendance log #'||v_request.attendance_log_id::text);
    return;
  end if;

  select coalesce(sum(case when t.kind='earned' then (t.hours*60+t.minutes) else -(t.hours*60+t.minutes) end),0)::integer
  into v_balance_minutes from public.offset_transactions t where t.user_id=v_request.user_id;

  select
    coalesce((select sum(r.hours*60) from public.offset_usage_requests r where r.user_id=v_request.user_id and r.status='Pending'),0)
    + coalesce((select sum(l.offset_minutes_required) from public.leave_requests l where l.user_id=v_request.user_id and l.status='Pending' and l.funding_source='offset'),0)
    + coalesce((select sum(e.required_minutes) from public.early_out_offset_requests e where e.user_id=v_request.user_id and e.status='Pending' and e.id<>v_request.id),0)
  into v_other_reserved_minutes;

  if v_balance_minutes-v_other_reserved_minutes < v_request.required_minutes then
    raise exception 'Employee no longer has enough unreserved approved Offset balance';
  end if;

  v_hours := v_request.required_minutes/60;
  v_minutes := v_request.required_minutes%60;
  insert into public.offset_transactions(user_id,kind,hours,minutes,usage_date,created_by,source,note)
  values(v_request.user_id,'used',v_hours,v_minutes,v_log.log_date,(select auth.uid()),'system','Early Out Offset approved');

  update public.attendance_logs set early_out_offset_minutes=v_request.required_minutes where id=v_log.id;
  update public.early_out_offset_requests set status='Approved',reviewed_by=(select auth.uid()),reviewed_at=now(),hr_notes=p_notes where id=v_request.id;
  perform public.log_audit_event('early_out_offset_approved','attendance_log',null,'Applied '||v_request.required_minutes::text||' Offset minute(s) to Early Out attendance log #'||v_request.attendance_log_id::text);
end;
$$;

revoke all on function public.review_early_out_offset_request(uuid,boolean,text) from public, anon;
grant execute on function public.review_early_out_offset_request(uuid,boolean,text) to authenticated;
