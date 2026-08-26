// @ts-nocheck
'use client';

// Presentation-only extraction of legacy dashboard JSX. The parent page remains
// the source of truth for typed state, data fetching, and mutations.
export default function AnnouncementsModal({ context }: { context: Record<string, any> }) {
  const { LoadingRow, Megaphone, Spinner, announcementContent, announcementId, announcementImageInputRef, announcementImagePreview, announcementImageUrl, announcementLoading, announcementMsg, announcementOpen, announcementRemoveImage, announcementSaving, announcementUpdatedAt, clearAnnouncementImage, handleAnnouncementImageChange, publishAnnouncement, setAnnouncementContent, setAnnouncementOpen } = context;
  return (
    <>
        {/* ANNOUNCEMENTS MODULE MODAL */}
        {announcementOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 backdrop-blur-sm p-0 sm:items-center sm:p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget && !announcementSaving) setAnnouncementOpen(false); }}
        >
        <section className="w-full max-w-2xl card-style shadow-2xl max-h-[90vh] flex flex-col !p-4 sm:!p-5" onMouseDown={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between gap-2 mb-4 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center"><Megaphone size={17} strokeWidth={2.4}/></span>
              <h3 className="mb-0 text-sm">
              Announcements
              {announcementUpdatedAt && (
                <span className="block text-[10px] font-medium text-slate-400 normal-case tracking-normal mt-0.5">
                  Last: {new Date(announcementUpdatedAt).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setAnnouncementOpen(false)}
              disabled={announcementSaving}
              className="text-slate-400 hover:text-slate-600 transition disabled:opacity-50"
              aria-label="Close announcements"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <div className="overflow-y-auto flex-1 pr-1">
          {announcementMsg && <div className={`p-2.5 rounded-xl text-xs font-bold mb-3 ${announcementMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{announcementMsg.text}</div>}
          <div className="min-h-[137px]">
          {announcementLoading ? <LoadingRow label="Loading..." /> : (
            <>
              <textarea className="input-field w-full min-h-[80px] resize-y text-sm" placeholder="Type the announcement that all employees will see..." value={announcementContent} onChange={(e) => setAnnouncementContent(e.target.value)} />

              <div className="mt-3">
                {(announcementImagePreview || (announcementImageUrl && !announcementRemoveImage)) ? (
                  <div className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a static asset */}
                    <img
                      src={announcementImagePreview || announcementImageUrl || ''}
                      alt="Announcement attachment"
                      className="max-h-56 max-w-full rounded-xl border border-slate-200 object-contain bg-slate-50"
                    />
                    <button
                      type="button"
                      onClick={clearAnnouncementImage}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white shadow border border-slate-200 flex items-center justify-center text-slate-500 hover:text-red-600 transition"
                      aria-label="Remove image"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ) : (
                  <label className="inline-flex items-center gap-1.5 text-blue-600 text-xs font-bold cursor-pointer hover:underline">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>
                    Add Photo (optional)
                    <input
                      ref={announcementImageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleAnnouncementImageChange(e.target.files?.[0] ?? null)}
                    />
                  </label>
                )}
              </div>

              <button onClick={publishAnnouncement} disabled={announcementSaving || !announcementContent.trim()} className="btn-primary mt-3 !py-2.5 !text-xs disabled:opacity-50">
                {announcementSaving ? <span className="flex items-center justify-center gap-2"><Spinner size="sm"/>Publishing...</span> : announcementId ? 'Update Announcement' : 'Publish Announcement'}
              </button>
            </>
          )}
          </div>
          </div>
          <button
            type="button"
            onClick={() => setAnnouncementOpen(false)}
            disabled={announcementSaving}
            className="mt-4 w-full py-3 rounded-full bg-slate-100 text-slate-600 font-medium text-sm hover:bg-slate-200 transition disabled:opacity-50 flex-shrink-0"
          >
            Close
          </button>
        </section>
        </div>
        )}
    </>
  );
}
