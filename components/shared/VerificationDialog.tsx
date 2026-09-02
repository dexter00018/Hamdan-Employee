'use client';

import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';
import ModalShell from '@/components/shared/ModalShell';

export type VerificationTone = 'primary' | 'warning' | 'danger';

type Props = { open: boolean; title: string; description: string; confirmLabel: string; cancelLabel?: string; tone?: VerificationTone; details?: string[]; busy?: boolean; onConfirm: () => void | Promise<void>; onCancel: () => void };

const styles = {
  primary: { icon: CheckCircle2, iconClass: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300', button: 'bg-green-700 hover:bg-green-800 focus-visible:ring-green-500' },
  warning: { icon: AlertTriangle, iconClass: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300', button: 'bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500' },
  danger: { icon: ShieldCheck, iconClass: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300', button: 'bg-red-700 hover:bg-red-800 focus-visible:ring-red-500' },
} satisfies Record<VerificationTone, { icon: typeof CheckCircle2; iconClass: string; button: string }>;

export default function VerificationDialog({ open, title, description, confirmLabel, cancelLabel = 'Cancel', tone = 'primary', details = [], busy = false, onConfirm, onCancel }: Props) {
  const style = styles[tone];
  const Icon = style.icon;
  return <ModalShell open={open} onClose={onCancel} title={title} description={description} icon={<span className={`grid h-10 w-10 place-items-center rounded-2xl ${style.iconClass}`}><Icon size={20}/></span>} size="sm" closeDisabled={busy} className="max-w-lg" footer={<div className="grid grid-cols-2 gap-3"><button type="button" onClick={onCancel} disabled={busy} className="min-h-11 rounded-xl border border-slate-300 px-4 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-white dark:hover:bg-slate-800">{cancelLabel}</button><button type="button" onClick={() => void onConfirm()} disabled={busy} className={`min-h-11 rounded-xl px-4 text-xs font-black text-white shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 ${style.button}`}>{busy ? 'Please wait…' : confirmLabel}</button></div>}>
    {details.length ? <div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70">{details.map((detail, index) => <div key={`${detail}-${index}`} className="flex gap-2 text-[11px] leading-relaxed text-slate-700 dark:text-slate-200"><span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-green-600"/><span>{detail}</span></div>)}</div> : null}
  </ModalShell>;
}
