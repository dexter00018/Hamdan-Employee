create or replace function public.close_manpower_session_on_timeout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.time_out is null and new.time_out is not null then
    update public.manpower_sessions
      set ended_at = new.time_out
    where user_id = new.user_id
      and ended_at is null
      and started_at <= new.time_out;
  end if;
  return new;
end;
$function$;
