-- HR may cancel an approved leave.  This is intentionally an RPC so all
-- related leave-day, credit, and offset changes remain atomic.
create or replace function public.cancel_approved_leave_as_hr(p_leave_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_request public.leave_requests;
  v_deducted_days integer := 0;
  v_refund_minutes integer := 0;
  v_year integer;
  v_is_regular boolean := false;
  v_leave_status text;
begin
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_actor_id
      and p.is_active = true
      and lower(coalesce(p.role, '')) in ('hr', 'admin', 'super_admin')
  ) then
    raise exception 'Only HR administrators can cancel approved leave';
  end if;

  select * into v_request
  from public.leave_requests lr
  where lr.id = p_leave_request_id
  for update;

  if not found or v_request.status <> 'Approved' then
    raise exception 'Only approved leave requests can be cancelled';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_request.user_id::text, 0));

  select count(*)::integer into v_deducted_days
  from public.leave_request_days lrd
  where lrd.leave_request_id = v_request.id
    and lrd.status = 'Deducted';

  if v_request.funding_source = 'leave_credit' and v_deducted_days > 0 then
    select exists (
      select 1
      from public.employee_government_ids egi
      where egi.user_id = v_request.user_id
        and egi.employment_status = 'Regular'
    ) into v_is_regular;

    if v_is_regular then
      v_year := extract(year from v_request.start_date)::integer;
      update public.leave_credits lc
      set used_credits = greatest(0, lc.used_credits - v_deducted_days)
      where lc.user_id = v_request.user_id
        and lc.year = v_year;
    end if;
  end if;

  if v_request.funding_source = 'offset'
     and v_request.offset_charged_at is not null
     and v_request.offset_refunded_at is null then
    v_refund_minutes := coalesce(v_request.offset_minutes_required, 540);
    insert into public.offset_transactions(
      user_id, kind, hours, minutes, usage_date, created_by, source, note, leave_request_id
    ) values (
      v_request.user_id,
      'earned',
      v_refund_minutes / 60,
      mod(v_refund_minutes, 60),
      v_request.start_date,
      v_actor_id,
      'offset_leave_refund',
      'Offset refunded after HR cancelled approved leave',
      v_request.id
    );
  end if;

  v_leave_status := coalesce(initcap(v_request.leave_type), 'Leave') || ' Leave';
  delete from public.attendance_logs al
  using public.leave_request_days lrd
  where lrd.leave_request_id = v_request.id
    and al.user_id = v_request.user_id
    and al.log_date = lrd.leave_date
    and al.time_in is null
    and al.time_out is null
    and al.status = v_leave_status;

  delete from public.leave_request_days
  where leave_request_id = v_request.id;

  update public.leave_requests
  set status = 'Cancelled',
      reviewed_by = v_actor_id,
      reviewed_at = now(),
      offset_refunded_at = case when v_refund_minutes > 0 then now() else offset_refunded_at end
  where id = v_request.id;
end;
$$;

revoke all on function public.cancel_approved_leave_as_hr(uuid) from public, anon;
grant execute on function public.cancel_approved_leave_as_hr(uuid) to authenticated;
