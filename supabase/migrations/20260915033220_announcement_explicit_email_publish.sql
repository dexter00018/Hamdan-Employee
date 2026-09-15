begin;
-- Existing announcements remain visible, and receive no publication event.
alter table public.announcements add column if not exists email_publication_id uuid;
-- The webhook must receive the previous marker to distinguish edits from Publish.
alter table public.announcements replica identity full;
comment on column public.announcements.email_publication_id is
 'Changed only by Publish & Email. Ordinary content updates preserve this marker.';
commit;
