'use client';

import { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Leave Credits Overview (read-only monitoring, no manual edit).
// Pulls profiles + employee_government_ids + leave_credits separately
// and merges client-side, since not every employee has a leave_credits
// row yet (only created lazily by settle_leave_day() the first time
// they actually use a credit) or a government_ids row (HR hasn't set
// Employment Status yet).
export function useHrLeaveCredits({ fallbackLeaveCredits }: { fallbackLeaveCredits: number }) {
  const [leaveCreditsModalOpen, setLeaveCreditsModalOpen] = useState(false);
  const [leaveCreditsLoading, setLeaveCreditsLoading] = useState(false);
  const [leaveCreditsFetched, setLeaveCreditsFetched] = useState(false);
  const [leaveCreditsData, setLeaveCreditsData] = useState<{
    id: string;
    full_name: string | null;
    employee_id: string | null;
    employment_status: string | null;
    total_credits: number | null;
    used_credits: number | null;
  }[]>([]);

  const fetchLeaveCreditsOverview = async () => {
    setLeaveCreditsLoading(true);
    const year = new Date().getFullYear();
    const [profRes, govRes, creditsRes] = await Promise.all([
      supabase.rpc('get_employee_roster'),
      supabase.from('employee_government_ids').select('user_id, employment_status'),
      supabase.from('leave_credits').select('user_id, total_credits, used_credits').eq('year', year),
    ]);

    if (profRes.error) console.error('Error fetching profiles for leave credits:', profRes.error);
    if (govRes.error) console.error('Error fetching government IDs for leave credits:', govRes.error);
    if (creditsRes.error) console.error('Error fetching leave credits:', creditsRes.error);

    const govMap = new Map((govRes.data || []).map((g: { user_id: string; employment_status: string | null }) => [g.user_id, g.employment_status]));
    const creditsMap = new Map((creditsRes.data || []).map((c: { user_id: string; total_credits: number | null; used_credits: number | null }) => [c.user_id, c]));

    const merged = (profRes.data || []).map((p: { id: string; full_name: string | null; employee_id: string | null }) => {
      const credits = creditsMap.get(p.id);
      return {
        id: p.id,
        full_name: p.full_name,
        employee_id: p.employee_id,
        employment_status: govMap.get(p.id) ?? null,
        total_credits: credits?.total_credits ?? null,
        used_credits: credits?.used_credits ?? null,
      };
    });

    setLeaveCreditsData(merged);
    setLeaveCreditsLoading(false);
  };

  const openLeaveCreditsModal = () => {
    setLeaveCreditsModalOpen(true);
    if (!leaveCreditsFetched) {
      setLeaveCreditsFetched(true);
      fetchLeaveCreditsOverview();
    }
  };

  // Sorted so Regular employees running low on credits surface first --
  // the whole point of a monitoring view is to catch that at a glance.
  const sortedLeaveCreditsData = useMemo(() => {
    return [...leaveCreditsData].sort((a, b) => {
      const aRemaining = a.employment_status === 'Regular' ? (a.total_credits ?? fallbackLeaveCredits) - (a.used_credits ?? 0) : Infinity;
      const bRemaining = b.employment_status === 'Regular' ? (b.total_credits ?? fallbackLeaveCredits) - (b.used_credits ?? 0) : Infinity;
      if (aRemaining !== bRemaining) return aRemaining - bRemaining;
      return (a.full_name ?? '').localeCompare(b.full_name ?? '');
    });
  }, [leaveCreditsData, fallbackLeaveCredits]);

  const getLeaveBalance = (userId?: string) => {
    const employee = leaveCreditsData.find((entry) => entry.id === userId);
    if (!employee || employee.employment_status !== 'Regular') return null;
    return (employee.total_credits ?? fallbackLeaveCredits) - (employee.used_credits ?? 0);
  };

  return {
    leaveCreditsModalOpen,
    setLeaveCreditsModalOpen,
    leaveCreditsLoading,
    leaveCreditsFetched,
    setLeaveCreditsFetched,
    leaveCreditsData,
    sortedLeaveCreditsData,
    fetchLeaveCreditsOverview,
    openLeaveCreditsModal,
    getLeaveBalance,
  };
}
