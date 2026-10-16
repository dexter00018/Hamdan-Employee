'use client';

import { useState } from 'react';
import { ChevronRight, Megaphone, Paperclip } from 'lucide-react';
import ModalShell from '@/components/shared/ModalShell';
import styles from './hr-dashboard.module.css';

type Props = { content: string; imageUrl: string | null; updatedAt: string | null; loading: boolean; onManage: () => void };

export default function HRDashboardAnnouncement({ content, imageUrl, updatedAt, loading, onManage }: Props) {
  const [open, setOpen] = useState(false);
  const available = Boolean(content.trim() || imageUrl);
  const updated = updatedAt ? new Date(updatedAt).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
  return <>
    <section className={styles.announcement} aria-label="Company announcement">
      <button type="button" onClick={() => setOpen(true)} disabled={loading || !available} className={styles.announcementPreview} aria-label="View full company announcement">
        <Megaphone size={24} className={styles.announcementIcon} />
        <span className={styles.announcementCopy}><strong>Announcement</strong><span>{loading ? 'Loading announcement…' : content || (imageUrl ? 'View announcement attachment' : 'No announcements right now.')}</span></span>
        {imageUrl && <Paperclip size={16} className={styles.attachment} aria-label="Includes attachment" />}
        {updated && <small>Updated: {updated}</small>}<ChevronRight size={18} />
      </button>
      <button type="button" onClick={onManage} className={styles.manage}>Manage</button>
    </section>
    <ModalShell open={open && available} onClose={() => setOpen(false)} title="Company Announcement" description={updated ? `Updated: ${updated}` : undefined} size="lg">
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">{content}</p>
      {imageUrl && <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
        {/* eslint-disable-next-line @next/next/no-img-element -- existing company Storage attachment */}
        <img src={imageUrl} alt="Company announcement attachment" className="max-h-[65dvh] w-full object-contain" />
      </div>}
    </ModalShell>
  </>;
}
