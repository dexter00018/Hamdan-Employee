-- The Supabase Table Editor and trusted server clients execute without an
-- employee auth.uid().  They must be able to correct an attendance record.
-- Authenticated employees still fall through to the immutable-fields rule
-- below, while admin/super_admin/hr profile roles remain explicitly allowed.
create or replace function public.enforce_own_attendance_log_fields()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_caller_role text;
begin
  if auth.uid() is null then
    return new;
  end if;

  select lower(coalesce(role, '')) into v_caller_role
  from public.profiles
  where id = auth.uid();

  if v_caller_role = any (array['admin', 'super_admin', 'hr']) then
    return new;
  end if;

  if TG_OP = 'INSERT' then
    new.log_date := (current_timestamp at time zone 'Asia/Manila')::date;
    new.time_in := now();
    new.time_out := null;
    new.status := public.compute_attendance_status(now());
  elsif TG_OP = 'UPDATE' then
    new.log_date := old.log_date;
    new.time_in := old.time_in;
    new.status := old.status;
    new.time_out := coalesce(old.time_out, now());
  end if;

  return new;
end;
$function$;
