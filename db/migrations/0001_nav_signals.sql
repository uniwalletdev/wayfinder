-- Navigation signals: the raw, per-device evidence the map improves from.
--
-- Each row is one thing a *navigator* emitted just by using the app — no
-- surveying, no extra taps. Today only 'trail' is written (the path someone
-- walked while being routed, used to fill in unmapped corridors); 'arrival',
-- 'qr_fix' and 'off_route' are reserved for the other passive signals so the
-- kind check doesn't need changing when they land.
--
-- This is deliberately a table of *observations*, not corrections. One device's
-- trace is noisy (indoor drift, a detour to the toilet), so nothing here rewrites
-- a venue on its own — a later aggregation step promotes a correction only when
-- enough independent device_ids agree. Keeping the evidence raw lets that
-- threshold change without re-collecting.
--
-- venue_key is text, not a FK (matching search_misses): seed venues ("gosh") and
-- device-local venues ("venue-…") never exist in a venues table, yet the signals
-- they generate are just as useful to whoever curates them.
--
-- Unlike supabase/migrations/*, this targets a raw Postgres (Railway's plugin)
-- with no Supabase Auth, so there is no RLS here — access is enforced in the API
-- route. The app also applies this DDL automatically on first use (see
-- src/lib/db.ts); this file is the ops/version-controlled copy and must stay in
-- step with it. Apply manually with: psql "$DATABASE_URL" -f db/migrations/0001_nav_signals.sql

-- gen_random_uuid() is core in Postgres 13+, so no pgcrypto extension is needed.
create table if not exists public.nav_signals (
  id          uuid primary key default gen_random_uuid(),
  venue_key   text not null,
  device_id   text not null,
  kind        text not null,
  floor       int  not null default 0,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  constraint nav_signals_kind_chk   check (kind in ('trail','arrival','qr_fix','off_route')),
  constraint nav_signals_venue_len  check (char_length(venue_key) between 1 and 80),
  constraint nav_signals_device_len check (char_length(device_id) between 1 and 64)
);

create index if not exists nav_signals_venue_kind_idx
  on public.nav_signals (venue_key, kind, created_at desc);
