'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Minus, Plus, Search, WalletCards } from 'lucide-react';
import ModalShell from '@/components/shared/ModalShell';
import { supabase } from '@/lib/supabase';

type Employee = {
  id: string;
  full_name: string | null;
  employee_id: string | null;
  designation: string | null;
  is_active: boolean;
};

type Transaction = {
  user_id: string;
  kind: 'earned' | 'used' | 'converted';
  hours: number;
  minutes: number;
  source: string | null;
  note: string | null;
  created_at: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

function formatOffsetMinutes(totalMinutes: number) {
  const safe = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
}

export default function OffsetManagementModal({ open, onClose }: Props) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [mode, setMode] = useState<'add' | 'deduct'>('add');
  const [hours, setHours] = useState('1');
  const [minutes, setMinutes] = useState('0');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: employeeRows, error: employeeError } = await supabase
      .from('profiles')
      .select('id,full_name,employee_id,designation,is_active')
      .eq('role', 'employee')
      .order('full_name');

    if (employeeError) console.error('Error fetching employees for offset management:', employeeError);

    const allTransactions: Transaction[] = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from('offset_transactions')
        .select('user_id,kind,hours,minutes,source,note,created_at')
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) {
        console.error('Error fetching offset transactions:', error);
        break;
      }
      const page = (data || []) as Transaction[];
      allTransactions.push(...page);
      if (page.length < pageSize) break;
    }

    setEmployees((employeeRows || []) as Employee[]);
    setTransactions(allTransactions);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    fetchData();
  }, [open, fetchData]);

  const balanceMinutes = useMemo(() => {
    const map: Record<string, number> = {};
    for (const transaction of transactions) {
      const amount = transaction.hours * 60 + (transaction.minutes || 0);
      map[transaction.user_id] = (map[transaction.user_id] || 0) + (transaction.kind === 'earned' ? amount : -amount);
    }
    return map;
  }, [transactions]);

  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter((employee) => [employee.full_name, employee.employee_id, employee.designation]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term)));
  }, [employees, search]);

  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId) || null;
  const selectedBalanceMinutes = selectedEmployee ? balanceMinutes[selectedEmployee.id] || 0 : 0;
  const manualHistory = selectedEmployee
    ? transactions.filter((transaction) => transaction.user_id === selectedEmployee.id && transaction.source === 'manual_adjustment').slice(0, 8)
    : [];

  const parsedHours = Math.max(0, Number.parseInt(hours || '0', 10) || 0);
  const parsedMinutes = Math.max(0, Number.parseInt(minutes || '0', 10) || 0);
  const adjustmentMinutes = parsedHours * 60 + parsedMinutes;

  const applyAdjustment = async () => {
    if (!selectedEmployee) {
      setMessage({ type: 'error', text: 'Select an employee first.' });
      return;
    }
    if (parsedHours < 0 || parsedMinutes < 0 || parsedMinutes > 59 || adjustmentMinutes < 1) {
      setMessage({ type: 'error', text: 'Enter at least 1 minute. Minutes must be from 0 to 59.' });
      return;
    }
    if (reason.trim().length < 3) {
      setMessage({ type: 'error', text: 'Please enter a reason for the adjustment.' });
      return;
    }

    setSaving(true);
    setMessage(null);
    const deltaMinutes = mode === 'add' ? adjustmentMinutes : -adjustmentMinutes;
    const { error } = await supabase.rpc('adjust_offset_balance_minutes', {
      p_user_id: selectedEmployee.id,
      p_delta_minutes: deltaMinutes,
      p_reason: reason.trim(),
    });

    if (error) {
      setMessage({ type: 'error', text: error.message || 'Unable to adjust offset balance.' });
      setSaving(false);
      return;
    }

    const formatted = formatOffsetMinutes(adjustmentMinutes);
    setMessage({ type: 'success', text: `${mode === 'add' ? 'Added' : 'Deducted'} ${formatted} of offset for ${selectedEmployee.full_name || 'employee'}.` });
    setHours('1');
    setMinutes('0');
    setReason('');
    setSaving(false);
    await fetchData();
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Offset Management"
      description="Super Admin can manually add or deduct approved offset time by hours and minutes. Every adjustment requires a reason and is written to the audit trail."
      icon={<WalletCards size={20} />}
      size="xl"
    >
      <div className="space-y-4">
        {message && (
          <div className={`rounded-xl px-3 py-2 text-xs font-medium ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/35 dark:text-rose-300'}`}>
            {message.text}
          </div>
        )}

        <label className="relative block">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employee" className="min-h-10 w-full rounded-xl bg-slate-50 pl-9 pr-3 text-xs outline-none dark:bg-[#303632] dark:text-white" />
        </label>

        <div className="grid gap-3 lg:grid-cols-[1fr_1.1fr]">
          <section className="min-h-0 rounded-2xl bg-slate-50 p-2 dark:bg-[#303632]">
            {loading ? (
              <p className="px-3 py-8 text-center text-sm text-slate-500">Loading employees…</p>
            ) : filteredEmployees.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-slate-500">No matching employees.</p>
            ) : (
              <div className="max-h-[420px] space-y-1 overflow-y-auto pr-1">
                {filteredEmployees.map((employee) => {
                  const selected = selectedEmployeeId === employee.id;
                  const balance = balanceMinutes[employee.id] || 0;
                  return (
                    <button key={employee.id} type="button" onClick={() => { setSelectedEmployeeId(employee.id); setMessage(null); }} className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-xl px-3 text-left transition ${selected ? 'bg-white shadow-sm dark:bg-[#292f2b]' : 'hover:bg-white/70 dark:hover:bg-slate-800/60'}`}>
                      <span className="min-w-0"><span className="block truncate text-xs font-bold text-slate-900 dark:text-white">{employee.full_name || 'Employee'}</span><span className="mt-0.5 block truncate text-[10px] text-slate-500">{employee.employee_id || 'No ID'}{employee.designation ? ` · ${employee.designation}` : ''}{employee.is_active ? '' : ' · Inactive'}</span></span>
                      <span className="flex-none rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-bold text-cyan-700 dark:bg-cyan-950/35 dark:text-cyan-300">{formatOffsetMinutes(balance)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-2xl bg-slate-50 p-4 dark:bg-[#303632]">
            {!selectedEmployee ? (
              <div className="grid min-h-56 place-items-center text-center text-sm text-slate-500">Select an employee to adjust offset time.</div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900 dark:text-white">{selectedEmployee.full_name || 'Employee'}</p><p className="mt-0.5 text-[10px] text-slate-500">{selectedEmployee.employee_id || 'No ID'}</p></div>
                  <div className="text-right"><p className="text-2xl font-semibold tracking-tight text-cyan-700 dark:text-cyan-300">{formatOffsetMinutes(selectedBalanceMinutes)}</p><p className="text-[10px] text-slate-500">Current approved balance</p></div>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-xl bg-white p-1 dark:bg-[#292f2b]">
                  <button type="button" onClick={() => setMode('add')} className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition ${mode === 'add' ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}><Plus size={15}/> Add</button>
                  <button type="button" onClick={() => setMode('deduct')} className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition ${mode === 'deduct' ? 'bg-rose-600 text-white' : 'text-slate-500'}`}><Minus size={15}/> Deduct</button>
                </div>

                <div className="grid gap-2 sm:grid-cols-[90px_90px_1fr]">
                  <label><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Hours</span><input type="number" min="0" step="1" value={hours} onChange={(event) => setHours(event.target.value)} className="min-h-10 w-full rounded-xl bg-white px-3 text-sm font-semibold outline-none dark:bg-[#292f2b] dark:text-white" /></label>
                  <label><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Minutes</span><input type="number" min="0" max="59" step="1" value={minutes} onChange={(event) => setMinutes(event.target.value)} className="min-h-10 w-full rounded-xl bg-white px-3 text-sm font-semibold outline-none dark:bg-[#292f2b] dark:text-white" /></label>
                  <label><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Reason</span><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required reason" maxLength={240} className="min-h-10 w-full rounded-xl bg-white px-3 text-xs outline-none dark:bg-[#292f2b] dark:text-white" /></label>
                </div>

                <button type="button" onClick={applyAdjustment} disabled={saving || adjustmentMinutes < 1 || parsedMinutes > 59} className={`min-h-11 w-full rounded-xl text-xs font-bold text-white transition disabled:opacity-50 ${mode === 'add' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
                  {saving ? 'Saving adjustment…' : `${mode === 'add' ? 'Add' : 'Deduct'} ${formatOffsetMinutes(adjustmentMinutes)}`}
                </button>

                <div className="border-t border-slate-200 pt-3 dark:border-slate-700">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Recent manual adjustments</p>
                  {manualHistory.length === 0 ? <p className="text-xs text-slate-500">No manual adjustments yet.</p> : (
                    <div className="space-y-1.5">{manualHistory.map((transaction, index) => {
                      const amount = transaction.hours * 60 + (transaction.minutes || 0);
                      return (
                        <div key={`${transaction.created_at}-${index}`} className="flex items-start justify-between gap-3 rounded-xl bg-white px-3 py-2 dark:bg-[#292f2b]">
                          <div className="min-w-0"><p className="truncate text-[11px] font-semibold text-slate-800 dark:text-slate-100">{transaction.note || 'Manual adjustment'}</p><p className="mt-0.5 text-[9px] text-slate-500">{new Date(transaction.created_at).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p></div>
                          <span className={`flex-none text-xs font-bold ${transaction.kind === 'earned' ? 'text-emerald-600' : 'text-rose-600'}`}>{transaction.kind === 'earned' ? '+' : '-'}{formatOffsetMinutes(amount)}</span>
                        </div>
                      );
                    })}</div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </ModalShell>
  );
}
