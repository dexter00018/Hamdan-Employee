'use client';

import type { Dispatch, SetStateAction } from 'react';
import ModalShell from '@/components/shared/ModalShell';

type DetailType = 'present' | 'late' | 'absent';
type Log = { id: string; log_date: string; status: string | null; time_in: string | null; time_out: string | null };
type DetailInfo = { title: string; emptyNote: string; logs: Log[] };
type Props = { formatMonthLabel: (key: string) => string; setSummaryDetailType: Dispatch<SetStateAction<DetailType | null>>; statusTagClass: (status: string | null) => string; summaryCutoffKey: string; summaryDetailInfo: DetailInfo | null; summaryDetailType: DetailType | null };

export default function SummaryDetailModal({ formatMonthLabel, setSummaryDetailType, statusTagClass, summaryCutoffKey, summaryDetailInfo, summaryDetailType }: Props) {
  if (!summaryDetailType || !summaryDetailInfo) return null;
  return <ModalShell open onClose={() => setSummaryDetailType(null)} title={summaryDetailInfo.title} description={formatMonthLabel(summaryCutoffKey)} size="sm">
    {summaryDetailInfo.logs.length === 0 ? <div className="rounded-2xl border-2 border-dashed border-slate-200 py-10 text-center"><p className="mb-2 text-2xl">📋</p><p className="text-sm font-medium text-slate-400">{summaryDetailInfo.emptyNote}</p></div> : <div className="space-y-2">{summaryDetailInfo.logs.slice().sort((a, b) => a.log_date < b.log_date ? 1 : -1).map((log) => <div key={log.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="min-w-0"><div className="text-xs font-medium text-slate-900">{new Date(log.log_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div><div className="text-[10px] text-slate-400">{log.log_date}</div></div><div className="flex-shrink-0 text-right"><span className={statusTagClass(log.status)}>{log.status}</span>{log.time_in && <div className="mt-1 text-[10px] text-slate-500">{new Date(log.time_in).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' })}{log.time_out && <> – {new Date(log.time_out).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' })}</>}</div>}</div></div>)}</div>}
    <button type="button" onClick={() => setSummaryDetailType(null)} className="mt-6 w-full rounded-full border border-[#dce7df] bg-[#edf4ef] py-3 text-sm font-medium text-[#405047] transition hover:bg-[#e1ece4] dark:border-[#33443a] dark:bg-[#323833] dark:text-[#dbe7de]">Close</button>
  </ModalShell>;
}
