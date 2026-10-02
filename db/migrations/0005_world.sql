-- Worldwide hospital data from OpenStreetMap (scripts/world/), published by the
-- World hospital data workflow and served by /api/world/*. Mirrored in
-- src/lib/world-db.ts, which runs the same DDL on first use.
--
-- One row per hospital per country (ids are OSM element ids, osm-w123), one row
-- per venue the pipeline built (an indoor map or a site map, as the app's Venue
-- JSON), and one row per floor plan (SVG). Data © OpenStreetMap contributors.

create table if not exists public.world_countries (
  country      char(2) primary key,
  name         text,
  hospitals    int not null default 0,
  mapped       int not null default 0,
  generated_at timestamptz,
  updated_at   timestamptz not null default now()
);

create table if not exists public.world_hospitals (
  country    char(2) not null,
  id         text not null,
  name       text not null,
  lat        double precision not null,
  lng        double precision not null,
  city       text,
  street     text,
  postcode   text,
  operator   text,
  emergency  boolean not null default false,
  mapped     boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (country, id)
);
create index if not exists world_hospitals_pos_idx on public.world_hospitals (country, lat, lng);

create table if not exists public.world_venues (
  id         text primary key,
  country    char(2) not null,
  kind       text not null,
  venue      jsonb not null,
  updated_at timestamptz not null default now(),
  constraint world_venues_kind_chk check (kind in ('indoor', 'campus'))
);
create index if not exists world_venues_country_idx on public.world_venues (country);

create table if not exists public.world_plans (
  venue_id text not null references public.world_venues (id) on delete cascade,
  plan_id  text not null,
  svg      text not null,
  primary key (venue_id, plan_id)
);
