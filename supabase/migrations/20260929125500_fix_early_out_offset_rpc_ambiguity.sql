create or replace function public.record_early_out_with_offset(
  p_user_id uuid,
  p_cutoff_hour integer
)
returns table(request_id uuid, time_out timestamptz, required_minutes integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_date date := (v_now at time zone 'Asia/Manila')::date;
  v_cutoff timestamptz;
  v_log public.attendance_logs;
  v_balance_minutes integer := 0;
  v_reserved_minutes integer := 0;
  v_required_minutes integer := 0;
  v_request_id uuid;
begin
  if p_cutoff_hour < 0 or p_cutoff_hour > 23 then
    raise exception 'Invalid early-out cutoff';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = p_user_id and p.role = 'employee' and p.is_active = true
  ) then
    raise exception 'Only active employees can use Offset for Early Out';
  end if;

  v_cutoff := (v_date + make_time(p_cutoff_hour, 0, 0)) at time zone 'Asia/Manila';
  if v_now >= v_cutoff then
    raise exception 'This is no longer an Early Out';
  end if;

  select a.* into v_log
  from public.attendance_logs a
  where a.user_id = p_user_id and a.log_date = v_date
  for update;

  if not found or v_log.time_in is null then
    raise exception 'You have not timed in today';
  end if;
  if v_log.time_out is not null then
    raise exception 'You have already timed out today';
  end if;

  v_required_minutes := ceil(extract(epoch from (v_cutoff - v_now)) / 60.0)::integer;
  if v_required_minutes <= 0 then
    raise exception 'This is no longer an Early Out';
  end if;

  select coalesce(sum(
    case when t.kind = 'earned'
      then (t.hours * 60 + t.minutes)
      else -(t.hours * 60 + t.minutes)
    end
  ), 0)::integer
  into v_balance_minutes
  from public.offset_transactions t
  where t.user_id = p_user_id;

  select
    coalesce((select sum(r.hours * 60) from public.offset_usage_requests r where r.user_id = p_user_id and r.status = 'Pending'), 0)
    + coalesce((select sum(l.offset_minutes_required) from public.leave_requests l where l.user_id = p_user_id and l.status = 'Pending' and l.funding_source = 'offset'), 0)
    + coalesce((select sum(e.required_minutes) from public.early_out_offset_requests e where e.user_id = p_user_id and e.status = 'Pending'), 0)
  into v_reserved_minutes;

  if v_balance_minutes - v_reserved_minutes < v_required_minutes then
    raise exception 'Not enough unreserved approved Offset. Early Out needs % minute(s); % minute(s) available.',
      v_required_minutes, greatest(0, v_balance_minutes - v_reserved_minutes);
  end if;

  update public.attendance_logs a
  set time_out = v_now
  where a.id = v_log.id and a.time_out is null;

  if not found then
    raise exception 'You have already timed out today';
  end if;

  insert into public.early_out_offset_requests(
    user_id, attendance_log_id, required_minutes, cutoff_hour
  ) values (
    p_user_id, v_log.id, v_required_minutes, p_cutoff_hour
  ) returning id into v_request_id;

  request_id := v_request_id;
  time_out := v_now;
  required_minutes := v_required_minutes;
  return next;
end;
$$;

revoke all on function public.record_early_out_with_offset(uuid,integer) from public, anon, authenticated;
grant execute on function public.record_early_out_with_offset(uuid,integer) to service_role;
