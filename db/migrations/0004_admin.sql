-- The back office: moderation state on shared venues, resolution state on the
-- demand signals, and an append-only record of everything an administrator did.
--
-- Why this exists. Everything the app pools from the public — venues created at
-- POST /api/venues, the waypoints inside them, the searches that found nothing,
-- the trails people walked — arrives anonymously and, until now, unreviewed:
-- a venue created by a stranger was listed in every user's picker the moment it
-- was written. These columns give that content a lifecycle (pending → published,
-- or suppressed) and give the people running Wayfinder somewhere to record why.
--
-- Two rules this schema is built around:
--
--   1. Nothing here may change how the app behaves for a navigator by default.
--      `status` defaults to 'published', so an existing deployment that adds
--      these columns keeps listing exactly the venues it listed yesterday.
--      Review-before-listing is opt-in, via WAYFINDER_VENUE_MODERATION=queue.
--
--   2. Administrator actions are evidence. wf_admin_audit is append-only and
--      records the actor, the target and the before/after of every mutation —
--      including the destructive ones, which are the only record left once the
--      row they deleted is gone.
--
-- Applied automatically by the app on first use (see src/lib/db.ts); this is the
-- ops/version-controlled copy and must stay in step with it. Apply manually with:
--   psql "$DATABASE_URL" -f db/migrations/0004_admin.sql

-- ── Moderation state on shared venues ──────────────────────────────────────
-- status is the listing decision; visibility stays what the *creator* asked for.
-- The two are deliberately separate: a mapper who chose 'public' and an operator
-- who has not yet reviewed them are different facts, and collapsing them would
-- silently rewrite the creator's intent.
alter table public.wf_venues add column if not exists status      text not null default 'published';
alter table public.wf_venues add column if not exists verified    boolean not null default false;
alter table public.wf_venues add column if not exists review_note  text;
alter table public.wf_venues add column if not exists reviewed_at  timestamptz;
alter table public.wf_venues add column if not exists reviewed_by  text;

do $$ begin
  alter table public.wf_venues
    add constraint wf_venues_status_chk check (status in ('published', 'pending', 'suppressed'));
exception when duplicate_object then null;
end $$;

-- The listing query is `status = 'published' and visibility = 'public'`, newest
-- first; this index serves it, and the moderation queue reads the same columns.
create index if not exists wf_venues_status_idx
  on public.wf_venues (status, visibility, created_at desc);

-- ── Resolution state on search misses ──────────────────────────────────────
-- A miss is a person telling us what they expected the map to contain. Once
-- someone has acted on it — mapped the place, or decided it is not a place —
-- the row should stop appearing in the queue without being deleted, because the
-- history of what people looked for is the useful part.
alter table public.search_misses add column if not exists resolution  text;
alter table public.search_misses add column if not exists resolved_at timestamptz;
alter table public.search_misses add column if not exists resolved_by text;

do $$ begin
  alter table public.search_misses
    add constraint search_misses_resolution_chk
    check (resolution is null or resolution in ('mapped', 'not_a_place', 'duplicate', 'wont_fix'));
exception when duplicate_object then null;
end $$;

create index if not exists search_misses_open_idx
  on public.search_misses (venue_key, resolved_at, created_at desc);

-- Activity charts and the retention purge both scan by age alone, across every
-- venue — the venue-scoped index on 0001 cannot serve that.
create index if not exists nav_signals_created_idx on public.nav_signals (created_at desc);
create index if not exists nav_signals_device_idx  on public.nav_signals (device_id);

-- ── Audit log ──────────────────────────────────────────────────────────────
-- Append-only by convention: the application never updates or deletes a row
-- here, and the back office has no UI that could. `detail` carries the shape of
-- the change (what a field was before, what it became), so a decision can be
-- explained months later — and, for deletions, so there is still a record of
-- what was removed after the row itself is gone.
create table if not exists public.wf_admin_audit (
  id          uuid primary key default gen_random_uuid(),
  actor       text not null,
  action      text not null,
  target_type text,
  target_id   text,
  summary     text not null,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  constraint wf_admin_audit_actor_len  check (char_length(actor) between 1 and 200),
  constraint wf_admin_audit_action_len check (char_length(action) between 1 and 60)
);
create index if not exists wf_admin_audit_created_idx on public.wf_admin_audit (created_at desc);
create index if not exists wf_admin_audit_target_idx  on public.wf_admin_audit (target_type, target_id, created_at desc);
