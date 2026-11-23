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

export type WrappedPhoto = { id: string; url: string; takenAt: string | null; label: string; code: string | null };

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

  const visitIds = new Set(yearVisits.map((v) => v.id));
  const eventIds = new Set(yearEvents.map((e) => e.id));
  const photos = input.photos
    .filter((p) => (p.visitId && visitIds.has(p.visitId)) || (p.eventId && eventIds.has(p.eventId)))
    .sort((a, b) => (a.takenAt ?? "9999").localeCompare(b.takenAt ?? "9999"))
    .slice(0, 60)
    .map(({ id, url, takenAt, label, code }) => ({ id, url, takenAt, label, code }));

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
