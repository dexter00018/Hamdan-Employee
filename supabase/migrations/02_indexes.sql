-- ============================================================================
-- Indexes (beyond the primary keys / unique constraints already declared
-- inline in 01_tables.sql)
-- ============================================================================

create index if not exists attendance_logs_user_id_idx on public.attendance_logs (user_id);
create index if not exists attendance_logs_log_date_idx on public.attendance_logs (log_date);

create index if not exists leave_request_days_user_id_leave_date_idx on public.leave_request_days (user_id, leave_date);

-- Only one Pending dispute allowed per user per date (prevents duplicate
-- disputes for the same day while one is still awaiting HR review).
create unique index if not exists one_pending_dispute_per_user_date
  on public.attendance_disputes (user_id, dispute_date)
  where (status = 'Pending');
