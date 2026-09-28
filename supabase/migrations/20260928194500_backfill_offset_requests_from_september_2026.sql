-- Backfill eligible historical offset requests from September 1, 2026 onward.
-- Requests remain Pending until HR approves them; no offset balance is earned by this migration.
insert into public.offset_requests (
  attendance_log_id,
  user_id,
  scheduled_end_at,
  time_out_at,
  eligible_hours
)
select
  a.id,
  a.user_id,
  date_trunc('day', a.time_out at time zone 'Asia/Manila') at time zone 'Asia/Manila' + interval '19 hours' as scheduled_end_at,
  a.time_out,
  floor(
    extract(epoch from (
      a.time_out - (
        date_trunc('day', a.time_out at time zone 'Asia/Manila') at time zone 'Asia/Manila' + interval '19 hours'
      )
    )) / 3600
  )::integer as eligible_hours
from public.attendance_logs a
where a.time_out is not null
  and a.log_date >= date '2026-09-01'
  and floor(
    extract(epoch from (
      a.time_out - (
        date_trunc('day', a.time_out at time zone 'Asia/Manila') at time zone 'Asia/Manila' + interval '19 hours'
      )
    )) / 3600
  ) >= 1
  and not exists (
    select 1
    from public.offset_requests o
    where o.attendance_log_id = a.id
  )
on conflict (attendance_log_id) do nothing;
