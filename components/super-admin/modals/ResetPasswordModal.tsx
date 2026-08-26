'use client';

import type { FormEvent } from 'react';
import Spinner from '@/components/Spinner';
import ModalShell from '@/components/shared/ModalShell';

type Feedback = { type: 'success' | 'error'; text: string } | null;
type Props = { open: boolean; onClose: () => void; resetEmail: string; setResetEmail: (value: string) => void; resetLoading: boolean; resetPasswordMsg: Feedback; setResetPasswordMsg: (value: Feedback) => void; handleResetPassword: (event: FormEvent) => void | Promise<void> };

export default function ResetPasswordModal({ open, onClose, resetEmail, setResetEmail, resetLoading, resetPasswordMsg, setResetPasswordMsg, handleResetPassword }: Props) {
  const close = () => { setResetPasswordMsg(null); onClose(); };
  return <ModalShell open={open} onClose={close} title="Reset Password" size="sm" closeDisabled={resetLoading}>
    {resetPasswordMsg && <div role="status" className={`mb-4 rounded-xl p-3 text-sm font-bold ${resetPasswordMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{resetPasswordMsg.text}</div>}
    <form onSubmit={handleResetPassword} className="space-y-3">
      <input type="email" placeholder="Email to reset" required value={resetEmail} onChange={(event) => setResetEmail(event.target.value)} className="input-field" />
      <button type="submit" disabled={resetLoading} className="btn-primary">{resetLoading ? <span className="flex items-center justify-center gap-2"><Spinner size="sm" />Sending...</span> : 'Send Reset Email'}</button>
    </form>
  </ModalShell>;
}
