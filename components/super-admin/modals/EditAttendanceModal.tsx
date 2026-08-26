'use client';

import type { Dispatch, SetStateAction } from 'react';
import Spinner from '@/components/Spinner';
import ModalShell from '@/components/shared/ModalShell';

type EditingLog = { id: string; employeeName: string; timeInLocal: string; timeOutLocal: string; status: string };
type Props = { editingLog: EditingLog | null; logSaving: boolean; saveEditLog: () => void | Promise<void>; setEditingLog: Dispatch<SetStateAction<EditingLog | null>> };

export default function EditAttendanceModal({ editingLog, logSaving, saveEditLog, setEditingLog }: Props) {
  if (!editingLog) return null;
  return (
    <ModalShell open onClose={() => setEditingLog(null)} title="Edit Attendance" description={editingLog.employeeName} size="sm" closeDisabled={logSaving} footer={<div className="flex gap-3"><button type="button" className="flex-1 rounded-full bg-slate-100 p-3 text-sm font-medium" onClick={() => setEditingLog(null)}>Cancel</button><button type="button" className="flex-1 btn-primary disabled:opacity-50" onClick={saveEditLog} disabled={logSaving || !editingLog.timeInLocal}>{logSaving ? <span className="flex items-center justify-center gap-2"><Spinner size="sm" />Saving...</span> : 'Save'}</button></div>}>
            <label className="label-branded">Time In (Philippine Time)</label>
            <input
              type="datetime-local"
              className="input-field mb-4"
              value={editingLog.timeInLocal}
              onChange={(e) =>
                setEditingLog({ ...editingLog, timeInLocal: e.target.value })
              }
            />

            <label className="label-branded">Time Out (Philippine Time)</label>
            <input
              type="datetime-local"
              className="input-field mb-1"
              value={editingLog.timeOutLocal}
              onChange={(e) =>
                setEditingLog({ ...editingLog, timeOutLocal: e.target.value })
              }
            />
            {editingLog.timeOutLocal && (
              <button
                type="button"
                onClick={() => setEditingLog({ ...editingLog, timeOutLocal: '' })}
                className="text-slate-400 text-xs font-bold hover:text-slate-600 mb-4"
              >
                Clear time out
              </button>
            )}
            {!editingLog.timeOutLocal && <div className="mb-4" />}

            <label className="label-branded">Status</label>
            <select
              className="input-field mb-6"
              value={editingLog.status}
              onChange={(e) =>
                setEditingLog({ ...editingLog, status: e.target.value })
              }
            >
              <option value="Present">Present</option>
              <option value="Late">Late</option>
              <option value="Excused">Excused</option>
              <option value="Absent">Absent</option>
              <option value="Sick Leave">Sick Leave</option>
              <option value="Vacation Leave">Vacation Leave</option>
              <option value="Emergency Leave">Emergency Leave</option>
            </select>

    </ModalShell>
  );
}
