'use client';

import type { Dispatch, FormEvent, SetStateAction } from 'react';
import Spinner from '@/components/Spinner';
import ModalShell from '@/components/shared/ModalShell';

type Employee = { id: string; role?: string | null; is_active?: boolean | null };
type Props = { open: boolean; onClose: () => void; confirmPassword: string; deactivating: boolean; designation: string; editingId: string | null; email: string; emailChecking: boolean; emailConflict: boolean; employeeId: string; employeeIdConflict: string | null; employees: Employee[]; fullName: string; fullNameConflict: boolean | null; handleSave: (event: FormEvent) => void | Promise<void>; loading: boolean; password: string; passwordMismatch: boolean; resetForm: () => void; role: 'employee' | 'admin'; setConfirmPassword: Dispatch<SetStateAction<string>>; setDesignation: Dispatch<SetStateAction<string>>; setEmail: Dispatch<SetStateAction<string>>; setEmployeeId: Dispatch<SetStateAction<string>>; setFullName: Dispatch<SetStateAction<string>>; setPassword: Dispatch<SetStateAction<string>>; setRole: Dispatch<SetStateAction<'employee' | 'admin'>>; toggleAccountActive: (deactivate: boolean) => void | Promise<void> };

export default function AccountFormModal({ open, onClose, confirmPassword, deactivating, designation, editingId, email, emailChecking, emailConflict, employeeId, employeeIdConflict, employees, fullName, fullNameConflict, handleSave, loading, password, passwordMismatch, resetForm, role, setConfirmPassword, setDesignation, setEmail, setEmployeeId, setFullName, setPassword, setRole, toggleAccountActive }: Props) {
  const close = () => { resetForm(); onClose(); };
  return (
    <ModalShell open={open} onClose={close} title={editingId ? 'Edit Account' : 'Create New Account'} size="sm" closeDisabled={loading || deactivating}>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Full Name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input-field"
                />
                {fullNameConflict && (
                  <p className="text-orange-600 text-xs font-medium mt-1.5 ml-1">
                    ⚠️ Another account already uses this name. Make sure you&apos;re not accidentally editing the wrong employee.
                  </p>
                )}
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Employee ID"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="input-field"
                />
                {employeeIdConflict && (
                  <p className="text-red-600 text-xs font-medium mt-1.5 ml-1">
                    ⚠️ This Employee ID is already used by {employeeIdConflict}. Please use a different one.
                  </p>
                )}
              </div>

              <input
                type="text"
                placeholder="Designation"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="input-field"
              />

              {!editingId && (
                <>
                  <div>
                    <input
                      type="email"
                      placeholder="Email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input-field"
                    />
                    {emailChecking && (
                      <p className="text-slate-400 text-xs font-medium mt-1.5 ml-1">
                        Checking email availability...
                      </p>
                    )}
                    {!emailChecking && emailConflict && (
                      <p className="text-red-600 text-xs font-medium mt-1.5 ml-1">
                        ⚠️ An account with this email already exists.
                      </p>
                    )}
                  </div>
                  <input
                    type="password"
                    placeholder="Password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field"
                  />
                  <div>
                    <input
                      type="password"
                      placeholder="Confirm Password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="input-field"
                    />
                    {passwordMismatch && (
                      <p className="text-red-600 text-xs font-medium mt-1.5 ml-1">
                        ⚠️ Passwords do not match.
                      </p>
                    )}
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('employee')}
                  className={`p-3 rounded-full font-bold text-sm transition ${
                    role === 'employee' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  Employee
                </button>
                <button
                  type="button"
                  onClick={() => setRole('admin')}
                  className={`p-3 rounded-full font-bold text-sm transition ${
                    role === 'admin' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  HR Admin
                </button>
              </div>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="w-full p-3 rounded-full font-bold bg-slate-100 text-slate-600"
                >
                  Cancel Edit
                </button>
              )}

              {/* Deactivate / Reactivate -- hidden for super_admin accounts
                  (the API route itself also refuses those, this just keeps
                  the button from showing up as a false option). Sits
                  visually separate as a danger-zone style action. */}
              {editingId && employees.find((e) => e.id === editingId)?.role !== 'super_admin' && (
                <div className="pt-4 border-t border-slate-100">
                  {employees.find((e) => e.id === editingId)?.is_active === false ? (
                    <button
                      type="button"
                      onClick={() => toggleAccountActive(false)}
                      disabled={deactivating}
                      className="w-full p-3 rounded-full font-bold bg-green-50 text-green-700 hover:bg-green-100 transition disabled:opacity-50"
                    >
                      {deactivating ? (
                        <span className="flex items-center justify-center gap-2"><Spinner size="sm" />Reactivating...</span>
                      ) : 'Reactivate Account'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleAccountActive(true)}
                      disabled={deactivating}
                      className="w-full p-3 rounded-full font-bold bg-red-50 text-red-700 hover:bg-red-100 transition disabled:opacity-50"
                    >
                      {deactivating ? (
                        <span className="flex items-center justify-center gap-2"><Spinner size="sm" />Deactivating...</span>
                      ) : 'Deactivate Account'}
                    </button>
                  )}
                  <p className="text-slate-400 text-[11px] mt-2 text-center">
                    Deactivating blocks login but keeps all attendance, leave, and payslip history.
                  </p>
                </div>
              )}

              <button disabled={loading || !!employeeIdConflict || emailConflict || passwordMismatch} className="btn-primary">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner size="sm" />
                    Processing...
                  </span>
                ) : employeeIdConflict
                  ? 'Fix Employee ID Conflict First'
                  : emailConflict
                  ? 'Fix Email Conflict First'
                  : passwordMismatch
                  ? 'Passwords Do Not Match'
                  : editingId
                  ? 'Save Changes'
                  : 'Create Account'}
              </button>
            </form>
    </ModalShell>
  );
}
