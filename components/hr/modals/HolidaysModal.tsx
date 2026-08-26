'use client';

import type { Dispatch, SetStateAction } from 'react';
import { CalendarRange } from 'lucide-react';
import Spinner, { LoadingRow } from '@/components/Spinner';
import ModalShell from '@/components/shared/ModalShell';

type Holiday = { id: string; holiday_date: string; name: string };
type Props = { open: boolean; onClose: () => void; addHoliday: () => void | Promise<void>; deleteHoliday: (id: string) => void | Promise<void>; holidayMsg: { type: 'success' | 'error'; text: string } | null; holidaySaving: boolean; holidays: Holiday[]; holidaysLoading: boolean; newHolidayDate: string; newHolidayName: string; setNewHolidayDate: Dispatch<SetStateAction<string>>; setNewHolidayName: Dispatch<SetStateAction<string>> };

export default function HolidaysModal({ open, onClose, addHoliday, deleteHoliday, holidayMsg, holidaySaving, holidays, holidaysLoading, newHolidayDate, newHolidayName, setNewHolidayDate, setNewHolidayName }: Props) {
  return (
    <ModalShell open={open} onClose={onClose} title="Holidays" description="Dates employees won't be auto-marked Absent" icon={<CalendarRange size={17} strokeWidth={2.4}/>} size="lg" closeDisabled={holidaySaving}>
          <div className="overflow-y-auto flex-1 pr-1">
            {holidayMsg && <div className={`p-2.5 rounded-xl text-xs font-bold mb-3 ${holidayMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{holidayMsg.text}</div>}

            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <input
                type="date"
                value={newHolidayDate}
                onChange={(e) => setNewHolidayDate(e.target.value)}
                className="input-field !py-1.5 !text-xs !min-h-0 sm:!w-44 flex-shrink-0"
              />
              <input
                type="text"
                placeholder="Holiday name (e.g. Independence Day)"
                value={newHolidayName}
                onChange={(e) => setNewHolidayName(e.target.value)}
                className="input-field !py-1.5 !text-xs !min-h-0 flex-1 min-w-0 !text-slate-900"
              />
              <button
                type="button"
                onClick={addHoliday}
                disabled={holidaySaving || !newHolidayDate || !newHolidayName.trim()}
                className="btn-primary !w-auto !py-1.5 !text-xs !px-4 disabled:opacity-50 whitespace-nowrap flex-shrink-0"
              >
                {holidaySaving ? <span className="flex items-center justify-center gap-2"><Spinner size="sm" />Adding...</span> : '+ Add Holiday'}
              </button>
            </div>

            <div className="space-y-1.5 min-h-[80px]">
              {holidaysLoading && <LoadingRow label="Loading holidays..." />}
              {!holidaysLoading && holidays.length === 0 && (
                <p className="text-slate-400 text-xs">No holidays added yet.</p>
              )}
              {!holidaysLoading && holidays.map((h) => (
                <div key={h.id} className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 text-xs">{h.name}</span>
                    <span className="text-slate-400 text-xs"> · {new Date(h.holiday_date).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  <button onClick={() => deleteHoliday(h.id)} className="text-rose-500 hover:text-rose-700 text-xs font-bold flex-shrink-0">Remove</button>
                </div>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={holidaySaving}
            className="mt-4 w-full py-3 rounded-full bg-slate-100 text-slate-600 font-medium text-sm hover:bg-slate-200 transition disabled:opacity-50 flex-shrink-0"
          >
            Close
          </button>
    </ModalShell>
  );
}
