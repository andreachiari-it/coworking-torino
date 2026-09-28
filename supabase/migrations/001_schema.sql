-- 001_schema.sql
-- Coworking Torino: core tables.
-- Enum-like fields (type, zone, cost_type, source, personal_rating, wifi_quality,
-- power_outlets, call_space, mood) are validated against field_options via trigger
-- (see 003_functions_triggers.sql) instead of CHECK constraints, so the admin
-- dashboard can add new values (e.g. a new Zone) without a migration.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- field_options: admin-editable value lists for the "enum" columns below.
-- ---------------------------------------------------------------------------
create table public.field_options (
  field text not null,
  value text not null,
  color text check (color in ('green', 'yellow', 'red', 'blue', 'purple', 'orange', 'pink', 'gray')),
  sort_order int not null default 0,
  primary key (field, value)
);

-- ---------------------------------------------------------------------------
-- profiles: one row per auth.users row, created by handle_new_user() trigger.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'member' check (role in ('member', 'admin')),
  whatsapp_member boolean not null default false,
  show_in_checkins boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- spaces: the Coworking Torino directory.
-- ---------------------------------------------------------------------------
create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  type text not null,
  zone text,
  address text,
  lat double precision,
  lng double precision,
  cost_type text,
  price_per_day numeric(6, 2) check (price_per_day >= 0),
  source text,
  personal_rating text,
  wifi_quality text,
  wifi_notes text,
  power_outlets text,
  call_space text,
  mood text[] not null default '{}',
  opening_hours text,
  has_outdoor boolean not null default false,
  booking_required boolean not null default false,
  instagram_url text,
  maps_url text,
  last_verified_at date,
  notes text,
  notion_page_id text,
  website_url text,
  cover_image_url text,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

create index spaces_type_idx on public.spaces (type);
create index spaces_zone_idx on public.spaces (zone);
create index spaces_is_published_idx on public.spaces (is_published);

-- ---------------------------------------------------------------------------
-- checkins: "Ci vado" community presence.
-- ---------------------------------------------------------------------------
create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  time_from time,
  time_to time,
  note text check (char_length(note) <= 140),
  created_at timestamptz not null default now(),
  unique (space_id, user_id, date)
);

create index checkins_space_date_idx on public.checkins (space_id, date);
create index checkins_user_idx on public.checkins (user_id);

-- ---------------------------------------------------------------------------
-- reviews: community reviews, one per user per space (editable).
-- ---------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  wifi_quality text,
  power_outlets text,
  noise_level text check (noise_level in ('Silenzioso', 'Medio', 'Rumoroso')),
  comment text check (char_length(comment) <= 1000),
  visited_on date,
  status text not null default 'published' check (status in ('published', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (space_id, user_id)
);

create index reviews_space_idx on public.reviews (space_id);

-- ---------------------------------------------------------------------------
-- suggestions: community-submitted new spaces / corrections / closures.
-- ---------------------------------------------------------------------------
create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('new_space', 'correction', 'closed')),
  space_id uuid references public.spaces (id) on delete set null,
  payload jsonb,
  message text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id)
);

create index suggestions_status_idx on public.suggestions (status);

-- ---------------------------------------------------------------------------
-- audit_log: field-level history of changes to spaces, written by trigger.
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id bigserial primary key,
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  changed_by uuid references public.profiles (id),
  diff jsonb not null,
  created_at timestamptz not null default now()
);

create index audit_log_record_idx on public.audit_log (table_name, record_id);
