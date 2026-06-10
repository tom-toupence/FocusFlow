-- FocusFlow — Supabase schema
-- Run this in the Supabase SQL editor after creating your project.

-- Enable Google OAuth in Authentication > Providers > Google
-- Set Authorized redirect URI to: https://your-project.supabase.co/auth/v1/callback
-- Also add your app domain to: Authentication > URL Configuration > Redirect URLs

-- ─── Tables ──────────────────────────────────────────────────────────────────

create table if not exists custom_videos (
  id          text      primary key,
  user_id     uuid      references auth.users(id) on delete cascade not null,
  title       text      not null,
  channel     text      not null default 'Custom',
  youtube_id  text      not null,
  mood        text      not null,
  color       text      not null default '#1a1a2e',
  created_at  timestamptz default now()
);

create table if not exists todos (
  id            text      primary key,
  user_id       uuid      references auth.users(id) on delete cascade not null,
  text          text      not null,
  done          boolean   not null default false,
  completed_at  text,     -- local date "YYYY-MM-DD"
  created_at    timestamptz default now()
);

-- Migration for existing tables:
alter table todos add column if not exists completed_at text;

create table if not exists work_sessions (
  user_id         uuid  references auth.users(id) on delete cascade not null,
  date            text  not null,          -- YYYY-MM-DD
  sessions        int   not null default 0,
  minutes_worked  int   not null default 0,
  primary key (user_id, date)
);

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table custom_videos  enable row level security;
alter table todos           enable row level security;
alter table work_sessions   enable row level security;

create table if not exists user_playlists (
  id             text      primary key,
  user_id        uuid      references auth.users(id) on delete cascade not null,
  playlist_id    text      not null,
  start_video_id text,
  title          text      not null,
  channel_name   text,
  thumbnail_url  text,
  created_at     timestamptz default now()
);

-- Migration (projets existants)
alter table user_playlists add column if not exists start_video_id text;

alter table user_playlists enable row level security;

-- ─── Planning (time-blocking) + calendar subscription feed ───────────────────

create table if not exists plan_blocks (
  id            text  primary key,
  user_id       uuid  references auth.users(id) on delete cascade not null,
  date          text  not null,          -- YYYY-MM-DD (local)
  start_min     int   not null,          -- minutes from midnight
  duration_min  int   not null,
  label         text  not null default '',
  done          boolean not null default false,
  created_at    timestamptz default now()
);

-- One secret token per user; the public ICS feed route resolves it with the
-- service role key (server only).
create table if not exists calendar_feeds (
  token       text  primary key,
  user_id     uuid  references auth.users(id) on delete cascade not null unique,
  created_at  timestamptz default now()
);

alter table plan_blocks    enable row level security;
alter table calendar_feeds enable row level security;

-- Postgres n'a pas de "create policy if not exists" : drop + create pour que le
-- script entier soit ré-exécutable sans erreur sur un projet existant.
drop policy if exists "own plan blocks" on plan_blocks;
drop policy if exists "own feed token"  on calendar_feeds;
drop policy if exists "own videos"      on custom_videos;
drop policy if exists "own todos"       on todos;
drop policy if exists "own sessions"    on work_sessions;
drop policy if exists "own playlists"   on user_playlists;

create policy "own plan blocks" on plan_blocks    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own feed token"  on calendar_feeds for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own videos"    on custom_videos   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own todos"     on todos            for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own sessions"  on work_sessions    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own playlists" on user_playlists   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
