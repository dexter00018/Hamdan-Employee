'use client';

import type { Dispatch, SetStateAction } from 'react';
import ModalShell from '@/components/shared/ModalShell';

type Employee = { id: string; full_name: string | null; employee_id?: string | null; role: string; is_active?: boolean | null };
type Props = { open: boolean; onClose: () => void; pageSize: number; employees: Employee[]; employeesLoading: boolean; employeesPage: number; employeesTotalPages: number; initials: (name: string | null) => string; paginatedEmployees: Employee[]; roleTagClass: (role: string) => string; setEmployeesPage: Dispatch<SetStateAction<number>>; startEdit: (employee: Employee) => void; totalAccounts: number };

export default function UserAccountsModal({ open, onClose, pageSize, employees, employeesLoading, employeesPage, employeesTotalPages, initials, paginatedEmployees, roleTagClass, setEmployeesPage, startEdit, totalAccounts }: Props) {
  return (
    <ModalShell open={open} onClose={onClose} title="User Accounts" description={`${totalAccounts} account${totalAccounts === 1 ? '' : 's'}`} size="sm">
            <div className="overflow-y-auto flex-1 space-y-2">
              {employeesLoading && employees.length === 0 && (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={`emp-skel-${i}`} className="grid grid-cols-[2.25rem_minmax(0,1fr)_4.5rem_2rem] items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 animate-pulse dark:border-slate-700 dark:bg-slate-800">
                    <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-700" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-2/3 bg-slate-200 rounded" />
                      <div className="h-3 w-1/3 bg-slate-200 rounded" />
                    </div>
                  </div>
                ))
              )}
              {!employeesLoading && paginatedEmployees.map((emp) => (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => startEdit(emp)}
                  className={`grid w-full grid-cols-[2.25rem_minmax(0,1fr)_4.5rem_2rem] items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-left transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 ${emp.is_active === false ? 'opacity-60' : ''}`}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                    {initials(emp.full_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-950 dark:text-white">{emp.full_name || 'Unnamed account'}</p>
                    <p className="mt-0.5 truncate font-mono text-[10px] font-semibold text-slate-500 dark:text-slate-300">{emp.employee_id || 'No employee ID'}</p>
                  </div>
                  <span className="flex min-w-0 flex-col items-center gap-1"><span className={`${roleTagClass(emp.role)} max-w-full truncate`}>{emp.role}</span>{emp.is_active === false ? <span className="tag-absent">Inactive</span> : null}</span>
                  <span className="text-right text-[11px] font-bold text-emerald-700 dark:text-emerald-300">Edit</span>
                </button>
              ))}
              {!employeesLoading && employees.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-300">No accounts found.</p>
              )}
            </div>

            {employees.length > pageSize && (
              <div className="flex items-center justify-between pt-4 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setEmployeesPage((p) => Math.max(1, p - 1))}
                  disabled={employeesPage === 1}
                  className="text-xs font-bold text-emerald-700 disabled:cursor-not-allowed disabled:text-slate-300 dark:text-emerald-300 dark:disabled:text-slate-600"
                >
                  ← Prev
                </button>
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-300">Page {employeesPage} of {employeesTotalPages}</span>
                <button
                  type="button"
                  onClick={() => setEmployeesPage((p) => Math.min(employeesTotalPages, p + 1))}
                  disabled={employeesPage === employeesTotalPages}
                  className="text-xs font-bold text-emerald-700 disabled:cursor-not-allowed disabled:text-slate-300 dark:text-emerald-300 dark:disabled:text-slate-600"
                >
                  Next →
                </button>
              </div>
            )}
    </ModalShell>
  );
}
