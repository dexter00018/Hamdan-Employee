-- Profile hardening (Phase 1)
-- Closes three gaps verified against the live database on 2026-10-20:
--   1. Policy "Enable read access for all" (roles={public}) let anonymous
--      callers read every profile row. Confirmed live: unauthenticated REST
--      request returned HTTP 200 with real employee data.
--   2. handle_new_user() trusted raw_user_meta_data->>'role' with no
--      validation, so any user creation carrying role metadata attained it.
--   3. "Users can update own profile" allowed employees to mutate protected
--      fields (is_active, employee_id, employee_email, full_name,
--      designation, employee_rank, resigned_date, direct_lead_id) on their
--      own row even though the policy pinned the role column.

begin;

-- 1. profiles: drop the public read-all policy; replace with an
--    authenticated-scoped directory read. Anonymous callers now read 0 rows.
drop policy if exists "Enable read access for all" on public.profiles;

drop policy if exists "Authenticated users can read profiles" on public.profiles;
create policy "Authenticated users can read profiles"
  on public.profiles
  for select
  to authenticated
  using (true);

-- 2. handle_new_user(): role metadata is never trusted. Profile rows are born
--    as 'employee'; privileged roles are assigned afterwards by the server
--    (create-employee route upserts the real role with the service key).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.profiles (id, employee_id, full_name, role)
  values (
    new.id,
    'HSM-' || substr(md5(random()::text), 1, 6),
    coalesce(new.raw_user_meta_data->>'full_name', 'Bagong Empleyado'),
    'employee'
  );
  return new;
end;
$$;

-- 3. Self-edit guard: an authenticated user updating their OWN profile row
--    may only touch non-protected columns (e.g. avatar_url). Protected fields
--    may only change via server-side (service_role) provisioning or by an
--    admin editing a DIFFERENT user's row, both untouched by this trigger.
create or replace function public.guard_profile_self_edit()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  -- Server-side provisioning runs with the service key: always trusted.
  if auth.role() = 'service_role' then
    return new;
  end if;

  -- Only rows whose CURRENT owner is the caller are guarded. Admin/super_admin
  -- users editing someone else's profile take an unrelated path and pass.
  if old.id <> auth.uid() then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.created_at is distinct from old.created_at
     or new.is_active is distinct from old.is_active
     or new.employee_id is distinct from old.employee_id
     or new.employee_email is distinct from old.employee_email
     or new.full_name is distinct from old.full_name
     or new.designation is distinct from old.designation
     or new.employee_rank is distinct from old.employee_rank
     or new.resigned_date is distinct from old.resigned_date
     or new.direct_lead_id is distinct from old.direct_lead_id
     or new.role is distinct from old.role
  then
    raise exception 'Profile self-edit restricted: protected fields cannot be changed directly';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_self_edit on public.profiles;
create trigger guard_profile_self_edit
  before update on public.profiles
  for each row
  execute function public.guard_profile_self_edit();

-- 4. Revoke every anon privilege in the public schema. Verified before this
--    migration: no pre-login path in the app reads public tables with the
--    anon role (proxy.ts and all API routes authenticate first), and every
--    public function already has explicit ACLs without anon grants except
--    three trigger-helper functions, which are also revoked here. Login,
--    signup-lock, and password reset use the GoTrue endpoint and are not
--    affected by public-schema table grants.
do $rev$
declare
  r record;
begin
  for r in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public' and tablename <> 'schema_migrations'
  loop
    execute format('revoke all privileges on %I.%I from anon', r.schemaname, r.tablename);
  end loop;

  -- Sequences behind bigserial columns
  for r in
    select schemaname, sequencename
    from pg_sequences
    where schemaname = 'public'
  loop
    execute format('revoke usage, select, update on sequence %I.%I from anon', r.schemaname, r.sequencename);
  end loop;

  -- Trigger-helper functions that are irrelevant to anonymous callers
  for r in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  loop
    execute format('revoke execute on function %I.%I(%s) from anon', 'public', r.proname, r.args);
  end loop;

  -- Default PostgREST ownership is postgres; make future objects safe by
  -- pulling the anon default grant off the schema itself as well.
  revoke usage on schema public from anon;
end
$rev$;

-- assertion guards: fail loudly if anything leaked through
do $check$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'Enable read access for all'
  ) then
    raise exception 'profile hardening: public read-all policy still present';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'Authenticated users can read profiles'
      and roles = '{authenticated}'
  ) then
    raise exception 'profile hardening: authenticated directory-read policy missing';
  end if;
end
$check$;

commit;
