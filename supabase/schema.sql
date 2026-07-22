-- FocusFlow — Supabase schema (COMPLET, idempotent : ré-exécutable sans risque).
-- À exécuter dans le SQL Editor de Supabase. Couvre la création initiale ET les
-- migrations d'un projet existant (add column if not exists).

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

-- Migrations todos (Kanban : colonnes ajoutées après la v1 — sans elles les
-- upserts échouent en silence et les tâches ne se synchronisent pas)
alter table todos add column if not exists completed_at text;
alter table todos add column if not exists status text not null default 'todo';
alter table todos add column if not exists priority text;
alter table todos add column if not exists due_date text;
alter table todos add column if not exists pomodoro_estimate int;
alter table todos add column if not exists pomodoros_used int;
alter table todos add column if not exists created_at_local text;

create table if not exists work_sessions (
  user_id         uuid  references auth.users(id) on delete cascade not null,
  date            text  not null,          -- YYYY-MM-DD
  sessions        int   not null default 0,
  minutes_worked  int   not null default 0,
  primary key (user_id, date)
);

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

-- Migrations user_playlists
alter table user_playlists add column if not exists start_video_id text;
alter table user_playlists add column if not exists extra_videos jsonb not null default '[]'::jsonb;

-- Profil custom (nom/avatar) — manquait du schema initial
create table if not exists profiles (
  id            uuid  primary key references auth.users(id) on delete cascade,
  display_name  text,
  avatar_data   text,
  updated_at    timestamptz default now()
);

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

-- ─── Projets & deadlines ─────────────────────────────────────────────────────

create table if not exists projects (
  id                text  primary key,
  user_id           uuid  references auth.users(id) on delete cascade not null,
  name              text  not null,
  color             text  not null default '#8b5cf6',
  deadline          text,                 -- YYYY-MM-DD ou null
  pomodoro_budget   int   not null default 0,
  pomodoros_done    int   not null default 0,
  created_at_local  text  not null default '',  -- YYYY-MM-DD local
  created_at        timestamptz default now()
);

-- ─── User state (KV jsonb) ───────────────────────────────────────────────────
-- Synchronise les petits stores : routines, journal, objectif quotidien,
-- historique de lecture, distractions, succès, sprint. Une ligne par clé.

create table if not exists user_state (
  user_id     uuid    references auth.users(id) on delete cascade not null,
  key         text    not null,
  value       jsonb   not null default '{}'::jsonb,
  updated_at  bigint  not null default 0,   -- epoch ms (écrit par le client)
  primary key (user_id, key)
);

-- ─── Playlists locales (créées dans l'app) ───────────────────────────────────

create table if not exists local_playlists (
  id          text    primary key,
  user_id     uuid    references auth.users(id) on delete cascade not null,
  name        text    not null,
  tracks      jsonb   not null default '[]'::jsonb,
  created_at  bigint  not null default 0,   -- epoch ms
  updated_at  bigint  not null default 0
);

-- ─── Row Level Security ──────────────────────────────────────────────────────

alter table custom_videos   enable row level security;
alter table todos           enable row level security;
alter table work_sessions   enable row level security;
alter table user_playlists  enable row level security;
alter table profiles        enable row level security;
alter table plan_blocks     enable row level security;
alter table calendar_feeds  enable row level security;
alter table projects        enable row level security;
alter table user_state      enable row level security;
alter table local_playlists enable row level security;

-- Postgres n'a pas de "create policy if not exists" : drop + create pour que le
-- script entier soit ré-exécutable sans erreur sur un projet existant.
drop policy if exists "own videos"          on custom_videos;
drop policy if exists "own todos"           on todos;
drop policy if exists "own sessions"        on work_sessions;
drop policy if exists "own playlists"       on user_playlists;
drop policy if exists "own profile"         on profiles;
drop policy if exists "own plan blocks"     on plan_blocks;
drop policy if exists "own feed token"      on calendar_feeds;
drop policy if exists "own projects"        on projects;
drop policy if exists "own state"           on user_state;
drop policy if exists "own local playlists" on local_playlists;

create policy "own videos"          on custom_videos   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own todos"           on todos           for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own sessions"        on work_sessions   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own playlists"       on user_playlists  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own profile"         on profiles        for all using (auth.uid() = id)      with check (auth.uid() = id);
create policy "own plan blocks"     on plan_blocks     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own feed token"      on calendar_feeds  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own projects"        on projects        for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own state"           on user_state      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own local playlists" on local_playlists for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
