-- Restrict Late Offset usage to the active payroll cutoff (1-15 / 16-end).
-- Also include pending Early Out reservations when calculating available Offset.

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
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_cutoff_start date;
  v_cutoff_end date;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.profiles p where p.id=v_user_id and p.role='employee' and p.is_active=true) then
    raise exception 'Only active employees can request offset usage';
  end if;

  v_cutoff_start := case
    when extract(day from v_today) <= 15 then date_trunc('month', v_today)::date
    else (date_trunc('month', v_today) + interval '15 days')::date
  end;
  v_cutoff_end := case
    when extract(day from v_today) <= 15 then (date_trunc('month', v_today) + interval '14 days')::date
    else (date_trunc('month', v_today) + interval '1 month - 1 day')::date
  end;

  if not exists (
    select 1 from public.attendance_logs a
    where a.id=p_attendance_log_id
      and a.user_id=v_user_id
      and lower(coalesce(a.status,''))='late'
      and a.log_date between v_cutoff_start and v_cutoff_end
  ) then
    raise exception 'Only Late records from the current payroll cutoff can use offset';
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

  select coalesce(sum(r.required_minutes),0)::integer
    into v_pending_early_out_minutes
  from public.early_out_offset_requests r
  where r.user_id=v_user_id and r.status='Pending';

  select coalesce(sum(lr.offset_minutes_required),0)::integer
    into v_pending_leave_minutes
  from public.leave_requests lr
  where lr.user_id=v_user_id and lr.funding_source='offset' and lr.status='Pending';

  if v_balance_minutes-v_pending_usage_minutes-v_pending_early_out_minutes-v_pending_leave_minutes < 60 then
    raise exception 'You do not have an unreserved approved offset hour available';
  end if;

  insert into public.offset_usage_requests(user_id,attendance_log_id,hours)
  values(v_user_id,p_attendance_log_id,1)
  returning id into v_request_id;
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
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_cutoff_start date;
  v_cutoff_end date;
begin
  if not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','super_admin')) then raise exception 'Not authorized'; end if;

  v_cutoff_start := case
    when extract(day from v_today) <= 15 then date_trunc('month', v_today)::date
    else (date_trunc('month', v_today) + interval '15 days')::date
  end;
  v_cutoff_end := case
    when extract(day from v_today) <= 15 then (date_trunc('month', v_today) + interval '14 days')::date
    else (date_trunc('month', v_today) + interval '1 month - 1 day')::date
  end;

  select * into v_request from public.offset_usage_requests where id=p_request_id for update;
  if not found or v_request.status <> 'Pending' then raise exception 'Offset usage request is not pending'; end if;

  if not p_approve then
    update public.offset_usage_requests set status='Rejected',reviewed_by=(select auth.uid()),reviewed_at=now(),hr_notes=p_notes where id=v_request.id;
    return;
  end if;

  select * into v_log from public.attendance_logs where id=v_request.attendance_log_id for update;
  if not found or v_log.user_id<>v_request.user_id or lower(coalesce(v_log.status,''))<>'late' then raise exception 'Late attendance record is no longer eligible'; end if;
  if v_log.log_date not between v_cutoff_start and v_cutoff_end then raise exception 'This Late record belongs to a closed payroll cutoff'; end if;

  select coalesce(sum(case when t.kind='earned' then (t.hours*60+t.minutes) else -(t.hours*60+t.minutes) end),0)::integer
    into v_balance_minutes from public.offset_transactions t where t.user_id=v_request.user_id;
  if v_balance_minutes < (v_request.hours*60) then raise exception 'Employee no longer has enough approved offset balance'; end if;

  insert into public.offset_transactions(user_id,kind,hours,minutes,usage_date,created_by)
  values(v_request.user_id,'used',v_request.hours,0,v_log.log_date,(select auth.uid()));
  update public.attendance_logs set status='Offset Applied' where id=v_log.id;
  update public.offset_usage_requests set status='Approved',reviewed_by=(select auth.uid()),reviewed_at=now(),hr_notes=p_notes where id=v_request.id;
end;
$function$;

alter policy "Employees submit own offset usage requests"
on public.offset_usage_requests
with check (
  (select auth.uid()) = user_id
  and status = 'Pending'
  and reviewed_by is null
  and reviewed_at is null
  and hours = 1
  and exists (
    select 1
    from public.attendance_logs a
    where a.id = offset_usage_requests.attendance_log_id
      and a.user_id = (select auth.uid())
      and lower(coalesce(a.status,'')) = 'late'
      and a.log_date between
        case
          when extract(day from ((now() at time zone 'Asia/Manila')::date)) <= 15
            then date_trunc('month', (now() at time zone 'Asia/Manila')::date)::date
          else (date_trunc('month', (now() at time zone 'Asia/Manila')::date) + interval '15 days')::date
        end
        and
        case
          when extract(day from ((now() at time zone 'Asia/Manila')::date)) <= 15
            then (date_trunc('month', (now() at time zone 'Asia/Manila')::date) + interval '14 days')::date
          else (date_trunc('month', (now() at time zone 'Asia/Manila')::date) + interval '1 month - 1 day')::date
        end
  )
);
