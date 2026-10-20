'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { countChargeableLeaveDays } from '@/lib/leave-rules';
import { errorMessage, type LeaveRequest } from '@/lib/types/hr';

// Leave Requests domain: fetch pending/resolved handover list and the
// HR approve/reject/cancel actions. Leave credits are NOT deducted on
// approval -- see generate_leave_request_days / settle_leave_day.
export function useHrLeaveRequests({ holidays }: { holidays: { id: string; holiday_date: string; name: string }[] }) {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveRequestsLoading, setLeaveRequestsLoading] = useState(true);
  const [leaveActionLoadingId, setLeaveActionLoadingId] = useState<string | null>(null);
  const [leaveMsg, setLeaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [leaveHrNotes, setLeaveHrNotes] = useState<{ [id: string]: string }>({});

  const fetchLeaveRequests = async () => {
    setLeaveRequestsLoading(true);
    const { data, error } = await supabase
      .from('leave_requests')
      .select(`id, leave_type, start_date, end_date, reason, status, hr_notes, created_at, reviewed_at,
        funding_source, employee:profiles!leave_requests_user_id_fkey!inner(full_name, id, is_active),
        reviewer:profiles!leave_requests_reviewed_by_fkey(full_name)`)
      .eq('employee.is_active', true)
      .order('created_at', { ascending: false });
    if (error) { console.error('Error fetching leave requests:', error); }
    setLeaveRequests((data || []) as unknown as LeaveRequest[]);
    setLeaveRequestsLoading(false);
  };

  const countLeaveDays = (start: string, end: string) => {
    return countChargeableLeaveDays(start, end, holidays.map((holiday) => holiday.holiday_date));
  };

  const approveLeave = async (leave: LeaveRequest) => {
    setLeaveActionLoadingId(leave.id);
    setLeaveMsg(null);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const notes = leaveHrNotes[leave.id]?.trim() || null;

      const { error } = await supabase
        .from('leave_requests')
        .update({ status: 'Approved', hr_notes: notes, reviewed_by: currentUser?.id, reviewed_at: new Date().toISOString() })
        .eq('id', leave.id);
      if (error) throw error;

      // NOTE: leave credits are NOT deducted here anymore. Approving just
      // creates one 'Pending' leave_request_days row per weekday in range.
      // Each day only turns into an actual credit deduction later, once we
      // can confirm the employee didn't time in that day (see
      // settle_leave_day / settle_overdue_leave_days in Supabase, called
      // from the HR and Employee dashboards on load, plus a DB trigger that
      // fires the moment an employee times in).
      const { error: genError } = await supabase.rpc('generate_leave_request_days', {
        p_leave_request_id: leave.id,
      });
      if (genError) throw genError;

      setLeaveMsg({ type: 'success', text: 'Leave request approved.' });
      await fetchLeaveRequests();
    } catch (err: unknown) {
      console.error('Error approving leave:', err);
      setLeaveMsg({ type: 'error', text: errorMessage(err, 'Failed to approve leave.') });
    } finally {
      setLeaveActionLoadingId(null);
    }
  };

  const rejectLeave = async (leave: LeaveRequest) => {
    setLeaveActionLoadingId(leave.id);
    setLeaveMsg(null);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const notes = leaveHrNotes[leave.id]?.trim() || null;
      const { error } = await supabase
        .from('leave_requests')
        .update({ status: 'Rejected', hr_notes: notes, reviewed_by: currentUser?.id, reviewed_at: new Date().toISOString() })
        .eq('id', leave.id);
      if (error) throw error;
      setLeaveMsg({ type: 'success', text: 'Leave request rejected.' });
      await fetchLeaveRequests();
    } catch (err: unknown) {
      console.error('Error rejecting leave:', err);
      setLeaveMsg({ type: 'error', text: errorMessage(err, 'Failed to reject leave.') });
    } finally {
      setLeaveActionLoadingId(null);
    }
  };

  const cancelApprovedLeave = async (leave: LeaveRequest) => {
    setLeaveActionLoadingId(leave.id);
    setLeaveMsg(null);
    try {
      const { error } = await supabase.rpc('cancel_approved_leave_as_hr', {
        p_leave_request_id: leave.id,
      });
      if (error) throw error;
      setLeaveMsg({
        type: 'success',
        text: leave.funding_source === 'offset'
          ? 'Approved Offset leave cancelled and Offset refunded.'
          : 'Approved leave cancelled.',
      });
      await fetchLeaveRequests();
    } catch (err: unknown) {
      console.error('Error cancelling approved leave:', err);
      setLeaveMsg({ type: 'error', text: errorMessage(err, 'Failed to cancel approved leave.') });
    } finally {
      setLeaveActionLoadingId(null);
    }
  };

  return {
    leaveRequests,
    leaveRequestsLoading,
    fetchLeaveRequests,
    leaveActionLoadingId,
    leaveMsg,
    leaveHrNotes,
    setLeaveHrNotes,
    countLeaveDays,
    approveLeave,
    rejectLeave,
    cancelApprovedLeave,
  };
}
