// @ts-nocheck
'use client';

// Presentation-only extraction of legacy dashboard JSX. The parent page remains
// the source of truth for typed state, data fetching, and mutations.
export default function DatabaseBackupModal({ context }: { context: Record<string, any> }) {
  const { Spinner, backupLoading, backupModalOpen, backupResult, handleBackupDatabase, setBackupModalOpen } = context;
  return (
    <>
      {/* DATABASE BACKUP MODAL */}
      {backupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 backdrop-blur-sm p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-sm card-style shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-2xl bg-slate-100 flex items-center justify-center text-base flex-shrink-0">🗄️</span>
                <h3 className="mb-0">Database Backup</h3>
              </div>
              <button
                type="button"
                onClick={() => setBackupModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <p className="text-sm text-slate-400 mb-6">
              Runs a full backup (schema + all data, including the auth schema) of the production Supabase
              database and emails you the .sql file once it completes -- a genuine off-site copy, separate
              from the server this app runs on.
            </p>
            <button
              type="button"
              onClick={handleBackupDatabase}
              disabled={backupLoading}
              className="w-full btn-primary disabled:opacity-50"
            >
              {backupLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner size="sm" />
                  Starting Backup...
                </span>
              ) : 'Backup Database'}
            </button>
            {backupResult && (
              <p className={`text-sm font-medium mt-3 ${backupResult.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                {backupResult.type === 'error' ? `⚠️ ${backupResult.text}` : `✅ ${backupResult.text}`}
              </p>
            )}
            <button
              type="button"
              onClick={() => setBackupModalOpen(false)}
              className="mt-4 w-full py-3 rounded-full bg-slate-100 text-slate-600 font-medium text-sm hover:bg-slate-200 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
