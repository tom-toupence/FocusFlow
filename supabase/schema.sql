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

-- ══════════════════════════════════════════════════════════════════════════════
-- SYSTÈME D'AMIS — identité publique, graphe d'amis, stats agrégées partagées.
-- Confidentialité : les amis ne voient QUE des agrégats (minutes/streak/niveau/
-- badges) + le statut « en focus ». JAMAIS le contenu écouté, les tâches, le
-- journal, les projets (ces tables restent en RLS own-row).
-- ══════════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- Identité publique : uniquement du non-sensible (jamais l'avatar base64 privé).
create table if not exists public_profiles (
  id            uuid    primary key references auth.users(id) on delete cascade,
  username      text    unique not null,
  invite_code   text    unique not null,
  display_name  text,
  avatar_url    text,                    -- URL Google ou null (pas de base64)
  updated_at    bigint  not null default 0
);

-- Graphe d'amis (une ligne par relation, orientée requester → addressee).
create table if not exists friendships (
  id            uuid    primary key default gen_random_uuid(),
  requester_id  uuid    not null references auth.users(id) on delete cascade,
  addressee_id  uuid    not null references auth.users(id) on delete cascade,
  status        text    not null default 'pending',   -- pending | accepted
  created_at    bigint  not null default 0,
  unique (requester_id, addressee_id)
);
create index if not exists friendships_addressee_idx on friendships (addressee_id);
create index if not exists friendships_requester_idx on friendships (requester_id);

-- Stats agrégées partagées + statut focus : source UNIQUE du leaderboard ET de
-- la présence temps réel. Dénormalisé (évite d'exposer le détail journalier).
create table if not exists friend_stats (
  user_id           uuid    primary key references auth.users(id) on delete cascade,
  week_minutes      int     not null default 0,
  week_sessions     int     not null default 0,
  streak            int     not null default 0,
  level             int     not null default 1,
  xp                int     not null default 0,
  badges            int     not null default 0,
  in_focus          boolean not null default false,
  focus_started_at  bigint  not null default 0,
  focus_heartbeat   bigint  not null default 0,
  updated_at        bigint  not null default 0
);

-- Helpers SECURITY DEFINER : contournent la RLS de `friendships` à l'intérieur →
-- évitent la récursion de policy et permettent la lecture croisée.
-- is_friend = amitié ACCEPTÉE (pour les stats) ; has_link = lien quelconque
-- pending/accepted (pour afficher le nom d'un demandeur en attente).
create or replace function public.is_friend(other uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from friendships f
    where f.status = 'accepted'
      and ( (f.requester_id = auth.uid() and f.addressee_id = other)
         or (f.addressee_id = auth.uid() and f.requester_id = other) )
  );
$$;

create or replace function public.has_link(other uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from friendships f
    where (f.requester_id = auth.uid() and f.addressee_id = other)
       or (f.addressee_id = auth.uid() and f.requester_id = other)
  );
$$;

alter table public_profiles enable row level security;
alter table friendships     enable row level security;
alter table friend_stats    enable row level security;

drop policy if exists "read own or friend profile"  on public_profiles;
drop policy if exists "insert own profile"           on public_profiles;
drop policy if exists "update own profile pub"       on public_profiles;
drop policy if exists "read own friendships"         on friendships;
drop policy if exists "accept friendships"           on friendships;
drop policy if exists "delete friendships"           on friendships;
drop policy if exists "read own or friend stats"     on friend_stats;
drop policy if exists "insert own stats"             on friend_stats;
drop policy if exists "update own stats"             on friend_stats;

-- public_profiles : lisible par soi OU par un lien (pending/accepted) — permet
-- d'afficher le nom d'un demandeur en attente. Pas de SELECT global → pas
-- d'énumération de l'annuaire. Écriture réservée aux RPC (SECURITY DEFINER) :
-- aucune policy insert/update → pas d'écriture directe (username/code contrôlés).
create policy "read own or friend profile" on public_profiles for select using (auth.uid() = id or public.has_link(id));

-- invite_code est une CAPABILITY secrète : masquée au niveau colonne. Seul le
-- propriétaire la récupère via ensure_public_profile (SECURITY DEFINER, qui
-- bypasse ce grant). Les amis/liens ne lisent que les colonnes d'identité.
revoke select on public_profiles from anon, authenticated;
grant select (id, username, display_name, avatar_url, updated_at) on public_profiles to authenticated;

-- friendships : chacun voit/gère ses propres relations. INSERT (send_friend_request)
-- et UPDATE (accept_friend_request) réservés aux RPC → aucune policy insert/update
-- (empêche de forger un statut « accepted » sans consentement du destinataire).
create policy "read own friendships" on friendships for select using (auth.uid() = requester_id or auth.uid() = addressee_id);
create policy "delete friendships"   on friendships for delete using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- friend_stats : lisible par soi OU par un ami accepté ; écrit uniquement par soi.
create policy "read own or friend stats" on friend_stats for select using (auth.uid() = user_id or public.is_friend(user_id));
create policy "insert own stats"          on friend_stats for insert with check (auth.uid() = user_id);
create policy "update own stats"          on friend_stats for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── RPC ─────────────────────────────────────────────────────────────────────

-- Crée (à la 1ʳᵉ utilisation) l'identité publique : username unique dérivé du
-- nom + suffixe, invite_code unique. Idempotent : renvoie la ligne existante.
create or replace function public.ensure_public_profile(p_display_name text, p_avatar_url text)
returns public_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  existing public_profiles;
  base text;
  candidate text;
  code text;
begin
  if me is null then raise exception 'not_authenticated'; end if;

  select * into existing from public_profiles where id = me;
  if found then
    -- rafraîchit le nom/avatar affichés
    update public_profiles
       set display_name = coalesce(p_display_name, display_name),
           avatar_url   = p_avatar_url,
           updated_at   = (extract(epoch from now()) * 1000)::bigint
     where id = me
     returning * into existing;
    return existing;
  end if;

  base := lower(regexp_replace(coalesce(nullif(trim(p_display_name), ''), 'focus'), '[^a-z0-9]', '', 'gi'));
  if length(base) < 3 then base := 'focus'; end if;
  base := left(base, 16);

  loop
    candidate := base || substr(md5(random()::text), 1, 4);
    exit when not exists (select 1 from public_profiles where username = candidate);
  end loop;

  loop
    code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    exit when not exists (select 1 from public_profiles where invite_code = code);
  end loop;

  insert into public_profiles (id, username, invite_code, display_name, avatar_url, updated_at)
  values (me, candidate, code, p_display_name, p_avatar_url, (extract(epoch from now()) * 1000)::bigint)
  returning * into existing;
  return existing;
end;
$$;

-- Résout un code d'invitation → crée/accepte la relation. Le code est une
-- capacité (il faut le connaître exactement) : pas de lecture d'annuaire.
-- Retourne un statut : 'sent' | 'accepted' | 'already_friends' | 'already_pending'.
create or replace function public.send_friend_request(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  target uuid;
  rel friendships;
begin
  if me is null then raise exception 'not_authenticated'; end if;

  select id into target from public_profiles where invite_code = upper(trim(p_code));
  if target is null then raise exception 'invalid_code'; end if;
  if target = me then raise exception 'cannot_add_self'; end if;

  select * into rel from friendships
   where (requester_id = me and addressee_id = target)
      or (requester_id = target and addressee_id = me);

  if found then
    if rel.status = 'accepted' then
      return 'already_friends';
    elsif rel.addressee_id = me then
      -- l'autre m'avait déjà invité → on scelle l'amitié
      update friendships set status = 'accepted' where id = rel.id;
      return 'accepted';
    else
      return 'already_pending';
    end if;
  end if;

  insert into friendships (requester_id, addressee_id, status, created_at)
  values (me, target, 'pending', (extract(epoch from now()) * 1000)::bigint);
  return 'sent';
end;
$$;

-- Accepte une demande reçue. SEUL le destinataire (addressee) peut passer une
-- relation `pending` → `accepted`. Empêche de forger une amitié acceptée sans
-- consentement (aucune policy UPDATE directe sur friendships).
create or replace function public.accept_friend_request(p_friendship_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  update friendships
     set status = 'accepted'
   where id = p_friendship_id
     and addressee_id = auth.uid()
     and status = 'pending';
  if not found then raise exception 'not_found_or_not_pending'; end if;
end;
$$;

-- Realtime : diffuse les changements de friend_stats (la RLS SELECT ci-dessus
-- garantit qu'on ne reçoit que les lignes d'amis) → leaderboard + « en focus »
-- en direct. À défaut, activer manuellement dans Database > Replication.
do $$ begin
  alter publication supabase_realtime add table friend_stats;
exception when duplicate_object then null;
end $$;
