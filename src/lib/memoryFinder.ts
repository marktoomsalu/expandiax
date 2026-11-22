// "From my photos": for members. What their photos know that ExpandiaX
// doesn't yet: trips and events never added, and exact days, places and
// venues for the ones that were. Found on the phone (the same scan as Find my
// world), matched against what's saved so nothing is ever added twice, and
// only written once they've looked it over and said yes.

import { createClient } from "@/lib/supabase/client";
import { countryByCode } from "@/lib/countries";
import { daysBetween, type FoundTrip } from "@/lib/tripFinder";
import { sameVenue } from "@/lib/eventMatch";
import { placeKey } from "@/lib/photoPlaces";
import { savePlaces } from "@/components/PhotoPlaceSuggestion";
import type { FoundEvent, TripTown } from "@/lib/worldStory";

export type SavedVisit = {
  id: string;
  countryId: string;
  code: string;
  year: number;
  from: string | null;
  to: string | null;
  precision: "year" | "month" | "day";
  /** Its places' names, as saved. */
  cities: string[];
};

export type SavedEvent = {
  id: string;
  title: string;
  date: string;
  /** The last day of one that lasts more than a day (migration 089). */
  end?: string | null;
  venue: string | null;
  city: string | null;
  code: string | null;
  artist: string | null;
};

export type Saved = { visits: SavedVisit[]; countries: Map<string, string>; events: SavedEvent[] };

export type EventChanges = { date?: string; venue?: string; city?: string; artist?: string };

export type Suggestion =
  /** A saved trip, with its exact days (when it had only a year or a month) and the places it's missing. */
  | { key: string; kind: "better-trip"; visit: SavedVisit; trip: FoundTrip; dates: boolean; towns: TripTown[] }
  /** A trip saved with only a year (or month) that more than one found trip could be. */
  | { key: string; kind: "which-trip"; visit: SavedVisit; options: { trip: FoundTrip; towns: TripTown[] }[] }
  | { key: string; kind: "new-trip"; trip: FoundTrip; towns: TripTown[]; newCountry: boolean }
  | { key: string; kind: "better-event"; saved: SavedEvent; event: FoundEvent; changes: EventChanges }
  | { key: string; kind: "new-event"; event: FoundEvent; newCountry: boolean };

export type Findings = { suggestions: Suggestion[]; matchedTrips: number; matchedEvents: number };

// ---------------------------------------------------------------- loading

/** Everything they've saved that a find could be: their trips (with places) and events. */
export async function loadSaved(userId: string): Promise<Saved> {
  const supabase = createClient();
  const [{ data: rows }, { data: events }] = await Promise.all([
    supabase.from("visited_countries").select("id, country_code, country_visits(id, year, visited_from, visited_to, date_precision)").eq("user_id", userId),
    supabase.from("events").select("*").eq("user_id", userId),
  ]);
  const countries = new Map<string, string>();
  const visits: SavedVisit[] = [];
  for (const c of rows ?? []) {
    countries.set(c.country_code as string, c.id as string);
    for (const v of (c.country_visits ?? []) as { id: string; year: number; visited_from: string | null; visited_to: string | null; date_precision: string | null }[]) {
      visits.push({
        id: v.id,
        countryId: c.id as string,
        code: c.country_code as string,
        year: v.year,
        from: v.visited_from,
        to: v.visited_to,
        precision: v.date_precision === "day" || v.date_precision === "month" ? v.date_precision : v.visited_from ? "day" : "year",
        cities: [],
      });
    }
  }
  const ids = [...countries.values()];
  if (ids.length) {
    const { data: cities } = await supabase.from("country_cities").select("country_visit_id, city_name").in("visited_country_id", ids);
    const byVisit = new Map(visits.map((v) => [v.id, v]));
    for (const c of cities ?? []) byVisit.get(c.country_visit_id as string)?.cities.push(c.city_name as string);
  }
  return {
    visits,
    countries,
    events: (events ?? []).map((e) => ({
      id: e.id as string,
      title: (e.title as string) ?? "",
      date: e.event_date as string,
      end: (e.end_date as string) || null,
      venue: (e.venue as string) || null,
      city: (e.city as string) || null,
      code: (e.country_code as string) || null,
      artist: (e.spotify_artist_name as string) || null,
    })),
  };
}

// --------------------------------------------------------------- matching

const today = () => new Date().toISOString().slice(0, 10);
const norm = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
/** Two date ranges sharing a day (give or take one: a late-night photo, a time zone). */
const overlaps = (aFrom: string, aTo: string, bFrom: string, bTo: string) => daysBetween(aTo, bFrom) <= 1 && daysBetween(bTo, aFrom) <= 1;
const yearOf = (d: string) => Number(d.slice(0, 4));

/** The same act or the same event, by name: "Coldplay" in "Coldplay – Helsinki", or the same artist. */
function sameName(saved: SavedEvent, found: FoundEvent): boolean {
  const a = norm(saved.title);
  const names = [found.artist, found.title].map(norm).filter((n) => n.length >= 3);
  if (saved.artist && found.artist && norm(saved.artist) === norm(found.artist)) return true;
  return names.some((n) => a === n || ` ${a} `.includes(` ${n} `) || (a.length >= 3 && ` ${n} `.includes(` ${a} `)));
}

/** Places a find has that the saved trip doesn't (by name). */
const newTowns = (towns: TripTown[], have: string[]) => {
  const known = new Set(have.map(norm));
  return towns.filter((t) => !known.has(norm(t.name)));
};

/**
 * What the photos found, set against what's saved:
 *
 * Trips, country by country. A saved trip with exact days claims every find
 * that overlaps it (only places it lacks are offered). One saved with a
 * month claims the finds in that month, one with a year the finds that year:
 * one find → its days and places are offered; several → "which one was it?";
 * as many saved as found that year → paired in order. Whatever's left is a
 * new trip. Home is never a trip.
 *
 * Events: the same day and the same venue or act is the same event (offer
 * what it's missing); the same act a few days off is the same event with
 * the wrong date. Anything else is new.
 */
export function matchMemories(input: {
  trips: FoundTrip[];
  towns: Record<string, TripTown[]>;
  homeCode: string | null;
  saved: Saved;
  events: FoundEvent[];
  skipped: Set<string>;
}): Findings {
  const { saved, towns, skipped } = input;
  const out: Suggestion[] = [];
  let matchedTrips = 0;
  let matchedEvents = 0;
  const townsOf = (t: FoundTrip) => towns[t.id] ?? [];

  const trips = input.trips.filter((t) => t.sure && t.code !== input.homeCode);
  const codes = new Set(trips.map((t) => t.code));
  for (const code of codes) {
    const found = trips.filter((t) => t.code === code).sort((a, b) => a.from.localeCompare(b.from));
    const claimed = new Set<string>();
    const visits = saved.visits.filter((v) => v.code === code);

    // Exact days first: they say for sure which finds are theirs.
    for (const v of visits.filter((x) => x.precision === "day" && x.from)) {
      const to = v.to ?? today();
      const mine = found.filter((t) => !claimed.has(t.id) && overlaps(v.from!, to, t.from, t.to));
      if (!mine.length) continue;
      mine.forEach((t) => claimed.add(t.id));
      const extra = newTowns(
        mine.flatMap(townsOf).filter((t, i, all) => all.findIndex((x) => norm(x.name) === norm(t.name)) === i),
        v.cities
      );
      if (extra.length) out.push({ key: `bt:${v.id}:places`, kind: "better-trip", visit: v, trip: mine[0], dates: false, towns: extra });
      else matchedTrips += mine.length;
    }

    // Then a month, then only a year: the finds that fall in them.
    const loose = visits
      .filter((x) => x.precision !== "day" || !x.from)
      .sort((a, b) => Number(a.precision !== "month") - Number(b.precision !== "month") || (a.from ?? "").localeCompare(b.from ?? ""));
    const groups = new Map<string, SavedVisit[]>();
    for (const v of loose) {
      const g = v.precision === "month" && v.from ? `m:${v.from.slice(0, 7)}` : `y:${v.year}`;
      groups.set(g, [...(groups.get(g) ?? []), v]);
    }
    for (const [g, vs] of groups) {
      const inIt = (t: FoundTrip) =>
        g.startsWith("m:") ? overlaps(vs[0].from!, vs[0].to ?? vs[0].from!, t.from, t.to) : yearOf(t.from) === vs[0].year || yearOf(t.to) === vs[0].year;
      const candidates = found.filter((t) => !claimed.has(t.id) && inIt(t));
      if (!candidates.length) continue;
      candidates.forEach((t) => claimed.add(t.id));
      if (vs.length === 1 && candidates.length > 1) {
        out.push({ key: `wt:${vs[0].id}`, kind: "which-trip", visit: vs[0], options: candidates.slice(0, 4).map((t) => ({ trip: t, towns: townsOf(t) })) });
        // Past four, the rest stay as they are (they're in its year: not new).
        continue;
      }
      // As many saved as found (or fewer found): each saved one gets the next find, in order.
      vs.slice(0, candidates.length).forEach((v, i) => {
        const t = candidates[i];
        out.push({ key: `bt:${v.id}:${t.from}`, kind: "better-trip", visit: v, trip: t, dates: true, towns: newTowns(townsOf(t), v.cities) });
      });
      // More found than saved (and more than one saved): the rest belong to that year's trips; left alone.
    }

    for (const t of found) {
      if (claimed.has(t.id)) continue;
      out.push({ key: `nt:${code}:${t.from}`, kind: "new-trip", trip: t, towns: townsOf(t), newCountry: !saved.countries.has(code) });
    }
  }

  // Events
  const used = new Set<string>();
  const newCountries = new Set(out.filter((s) => s.kind === "new-trip" && s.newCountry).map((s) => (s as { trip: FoundTrip }).trip.code));
  for (const e of input.events.filter((x) => x.sure)) {
    const free = saved.events.filter((s) => !used.has(s.id));
    // Its day, or any of its days (a festival, a tournament).
    const sameDay = free.filter((s) => s.date === e.date || (!!s.end && s.date <= e.date && e.date <= s.end));
    let match =
      sameDay.find((s) => (e.venue && s.venue && sameVenue(s.venue, e.venue)) || sameName(s, e)) ??
      // Saved that day with no venue, in that country (or none said): theirs, waiting for its venue.
      sameDay.find((s) => !s.venue && (!s.code || s.code === e.code));
    if (!match) match = free.find((s) => Math.abs(daysBetween(s.date, e.date)) <= 3 && sameName(s, e));
    if (match) {
      used.add(match.id);
      const changes: EventChanges = {};
      // A day of a festival they saved isn't a wrong date.
      if (match.date !== e.date && !(match.end && match.date <= e.date && e.date <= match.end)) changes.date = e.date;
      if (!match.venue && e.venue) changes.venue = e.venue;
      if (!match.city && e.city) changes.city = e.city;
      if (!match.artist && e.artist) changes.artist = e.artist;
      if (Object.keys(changes).length) out.push({ key: `be:${match.id}:${e.date}`, kind: "better-event", saved: match, event: e, changes });
      else matchedEvents += 1;
      continue;
    }
    out.push({
      key: `ne:${e.date}:${norm(e.artist ?? e.title)}`,
      kind: "new-event",
      event: e,
      newCountry: !saved.countries.has(e.code) && !newCountries.has(e.code) && e.code !== input.homeCode,
    });
    if (!saved.countries.has(e.code)) newCountries.add(e.code);
  }

  const order = { "better-trip": 0, "better-event": 0, "which-trip": 0, "new-trip": 1, "new-event": 2 } as const;
  const when = (s: Suggestion) =>
    s.kind === "which-trip" ? s.options[0].trip.from : s.kind === "better-trip" || s.kind === "new-trip" ? s.trip.from : s.event.date;
  return {
    suggestions: out.filter((s) => !skipped.has(s.key)).sort((a, b) => order[a.kind] - order[b.kind] || when(b).localeCompare(when(a))),
    matchedTrips,
    matchedEvents,
  };
}

// ---------------------------------------------------------------- skipping

const SKIP_KEY = "expandiax:from-photos-skipped";
const SEEN_KEY = "expandiax:from-photos-seen";

export function skippedSuggestions(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SKIP_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

/** Unticked and left: never suggested again on this phone. */
export function skipSuggestions(keys: string[]) {
  if (!keys.length) return;
  try {
    localStorage.setItem(SKIP_KEY, JSON.stringify([...new Set([...skippedSuggestions(), ...keys])].slice(-2000)));
  } catch {
    // nothing to do
  }
}

/** Been through it once: next time it starts looking straight away. */
export function markFromPhotosSeen() {
  try {
    localStorage.setItem(SEEN_KEY, String(Date.now()));
  } catch {
    // nothing to do
  }
}

export function fromPhotosSeen(): boolean {
  try {
    return !!localStorage.getItem(SEEN_KEY);
  } catch {
    return false;
  }
}

// ----------------------------------------------------------------- saving

export type Change =
  | { kind: "trip-better"; visit: SavedVisit; trip: FoundTrip; dates: boolean; towns: TripTown[] }
  | { kind: "trip-new"; trip: FoundTrip; towns: TripTown[] }
  | { kind: "event-better"; saved: SavedEvent; changes: EventChanges }
  | { kind: "event-new"; event: FoundEvent };

export type Applied = { newTrips: number; betterTrips: number; newEvents: number; betterEvents: number; newCountries: string[]; firstNewTrip: { code: string; from: string; to: string } | null };

const RECENT_DAYS = 30;
const recent = (day: string) => daysBetween(day, today()) <= RECENT_DAYS;

const placesOf = (towns: TripTown[]) =>
  [...towns]
    .sort((a, b) => (a.arrived ?? "").localeCompare(b.arrived ?? ""))
    .map((t) => ({ key: placeKey(t.name), name: t.name, lat: t.lat, lng: t.lng, arrived: t.arrived, departed: t.departed }));

/**
 * Writes what they said yes to. Past trips and events go quietly onto the
 * map and profile; only something from the last month goes to followers'
 * feeds (the newest one), never a burst of old news.
 */
export async function applyChanges(userId: string, saved: Saved, changes: Change[]): Promise<Applied> {
  const supabase = createClient();
  const done: Applied = { newTrips: 0, betterTrips: 0, newEvents: 0, betterEvents: 0, newCountries: [], firstNewTrip: null };

  // Countries first: every new trip and event needs its country on the map.
  const codes = [...new Set(changes.flatMap((c) => (c.kind === "trip-new" ? [c.trip.code] : c.kind === "event-new" ? [c.event.code] : [])))].filter(
    (c) => !!countryByCode(c)
  );
  const missing = codes.filter((c) => !saved.countries.has(c));
  if (missing.length) {
    await supabase
      .from("visited_countries")
      .upsert(missing.map((code) => ({ user_id: userId, country_code: code, country_name: countryByCode(code)!.name })), { onConflict: "user_id,country_code", ignoreDuplicates: true });
    const { data } = await supabase.from("visited_countries").select("id, country_code").eq("user_id", userId).in("country_code", missing);
    for (const r of data ?? []) saved.countries.set(r.country_code as string, r.id as string);
    done.newCountries = missing.filter((c) => saved.countries.has(c));
  }

  const newestTrip = changes
    .filter((c): c is Extract<Change, { kind: "trip-new" }> => c.kind === "trip-new")
    .sort((a, b) => b.trip.from.localeCompare(a.trip.from))[0];
  const newestEvent = changes
    .filter((c): c is Extract<Change, { kind: "event-new" }> => c.kind === "event-new")
    .sort((a, b) => b.event.date.localeCompare(a.event.date))[0];

  for (const c of changes) {
    try {
      if (c.kind === "trip-better") {
        if (c.dates) {
          const { error } = await supabase
            .from("country_visits")
            .update({ visited_from: c.trip.from, visited_to: c.trip.to, date_precision: "day", year: yearOf(c.trip.from) })
            .eq("id", c.visit.id);
          if (error) continue;
        }
        if (c.towns.length) {
          await savePlaces(supabase, { visitedCountryId: c.visit.countryId, visitId: c.visit.id, places: placesOf(c.towns), firstPosition: c.visit.cities.length });
        }
        done.betterTrips += 1;
      } else if (c.kind === "trip-new") {
        const countryId = saved.countries.get(c.trip.code);
        if (!countryId) continue;
        const { data: visit, error } = await supabase
          .from("country_visits")
          .insert({
            visited_country_id: countryId,
            year: yearOf(c.trip.from),
            visited_from: c.trip.from,
            visited_to: c.trip.to,
            date_precision: "day",
            kind: daysBetween(c.trip.from, c.trip.to) >= 60 ? "lived" : c.trip.kind,
            show_in_feed: c === newestTrip && recent(c.trip.to),
          })
          .select("id")
          .single();
        if (error || !visit) continue;
        if (c.towns.length) await savePlaces(supabase, { visitedCountryId: countryId, visitId: visit.id as string, places: placesOf(c.towns) }).catch(() => {});
        done.newTrips += 1;
        if (!done.firstNewTrip || c.trip.from > done.firstNewTrip.from) done.firstNewTrip = { code: c.trip.code, from: c.trip.from, to: c.trip.to };
      } else if (c.kind === "event-better") {
        const patch: Record<string, string> = {};
        if (c.changes.date) patch.event_date = c.changes.date;
        if (c.changes.venue) patch.venue = c.changes.venue.slice(0, 120);
        if (c.changes.city) patch.city = c.changes.city.slice(0, 120);
        if (c.changes.artist) patch.spotify_artist_name = c.changes.artist;
        const { error } = await supabase.from("events").update(patch).eq("id", c.saved.id).eq("user_id", userId);
        if (!error) done.betterEvents += 1;
      } else {
        const country = countryByCode(c.event.code);
        if (!country) continue;
        const { error } = await supabase.from("events").insert({
          user_id: userId,
          title: c.event.title.slice(0, 120),
          event_date: c.event.date,
          event_type: c.event.type,
          venue: (c.event.venue ?? "").slice(0, 120),
          city: (c.event.city ?? "").slice(0, 120),
          country_code: country.code,
          country_name: country.name,
          share_to_feed: c === newestEvent && recent(c.event.date),
          ...(c.event.artist ? { spotify_artist_name: c.event.artist } : {}),
        });
        if (!error) done.newEvents += 1;
      }
    } catch {
      // One that didn't go through doesn't stop the rest.
    }
  }
  return done;
}
