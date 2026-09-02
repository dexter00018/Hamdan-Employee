export type ReviewStatus = 'Pending' | 'Approved' | 'Rejected';

export type ReviewerSummary = { full_name?: string | null } | null;
export type EmployeeSummary = { id?: string; full_name?: string | null; is_active?: boolean | null } | null;

export type AttendanceDispute = {
  id: string;
  attendance_log_id: string | null;
  dispute_date: string;
  dispute_type: 'TimeIn' | 'TimeOut' | null;
  claimed_time_in: string | null;
  original_time_in: string | null;
  claimed_time_out: string | null;
  original_time_out: string | null;
  reason: string | null;
  status: ReviewStatus;
  hr_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  employee: EmployeeSummary;
  reviewer: ReviewerSummary;
};

export type LeaveRequest = {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: ReviewStatus;
  hr_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  employee: EmployeeSummary;
  reviewer: ReviewerSummary;
};

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
