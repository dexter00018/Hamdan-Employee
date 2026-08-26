'use client';

import ModalShell from '@/components/shared/ModalShell';

type Props = {
  open: boolean;
  onClose: () => void;
  month: string;
  onMonthChange: (month: string) => void;
  availableMonths: string[];
  formatMonth: (month: string) => string;
  days: any[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  selectedDay: any;
};

export default function AttendanceCalendarModal({ open, onClose, month, onMonthChange, availableMonths, formatMonth, days, selectedDate, onSelectDate, selectedDay }: Props) {
  return (
    <ModalShell open={open} onClose={onClose} title="Attendance Calendar" description="Monthly attendance overview" icon="🗓️" size="lg">
      <select value={month} onChange={(event) => onMonthChange(event.target.value)} className="input-field mb-4 min-h-11 !py-2 !text-xs">
        {availableMonths.map((value) => <option key={value} value={value}>{formatMonth(value)}</option>)}
      </select>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div key={day} className="py-1 text-center text-[9px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-300">{day}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((cell, index) => {
          if (!cell) return <div key={`empty-${index}`} className="min-h-14 sm:min-h-[66px]" />;
          const status = cell.log?.status?.toLowerCase() || '';
          const color = cell.holiday
            ? 'bg-purple-50 border-purple-200 text-purple-800 dark:bg-purple-950/50 dark:border-purple-800 dark:text-purple-200'
            : status === 'late'
              ? 'bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-950/50 dark:border-orange-800 dark:text-orange-200'
              : status === 'absent'
                ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/50 dark:border-red-800 dark:text-red-200'
                : status.includes('leave')
                  ? 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/50 dark:border-blue-800 dark:text-blue-200'
                  : cell.log
                    ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950/50 dark:border-green-800 dark:text-green-200'
                    : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300';
          return (
            <button type="button" key={cell.date} onClick={() => onSelectDate(cell.date)} aria-label={`${cell.date}: ${cell.holiday || cell.log?.status || 'No record'}`} className={`min-h-14 rounded-xl border p-1.5 text-left transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:min-h-[66px] ${selectedDate === cell.date ? 'ring-2 ring-blue-400' : ''} ${color}`}>
              <p className="text-[10px] font-extrabold">{cell.day}</p>
              <p className="mt-1 line-clamp-2 text-[8px] font-bold leading-tight">{cell.holiday || cell.log?.status || '—'}</p>
              {cell.log?.time_in && <p className="mt-1 hidden text-[8px] sm:block">{new Date(cell.log.time_in).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' })}</p>}
            </button>
          );
        })}
      </div>
      {selectedDay && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-extrabold text-slate-950 dark:text-white">{selectedDay.date}</p>
          {selectedDay.holiday && <p className="mt-1 text-[10px] font-bold text-purple-700 dark:text-purple-300">{selectedDay.holiday}</p>}
          {selectedDay.log ? (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-600 dark:text-slate-300">
              <span><strong>Status:</strong> {selectedDay.log.status}</span>
              <span><strong>Time In:</strong> {selectedDay.log.time_in ? new Date(selectedDay.log.time_in).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' }) : '—'}</span>
              <span><strong>Time Out:</strong> {selectedDay.log.time_out ? new Date(selectedDay.log.time_out).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' }) : '—'}</span>
            </div>
          ) : <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-300">No attendance record for this date.</p>}
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-3 text-[9px] font-bold" aria-label="Calendar legend">
        <span className="text-green-700 dark:text-green-300">● Present</span><span className="text-orange-700 dark:text-orange-300">● Late</span><span className="text-red-700 dark:text-red-300">● Absent</span><span className="text-blue-700 dark:text-blue-300">● Leave</span><span className="text-purple-700 dark:text-purple-300">● Holiday</span>
      </div>
    </ModalShell>
  );
}
