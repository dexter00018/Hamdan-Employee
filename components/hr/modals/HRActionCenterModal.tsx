'use client';

import { CalendarClock, CheckCircle2, ChevronRight, Clock3, Headphones } from 'lucide-react';
import ModalShell from '@/components/shared/ModalShell';

type Props = {
  open: boolean;
  onClose: () => void;
  pendingDisputesCount: number;
  pendingLeaveCount: number;
  openHrSupportCount: number;
  onDisputes: () => void;
  onLeaveRequests: () => void;
  onHelpDesk: () => void;
};

export default function HRActionCenterModal({ open, onClose, pendingDisputesCount, pendingLeaveCount, openHrSupportCount, onDisputes, onLeaveRequests, onHelpDesk }: Props) {
  const total = pendingDisputesCount + pendingLeaveCount + openHrSupportCount;
  const items = [
    { label: 'Pending Disputes', description: 'Review attendance corrections', count: pendingDisputesCount, icon: Clock3, tone: 'from-orange-500 to-red-700', action: onDisputes },
    { label: 'Pending Leave Requests', description: 'Approve or reject submitted leave', count: pendingLeaveCount, icon: CalendarClock, tone: 'from-blue-500 to-indigo-700', action: onLeaveRequests },
    { label: 'Open Help Desk Requests', description: 'Respond to employee concerns', count: openHrSupportCount, icon: Headphones, tone: 'from-sky-500 to-cyan-700', action: onHelpDesk },
  ];

  return (
    <ModalShell open={open} onClose={onClose} title="Notifications" description={`${total} open HR action${total === 1 ? '' : 's'}`} icon={<span className="relative">🔔{total > 0 ? <i className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-rose-500" /> : null}</span>} size="sm">
      {total === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50 px-4 py-10 text-center text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 size={24} />
          <p className="mt-2 text-xs font-bold">All caught up—no pending HR actions.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
          {items.map(({ label, description, count, icon: Icon, tone, action }) => (
            <button key={label} type="button" onClick={() => { onClose(); action(); }} className="group relative flex min-h-18 w-full items-center gap-3 overflow-hidden border-b border-slate-200 bg-white px-3 py-3 text-left transition last:border-b-0 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-500 dark:border-slate-700 dark:bg-[#292f2b] dark:hover:bg-slate-800">
              <span className={`relative grid h-11 w-11 flex-none place-items-center rounded-2xl bg-gradient-to-br text-white shadow-md ${tone}`}><span className="absolute inset-[3px] rounded-[13px] border border-white/25" aria-hidden="true"/><Icon size={19} aria-hidden="true"/></span>
              <span className="min-w-0 flex-1"><span className="block text-xs font-bold text-slate-900 dark:text-white">{label}</span><span className="mt-0.5 block text-[10px] text-slate-500 dark:text-slate-300">{description}</span></span>
              <span className={`grid h-7 min-w-7 place-items-center rounded-full px-2 text-xs font-black ${count > 0 ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}>{count}</span>
              <ChevronRight size={17} className="text-slate-400 transition group-hover:translate-x-0.5" aria-hidden="true"/>
              <span className={`absolute inset-x-4 bottom-0 h-0.5 rounded-t-full bg-gradient-to-r ${tone}`} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </ModalShell>
  );
}
