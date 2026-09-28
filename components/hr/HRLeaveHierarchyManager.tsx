'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Network, RefreshCw, Save } from 'lucide-react';
import ModalShell from '@/components/shared/ModalShell';
import { supabase } from '@/lib/supabase';

type Employee = {
  id: string;
  full_name: string | null;
  employee_id: string | null;
  designation: string | null;
  employee_rank: 'Associate' | 'Lead' | null;
  direct_lead_id: string | null;
  is_active: boolean;
};

export default function HRLeaveHierarchyManager() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [rank, setRank] = useState<'Associate' | 'Lead' | ''>('');
  const [directLeadId, setDirectLeadId] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id,full_name,employee_id,designation,employee_rank,direct_lead_id,is_active')
      .eq('role', 'employee')
      .eq('is_active', true)
      .order('full_name');

    if (error) {
      console.error('Error loading leave hierarchy:', error);
      setMessage({ type: 'error', text: error.message });
    } else {
      setEmployees((data || []) as Employee[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchEmployees();
  }, [fetchEmployees]);

  const selected = employees.find((employee) => employee.id === selectedId) || null;
  const leadOptions = useMemo(
    () => employees.filter((employee) => employee.employee_rank === 'Lead' && employee.id !== selectedId),
    [employees, selectedId]
  );

  const chooseEmployee = (employeeId: string) => {
    setSelectedId(employeeId);
    const employee = employees.find((item) => item.id === employeeId);
    setRank(employee?.employee_rank || '');
    setDirectLeadId(employee?.direct_lead_id || '');
    setMessage(null);
  };

  const saveHierarchy = async () => {
    if (!selected) {
      setMessage({ type: 'error', text: 'Select an employee first.' });
      return;
    }
    if (rank === 'Associate' && !directLeadId) {
      setMessage({ type: 'error', text: 'An Associate must have a Direct Lead.' });
      return;
    }

    setSaving(true);
    setMessage(null);
    const { error } = await supabase.rpc('set_employee_leave_hierarchy', {
      p_employee_id: selected.id,
      p_rank: rank || null,
      p_direct_lead_id: rank === 'Associate' ? directLeadId : null,
    });

    if (error) {
      setMessage({ type: 'error', text: error.message || 'Unable to save leave hierarchy.' });
      setSaving(false);
      return;
    }

    setMessage({
      type: 'success',
      text: rank === 'Associate'
        ? 'Associate and Direct Lead assignment saved.'
        : rank === 'Lead'
          ? 'Employee is now ranked as Lead.'
          : 'Leave ranking cleared.',
    });
    await fetchEmployees();
    setSaving(false);
  };

  const rankedCount = employees.filter((employee) => employee.employee_rank).length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[5.75rem] left-3 z-[54] inline-flex items-center gap-2 rounded-2xl bg-white px-3 py-2.5 text-left shadow-xl transition hover:-translate-y-0.5 dark:bg-[#292f2b] lg:bottom-5 lg:left-[17rem]"
        aria-label="Open leave hierarchy"
      >
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-600 text-white"><Network size={17} /></span>
        <span className="hidden sm:block">
          <span className="block text-xs font-bold text-slate-900 dark:text-white">Leave hierarchy</span>
          <span className="block text-[10px] text-slate-500 dark:text-slate-300">{rankedCount} ranked</span>
        </span>
      </button>

      <ModalShell
        open={open}
        onClose={() => setOpen(false)}
        title="Leave Hierarchy"
        description="HR/Admin assigns leave rank and Direct Lead. Associates require Lead approval before HR review."
        icon={<Network size={20} />}
        size="lg"
      >
        <div className="space-y-4">
          {message && (
            <div className={`rounded-xl px-3 py-2 text-xs font-medium ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/35 dark:text-rose-300'}`}>
              {message.text}
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Employee ranking</p>
              <p className="text-[11px] text-slate-500">Set Leads first, then assign Associates to their Direct Lead.</p>
            </div>
            <button type="button" onClick={fetchEmployees} className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" aria-label="Refresh hierarchy"><RefreshCw size={15} /></button>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_1.1fr]">
            <section className="rounded-2xl bg-slate-50 p-2 dark:bg-[#303632]">
              {loading ? (
                <p className="px-3 py-8 text-center text-sm text-slate-500">Loading employees…</p>
              ) : (
                <div className="max-h-[430px] space-y-1 overflow-y-auto pr-1">
                  {employees.map((employee) => (
                    <button
                      key={employee.id}
                      type="button"
                      onClick={() => chooseEmployee(employee.id)}
                      className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-xl px-3 text-left transition ${selectedId === employee.id ? 'bg-white shadow-sm dark:bg-[#292f2b]' : 'hover:bg-white/70 dark:hover:bg-slate-800/60'}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-bold text-slate-900 dark:text-white">{employee.full_name || 'Employee'}</span>
                        <span className="mt-0.5 block truncate text-[10px] text-slate-500">{employee.employee_id || 'No ID'}{employee.designation ? ` · ${employee.designation}` : ''}</span>
                      </span>
                      <span className={`flex-none rounded-full px-2.5 py-1 text-[10px] font-bold ${employee.employee_rank === 'Lead' ? 'bg-violet-50 text-violet-700 dark:bg-violet-950/35 dark:text-violet-300' : employee.employee_rank === 'Associate' ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/35 dark:text-cyan-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                        {employee.employee_rank || 'Not set'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl bg-slate-50 p-4 dark:bg-[#303632]">
              {!selected ? (
                <div className="grid min-h-56 place-items-center text-center text-sm text-slate-500">Select an employee to set Rank and Direct Lead.</div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{selected.full_name || 'Employee'}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">{selected.employee_id || 'No Employee ID'}</p>
                  </div>

                  <label className="block">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Rank</span>
                    <select value={rank} onChange={(event) => { const value = event.target.value as 'Associate' | 'Lead' | ''; setRank(value); if (value !== 'Associate') setDirectLeadId(''); }} className="min-h-11 w-full rounded-xl bg-white px-3 text-sm font-semibold outline-none dark:bg-[#292f2b] dark:text-white">
                      <option value="">Not set</option>
                      <option value="Associate">Associate</option>
                      <option value="Lead">Lead</option>
                    </select>
                  </label>

                  {rank === 'Associate' && (
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Direct Lead</span>
                      <select value={directLeadId} onChange={(event) => setDirectLeadId(event.target.value)} className="min-h-11 w-full rounded-xl bg-white px-3 text-sm outline-none dark:bg-[#292f2b] dark:text-white">
                        <option value="">Select Direct Lead</option>
                        {leadOptions.map((lead) => <option key={lead.id} value={lead.id}>{lead.full_name || 'Lead'}{lead.employee_id ? ` · ${lead.employee_id}` : ''}</option>)}
                      </select>
                      {leadOptions.length === 0 && <p className="mt-1.5 text-[11px] text-amber-600">No Lead is configured yet. Rank the Lead employee first.</p>}
                    </label>
                  )}

                  <div className="rounded-xl bg-white px-3 py-3 text-[11px] text-slate-600 dark:bg-[#292f2b] dark:text-slate-300">
                    {rank === 'Associate' ? 'Leave route: Associate → Direct Lead → HR final approval.' : rank === 'Lead' ? 'Leads receive leave approvals only for Associates directly assigned to them.' : 'Without Associate rank, leave requests go directly to HR under the current leave flow.'}
                  </div>

                  <button type="button" onClick={saveHierarchy} disabled={saving || (rank === 'Associate' && !directLeadId)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-45 dark:bg-white dark:text-slate-900">
                    <Save size={15} /> {saving ? 'Saving…' : 'Save hierarchy'}
                  </button>
                </div>
              )}
            </section>
          </div>
        </div>
      </ModalShell>
    </>
  );
}
