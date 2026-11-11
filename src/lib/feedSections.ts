import { countryByCode } from "@/lib/countries";

// ---------- THEN: a resurfaced memory from the viewer's own archive ----------

export type OwnEventLite = { id: string; title: string; event_date: string; cover_media_id: string | null; is_favourite: boolean; media_count: number };
export type OwnCountryLite = {
  id: string;
  country_code: string;
  country_name: string;
  cover_media_id: string | null;
  is_favourite: boolean;
  media_count: number;
  country_visits: { year: number; visited_from: string | null; visited_to: string | null; date_precision: string }[];
};

export type ResurfacedMemory = {
  kind: "event" | "country";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  isAnniversary: boolean;
};

const MIN_AGE_DAYS = 60;

// When it happened, for the "not something from last week" check. Countries
// with only a year logged count as mid-year.
function memoryDate(m: { kind: "event"; e: OwnEventLite } | { kind: "country"; c: OwnCountryLite }): Date | null {
  if (m.kind === "event") return new Date(`${m.e.event_date}T00:00:00`);
  const dates = m.c.country_visits.map((v) => v.visited_to ?? v.visited_from ?? `${v.year}-07-01`).sort();
  return dates.length ? new Date(`${dates.at(-1)}T00:00:00`) : null;
}

/** Every memory with the day it happened (only exact days count for anniversaries). */
function allMemories(events: OwnEventLite[], countries: OwnCountryLite[], eventHref: (id: string) => string, countryHref: (code: string) => string) {
  type M = { memory: ResurfacedMemory; day: Date | null; date: Date | null; favourite: boolean; hasPhotos: boolean };
  const out: M[] = [];
  for (const e of events) {
    const d = new Date(`${e.event_date}T00:00:00`);
    out.push({
      memory: { kind: "event", id: e.id, title: e.title, subtitle: "One to remember", href: eventHref(e.id), isAnniversary: false },
      day: d,
      date: d,
      favourite: e.is_favourite,
      hasPhotos: e.media_count > 0,
    });
  }
  for (const c of countries) {
    const memory = { kind: "country" as const, id: c.id, title: c.country_name, subtitle: "One to remember", href: countryHref(c.country_code), isAnniversary: false };
    const days = c.country_visits.filter((v) => v.date_precision === "day" && (v.visited_to ?? v.visited_from)).map((v) => new Date(`${v.visited_to ?? v.visited_from}T00:00:00`));
    const date = memoryDate({ kind: "country", c });
    // One entry per day-exact visit (each can have its anniversary), or one undated.
    if (days.length) for (const day of days) out.push({ memory, day, date, favourite: c.is_favourite, hasPhotos: c.media_count > 0 });
    else out.push({ memory, day: null, date, favourite: c.is_favourite, hasPhotos: c.media_count > 0 });
  }
  return out;
}

/** "3 months", "1 year and 3 months", "2 years and 1 month". */
export function monthsAgo(n: number): string {
  const y = Math.floor(n / 12);
  const m = n % 12;
  const months = `${m} month${m === 1 ? "" : "s"}`;
  if (!y) return months;
  const years = `${y} year${y === 1 ? "" : "s"}`;
  return m ? `${years} and ${months}` : years;
}

const dayHash = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash;
};

/**
 * The day's pick from a list, the same all day. The list is shuffled once
 * per person and walked a step a day: never the same two days running, and
 * every memory has its turn before any comes back.
 */
function pickOfDay<T extends { memory: ResurfacedMemory }>(list: T[], userId: string, now: Date): T {
  const shuffled = [...list].sort((a, b) => dayHash(`${userId}:${a.memory.id}`) - dayHash(`${userId}:${b.memory.id}`) || a.memory.id.localeCompare(b.memory.id));
  const day = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000);
  return shuffled[day % shuffled.length];
}

/**
 * The feed's "One to remember", a different memory each day:
 *  1. something from exactly 1, 2, 3… years ago today;
 *  2. otherwise from exactly 1, 2, 3… months ago today;
 *  3. otherwise one of your memories (favourites with photos first, then
 *     anything with photos, then any favourite, then anything), never the
 *     same as yesterday's when there's another to show.
 * Returns null when there's nothing at all — the section just doesn't render.
 */
export function pickResurfacedMemory(
  events: OwnEventLite[],
  countries: OwnCountryLite[],
  userId: string,
  now: Date,
  username: string
): ResurfacedMemory | null {
  const eventHref = (id: string) => `/u/${username}/events/${id}`;
  const countryHref = (code: string) => `/u/${username}/countries/${code.toLowerCase()}`;
  const all = allMemories(events, countries, eventHref, countryHref);
  if (!all.length) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 1. Years ago today.
  const yearly = all.filter((m) => m.day && m.day.getDate() === today.getDate() && m.day.getMonth() === today.getMonth() && m.day.getFullYear() < today.getFullYear());
  // Among several, the ones with photos first.
  const photosFirst = <T extends { hasPhotos: boolean }>(list: T[]) => (list.some((m) => m.hasPhotos) ? list.filter((m) => m.hasPhotos) : list);
  if (yearly.length) {
    const m = pickOfDay(photosFirst(yearly), userId, now);
    const n = today.getFullYear() - m.day!.getFullYear();
    return { ...m.memory, subtitle: `${n} year${n === 1 ? "" : "s"} ago today`, isAnniversary: true };
  }

  // 2. Months ago today (not a whole number of years: that's 1.).
  const monthly = all.filter((m) => {
    if (!m.day || m.day.getDate() !== today.getDate()) return false;
    const months = (today.getFullYear() - m.day.getFullYear()) * 12 + (today.getMonth() - m.day.getMonth());
    return months > 0 && months % 12 !== 0;
  });
  if (monthly.length) {
    const m = pickOfDay(photosFirst(monthly), userId, now);
    const n = (today.getFullYear() - m.day!.getFullYear()) * 12 + (today.getMonth() - m.day!.getMonth());
    return { ...m.memory, subtitle: `${monthsAgo(n)} ago today`, isAnniversary: true };
  }

  // 3. One of them, a different one each day.
  const unique = [...new Map(all.map((m) => [m.memory.id, m])).values()];
  const cutoff = new Date(now.getTime() - MIN_AGE_DAYS * 86_400_000);
  // "Then" is the past: last week's trip isn't a memory to resurface yet (unless that's all there is).
  const old = unique.filter((m) => m.date === null || m.date <= cutoff);
  const pools = [old.filter((m) => m.favourite && m.hasPhotos), old.filter((m) => m.hasPhotos), old.filter((m) => m.favourite), old, unique];
  const pool = pools.find((p) => p.length > 0)!;
  return pickOfDay(pool, userId, now).memory;
}

// ---------- TOGETHER lives in src/lib/together.ts ----------

// ---------- NEXT: experiences that could become future memories ----------

export type NextSuggestion = { code: string; name: string; flag: string; friendCount: number };

/** Countries people you follow have visited that you haven't — existing relational data only, no external integration. */
export function buildNextSuggestions(followeeCountryCodes: string[], ownCountryCodes: Set<string>, limit = 4): NextSuggestion[] {
  const counts = new Map<string, number>();
  for (const code of followeeCountryCodes) {
    if (ownCountryCodes.has(code)) continue;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  const suggestions: NextSuggestion[] = [];
  for (const [code, friendCount] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    const meta = countryByCode(code);
    if (!meta) continue;
    suggestions.push({ code, name: meta.name, flag: meta.flag, friendCount });
    if (suggestions.length >= limit) break;
  }
  return suggestions;
}

/**
 * Splits the feed (newest first) into what's new since your last visit and
 * everything earlier — the "you're all caught up" point sits between them,
 * with your own memory and what's next right after it. After a long break
 * only the newest few count as new, so the caught-up point is never buried;
 * on a first-ever visit the newest few do.
 */
export function splitFresh<T extends { created_at: string }>(
  items: T[],
  lastSeenAt: string | null,
  { maxFresh = 10, firstVisit = 5 } = {}
): { fresh: T[]; earlier: T[] } {
  const seen = lastSeenAt ? Date.parse(lastSeenAt) : null;
  const newCount = seen === null ? firstVisit : items.filter((i) => Date.parse(i.created_at) > seen).length;
  const n = Math.min(newCount, maxFresh, items.length);
  return { fresh: items.slice(0, n), earlier: items.slice(n) };
}

// ---------- Country bursts: one card instead of a flood ----------

export type CountryBurst<T> = { kind: "burst"; actorId: string; items: T[] };

/**
 * Someone picking the countries they've been to (onboarding, or a catch-up
 * session) shouldn't fill everyone's feed with one bare card per country.
 * Bare country posts (no photos, no story) from the same person added within
 * a few hours of each other become one "added N countries" card, placed
 * where the newest of them was. In someone's first week (`joinedAt`), all
 * their bare countries become one welcome card, however spread out, from
 * two up. Posts with photos or words stay as they are.
 */
export function groupCountryBursts<T extends { kind: string; actor_id: string; created_at: string }>(
  items: T[],
  isBare: (item: T) => boolean,
  { windowHours = 6, min = 3, joinedAt }: { windowHours?: number; min?: number; joinedAt?: (actorId: string) => string | null | undefined } = {}
): (T | CountryBurst<T>)[] {
  const WEEK = 7 * 86_400_000;
  const inFirstWeek = (item: T) => {
    const joined = joinedAt?.(item.actor_id);
    if (!joined) return false;
    const age = Date.parse(item.created_at) - Date.parse(joined);
    return age >= 0 && age < WEEK;
  };
  const window = windowHours * 3_600_000;
  const used = new Set<T>();
  const out: (T | CountryBurst<T>)[] = [];
  for (const item of items) {
    if (used.has(item)) continue;
    if (item.kind !== "country" || !isBare(item)) {
      out.push(item);
      continue;
    }
    const welcome = inFirstWeek(item);
    // Chain back in time: each next one within the window of the previous.
    const group = [item];
    let last = Date.parse(item.created_at);
    for (const other of items) {
      if (other === item || used.has(other) || other.kind !== "country" || other.actor_id !== item.actor_id || !isBare(other)) continue;
      const t = Date.parse(other.created_at);
      if (welcome ? inFirstWeek(other) : t <= last && last - t <= window) {
        group.push(other);
        last = Math.min(last, t);
      }
    }
    if (group.length >= (welcome ? 2 : min)) {
      group.forEach((g) => used.add(g));
      out.push({ kind: "burst", actorId: item.actor_id, items: group });
    } else {
      out.push(item);
    }
  }
  return out;
}
