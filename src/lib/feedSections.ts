import { countryByCode } from "@/lib/countries";
import type { EventPrefill } from "@/lib/eventPrefill";
import type { FeedEvent } from "@/lib/types";

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

/** Same-experience matching key for TOGETHER — must be built identically on both sides (a followee's feed row and the viewer's own event). */
export function eventMatchKey(title: string, eventDate: string): string {
  return `${normalizeTitle(title)}|${eventDate}`;
}

// ---------- THEN: a resurfaced memory from the viewer's own archive ----------

export type OwnEventLite = { id: string; title: string; event_date: string; cover_media_id: string | null; is_favourite: boolean };
export type OwnCountryLite = {
  id: string;
  country_code: string;
  country_name: string;
  cover_media_id: string | null;
  is_favourite: boolean;
  country_visits: { visited_from: string | null; visited_to: string | null; date_precision: string }[];
};

export type ResurfacedMemory = {
  kind: "event" | "country";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  coverMediaId: string | null;
};

/**
 * Anniversary first (same month+day, a past year), else a deterministic
 * per-day pick from favourites (same pick all day, no new "last resurfaced"
 * tracking column needed) — never literally random, never a placeholder
 * when the viewer has nothing yet (returns null, section just doesn't render).
 */
export function pickResurfacedMemory(
  events: OwnEventLite[],
  countries: OwnCountryLite[],
  userId: string,
  now: Date
): ResurfacedMemory | null {
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
        href: `/events/${e.id}/edit`,
        coverMediaId: e.cover_media_id,
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
          href: `/my-world/${c.country_code.toLowerCase()}`,
          coverMediaId: c.cover_media_id,
        };
      }
    }
  }

  const favourites: ResurfacedMemory[] = [
    ...events
      .filter((e) => e.is_favourite)
      .map((e) => ({ kind: "event" as const, id: e.id, title: e.title, subtitle: "One to remember", href: `/events/${e.id}/edit`, coverMediaId: e.cover_media_id })),
    ...countries
      .filter((c) => c.is_favourite)
      .map((c) => ({
        kind: "country" as const,
        id: c.id,
        title: c.country_name,
        subtitle: "One to remember",
        href: `/my-world/${c.country_code.toLowerCase()}`,
        coverMediaId: c.cover_media_id,
      })),
  ];
  if (favourites.length === 0) return null;
  const seed = `${userId}:${now.toDateString()}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return favourites[hash % favourites.length];
}

// ---------- TOGETHER: shared experiences with people you follow ----------

export type TogetherCard =
  | { status: "shared"; actorName: string; title: string; theirHref: string; ownHref: string }
  | { status: "prompt"; actorName: string; title: string; theirHref: string; prefill: EventPrefill };

/** Reuses the same followees' feed rows NEW already fetched — no second query. */
export function buildTogetherCards(
  feedEvents: FeedEvent[],
  actors: Map<string, { username: string; display_name: string }>,
  ownEventsByKey: Map<string, string>,
  limit = 4
): TogetherCard[] {
  const results: TogetherCard[] = [];
  for (const item of feedEvents) {
    if (item.kind !== "event" || !item.visit_date) continue;
    const actor = actors.get(item.actor_id);
    if (!actor) continue;
    const key = eventMatchKey(item.title, item.visit_date);
    const ownId = ownEventsByKey.get(key);
    if (ownId) {
      results.push({
        status: "shared",
        actorName: actor.display_name,
        title: item.title,
        theirHref: `/u/${actor.username}/events/${item.ref_id}`,
        ownHref: `/events/${ownId}/edit`,
      });
    } else {
      results.push({
        status: "prompt",
        actorName: actor.display_name,
        title: item.title,
        theirHref: `/u/${actor.username}/events/${item.ref_id}`,
        prefill: {
          title: item.title,
          event_type: item.event_type ?? "concert",
          event_date: item.visit_date,
          venue: item.venue ?? "",
          city: item.city ?? "",
          country_code: item.country_code,
          country_name: item.country_name ?? "",
          spotify_artist_id: null,
          spotify_artist_name: null,
          spotify_artist_image: null,
        },
      });
    }
    if (results.length >= limit) break;
  }
  return results;
}

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
