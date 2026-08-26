// @ts-nocheck
'use client';

// Presentation-only extraction of legacy dashboard JSX. The parent page remains
// the source of truth for typed state, data fetching, and mutations.
export default function ArchivePasswordModal({ context }: { context: Record<string, any> }) {
  const { Spinner, archivePasswordError, archivePasswordInput, archivePasswordModalOpen, archivePasswordVerifying, confirmArchiveWithPassword, setArchivePasswordError, setArchivePasswordInput, setArchivePasswordModalOpen } = context;
  return (
    <>
      {/* ARCHIVE PASSWORD CONFIRMATION MODAL */}
      {archivePasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 backdrop-blur-sm p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-sm card-style shadow-2xl">
            <h3 className="mb-2">Confirm Your Password</h3>
            <p className="text-sm text-slate-400 mb-4">
              For security, re-enter your password to archive records older than 1 year. This moves them
              out of the main tables -- nothing is permanently deleted.
            </p>
            <input
              type="password"
              autoFocus
              placeholder="Your password"
              value={archivePasswordInput}
              onChange={(e) => setArchivePasswordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && archivePasswordInput && !archivePasswordVerifying) {
                  confirmArchiveWithPassword();
                }
              }}
              className="input-field"
            />
            {archivePasswordError && (
              <p className="text-red-600 text-sm font-medium mt-2">⚠️ {archivePasswordError}</p>
            )}
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setArchivePasswordModalOpen(false);
                  setArchivePasswordInput('');
                  setArchivePasswordError(null);
                }}
                className="flex-1 p-3 bg-slate-100 rounded-full font-medium text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmArchiveWithPassword}
                disabled={!archivePasswordInput || archivePasswordVerifying}
                className="flex-1 btn-primary disabled:opacity-50"
              >
                {archivePasswordVerifying ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner size="sm" />
                    Verifying...
                  </span>
                ) : 'Confirm & Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
