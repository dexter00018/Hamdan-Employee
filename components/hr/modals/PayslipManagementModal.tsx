// @ts-nocheck
'use client';

// Presentation-only extraction of legacy dashboard JSX. The parent page remains
// the source of truth for typed state, data fetching, and mutations.
export default function PayslipManagementModal({ context }: { context: Record<string, any> }) {
  const { Spinner, closeModal, deletePayslip, employeePayslips, employeePayslipsLoading, generateCutoffOptions, modalMode, payslipCutoff, payslipFile, payslipFileRef, payslipMsg, payslipUploading, publishMsg, publishPayslip, publishingId, selectedProfile, setModalMode, setPayslipCutoff, setPayslipFile, uploadPayslip } = context;
  return (
    <>
      {/* ── PAYSLIPS MODAL ── */}
      {modalMode === 'payslips' && selectedProfile && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 backdrop-blur-sm p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-sm card-style shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="mb-0">Payslips</h3>
                <p className="text-slate-400 text-xs mt-1">{selectedProfile.full_name}</p>
              </div>
              <button
                type="button"
                onClick={() => setModalMode('choice')}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ← Back
              </button>
            </div>

            {/* Existing payslips */}
            {publishMsg && (
              <div className={`p-2.5 rounded-xl text-xs font-bold mb-3 ${publishMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {publishMsg.text}
              </div>
            )}
            {employeePayslipsLoading ? (
              <p className="text-slate-400 text-xs mb-4">Loading payslips...</p>
            ) : employeePayslips.length === 0 ? (
              <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-2xl mb-4">
                <p className="text-slate-400 text-sm">No payslips uploaded yet.</p>
              </div>
            ) : (
              <div className="space-y-2 mb-6">
                {employeePayslips.map((ps) => (
                  <div key={ps.id} className="flex items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{ps.cutoff_label}</p>
                      <p className="text-slate-400 text-[10px] truncate">{ps.file_name}</p>
                      <p className="text-slate-300 text-[10px]">
                        {new Date(ps.uploaded_at).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      {ps.published ? (
                        <span className="tag-present inline-block mt-1">
                          Published{ps.published_at ? ` · ${new Date(ps.published_at).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' })}` : ''}
                        </span>
                      ) : (
                        <span className="tag-excused inline-block mt-1">Not yet published</span>
                      )}
                      {ps.published && (
                        <span className={`inline-block mt-1 ml-1 rounded-full px-2 py-1 text-[9px] font-extrabold uppercase tracking-wide ${ps.acknowledged_at ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                          {ps.acknowledged_at ? `Acknowledged · ${new Date(ps.acknowledged_at).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' })}` : 'Not acknowledged'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {!ps.published && (
                        <button
                          type="button"
                          onClick={() => publishPayslip(ps.id, selectedProfile.id)}
                          disabled={publishingId === ps.id}
                          className="flex-shrink-0 flex items-center gap-1.5 bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-full hover:bg-blue-700 transition disabled:opacity-50"
                        >
                          {publishingId === ps.id ? <><Spinner size="sm" />Publishing...</> : 'Publish'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deletePayslip(ps.id, (ps as any).file_path, selectedProfile.id)}
                        className="flex-shrink-0 text-rose-500 hover:text-rose-700 text-xs font-bold transition px-2"
                        title="Delete payslip"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Upload new payslip */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <p className="label-branded">Upload New Payslip</p>

              {payslipMsg && (
                <div className={`p-2.5 rounded-xl text-xs font-bold ${payslipMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {payslipMsg.text}
                </div>
              )}

              <select className="input-field" value={payslipCutoff} onChange={(e) => setPayslipCutoff(e.target.value)}>
                <option value="">Select cutoff period...</option>
                {generateCutoffOptions().map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              <input
                ref={payslipFileRef}
                type="file"
                accept="application/pdf"
                onChange={(e) => setPayslipFile(e.target.files?.[0] ?? null)}
                className="input-field text-sm file:mr-3 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
              />

              <button
                type="button"
                onClick={() => uploadPayslip(selectedProfile.id)}
                disabled={payslipUploading || !payslipFile || !payslipCutoff}
                className="w-full py-3 rounded-full bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition disabled:opacity-50"
              >
                {payslipUploading ? (
                  <span className="flex items-center justify-center gap-2"><Spinner size="sm" />Uploading...</span>
                ) : 'Upload PDF'}
              </button>

              <button type="button" onClick={closeModal} className="w-full py-3 rounded-full bg-slate-100 text-slate-600 font-medium text-sm hover:bg-slate-200 transition">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
