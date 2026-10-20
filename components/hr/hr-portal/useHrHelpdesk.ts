'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

type SupportRow = {
  id: string;
  user_id: string;
  category: string;
  subject: string;
  description: string;
  status: string;
  hr_notes: string | null;
  created_at: string;
  updated_at: string;
  employee: { full_name: string | null; employee_id: string | null } | null;
};

// Employee Help Desk management (non-IT support requests intake).
export function useHrHelpdesk() {
  const [hrSupportModalOpen, setHrSupportModalOpen] = useState(false);
  const [hrSupportRequests, setHrSupportRequests] = useState<SupportRow[]>([]);
  const [hrSupportLoading, setHrSupportLoading] = useState(false);
  const [hrSupportSavingId, setHrSupportSavingId] = useState<string | null>(null);
  const [hrSupportDrafts, setHrSupportDrafts] = useState<Record<string, { status: string; hr_notes: string }>>({});

  const fetchHrSupportRequests = async () => {
    setHrSupportLoading(true);
    const { data, error } = await supabase
      .from('employee_support_requests')
      .select('id, user_id, category, subject, description, status, hr_notes, created_at, updated_at')
      .neq('category', 'IT Concern')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching employee support requests:', error);
      setHrSupportRequests([]);
      setHrSupportDrafts({});
      setHrSupportLoading(false);
      return;
    }

    const requests = (data || []) as Omit<SupportRow, 'employee'>[];
    const employeeIds = [...new Set(requests.map((request) => request.user_id).filter(Boolean))];
    let employeeById: Record<string, { full_name: string | null; employee_id: string | null }> = {};

    if (employeeIds.length > 0) {
      const { data: employees, error: employeesError } = await supabase
        .from('profiles')
        .select('id, full_name, employee_id')
        .in('id', employeeIds);

      if (employeesError) {
        console.error('Error fetching Help Desk employee profiles:', employeesError);
      } else {
        employeeById = Object.fromEntries(
          (employees || []).map((employee: { id: string; full_name: string | null; employee_id: string | null }) => [employee.id, {
            full_name: employee.full_name,
            employee_id: employee.employee_id,
          }])
        );
      }
    }

    const rows = requests.map((request) => ({
      ...request,
      employee: employeeById[request.user_id] || null,
    }));
    setHrSupportRequests(rows);
    setHrSupportDrafts(Object.fromEntries(rows.map((request) => [request.id, { status: request.status, hr_notes: request.hr_notes || '' }])));
    setHrSupportLoading(false);
  };

  const saveHrSupportRequest = async (requestId: string) => {
    const draft = hrSupportDrafts[requestId];
    if (!draft || ['Resolved', 'Cancelled'].includes(hrSupportRequests.find(r => r.id === requestId)?.status ?? '')) return;
    setHrSupportSavingId(requestId);
    const { data: saved, error } = await supabase.from('employee_support_requests').update({ status: draft.status, hr_notes: draft.hr_notes.trim() || null }).eq('id', requestId).neq('category', 'IT Concern').not('status', 'in', '(Resolved,Cancelled)').select('id').maybeSingle();
    if (error || !saved) alert(error?.message || 'Request is already closed or unavailable.');
    else await fetchHrSupportRequests();
    setHrSupportSavingId(null);
  };

  return {
    hrSupportModalOpen,
    setHrSupportModalOpen,
    hrSupportRequests,
    hrSupportLoading,
    hrSupportSavingId,
    hrSupportDrafts,
    setHrSupportDrafts,
    fetchHrSupportRequests,
    saveHrSupportRequest,
  };
}
