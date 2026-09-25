-- Accounts (Clerk, optional) can own a venue as well as a device.
--
-- Until now the only proof of ownership was the edit_token minted to the
-- device that created the venue: clear that browser's storage and the venue is
-- orphaned for good. A signed-in user who creates a venue now has it recorded
-- against their account, and a venue created anonymously can be claimed by
-- presenting its token while signed in (POST /api/venues/<id>/claim). Either
-- the token or the account then authorises writes, and the owner sees their
-- own unlisted/private venues on every device.
--
-- Applied automatically by the app on first use (see src/lib/db.ts); this is
-- the ops/version-controlled copy and must stay in step with it.
--   psql "$DATABASE_URL" -f db/migrations/0004_venue_owner.sql

alter table public.wf_venues add column if not exists owner_id text;
create index if not exists wf_venues_owner_idx on public.wf_venues (owner_id) where owner_id is not null;
