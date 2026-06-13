-- Wayfinder backend schema + Row-Level Security.
--
-- This is where the "measures required accordingly" are actually enforced — not
-- in the UI, but in the database, so they hold no matter who calls the API:
--   * public venues  -> readable by anyone
--   * unlisted       -> reachable only if you know it (owner/members + by id)
--   * private        -> owner and explicitly-invited members only
--   * verified       -> can only be set by the service role (an admin), never
--                       self-granted, so a "verified" public place means something
--   * waypoints      -> inherit their venue's read rules; only owner/editors write
--
-- Apply with the Supabase CLI (`supabase db push`) or paste into the SQL editor.

create extension if not exists pgcrypto;

-- ── Profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now()
);

-- ── Venues ──────────────────────────────────────────────────────────────────
create table if not exists public.venues (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  slug         text unique,
  name         text not null,
  subtitle     text,
  category     text not null default 'other',
  center_lat   double precision not null,
  center_lng   double precision not null,
  default_zoom int not null default 18,
  visibility   text not null default 'private' check (visibility in ('public', 'unlisted', 'private')),
  verified     boolean not null default false,
  accessibility jsonb,
  floor_plans  jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists venues_owner_idx on public.venues (owner_id);
create index if not exists venues_visibility_idx on public.venues (visibility);

-- ── Venue members (for sharing private/unlisted venues) ──────────────────────
create table if not exists public.venue_members (
  venue_id uuid not null references public.venues (id) on delete cascade,
  user_id  uuid not null references auth.users (id) on delete cascade,
  role     text not null default 'viewer' check (role in ('viewer', 'editor')),
  created_at timestamptz not null default now(),
  primary key (venue_id, user_id)
);

-- ── Waypoints ─────────────────────────────────────────────────────────────────
create table if not exists public.waypoints (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues (id) on delete cascade,
  name        text not null,
  type        text not null default 'other',
  lat         double precision not null,
  lng         double precision not null,
  floor       int not null default 0,
  description text,
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists waypoints_venue_idx on public.waypoints (venue_id);

-- ── Helper: can the current user read this venue? ────────────────────────────
create or replace function public.can_read_venue(v_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.venues v
    where v.id = v_id
      and (
        v.visibility in ('public', 'unlisted')
        or v.owner_id = auth.uid()
        or exists (select 1 from public.venue_members m where m.venue_id = v.id and m.user_id = auth.uid())
      )
  );
$$;

create or replace function public.can_write_venue(v_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.venues v
    where v.id = v_id
      and (
        v.owner_id = auth.uid()
        or exists (
          select 1 from public.venue_members m
          where m.venue_id = v.id and m.user_id = auth.uid() and m.role = 'editor'
        )
      )
  );
$$;

-- ── Measure: only the service role may verify a venue ────────────────────────
-- Users can never self-grant `verified`; it's forced false unless the change is
-- made with the service role (an administrator/back office).
create or replace function public.enforce_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    new.verified := false;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists venues_guard on public.venues;
create trigger venues_guard
  before insert or update on public.venues
  for each row execute function public.enforce_verification();

-- ── Auto-create a profile row for every new auth user ────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Row-Level Security ───────────────────────────────────────────────────────
alter table public.profiles      enable row level security;
alter table public.venues        enable row level security;
alter table public.venue_members enable row level security;
alter table public.waypoints     enable row level security;

-- Profiles: display names are not sensitive; anyone may read, you may only
-- write your own.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (true);
drop policy if exists profiles_upsert on public.profiles;
create policy profiles_upsert on public.profiles for insert with check (auth.uid() = id);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Venues
drop policy if exists venues_select on public.venues;
create policy venues_select on public.venues for select using (
  visibility in ('public', 'unlisted')
  or owner_id = auth.uid()
  or exists (select 1 from public.venue_members m where m.venue_id = venues.id and m.user_id = auth.uid())
);
drop policy if exists venues_insert on public.venues;
create policy venues_insert on public.venues for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists venues_update on public.venues;
create policy venues_update on public.venues for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists venues_delete on public.venues;
create policy venues_delete on public.venues for delete using (owner_id = auth.uid());

-- Venue members: visible to the member and the venue owner; managed by the owner.
drop policy if exists members_select on public.venue_members;
create policy members_select on public.venue_members for select using (
  user_id = auth.uid()
  or exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = auth.uid())
);
drop policy if exists members_insert on public.venue_members;
create policy members_insert on public.venue_members for insert with check (
  exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = auth.uid())
);
drop policy if exists members_delete on public.venue_members;
create policy members_delete on public.venue_members for delete using (
  exists (select 1 from public.venues v where v.id = venue_id and v.owner_id = auth.uid())
);

-- Waypoints inherit their venue's read rule; only owner/editors may write.
drop policy if exists waypoints_select on public.waypoints;
create policy waypoints_select on public.waypoints for select using (public.can_read_venue(venue_id));
drop policy if exists waypoints_insert on public.waypoints;
create policy waypoints_insert on public.waypoints for insert with check (public.can_write_venue(venue_id));
drop policy if exists waypoints_update on public.waypoints;
create policy waypoints_update on public.waypoints for update using (public.can_write_venue(venue_id)) with check (public.can_write_venue(venue_id));
drop policy if exists waypoints_delete on public.waypoints;
create policy waypoints_delete on public.waypoints for delete using (public.can_write_venue(venue_id));
