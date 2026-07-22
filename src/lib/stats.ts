import { continentCounts } from "./countries";
import { EVENT_TYPES } from "./events";
import type { EventType } from "./types";

export type CountryVisitLite = { year: number; visited_from?: string | null; visited_to?: string | null };

export type CountryStatInput = {
  country_code: string;
  is_favourite: boolean;
  photo_count: number;
  visits: CountryVisitLite[];
};

export type EventStatInput = {
  id: string;
  title: string;
  country_code: string;
  event_type: EventType;
  event_date: string;
  rating: number | null;
  is_favourite: boolean;
  photo_count: number;
  video_count: number;
};

export type AllTimeStats = {
  totalCountries: number;
  continentsVisited: number;
  totalEvents: number;
  eventsByType: Record<EventType, number>;
  totalPhotos: number;
  totalVideos: number;
  favouriteCount: number;
  topRating: number | null;
  yearsActive: number[];
  oldestYear: number | null;
  newestYear: number | null;
};

function emptyEventsByType(): Record<EventType, number> {
  return Object.fromEntries(EVENT_TYPES.map((t) => [t.value, 0])) as Record<EventType, number>;
}

export function buildAllTimeStats(countries: CountryStatInput[], events: EventStatInput[]): AllTimeStats {
  const continentsVisited = continentCounts(countries.map((c) => c.country_code)).filter((c) => c.visited > 0).length;
  const eventsByType = emptyEventsByType();
  let totalPhotos = 0;
  let totalVideos = 0;
  let favouriteCount = 0;
  let topRating: number | null = null;
  const years = new Set<number>();

  for (const c of countries) {
    totalPhotos += c.photo_count;
    if (c.is_favourite) favouriteCount++;
    for (const v of c.visits) years.add(v.year);
  }
  for (const e of events) {
    eventsByType[e.event_type]++;
    totalPhotos += e.photo_count;
    totalVideos += e.video_count;
    if (e.is_favourite) favouriteCount++;
    if (e.rating != null && (topRating === null || e.rating > topRating)) topRating = e.rating;
    const y = Number(e.event_date.slice(0, 4));
    if (!Number.isNaN(y)) years.add(y);
  }

  const yearsActive = [...years].sort((a, b) => a - b);

  return {
    totalCountries: countries.length,
    continentsVisited,
    totalEvents: events.length,
    eventsByType,
    totalPhotos,
    totalVideos,
    favouriteCount,
    topRating,
    yearsActive,
    oldestYear: yearsActive[0] ?? null,
    newestYear: yearsActive.at(-1) ?? null,
  };
}

export type YearStats = {
  year: number;
  countryCodes: string[];
  newCountryCodes: string[];
  continentsVisited: number;
  events: EventStatInput[];
  eventsByType: Record<EventType, number>;
  photos: number;
  videos: number;
  topRated: EventStatInput | null;
  longestTripDays: number | null;
};

export function buildYearStats(year: number, countries: CountryStatInput[], events: EventStatInput[]): YearStats {
  const inYear = countries.filter((c) => c.visits.some((v) => v.year === year));
  const countryCodes = inYear.map((c) => c.country_code);
  const newCountryCodes = inYear
    .filter((c) => Math.min(...c.visits.map((v) => v.year)) === year)
    .map((c) => c.country_code);

  const yearEvents = events.filter((e) => e.event_date.startsWith(String(year)));
  const eventsByType = emptyEventsByType();
  let photos = 0;
  let videos = 0;
  for (const e of yearEvents) {
    eventsByType[e.event_type]++;
    photos += e.photo_count;
    videos += e.video_count;
  }
  const topRated = [...yearEvents].filter((e) => e.rating != null).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0] ?? null;

  let longestTripDays: number | null = null;
  for (const c of countries) {
    for (const v of c.visits) {
      if (v.year !== year || !v.visited_from || !v.visited_to) continue;
      const days = Math.round((new Date(v.visited_to).getTime() - new Date(v.visited_from).getTime()) / 86400000) + 1;
      if (longestTripDays === null || days > longestTripDays) longestTripDays = days;
    }
  }

  return {
    year,
    countryCodes,
    newCountryCodes,
    continentsVisited: continentCounts(countryCodes).filter((c) => c.visited > 0).length,
    events: yearEvents,
    eventsByType,
    photos,
    videos,
    topRated,
    longestTripDays,
  };
}

export function mostRepeatedTitle(events: EventStatInput[]): { title: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const e of events) counts.set(e.title, (counts.get(e.title) ?? 0) + 1);
  let best: { title: string; count: number } | null = null;
  for (const [title, count] of counts) {
    if (count > 1 && (!best || count > best.count)) best = { title, count };
  }
  return best;
}
