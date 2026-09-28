-- rls_checks.sql
--
-- Manual RLS smoke test. Run this in the Supabase SQL editor (or `psql`)
-- against a project that already has the migrations + seed applied and at
-- least one real member and one real admin user in auth.users/profiles.
--
-- How it works: `set local role` switches the Postgres role for the rest of
-- the transaction, and `set local request.jwt.claims` fakes the JWT that
-- PostgREST would normally attach, so `auth.uid()` inside policies resolves
-- to the id you put in the "sub" claim. Everything runs inside a single
-- transaction that is rolled back at the end, so nothing here writes data
-- permanently unless you remove the final `rollback`.
--
-- Replace the two placeholder UUIDs below with real ids from
-- `select id, email, role from public.profiles;` before running.

begin;

-- \gset only works in psql; if you're in the Supabase SQL editor, just
-- copy the uuids into the two \set-style comments below by hand.
-- MEMBER_ID  := '00000000-0000-0000-0000-000000000001'  -- a role='member' profile
-- ADMIN_ID   := '00000000-0000-0000-0000-000000000002'  -- a role='admin' profile
-- OTHER_SPACE_ID := (any published space id, e.g. from `select id from public.spaces limit 1`)

-- ===========================================================================
-- 1. Anonymous role: spaces must be completely invisible.
-- ===========================================================================
set local role anon;
reset request.jwt.claims;

select 'anon sees 0 spaces (expect 0)' as check_name, count(*) as result from public.spaces;
select 'anon sees 0 profiles (expect 0)' as check_name, count(*) as result from public.profiles;

-- The only thing anon may read: aggregate numbers, no addresses/notes.
select public.public_teaser();

reset role;

-- ===========================================================================
-- 2. Authenticated member: sees published spaces only, cannot write spaces.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

select 'member sees only published spaces (expect 0 unpublished)' as check_name,
       count(*) as result
from public.spaces
where is_published = false;

-- Expect: fails with an RLS error (new row violates row-level security policy).
-- (Wrap in a DO block if you want the script to continue past the error.)
-- update public.spaces set name = 'HACKED' where id = (select id from public.spaces limit 1);

-- Expect: fails. A member cannot promote themselves to admin.
-- update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000001';

-- Expect: succeeds. A member can check in for themselves.
-- insert into public.checkins (space_id, user_id, date)
-- values ((select id from public.spaces limit 1), '00000000-0000-0000-0000-000000000001', current_date);

-- Expect: fails. A member cannot check in on someone else's behalf.
-- insert into public.checkins (space_id, user_id, date)
-- values ((select id from public.spaces limit 1), '00000000-0000-0000-0000-000000000002', current_date);

-- Expect: fails. field_options is admin-write-only.
-- insert into public.field_options (field, value) values ('zone', 'Zona Farlocca');

reset role;
reset request.jwt.claims;

-- ===========================================================================
-- 3. Authenticated admin: full read/write on spaces and field_options.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';

select 'admin sees all spaces incl. unpublished (expect > 0 if any exist)' as check_name,
       count(*) as result
from public.spaces
where is_published = false;

-- Expect: succeeds.
-- update public.spaces set last_verified_at = current_date where id = (select id from public.spaces limit 1);

-- Expect: succeeds, and a row appears in audit_log for it.
-- insert into public.field_options (field, value, color, sort_order)
-- values ('zone', 'Vanchiglia', 'purple', 10)
-- on conflict (field, value) do nothing;

select 'audit_log has entries (expect > 0 after any admin write above)' as check_name,
       count(*) as result
from public.audit_log;

reset role;
reset request.jwt.claims;

rollback;
