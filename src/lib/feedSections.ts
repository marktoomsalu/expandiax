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

/**
 * Anniversary first (same month+day, a past year). Otherwise a
 * deterministic per-day pick (same all day, no "last resurfaced" column
 * needed) among memories at least 2 months old, from the best pool that
 * isn't empty: favourites with photos, then anything with photos, then any
 * favourite — a memory is worth resurfacing mostly for its pictures.
 * Returns null when there's nothing — the section just doesn't render.
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
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const year = now.getFullYear();

  for (const e of events) {
    const d = new Date(`${e.event_date}T00:00:00`);
    if (d.getMonth() + 1 === month && d.getDate() === day && d.getFullYear() < year) {
      const yearsAgo = year - d.getFullYear();
      return {
        kind: "event",
        id: e.id,
        title: e.title,
        subtitle: `${yearsAgo} year${yearsAgo === 1 ? "" : "s"} ago today`,
        href: eventHref(e.id),
        isAnniversary: true,
      };
    }
  }
  for (const c of countries) {
    for (const v of c.country_visits) {
      if (v.date_precision !== "day") continue;
      const raw = v.visited_to ?? v.visited_from;
      if (!raw) continue;
      const d = new Date(`${raw}T00:00:00`);
      if (d.getMonth() + 1 === month && d.getDate() === day && d.getFullYear() < year) {
        const yearsAgo = year - d.getFullYear();
        return {
          kind: "country",
          id: c.id,
          title: c.country_name,
          subtitle: `${yearsAgo} year${yearsAgo === 1 ? "" : "s"} ago today`,
          href: countryHref(c.country_code),
          isAnniversary: true,
        };
      }
    }
  }

  const cutoff = new Date(now.getTime() - MIN_AGE_DAYS * 86_400_000);
  const all = [
    ...events.map((e) => ({
      favourite: e.is_favourite,
      hasPhotos: e.media_count > 0,
      date: memoryDate({ kind: "event", e }),
      memory: { kind: "event" as const, id: e.id, title: e.title, subtitle: "One to remember", href: eventHref(e.id), isAnniversary: false },
    })),
    ...countries.map((c) => ({
      favourite: c.is_favourite,
      hasPhotos: c.media_count > 0,
      date: memoryDate({ kind: "country", c }),
      memory: {
        kind: "country" as const,
        id: c.id,
        title: c.country_name,
        subtitle: "One to remember",
        href: countryHref(c.country_code),
        isAnniversary: false,
      },
    })),
  ];
  // "Then" is the past — last week's trip isn't a memory to resurface yet.
  const old = all.filter((m) => m.date === null || m.date <= cutoff);
  const pools = [old.filter((m) => m.favourite && m.hasPhotos), old.filter((m) => m.hasPhotos), old.filter((m) => m.favourite)];
  const pool = pools.find((p) => p.length > 0);
  if (!pool) return null;
  const seed = `${userId}:${now.toDateString()}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return pool[hash % pool.length].memory;
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
