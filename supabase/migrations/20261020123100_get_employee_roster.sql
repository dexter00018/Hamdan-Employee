-- Shared active-employee roster for the employee directory, HR leave
-- credits and hierarchy, HR attendance history, and super-admin manpower
-- tracking. Previously four separate hand-rolled profile queries with
-- drifting select shapes and status filters (one of them ignored
-- resignation entirely).
--
-- SECURITY INVOKER keeps profiles RLS fully in force -- the function only
-- centralizes the return shape, ordering, and status mode.
--
-- p_mode:
--   'active'     -- is_active = true (default)
--   'hr_history' -- still active OR has an official resigned_date, so HR
--                   history views can show resigned employees' records
--   'all'        -- every employee row (super-admin tracker)
create or replace function public.get_employee_roster(p_mode text default 'active')
returns table (
  id uuid,
  full_name text,
  employee_id text,
  designation text,
  employee_rank text,
  direct_lead_id uuid,
  avatar_url text,
  employee_email text,
  is_active boolean,
  resigned_date date
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select p.id, p.full_name, p.employee_id, p.designation, p.employee_rank,
         p.direct_lead_id, p.avatar_url, p.employee_email, p.is_active,
         p.resigned_date
  from public.profiles p
  where p.role = 'employee'
    and case p_mode
          when 'all' then true
          when 'hr_history' then (p.is_active or p.resigned_date is not null)
          else p.is_active
        end
  order by p.full_name asc;
$function$;

revoke all on function public.get_employee_roster(text) from public, anon;
grant execute on function public.get_employee_roster(text) to authenticated;
