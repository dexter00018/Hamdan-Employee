'use client';

import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import ModalShell from '@/components/shared/ModalShell';
import { supabase } from '@/lib/supabase';

type Profile = { id: string; full_name: string | null; employee_id: string | null; designation: string | null; avatar_url: string | null; employee_email: string | null };
type Attendance = { id: string; log_date: string; time_in: string | null; time_out: string | null; status: string | null };
type Credits = { employment_status?: string | null; total_credits?: number | null; used_credits?: number | null } | null;
type ExtraInfo = {
  employeeRank: string | null;
  directLeadName: string | null;
  approvedMinutes: number;
  reservedMinutes: number;
  availableMinutes: number;
};
type Props = { fallbackLeaveCredits: number; formatPh: (iso: string) => string; initials: (name: string | null) => string; openPayslipsModal: (profile: Profile) => void; openProfileChoice: (profile: Profile) => void; quickViewAttendance: Attendance[]; quickViewCredits: Credits; quickViewProfile: Profile | null; scrollToDashboardSection: (id: string) => void; setAttendanceHistoryOpen: Dispatch<SetStateAction<boolean>>; setCutoffFilter: Dispatch<SetStateAction<string>>; setQuickViewProfile: Dispatch<SetStateAction<Profile | null>>; setSearchTerm: Dispatch<SetStateAction<string>>; setSelectedDate: Dispatch<SetStateAction<string>>; statusTagClass: (status: string | null) => string; todayManila: string };

function formatMinutes(totalMinutes: number) {
  const safe = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
}

export default function EmployeeQuickViewModal({ fallbackLeaveCredits, formatPh, initials, openPayslipsModal, openProfileChoice, quickViewAttendance, quickViewCredits, quickViewProfile, scrollToDashboardSection, setAttendanceHistoryOpen, setCutoffFilter, setQuickViewProfile, setSearchTerm, setSelectedDate, statusTagClass, todayManila }: Props) {
  const [extraInfo, setExtraInfo] = useState<ExtraInfo | null>(null);
  const [extraLoading, setExtraLoading] = useState(false);

  useEffect(() => {
    if (!quickViewProfile?.id) {
      setExtraInfo(null);
      return;
    }

    let active = true;
    const employeeId = quickViewProfile.id;

    const loadExtraInfo = async () => {
      setExtraLoading(true);
      const [hierarchyRes, balanceRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('employee_rank,direct_lead_id')
          .eq('id', employeeId)
          .maybeSingle(),
        supabase.rpc('get_hr_offset_balances'),
      ]);

      if (!active) return;

      if (hierarchyRes.error) console.error('Error fetching employee hierarchy:', hierarchyRes.error);
      if (balanceRes.error) console.error('Error fetching employee Offset balance:', balanceRes.error);

      const hierarchy = hierarchyRes.data as { employee_rank?: string | null; direct_lead_id?: string | null } | null;
      let directLeadName: string | null = null;

      if (hierarchy?.direct_lead_id) {
        const { data: lead, error: leadError } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', hierarchy.direct_lead_id)
          .maybeSingle();
        if (leadError) console.error('Error fetching direct lead:', leadError);
        if (active) directLeadName = lead?.full_name ?? null;
      }

      if (!active) return;
      const balance = ((balanceRes.data || []) as any[]).find((row) => row.user_id === employeeId);
      setExtraInfo({
        employeeRank: hierarchy?.employee_rank ?? null,
        directLeadName,
        approvedMinutes: Number(balance?.approved_minutes || 0),
        reservedMinutes: Number(balance?.reserved_minutes || 0),
        availableMinutes: Number(balance?.available_minutes || 0),
      });
      setExtraLoading(false);
    };

    void loadExtraInfo();
    return () => { active = false; };
  }, [quickViewProfile?.id]);

  if (!quickViewProfile) return null;
  const todayLog = quickViewAttendance.find((log) => log.log_date === todayManila);

  return (
    <ModalShell open onClose={() => setQuickViewProfile(null)} title={quickViewProfile.full_name || 'Unknown'} description={`${quickViewProfile.employee_id || 'No ID'} · ${quickViewProfile.designation || 'No designation'}`} icon={initials(quickViewProfile.full_name)} size="md" footer={<div className="grid grid-cols-3 gap-2"><button type="button" onClick={() => { const profile = quickViewProfile; setQuickViewProfile(null); openProfileChoice(profile); }} className="rounded-full bg-slate-900 py-2.5 text-[10px] font-bold text-white hover:bg-slate-700">Profile</button><button type="button" onClick={() => { setSearchTerm(quickViewProfile.full_name || ''); setSelectedDate(''); setCutoffFilter(''); setAttendanceHistoryOpen(true); setQuickViewProfile(null); scrollToDashboardSection('attendance-history'); }} className="rounded-full bg-blue-50 py-2.5 text-[10px] font-bold text-blue-600 hover:bg-blue-100">Attendance</button><button type="button" onClick={() => { const profile = quickViewProfile; setQuickViewProfile(null); openPayslipsModal(profile); }} className="rounded-full bg-emerald-50 py-2.5 text-[10px] font-bold text-emerald-600 hover:bg-emerald-100">Payslips</button></div>}>
      <div className="overflow-y-auto flex-1 pr-1 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100"><p className="label-branded mb-1">Today</p><p className="text-xs font-bold text-slate-800">{todayLog?.status || 'No record'}</p></div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100"><p className="label-branded mb-1">Time In</p><p className="text-xs font-bold text-slate-800">{todayLog?.time_in ? formatPh(todayLog.time_in) : '-'}</p></div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100"><p className="label-branded mb-1">Employment</p><p className="text-xs font-bold text-slate-800">{quickViewCredits?.employment_status || 'Not set'}</p></div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100"><p className="label-branded mb-1">Leave Credits</p><p className="text-xs font-bold text-slate-800">{quickViewCredits?.employment_status === 'Regular' ? `${(quickViewCredits.total_credits ?? fallbackLeaveCredits) - (quickViewCredits.used_credits ?? 0)} remaining` : 'N/A'}</p></div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="rounded-xl bg-slate-50 px-3 py-2.5 border border-slate-100">
            <p className="label-branded mb-1">Rank</p>
            <p className="text-xs font-bold text-slate-800">{extraLoading ? 'Loading…' : extraInfo?.employeeRank || 'Not set'}</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2.5 border border-slate-100">
            <p className="label-branded mb-1">Direct Lead</p>
            <p className="truncate text-xs font-bold text-slate-800">{extraLoading ? 'Loading…' : extraInfo?.directLeadName || (extraInfo?.employeeRank === 'Lead' ? 'HR approval' : 'Not set')}</p>
          </div>
          <div className="rounded-xl bg-cyan-50/80 px-3 py-2.5 border border-cyan-100">
            <p className="label-branded mb-1">Offset Available</p>
            <p className="text-xs font-bold text-cyan-800">{extraLoading ? 'Loading…' : formatMinutes(extraInfo?.availableMinutes || 0)}</p>
            {!extraLoading && extraInfo && (
              <p className="mt-0.5 text-[9px] text-slate-500">Approved {formatMinutes(extraInfo.approvedMinutes)} · Reserved {formatMinutes(extraInfo.reservedMinutes)}</p>
            )}
          </div>
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
