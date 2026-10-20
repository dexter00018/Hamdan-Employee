-- Avatar storage policies for the 'avatars' bucket.
--
-- Background: the HR portal uploads avatars with the *authenticated* client
-- (storage.from('avatars').upload()). This bucket had no policies on
-- storage.objects, so every upload failed with
-- "new row violates row-level security policy" — pre-existing live breakage
-- found during the Phase 1 audit (18 objects already exist in the bucket).
--
-- Admin check mirrors the existing announcement-images policies on this
-- project (profiles role lookup on auth.uid()), with is_active=true added so
-- a deactivated admin account loses upload rights immediately.
-- Reads keep working for everyone: the bucket is public, so avatars render
-- from public URLs; the authenticated SELECT policy additionally permits
-- SDK list/download calls.

create policy "Admins can upload avatars"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'super_admin')
        and p.is_active = true
    )
  );

create policy "Admins can update avatars"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'super_admin')
        and p.is_active = true
    )
  )
  with check (
    bucket_id = 'avatars'
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'super_admin')
        and p.is_active = true
    )
  );

create policy "Admins can delete avatars"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'super_admin')
        and p.is_active = true
    )
  );

create policy "Authenticated users can read avatars"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars');
