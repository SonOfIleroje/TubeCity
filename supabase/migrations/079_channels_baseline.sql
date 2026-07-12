-- ============================================================
-- Baseline snapshot of "channels" / "recent_uploads" — these tables
-- already exist in production (146 + 453 rows respectively as of this
-- writing) but were never captured by a tracked migration; they were
-- created out-of-band, so this repo could not reproduce the schema in
-- a fresh environment.
--
-- Columns/types below were reverse-engineered from a read-only query
-- against the live database (GET .../rest/v1/channels?limit=1), NOT
-- exported via `supabase db pull` — treat types/constraints as
-- best-effort, not byte-exact. Run `supabase db pull` for a precise
-- baseline before relying on this for anything beyond documentation.
--
-- This uses `create table if not exists`, so it is a no-op against the
-- production database where these tables already exist. Its purpose is
-- to make a *fresh* environment (new Supabase project, CI, local dev)
-- reproducible from the migration history, matching CLAUDE.md's rule
-- that schema changes go through supabase/migrations/.
--
-- Note: a separate 10-row "youtube_channels" table also exists in
-- production (id/handle/title/subscriber_count/video_count/niche/
-- last_upload_date/avatar_url) that nothing in the app currently
-- writes to. It looks like leftover seed/prototype data predating the
-- "channels" cache below, not a second live data source — flagged
-- here rather than silently dropped, since it wasn't created by this
-- migration.
-- ============================================================

create table if not exists channels (
  id                        bigint generated always as identity primary key,
  youtube_id                text not null unique,
  handle                    text,
  channel_name              text,
  avatar_url                text,
  banner_url                text,
  description               text,
  subscriber_count          bigint not null default 0,
  video_count               int not null default 0,
  total_view_count          bigint not null default 0,
  uploads_playlist_id       text,
  category                  text,
  niche                     text not null default 'other',
  is_verified               boolean not null default false,
  published_at              timestamptz,
  country                   text,
  recent_upload_count_30d   int not null default 0,
  rank                      int,
  claimed                   boolean not null default false,
  claimed_at                timestamptz,
  fetch_priority            int not null default 0,
  owned_items               jsonb not null default '[]'::jsonb,
  custom_color              text,
  billboard_images          jsonb not null default '[]'::jsonb,
  xp_total                  int not null default 0,
  xp_level                  int not null default 1,
  kudos_count               int not null default 0,
  visit_count               int not null default 0,
  app_streak                int not null default 0,
  district                  text,
  district_chosen           boolean not null default false,
  cached_at                 timestamptz not null default now(),
  created_at                timestamptz not null default now()
);

create index if not exists idx_channels_handle on channels (handle);
create index if not exists idx_channels_subscriber_count on channels (subscriber_count desc);
create index if not exists idx_channels_channel_name on channels (channel_name);
create index if not exists idx_channels_niche on channels (niche);

create table if not exists recent_uploads (
  id            bigint generated always as identity primary key,
  channel_id    bigint not null references channels(id) on delete cascade,
  video_id      text not null unique,
  title         text,
  published_at  timestamptz,
  thumbnail_url text,
  cached_at     timestamptz not null default now()
);

create index if not exists idx_recent_uploads_channel_id on recent_uploads (channel_id);
create index if not exists idx_recent_uploads_published_at on recent_uploads (published_at desc);

alter table channels       enable row level security;
alter table recent_uploads enable row level security;

do $$ begin
  create policy "Public read channels" on channels for select using (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Public read recent_uploads" on recent_uploads for select using (true);
exception when duplicate_object then null;
end $$;

-- writes go through getSupabaseAdmin() (service role), which bypasses RLS
