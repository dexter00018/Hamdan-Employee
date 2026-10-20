'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
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
    await fetchHolidays();
    setHolidaySaving(false);
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
  };
}
