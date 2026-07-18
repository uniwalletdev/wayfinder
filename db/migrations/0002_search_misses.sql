-- Searches that found nothing at a venue ("search misses"). Each row is one
-- query a visitor typed that matched no waypoint and no geocoded place — the
-- clearest signal of what still needs mapping. `suggested` marks the ones where
-- the visitor explicitly tapped "Suggest this place".
--
-- venue_key is text, not a FK (like nav_signals): seed venues ("gosh") and
-- device-local venues ("venue-…") never exist in a venues table, but their
-- misses are just as useful to whoever curates them.
--
-- Applied automatically by the app on first use (see src/lib/db.ts); this is the
-- ops/version-controlled copy and must stay in step with it. Apply manually
-- with: psql "$DATABASE_URL" -f db/migrations/0002_search_misses.sql

create table if not exists public.search_misses (
  id         uuid primary key default gen_random_uuid(),
  venue_key  text not null,
  query      text not null,
  suggested  boolean not null default false,
  created_at timestamptz not null default now(),
  constraint search_misses_query_len check (char_length(query) between 1 and 160),
  constraint search_misses_venue_len check (char_length(venue_key) between 1 and 80)
);

create index if not exists search_misses_venue_idx
  on public.search_misses (venue_key, created_at desc);
