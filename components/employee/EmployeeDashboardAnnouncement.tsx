'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Megaphone, Paperclip } from 'lucide-react';
import ModalShell from '@/components/shared/ModalShell';
import styles from './employee-dashboard.module.css';

type Props = { viewerId: string | null; loading: boolean; error: string | null; content: string; imageUrl: string | null; updatedAt: string | null };

// Only an opaque content fingerprint is cached, never announcement text/images.
function revisionFor(content: string, imageUrl: string | null, updatedAt: string | null) {
  const value = JSON.stringify([content, imageUrl, updatedAt]);
  let first = 5381;
  let second = 52711;
  for (let index = 0; index < value.length; index += 1) {
    first = Math.imul(first, 33) ^ value.charCodeAt(index);
    second = Math.imul(second, 31) ^ value.charCodeAt(index);
  }
  return `v1:${(first >>> 0).toString(36)}:${(second >>> 0).toString(36)}`;
}

export default function EmployeeDashboardAnnouncement({ viewerId, loading, error, content, imageUrl, updatedAt }: Props) {
  const [open, setOpen] = useState(false);
  const autoOpened = useRef(new Set<string>());
  const available = Boolean(content.trim() || imageUrl);
  const revision = revisionFor(content, imageUrl, updatedAt);

  useEffect(() => {
    if (!viewerId || loading || error || !available) return;
    const storageKey = `employee-announcement-seen:v1:${viewerId}`;
    const visitKey = `${viewerId}:${revision}`;
    // An edit arriving while this popup is open is already visible to the user.
    if (open) {
      autoOpened.current.add(visitKey);
      try { sessionStorage.setItem(storageKey, revision); } catch { /* In-memory dedupe remains available. */ }
      return;
    }
    if (autoOpened.current.has(visitKey)) return;
    try {
      if (sessionStorage.getItem(storageKey) === revision) return;
    } catch { /* Still show the announcement if browser storage is unavailable. */ }

    let observer: MutationObserver | undefined;
    const showWhenReady = () => {
      if (autoOpened.current.has(visitKey)) { observer?.disconnect(); return; }
      // Let an existing request/confirmation dialog finish before opening this.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      observer?.disconnect();
      autoOpened.current.add(visitKey);
      try { sessionStorage.setItem(storageKey, revision); } catch { /* In-memory dedupe remains available. */ }
      setOpen(true);
    };
    const timer = window.setTimeout(() => {
      observer = new MutationObserver(showWhenReady);
      observer.observe(document.body, { childList: true, subtree: true });
      showWhenReady();
    }, 0);
    return () => { window.clearTimeout(timer); observer?.disconnect(); };
  }, [viewerId, loading, error, available, revision, open]);

  const openManually = () => {
    if (viewerId) {
      autoOpened.current.add(`${viewerId}:${revision}`);
      try { sessionStorage.setItem(`employee-announcement-seen:v1:${viewerId}`, revision); } catch { /* Manual viewing also works without storage. */ }
    }
    setOpen(true);
  };

  return <>
    <button type="button" className={`dashboard-announcement ${styles.announcement}`} onClick={openManually} disabled={loading || Boolean(error) || !available} aria-label="View full company announcement">
      <span className={styles.announcementIcon}><Megaphone size={23} aria-hidden="true" /></span>
      <span className={styles.announcementLabel}>Announcement</span>
      <span className={styles.announcementText}>{loading ? 'Loading announcement…' : error || content || (imageUrl ? 'View announcement attachment' : 'No announcements right now.')}</span>
      {imageUrl && <Paperclip size={17} aria-label="Includes attachment" />}
      {updatedAt && <span className={styles.announcementDate}>Updated: {updatedAt}</span>}
      <ChevronRight size={19} className={styles.announcementArrow} aria-hidden="true" />
    </button>
    {open && available && <ModalShell open onClose={() => setOpen(false)} title="Company Announcement" description={updatedAt ? `Updated: ${updatedAt}` : undefined} size="lg">
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">{content}</p>
      {imageUrl && <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
        {/* eslint-disable-next-line @next/next/no-img-element -- published company attachment from external Storage */}
        <img src={imageUrl} alt="Company announcement attachment" className="max-h-[65dvh] w-full object-contain" />
      </div>}
    </ModalShell>}
  </>;
}
