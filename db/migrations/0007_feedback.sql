-- Reports, support messages and blocked publishers. Applied at runtime by
-- src/lib/db.ts (SCHEMA_DDL); kept here for ops and version control. Idempotent.
--
-- feedback: what people tell the team — a report about a place someone
--   published (kind 'report', from the app), or a message from the support
--   page (kind 'support'). Staff work through it in the back office Inbox.
--   Kept until 180 days after it is resolved, and never more than a year.
-- blocked_publishers: who may no longer publish places. publisher_key is
--   'd:' plus a one-way hash of the device's random identifier, or 'a:' plus
--   a signed-in account's id.
-- wf_venues.publisher_key: the device key of whoever published the place, so
--   staff can block them from publishing again.

create table if not exists public.feedback (
  id            bigserial primary key,
  kind          text not null check (kind in ('report','support')),
  topic         text not null,
  venue_id      text,
  venue_name    text,
  message       text not null default '',
  contact_email text,
  source        text not null default 'web' check (source in ('web','ios','android')),
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  resolved_by   text,
  resolution    text,
  constraint feedback_topic_len   check (char_length(topic) between 1 and 40),
  constraint feedback_message_len check (char_length(message) <= 2000)
);
create index if not exists feedback_open_idx on public.feedback (created_at desc) where resolved_at is null;
create index if not exists feedback_venue_idx on public.feedback (venue_id) where venue_id is not null;

create table if not exists public.blocked_publishers (
  publisher_key text primary key,
  venue_id      text,
  venue_name    text,
  reason        text,
  blocked_by    text not null,
  created_at    timestamptz not null default now()
);

do $fb$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'wf_venues' and column_name = 'publisher_key') then
    alter table public.wf_venues add column publisher_key text;
  end if;
end $fb$;
