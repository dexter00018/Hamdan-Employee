'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BellRing, Check, Clock3, X } from 'lucide-react';
import ModalShell from '@/components/shared/ModalShell';
import { supabase } from '@/lib/supabase';

type OffsetRequest = {
  id: string;
  user_id: string;
  eligible_hours: number;
  time_out_at: string;
  created_at: string;
};

type EmployeeProfile = {
  id: string;
  full_name: string | null;
  employee_id: string | null;
};

export default function HROffsetApprovalNotifier() {
  const [requests, setRequests] = useState<OffsetRequest[]>([]);
  const [profiles, setProfiles] = useState<Record<string, EmployeeProfile>>({});
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    const { data, error } = await supabase
      .from('offset_requests')
      .select('id,user_id,eligible_hours,time_out_at,created_at')
      .eq('status', 'Pending')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching pending offset requests:', error);
      setLoading(false);
      return;
    }

    const pending = (data || []) as OffsetRequest[];
    setRequests(pending);

    const ids = [...new Set(pending.map((request) => request.user_id))];
    if (ids.length > 0) {
      const { data: profileRows, error: profileError } = await supabase
        .from('profiles')
        .select('id,full_name,employee_id')
        .in('id', ids);
      if (!profileError) {
        setProfiles(Object.fromEntries(((profileRows || []) as EmployeeProfile[]).map((profile) => [profile.id, profile])));
      }
    } else {
      setProfiles({});
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPending();
    const interval = window.setInterval(fetchPending, 60_000);
    const refreshOnVisible = () => {
      if (document.visibilityState === 'visible') fetchPending();
    };
    document.addEventListener('visibilitychange', refreshOnVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshOnVisible);
    };
  }, [fetchPending]);

  const totalHours = useMemo(
    () => requests.reduce((sum, request) => sum + Number(request.eligible_hours || 0), 0),
    [requests]
  );

  const review = async (requestId: string, approve: boolean) => {
    setReviewingId(requestId);
    setMessage(null);
    const { error } = await supabase.rpc('review_offset_request', {
      p_request_id: requestId,
      p_approve: approve,
      p_notes: approve ? 'Approved by HR' : 'Declined by HR',
    });

    if (error) {
      setMessage(error.message || 'Unable to review this offset request.');
      setReviewingId(null);
      return;
    }

    setRequests((current) => current.filter((request) => request.id !== requestId));
    setMessage(approve ? 'Offset approved. Eligible hours were added to the employee balance.' : 'Offset declined. No hours were added.');
    setReviewingId(null);
  };

  if (!loading && requests.length === 0 && !open) return null;

  return (
    <>
      {requests.length > 0 && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-[5.75rem] right-3 z-[55] flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-2xl border border-cyan-200 bg-white px-3 py-2.5 text-left shadow-xl transition hover:-translate-y-0.5 dark:border-cyan-900 dark:bg-[#292f2b] sm:bottom-5 sm:right-5"
          aria-label={`${requests.length} pending offset approval${requests.length === 1 ? '' : 's'}`}
        >
          <span className="relative grid h-10 w-10 flex-none place-items-center rounded-xl bg-cyan-600 text-white">
            <BellRing size={18} />
            <span className="absolute -right-1.5 -top-1.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white">
              {requests.length > 99 ? '99+' : requests.length}
            </span>
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-bold text-slate-900 dark:text-white">Offset approval needed</span>
            <span className="block truncate text-[10px] text-slate-500 dark:text-slate-300">{requests.length} request{requests.length === 1 ? '' : 's'} · {totalHours} hrs pending</span>
          </span>
        </button>
      )}

      <ModalShell
        open={open}
        onClose={() => setOpen(false)}
        title="Offset Approvals"
        description="Whole hours after 7:00 PM Manila time require HR approval before they become available offset hours."
        icon={<Clock3 size={20} />}
        size="lg"
      >
        <div className="space-y-3">
          {message && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {message}
            </div>
          )}

          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading pending offset requests…</p>
          ) : requests.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50 px-4 py-8 text-center dark:border-emerald-800 dark:bg-emerald-950/30">
              <Check className="mx-auto text-emerald-600" size={24} />
              <p className="mt-2 text-sm font-bold text-emerald-800 dark:text-emerald-300">All offset requests are reviewed.</p>
            </div>
          ) : (
            requests.map((request) => {
              const profile = profiles[request.user_id];
              const isReviewing = reviewingId === request.id;
              return (
                <div key={request.id} className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-[#303632]">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{profile?.full_name || 'Employee'}</p>
                        {profile?.employee_id && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{profile.employee_id}</span>}
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                        Timed out {new Date(request.time_out_at).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300">Eligible: {request.eligible_hours} hour{request.eligible_hours === 1 ? '' : 's'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-none">
                      <button
                        type="button"
                        disabled={isReviewing}
                        onClick={() => review(request.id, false)}
                        className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-rose-200 px-3 text-xs font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"
                      >
                        <X size={15} /> Decline
                      </button>
                      <button
                        type="button"
                        disabled={isReviewing}
                        onClick={() => review(request.id, true)}
                        className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <Check size={15} /> Approve
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ModalShell>
    </>
  );
}
