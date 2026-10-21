-- release_holiday_absences(date)
--
-- The on-load absence sweep (settle_overdue_absences) marks past weekdays
-- without an attendance row as 'Absent' -- but it only excludes holidays
-- that were declared BEFORE the sweep ran. When HR declares a holiday
-- retroactively (a sudden/late holiday, a date typed in days later), the
-- sweep's placeholder rows remain and wrongly show employees as Absent.
--
-- This function removes ONLY the sweep's placeholder shape for the given
-- date: status 'Absent' with no time_in and no time_out. Any log with a
-- real time_in -- i.e. someone who actually showed up that day -- is never
-- touched. Restricted to HR roles because deletion is destructive; the HR
-- Holidays modal calls it behind a confirmation dialog after adding a
-- past-dated holiday.
create or replace function public.release_holiday_absences(p_date date)
returns integer
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_count integer;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and lower(coalesce(role, '')) = any (array['admin', 'super_admin', 'hr'])
  ) then
    raise exception 'Not authorized';
  end if;

  with released as (
    delete from public.attendance_logs
    where log_date = p_date
      and status = 'Absent'
      and time_in is null
      and time_out is null
    returning 1
  )
  select count(*) into v_count from released;

  return v_count;
end;
$function$;

revoke all on function public.release_holiday_absences(date) from public, anon;
grant execute on function public.release_holiday_absences(date) to authenticated;
