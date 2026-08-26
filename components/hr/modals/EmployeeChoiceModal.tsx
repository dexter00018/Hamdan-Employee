'use client';

import ModalShell from '@/components/shared/ModalShell';

type Profile = { id: string; full_name: string | null; employee_id: string | null; designation: string | null; avatar_url: string | null; employee_email: string | null };
type Props = { open: boolean; onClose: () => void; initials: (name: string | null) => string; openEdit: (profile: Profile) => void; openPayslipsModal: (profile: Profile) => void; selectedProfile: Profile | null };

export default function EmployeeChoiceModal({ open, onClose, initials, openEdit, openPayslipsModal, selectedProfile }: Props) {
  if (!selectedProfile) return null;
  return <ModalShell open={open} onClose={onClose} title={selectedProfile.full_name || 'Employee'} description={selectedProfile.designation || '---'} size="sm" icon={selectedProfile.avatar_url ? <img src={selectedProfile.avatar_url} alt="" className="h-full w-full rounded-2xl object-cover"/> : initials(selectedProfile.full_name)}>
    <div className="space-y-3"><button type="button" onClick={() => openEdit(selectedProfile)} className="w-full rounded-full bg-slate-900 py-3 text-sm font-bold text-white transition hover:bg-slate-700">✏️ Edit Profile</button><button type="button" onClick={() => openPayslipsModal(selectedProfile)} className="w-full rounded-full bg-blue-600 py-3 text-sm font-bold text-white transition hover:bg-blue-700">📄 Payslips</button><button type="button" onClick={onClose} className="w-full rounded-full bg-slate-100 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-200">Cancel</button></div>
  </ModalShell>;
}
