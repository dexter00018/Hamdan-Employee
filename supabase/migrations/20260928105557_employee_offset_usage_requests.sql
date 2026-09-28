-- Employee requests to use approved offset hours for a selected Late attendance record.
-- HR approval deducts 1 approved offset hour and changes the attendance tag to Offset Applied.

create table public.offset_usage_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  attendance_log_id bigint not null references public.attendance_logs(id) on delete cascade,
  hours integer not null default 1 check (hours = 1),
  status text not null default 'Pending' check (status in ('Pending','Approved','Rejected')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  hr_notes text
);

alter table public.offset_usage_requests enable row level security;
grant select, insert on public.offset_usage_requests to authenticated;
revoke all on public.offset_usage_requests from anon;

create index offset_usage_requests_user_created_idx on public.offset_usage_requests(user_id, created_at desc);
create index offset_usage_requests_status_created_idx on public.offset_usage_requests(status, created_at asc);
create unique index offset_usage_requests_one_pending_per_log_idx on public.offset_usage_requests(attendance_log_id) where status = 'Pending';

create policy "Employees read own offset usage requests" on public.offset_usage_requests for select to authenticated using ((select auth.uid()) = user_id);
create policy "HR read offset usage requests" on public.offset_usage_requests for select to authenticated using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin','super_admin')));
create policy "Employees submit own offset usage requests" on public.offset_usage_requests for insert to authenticated with check (
  (select auth.uid()) = user_id
  and status = 'Pending'
  and reviewed_by is null
  and reviewed_at is null
  and hours = 1
  and exists (select 1 from public.attendance_logs a where a.id = attendance_log_id and a.user_id = (select auth.uid()) and lower(coalesce(a.status,'')) = 'late')
);

create or replace function public.submit_offset_usage_request(p_attendance_log_id bigint)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_balance integer;
  v_pending integer;
  v_request_id uuid;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if not exists (select 1 from public.profiles p where p.id = v_user_id and p.role = 'employee' and p.is_active = true) then raise exception 'Only active employees can request offset usage'; end if;
  if not exists (select 1 from public.attendance_logs a where a.id = p_attendance_log_id and a.user_id = v_user_id and lower(coalesce(a.status,'')) = 'late') then raise exception 'Only your own Late attendance record can use offset'; end if;
  if exists (select 1 from public.offset_usage_requests r where r.attendance_log_id = p_attendance_log_id and r.status = 'Pending') then raise exception 'An offset usage request is already pending for this Late record'; end if;

  select coalesce(sum(case when t.kind = 'earned' then t.hours else -t.hours end), 0) into v_balance from public.offset_transactions t where t.user_id = v_user_id;
  select coalesce(sum(r.hours), 0) into v_pending from public.offset_usage_requests r where r.user_id = v_user_id and r.status = 'Pending';
  if (v_balance - v_pending) < 1 then raise exception 'You do not have an unreserved approved offset hour available'; end if;

  insert into public.offset_usage_requests(user_id, attendance_log_id, hours) values(v_user_id, p_attendance_log_id, 1) returning id into v_request_id;
  return v_request_id;
end;
$$;

revoke all on function public.submit_offset_usage_request(bigint) from public, anon;
grant execute on function public.submit_offset_usage_request(bigint) to authenticated;

create or replace function public.review_offset_usage_request(p_request_id uuid, p_approve boolean, p_notes text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.offset_usage_requests;
  v_log public.attendance_logs;
  v_balance integer;
begin
  if not exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin','super_admin')) then raise exception 'Not authorized'; end if;

  select * into v_request from public.offset_usage_requests where id = p_request_id for update;
  if not found or v_request.status <> 'Pending' then raise exception 'Offset usage request is not pending'; end if;

  if not p_approve then
    update public.offset_usage_requests set status='Rejected', reviewed_by=(select auth.uid()), reviewed_at=now(), hr_notes=p_notes where id=v_request.id;
    return;
  end if;

  select * into v_log from public.attendance_logs where id = v_request.attendance_log_id for update;
  if not found or v_log.user_id <> v_request.user_id or lower(coalesce(v_log.status,'')) <> 'late' then raise exception 'Late attendance record is no longer eligible'; end if;

  select coalesce(sum(case when t.kind='earned' then t.hours else -t.hours end),0) into v_balance from public.offset_transactions t where t.user_id=v_request.user_id;
  if v_balance < v_request.hours then raise exception 'Employee no longer has enough approved offset balance'; end if;

  insert into public.offset_transactions(user_id,kind,hours,usage_date,created_by) values(v_request.user_id,'used',v_request.hours,v_log.log_date,(select auth.uid()));
  update public.attendance_logs set status='Offset Applied' where id=v_log.id;
  update public.offset_usage_requests set status='Approved', reviewed_by=(select auth.uid()), reviewed_at=now(), hr_notes=p_notes where id=v_request.id;
end;
$$;

revoke all on function public.review_offset_usage_request(uuid, boolean, text) from public, anon;
grant execute on function public.review_offset_usage_request(uuid, boolean, text) to authenticated;
