create or replace function public.get_hr_offset_balances()
returns table(
  user_id uuid,
  full_name text,
  employee_id text,
  approved_minutes integer,
  reserved_minutes integer,
  available_minutes integer
)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('admin','super_admin')
      and p.is_active = true
  ) then
    raise exception 'Not authorized';
  end if;

  return query
  with tx as (
    select t.user_id,
      coalesce(sum(case when t.kind='earned' then (t.hours*60+t.minutes) else -(t.hours*60+t.minutes) end),0)::integer as approved
    from public.offset_transactions t
    group by t.user_id
  ), late_pending as (
    select r.user_id, coalesce(sum(r.hours*60),0)::integer as minutes
    from public.offset_usage_requests r
    where r.status='Pending'
    group by r.user_id
  ), early_pending as (
    select r.user_id, coalesce(sum(r.required_minutes),0)::integer as minutes
    from public.early_out_offset_requests r
    where r.status='Pending'
    group by r.user_id
  ), leave_pending as (
    select l.user_id, coalesce(sum(l.offset_minutes_required),0)::integer as minutes
    from public.leave_requests l
    where l.funding_source='offset' and l.status='Pending'
    group by l.user_id
  )
  select p.id,
    coalesce(p.full_name,''),
    p.employee_id,
    coalesce(tx.approved,0)::integer,
    (coalesce(late_pending.minutes,0)+coalesce(early_pending.minutes,0)+coalesce(leave_pending.minutes,0))::integer,
    greatest(0, coalesce(tx.approved,0)-coalesce(late_pending.minutes,0)-coalesce(early_pending.minutes,0)-coalesce(leave_pending.minutes,0))::integer
  from public.profiles p
  left join tx on tx.user_id=p.id
  left join late_pending on late_pending.user_id=p.id
  left join early_pending on early_pending.user_id=p.id
  left join leave_pending on leave_pending.user_id=p.id
  where p.role='employee' and p.is_active=true
  order by lower(coalesce(p.full_name,'')), p.employee_id nulls last;
end;
$function$;

revoke all on function public.get_hr_offset_balances() from public, anon;
grant execute on function public.get_hr_offset_balances() to authenticated;
