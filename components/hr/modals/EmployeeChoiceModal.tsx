// @ts-nocheck
'use client';

// Presentation-only extraction of legacy dashboard JSX. The parent page remains
// the source of truth for typed state, data fetching, and mutations.
export default function EmployeeChoiceModal({ context }: { context: Record<string, any> }) {
  const { closeModal, initials, modalMode, openEdit, openPayslipsModal, selectedProfile } = context;
  return (
    <>
      {/* ── CHOICE MODAL ── */}
      {modalMode === 'choice' && selectedProfile && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 backdrop-blur-sm p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-xs card-style shadow-2xl text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-blue-50 text-blue-600 font-bold text-sm flex items-center justify-center overflow-hidden">
              {selectedProfile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a static asset
                <img src={selectedProfile.avatar_url} alt={selectedProfile.full_name ?? 'Employee'} className="w-full h-full object-cover" />
              ) : (
                initials(selectedProfile.full_name)
              )}
            </div>
            <h3 className="mb-1">{selectedProfile.full_name}</h3>
            <p className="text-slate-400 text-xs mb-6">{selectedProfile.designation || '---'}</p>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => openEdit(selectedProfile)}
                className="w-full py-3 rounded-full bg-slate-900 text-white font-bold text-sm hover:bg-slate-700 transition"
              >
                ✏️ Edit Profile
              </button>
              <button
                type="button"
                onClick={() => openPayslipsModal(selectedProfile)}
                className="w-full py-3 rounded-full bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition"
              >
                📄 Payslips
              </button>
              <button
                type="button"
                onClick={closeModal}
                className="w-full py-3 rounded-full bg-slate-100 text-slate-600 font-medium text-sm hover:bg-slate-200 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
