// @ts-nocheck
'use client';

// Presentation-only extraction of legacy dashboard JSX. The parent page remains
// the source of truth for typed state, data fetching, and mutations.
export default function EmployeeEditModal({ context }: { context: Record<string, any> }) {
  const { Spinner, avatarInputRef, avatarPreview, avatarUploading, closeModal, currentAvatarUrl, editing, editingEmployeeIdConflict, handleAvatarChange, modalMode, saveEdit, saveLoading, setEditing, setModalMode } = context;
  return (
    <>
      {/* ── EDIT PROFILE MODAL ── */}
      {modalMode === 'edit' && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 backdrop-blur-sm p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-sm card-style shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="mb-0">Edit Profile</h3>
              <button
                type="button"
                onClick={() => { setModalMode('choice'); }}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ← Back
              </button>
            </div>

            {/* Profile Photo — HR can upload/replace directly on behalf
                of the employee. Stored in the public "avatars" bucket;
                the URL is only written to profiles.avatar_url on Save. */}
            <div className="mb-6">
              <p className="label-branded mb-2">Profile Photo</p>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-slate-100 overflow-hidden border border-slate-200 flex-shrink-0 flex items-center justify-center">
                  {(avatarPreview || currentAvatarUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a static asset
                    <img src={avatarPreview || currentAvatarUrl || ''} alt="Avatar preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-slate-400 text-[9px] font-bold uppercase tracking-wide text-center px-1">No Photo</span>
                  )}
                </div>
                <label className="inline-flex items-center gap-1.5 text-blue-600 text-xs font-bold cursor-pointer hover:underline">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>
                  {(avatarPreview || currentAvatarUrl) ? 'Change Photo' : 'Upload Photo'}
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleAvatarChange(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </div>

            <input className="input-field mb-3" value={editing.full_name} onChange={e => setEditing({...editing, full_name: e.target.value})} placeholder="Full Name" />
            <div className="mb-3">
              <input className="input-field" value={editing.employee_id} onChange={e => setEditing({...editing, employee_id: e.target.value})} placeholder="Employee ID" />
              {editingEmployeeIdConflict && (
                <p className="text-red-600 text-xs font-medium mt-1.5 ml-1">
                  ⚠️ This Employee ID is already used by {editingEmployeeIdConflict}.
                </p>
              )}
            </div>
            <input className="input-field mb-3" value={editing.designation} onChange={e => setEditing({...editing, designation: e.target.value})} placeholder="Designation" />
            <input
              type="email"
              className="input-field mb-6"
              value={editing.employee_email}
              onChange={e => setEditing({...editing, employee_email: e.target.value})}
              placeholder="Employee Email (for notifications)"
            />

            <div className="mb-6 pt-3 border-t border-slate-100">
              <p className="label-branded mb-3">Government IDs &amp; Employment Details</p>
              <div className="space-y-3">
                <input className="input-field" value={editing.sss_number} onChange={(e) => setEditing({ ...editing, sss_number: e.target.value })} placeholder="SSS Number" />
                <input className="input-field" value={editing.philhealth_number} onChange={(e) => setEditing({ ...editing, philhealth_number: e.target.value })} placeholder="PhilHealth Number" />
                <input className="input-field" value={editing.pagibig_number} onChange={(e) => setEditing({ ...editing, pagibig_number: e.target.value })} placeholder="Pag-IBIG Number" />
                <input className="input-field" value={editing.tin_number} onChange={(e) => setEditing({ ...editing, tin_number: e.target.value })} placeholder="TIN Number" />
                <div>
                  <label className="label-branded">Hired Date</label>
                  <input type="date" className="input-field" value={editing.hired_date} onChange={(e) => setEditing({ ...editing, hired_date: e.target.value })} />
                </div>
                <div>
                  <label className="label-branded">Employment Status</label>
                  <select className="input-field" value={editing.employment_status} onChange={(e) => setEditing({ ...editing, employment_status: e.target.value })}>
                    <option value="">Not set</option>
                    <option value="Regular">Regular</option>
                    <option value="Probationary">Probationary</option>
                    <option value="Contractual">Contractual</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button className="flex-1 p-3 bg-slate-100 rounded-full font-medium text-sm" onClick={closeModal}>Cancel</button>
              <button className="flex-1 btn-primary" onClick={saveEdit} disabled={saveLoading || !!editingEmployeeIdConflict}>
                {saveLoading ? (
                  <span className="flex items-center justify-center gap-2"><Spinner size="sm" />{avatarUploading ? 'Uploading photo...' : 'Saving...'}</span>
                ) : editingEmployeeIdConflict ? 'Fix Conflict First' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
