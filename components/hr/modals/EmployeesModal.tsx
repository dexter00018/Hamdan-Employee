// @ts-nocheck
'use client';

// Presentation-only extraction of legacy dashboard JSX. The parent page remains
// the source of truth for typed state, data fetching, and mutations.
export default function EmployeesModal({ context }: { context: Record<string, any> }) {
  const { LoadingRow, PAGE_SIZE, UsersRound, employeesListOpen, employeesPage, employeesTotalPages, initials, loadingData, openProfileChoice, paginatedProfiles, profiles, setEmployeesListOpen, setEmployeesPage } = context;
  return (
    <>
          {/* EMPLOYEES MODULE MODAL */}
          {employeesListOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 backdrop-blur-sm p-0 sm:items-center sm:p-4"
            onMouseDown={(e) => { if (e.target === e.currentTarget) setEmployeesListOpen(false); }}
          >
          <section className="w-full max-w-lg card-style shadow-2xl max-h-[90vh] flex flex-col !p-4 sm:!p-5" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2 mb-4 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center"><UsersRound size={17} strokeWidth={2.4}/></span>
                <h3 className="mb-0 text-sm">
                Employees
                <span className="block text-[10px] font-medium text-slate-400 normal-case tracking-normal mt-0.5">
                  {profiles.length} total
                </span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEmployeesListOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition"
                aria-label="Close employees"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="space-y-2 min-h-[220px] overflow-y-auto flex-1 pr-1">
              {loadingData && profiles.length === 0 && <LoadingRow label="Loading employees..." />}
              {!loadingData && profiles.length === 0 && <p className="text-slate-400 text-xs">No employees found.</p>}
              {paginatedProfiles.map((p) => (
                <button key={p.id} onClick={() => openProfileChoice(p)} className="w-full flex items-center gap-2.5 text-left p-3 rounded-2xl hover:bg-slate-50 border border-slate-100 transition">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-50 text-blue-600 font-bold text-[10px] flex items-center justify-center overflow-hidden">
                    {p.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a static asset
                      <img src={p.avatar_url} alt={p.full_name ?? 'Employee'} className="w-full h-full object-cover" />
                    ) : (
                      initials(p.full_name)
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 text-xs truncate">{p.full_name}</div>
                    <div className="text-blue-600 text-[10px] truncate">{p.designation || '---'}</div>
                  </div>
                </button>
              ))}
              {profiles.length > PAGE_SIZE && (
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setEmployeesPage((p) => Math.max(1, p - 1))}
                    disabled={employeesPage === 1}
                    className="text-xs font-bold text-blue-600 disabled:text-slate-300 disabled:cursor-not-allowed"
                  >
                    ← Prev
                  </button>
                  <span className="text-slate-400 text-[10px] font-medium">Page {employeesPage} of {employeesTotalPages}</span>
                  <button
                    type="button"
                    onClick={() => setEmployeesPage((p) => Math.min(employeesTotalPages, p + 1))}
                    disabled={employeesPage === employeesTotalPages}
                    className="text-xs font-bold text-blue-600 disabled:text-slate-300 disabled:cursor-not-allowed"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setEmployeesListOpen(false)}
              className="mt-4 w-full py-3 rounded-full bg-slate-100 text-slate-600 font-medium text-sm hover:bg-slate-200 transition flex-shrink-0"
            >
              Close
            </button>
          </section>
          </div>
          )}
    </>
  );
}
