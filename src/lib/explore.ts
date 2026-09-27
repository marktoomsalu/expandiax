// Explore: what's trending, which places are popular, and who you'd click
// with — all worked out from what people have already logged. Counts are
// only shown once they're real (see MIN_COUNT), so nothing looks invented.

import { artistKey } from "@/lib/concerts";
import type { EventType } from "@/lib/types";

export const MIN_COUNT = 2;

export type LiveRow = {
  id: string;
  user_id: string;
  event_type: EventType;
  title: string;
  spotify_artist_name: string | null;
  spotify_artist_image: string | null;
  event_date: string;
};

const LIVE_TYPES: EventType[] = ["concert", "festival", "sport", "conference"];

/** "Positivus 2025" and "Positivus" are the same festival; a concert is its artist. */
export function liveName(e: Pick<LiveRow, "event_type" | "title" | "spotify_artist_name">): string {
  if (e.event_type === "concert" && e.spotify_artist_name?.trim()) return e.spotify_artist_name.trim();
  return e.title.replace(/\b(19|20)\d{2}\b/g, "").replace(/\s{2,}/g, " ").replace(/[\s–—-]+$/, "").trim() || e.title.trim();
}

export const liveKey = (name: string) => artistKey(name);

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

export type Trending = {
  key: string;
  slug: string;
  name: string;
  image: string | null;
  type: EventType;
  memories: number;
  people: number;
  latest: string;
};

/** Artists, festivals and events most people have logged. Only ones logged at least MIN_COUNT times. */
export function trendingLive(events: LiveRow[], { min = MIN_COUNT, limit = 10 } = {}): Trending[] {
  const groups = new Map<string, Trending & { users: Set<string> }>();
  for (const e of events) {
    if (!LIVE_TYPES.includes(e.event_type)) continue;
    const name = liveName(e);
    const key = liveKey(name);
    if (!key) continue;
    const g = groups.get(key) ?? { key, slug: slugify(name), name, image: null, type: e.event_type, memories: 0, people: 0, latest: e.event_date, users: new Set<string>() };
    g.memories += 1;
    g.users.add(e.user_id);
    g.image ??= e.spotify_artist_image;
    if (e.event_date > g.latest) g.latest = e.event_date;
    groups.set(key, g);
  }
  return [...groups.values()]
    .map(({ users, ...g }) => ({ ...g, people: users.size }))
    .filter((g) => g.memories >= min)
    .sort((a, b) => b.people - a.people || b.memories - a.memories || b.latest.localeCompare(a.latest))
    .slice(0, limit);
}

export type PopularPlace = { code: string; travellers: number };

/** Countries the most people have been to. */
export function popularPlaces(rows: { user_id: string; country_code: string }[], { min = MIN_COUNT, limit = 12 } = {}): PopularPlace[] {
  const users = new Map<string, Set<string>>();
  for (const r of rows) users.set(r.country_code, (users.get(r.country_code) ?? new Set()).add(r.user_id));
  return [...users.entries()]
    .map(([code, u]) => ({ code, travellers: u.size }))
    .filter((p) => p.travellers >= min)
    .sort((a, b) => b.travellers - a.travellers || a.code.localeCompare(b.code))
    .slice(0, limit);
}

export type Taste = { countries: Set<string>; live: Set<string>; home: string | null };
export type Match = { sharedCountries: number; sharedLive: string[]; sameHome: boolean; score: number };

/** How much two people's worlds overlap. Seeing the same artist live counts more than a shared country. */
export function overlap(me: Taste, them: Taste, liveNames: Map<string, string> = new Map()): Match {
  const sharedCountries = [...them.countries].filter((c) => me.countries.has(c)).length;
  const sharedLive = [...them.live].filter((k) => me.live.has(k)).map((k) => liveNames.get(k) ?? k);
  const sameHome = !!me.home && me.home === them.home;
  return { sharedCountries, sharedLive, sameHome, score: sharedCountries + 3 * sharedLive.length + (sameHome ? 2 : 0) };
}

export function matchReason(m: Match, homeName?: string | null): string {
  const parts: string[] = [];
  if (m.sharedLive.length === 1) parts.push(`You've both seen ${m.sharedLive[0]} live`);
  else if (m.sharedLive.length > 1) parts.push(`${m.sharedLive.length} artists you've both seen live`);
  if (m.sharedCountries) parts.push(`${m.sharedCountries} ${m.sharedCountries === 1 ? "country" : "countries"} in common`);
  if (m.sameHome && homeName) parts.push(`Also from ${homeName}`);
  return parts.join(" · ");
}
