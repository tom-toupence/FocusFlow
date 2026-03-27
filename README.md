# FocusFlow

> A free Pomodoro timer paired with lofi music — pick a YouTube video or your Spotify playlist, stay focused, track your tasks.

## Features

- **Pomodoro timer** — Classic (25/5), Deep Work (50/10), or custom durations
- **YouTube lofi catalogue** — Curated videos + add your own URLs or playlists
- **Spotify integration** — Connect your Premium account and play your own playlists
- **Task management** — 3-state todos (todo / in progress / done) with session tracking
- **Draggable sticky notes** — Post-its on the session screen
- **Stats** — Sessions and minutes worked per day
- **Google login** — Sync your data across devices via Supabase

## Stack

- Next.js 16 (App Router) + TypeScript
- Zustand (state management)
- Tailwind CSS v4
- Supabase (auth + database)
- Spotify Web Playback SDK (PKCE OAuth)
- YouTube IFrame API

## Setup

```bash
npm install
cp .env.local.example .env.local
# Fill in your Supabase and Spotify credentials
npm run dev
```

### Environment variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `NEXT_PUBLIC_SPOTIFY_CLIENT_ID` | Your Spotify app client ID |
| `NEXT_PUBLIC_SPOTIFY_REDIRECT_URI` | OAuth callback URL |
