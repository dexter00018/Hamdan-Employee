'use client';

import type { Dispatch, SetStateAction } from 'react';
import Spinner from '@/components/Spinner';
import ModalShell from '@/components/shared/ModalShell';

type Props = { open: boolean; onClose: () => void; archivePasswordError: string | null; archivePasswordInput: string; archivePasswordVerifying: boolean; confirmArchiveWithPassword: () => void | Promise<void>; setArchivePasswordError: Dispatch<SetStateAction<string | null>>; setArchivePasswordInput: Dispatch<SetStateAction<string>> };

export default function ArchivePasswordModal({ open, onClose, archivePasswordError, archivePasswordInput, archivePasswordVerifying, confirmArchiveWithPassword, setArchivePasswordError, setArchivePasswordInput }: Props) {
  const close = () => { setArchivePasswordInput(''); setArchivePasswordError(null); onClose(); };
  return <ModalShell open={open} onClose={close} title="Confirm Your Password" size="sm" closeDisabled={archivePasswordVerifying} footer={<div className="flex gap-3"><button type="button" onClick={close} className="flex-1 rounded-full bg-slate-100 p-3 text-sm font-medium">Cancel</button><button type="button" onClick={confirmArchiveWithPassword} disabled={!archivePasswordInput || archivePasswordVerifying} className="flex-1 btn-primary disabled:opacity-50">{archivePasswordVerifying ? <span className="flex items-center justify-center gap-2"><Spinner size="sm" />Verifying...</span> : 'Confirm & Archive'}</button></div>}>
    <p className="mb-4 text-sm text-slate-400">For security, re-enter your password to archive records older than 1 year. This moves them out of the main tables -- nothing is permanently deleted.</p>
    <input type="password" autoFocus placeholder="Your password" value={archivePasswordInput} onChange={(event) => setArchivePasswordInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && archivePasswordInput && !archivePasswordVerifying) void confirmArchiveWithPassword(); }} className="input-field" />
    {archivePasswordError && <p role="alert" className="mt-2 text-sm font-medium text-red-600">⚠️ {archivePasswordError}</p>}
  </ModalShell>;
}
