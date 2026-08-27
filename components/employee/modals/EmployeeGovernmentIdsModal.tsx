'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';
import { IdCard, UserRound } from 'lucide-react';
import ModalShell from '@/components/shared/ModalShell';

type Props = {
  open: boolean;
  onClose: () => void;
  employeeName: string;
  designation?: string;
  avatarUrl?: string | null;
  details: ReactNode;
};

export default function EmployeeGovernmentIdsModal({ open, onClose, employeeName, designation, avatarUrl, details }: Props) {
  return (
    <ModalShell open={open} onClose={onClose} title="Government IDs & Profile" description="Your employee and government information" icon={<IdCard size={20} />} size="sm">
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:bg-slate-800">
        <span className="grid h-12 w-12 flex-none place-items-center overflow-hidden rounded-full bg-white text-slate-500 dark:bg-slate-900">
          {avatarUrl ? <Image src={avatarUrl} alt="" width={48} height={48} className="h-full w-full object-cover" /> : <UserRound size={20} />}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">{employeeName}</span>
          <span className="block truncate text-xs text-slate-500 dark:text-slate-300">{designation || 'Employee'}</span>
        </span>
      </div>
      <div className="space-y-3">{details}</div>
    </ModalShell>
  );
}
