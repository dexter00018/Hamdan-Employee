// @ts-nocheck
'use client';

// Presentation-only extraction of legacy dashboard JSX. The parent page remains
// the source of truth for typed state, data fetching, and mutations.
export default function BackupPasswordModal({ context }: { context: Record<string, any> }) {
  const { Spinner, backupPasswordError, backupPasswordInput, backupPasswordModalOpen, backupPasswordVerifying, confirmBackupWithPassword, setBackupPasswordError, setBackupPasswordInput, setBackupPasswordModalOpen } = context;
  return (
    <>
      {/* BACKUP PASSWORD CONFIRMATION MODAL */}
      {backupPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 backdrop-blur-sm p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-sm card-style shadow-2xl">
            <h3 className="mb-2">Confirm Your Password</h3>
            <p className="text-sm text-slate-400 mb-4">
              For security, re-enter your password to run a full database backup. This includes every
              user&apos;s account records, and the resulting file will be emailed to you.
            </p>
            <input
              type="password"
              autoFocus
              placeholder="Your password"
              value={backupPasswordInput}
              onChange={(e) => setBackupPasswordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && backupPasswordInput && !backupPasswordVerifying) {
                  confirmBackupWithPassword();
                }
              }}
              className="input-field"
            />
            {backupPasswordError && (
              <p className="text-red-600 text-sm font-medium mt-2">⚠️ {backupPasswordError}</p>
            )}
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setBackupPasswordModalOpen(false);
                  setBackupPasswordInput('');
                  setBackupPasswordError(null);
                }}
                className="flex-1 p-3 bg-slate-100 rounded-full font-medium text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmBackupWithPassword}
                disabled={!backupPasswordInput || backupPasswordVerifying}
                className="flex-1 btn-primary disabled:opacity-50"
              >
                {backupPasswordVerifying ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner size="sm" />
                    Verifying...
                  </span>
                ) : 'Confirm & Backup'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
