'use client';

import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/types/hr';
import type { Database } from '@/lib/database.types';

// Announcement domain: load the current announcement, let HR edit /
// publish it (Publish also triggers an email publication marker).
export function useHrAnnouncement() {
  const [announcementId, setAnnouncementId] = useState<string | null>(null);
  const [announcementContent, setAnnouncementContent] = useState('');
  const [announcementImageUrl, setAnnouncementImageUrl] = useState<string | null>(null);
  const [announcementImageFile, setAnnouncementImageFile] = useState<File | null>(null);
  const [announcementImagePreview, setAnnouncementImagePreview] = useState<string | null>(null);
  const [announcementRemoveImage, setAnnouncementRemoveImage] = useState(false);
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const announcementImageInputRef = useRef<HTMLInputElement>(null);
  const [announcementUpdatedAt, setAnnouncementUpdatedAt] = useState<string | null>(null);
  const [announcementLoading, setAnnouncementLoading] = useState(true);
  const [announcementSaving, setAnnouncementSaving] = useState(false);
  const announcementWriteLock = useRef(false);
  const [publishedAnnouncement, setPublishedAnnouncement] = useState<{ content: string; imageUrl: string | null } | null>(null);
  const announcementAlreadyPublished = publishedAnnouncement !== null
    && publishedAnnouncement.content === announcementContent
    && !announcementImageFile
    && publishedAnnouncement.imageUrl === (announcementRemoveImage ? null : announcementImageUrl);
  const [announcementMsg, setAnnouncementMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Loads the current published announcement (if any) so HR can see and
  // edit what's already live before publishing changes.
  const fetchAnnouncement = async () => {
    setAnnouncementLoading(true);
    const { data, error } = await supabase
      .from('announcements')
      .select('id, content, image_url, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching announcement:', error);
      setAnnouncementMsg({ type: 'error', text: error.message });
      setAnnouncementLoading(false);
      return;
    }

    setAnnouncementId(data?.id ?? null);
    setAnnouncementContent(data?.content ?? '');
    setAnnouncementImageUrl(data?.image_url ?? null);
    setAnnouncementImageFile(null);
    setAnnouncementImagePreview(null);
    setAnnouncementRemoveImage(false);
    if (announcementImageInputRef.current) announcementImageInputRef.current.value = '';
    setAnnouncementUpdatedAt(data?.updated_at ?? null);
    setAnnouncementLoading(false);
  };

  const MAX_ANNOUNCEMENT_IMAGE_MB = 5;

  const handleAnnouncementImageChange = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAnnouncementMsg({ type: 'error', text: 'Please choose an image file.' });
      return;
    }
    if (file.size > MAX_ANNOUNCEMENT_IMAGE_MB * 1024 * 1024) {
      setAnnouncementMsg({ type: 'error', text: `Image must be under ${MAX_ANNOUNCEMENT_IMAGE_MB}MB.` });
      return;
    }
    setAnnouncementMsg(null);
    setAnnouncementRemoveImage(false);
    setAnnouncementImageFile(file);
    setAnnouncementImagePreview(URL.createObjectURL(file));
  };

  const clearAnnouncementImage = () => {
    setAnnouncementImageFile(null);
    setAnnouncementImagePreview(null);
    setAnnouncementRemoveImage(true);
    if (announcementImageInputRef.current) announcementImageInputRef.current.value = '';
  };

  // Save updates the portal; only Publish changes the email event marker.
  const saveAnnouncement = async (sendEmail = false) => {
    if (announcementWriteLock.current || !announcementContent.trim() || (sendEmail && announcementAlreadyPublished)) return;
    announcementWriteLock.current = true;
    setAnnouncementSaving(true);
    setAnnouncementMsg(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) throw new Error('Please sign in again.');
      const publication = sendEmail ? { email_publication_id: crypto.randomUUID() } : {};

      // Resolve what image_url should end up as: a freshly-uploaded
      // image, explicitly removed (null), or left untouched.
      let nextImageUrl: string | null | undefined = undefined;

      if (announcementImageFile) {
        const ext = announcementImageFile.name.split('.').pop() || 'jpg';
        const filePath = `announcement-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('announcements')
          .upload(filePath, announcementImageFile, { contentType: announcementImageFile.type, upsert: false });
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('announcements').getPublicUrl(filePath);
        nextImageUrl = publicUrlData.publicUrl;
      } else if (announcementRemoveImage) {
        nextImageUrl = null;
      }

      if (announcementId) {
        const updatePayload: Database['public']['Tables']['announcements']['Update'] = {
          ...publication,
          content: announcementContent,
          updated_at: new Date().toISOString(),
          updated_by: user?.id ?? null,
        };
        if (nextImageUrl !== undefined) updatePayload.image_url = nextImageUrl;

        const { data: saved, error } = await supabase
          .from('announcements')
          .update(updatePayload)
          .eq('id', announcementId).select('id').maybeSingle();

        if (error) throw error;
        if (!saved) throw new Error('Announcement was not saved. Check your access and reload.');
      } else {
        const { data, error } = await supabase
          .from('announcements')
          .insert([{
            ...publication,
            content: announcementContent,
            image_url: nextImageUrl ?? null,
            updated_by: user?.id ?? null,
          }])
          .select('id, updated_at')
          .single();

        if (error) throw error;
        setAnnouncementId(data.id);
      }

      if (sendEmail) {
        const publishedImageUrl = nextImageUrl === undefined ? announcementImageUrl : nextImageUrl;
        setPublishedAnnouncement({ content: announcementContent, imageUrl: publishedImageUrl });
        setAnnouncementImageUrl(publishedImageUrl);
        setAnnouncementImageFile(null);
        setAnnouncementImagePreview(null);
        setAnnouncementRemoveImage(false);
      }
      setAnnouncementMsg({ type: 'success', text: sendEmail ? 'Announcement published. Email notification requested; delivery is not yet confirmed.' : 'Announcement saved. No email notification requested.' });
      await fetchAnnouncement();
    } catch (error: unknown) {
      console.error('Error publishing announcement:', error);
      setAnnouncementMsg({ type: 'error', text: errorMessage(error, 'Failed to save announcement.') });
    } finally {
      announcementWriteLock.current = false;
      setAnnouncementSaving(false);
    }
  };

  return {
    announcementId,
    announcementContent,
    setAnnouncementContent,
    announcementImageUrl,
    announcementImageInputRef,
    announcementImagePreview,
    announcementRemoveImage,
    announcementOpen,
    setAnnouncementOpen,
    announcementUpdatedAt,
    announcementLoading,
    announcementSaving,
    announcementMsg,
    announcementAlreadyPublished,
    fetchAnnouncement,
    handleAnnouncementImageChange,
    clearAnnouncementImage,
    saveAnnouncement,
  };
}
