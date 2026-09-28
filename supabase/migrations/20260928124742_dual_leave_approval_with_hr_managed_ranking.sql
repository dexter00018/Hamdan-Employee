alter table public.profiles
  add column if not exists employee_rank text,
  add column if not exists direct_lead_id uuid references public.profiles(id) on delete set null;

alter table public.profiles drop constraint if exists profiles_employee_rank_check;
alter table public.profiles add constraint profiles_employee_rank_check
  check (employee_rank is null or employee_rank in ('Associate','Lead'));

create index if not exists profiles_direct_lead_id_idx on public.profiles(direct_lead_id);

alter table public.leave_requests
  add column if not exists lead_approval_status text not null default 'Not Required',
  add column if not exists lead_approver_id uuid references public.profiles(id) on delete set null,
  add column if not exists lead_reviewed_at timestamptz,
  add column if not exists lead_notes text;

alter table public.leave_requests drop constraint if exists leave_requests_lead_approval_status_check;
alter table public.leave_requests add constraint leave_requests_lead_approval_status_check
  check (lead_approval_status in ('Not Required','Pending','Approved','Rejected'));

create index if not exists leave_requests_lead_approver_status_idx
  on public.leave_requests(lead_approver_id, lead_approval_status, created_at desc);

create or replace function public.set_employee_leave_hierarchy(
  p_employee_id uuid,
  p_rank text,
  p_direct_lead_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_rank text := nullif(btrim(coalesce(p_rank,'')), '');
  v_lead public.profiles;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin' and p.is_active = true
  ) then
    raise exception 'Only HR/Admin can set employee ranking';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = p_employee_id and p.role = 'employee'
  ) then
    raise exception 'Employee not found';
  end if;

  if v_rank is not null and v_rank not in ('Associate','Lead') then
    raise exception 'Rank must be Associate, Lead, or not set';
  end if;

  if v_rank = 'Associate' then
    if p_direct_lead_id is null then
      raise exception 'Associates must have a Direct Lead';
    end if;
    if p_direct_lead_id = p_employee_id then
      raise exception 'An employee cannot be their own Direct Lead';
    end if;

    select * into v_lead
    from public.profiles p
    where p.id = p_direct_lead_id
      and p.role = 'employee'
      and p.is_active = true
      and p.employee_rank = 'Lead';

    if not found then
      raise exception 'Direct Lead must be an active employee ranked as Lead';
    end if;
  else
    p_direct_lead_id := null;
  end if;

  update public.profiles
  set employee_rank = v_rank,
      direct_lead_id = p_direct_lead_id
  where id = p_employee_id;

  perform public.log_audit_event(
    'leave_hierarchy_updated',
    'profile',
    p_employee_id,
    'HR set leave rank to ' || coalesce(v_rank, 'Not set') ||
      case when p_direct_lead_id is not null then ' with Direct Lead ' || p_direct_lead_id::text else '' end
  );
end;
$function$;

revoke all on function public.set_employee_leave_hierarchy(uuid,text,uuid) from public, anon;
grant execute on function public.set_employee_leave_hierarchy(uuid,text,uuid) to authenticated;

create or replace function public.guard_leave_hierarchy_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.employee_rank is distinct from new.employee_rank
     or old.direct_lead_id is distinct from new.direct_lead_id then
    if (select auth.uid()) is not null and not exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin' and p.is_active = true
    ) then
      raise exception 'Only HR/Admin can change employee Rank or Direct Lead';
    end if;
  end if;
  return new;
end;
$function$;

revoke all on function public.guard_leave_hierarchy_profile_update() from public, anon, authenticated;

drop trigger if exists guard_leave_hierarchy_profile_update on public.profiles;
create trigger guard_leave_hierarchy_profile_update
before update of employee_rank, direct_lead_id on public.profiles
for each row execute function public.guard_leave_hierarchy_profile_update();

create or replace function public.prepare_leave_lead_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_rank text;
  v_direct_lead_id uuid;
begin
  select p.employee_rank, p.direct_lead_id
    into v_rank, v_direct_lead_id
  from public.profiles p
  where p.id = new.user_id;

  if v_rank = 'Associate' then
    if v_direct_lead_id is null or not exists (
      select 1 from public.profiles lead
      where lead.id = v_direct_lead_id
        and lead.role = 'employee'
        and lead.employee_rank = 'Lead'
        and lead.is_active = true
    ) then
      raise exception 'Your Direct Lead is not configured. Please contact HR before filing leave.';
    end if;
    new.lead_approval_status := 'Pending';
    new.lead_approver_id := v_direct_lead_id;
    new.lead_reviewed_at := null;
    new.lead_notes := null;
  else
    new.lead_approval_status := 'Not Required';
    new.lead_approver_id := null;
    new.lead_reviewed_at := null;
    new.lead_notes := null;
  end if;

  return new;
end;
$function$;

revoke all on function public.prepare_leave_lead_approval() from public, anon, authenticated;

drop trigger if exists prepare_leave_lead_approval on public.leave_requests;
create trigger prepare_leave_lead_approval
before insert on public.leave_requests
for each row execute function public.prepare_leave_lead_approval();

create or replace function public.review_team_leave_request(
  p_request_id uuid,
  p_approve boolean,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request public.leave_requests;
  v_notes text := nullif(btrim(coalesce(p_notes,'')), '');
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'employee'
      and p.employee_rank = 'Lead'
      and p.is_active = true
  ) then
    raise exception 'Only an active Lead can review team leave requests';
  end if;

  select * into v_request
  from public.leave_requests r
  where r.id = p_request_id
  for update;

  if not found
     or v_request.status <> 'Pending'
     or v_request.lead_approval_status <> 'Pending'
     or v_request.lead_approver_id <> (select auth.uid()) then
    raise exception 'This leave request is not pending your approval';
  end if;

  update public.leave_requests
  set lead_approval_status = case when p_approve then 'Approved' else 'Rejected' end,
      lead_reviewed_at = now(),
      lead_notes = v_notes,
      status = case when p_approve then status else 'Rejected' end
  where id = p_request_id;

  perform public.log_audit_event(
    case when p_approve then 'lead_leave_approved' else 'lead_leave_rejected' end,
    'leave_request',
    p_request_id,
    case when p_approve then 'Direct Lead approved leave for HR review' else 'Direct Lead rejected leave before HR review' end
  );
end;
$function$;

revoke all on function public.review_team_leave_request(uuid,boolean,text) from public, anon;
grant execute on function public.review_team_leave_request(uuid,boolean,text) to authenticated;

create or replace function public.guard_leave_review_sequence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.status = 'Pending'
     and new.status in ('Approved','Rejected')
     and old.lead_approval_status = 'Pending'
     and new.lead_approval_status = 'Pending' then
    raise exception 'Direct Lead approval is required before HR can review this leave request';
  end if;

  if old.lead_approval_status is distinct from new.lead_approval_status
     or old.lead_approver_id is distinct from new.lead_approver_id
     or old.lead_reviewed_at is distinct from new.lead_reviewed_at
     or old.lead_notes is distinct from new.lead_notes then
    if (select auth.uid()) is not null
       and (select auth.uid()) is distinct from old.lead_approver_id then
      raise exception 'Only the assigned Direct Lead can change Lead approval fields';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function public.guard_leave_review_sequence() from public, anon, authenticated;

drop trigger if exists guard_leave_review_sequence on public.leave_requests;
create trigger guard_leave_review_sequence
before update on public.leave_requests
for each row execute function public.guard_leave_review_sequence();

drop policy if exists "View own or admin leave requests" on public.leave_requests;
create policy "View own admin or assigned lead leave requests"
on public.leave_requests for select to authenticated
using (
  (select auth.uid()) = user_id
  or (select auth.uid()) = lead_approver_id
  or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin','super_admin')
  )
);
