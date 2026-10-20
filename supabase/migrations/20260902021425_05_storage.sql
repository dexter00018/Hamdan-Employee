-- ============================================================================
-- Storage buckets + policies
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('payslips', 'payslips', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('announcements', 'announcements', true)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- payslips (private bucket -- signed URLs only)
-- ----------------------------------------------------------------------------

create policy "Admins can upload payslips"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'payslips' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any (array['admin','super_admin'])));

create policy "Admins can delete payslips"
  on storage.objects for delete to authenticated
  using (bucket_id = 'payslips' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any (array['admin','super_admin'])));

create policy "Employees can download own payslips"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'payslips'
    and (
      (storage.foldername(name))[1] = (auth.uid())::text
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any (array['admin','super_admin']))
    )
  );

-- ----------------------------------------------------------------------------
-- announcements (public bucket -- image attachments)
-- ----------------------------------------------------------------------------

create policy "Admins can upload announcement images"
  on storage.objects for insert
  with check (bucket_id = 'announcements' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any (array['admin','super_admin'])));

create policy "Admins can update announcement images"
  on storage.objects for update
  using (bucket_id = 'announcements' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any (array['admin','super_admin'])));

create policy "Admins can delete announcement images"
  on storage.objects for delete
  using (bucket_id = 'announcements' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any (array['admin','super_admin'])));

-- ----------------------------------------------------------------------------
-- avatars (public bucket)
-- ----------------------------------------------------------------------------

create policy "Admins can upload avatars"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any (array['admin','super_admin'])));

create policy "Admins can update avatars"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any (array['admin','super_admin'])))
  with check (bucket_id = 'avatars' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any (array['admin','super_admin'])));

create policy "Authenticated can view avatars"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars');
