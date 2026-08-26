// @ts-nocheck
'use client';

// Presentation-only extraction of legacy dashboard JSX. The parent page remains
// the source of truth for typed state, data fetching, and mutations.
export default function EarlyTimeOutModal({ context }: { context: Record<string, any> }) {
  const { Spinner, expectedTimeOutLabel, handleTimeOut, setShowEarlyTimeOutWarning, showEarlyTimeOutWarning, timeOutLoading } = context;
  return (
    <>
      {/* Early Time-Out Warning Modal */}
      {showEarlyTimeOutWarning && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 backdrop-blur-sm p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-sm card-style shadow-2xl text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-amber-50 flex items-center justify-center text-2xl">
              ⚠️
            </div>
            <h3 className="mb-2">Time Out Early?</h3>
            <p className="text-slate-500 text-sm mb-6">
              It&apos;s not yet {expectedTimeOutLabel}. Are you sure you want to time out now?
              <br />
              <span className="text-slate-400 text-xs mt-1 block">
                Current time: {new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: true })} (PH Time)
              </span>
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                className="flex-1 p-3 bg-slate-100 rounded-full font-medium text-sm hover:bg-slate-200 transition"
                onClick={() => setShowEarlyTimeOutWarning(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 btn-danger"
                onClick={() => {
                  setShowEarlyTimeOutWarning(false);
                  handleTimeOut();
                }}
                disabled={timeOutLoading}
              >
                {timeOutLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner size="sm" />
                    Processing...
                  </span>
                ) : 'Yes, Time Out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
