-- Tests for the 20261020120000_avatar_storage_policies migration.
-- The avatars bucket previously had no policies on storage.objects, so
-- authenticated avatar uploads failed with a row-level-security violation.
begin;

select plan(6);

-- The bucket exists and stays public (avatars render from public URLs).
select ok(
  exists (
    select 1 from storage.buckets
    where id = 'avatars' and public = true
  ),
  'avatars bucket exists and is public'
);

-- Admins can upload (INSERT with_check present).
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Admins can upload avatars'
      and cmd = 'INSERT' and roles = '{authenticated}'
      and with_check like '%avatars%'
  ),
  'admin avatar upload policy exists'
);

-- Admins can update.
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Admins can update avatars'
      and cmd = 'UPDATE' and roles = '{authenticated}'
      and qual like '%avatars%'
  ),
  'admin avatar update policy exists'
);

-- Admins can delete.
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Admins can delete avatars'
      and cmd = 'DELETE' and roles = '{authenticated}'
      and qual like '%avatars%'
  ),
  'admin avatar delete policy exists'
);

-- Authenticated users can read avatar objects.
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Authenticated users can read avatars'
      and cmd = 'SELECT' and roles = '{authenticated}'
  ),
  'authenticated avatar read policy exists'
);

-- The admin predicates require an active admin profile (is_active gate).
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Admins can upload avatars'
      and with_check like '%is_active%'
      and with_check like '%profiles%'
  ),
  'avatar upload policy checks an active admin profile'
);

rollback;
