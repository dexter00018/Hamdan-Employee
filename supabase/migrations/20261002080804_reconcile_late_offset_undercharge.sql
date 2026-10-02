-- The preceding minute-precision migration already refunded every historical
-- overcharge. This follow-up closes the only inverse case: a Late record whose
-- exact duration was greater than the old fixed one-hour deduction.
begin;

with undercharges as (
  select
    r.id as request_id,
    r.user_id,
    r.attendance_log_id,
    a.log_date,
    r.required_minutes - r.hours * 60 as debit_minutes
  from public.offset_usage_requests r
  join public.attendance_logs a on a.id = r.attendance_log_id
  where r.status = 'Approved'
    and r.required_minutes > r.hours * 60
)
insert into public.offset_transactions (
  user_id,
  kind,
  hours,
  minutes,
  usage_date,
  source,
  note
)
select
  u.user_id,
  'used',
  u.debit_minutes / 60,
  u.debit_minutes % 60,
  u.log_date,
  'system',
  format(
    'Late Offset minute correction for request %s (attendance log #%s): additional debit %s minute(s).',
    u.request_id,
    u.attendance_log_id,
    u.debit_minutes
  )
from undercharges u
where not exists (
  select 1
  from public.offset_transactions t
  where t.note = format(
    'Late Offset minute correction for request %s (attendance log #%s): additional debit %s minute(s).',
    u.request_id,
    u.attendance_log_id,
    u.debit_minutes
  )
);

notify pgrst, 'reload schema';

commit;
