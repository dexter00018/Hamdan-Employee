'use client';

import type { Dispatch, SetStateAction } from 'react';
import { UsersRound } from 'lucide-react';
import { LoadingRow } from '@/components/Spinner';
import ModalShell from '@/components/shared/ModalShell';

type Profile = { id: string; full_name: string | null; employee_id: string | null; designation: string | null; avatar_url: string | null; employee_email: string | null };
type Props = { open: boolean; onClose: () => void; pageSize: number; employeesPage: number; employeesTotalPages: number; initials: (name: string | null) => string; loadingData: boolean; openProfileChoice: (profile: Profile) => void; paginatedProfiles: Profile[]; profiles: Profile[]; setEmployeesPage: Dispatch<SetStateAction<number>> };

export default function EmployeesModal({ open, onClose, pageSize, employeesPage, employeesTotalPages, initials, loadingData, openProfileChoice, paginatedProfiles, profiles, setEmployeesPage }: Props) {
  return <ModalShell open={open} onClose={onClose} title="Employees" description={`${profiles.length} total`} icon={<UsersRound size={17} strokeWidth={2.4}/>} size="md">
    <div className="min-h-[220px] space-y-2">{loadingData && profiles.length === 0 && <LoadingRow label="Loading employees..."/>}{!loadingData && profiles.length === 0 && <p className="text-xs text-slate-400">No employees found.</p>}{paginatedProfiles.map((profile) => <button key={profile.id} onClick={() => openProfileChoice(profile)} className="flex w-full items-center gap-2.5 rounded-2xl border border-slate-100 p-3 text-left transition hover:bg-slate-50"><div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-50 text-[10px] font-bold text-blue-600">{profile.avatar_url ? <img src={profile.avatar_url} alt={profile.full_name ?? 'Employee'} className="h-full w-full object-cover"/> : initials(profile.full_name)}</div><div className="min-w-0"><div className="truncate text-xs font-medium text-slate-900">{profile.full_name}</div><div className="truncate text-[10px] text-blue-600">{profile.designation || '---'}</div></div></button>)}{profiles.length > pageSize && <div className="flex items-center justify-between pt-2"><button type="button" onClick={() => setEmployeesPage((page) => Math.max(1, page - 1))} disabled={employeesPage === 1} className="text-xs font-bold text-blue-600 disabled:text-slate-300">← Prev</button><span className="text-[10px] font-medium text-slate-400">Page {employeesPage} of {employeesTotalPages}</span><button type="button" onClick={() => setEmployeesPage((page) => Math.min(employeesTotalPages, page + 1))} disabled={employeesPage === employeesTotalPages} className="text-xs font-bold text-blue-600 disabled:text-slate-300">Next →</button></div>}</div>
    <button type="button" onClick={onClose} className="mt-4 w-full rounded-full bg-slate-100 py-3 text-sm font-medium text-slate-600 hover:bg-slate-200">Close</button>
  </ModalShell>;
}
