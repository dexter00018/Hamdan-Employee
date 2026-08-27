'use client';

import { BellRing, CircleAlert, Clock3, HandCoins, Headphones, Plane, UserRound } from 'lucide-react';
import ModalShell from '@/components/shared/ModalShell';

type Props = {
  open: boolean;
  onClose: () => void;
  timeOutPending: boolean;
  timeOutDisabled: boolean;
  pendingLeaves: number;
  pendingDisputes: number;
  newPayslips: number;
  openSupport: number;
  profilePercent: number;
  profileIncomplete: boolean;
  onTimeOut: () => void;
  onLeaves: () => void;
  onDisputes: () => void;
  onPayslips: () => void;
  onSupport: () => void;
  onProfile: () => void;
};

export default function EmployeeActionCenterModal(props: Props) {
  const run = (action: () => void) => { props.onClose(); window.setTimeout(action, 0); };
  const items = [
    props.timeOutPending ? { label: 'Time Out pending', detail: 'Complete today’s attendance.', count: 'Action', icon: Clock3, action: props.onTimeOut, disabled: props.timeOutDisabled } : null,
    props.pendingLeaves > 0 ? { label: 'Pending Leave Requests', detail: 'Review your request status.', count: String(props.pendingLeaves), icon: Plane, action: props.onLeaves } : null,
    props.pendingDisputes > 0 ? { label: 'Attendance Disputes', detail: 'Review open corrections.', count: String(props.pendingDisputes), icon: CircleAlert, action: props.onDisputes } : null,
    props.newPayslips > 0 ? { label: 'Latest Payslip Available', detail: 'Review and acknowledge receipt.', count: String(props.newPayslips), icon: HandCoins, action: props.onPayslips } : null,
    props.openSupport > 0 ? { label: 'Support Requests', detail: 'Check the latest helpdesk status.', count: String(props.openSupport), icon: Headphones, action: props.onSupport } : null,
    props.profileIncomplete ? { label: 'Profile Completeness', detail: `${props.profilePercent}% complete`, count: `${props.profilePercent}%`, icon: UserRound, action: props.onProfile } : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <ModalShell open={props.open} onClose={props.onClose} title="Action Center" description={`${items.length} item${items.length === 1 ? '' : 's'} need your attention`} icon={<BellRing size={20} />} size="sm">
      {items.length > 0 ? <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200">{items.map(({ label, detail, count, icon: Icon, action, disabled }) => <button key={label} type="button" onClick={() => run(action)} disabled={disabled} className="flex min-h-16 w-full items-center gap-3 bg-white p-3 text-left transition hover:bg-slate-50 disabled:opacity-50 dark:bg-slate-900 dark:hover:bg-slate-800"><span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-green-50 text-green-700 dark:bg-green-950"><Icon size={17} /></span><span className="min-w-0 flex-1"><span className="block text-xs font-bold text-slate-900 dark:text-white">{label}</span><span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-300">{detail}</span></span><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{count}</span></button>)}</div> : <div className="rounded-2xl border border-green-100 bg-green-50 p-5 text-center"><p className="text-sm font-bold text-green-700">You’re all caught up!</p><p className="mt-1 text-xs text-green-600">No pending employee actions right now.</p></div>}
    </ModalShell>
  );
}
