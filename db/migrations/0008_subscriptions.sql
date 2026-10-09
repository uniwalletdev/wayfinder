-- Hospital subscriptions: the "Official" listing a hospital pays for, monthly
-- or yearly, through Stripe. Applied at runtime by src/lib/db.ts (SCHEMA_DDL);
-- kept here for ops and version control. Idempotent. docs/subscriptions.md.
--
-- wf_orgs: whoever pays — an NHS trust, a private group, a hospital abroad —
--   with its Stripe customer and the branding the app shows for its sites.
-- wf_org_sites: one hospital site an organisation lists, its tier, how it pays,
--   its status (src/lib/billing/status.ts) and the terms it accepted. A site
--   can be listed by one organisation at a time; a lapsed listing frees it.
-- wf_org_members: who at the organisation can sign in to its account, by
--   email, and whether they manage it or only read it.
-- wf_billing_events: Stripe webhook events already handled, so a redelivery
--   is not applied twice.

create table if not exists public.wf_orgs (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  kind               text not null default 'other' check (kind in ('nhs','public','private','other')),
  country            text not null default 'GB',
  stripe_customer_id text unique,
  billing_email      text,
  brand_color        text,
  logo_type          text,
  logo_data          text,
  created_by         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint wf_orgs_name_len check (char_length(name) between 1 and 160)
);
create table if not exists public.wf_org_sites (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references public.wf_orgs(id) on delete cascade,
  venue_id               text not null,
  venue_name             text not null,
  tier                   text not null check (tier in ('small','medium','large')),
  billing_interval       text not null check (billing_interval in ('month','year')),
  currency               text not null check (currency in ('gbp','eur','usd')),
  billing                text not null check (billing in ('invoice','online')),
  status                 text not null default 'pending' check (status in ('pending','review','trial','active','past_due','lapsed')),
  stripe_subscription_id text unique,
  renews_on              date,
  po_number              text,
  claim_email            text not null,
  terms_version          text not null,
  terms_accepted_at      timestamptz not null default now(),
  terms_accepted_by      text not null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create unique index if not exists wf_org_sites_live_venue on public.wf_org_sites (venue_id) where status <> 'lapsed';
create index if not exists wf_org_sites_org_idx on public.wf_org_sites (org_id);
create table if not exists public.wf_org_members (
  org_id     uuid not null references public.wf_orgs(id) on delete cascade,
  email      text not null,
  role       text not null check (role in ('manager','viewer')),
  user_id    text,
  added_by   text,
  created_at timestamptz not null default now(),
  primary key (org_id, email)
);
create index if not exists wf_org_members_email_idx on public.wf_org_members (email);
create table if not exists public.wf_billing_events (
  id          text primary key,
  type        text not null,
  received_at timestamptz not null default now()
);
