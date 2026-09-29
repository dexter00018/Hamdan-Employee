alter table public.leave_requests
  add column if not exists funding_source text not null default 'leave_credit',
  add column if not exists offset_minutes_required integer not null default 0,
  add column if not exists offset_charged_at timestamptz,
  add column if not exists offset_refunded_at timestamptz;

alter table public.leave_requests drop constraint if exists leave_requests_funding_source_check;
alter table public.leave_requests add constraint leave_requests_funding_source_check
  check (funding_source in ('leave_credit','offset'));

alter table public.leave_requests drop constraint if exists leave_requests_offset_minutes_required_check;
alter table public.leave_requests add constraint leave_requests_offset_minutes_required_check
  check ((funding_source='leave_credit' and offset_minutes_required=0) or (funding_source='offset' and offset_minutes_required=540));

alter table public.leave_requests drop constraint if exists leave_requests_status_check;
alter table public.leave_requests add constraint leave_requests_status_check
  check (status in ('Pending','Approved','Rejected','Cancelled'));

create index if not exists leave_requests_user_funding_status_idx
  on public.leave_requests(user_id,funding_source,status);

alter table public.offset_transactions
  add column if not exists leave_request_id uuid references public.leave_requests(id) on delete set null;

alter table public.offset_transactions drop constraint if exists offset_transactions_source_check;
alter table public.offset_transactions add constraint offset_transactions_source_check
  check (source in ('system','manual_adjustment','offset_leave_charge','offset_leave_refund'));

create index if not exists offset_transactions_leave_request_idx
  on public.offset_transactions(leave_request_id)
  where leave_request_id is not null;

create unique index if not exists offset_transactions_leave_source_unique_idx
  on public.offset_transactions(leave_request_id,source)
  where leave_request_id is not null and source in ('offset_leave_charge','offset_leave_refund');

create or replace function public.validate_offset_leave_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance_minutes integer;
  v_pending_usage_minutes integer;
  v_pending_leave_minutes integer;
begin
  if new.funding_source <> 'offset' then
    new.offset_minutes_required := 0;
    new.offset_charged_at := null;
    new.offset_refunded_at := null;
    return new;
  end if;

  if (select auth.uid()) is null or new.user_id <> (select auth.uid()) then
    raise exception 'Offset-funded leave can only be filed by the employee';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id=new.user_id and p.role='employee' and p.is_active=true
  ) then
    raise exception 'Only active employees can file offset-funded leave';
  end if;

  if new.start_date <> new.end_date then
    raise exception 'Leave Using Offset is limited to one working day per request';
  end if;

  if extract(dow from new.start_date) in (0,6)
     or exists(select 1 from public.holidays h where h.holiday_date=new.start_date) then
    raise exception 'Leave Using Offset must be filed for a chargeable working day';
  end if;

  if exists (
    select 1 from public.leave_requests lr
    where lr.user_id=new.user_id
      and lr.status in ('Pending','Approved')
      and lr.start_date <= new.start_date
      and lr.end_date >= new.start_date
  ) then
    raise exception 'You already have an active leave request covering this date';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

  select coalesce(sum(case when t.kind='earned' then (t.hours*60+t.minutes) else -(t.hours*60+t.minutes) end),0)::integer
    into v_balance_minutes
  from public.offset_transactions t
  where t.user_id=new.user_id;

  select coalesce(sum(r.hours*60),0)::integer
    into v_pending_usage_minutes
  from public.offset_usage_requests r
  where r.user_id=new.user_id and r.status='Pending';

  select coalesce(sum(lr.offset_minutes_required),0)::integer
    into v_pending_leave_minutes
  from public.leave_requests lr
  where lr.user_id=new.user_id
    and lr.funding_source='offset'
    and lr.status='Pending';

  if v_balance_minutes - v_pending_usage_minutes - v_pending_leave_minutes < 540 then
    raise exception 'At least 9 unreserved approved offset hours are required';
  end if;

  new.offset_minutes_required := 540;
  new.offset_charged_at := null;
  new.offset_refunded_at := null;
  return new;
end;
$$;

revoke all on function public.validate_offset_leave_insert() from public,anon,authenticated;

drop trigger if exists validate_offset_leave_insert on public.leave_requests;
create trigger validate_offset_leave_insert
before insert on public.leave_requests
for each row execute function public.validate_offset_leave_insert();

create or replace function public.charge_offset_leave_on_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance_minutes integer;
begin
  if new.funding_source='offset'
     and new.status='Approved'
     and old.status is distinct from 'Approved'
     and new.offset_charged_at is null then

    perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

    select coalesce(sum(case when t.kind='earned' then (t.hours*60+t.minutes) else -(t.hours*60+t.minutes) end),0)::integer
      into v_balance_minutes
    from public.offset_transactions t
    where t.user_id=new.user_id;

    if v_balance_minutes < 540 then
      raise exception 'Employee no longer has 9 approved offset hours available';
    end if;

    insert into public.offset_transactions(
      user_id,kind,hours,minutes,usage_date,created_by,source,note,leave_request_id
    ) values (
      new.user_id,'used',9,0,new.start_date,(select auth.uid()),'offset_leave_charge',
      '9 hours charged for approved offset-funded leave',new.id
    );

    new.offset_charged_at := now();
    new.offset_refunded_at := null;
  end if;

  return new;
end;
$$;

revoke all on function public.charge_offset_leave_on_approval() from public,anon,authenticated;

drop trigger if exists charge_offset_leave_on_approval on public.leave_requests;
create trigger charge_offset_leave_on_approval
before update of status on public.leave_requests
for each row execute function public.charge_offset_leave_on_approval();

create or replace function public.cancel_my_offset_leave(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_request public.leave_requests;
  v_cancel_allowed boolean := true;
  v_lead_hours integer := 24;
  v_start_at timestamptz;
  v_refunded boolean := false;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_user_id and p.role='employee' and p.is_active=true) then
    raise exception 'Only active employees can cancel leave';
  end if;

  select * into v_request
  from public.leave_requests lr
  where lr.id=p_request_id and lr.user_id=v_user_id
  for update;

  if not found or v_request.funding_source <> 'offset' then
    raise exception 'Offset-funded leave request not found';
  end if;

  if v_request.status not in ('Pending','Approved') then
    raise exception 'This leave request can no longer be cancelled';
  end if;

  select coalesce((select (a.value#>>'{}')::boolean from public.app_settings a where a.key='leave_cancellation_allowed'),true)
    into v_cancel_allowed;
  if not v_cancel_allowed then raise exception 'Leave cancellation is currently disabled'; end if;

  select coalesce((select (a.value#>>'{}')::integer from public.app_settings a where a.key='leave_cancel_before_start_hours'),24)
    into v_lead_hours;

  v_start_at := (v_request.start_date::timestamp at time zone 'Asia/Manila');
  if v_start_at - now() < make_interval(hours => v_lead_hours) then
    raise exception 'Leave requests can only be cancelled at least % hour(s) before they start', v_lead_hours;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  if v_request.status='Approved'
     and v_request.offset_charged_at is not null
     and v_request.offset_refunded_at is null then
    insert into public.offset_transactions(
      user_id,kind,hours,minutes,usage_date,created_by,source,note,leave_request_id
    ) values (
      v_user_id,'earned',9,0,v_request.start_date,v_user_id,'offset_leave_refund',
      '9 hours refunded after employee cancelled approved offset-funded leave',v_request.id
    );
    v_refunded := true;
  end if;

  update public.leave_requests
  set status='Cancelled',
      offset_refunded_at=case when v_refunded then now() else offset_refunded_at end
  where id=v_request.id;

  delete from public.leave_request_days where leave_request_id=v_request.id;

  perform public.log_audit_event(
    'offset_leave_cancelled','leave_request',v_request.id,
    case when v_refunded then 'Employee cancelled offset-funded leave; 9 offset hours refunded' else 'Employee cancelled pending offset-funded leave; reservation released' end
  );
end;
$$;

revoke all on function public.cancel_my_offset_leave(uuid) from public,anon;
grant execute on function public.cancel_my_offset_leave(uuid) to authenticated;

create or replace function public.settle_leave_day(p_user_id uuid, p_leave_date date)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_day record;
  v_has_timein boolean;
  v_year int;
  v_employment_status text;
  v_credits record;
  v_leave_type text;
  v_funding_source text;
  v_status_label text;
  v_default_credits int;
begin
  select * into v_day
  from public.leave_request_days
  where user_id=p_user_id and leave_date=p_leave_date and status='Pending'
  limit 1;

  if v_day.id is null then return; end if;

  select exists(
    select 1 from public.attendance_logs
    where user_id=p_user_id and log_date=p_leave_date and time_in is not null
  ) into v_has_timein;

  if v_has_timein then
    update public.leave_request_days set status='Voided',resolved_at=now() where id=v_day.id;
    return;
  end if;

  select lr.leave_type,lr.funding_source into v_leave_type,v_funding_source
  from public.leave_requests lr where lr.id=v_day.leave_request_id;

  v_status_label := coalesce(initcap(v_leave_type),'Leave') || ' Leave';

  if v_funding_source='offset' then
    insert into public.attendance_logs(user_id,log_date,status,time_in,time_out)
    values(p_user_id,p_leave_date,v_status_label,null,null)
    on conflict(user_id,log_date) do update
      set status=excluded.status,time_in=null,time_out=null;

    update public.leave_request_days set status='Deducted',resolved_at=now() where id=v_day.id;
    return;
  end if;

  select employment_status into v_employment_status
  from public.employee_government_ids where user_id=p_user_id;

  if v_employment_status is distinct from 'Regular' then
    insert into public.attendance_logs(user_id,log_date,status,time_in,time_out)
    values(p_user_id,p_leave_date,v_status_label,null,null)
    on conflict(user_id,log_date) do update
      set status=excluded.status,time_in=null,time_out=null;

    update public.leave_request_days set status='Deducted',resolved_at=now() where id=v_day.id;
    return;
  end if;

  v_year := extract(year from p_leave_date);

  select coalesce((select (value#>>'{}')::int from public.app_settings where key='default_leave_credits'),10)
    into v_default_credits;

  select id,used_credits,total_credits into v_credits
  from public.leave_credits where user_id=p_user_id and year=v_year;

  if v_credits.id is null then
    insert into public.leave_credits(user_id,year,total_credits,used_credits)
    values(p_user_id,v_year,v_default_credits,1);
  else
    update public.leave_credits
    set used_credits=least(v_credits.used_credits+1,v_credits.total_credits)
    where id=v_credits.id;
  end if;

  insert into public.attendance_logs(user_id,log_date,status,time_in,time_out)
  values(p_user_id,p_leave_date,v_status_label,null,null)
  on conflict(user_id,log_date) do update
    set status=excluded.status,time_in=null,time_out=null;

  update public.leave_request_days set status='Deducted',resolved_at=now() where id=v_day.id;
end;
$$;
