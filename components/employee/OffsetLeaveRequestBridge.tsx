'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Clock3 } from 'lucide-react';
import ModalShell from '@/components/shared/ModalShell';
import { supabase } from '@/lib/supabase';

type Transaction = { kind: 'earned' | 'used' | 'converted'; hours: number; minutes: number };
type UsageReservation = { hours: number };
type LeaveReservation = { offset_minutes_required: number };

const REQUIRED_MINUTES = 9 * 60;

function formatOffsetMinutes(totalMinutes: number) {
  const safe = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
}

export default function OffsetLeaveRequestBridge() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [balanceMinutes, setBalanceMinutes] = useState(0);
  const [pendingUsageMinutes, setPendingUsageMinutes] = useState(0);
  const [pendingLeaveMinutes, setPendingLeaveMinutes] = useState(0);
  const [leaveType, setLeaveType] = useState<'Sick' | 'Vacation' | 'Emergency'>('Vacation');
  const [leaveDate, setLeaveDate] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const availableMinutes = useMemo(
    () => Math.max(0, balanceMinutes - pendingUsageMinutes - pendingLeaveMinutes),
    [balanceMinutes, pendingUsageMinutes, pendingLeaveMinutes]
  );

  const fetchAvailability = useCallback(async () => {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      setMessage({ type: 'error', text: 'Your session could not be verified. Please sign in again.' });
      setLoading(false);
      return;
    }

    const [transactionRes, usageRes, leaveRes] = await Promise.all([
      supabase.from('offset_transactions').select('kind,hours,minutes').eq('user_id', user.id),
      supabase.from('offset_usage_requests').select('hours').eq('user_id', user.id).eq('status', 'Pending'),
      supabase.from('leave_requests').select('offset_minutes_required').eq('user_id', user.id).eq('funding_source', 'offset').eq('status', 'Pending'),
    ]);

    if (transactionRes.error || usageRes.error || leaveRes.error) {
      console.error('Error loading offset leave availability:', transactionRes.error || usageRes.error || leaveRes.error);
      setMessage({ type: 'error', text: 'Unable to load your offset balance right now.' });
      setLoading(false);
      return;
    }

    const transactions = (transactionRes.data || []) as Transaction[];
    const actual = transactions.reduce((total, transaction) => {
      const amount = Number(transaction.hours || 0) * 60 + Number(transaction.minutes || 0);
      return total + (transaction.kind === 'earned' ? amount : -amount);
    }, 0);
    const usage = ((usageRes.data || []) as UsageReservation[]).reduce((total, row) => total + Number(row.hours || 0) * 60, 0);
    const leaves = ((leaveRes.data || []) as LeaveReservation[]).reduce((total, row) => total + Number(row.offset_minutes_required || 0), 0);

    setBalanceMinutes(actual);
    setPendingUsageMinutes(usage);
    setPendingLeaveMinutes(leaves);
    setLoading(false);
  }, []);

  useEffect(() => {
    const show = () => {
      setMessage(null);
      setOpen(true);
    };
    window.addEventListener('employee:open-offset-leave', show);
    return () => window.removeEventListener('employee:open-offset-leave', show);
  }, []);

  useEffect(() => {
    if (!open) return;
    void fetchAvailability();
  }, [open, fetchAvailability]);

  const submit = async () => {
    if (!leaveDate || availableMinutes < REQUIRED_MINUTES) return;
    setSaving(true);
    setMessage(null);

    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      setMessage({ type: 'error', text: 'Your session could not be verified. Please sign in again.' });
      setSaving(false);
      return;
    }

    const { error } = await supabase.from('leave_requests').insert([{
      user_id: user.id,
      leave_type: leaveType,
      start_date: leaveDate,
      end_date: leaveDate,
      reason: reason.trim() || null,
      funding_source: 'offset',
      offset_minutes_required: REQUIRED_MINUTES,
    }]);

    if (error) {
      setMessage({ type: 'error', text: error.message || 'Unable to file leave using offset.' });
      setSaving(false);
      await fetchAvailability();
      return;
    }

    setMessage({ type: 'success', text: 'Leave Using Offset submitted. The 9 hours are reserved now and will only be deducted after final HR approval.' });
    setLeaveDate('');
    setReason('');
    setSaving(false);
    await fetchAvailability();
    window.dispatchEvent(new Event('employee:offset-data-changed'));
  };

  const eligible = availableMinutes >= REQUIRED_MINUTES;

  return (
    <ModalShell
      open={open}
      onClose={() => !saving && setOpen(false)}
      title="Leave Using Offset"
      description="Use 9 approved offset hours for one chargeable working day. Associate requests still go to Direct Lead before HR; Lead requests go directly to HR."
      icon={<CalendarPlus size={20} />}
      size="sm"
      closeDisabled={saving}
    >
      <div className="space-y-4">
        {message && <div className={`rounded-xl px-3 py-2 text-xs font-medium ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/35 dark:text-rose-300'}`}>{message.text}</div>}

        <section className={`rounded-2xl p-4 ${eligible ? 'bg-cyan-50 dark:bg-cyan-950/25' : 'bg-slate-100 dark:bg-slate-800'}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Available offset</p>
              <p className={`mt-1 text-2xl font-semibold ${eligible ? 'text-cyan-800 dark:text-cyan-200' : 'text-slate-500'}`}>{loading ? 'Loading…' : formatOffsetMinutes(availableMinutes)}</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600 shadow-sm dark:bg-[#292f2b] dark:text-slate-300"><Clock3 size={13}/> 9h required</span>
          </div>
          {(pendingUsageMinutes > 0 || pendingLeaveMinutes > 0) && <p className="mt-2 text-[10px] text-slate-500">Pending reservations: {formatOffsetMinutes(pendingUsageMinutes + pendingLeaveMinutes)}.</p>}
        </section>

        {!loading && !eligible && <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">Leave Using Offset is unavailable until you have at least 9 unreserved approved offset hours.</div>}

        <div>
          <label className="label-branded">Leave Type</label>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {(['Sick','Vacation','Emergency'] as const).map((type) => <button key={type} type="button" onClick={() => setLeaveType(type)} className={`rounded-xl px-2 py-2.5 text-xs font-bold transition ${leaveType === type ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{type}</button>)}
          </div>
        </div>

        <div>
          <label className="label-branded">Leave Date</label>
          <input type="date" className="input-field mt-1" value={leaveDate} onChange={(event) => setLeaveDate(event.target.value)} disabled={!eligible || saving}/>
          <p className="mt-1 text-[10px] text-slate-500">One working day per 9-hour offset leave request. Weekends and company holidays are not eligible.</p>
        </div>

        <div>
          <label className="label-branded">Reason (optional)</label>
          <textarea className="input-field mt-1 min-h-[72px] resize-y" value={reason} onChange={(event) => setReason(event.target.value)} disabled={!eligible || saving} placeholder="Reason for leave…"/>
        </div>

        <div className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-600 dark:bg-[#303632] dark:text-slate-300">No offset is deducted while the request is pending. Final HR approval deducts exactly 9 hours. If an approved offset leave is cancelled within the allowed cancellation window, the same 9 hours are automatically refunded.</div>

        <button type="button" onClick={submit} disabled={saving || loading || !eligible || !leaveDate} className="w-full rounded-full bg-cyan-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-45">{saving ? 'Submitting…' : 'Submit Leave Using Offset'}</button>
      </div>
    </ModalShell>
  );
}
