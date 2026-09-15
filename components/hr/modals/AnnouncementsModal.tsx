'use client';

import type { Dispatch, RefObject, SetStateAction } from 'react';
import { Megaphone } from 'lucide-react';
import Spinner, { LoadingRow } from '@/components/Spinner';
import ModalShell from '@/components/shared/ModalShell';

type Props = { announcementAlreadyPublished: boolean; open: boolean; onClose: () => void; announcementContent: string; announcementId: string | null; announcementImageInputRef: RefObject<HTMLInputElement | null>; announcementImagePreview: string | null; announcementImageUrl: string | null; announcementLoading: boolean; announcementMsg: { type: 'success' | 'error'; text: string } | null; announcementRemoveImage: boolean; announcementSaving: boolean; announcementUpdatedAt: string | null; clearAnnouncementImage: () => void; handleAnnouncementImageChange: (file: File | null) => void; saveAnnouncement: () => void | Promise<void>; publishAnnouncement: () => void | Promise<void>; setAnnouncementContent: Dispatch<SetStateAction<string>> };

export default function AnnouncementsModal({ announcementAlreadyPublished, open, onClose, announcementContent, announcementId, announcementImageInputRef, announcementImagePreview, announcementImageUrl, announcementLoading, announcementMsg, announcementRemoveImage, announcementSaving, announcementUpdatedAt, clearAnnouncementImage, handleAnnouncementImageChange, saveAnnouncement, publishAnnouncement, setAnnouncementContent }: Props) {
  return (
    <ModalShell open={open} onClose={onClose} title="Announcements" description={announcementUpdatedAt ? `Last: ${new Date(announcementUpdatedAt).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : undefined} icon={<Megaphone size={17} strokeWidth={2.4}/>} size="lg" closeDisabled={announcementSaving}>
          <div className="overflow-y-auto flex-1 pr-1">
          {announcementMsg && <div className={`p-2.5 rounded-xl text-xs font-bold mb-3 ${announcementMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{announcementMsg.text}</div>}
          <div className="min-h-[137px]">
          {announcementLoading ? <LoadingRow label="Loading..." /> : (
            <>
              <textarea disabled={announcementSaving} className="input-field w-full min-h-[80px] resize-y text-sm" placeholder="Type the announcement that all employees will see..." value={announcementContent} onChange={(e) => setAnnouncementContent(e.target.value)} />

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
                      disabled={announcementSaving}
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
                      disabled={announcementSaving}
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleAnnouncementImageChange(e.target.files?.[0] ?? null)}
                    />
                  </label>
                )}
              </div>

              <p className="mt-3 text-xs text-slate-500">Save updates the portal only. Publish &amp; Email also requests an employee email notification. After publishing, edit the text or photo to request another email.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={saveAnnouncement} disabled={announcementSaving || !announcementContent.trim()} className="min-h-11 rounded-full border border-slate-200 px-3 text-xs font-bold disabled:opacity-50">{announcementId ? 'Update Announcement' : 'Save Announcement'}</button>
                <button type="button" onClick={publishAnnouncement} disabled={announcementSaving || announcementAlreadyPublished || !announcementContent.trim()} className="btn-primary !py-2.5 !text-xs disabled:opacity-50 disabled:cursor-not-allowed disabled:!bg-slate-200 disabled:!bg-none disabled:!text-slate-500 disabled:!shadow-none">{announcementSaving ? <span className="flex items-center justify-center gap-2"><Spinner size="sm"/>Saving...</span> : announcementAlreadyPublished ? 'Email Requested' : 'Publish & Email'}</button>
              </div>
            </>
          )}
          </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={announcementSaving}
            className="mt-4 w-full py-3 rounded-full bg-slate-100 text-slate-600 font-medium text-sm hover:bg-slate-200 transition disabled:opacity-50 flex-shrink-0"
          >
            Close
          </button>
    </ModalShell>
  );
}
