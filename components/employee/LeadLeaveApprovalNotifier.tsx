'use client';

import { useCallback, useEffect, useState } from 'react';
import { BellRing, Check, ClipboardCheck, X } from 'lucide-react';
import ModalShell from '@/components/shared/ModalShell';
import { supabase } from '@/lib/supabase';

type LeaveRequest = {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  created_at: string;
  employee: { full_name: string | null; employee_id: string | null } | null;
};

export default function LeadLeaveApprovalNotifier() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [isLead, setIsLead] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchRequests = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      setIsLead(false);
      setRequests([]);
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('employee_rank,is_active')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile || profile.employee_rank !== 'Lead' || profile.is_active === false) {
      setIsLead(false);
      setRequests([]);
      setLoading(false);
      return;
    }

    setIsLead(true);
    const { data, error } = await supabase
      .from('leave_requests')
      .select(`id,leave_type,start_date,end_date,reason,created_at,
        employee:profiles!leave_requests_user_id_fkey(full_name,employee_id)`)
      .eq('lead_approver_id', user.id)
      .eq('lead_approval_status', 'Pending')
      .eq('status', 'Pending')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching Direct Lead leave approvals:', error);
      setRequests([]);
    } else {
      setRequests((data || []) as unknown as LeaveRequest[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchRequests();
    const interval = window.setInterval(fetchRequests, 60_000);
    const refreshOnVisible = () => {
      if (document.visibilityState === 'visible') void fetchRequests();
    };
    document.addEventListener('visibilitychange', refreshOnVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshOnVisible);
    };
  }, [fetchRequests]);

  const review = async (requestId: string, approve: boolean) => {
    setReviewingId(requestId);
    setMessage(null);
    const { error } = await supabase.rpc('review_team_leave_request', {
      p_request_id: requestId,
      p_approve: approve,
      p_notes: approve ? 'Approved by Direct Lead' : 'Rejected by Direct Lead',
    });

    if (error) {
      setMessage({ type: 'error', text: error.message || 'Unable to review this leave request.' });
      setReviewingId(null);
      return;
    }

    setMessage({
      type: 'success',
      text: approve
        ? 'Approved. This leave request is now routed to HR for final approval.'
        : 'Rejected. This leave request will not be routed to HR.',
    });
    setReviewingId(null);
    await fetchRequests();
  };

  if (!isLead && !loading) return null;
  if (!loading && requests.length === 0 && !open) return null;

  return (
    <>
      {requests.length > 0 && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-[5.75rem] right-3 z-[55] flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-2xl bg-white px-3 py-2.5 text-left shadow-xl transition hover:-translate-y-0.5 dark:bg-[#292f2b] sm:bottom-5 sm:right-5"
          aria-label={`${requests.length} team leave request${requests.length === 1 ? '' : 's'} pending`}
        >
          <span className="relative grid h-10 w-10 flex-none place-items-center rounded-xl bg-violet-600 text-white">
            <BellRing size={18} />
            <span className="absolute -right-1.5 -top-1.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white">{requests.length > 99 ? '99+' : requests.length}</span>
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-bold text-slate-900 dark:text-white">Team leave approval</span>
            <span className="block truncate text-[10px] text-slate-500 dark:text-slate-300">Review before HR receives the request</span>
          </span>
        </button>
      )}

      <ModalShell
        open={open}
        onClose={() => setOpen(false)}
        title="Team Leave Approval"
        description="As Direct Lead, approve or reject your Associates' leave before it is routed to HR."
        icon={<ClipboardCheck size={20} />}
        size="lg"
      >
        <div className="space-y-4">
          {message && (
            <div className={`rounded-xl px-3 py-2 text-xs font-medium ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/35 dark:text-rose-300'}`}>
              {message.text}
            </div>
          )}

          {loading ? (
            <p className="py-7 text-center text-sm text-slate-500">Loading team leave requests…</p>
          ) : requests.length === 0 ? (
            <div className="rounded-2xl bg-emerald-50 px-4 py-6 text-center dark:bg-emerald-950/30">
              <Check className="mx-auto text-emerald-600" size={20} />
              <p className="mt-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">No team leave requests need your approval.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {requests.map((request) => {
                const reviewing = reviewingId === request.id;
                return (
                  <div key={request.id} className="rounded-2xl bg-slate-50 p-3 dark:bg-[#303632]">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{request.employee?.full_name || 'Associate'}</p>
                          {request.employee?.employee_id && <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-300">{request.employee.employee_id}</span>}
                        </div>
                        <p className="mt-1 text-xs font-semibold text-violet-700 dark:text-violet-300">{request.leave_type} Leave · {request.start_date === request.end_date ? request.start_date : `${request.start_date} → ${request.end_date}`}</p>
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-300">{request.reason || 'No reason provided.'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-none">
                        <button type="button" disabled={reviewing} onClick={() => review(request.id, false)} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-rose-50 px-3 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 dark:bg-rose-950/30 dark:text-rose-300"><X size={15} /> Reject</button>
                        <button type="button" disabled={reviewing} onClick={() => review(request.id, true)} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"><Check size={15} /> Approve</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ModalShell>
    </>
  );
}
