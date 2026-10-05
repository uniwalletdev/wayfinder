-- Back office (/admin). Applied at runtime by src/lib/db.ts (SCHEMA_DDL); kept
-- here for ops and version control. Idempotent.
--
-- backoffice_members: the staff role of a signed-in (Clerk) account — owner,
--   admin, editor or viewer. Owners named in the ADMIN_EMAILS environment
--   variable are owners without a row, and cannot be changed from the back office.
-- backoffice_audit: every change made in the back office, who made it and when.
-- wf_venues.verified: a staff member has checked a shared venue; the app shows
--   the verified badge for it.
-- search_misses.resolved_at: a staff member has dealt with what people searched
--   for and did not find.

create table if not exists public.backoffice_members (
  user_id    text primary key,
  role       text not null check (role in ('owner','admin','editor','viewer')),
  email      text,
  added_by   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.backoffice_audit (
  id          bigserial primary key,
  actor_id    text not null,
  actor_email text,
  action      text not null,
  target      text,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists backoffice_audit_created_idx on public.backoffice_audit (created_at desc);

alter table public.wf_venues add column if not exists verified boolean not null default false;
alter table public.wf_venues add column if not exists verified_at timestamptz;
alter table public.wf_venues add column if not exists verified_by text;

alter table public.search_misses add column if not exists resolved_at timestamptz;
alter table public.search_misses add column if not exists resolved_by text;

-- Data retention purges by age.
create index if not exists nav_signals_created_idx on public.nav_signals (created_at);
