// @ts-nocheck
'use client';

// Presentation-only extraction of legacy dashboard JSX. The parent page remains
// the source of truth for typed state, data fetching, and mutations.
export default function EditAttendanceModal({ context }: { context: Record<string, any> }) {
  const { Spinner, editingLog, logSaving, saveEditLog, setEditingLog } = context;
  return (
    <>
      {/* EDIT ATTENDANCE MODAL -- opens on top of the Attendance Records
          modal when a row is tapped. */}
      {editingLog && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 backdrop-blur-sm p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-sm card-style shadow-2xl">
            <h3 className="mb-2">Edit Attendance</h3>
            <p className="text-sm text-slate-400 mb-6">{editingLog.employeeName}</p>

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

            <div className="flex gap-3">
              <button
                type="button"
                className="flex-1 p-3 bg-slate-100 rounded-full font-medium text-sm"
                onClick={() => setEditingLog(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 btn-primary disabled:opacity-50"
                onClick={saveEditLog}
                disabled={logSaving || !editingLog.timeInLocal}
              >
                {logSaving ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner size="sm" />
                    Saving...
                  </span>
                ) : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
