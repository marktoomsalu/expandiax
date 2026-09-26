// TOGETHER — the moments you shared with people you follow, found from what
// you've each logged: the same concert or race (even when you named it
// differently), overlapping trips to the same country, and — only where
// it's plausible — "were you there too?" prompts.

import type { EventType } from "@/lib/types";

export type TogetherEvent = {
  id: string;
  user_id: string;
  title: string;
  event_type: EventType;
  event_date: string; // yyyy-mm-dd
  venue: string;
  city: string;
  country_code: string;
  country_name?: string;
  spotify_artist_id: string | null;
  spotify_artist_name: string | null;
  spotify_artist_image?: string | null;
};

export type TogetherTrip = {
  user_id: string;
  country_code: string;
  from: string; // yyyy-mm-dd
  to: string; // yyyy-mm-dd
};

export type SharedEvent = { kind: "event"; personId: string; date: string; mine: TogetherEvent; theirs: TogetherEvent };
export type SharedTrip = { kind: "trip"; personId: string; date: string; countryCode: string; from: string; to: string };
export type Shared = SharedEvent | SharedTrip;

export type PromptReason = "trip" | "artist" | "home";
export type Prompt = { personId: string; event: TogetherEvent; reason: PromptReason };

// ---------------------------------------------------------------- matching

const STOPWORDS = new Set(["the", "a", "an", "and", "of", "at", "in", "live", "tour", "concert", "show", "world", "festival", "edition"]);

export function normalizeName(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const tokens = (s: string) => new Set(normalizeName(s).split(" ").filter((t) => t.length > 1 && !STOPWORDS.has(t) && !/^\d{4}$/.test(t)));

/** "Coldplay" ~ "Coldplay – Music of the Spheres"; "Tallinn Marathon" ~ "Tallinn Marathon 2025". */
export function titlesMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
  if (short.length >= 4 && ` ${long} `.includes(` ${short} `)) return true;
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return false;
  const common = [...ta].filter((t) => tb.has(t)).length;
  return common / Math.min(ta.size, tb.size) >= 0.75 && common >= 1 && common / Math.max(ta.size, tb.size) >= 0.5;
}

const DAY = 86_400_000;
const daysBetween = (a: string, b: string) => Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY;

// Festivals, races and conferences run over several days; people log the day they went.
const MULTI_DAY: EventType[] = ["festival", "sport", "conference"];

function sameArtist(a: TogetherEvent, b: TogetherEvent) {
  if (a.spotify_artist_id && a.spotify_artist_id === b.spotify_artist_id) return true;
  const na = normalizeName(a.spotify_artist_name);
  return !!na && na === normalizeName(b.spotify_artist_name);
}

function samePlace(a: TogetherEvent, b: TogetherEvent) {
  const va = normalizeName(a.venue);
  if (!va || va !== normalizeName(b.venue)) return false;
  const ca = normalizeName(a.city);
  const cb = normalizeName(b.city);
  return !ca || !cb || ca === cb;
}

/** Were these two logged events the same experience? */
export function sameEvent(a: TogetherEvent, b: TogetherEvent): boolean {
  const tolerance = MULTI_DAY.includes(a.event_type) || MULTI_DAY.includes(b.event_type) ? 3 : 0;
  if (daysBetween(a.event_date, b.event_date) > tolerance) return false;
  if (a.country_code && b.country_code && a.country_code !== b.country_code) return false;
  // Same night, same artist or same venue: the same show even if one wrote "Coldplay" and the other the tour name.
  if (a.event_date === b.event_date && (sameArtist(a, b) || samePlace(a, b))) return true;
  return titlesMatch(a.title, b.title);
}

// ---------------------------------------------------------------- trips

type Visit = { visited_from: string | null; visited_to: string | null; date_precision: "year" | "month" | "day" };

const lastDayOfMonth = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

/** A trip as a date range — only when it's dated to the month or the day (a year alone is too vague to say "together"). */
export function tripRange(v: Visit): { from: string; to: string } | null {
  if (!v.visited_from || v.date_precision === "year") return null;
  const to = v.visited_to ?? v.visited_from;
  if (v.date_precision === "month") return { from: `${v.visited_from.slice(0, 7)}-01`, to: lastDayOfMonth(to.slice(0, 7)) };
  return { from: v.visited_from, to };
}

export function tripOverlap(a: TogetherTrip, b: TogetherTrip): { from: string; to: string } | null {
  if (a.country_code !== b.country_code) return null;
  const from = a.from > b.from ? a.from : b.from;
  const to = a.to < b.to ? a.to : b.to;
  return from <= to ? { from, to } : null;
}

// ---------------------------------------------------------------- putting it together

const PROMPT_TYPES: EventType[] = ["concert", "festival", "sport", "conference"];

export function findTogether(input: {
  myEvents: TogetherEvent[];
  myTrips: TogetherTrip[];
  theirEvents: TogetherEvent[];
  theirTrips: TogetherTrip[];
  homeCountry: string | null;
  today: string; // yyyy-mm-dd
}): { shared: Shared[]; prompts: Prompt[] } {
  const { myEvents, myTrips, theirEvents, theirTrips, homeCountry, today } = input;
  const shared: Shared[] = [];
  const matchedTheirs = new Set<string>();

  for (const theirs of theirEvents) {
    const mine = myEvents.find((m) => sameEvent(m, theirs));
    if (!mine) continue;
    matchedTheirs.add(theirs.id);
    shared.push({ kind: "event", personId: theirs.user_id, date: theirs.event_date, mine, theirs });
  }

  const seenTrip = new Set<string>();
  for (const theirs of theirTrips) {
    for (const mine of myTrips) {
      const overlap = tripOverlap(mine, theirs);
      if (!overlap) continue;
      const key = `${theirs.user_id}|${theirs.country_code}|${overlap.from.slice(0, 7)}`;
      if (seenTrip.has(key)) continue;
      seenTrip.add(key);
      shared.push({ kind: "trip", personId: theirs.user_id, date: overlap.from, countryCode: theirs.country_code, from: overlap.from, to: overlap.to });
    }
  }
  shared.sort((a, b) => b.date.localeCompare(a.date));

  // Prompts: only where you could plausibly have been there too.
  const myArtistIds = new Set(myEvents.map((e) => e.spotify_artist_id).filter(Boolean));
  const myArtistNames = new Set(myEvents.map((e) => normalizeName(e.spotify_artist_name)).filter(Boolean));
  const recent = new Date(Date.parse(`${today}T00:00:00Z`) - 540 * DAY).toISOString().slice(0, 10); // ~18 months
  const prompts: Prompt[] = [];
  const promptedKeys = new Set<string>();
  for (const e of theirEvents) {
    if (matchedTheirs.has(e.id) || !PROMPT_TYPES.includes(e.event_type) || e.event_date > today) continue;
    // Several friends logging the same show → ask once.
    const key = `${normalizeName(e.title)}|${e.event_date}`;
    if (promptedKeys.has(key)) continue;
    let reason: PromptReason | null = null;
    if (myTrips.some((t) => t.country_code === e.country_code && t.from <= e.event_date && e.event_date <= t.to)) reason = "trip";
    else if ((e.spotify_artist_id && myArtistIds.has(e.spotify_artist_id)) || myArtistNames.has(normalizeName(e.spotify_artist_name))) reason = "artist";
    else if (homeCountry && e.country_code === homeCountry && e.event_date >= recent) reason = "home";
    if (!reason) continue;
    promptedKeys.add(key);
    prompts.push({ personId: e.user_id, event: e, reason });
  }
  const weight: Record<PromptReason, number> = { trip: 0, artist: 1, home: 2 };
  prompts.sort((a, b) => weight[a.reason] - weight[b.reason] || b.event.event_date.localeCompare(a.event.event_date));

  return { shared, prompts };
}
