'use client';

import { AlertTriangle, ChevronRight } from 'lucide-react';
import ModalShell from '@/components/shared/ModalShell';

export type AdminAttentionItem = { id: string; title: string; description: string; actionLabel: string; action: () => void };

export default function AdminAttentionModal({ open, onClose, items }: { open: boolean; onClose: () => void; items: AdminAttentionItem[] }) {
  return <ModalShell open={open} onClose={onClose} title="Needs Attention" description={`${items.length} genuine admin warning${items.length === 1 ? '' : 's'}`} icon={<AlertTriangle size={20}/>} size="sm"><div className="space-y-2">{items.map((item) => <button key={item.id} type="button" onClick={() => { onClose(); item.action(); }} className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50/60 p-3 text-left dark:border-orange-800 dark:bg-orange-950/20"><span className="min-w-0 flex-1"><span className="block text-xs font-bold text-slate-950 dark:text-white">{item.title}</span><span className="mt-1 block text-[10px] leading-relaxed text-slate-600 dark:!text-[#c3d0c5]">{item.description}</span><span className="mt-1 block text-[10px] font-bold text-orange-700 dark:text-orange-300">{item.actionLabel}</span></span><ChevronRight size={17} className="flex-none text-orange-600"/></button>)}</div></ModalShell>;
}
