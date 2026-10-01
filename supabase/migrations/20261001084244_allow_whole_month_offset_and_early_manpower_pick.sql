-- Use Offset against any eligible Late or Early Out record in the current
-- calendar month, rather than one half of the payroll month.
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
  v_month_start date := date_trunc('month', (now() at time zone 'Asia/Manila'))::date;
  v_month_end date := (date_trunc('month', (now() at time zone 'Asia/Manila')) + interval '1 month - 1 day')::date;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.profiles p where p.id=v_user_id and p.role='employee' and p.is_active=true) then
    raise exception 'Only active employees can request offset usage';
  end if;
  if not exists (
    select 1 from public.attendance_logs a
    where a.id=p_attendance_log_id and a.user_id=v_user_id
      and lower(coalesce(a.status,''))='late'
      and a.log_date between v_month_start and v_month_end
  ) then
    raise exception 'Only Late records from the current month can use offset';
  end if;
  if exists (select 1 from public.offset_usage_requests r where r.attendance_log_id=p_attendance_log_id and r.status='Pending') then
    raise exception 'An offset usage request is already pending for this Late record';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  select coalesce(sum(case when t.kind='earned' then (t.hours*60+t.minutes) else -(t.hours*60+t.minutes) end),0)::integer into v_balance_minutes from public.offset_transactions t where t.user_id=v_user_id;
  select coalesce(sum(r.hours*60),0)::integer into v_pending_usage_minutes from public.offset_usage_requests r where r.user_id=v_user_id and r.status='Pending';
  select coalesce(sum(r.required_minutes),0)::integer into v_pending_early_out_minutes from public.early_out_offset_requests r where r.user_id=v_user_id and r.status='Pending';
  select coalesce(sum(lr.offset_minutes_required),0)::integer into v_pending_leave_minutes from public.leave_requests lr where lr.user_id=v_user_id and lr.funding_source='offset' and lr.status='Pending';
  if v_balance_minutes-v_pending_usage_minutes-v_pending_early_out_minutes-v_pending_leave_minutes < 60 then
    raise exception 'You do not have an unreserved approved offset hour available';
  end if;
  insert into public.offset_usage_requests(user_id,attendance_log_id,hours) values(v_user_id,p_attendance_log_id,1) returning id into v_request_id;
  return v_request_id;
end;
$function$;

create or replace function public.review_offset_usage_request(p_request_id uuid, p_approve boolean, p_notes text default null::text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_request public.offset_usage_requests;
  v_log public.attendance_logs;
  v_balance_minutes integer;
begin
  if not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','super_admin')) then raise exception 'Not authorized'; end if;
  select * into v_request from public.offset_usage_requests where id=p_request_id for update;
  if not found or v_request.status <> 'Pending' then raise exception 'Offset usage request is not pending'; end if;
  if not p_approve then
    update public.offset_usage_requests set status='Rejected',reviewed_by=(select auth.uid()),reviewed_at=now(),hr_notes=p_notes where id=v_request.id;
    return;
  end if;
  select * into v_log from public.attendance_logs where id=v_request.attendance_log_id for update;
  if not found or v_log.user_id<>v_request.user_id or lower(coalesce(v_log.status,''))<>'late' then raise exception 'Late attendance record is no longer eligible'; end if;
  select coalesce(sum(case when t.kind='earned' then (t.hours*60+t.minutes) else -(t.hours*60+t.minutes) end),0)::integer into v_balance_minutes from public.offset_transactions t where t.user_id=v_request.user_id;
  if v_balance_minutes < (v_request.hours*60) then raise exception 'Employee no longer has enough approved offset balance'; end if;
  insert into public.offset_transactions(user_id,kind,hours,minutes,usage_date,created_by) values(v_request.user_id,'used',v_request.hours,0,v_log.log_date,(select auth.uid()));
  update public.attendance_logs set status='Offset Applied' where id=v_log.id;
  update public.offset_usage_requests set status='Approved',reviewed_by=(select auth.uid()),reviewed_at=now(),hr_notes=p_notes where id=v_request.id;
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
      and a.log_date between date_trunc('month', (now() at time zone 'Asia/Manila'))::date
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
  v_month_start date := date_trunc('month', (clock_timestamp() at time zone 'Asia/Manila'))::date;
  v_month_end date := (date_trunc('month', (clock_timestamp() at time zone 'Asia/Manila')) + interval '1 month - 1 day')::date;
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
  if v_log.log_date not between v_month_start and v_month_end then raise exception 'Only Early Out records from the current month can use Offset'; end if;
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

create or replace function public.review_early_out_offset_request(p_request_id uuid,p_approve boolean,p_notes text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request public.early_out_offset_requests;
  v_log public.attendance_logs;
  v_balance_minutes integer := 0;
  v_other_reserved_minutes integer := 0;
  v_hours integer;
  v_minutes integer;
begin
  if not exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','super_admin')) then raise exception 'Not authorized'; end if;
  select r.* into v_request from public.early_out_offset_requests r where r.id=p_request_id for update;
  if not found or v_request.status<>'Pending' then raise exception 'Early Out Offset request is not pending'; end if;
  select a.* into v_log from public.attendance_logs a where a.id=v_request.attendance_log_id for update;
  if not found or v_log.user_id<>v_request.user_id or v_log.time_out is null then raise exception 'Early Out attendance record is no longer eligible'; end if;
  if not p_approve then
    update public.early_out_offset_requests set status='Rejected',reviewed_by=(select auth.uid()),reviewed_at=now(),hr_notes=p_notes where id=v_request.id;
    perform public.log_audit_event('early_out_offset_rejected','attendance_log',null,'Rejected Early Out Offset request for attendance log #'||v_request.attendance_log_id::text);
    return;
  end if;
  select coalesce(sum(case when t.kind='earned' then (t.hours*60+t.minutes) else -(t.hours*60+t.minutes) end),0)::integer into v_balance_minutes from public.offset_transactions t where t.user_id=v_request.user_id;
  select coalesce((select sum(r.hours*60) from public.offset_usage_requests r where r.user_id=v_request.user_id and r.status='Pending'),0) + coalesce((select sum(l.offset_minutes_required) from public.leave_requests l where l.user_id=v_request.user_id and l.status='Pending' and l.funding_source='offset'),0) + coalesce((select sum(e.required_minutes) from public.early_out_offset_requests e where e.user_id=v_request.user_id and e.status='Pending' and e.id<>v_request.id),0) into v_other_reserved_minutes;
  if v_balance_minutes-v_other_reserved_minutes < v_request.required_minutes then raise exception 'Employee no longer has enough unreserved approved Offset balance'; end if;
  v_hours := v_request.required_minutes/60; v_minutes := v_request.required_minutes%60;
  insert into public.offset_transactions(user_id,kind,hours,minutes,usage_date,created_by,source,note) values(v_request.user_id,'used',v_hours,v_minutes,v_log.log_date,(select auth.uid()),'system','Early Out Offset approved');
  update public.attendance_logs set early_out_offset_minutes=v_request.required_minutes where id=v_log.id;
  update public.early_out_offset_requests set status='Approved',reviewed_by=(select auth.uid()),reviewed_at=now(),hr_notes=p_notes where id=v_request.id;
  perform public.log_audit_event('early_out_offset_approved','attendance_log',null,'Applied '||v_request.required_minutes::text||' Offset minute(s) to Early Out attendance log #'||v_request.attendance_log_id::text);
end;
$function$;

-- A pre-selected project stores a future 9:00 AM start. It records no time
-- before then, and changing the selection before 9:00 AM replaces it.
create or replace function public.switch_manpower_project(p_project_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_active_id uuid;
  v_active_project uuid;
  v_active_started_at timestamptz;
  v_new_id uuid;
  v_now timestamptz := now();
  v_today date := (v_now at time zone 'Asia/Manila')::date;
  v_local_time time := (v_now at time zone 'Asia/Manila')::time;
  v_tracking_start timestamptz := ((v_now at time zone 'Asia/Manila')::date + time '09:00') at time zone 'Asia/Manila';
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.profiles p where p.id=v_user_id and p.role='employee' and p.is_active=true) then raise exception 'Only active employees can track manpower time'; end if;
  if exists (select 1 from public.profiles p where p.id=v_user_id and upper(trim(coalesce(p.designation,''))) in ('IT MANAGER','HR MANAGER')) then raise exception 'Manpower Tracker is not assigned to your designation'; end if;
  if not exists (select 1 from public.attendance_logs a where a.user_id=v_user_id and a.log_date=v_today and a.time_in is not null and a.time_out is null) then raise exception 'Manpower Tracker is only available during your active attendance shift'; end if;
  if v_local_time >= time '12:00' and v_local_time < time '13:00' then raise exception 'Manpower Tracker is paused for lunch from 12:00 PM to 1:00 PM'; end if;
  if not exists (select 1 from public.manpower_projects mp where mp.id=p_project_id and mp.is_active=true) then raise exception 'Project is not available'; end if;
  select ms.id, ms.project_id, ms.started_at into v_active_id, v_active_project, v_active_started_at from public.manpower_sessions ms where ms.user_id=v_user_id and ms.ended_at is null order by ms.started_at desc limit 1 for update;
  if v_active_id is not null and v_active_project = p_project_id then return v_active_id; end if;
  if v_active_id is not null and v_active_started_at > v_now then
    update public.manpower_sessions set project_id=p_project_id where id=v_active_id;
    return v_active_id;
  end if;
  if v_active_id is not null then update public.manpower_sessions set ended_at=v_now where id=v_active_id; end if;
  insert into public.manpower_sessions(user_id,project_id,started_at) values(v_user_id,p_project_id,case when v_local_time < time '09:00' then v_tracking_start else v_now end) returning id into v_new_id;
  return v_new_id;
end;
$function$;

create or replace function public.stop_manpower_tracking()
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare v_user_id uuid := (select auth.uid()); v_now timestamptz := now();
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.profiles p where p.id=v_user_id and p.role='employee' and p.is_active=true) then raise exception 'Only active employees can stop manpower tracking'; end if;
  delete from public.manpower_sessions where user_id=v_user_id and ended_at is null and started_at > v_now;
  update public.manpower_sessions set ended_at=v_now where user_id=v_user_id and ended_at is null and started_at <= v_now;
end;
$function$;

create or replace function public.close_manpower_session_on_timeout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.time_out is null and new.time_out is not null then
    delete from public.manpower_sessions where user_id=new.user_id and ended_at is null and started_at > new.time_out;
    update public.manpower_sessions set ended_at=new.time_out where user_id=new.user_id and ended_at is null and started_at <= new.time_out;
  end if;
  return new;
end;
$function$;

revoke all on function public.submit_offset_usage_request(bigint) from public, anon;
grant execute on function public.submit_offset_usage_request(bigint) to authenticated;
revoke all on function public.submit_early_out_offset_request(bigint) from public, anon;
grant execute on function public.submit_early_out_offset_request(bigint) to authenticated;
revoke all on function public.review_offset_usage_request(uuid,boolean,text) from public, anon;
grant execute on function public.review_offset_usage_request(uuid,boolean,text) to authenticated;
revoke all on function public.review_early_out_offset_request(uuid,boolean,text) from public, anon;
grant execute on function public.review_early_out_offset_request(uuid,boolean,text) to authenticated;
revoke all on function public.switch_manpower_project(uuid) from public, anon;
grant execute on function public.switch_manpower_project(uuid) to authenticated;
revoke all on function public.stop_manpower_tracking() from public, anon;
grant execute on function public.stop_manpower_tracking() to authenticated;
