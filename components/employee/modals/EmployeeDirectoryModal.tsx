'use client';

import EmptyState from '@/components/shared/EmptyState';
import ModalShell from '@/components/shared/ModalShell';

type Props = { open: boolean; onClose: () => void; loading: boolean; total: number; search: string; onSearchChange: (value: string) => void; employees: any[]; initials: (name: string | null) => string };

export default function EmployeeDirectoryModal({ open, onClose, loading, total, search, onSearchChange, employees, initials }: Props) {
  return (
    <ModalShell open={open} onClose={onClose} title="Employee Directory" description={`${total} account${total === 1 ? '' : 's'}`} icon="👥" size="md">
      <input type="search" placeholder="Search name or designation..." value={search} onChange={(event) => onSearchChange(event.target.value)} className="input-field mb-4 min-h-11 !py-2 !text-xs" />
      <div className="space-y-2">
        {loading && Array.from({ length: 5 }).map((_, index) => <div key={index} className="flex animate-pulse items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800"><div className="h-11 w-11 rounded-full bg-slate-200 dark:bg-slate-700"/><div className="flex-1 space-y-2"><div className="h-3 w-2/3 rounded bg-slate-200 dark:bg-slate-700"/><div className="h-2.5 w-1/3 rounded bg-slate-200 dark:bg-slate-700"/></div></div>)}
        {!loading && employees.length === 0 && <EmptyState icon="🔎" title={search ? 'No matches found' : 'No employees found'} description={search ? 'Try a different name or designation.' : 'Active employees will appear here.'} />}
        {!loading && employees.map((employee) => (
          <article key={employee.id} className="flex min-h-16 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-200">
              {employee.avatar_url ? <img src={employee.avatar_url} alt={employee.full_name ?? 'Employee'} className="h-full w-full object-cover" /> : initials(employee.full_name)}
            </div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold text-slate-950 dark:text-white">{employee.full_name || 'Unknown'}</p><p className="truncate text-xs text-blue-600 dark:text-blue-300">{employee.designation || '—'}</p>{employee.employee_email && <a href={`mailto:${employee.employee_email}`} className="mt-0.5 block truncate text-[10px] text-slate-500 hover:text-blue-600 hover:underline dark:text-slate-300">{employee.employee_email}</a>}</div>
          </article>
        ))}
      </div>
    </ModalShell>
  );
}
