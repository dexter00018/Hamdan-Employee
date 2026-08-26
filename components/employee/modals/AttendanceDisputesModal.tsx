// @ts-nocheck
'use client';

// Presentation-only extraction of legacy dashboard JSX. The parent page remains
// the source of truth for typed state, data fetching, and mutations.
export default function AttendanceDisputesModal({ context }: { context: Record<string, any> }) {
  const { cancelDispute, cancelingDisputeId, disputeClaimed, disputeFieldLabel, disputeOriginal, disputeTypeLabel, formatDisputeTimePh, myDisputes, myDisputesModalOpen, openDisputeModal, selectedMyDisputeDetail, setMyDisputesModalOpen, setSelectedMyDisputeDetail } = context;
  return (
    <>
      {/* My Disputes Modal -- tap a dispute to see its full details. */}
      {myDisputesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 backdrop-blur-sm p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-sm card-style shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h3 className="mb-0">{selectedMyDisputeDetail ? 'Dispute Details' : 'My Disputes'}</h3>
              <button
                type="button"
                onClick={() => { setMyDisputesModalOpen(false); setSelectedMyDisputeDetail(null); }}
                className="text-slate-400 hover:text-slate-600 transition"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Filing a new dispute lives here now, instead of cluttering
                the Attendance History section -- opens the same choice
                screen (Time In / Time Out) as disputing from a specific row. */}
            {!selectedMyDisputeDetail && (
              <button
                type="button"
                onClick={() => openDisputeModal(null, '', 'TimeIn', false)}
                className="inline-flex items-center justify-center gap-1.5 w-full bg-blue-600 text-white text-xs font-bold px-3.5 py-2.5 rounded-full hover:bg-blue-700 active:scale-95 transition mb-4 flex-shrink-0 shadow-sm"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Report Missing Log
              </button>
            )}

            <div className="overflow-y-auto flex-1">
              {selectedMyDisputeDetail ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setSelectedMyDisputeDetail(null)}
                    className="text-blue-600 text-xs font-bold hover:underline flex items-center gap-1 mb-2"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    Back to list
                  </button>

                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 text-sm">{disputeTypeLabel(selectedMyDisputeDetail)}</span>
                    <span className={selectedMyDisputeDetail.status === 'Approved' ? 'tag-present' : selectedMyDisputeDetail.status === 'Rejected' ? 'tag-late' : 'tag-excused'}>{selectedMyDisputeDetail.status}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                    <div>
                      <p className="label-branded mb-0.5">Dispute Date</p>
                      <p className="text-slate-700 text-xs">{selectedMyDisputeDetail.dispute_date}</p>
                    </div>
                    {disputeOriginal(selectedMyDisputeDetail) && (
                      <div>
                        <p className="label-branded mb-0.5">Original {disputeFieldLabel(selectedMyDisputeDetail)}</p>
                        <p className="text-slate-700 text-xs">{formatDisputeTimePh(disputeOriginal(selectedMyDisputeDetail))}</p>
                      </div>
                    )}
                    <div>
                      <p className="label-branded mb-0.5">Claimed {disputeFieldLabel(selectedMyDisputeDetail)}</p>
                      <p className="text-slate-700 text-xs">{disputeClaimed(selectedMyDisputeDetail) ? formatDisputeTimePh(disputeClaimed(selectedMyDisputeDetail)) : '—'}</p>
                    </div>
                  </div>

                  <div>
                    <p className="label-branded mb-1">Your Reason</p>
                    <p className="text-slate-600 text-xs bg-slate-50 rounded-xl border border-slate-100 p-3">{selectedMyDisputeDetail.reason || 'No reason provided.'}</p>
                  </div>

                  <div>
                    <p className="label-branded mb-1">HR Response</p>
                    <p className="text-slate-600 text-xs bg-slate-50 rounded-xl border border-slate-100 p-3">{selectedMyDisputeDetail.hr_notes || 'No notes were left.'}</p>
                  </div>

                  <div className="text-slate-400 text-[10px] pt-1">
                    {selectedMyDisputeDetail.reviewed_at && (
                      <p>Resolved: {new Date(selectedMyDisputeDetail.reviewed_at).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    )}
                    <p>Filed: {new Date(selectedMyDisputeDetail.created_at).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>

                  {selectedMyDisputeDetail.status === 'Pending' && (
                    <button
                      type="button"
                      onClick={() => cancelDispute(selectedMyDisputeDetail.id)}
                      disabled={cancelingDisputeId === selectedMyDisputeDetail.id}
                      className="w-full py-2.5 rounded-full bg-rose-50 text-rose-600 text-xs font-bold hover:bg-rose-100 transition disabled:opacity-50"
                    >
                      {cancelingDisputeId === selectedMyDisputeDetail.id ? 'Cancelling...' : 'Cancel This Dispute'}
                    </button>
                  )}
                </div>
              ) : myDisputes.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl">
                  <p className="text-2xl mb-2">⚠️</p>
                  <p className="text-slate-400 text-sm font-medium">No disputes yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {myDisputes.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setSelectedMyDisputeDetail(d)}
                      className="w-full flex items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition text-left"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 text-xs truncate">{disputeTypeLabel(d)} — {d.dispute_date}</div>
                        <div className="text-slate-400 text-[10px] mt-0.5">
                          {disputeOriginal(d) && <>{formatDisputeTimePh(disputeOriginal(d))} → </>}
                          {disputeClaimed(d) && formatDisputeTimePh(disputeClaimed(d))}
                        </div>
                      </div>
                      <span className={d.status === 'Approved' ? 'tag-present' : d.status === 'Rejected' ? 'tag-late' : 'tag-excused'}>{d.status}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                if (selectedMyDisputeDetail) {
                  setSelectedMyDisputeDetail(null);
                } else {
                  setMyDisputesModalOpen(false);
                }
              }}
              className="mt-6 w-full py-3 rounded-full bg-slate-100 text-slate-600 font-medium text-sm hover:bg-slate-200 transition flex-shrink-0"
            >
              {selectedMyDisputeDetail ? '← Back' : 'Close'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
