// ExpandiaX Year Wrapped: someone's year, from what they've saved in
// ExpandiaX, and nothing else. Every number is counted, never guessed:
// "new" countries only when nothing earlier is known there, days away only
// from trips with exact days, last year only when there's last year. When
// some of the year has no exact dates, `partial` says so, so the story never
// claims more than it knows.

import { continentCounts, countryByCode } from "@/lib/countries";

export type WrappedVisit = {
  id: string;
  code: string;
  year: number;
  from: string | null;
  to: string | null;
  precision: string;
  kind: string;
  places: { name: string; lat: number | null; lng: number | null }[];
};

export type WrappedEventRow = {
  id: string;
  title: string;
  type: string;
  date: string;
  endDate: string | null;
  venue: string | null;
  city: string | null;
  code: string | null;
  photo: string | null;
};

/** A photo of theirs from the year; `group` is the trip or event it's from. */
export type WrappedPhoto = { id: string; url: string; takenAt: string | null; label: string; code: string | null; group?: string };

export type WrappedStop = { code: string; date: string; label: string; kind: "trip" | "event" };

/** A trip or event that stood out: the ones with the most photos. */
export type WrappedHighlight = { id: string; kind: "trip" | "event"; title: string; code: string | null; from: string | null; to: string | null; photo: string; photos: number };

export type WrappedYear = {
  year: number;
  firstName: string;
  homeCode: string | null;
  /** Countries this year, in the order they first came up. */
  countries: string[];
  /** Countries for the first time (nothing earlier known there). */
  newCountries: string[];
  continents: number;
  trips: number;
  places: string[];
  /** Days on trips abroad with exact dates (null: none with exact dates). */
  daysAway: number | null;
  events: WrappedEventRow[];
  photos: WrappedPhoto[];
  /** Up to three, most photos first (only ones with a photo). */
  highlights: WrappedHighlight[];
  /** Dated stops in order: the year unfolding on the globe. */
  journey: WrappedStop[];
  busiestMonth: { month: number; count: number } | null;
  previous: { year: number; countries: number; trips: number; events: number } | null;
  /** Some of the year has no exact dates. */
  partial: boolean;
};

const yearOf = (d: string | null) => (d ? Number(d.slice(0, 4)) : NaN);
const PHOTO_CAP = 80;

/** 0..n-1 spread out: the middle, then the quarters, then the eighths… (so the first few cover the whole trip). */
export function spreadOrder(n: number): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  for (let k = 0; out.length < n && k < n * 8; k++) {
    // van der Corput: 0, 1/2, 1/4, 3/4, 1/8…, turned to start in the middle.
    let f = 0;
    for (let b = 0.5, x = k; x; x >>= 1, b /= 2) if (x & 1) f += b;
    const i = (Math.floor(f * n) + Math.floor(n / 2)) % n;
    if (!seen.has(i)) {
      seen.add(i);
      out.push(i);
    }
  }
  for (let i = 0; i < n; i++) if (!seen.has(i)) out.push(i);
  return out;
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/**
 * The collage before they choose: as varied as their year allows. Their top
 * highlight's photo big, then one from each other trip or event (different
 * countries first), in an order that's shuffled but the same every time.
 */
export function collageDefault(w: Pick<WrappedYear, "year" | "photos" | "highlights">, slots = 5): string[] {
  if (!w.photos.length) return [];
  const groups = new Map<string, WrappedPhoto[]>();
  for (const p of w.photos) groups.set(p.group ?? p.id, [...(groups.get(p.group ?? p.id) ?? []), p]);
  const top = w.highlights.map((h) => w.photos.find((p) => p.url === h.photo)).find(Boolean);
  const first = top ?? w.photos[hash(`${w.year}`) % w.photos.length];
  const picked = [first];
  const pick = (list: WrappedPhoto[], salt: string) => list[hash(`${w.year}:${salt}`) % list.length];
  const order = [...groups.keys()].sort((a, b) => hash(`${w.year}:${a}`) - hash(`${w.year}:${b}`));
  // A different trip or event each, a different country where possible; then more of the same if that's all there is.
  for (const pass of ["new country", "new moment", "anything"] as const) {
    for (const g of order) {
      if (picked.length >= slots) break;
      const list = groups.get(g)!.filter((p) => !picked.includes(p));
      if (!list.length) continue;
      if (pass !== "anything" && picked.some((p) => (p.group ?? p.id) === g)) continue;
      if (pass === "new country" && list[0].code && picked.some((p) => p.code === list[0].code)) continue;
      picked.push(pick(list, `${g}:${picked.length}`));
    }
  }
  return picked.slice(0, slots).map((p) => p.id);
}
const DAY = 86_400_000;
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);

/** Whether a trip falls in the year: its days overlap it, or (no days) its month or year is it. */
export function tripInYear(v: Pick<WrappedVisit, "year" | "from" | "to">, year: number): boolean {
  if (v.from) {
    const to = v.to ?? v.from;
    return yearOf(v.from) <= year && yearOf(to) >= year;
  }
  return v.year === year;
}

const eventInYear = (e: Pick<WrappedEventRow, "date" | "endDate">, year: number) => yearOf(e.date) === year || (!!e.endDate && yearOf(e.endDate) === year);

/** The year, built from everything saved (all years, for "new" and last year). */
export function buildWrapped(input: {
  year: number;
  firstName: string;
  homeCode: string | null;
  visits: WrappedVisit[];
  /** Countries on the map with no trips at all (when isn't known). */
  undatedCodes: string[];
  events: WrappedEventRow[];
  photos: (WrappedPhoto & { visitId?: string | null; eventId?: string | null })[];
}): WrappedYear {
  const { year, visits, events } = input;
  const yearVisits = visits.filter((v) => tripInYear(v, year));
  const yearEvents = events.filter((e) => eventInYear(e, year)).sort((a, b) => a.date.localeCompare(b.date));
  const trips = yearVisits.filter((v) => v.kind !== "lived");

  // Countries, in the order they first came up this year.
  const firstSeen = new Map<string, string>();
  const note = (code: string | null, when: string) => {
    if (!code || !countryByCode(code)) return;
    const had = firstSeen.get(code);
    if (!had || when < had) firstSeen.set(code, when);
  };
  for (const v of yearVisits) note(v.code, v.from && yearOf(v.from) === year ? v.from : `${year}-12-31`);
  for (const e of yearEvents) note(e.code, e.date);
  const countries = [...firstSeen.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([c]) => c);

  // New: nothing known there before this year, and no "been there, not sure when".
  const undated = new Set(input.undatedCodes);
  const newCountries = countries.filter((code) => {
    if (undated.has(code)) return false;
    const earlierTrip = visits.some((v) => v.code === code && (v.from ? yearOf(v.from) < year : v.year < year));
    const earlierEvent = events.some((e) => e.code === code && yearOf(e.date) < year);
    return !earlierTrip && !earlierEvent;
  });

  const places = [...new Set(yearVisits.flatMap((v) => v.places.map((p) => p.name.trim())).filter(Boolean))];

  // Days away: trips abroad with exact days, the part inside this year.
  const dated = trips.filter((v) => v.precision === "day" && v.from && v.code !== input.homeCode);
  const daysAway = dated.length
    ? dated.reduce((sum, v) => {
        const from = v.from! < `${year}-01-01` ? `${year}-01-01` : v.from!;
        const to = (v.to ?? v.from!) > `${year}-12-31` ? `${year}-12-31` : v.to ?? v.from!;
        return sum + Math.max(1, days(from, to) + 1);
      }, 0)
    : null;

  // The journey: every dated stop in order, the same country twice in a row once.
  const stops: WrappedStop[] = [
    ...trips.filter((v) => v.from && v.precision !== "year").map((v) => ({ code: v.code, date: v.from!, label: countryByCode(v.code)?.name ?? v.code, kind: "trip" as const })),
    ...yearEvents.filter((e) => e.code).map((e) => ({ code: e.code!, date: e.date, label: e.title, kind: "event" as const })),
  ]
    .filter((s) => yearOf(s.date) === year && countryByCode(s.code))
    .sort((a, b) => a.date.localeCompare(b.date));
  const journey = stops.filter((s, i) => i === 0 || stops[i - 1].code !== s.code);

  // The busiest month: only a clear one (two or more, no tie).
  const months = new Map<number, number>();
  for (const s of stops) months.set(Number(s.date.slice(5, 7)), (months.get(Number(s.date.slice(5, 7))) ?? 0) + 1);
  const ranked = [...months.entries()].sort((a, b) => b[1] - a[1]);
  const busiestMonth = ranked[0] && ranked[0][1] >= 2 && ranked[0][1] !== ranked[1]?.[1] ? { month: ranked[0][0], count: ranked[0][1] } : null;

  // Last year, only to compare with when there's something there.
  const prevVisits = visits.filter((v) => tripInYear(v, year - 1));
  const prevEvents = events.filter((e) => eventInYear(e, year - 1));
  const prevCountries = new Set([...prevVisits.map((v) => v.code), ...prevEvents.map((e) => e.code).filter((c): c is string => !!c)]);
  const previous = prevCountries.size || prevEvents.length ? { year: year - 1, countries: prevCountries.size, trips: prevVisits.filter((v) => v.kind !== "lived").length, events: prevEvents.length } : null;

  // Highlights: the trips and events with the most photos (a trip by its first place, a concert by its city).
  const ofVisit = (id: string) => input.photos.filter((p) => p.visitId === id);
  const ofEvent = (id: string) => input.photos.filter((p) => p.eventId === id);
  const highlights: WrappedHighlight[] = [
    ...trips.map((v) => {
      const ps = ofVisit(v.id);
      const where = v.places[0]?.name?.trim();
      return { id: v.id, kind: "trip" as const, title: where || countryByCode(v.code)?.name || v.code, code: v.code, from: v.from, to: v.to, photo: ps[0]?.url ?? "", photos: ps.length };
    }),
    ...yearEvents.map((e) => {
      const ps = ofEvent(e.id);
      return { id: e.id, kind: "event" as const, title: e.type === "concert" && e.city ? `${e.title} in ${e.city}` : e.title, code: e.code, from: e.date, to: e.endDate, photo: ps[0]?.url ?? e.photo ?? "", photos: ps.length };
    }),
  ]
    .filter((h) => !!h.photo)
    .sort((a, b) => b.photos - a.photos || (b.from ?? "").localeCompare(a.from ?? ""))
    .slice(0, 3);

  // Photos: taking turns, a trip or event at a time (each one's spread across
  // its days), so one big trip can't fill them all; then in the order taken.
  const visitIds = new Set(yearVisits.map((v) => v.id));
  const eventIds = new Set(yearEvents.map((e) => e.id));
  const byMoment = new Map<string, WrappedPhoto[]>();
  for (const p of input.photos
    .filter((p) => (p.visitId && visitIds.has(p.visitId)) || (p.eventId && eventIds.has(p.eventId)))
    .sort((a, b) => (a.takenAt ?? "9999").localeCompare(b.takenAt ?? "9999"))) {
    const group = (p.visitId || p.eventId)!;
    byMoment.set(group, [...(byMoment.get(group) ?? []), { id: p.id, url: p.url, takenAt: p.takenAt, label: p.label, code: p.code, group }]);
  }
  const turns = [...byMoment.values()].map((list) => spreadOrder(list.length).map((i) => list[i]));
  const photos: WrappedPhoto[] = [];
  for (let round = 0; photos.length < PHOTO_CAP && turns.some((t) => t.length > round); round++) {
    for (const t of turns) if (t[round] && photos.length < PHOTO_CAP) photos.push(t[round]);
  }
  photos.sort((a, b) => (a.takenAt ?? "9999").localeCompare(b.takenAt ?? "9999"));

  return {
    year,
    firstName: input.firstName,
    homeCode: input.homeCode,
    countries,
    newCountries,
    continents: continentCounts(countries).filter((c) => c.visited > 0).length,
    trips: trips.length,
    places,
    daysAway,
    events: yearEvents,
    photos,
    highlights,
    journey,
    busiestMonth,
    previous,
    partial: yearVisits.some((v) => v.precision !== "day" || !v.from),
  };
}

/** Whether there's anything at all to tell. */
export const hasStory = (w: WrappedYear) => w.countries.length > 0 || w.events.length > 0;

// Open to everyone only once it's ready (and only from December for the year
// that's ending); until then, admins only (see the page).
export const WRAPPED_OPEN = false;
export function wrappedOpenFor(year: number, now = new Date()): boolean {
  if (!WRAPPED_OPEN) return false;
  return year < now.getFullYear() || (year === now.getFullYear() && now.getMonth() === 11);
}
