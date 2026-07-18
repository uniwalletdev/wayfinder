-- Shared venue maps. Moves the authored map — the places, and the waypoints a
-- navigator reads via Claude or marks while surveying — off a single device's
-- localStorage and onto the server, so a map built once is reusable and can be
-- shared instead of trapped on the phone that made it.
--
-- There are no accounts (this app has no auth), so ownership is a per-venue
-- secret: edit_token is minted to the device that creates a venue and returned
-- once. Reads are open; writes (adding waypoints, deleting the venue) require the
-- token. visibility is metadata — public venues are listed, unlisted/private are
-- reachable by id only; without accounts it is not an access-control boundary.
--
-- Applied automatically by the app on first use (see src/lib/db.ts); this is the
-- ops/version-controlled copy and must stay in step with it. Apply manually with:
--   psql "$DATABASE_URL" -f db/migrations/0003_venues.sql

create table if not exists public.venues (
  id           uuid primary key default gen_random_uuid(),
  slug         text,
  name         text not null,
  subtitle     text,
  category     text not null default 'other',
  center_lat   double precision not null,
  center_lng   double precision not null,
  default_zoom int not null default 18,
  visibility   text not null default 'public' check (visibility in ('public','unlisted','private')),
  edit_token   text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint venues_name_len check (char_length(name) between 1 and 120)
);
create index if not exists venues_visibility_idx on public.venues (visibility, created_at desc);

create table if not exists public.waypoints (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues (id) on delete cascade,
  name        text not null,
  type        text not null default 'other',
  lat         double precision not null,
  lng         double precision not null,
  floor       int not null default 0,
  description text,
  created_at  timestamptz not null default now(),
  constraint waypoints_name_len check (char_length(name) between 1 and 200)
);
create index if not exists waypoints_venue_idx on public.waypoints (venue_id);
