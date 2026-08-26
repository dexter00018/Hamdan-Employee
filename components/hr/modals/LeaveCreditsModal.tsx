'use client';

import ModalShell from '@/components/shared/ModalShell';

type CreditRow = { id: string; full_name?: string | null; employee_id?: string | null; employment_status?: string | null; total_credits?: number | null; used_credits?: number | null };
type Props = { open: boolean; onClose: () => void; fallbackLeaveCredits: number; leaveCreditsLoading: boolean; sortedLeaveCreditsData: CreditRow[] };

export default function LeaveCreditsModal({ open, onClose, fallbackLeaveCredits, leaveCreditsLoading, sortedLeaveCreditsData }: Props) {
  return <ModalShell open={open} onClose={onClose} title="Leave Credits" description={`${new Date().getFullYear()} · Regular employees only`} size="sm">
    <div className="space-y-2">{leaveCreditsLoading && Array.from({ length: 5 }).map((_, index) => <div key={index} className="animate-pulse rounded-2xl border border-slate-100 bg-slate-50 p-3"><div className="mb-2 h-3.5 w-2/3 rounded bg-slate-200"/><div className="h-3 w-1/3 rounded bg-slate-200"/></div>)}{!leaveCreditsLoading && sortedLeaveCreditsData.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No employees found.</p>}{!leaveCreditsLoading && sortedLeaveCreditsData.map((employee) => { const isRegular = employee.employment_status === 'Regular'; const total = employee.total_credits ?? fallbackLeaveCredits; const used = employee.used_credits ?? 0; const remaining = total - used; const isLow = isRegular && remaining <= 3; return <div key={employee.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="min-w-0"><p className="truncate text-xs font-bold text-slate-900">{employee.full_name || 'Unknown'}</p><p className="text-[10px] text-slate-400">{employee.employee_id || '-'}</p></div>{isRegular ? <span className={`flex-shrink-0 text-xs font-extrabold ${isLow ? 'text-orange-600' : 'text-slate-700'}`}>{remaining} / {total}</span> : <span className="flex-shrink-0 text-[10px] font-medium text-slate-400">{employee.employment_status || 'Not set'}</span>}</div>; })}</div>
    <button type="button" onClick={onClose} className="mt-6 w-full rounded-full bg-slate-100 py-3 text-sm font-medium text-slate-600 hover:bg-slate-200">Close</button>
  </ModalShell>;
}
