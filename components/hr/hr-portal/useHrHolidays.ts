'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { manilaAttendanceDate } from '@/lib/hr-attendance-history';
import { type VerifyFn } from './shared';

// Holidays domain: fetch/add/remove company holidays that feed the
// chargeable-leave calc, the leave calendar, and the attendance sweeps.
export function useHrHolidays({ verify }: { verify: VerifyFn }) {
  const [holidays, setHolidays] = useState<{ id: string; holiday_date: string; name: string }[]>([]);
  const [holidaysLoading, setHolidaysLoading] = useState(false);
  const [holidaysFetched, setHolidaysFetched] = useState(false);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [holidaySaving, setHolidaySaving] = useState(false);
  const [holidayMsg, setHolidayMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [holidaysOpen, setHolidaysOpen] = useState(false);
  // When a holiday is declared for a day that is already over, the
  // absence sweep may have stamped placeholder 'Absent' rows beforehand
  // (it only skips holidays it already knows about). Detected after
  // adding; released with releaseHolidayAbsences on confirmation.
  const [absentReleases, setAbsentReleases] = useState<{ date: string; count: number } | null>(null);

  const fetchHolidays = async () => {
    setHolidaysLoading(true);
    const { data, error } = await supabase
      .from('holidays')
      .select('id, holiday_date, name')
      .order('holiday_date', { ascending: false });

    if (error) {
      console.error('Error fetching holidays:', error);
      setHolidayMsg({ type: 'error', text: error.message });
      setHolidaysLoading(false);
      return;
    }
    setHolidays(data || []);
    setHolidaysLoading(false);
  };

  const toggleHolidays = () => {
    setHolidaysOpen((v) => !v);
    if (!holidaysFetched) {
      setHolidaysFetched(true);
      fetchHolidays();
    }
  };

  const addHoliday = async () => {
    if (!newHolidayDate || !newHolidayName.trim()) {
      setHolidayMsg({ type: 'error', text: 'Please provide both a date and a name.' });
      return;
    }
    setHolidaySaving(true);
    setHolidayMsg(null);

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('holidays').insert([{
      holiday_date: newHolidayDate,
      name: newHolidayName.trim(),
      created_by: user?.id ?? null,
    }]);

    if (error) {
      setHolidayMsg({ type: 'error', text: error.code === '23505' ? 'That date is already marked as a holiday.' : error.message });
      setHolidaySaving(false);
      return;
    }

    setNewHolidayDate('');
    setNewHolidayName('');
    setHolidayMsg({ type: 'success', text: 'Holiday added.' });

    // Declared after the fact? Check whether the automatic absence sweep
    // already stamped placeholder 'Absent' rows for this date, and offer
    // to release them (sweeps only skip holidays they knew about in
    // advance; today and future dates are never swept, so only past
    // dates can carry false Absents).
    if (newHolidayDate < manilaAttendanceDate()) {
      const { count, error: countError } = await supabase
        .from('attendance_logs')
        .select('id', { count: 'exact', head: true })
        .eq('log_date', newHolidayDate)
        .eq('status', 'Absent')
        .is('time_in', null)
        .is('time_out', null);
      if (!countError && count && count > 0) {
        setAbsentReleases({ date: newHolidayDate, count });
      }
    }

    await fetchHolidays();
    setHolidaySaving(false);
  };

  // Removes the sweep's placeholder 'Absent' rows for a retroactively
  // declared holiday. Only rows shaped like the sweep's output (Absent
  // with no time in/out) are deleted; real attendance is never touched.
  const releaseHolidayAbsences = async () => {
    if (!absentReleases) return;
    if (!(await verify({
      title: 'Release false Absent marks?',
      description: `${absentReleases.count} employee${absentReleases.count === 1 ? '' : 's'} were auto-marked Absent for this date before the holiday was declared.`,
      confirmLabel: 'Release marks',
      tone: 'warning',
      details: ['Only automatic placeholder rows (Absent, no time in/out) are removed.', 'Anyone who actually worked that day keeps their record.'],
    }))) return;
    setHolidaySaving(true);
    setHolidayMsg(null);
    try {
      const { data, error } = await supabase.rpc('release_holiday_absences', { p_date: absentReleases.date });
      if (error) throw error;
      setHolidayMsg({ type: 'success', text: `${data ?? absentReleases.count} Absent mark${(data ?? 0) === 1 ? '' : 's'} released for this holiday.` });
      setAbsentReleases(null);
      await fetchHolidays();
    } catch (err) {
      setHolidayMsg({ type: 'error', text: err instanceof Error ? err.message : 'Failed to release Absent marks.' });
    } finally {
      setHolidaySaving(false);
    }
  };

  const deleteHoliday = async (id: string) => {
    if (!await verify({ title: 'Remove this holiday?', description: 'Attendance calculations may change after this date is removed.', confirmLabel: 'Remove holiday', tone: 'danger', details: ['Employees may be marked Absent if the date passes without a Time In.'] })) return;
    const { error } = await supabase.from('holidays').delete().eq('id', id);
    if (error) {
      setHolidayMsg({ type: 'error', text: error.message });
      return;
    }
    await fetchHolidays();
  };

  return {
    holidays,
    holidaysLoading,
    holidaysFetched,
    setHolidaysFetched,
    newHolidayDate,
    setNewHolidayDate,
    newHolidayName,
    setNewHolidayName,
    holidaySaving,
    holidayMsg,
    holidaysOpen,
    setHolidaysOpen,
    toggleHolidays,
    addHoliday,
    deleteHoliday,
    fetchHolidays,
    absentReleases,
    releaseHolidayAbsences,
  };
}
