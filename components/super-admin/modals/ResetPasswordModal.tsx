// @ts-nocheck
'use client';

// Presentation-only extraction of legacy dashboard JSX. The parent page remains
// the source of truth for typed state, data fetching, and mutations.
export default function ResetPasswordModal({ context }: { context: Record<string, any> }) {
  const { Spinner, handleResetPassword, resetEmail, resetLoading, resetPasswordModalOpen, resetPasswordMsg, setResetEmail, setResetPasswordModalOpen, setResetPasswordMsg } = context;
  return (
    <>
      {/* ── RESET PASSWORD MODAL ── */}
      {resetPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 backdrop-blur-sm p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-sm card-style shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="mb-0">Reset Password</h3>
              <button
                type="button"
                onClick={() => { setResetPasswordModalOpen(false); setResetPasswordMsg(null); }}
                className="text-slate-400 hover:text-slate-600 transition"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {resetPasswordMsg && (
              <div className={`p-3 rounded-xl text-sm font-bold mb-4 ${resetPasswordMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {resetPasswordMsg.text}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-3">
              <input
                type="email"
                placeholder="Email to reset"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="input-field"
              />

              <button type="submit" disabled={resetLoading} className="btn-primary">
                {resetLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner size="sm" />
                    Sending...
                  </span>
                ) : 'Send Reset Email'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
