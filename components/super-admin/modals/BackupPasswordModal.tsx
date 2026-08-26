'use client';

import type { Dispatch, SetStateAction } from 'react';
import Spinner from '@/components/Spinner';
import ModalShell from '@/components/shared/ModalShell';

type Props = { open: boolean; onClose: () => void; backupPasswordError: string | null; backupPasswordInput: string; backupPasswordVerifying: boolean; confirmBackupWithPassword: () => void | Promise<void>; setBackupPasswordError: Dispatch<SetStateAction<string | null>>; setBackupPasswordInput: Dispatch<SetStateAction<string>> };

export default function BackupPasswordModal({ open, onClose, backupPasswordError, backupPasswordInput, backupPasswordVerifying, confirmBackupWithPassword, setBackupPasswordError, setBackupPasswordInput }: Props) {
  const close = () => { setBackupPasswordInput(''); setBackupPasswordError(null); onClose(); };
  return <ModalShell open={open} onClose={close} title="Confirm Your Password" size="sm" closeDisabled={backupPasswordVerifying} footer={<div className="flex gap-3"><button type="button" onClick={close} className="flex-1 rounded-full bg-slate-100 p-3 text-sm font-medium">Cancel</button><button type="button" onClick={confirmBackupWithPassword} disabled={!backupPasswordInput || backupPasswordVerifying} className="flex-1 btn-primary disabled:opacity-50">{backupPasswordVerifying ? <span className="flex items-center justify-center gap-2"><Spinner size="sm" />Verifying...</span> : 'Confirm & Backup'}</button></div>}>
    <p className="mb-4 text-sm text-slate-400">For security, re-enter your password to run a full database backup. This includes every user&apos;s account records, and the resulting file will be emailed to you.</p>
    <input type="password" autoFocus placeholder="Your password" value={backupPasswordInput} onChange={(event) => setBackupPasswordInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && backupPasswordInput && !backupPasswordVerifying) void confirmBackupWithPassword(); }} className="input-field" />
    {backupPasswordError && <p role="alert" className="mt-2 text-sm font-medium text-red-600">⚠️ {backupPasswordError}</p>}
  </ModalShell>;
}
