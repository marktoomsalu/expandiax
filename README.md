# ExpandiaX

**Your world, remembered.** A premium personal archive for the countries you have visited and the concerts you never want to forget — an interactive world map, editorial country pages, cinematic concert memories, and a shareable public profile.

## Features

- **Accounts & profiles** — email/password or Google auth, unique username, avatar, bio, home country, three-tier visibility (public / friends-only via mutual followers / private).
- **My World** — interactive SVG world map of all **195 countries**, country search (the map is never the only way in), visit years, cities, a written memory, favourite flag, up to **5 photos per country** with reordering, cover selection and deletion.
- **Concerts** — artist, tour name, date, venue, city, country, 1–10 rating, review, favourite song, setlist notes, per-concert privacy, up to **5 photos and 3 videos** with captions, covers and reordering. Search, filter (artist / year / country) and sort (newest / oldest / top rated). Dashboard statistics: totals, unique artists, countries and cities with concerts, by-year breakdown, most-seen artist, highest rated, latest, and a manually chosen favourite night.
- **Public pages** — `/u/[username]` with stats (countries of 195, % of world, continents, concerts, unique artists), map, favourite memories, recent concerts and a photo strip; per-country and per-concert public pages with prev/next navigation and related content. Private profiles and private concerts are invisible to visitors (enforced by Row Level Security, not just UI).
- **Explore** — featured public travellers, recently pinned countries, fresh concert memories, popular artists. No follows, likes, comments or messaging by design.
- Light + dark mode, reduced-motion support, keyboard-accessible search combobox and dialogs, responsive layout with a bottom navigation bar on mobile.

## The 195 countries

The country list is the **193 UN member states plus Palestine and Vatican City** (195 total). It is generated from the [`world-countries`](https://www.npmjs.com/package/world-countries) dataset into `src/data/countries.json`, keyed by ISO 3166-1 alpha-2 codes (`EE`, `ES`, …) with ISO numeric codes used to match map geometry from `world-atlas`. The same alpha-2 codes are used in the database, URLs, search, forms, flags and statistics, so every layer agrees.

## Stack

Next.js 14 (App Router, TypeScript) · Tailwind CSS · Supabase (Auth, Postgres, Storage) · react-simple-maps · Framer Motion · Lucide icons · Fraunces + Inter via Fontsource.

## Setup

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run the entire contents of [`supabase/schema.sql`](supabase/schema.sql). This creates all tables, indexes, triggers (profile auto-creation, `updated_at`, media-count caps), every Row Level Security policy, the public `media` storage bucket and its ownership policies.
3. (Optional, recommended for local dev) In **Authentication → Providers → Email**, turn **off** "Confirm email" so sign-up logs users straight in. With confirmation on, the app shows a "check your inbox" notice instead.

### 2. Environment

```bash
cp .env.example .env.local
```

Fill in from **Project Settings → API**:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

Only the anon key is used; the service-role key is never required. If the variables are missing, public pages still render (with empty data) instead of crashing, but auth and data will not work.

### 3. Run

```bash
npm install
npm run dev        # http://localhost:3000
```

Production:

```bash
npm run build
npm run start
```

Checks:

```bash
npx tsc --noEmit   # type check
npm run lint       # ESLint
```

### 4. Seed data (optional demo profile)

1. Sign up in the app with email `demo@expandiax.example`, username `liiskask` (any password).
2. Run [`supabase/seed.sql`](supabase/seed.sql) in the SQL Editor.

This fills the profile of fictional traveller **Liis Kask** with Estonia, Spain, Italy, Poland and Finland (years, cities, notes) and three concerts — a stadium pop night in Madrid, a rock show in Tallinn and a festival in Helsinki. Seed images use `picsum.photos` placeholder URLs, so no copyrighted assets are required or redistributed.

## Storage & privacy model

Uploads go to a single **public** `media` bucket at deterministic paths:

```
{user-id}/countries/{visited-country-id}/{uuid}.ext
{user-id}/concerts/{concert-id}/{uuid}.ext
{user-id}/avatar/{uuid}.ext
```

- **Writes/deletes** are restricted by storage policies to the folder matching the uploader's `auth.uid()`.
- **Row data** (which URLs appear where) is protected by RLS: private profiles and private concerts return no rows to other users.
- Because the bucket is public, a raw file URL that has already been shared remains fetchable. This is the simplest secure-enough model for an MVP; the database never leaks *which* URLs exist. Documented as a limitation below.
- Media caps (5 country photos, 5 concert photos, 3 concert videos) are enforced **in the database by triggers**, with client-side validation (type, 10 MB images / 300 MB videos) and upload progress on top.

## Deployment

Deploy anywhere Next.js runs (Vercel is simplest): set the two environment variables, build with `npm run build`. Add your production URL to Supabase **Authentication → URL Configuration** (site URL + redirect URLs) so the `/auth/callback` route works.

## Limits

| Media | Max count | Max size |
|---|---|---|
| Country photos | 5 per country | 10 MB each |
| Concert photos | 5 per concert | 10 MB each |
| Concert videos | 3 per concert | 300 MB each |

Accepted types: JPEG, PNG, WebP, GIF, AVIF images; MP4, WebM, QuickTime video.

## Known limitations

- **Public-bucket trade-off** described above: file bytes at already-known URLs stay reachable after a profile goes private (rows and pages do not).
- Upload progress uses a direct `XMLHttpRequest` to the Supabase Storage REST endpoint (the JS SDK does not expose progress).
- No image resizing/thumbnailing — originals are served (capped at 10 MB).
- Seed media are external placeholder URLs, so "delete" on seeded media removes the row but has no storage object to remove.
- No pagination — designed for personal-archive scale (hundreds of records, not millions).
- Google sign-in is not enabled (email/password only, per scope).
- The world map hides Antarctica and micro-states are hard to click at world zoom — search is the reliable path (and the only path on small screens by design).

## Scope (intentionally excluded)

Followers, likes, comments, messaging, third-party integrations (Spotify, Ticketmaster), notifications, subscriptions and native apps are deliberately out of scope.
