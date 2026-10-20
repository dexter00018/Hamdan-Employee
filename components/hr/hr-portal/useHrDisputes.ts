'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { computeAttendanceStatus } from '@/lib/attendance-rules';
import { errorMessage, type AttendanceDispute } from '@/lib/types/hr';

// Attendance Disputes domain: pending dispute intake + HR approval /
// rejection (approval writes the corrected attendance record).
export function useHrDisputes({ refreshAllData, lateCutoffHour, lateCutoffMinute }: {
  refreshAllData: () => Promise<void>;
  lateCutoffHour: number;
  lateCutoffMinute: number;
}) {
  const [disputes, setDisputes] = useState<AttendanceDispute[]>([]);
  const [disputesLoading, setDisputesLoading] = useState(true);
  const [disputeActionLoadingId, setDisputeActionLoadingId] = useState<string | null>(null);
  const [disputeMsg, setDisputeMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchDisputes = async () => {
    setDisputesLoading(true);
    const { data, error } = await supabase
      .from('attendance_disputes')
      .select(`
        id, attendance_log_id, dispute_date, dispute_type, claimed_time_in, original_time_in, claimed_time_out, original_time_out, reason, status, hr_notes, created_at, reviewed_at,
        employee:profiles!attendance_disputes_user_id_fkey!inner(full_name, is_active),
        reviewer:profiles!attendance_disputes_reviewed_by_fkey(full_name)
      `)
      .eq('employee.is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching disputes:', error);
      setDisputesLoading(false);
      return;
    }
    setDisputes((data || []) as unknown as AttendanceDispute[]);
    setDisputesLoading(false);
  };

  // Computes Present/Late the same way as everywhere else in the app,
  // based on the claimed time-in in Philippine time. Only relevant for
  // TimeIn-type disputes -- TimeOut disputes don't change the Present/
  // Late status, since that's determined solely by time_in.
  const computeStatusForTime = (isoString: string) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date(isoString)).reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
    const hour = parseInt(parts.hour, 10);
    const minute = parseInt(parts.minute, 10);
    return computeAttendanceStatus(hour, minute, lateCutoffHour, lateCutoffMinute);
  };

  const approveDispute = async (dispute: AttendanceDispute) => {
    setDisputeActionLoadingId(dispute.id);
    setDisputeMsg(null);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const disputeType = dispute.dispute_type || 'TimeIn';

      if (disputeType === 'TimeOut') {
        // Timeout disputes always reference an existing log (the
        // employee already timed in that day) -- just correct time_out.
        // Status (Present/Late) is untouched since that's derived from
        // time_in only.
        if (!dispute.attendance_log_id) {
          throw new Error('This dispute has no linked attendance record to update.');
        }
        if (!dispute.claimed_time_out) throw new Error('This dispute has no claimed time-out.');
        const { error } = await supabase
          .from('attendance_logs')
          .update({ time_out: dispute.claimed_time_out })
          .eq('id', dispute.attendance_log_id);
        if (error) throw error;
      } else if (dispute.attendance_log_id) {
        // Existing (wrongly-tagged) log -- correct its time_in/status.
        if (!dispute.claimed_time_in) throw new Error('This dispute has no claimed time-in.');
        const newStatus = computeStatusForTime(dispute.claimed_time_in);
        const { error } = await supabase
          .from('attendance_logs')
          .update({ time_in: dispute.claimed_time_in, status: newStatus })
          .eq('id', dispute.attendance_log_id);
        if (error) throw error;
      } else {
        // No log existed for that day (forgot to time in) -- create it.
        // Uses upsert (not insert) because the nightly/on-load absence sweep
        // may have already filled this date with a placeholder 'Absent' row
        // (see settle_overdue_absences) -- this overwrites that placeholder
        // with the real, HR-confirmed time_in/status instead of colliding
        // with the unique (user_id, log_date) constraint.
        if (!dispute.claimed_time_in) throw new Error('This dispute has no claimed time-in.');
        const newStatus = computeStatusForTime(dispute.claimed_time_in);
        const { data: disputeRow } = await supabase
          .from('attendance_disputes')
          .select('user_id')
          .eq('id', dispute.id)
          .single();

        if (!disputeRow) throw new Error('Linked dispute not found.');

        const { error } = await supabase.from('attendance_logs').upsert([{
          user_id: disputeRow.user_id,
          log_date: dispute.dispute_date,
          time_in: dispute.claimed_time_in,
          status: newStatus,
        }], { onConflict: 'user_id,log_date' });
        if (error) throw error;
      }

      const { error: updateError } = await supabase
        .from('attendance_disputes')
        .update({ status: 'Approved', reviewed_at: new Date().toISOString(), reviewed_by: currentUser?.id ?? null })
        .eq('id', dispute.id);
      if (updateError) throw updateError;

      setDisputeMsg({ type: 'success', text: 'Dispute approved and attendance record updated.' });
      await Promise.all([fetchDisputes(), refreshAllData()]);
    } catch (err: unknown) {
      console.error('Error approving dispute:', err);
      setDisputeMsg({ type: 'error', text: errorMessage(err, 'Failed to approve dispute.') });
    } finally {
      setDisputeActionLoadingId(null);
    }
  };

  const rejectDispute = async (dispute: AttendanceDispute) => {
    setDisputeActionLoadingId(dispute.id);
    setDisputeMsg(null);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('attendance_disputes')
        .update({ status: 'Rejected', reviewed_at: new Date().toISOString(), reviewed_by: currentUser?.id ?? null })
        .eq('id', dispute.id);
      if (error) throw error;

      setDisputeMsg({ type: 'success', text: 'Dispute rejected.' });
      await fetchDisputes();
    } catch (err: unknown) {
      console.error('Error rejecting dispute:', err);
      setDisputeMsg({ type: 'error', text: errorMessage(err, 'Failed to reject dispute.') });
    } finally {
      setDisputeActionLoadingId(null);
    }
  };

  return {
    disputes,
    setDisputes,
    disputesLoading,
    disputeActionLoadingId,
    disputeMsg,
    fetchDisputes,
    approveDispute,
    rejectDispute,
  };
}
