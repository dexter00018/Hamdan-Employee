'use client';

import type { Dispatch, SetStateAction } from 'react';
import ModalShell from '@/components/shared/ModalShell';

type Profile = { id: string; full_name: string | null; employee_id: string | null; designation: string | null; avatar_url: string | null; employee_email: string | null };
type Attendance = { id: string; log_date: string; time_in: string | null; time_out: string | null; status: string | null };
type Credits = { employment_status?: string | null; total_credits?: number | null; used_credits?: number | null } | null;
type Props = { fallbackLeaveCredits: number; formatPh: (iso: string) => string; initials: (name: string | null) => string; openPayslipsModal: (profile: Profile) => void; openProfileChoice: (profile: Profile) => void; quickViewAttendance: Attendance[]; quickViewCredits: Credits; quickViewProfile: Profile | null; scrollToDashboardSection: (id: string) => void; setAttendanceHistoryOpen: Dispatch<SetStateAction<boolean>>; setCutoffFilter: Dispatch<SetStateAction<string>>; setQuickViewProfile: Dispatch<SetStateAction<Profile | null>>; setSearchTerm: Dispatch<SetStateAction<string>>; setSelectedDate: Dispatch<SetStateAction<string>>; statusTagClass: (status: string | null) => string; todayManila: string };

export default function EmployeeQuickViewModal({ fallbackLeaveCredits, formatPh, initials, openPayslipsModal, openProfileChoice, quickViewAttendance, quickViewCredits, quickViewProfile, scrollToDashboardSection, setAttendanceHistoryOpen, setCutoffFilter, setQuickViewProfile, setSearchTerm, setSelectedDate, statusTagClass, todayManila }: Props) {
  if (!quickViewProfile) return null;
  return (
    <ModalShell open onClose={() => setQuickViewProfile(null)} title={quickViewProfile.full_name || 'Unknown'} description={`${quickViewProfile.employee_id || 'No ID'} · ${quickViewProfile.designation || 'No designation'}`} icon={initials(quickViewProfile.full_name)} size="md" footer={<div className="grid grid-cols-3 gap-2"><button type="button" onClick={() => { const profile = quickViewProfile; setQuickViewProfile(null); openProfileChoice(profile); }} className="rounded-full bg-slate-900 py-2.5 text-[10px] font-bold text-white hover:bg-slate-700">Profile</button><button type="button" onClick={() => { setSearchTerm(quickViewProfile.full_name || ''); setSelectedDate(''); setCutoffFilter(''); setAttendanceHistoryOpen(true); setQuickViewProfile(null); scrollToDashboardSection('attendance-history'); }} className="rounded-full bg-blue-50 py-2.5 text-[10px] font-bold text-blue-600 hover:bg-blue-100">Attendance</button><button type="button" onClick={() => { const profile = quickViewProfile; setQuickViewProfile(null); openPayslipsModal(profile); }} className="rounded-full bg-emerald-50 py-2.5 text-[10px] font-bold text-emerald-600 hover:bg-emerald-100">Payslips</button></div>}>
              <div className="overflow-y-auto flex-1 pr-1 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100"><p className="label-branded mb-1">Today</p><p className="text-xs font-bold text-slate-800">{quickViewAttendance.find((log) => log.log_date === todayManila)?.status || 'No record'}</p></div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100"><p className="label-branded mb-1">Time In</p><p className="text-xs font-bold text-slate-800">{quickViewAttendance.find((log) => log.log_date === todayManila)?.time_in ? formatPh(quickViewAttendance.find((log) => log.log_date === todayManila)!.time_in as string) : '-'}</p></div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100"><p className="label-branded mb-1">Employment</p><p className="text-xs font-bold text-slate-800">{quickViewCredits?.employment_status || 'Not set'}</p></div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100"><p className="label-branded mb-1">Leave Credits</p><p className="text-xs font-bold text-slate-800">{quickViewCredits?.employment_status === 'Regular' ? `${(quickViewCredits.total_credits ?? fallbackLeaveCredits) - (quickViewCredits.used_credits ?? 0)} remaining` : 'N/A'}</p></div>
                </div>

                <div>
                  <p className="label-branded mb-2">Recent Attendance</p>
                  {quickViewAttendance.length === 0 ? (
                    <p className="p-4 text-center text-xs text-slate-400 rounded-xl border-2 border-dashed border-slate-100">No attendance records yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {quickViewAttendance.map((log) => (
                        <div key={log.id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="text-xs font-medium text-slate-700">{log.log_date}</span>
                          <span className="text-[10px] text-slate-500">{log.time_in ? formatPh(log.time_in) : '-'} → {log.time_out ? formatPh(log.time_out) : 'No time-out'}</span>
                          <span className={statusTagClass(log.status)}>{log.status || '-'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

    </ModalShell>
  );
}
