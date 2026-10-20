-- Generic per-user API rate limiter, used first by /api/commute-check.
-- Tracks a sliding window per (scope, user_id) and atomically decides
-- whether the caller may proceed, incrementing the counter in the same
-- transaction to avoid race conditions under concurrent requests.

create table if not exists public.api_rate_limits (
  scope text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null default 0,
  primary key (scope, user_id)
);

alter table public.api_rate_limits enable row level security;

-- No client-facing policies: only accessed via the SECURITY DEFINER
-- function below, called with the service-role key from server routes.
revoke all on public.api_rate_limits from anon, authenticated;

create or replace function public.consume_api_rate_limit(
  p_scope text,
  p_user_id uuid,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_count integer;
begin
  if p_scope is null or p_user_id is null or p_limit is null or p_window_seconds is null then
    raise exception 'consume_api_rate_limit: all parameters are required';
  end if;

  insert into public.api_rate_limits (scope, user_id, window_start, request_count)
  values (p_scope, p_user_id, v_now, 1)
  on conflict (scope, user_id) do update
    set
      window_start = case
        when public.api_rate_limits.window_start <= v_now - make_interval(secs => p_window_seconds)
          then v_now
        else public.api_rate_limits.window_start
      end,
      request_count = case
        when public.api_rate_limits.window_start <= v_now - make_interval(secs => p_window_seconds)
          then 1
        else public.api_rate_limits.request_count + 1
      end
  returning window_start, request_count into v_window_start, v_count;

  return v_count <= p_limit;
end;
$$;

-- Only server-side callers using the service-role key should invoke this.
revoke all on function public.consume_api_rate_limit(text, uuid, integer, integer) from anon, authenticated;