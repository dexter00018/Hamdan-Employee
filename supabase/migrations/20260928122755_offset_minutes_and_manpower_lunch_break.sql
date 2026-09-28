alter table public.offset_transactions
  add column if not exists minutes integer not null default 0;

alter table public.offset_transactions drop constraint if exists offset_transactions_hours_check;
alter table public.offset_transactions drop constraint if exists offset_transactions_minutes_check;
alter table public.offset_transactions
  add constraint offset_transactions_hours_minutes_check
  check (hours >= 0 and minutes >= 0 and minutes < 60 and (hours > 0 or minutes > 0));

create or replace function public.adjust_offset_balance_minutes(
  p_user_id uuid,
  p_delta_minutes integer,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance_minutes integer;
  v_abs_minutes integer;
  v_hours integer;
  v_minutes integer;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='super_admin') then
    raise exception 'Only Super Admin can adjust offset balances';
  end if;
  if p_delta_minutes=0 then raise exception 'Adjustment cannot be zero'; end if;
  if char_length(v_reason)<3 then raise exception 'A reason is required'; end if;
  if not exists (select 1 from public.profiles p where p.id=p_user_id and p.role='employee') then raise exception 'Employee not found'; end if;

  select coalesce(sum(case when t.kind='earned' then (t.hours*60+t.minutes) else -(t.hours*60+t.minutes) end),0)::integer
    into v_balance_minutes from public.offset_transactions t where t.user_id=p_user_id;
  if v_balance_minutes+p_delta_minutes<0 then raise exception 'Adjustment would make the offset balance negative'; end if;

  v_abs_minutes:=abs(p_delta_minutes);
  v_hours:=v_abs_minutes/60;
  v_minutes:=v_abs_minutes%60;

  insert into public.offset_transactions(user_id,kind,hours,minutes,created_by,source,note)
  values(p_user_id,case when p_delta_minutes>0 then 'earned' else 'used' end,v_hours,v_minutes,(select auth.uid()),'manual_adjustment',v_reason);

  perform public.log_audit_event(
    'offset_balance_adjusted','profile',p_user_id,
    case when p_delta_minutes>0 then 'Added ' else 'Deducted ' end
      || case when v_hours>0 then v_hours::text||' hour(s) ' else '' end
      || case when v_minutes>0 then v_minutes::text||' minute(s) ' else '' end
      || 'of offset. Reason: '||v_reason
  );
end;
$$;

revoke all on function public.adjust_offset_balance_minutes(uuid,integer,text) from public,anon;
grant execute on function public.adjust_offset_balance_minutes(uuid,integer,text) to authenticated;

create or replace function public.adjust_offset_balance(p_user_id uuid,p_delta_hours integer,p_reason text)
returns void language plpgsql security invoker set search_path='' as $$
begin
  perform public.adjust_offset_balance_minutes(p_user_id,p_delta_hours*60,p_reason);
end;
$$;
revoke all on function public.adjust_offset_balance(uuid,integer,text) from public,anon;
grant execute on function public.adjust_offset_balance(uuid,integer,text) to authenticated;

create or replace function public.convert_offset_to_paid_leave(p_user_id uuid)
returns void language plpgsql security definer set search_path='public' as $$
declare bal_minutes integer; yr integer:=extract(year from now() at time zone 'Asia/Manila');
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role in ('admin','super_admin')) then raise exception 'Not authorized'; end if;
  select coalesce(sum(case when kind='earned' then (hours*60+minutes) else -(hours*60+minutes) end),0)::integer into bal_minutes from public.offset_transactions where user_id=p_user_id;
  if bal_minutes<540 then raise exception 'At least 9 approved offset hours are required'; end if;
  insert into public.offset_transactions(user_id,kind,hours,minutes,created_by) values(p_user_id,'converted',9,0,auth.uid());
  insert into public.leave_credits(user_id,year,total_credits,used_credits) values(p_user_id,yr,1,0)
  on conflict(user_id,year) do update set total_credits=public.leave_credits.total_credits+1;
end
$$;

create or replace function public.apply_offset_to_late(p_attendance_log_id bigint)
returns void language plpgsql security definer set search_path='public' as $$
declare rec public.attendance_logs; bal_minutes integer;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role in ('admin','super_admin')) then raise exception 'Not authorized'; end if;
  select * into rec from public.attendance_logs where id=p_attendance_log_id for update;
  if not found then raise exception 'Attendance record not found'; end if;
  if lower(coalesce(rec.status,''))<>'late' then raise exception 'Only Late attendance records can be scrubbed with offset'; end if;
  select coalesce(sum(case when kind='earned' then (hours*60+minutes) else -(hours*60+minutes) end),0)::integer into bal_minutes from public.offset_transactions where user_id=rec.user_id;
  if bal_minutes<60 then raise exception 'Employee does not have an approved offset hour available'; end if;
  insert into public.offset_transactions(user_id,kind,hours,minutes,usage_date,created_by) values(rec.user_id,'used',1,0,rec.log_date,auth.uid());
  update public.attendance_logs set status='Offset Applied' where id=rec.id;
  perform public.log_audit_event('offset_applied_to_late','attendance_log',null,'Applied 1 approved offset hour to scrub Late attendance log #'||rec.id||' for '||rec.log_date::text);
end
$$;

create or replace function public.submit_offset_usage_request(p_attendance_log_id bigint)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_user_id uuid:=(select auth.uid()); v_balance_minutes integer; v_pending_minutes integer; v_request_id uuid;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_user_id and p.role='employee' and p.is_active=true) then raise exception 'Only active employees can request offset usage'; end if;
  if not exists(select 1 from public.attendance_logs a where a.id=p_attendance_log_id and a.user_id=v_user_id and lower(coalesce(a.status,''))='late') then raise exception 'Only your own Late attendance record can use offset'; end if;
  if exists(select 1 from public.offset_usage_requests r where r.attendance_log_id=p_attendance_log_id and r.status='Pending') then raise exception 'An offset usage request is already pending for this Late record'; end if;
  select coalesce(sum(case when t.kind='earned' then (t.hours*60+t.minutes) else -(t.hours*60+t.minutes) end),0)::integer into v_balance_minutes from public.offset_transactions t where t.user_id=v_user_id;
  select coalesce(sum(r.hours*60),0)::integer into v_pending_minutes from public.offset_usage_requests r where r.user_id=v_user_id and r.status='Pending';
  if v_balance_minutes-v_pending_minutes<60 then raise exception 'You do not have an unreserved approved offset hour available'; end if;
  insert into public.offset_usage_requests(user_id,attendance_log_id,hours) values(v_user_id,p_attendance_log_id,1) returning id into v_request_id;
  return v_request_id;
end;
$$;

create or replace function public.review_offset_usage_request(p_request_id uuid,p_approve boolean,p_notes text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_request public.offset_usage_requests; v_log public.attendance_logs; v_balance_minutes integer;
begin
  if not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role in ('admin','super_admin')) then raise exception 'Not authorized'; end if;
  select * into v_request from public.offset_usage_requests where id=p_request_id for update;
  if not found or v_request.status<>'Pending' then raise exception 'Offset usage request is not pending'; end if;
  if not p_approve then update public.offset_usage_requests set status='Rejected',reviewed_by=(select auth.uid()),reviewed_at=now(),hr_notes=p_notes where id=v_request.id; return; end if;
  select * into v_log from public.attendance_logs where id=v_request.attendance_log_id for update;
  if not found or v_log.user_id<>v_request.user_id or lower(coalesce(v_log.status,''))<>'late' then raise exception 'Late attendance record is no longer eligible'; end if;
  select coalesce(sum(case when t.kind='earned' then (t.hours*60+t.minutes) else -(t.hours*60+t.minutes) end),0)::integer into v_balance_minutes from public.offset_transactions t where t.user_id=v_request.user_id;
  if v_balance_minutes<(v_request.hours*60) then raise exception 'Employee no longer has enough approved offset balance'; end if;
  insert into public.offset_transactions(user_id,kind,hours,minutes,usage_date,created_by) values(v_request.user_id,'used',v_request.hours,0,v_log.log_date,(select auth.uid()));
  update public.attendance_logs set status='Offset Applied' where id=v_log.id;
  update public.offset_usage_requests set status='Approved',reviewed_by=(select auth.uid()),reviewed_at=now(),hr_notes=p_notes where id=v_request.id;
end;
$$;

create table if not exists public.manpower_lunch_pauses(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.manpower_projects(id) on delete restrict,
  lunch_date date not null,
  paused_at timestamptz not null,
  resumed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id,lunch_date)
);
alter table public.manpower_lunch_pauses enable row level security;
grant select on public.manpower_lunch_pauses to authenticated;
revoke all on public.manpower_lunch_pauses from anon;
drop policy if exists "Users read permitted lunch pauses" on public.manpower_lunch_pauses;
create policy "Users read permitted lunch pauses" on public.manpower_lunch_pauses for select to authenticated using((select auth.uid())=user_id or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='super_admin'));

create or replace function public.pause_manpower_for_lunch()
returns void language plpgsql security definer set search_path='' as $$
declare v_date date:=(now() at time zone 'Asia/Manila')::date; v_pause_at timestamptz:=((now() at time zone 'Asia/Manila')::date+time '12:00') at time zone 'Asia/Manila'; r record;
begin
  for r in select ms.id,ms.user_id,ms.project_id,ms.started_at from public.manpower_sessions ms where ms.ended_at is null and exists(select 1 from public.attendance_logs a where a.user_id=ms.user_id and a.log_date=v_date and a.time_in is not null and a.time_out is null)
  loop
    insert into public.manpower_lunch_pauses(user_id,project_id,lunch_date,paused_at,resumed_at) values(r.user_id,r.project_id,v_date,v_pause_at,null)
    on conflict(user_id,lunch_date) do update set project_id=excluded.project_id,paused_at=excluded.paused_at,resumed_at=null;
    update public.manpower_sessions set ended_at=greatest(r.started_at,v_pause_at) where id=r.id and ended_at is null;
  end loop;
end;
$$;
revoke all on function public.pause_manpower_for_lunch() from public,anon,authenticated;

create or replace function public.resume_manpower_after_lunch()
returns void language plpgsql security definer set search_path='' as $$
declare v_date date:=(now() at time zone 'Asia/Manila')::date; v_resume_at timestamptz:=((now() at time zone 'Asia/Manila')::date+time '13:00') at time zone 'Asia/Manila'; r record;
begin
  for r in select lp.id,lp.user_id,lp.project_id from public.manpower_lunch_pauses lp where lp.lunch_date=v_date and lp.resumed_at is null and exists(select 1 from public.attendance_logs a where a.user_id=lp.user_id and a.log_date=v_date and a.time_in is not null and a.time_out is null) and exists(select 1 from public.manpower_projects mp where mp.id=lp.project_id and mp.is_active=true)
  loop
    if not exists(select 1 from public.manpower_sessions ms where ms.user_id=r.user_id and ms.ended_at is null) then insert into public.manpower_sessions(user_id,project_id,started_at) values(r.user_id,r.project_id,v_resume_at); end if;
    update public.manpower_lunch_pauses set resumed_at=v_resume_at where id=r.id;
  end loop;
end;
$$;
revoke all on function public.resume_manpower_after_lunch() from public,anon,authenticated;

create or replace function public.switch_manpower_project(p_project_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user_id uuid:=(select auth.uid()); v_active_id uuid; v_active_project uuid; v_new_id uuid; v_today date:=(now() at time zone 'Asia/Manila')::date; v_local_time time:=(now() at time zone 'Asia/Manila')::time;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_user_id and p.role='employee' and p.is_active=true) then raise exception 'Only active employees can track manpower time'; end if;
  if not exists(select 1 from public.attendance_logs a where a.user_id=v_user_id and a.log_date=v_today and a.time_in is not null and a.time_out is null) then raise exception 'Manpower Tracker is only available during your active attendance shift'; end if;
  if v_local_time>=time '12:00' and v_local_time<time '13:00' then raise exception 'Manpower Tracker is paused for lunch from 12:00 PM to 1:00 PM'; end if;
  if not exists(select 1 from public.manpower_projects mp where mp.id=p_project_id and mp.is_active=true) then raise exception 'Project is not available'; end if;
  select ms.id,ms.project_id into v_active_id,v_active_project from public.manpower_sessions ms where ms.user_id=v_user_id and ms.ended_at is null order by ms.started_at desc limit 1 for update;
  if v_active_id is not null and v_active_project=p_project_id then return v_active_id; end if;
  if v_active_id is not null then update public.manpower_sessions set ended_at=now() where id=v_active_id; end if;
  insert into public.manpower_sessions(user_id,project_id,started_at) values(v_user_id,p_project_id,now()) returning id into v_new_id;
  return v_new_id;
end;
$$;
revoke all on function public.switch_manpower_project(uuid) from public,anon;
grant execute on function public.switch_manpower_project(uuid) to authenticated;

create extension if not exists pg_cron;
select cron.schedule('manpower-lunch-pause-manila','0 4 * * *','select public.pause_manpower_for_lunch();');
select cron.schedule('manpower-lunch-resume-manila','0 5 * * *','select public.resume_manpower_after_lunch();');
