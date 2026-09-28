-- 002_rls.sql
-- Row Level Security. The anon key is public, so every guarantee lives here,
-- never in client-side JavaScript.

-- is_admin() is defined here (rather than in 003_functions_triggers.sql)
-- because every policy below needs it to already exist.
create function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

alter table public.spaces enable row level security;
alter table public.field_options enable row level security;
alter table public.profiles enable row level security;
alter table public.checkins enable row level security;
alter table public.reviews enable row level security;
alter table public.suggestions enable row level security;
alter table public.audit_log enable row level security;

-- ---------------------------------------------------------------------------
-- spaces
-- ---------------------------------------------------------------------------
create policy spaces_select_published on public.spaces
  for select to authenticated
  using (is_published = true);

create policy spaces_select_admin on public.spaces
  for select to authenticated
  using (public.is_admin());

create policy spaces_insert_admin on public.spaces
  for insert to authenticated
  with check (public.is_admin());

create policy spaces_update_admin on public.spaces
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy spaces_delete_admin on public.spaces
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- field_options
-- ---------------------------------------------------------------------------
create policy field_options_select_authenticated on public.field_options
  for select to authenticated
  using (true);

create policy field_options_insert_admin on public.field_options
  for insert to authenticated
  with check (public.is_admin());

create policy field_options_update_admin on public.field_options
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy field_options_delete_admin on public.field_options
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- profiles (insert happens only via the handle_new_user() trigger, which
-- runs as security definer and so bypasses RLS -- no insert policy needed)
-- ---------------------------------------------------------------------------
create policy profiles_select_self_or_admin on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_update_self_or_admin on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy profiles_delete_self_or_admin on public.profiles
  for delete to authenticated
  using (id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- checkins
-- ---------------------------------------------------------------------------
create policy checkins_select_authenticated on public.checkins
  for select to authenticated
  using (true);

create policy checkins_insert_self on public.checkins
  for insert to authenticated
  with check (user_id = auth.uid());

create policy checkins_update_self on public.checkins
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy checkins_delete_self_or_admin on public.checkins
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------
create policy reviews_select_published on public.reviews
  for select to authenticated
  using (status = 'published');

create policy reviews_select_own_or_admin on public.reviews
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy reviews_insert_self on public.reviews
  for insert to authenticated
  with check (user_id = auth.uid());

create policy reviews_update_self_or_admin on public.reviews
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy reviews_delete_self_or_admin on public.reviews
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- suggestions
-- ---------------------------------------------------------------------------
create policy suggestions_select_own_or_admin on public.suggestions
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy suggestions_insert_self on public.suggestions
  for insert to authenticated
  with check (user_id = auth.uid());

create policy suggestions_update_admin on public.suggestions
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy suggestions_delete_admin on public.suggestions
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- audit_log (read-only for admins; writes only via the log_space_changes()
-- trigger, which runs as the table owner and so bypasses RLS)
-- ---------------------------------------------------------------------------
create policy audit_log_select_admin on public.audit_log
  for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Table-level grants. RLS policies above decide which ROWS are visible;
-- these grants decide which STATEMENTS a role may attempt at all. The anon
-- role gets nothing here -- its only door in is the public_teaser() RPC.
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.spaces to authenticated;
grant select, insert, update, delete on public.field_options to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.checkins to authenticated;
grant select, insert, update, delete on public.reviews to authenticated;
grant select, insert, update, delete on public.suggestions to authenticated;
grant select on public.audit_log to authenticated;
