-- 003_functions_triggers.sql

-- ---------------------------------------------------------------------------
-- slugify: ascii-fold + kebab-case. Used to auto-generate spaces.slug.
-- ---------------------------------------------------------------------------
create or replace function public.slugify(input text)
returns text
language sql
immutable
as $$
  select trim(both '-' from
    regexp_replace(
      lower(
        translate(
          input,
          'àáâãäåèéêëìíîïòóôõöùúûüýÿñçÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝÑÇ',
          'aaaaaaeeeeiiiiooooouuuuyyncAAAAAAEEEEIIIIOOOOOUUUUYNC'
        )
      ),
      '[^a-z0-9]+', '-', 'g'
    )
  );
$$;

create or replace function public.set_space_slug()
returns trigger
language plpgsql
as $$
declare
  base_slug text;
  candidate text;
  suffix int := 1;
begin
  if new.slug is null or btrim(new.slug) = '' then
    base_slug := public.slugify(new.name);
  else
    base_slug := public.slugify(new.slug);
  end if;

  if base_slug = '' then
    base_slug := 'spazio';
  end if;

  candidate := base_slug;
  while exists (
    select 1 from public.spaces
    where slug = candidate and id is distinct from new.id
  ) loop
    suffix := suffix + 1;
    candidate := base_slug || '-' || suffix;
  end loop;

  new.slug := candidate;
  return new;
end;
$$;

create trigger spaces_set_slug
  before insert or update of name, slug on public.spaces
  for each row execute function public.set_space_slug();

-- ---------------------------------------------------------------------------
-- handle_new_user: creates the profiles row when someone signs up via OTP.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- set_updated_at: generic "touch" trigger for spaces and reviews.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger spaces_set_updated_at
  before update on public.spaces
  for each row execute function public.set_updated_at();

create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

create or replace function public.set_space_updated_by()
returns trigger
language plpgsql
as $$
begin
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger spaces_set_updated_by
  before update on public.spaces
  for each row execute function public.set_space_updated_by();

-- ---------------------------------------------------------------------------
-- validate_space_field_options: enforces that every "enum-like" column on
-- spaces still matches a row in field_options, without hardcoding the list
-- in a CHECK constraint (the admin dashboard manages field_options).
-- ---------------------------------------------------------------------------
create or replace function public.validate_space_field_options()
returns trigger
language plpgsql
as $$
declare
  mood_value text;
begin
  if new.type is not null and not exists (select 1 from public.field_options where field = 'type' and value = new.type) then
    raise exception 'Invalid value "%" for field type', new.type;
  end if;
  if new.zone is not null and not exists (select 1 from public.field_options where field = 'zone' and value = new.zone) then
    raise exception 'Invalid value "%" for field zone', new.zone;
  end if;
  if new.cost_type is not null and not exists (select 1 from public.field_options where field = 'cost_type' and value = new.cost_type) then
    raise exception 'Invalid value "%" for field cost_type', new.cost_type;
  end if;
  if new.source is not null and not exists (select 1 from public.field_options where field = 'source' and value = new.source) then
    raise exception 'Invalid value "%" for field source', new.source;
  end if;
  if new.personal_rating is not null and not exists (select 1 from public.field_options where field = 'personal_rating' and value = new.personal_rating) then
    raise exception 'Invalid value "%" for field personal_rating', new.personal_rating;
  end if;
  if new.wifi_quality is not null and not exists (select 1 from public.field_options where field = 'wifi_quality' and value = new.wifi_quality) then
    raise exception 'Invalid value "%" for field wifi_quality', new.wifi_quality;
  end if;
  if new.power_outlets is not null and not exists (select 1 from public.field_options where field = 'power_outlets' and value = new.power_outlets) then
    raise exception 'Invalid value "%" for field power_outlets', new.power_outlets;
  end if;
  if new.call_space is not null and not exists (select 1 from public.field_options where field = 'call_space' and value = new.call_space) then
    raise exception 'Invalid value "%" for field call_space', new.call_space;
  end if;

  foreach mood_value in array new.mood loop
    if not exists (select 1 from public.field_options where field = 'mood' and value = mood_value) then
      raise exception 'Invalid value "%" for field mood', mood_value;
    end if;
  end loop;

  return new;
end;
$$;

create trigger spaces_validate_field_options
  before insert or update on public.spaces
  for each row execute function public.validate_space_field_options();

-- ---------------------------------------------------------------------------
-- prevent_role_change: a member can update their own profile, but never
-- promote themselves to admin.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_role_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only an admin can change role';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_change();

-- ---------------------------------------------------------------------------
-- log_space_changes: field-level audit trail for the admin dashboard.
-- ---------------------------------------------------------------------------
create or replace function public.log_space_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  diff jsonb := '{}'::jsonb;
  key text;
  old_val jsonb;
  new_val jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (table_name, record_id, action, changed_by, diff)
    values ('spaces', new.id, 'insert', auth.uid(), to_jsonb(new));
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.audit_log (table_name, record_id, action, changed_by, diff)
    values ('spaces', old.id, 'delete', auth.uid(), to_jsonb(old));
    return old;
  else
    for key in select jsonb_object_keys(to_jsonb(new)) loop
      if key in ('updated_at', 'updated_by') then
        continue;
      end if;
      old_val := to_jsonb(old) -> key;
      new_val := to_jsonb(new) -> key;
      if old_val is distinct from new_val then
        diff := diff || jsonb_build_object(key, jsonb_build_object('old', old_val, 'new', new_val));
      end if;
    end loop;
    if diff <> '{}'::jsonb then
      insert into public.audit_log (table_name, record_id, action, changed_by, diff)
      values ('spaces', new.id, 'update', auth.uid(), diff);
    end if;
    return new;
  end if;
end;
$$;

create trigger spaces_log_changes
  after insert or update or delete on public.spaces
  for each row execute function public.log_space_changes();

-- ---------------------------------------------------------------------------
-- validate_checkin: date window (today .. +30 days) and anti-spam cap
-- (max 3 check-ins for the same date per user).
-- ---------------------------------------------------------------------------
create or replace function public.validate_checkin()
returns trigger
language plpgsql
as $$
declare
  same_day_count int;
begin
  if new.date < current_date or new.date > current_date + 30 then
    raise exception 'Check-in date must be between today and 30 days from now';
  end if;

  select count(*) into same_day_count
  from public.checkins
  where user_id = new.user_id and date = new.date;

  if same_day_count >= 3 then
    raise exception 'Maximum 3 check-ins per day reached';
  end if;

  return new;
end;
$$;

create trigger checkins_validate
  before insert on public.checkins
  for each row execute function public.validate_checkin();

-- ---------------------------------------------------------------------------
-- validate_suggestion: anti-spam cap (max 10 suggestions per day per user).
-- ---------------------------------------------------------------------------
create or replace function public.validate_suggestion()
returns trigger
language plpgsql
as $$
declare
  today_count int;
begin
  select count(*) into today_count
  from public.suggestions
  where user_id = new.user_id and created_at::date = current_date;

  if today_count >= 10 then
    raise exception 'Maximum 10 suggestions per day reached';
  end if;

  return new;
end;
$$;

create trigger suggestions_validate
  before insert on public.suggestions
  for each row execute function public.validate_suggestion();

-- ---------------------------------------------------------------------------
-- approve_suggestion: admin-only RPC that applies a suggestion's payload to
-- spaces and marks it approved, in one transaction.
-- ---------------------------------------------------------------------------
create or replace function public.approve_suggestion(suggestion_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.suggestions%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can approve suggestions';
  end if;

  select * into s from public.suggestions where id = suggestion_id for update;
  if not found then
    raise exception 'Suggestion not found';
  end if;
  if s.status <> 'pending' then
    raise exception 'Suggestion already reviewed';
  end if;

  if s.kind = 'new_space' then
    insert into public.spaces (
      name, type, zone, address, cost_type, price_per_day, source,
      personal_rating, wifi_quality, wifi_notes, power_outlets, call_space,
      mood, opening_hours, has_outdoor, booking_required, instagram_url,
      maps_url, notes, website_url
    )
    select
      s.payload ->> 'name',
      s.payload ->> 'type',
      s.payload ->> 'zone',
      s.payload ->> 'address',
      s.payload ->> 'cost_type',
      nullif(s.payload ->> 'price_per_day', '')::numeric,
      coalesce(s.payload ->> 'source', 'Ricerca web'),
      s.payload ->> 'personal_rating',
      s.payload ->> 'wifi_quality',
      s.payload ->> 'wifi_notes',
      s.payload ->> 'power_outlets',
      s.payload ->> 'call_space',
      coalesce(
        (select array_agg(value) from jsonb_array_elements_text(coalesce(s.payload -> 'mood', '[]'::jsonb)) as value),
        '{}'
      ),
      s.payload ->> 'opening_hours',
      coalesce((s.payload ->> 'has_outdoor')::boolean, false),
      coalesce((s.payload ->> 'booking_required')::boolean, false),
      s.payload ->> 'instagram_url',
      s.payload ->> 'maps_url',
      s.payload ->> 'notes',
      s.payload ->> 'website_url';

  elsif s.kind = 'correction' then
    if s.space_id is null then
      raise exception 'Correction suggestion has no space_id';
    end if;
    update public.spaces set
      name = coalesce(s.payload ->> 'name', name),
      type = coalesce(s.payload ->> 'type', type),
      zone = coalesce(s.payload ->> 'zone', zone),
      address = coalesce(s.payload ->> 'address', address),
      cost_type = coalesce(s.payload ->> 'cost_type', cost_type),
      price_per_day = coalesce(nullif(s.payload ->> 'price_per_day', '')::numeric, price_per_day),
      wifi_quality = coalesce(s.payload ->> 'wifi_quality', wifi_quality),
      wifi_notes = coalesce(s.payload ->> 'wifi_notes', wifi_notes),
      power_outlets = coalesce(s.payload ->> 'power_outlets', power_outlets),
      call_space = coalesce(s.payload ->> 'call_space', call_space),
      opening_hours = coalesce(s.payload ->> 'opening_hours', opening_hours),
      instagram_url = coalesce(s.payload ->> 'instagram_url', instagram_url),
      maps_url = coalesce(s.payload ->> 'maps_url', maps_url),
      website_url = coalesce(s.payload ->> 'website_url', website_url),
      notes = coalesce(s.payload ->> 'notes', notes)
    where id = s.space_id;

  elsif s.kind = 'closed' then
    if s.space_id is null then
      raise exception 'Closure suggestion has no space_id';
    end if;
    update public.spaces set is_published = false where id = s.space_id;
  end if;

  update public.suggestions
  set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
  where id = suggestion_id;
end;
$$;

revoke execute on function public.approve_suggestion(uuid) from public;
grant execute on function public.approve_suggestion(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- delete_my_account: removes a user's own app data. Deleting the auth.users
-- row itself requires the service_role key, so it happens in the
-- supabase/functions/delete-account Edge Function, which calls this RPC
-- first and then the Auth admin API.
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.checkins where user_id = uid;
  delete from public.reviews where user_id = uid;
  delete from public.suggestions where user_id = uid;
  delete from public.profiles where id = uid;
end;
$$;

revoke execute on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------------
-- public_teaser: the only thing an anonymous visitor may read. Aggregate
-- numbers and at most 3 space names, never addresses or notes.
-- ---------------------------------------------------------------------------
create or replace function public.public_teaser()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select jsonb_build_object(
    'spaces_count', (select count(*) from public.spaces where is_published = true),
    'free_count', (select count(*) from public.spaces where is_published = true and cost_type = 'Gratuito'),
    'zones_count', (select count(distinct zone) from public.spaces where is_published = true and zone is not null),
    'checkins_this_week', (
      select count(*) from public.checkins
      where date >= date_trunc('week', current_date)::date
        and date < (date_trunc('week', current_date) + interval '7 days')::date
    ),
    'sample_spaces', (
      select coalesce(jsonb_agg(jsonb_build_object('name', name, 'type', type, 'zone', zone)), '[]'::jsonb)
      from (
        select name, type, zone from public.spaces
        where is_published = true
        order by random()
        limit 3
      ) sample
    )
  );
$$;

revoke execute on function public.public_teaser() from public;
grant execute on function public.public_teaser() to anon, authenticated;
