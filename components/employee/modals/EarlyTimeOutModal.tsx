'use client';

import Spinner from '@/components/Spinner';
import ModalShell from '@/components/shared/ModalShell';

type Props = { open: boolean; onClose: () => void; expectedTimeOutLabel: string; handleTimeOut: () => void | Promise<void>; timeOutLoading: boolean };

export default function EarlyTimeOutModal({ open, onClose, expectedTimeOutLabel, handleTimeOut, timeOutLoading }: Props) {
  return <ModalShell open={open} onClose={onClose} title="Time Out Early?" icon="⚠️" size="sm" closeDisabled={timeOutLoading} footer={<div className="flex gap-3"><button type="button" className="flex-1 rounded-full bg-slate-100 p-3 text-sm font-medium hover:bg-slate-200" onClick={onClose}>Cancel</button><button type="button" className="flex-1 btn-danger" onClick={() => { onClose(); void handleTimeOut(); }} disabled={timeOutLoading}>{timeOutLoading ? <span className="flex items-center justify-center gap-2"><Spinner size="sm"/>Processing...</span> : 'Yes, Time Out'}</button></div>}>
    <p className="text-sm text-slate-500">It&apos;s not yet {expectedTimeOutLabel}. Are you sure you want to time out now?<span className="mt-1 block text-xs text-slate-400">Current time: {new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: true })} (PH Time)</span></p>
  </ModalShell>;
}
