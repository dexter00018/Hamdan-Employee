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
                  <div key={`emp-skel-${i}`} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 animate-pulse">
                    <div className="w-9 h-9 rounded-full bg-slate-200 flex-shrink-0" />
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
                  className={`w-full flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-slate-100 transition text-left ${emp.is_active === false ? 'opacity-60' : ''}`}
                >
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-blue-50 text-blue-600 font-bold text-xs flex items-center justify-center">
                    {initials(emp.full_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900 text-sm truncate">{emp.full_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono font-bold text-slate-500 text-xs">{emp.employee_id || '-'}</span>
                      <span className={roleTagClass(emp.role)}>{emp.role}</span>
                      {emp.is_active === false && <span className="tag-absent">Inactive</span>}
                    </div>
                  </div>
                  <span className="text-blue-600 font-bold text-xs flex-shrink-0">Edit</span>
                </button>
              ))}
              {!employeesLoading && employees.length === 0 && (
                <p className="py-8 text-center text-slate-400 text-sm">No accounts found.</p>
              )}
            </div>

            {employees.length > pageSize && (
              <div className="flex items-center justify-between pt-4 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setEmployeesPage((p) => Math.max(1, p - 1))}
                  disabled={employeesPage === 1}
                  className="text-xs font-bold text-blue-600 disabled:text-slate-300 disabled:cursor-not-allowed"
                >
                  ← Prev
                </button>
                <span className="text-slate-400 text-[10px] font-medium">Page {employeesPage} of {employeesTotalPages}</span>
                <button
                  type="button"
                  onClick={() => setEmployeesPage((p) => Math.min(employeesTotalPages, p + 1))}
                  disabled={employeesPage === employeesTotalPages}
                  className="text-xs font-bold text-blue-600 disabled:text-slate-300 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            )}
    </ModalShell>
  );
}
