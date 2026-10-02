-- Live, all-time Manpower totals. A future pre-pick session contributes zero
-- until its scheduled start time, while an open active session keeps counting.
create or replace view public.manpower_project_hours_summary
with (security_invoker = true)
as
with project_minutes as (
  select
    ms.project_id,
    coalesce(
      round(
        sum(
          case
            when ms.started_at >= statement_timestamp() then 0
            else greatest(
              0,
              extract(
                epoch from (
                  least(coalesce(ms.ended_at, statement_timestamp()), statement_timestamp())
                  - ms.started_at
                )
              )
            )
          end
        ) / 60.0
      )::bigint,
      0
    ) as total_minutes
  from public.manpower_sessions ms
  group by ms.project_id
)
select
  mp.id as project_id,
  mp.name as project_name,
  mp.project_code,
  mp.is_active,
  coalesce(pm.total_minutes, 0) as total_minutes,
  round(coalesce(pm.total_minutes, 0)::numeric / 60, 2) as total_hours
from public.manpower_projects mp
left join project_minutes pm on pm.project_id = mp.id;

create or replace view public.manpower_total_hours_summary
with (security_invoker = true)
as
select
  coalesce(sum(total_minutes), 0)::bigint as total_minutes,
  round(coalesce(sum(total_minutes), 0)::numeric / 60, 2) as total_hours
from public.manpower_project_hours_summary;

grant select on public.manpower_project_hours_summary to authenticated;
grant select on public.manpower_total_hours_summary to authenticated;
revoke all on public.manpower_project_hours_summary from anon;
revoke all on public.manpower_total_hours_summary from anon;

comment on view public.manpower_project_hours_summary is
  'Live all-time Manpower hours per project. Open sessions count through the query time; future pre-picks count as zero.';
comment on view public.manpower_total_hours_summary is
  'Live all-time Manpower hours across every project visible to the caller.';
