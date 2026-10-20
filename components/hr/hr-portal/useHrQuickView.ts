'use client';

// Global employee search + the Quick View state it drives: the modal's
// recent logs and credit snapshot.
import { useMemo, useState } from 'react';
import { type AttendanceLog, type Profile } from './shared';

export function useHrQuickView({ attendance, profiles, leaveCreditsData }: {
  attendance: AttendanceLog[];
  profiles: Profile[];
  leaveCreditsData: { id: string; full_name: string | null; employee_id: string | null; employment_status: string | null; total_credits: number | null; used_credits: number | null }[];
}) {
  const [globalEmployeeSearch, setGlobalEmployeeSearch] = useState('');
  const [quickViewProfile, setQuickViewProfile] = useState<Profile | null>(null);

  const globalEmployeeMatches = useMemo(() => {
    const query = globalEmployeeSearch.trim().toLowerCase();
    if (!query) return [];
    return profiles
      .filter((profile) =>
        profile.full_name?.toLowerCase().includes(query) ||
        profile.employee_id?.toLowerCase().includes(query) ||
        profile.designation?.toLowerCase().includes(query)
      )
      .slice(0, 8);
  }, [globalEmployeeSearch, profiles]);

  const quickViewAttendance = useMemo(() => {
    if (!quickViewProfile) return [];
    return attendance.filter((log) => log.user_id === quickViewProfile.id).slice(0, 5);
  }, [attendance, quickViewProfile]);
  const quickViewCredits = quickViewProfile
    ? leaveCreditsData.find((entry) => entry.id === quickViewProfile.id) ?? null
    : null;

  return {
    globalEmployeeSearch, setGlobalEmployeeSearch,
    quickViewProfile, setQuickViewProfile,
    globalEmployeeMatches, quickViewAttendance, quickViewCredits,
  };
}
