// "Find my world": turns where and when someone's photos were taken into
// their home, the countries they've been to and their trips. Pure, so it
// runs the same on the phone (onboarding) and in tests.
//
// Input comes from the iPhone app's scanner (ios/App/App/PhotoScanPlugin.swift):
// one entry per day and place, already summed up on the phone.

import { countryByCode } from "./countries";

/** One day at one place (about a 25 km square), from the scanner. */
export type ScanPlace = {
  /** Day, yyyy-mm-dd (near local time). */
  d: string;
  la: number;
  ln: number;
  /** Photos and videos that day there. */
  n: number;
  /** Favourites among them. */
  f: number;
  /** The best one to show (a photo library id). */
  a: string;
};

export type FoundTrip = {
  /** Stable for a given scan: country and first day. */
  id: string;
  code: string;
  from: string;
  to: string;
  /** Days with photos. */
  photoDays: number;
  photos: number;
  favourites: number;
  /** "lived": two months or more. */
  kind: "trip" | "lived";
  /** Photo library ids to show, best first (favourites, then busiest days). */
  covers: string[];
  /** Where and when its photos were taken (per day and ~5 km square), to name its towns. */
  spots: { d: string; la: number; ln: number; n: number }[];
  /** Trips straight after one another, with no home in between, share one: an Interrail summer. */
  journey: string;
  /** False for a short stop with few photos: offered, not assumed. */
  sure: boolean;
};

export type FoundWorld = {
  homeCode: string | null;
  /** Countries with trips, in the order they were first visited. */
  countries: { code: string; firstDay: string }[];
  /** Newest first. */
  trips: FoundTrip[];
  /** The countries that could be home, most likely first (for "Not your home?"). */
  homeCandidates: string[];
  firstYear: number | null;
};

const DAY = 86_400_000;
const dayNumber = (d: string) => Math.round(Date.parse(`${d}T00:00:00Z`) / DAY);
export const daysBetween = (from: string, to: string) => dayNumber(to) - dayNumber(from);

/** Photos on most different days, weighted toward the last three years. */
function guessHome(byCountryDays: Map<string, Set<string>>, latestDay: string): string[] {
  const recentFrom = dayNumber(latestDay) - 3 * 365;
  const score = new Map<string, number>();
  for (const [code, days] of byCountryDays) {
    let s = 0;
    for (const d of days) s += dayNumber(d) >= recentFrom ? 3 : 1;
    score.set(code, s);
  }
  return [...score.entries()].sort((a, b) => b[1] - a[1]).map(([code]) => code);
}

/**
 * @param locate the country at a point (ISO alpha-2), or null at sea / unknown
 * @param homeCode use this as home instead of guessing (a member's profile, or a choice)
 */
export function findWorld(places: ScanPlace[], locate: (lat: number, lng: number) => string | null, homeCode?: string | null): FoundWorld {
  type Located = ScanPlace & { code: string };
  const located: Located[] = [];
  for (const p of places) {
    const code = locate(p.la, p.ln);
    if (code && countryByCode(code)) located.push({ ...p, code });
  }
  if (!located.length) return { homeCode: homeCode ?? null, countries: [], trips: [], homeCandidates: homeCode ? [homeCode] : [], firstYear: null };

  located.sort((a, b) => a.d.localeCompare(b.d));
  const byCountryDays = new Map<string, Set<string>>();
  for (const p of located) {
    if (!byCountryDays.has(p.code)) byCountryDays.set(p.code, new Set());
    byCountryDays.get(p.code)!.add(p.d);
  }
  const candidates = guessHome(byCountryDays, located[located.length - 1].d);
  const home = homeCode ?? candidates[0] ?? null;
  const homeDays = [...(home ? byCountryDays.get(home) ?? [] : [])].map(dayNumber).sort((a, b) => a - b);
  // Whether there are photos at home strictly between two days.
  const homeBetween = (a: string, b: string) => {
    const lo = dayNumber(a);
    const hi = dayNumber(b);
    let l = 0;
    let h = homeDays.length;
    while (l < h) {
      const m = (l + h) >> 1;
      if (homeDays[m] <= lo) l = m + 1;
      else h = m;
    }
    return l < homeDays.length && homeDays[l] < hi;
  };

  // Each country's days abroad, grouped into trips. A gap of a few days
  // without photos is still the same trip; a long stay keeps going over
  // longer gaps; any photos at home in between end it.
  type Draft = { code: string; places: Located[] };
  const drafts: Draft[] = [];
  const open = new Map<string, Draft>();
  for (const p of located) {
    if (p.code === home) continue;
    const cur = open.get(p.code);
    if (cur) {
      const first = cur.places[0].d;
      const last = cur.places[cur.places.length - 1].d;
      const gap = daysBetween(last, p.d);
      const longStay = daysBetween(first, last) >= 21;
      if ((gap <= 4 || (longStay && gap <= 21)) && !homeBetween(last, p.d)) {
        cur.places.push(p);
        continue;
      }
    }
    const d: Draft = { code: p.code, places: [p] };
    drafts.push(d);
    open.set(p.code, d);
  }

  // Living somewhere with only a photo now and then: three or more visits
  // to the same country, a few weeks apart at most, nothing at home in
  // between, over a month and a half or more, are one stay.
  const merged: Draft[] = [];
  const byCode = new Map<string, Draft[]>();
  for (const d of drafts) {
    if (!byCode.has(d.code)) byCode.set(d.code, []);
    byCode.get(d.code)!.push(d);
  }
  for (const list of byCode.values()) {
    let chain: Draft[] = [];
    const flush = () => {
      const span = chain.length ? daysBetween(chain[0].places[0].d, chain[chain.length - 1].places.at(-1)!.d) : 0;
      if (chain.length >= 3 && span >= 45) merged.push({ code: chain[0].code, places: chain.flatMap((c) => c.places) });
      else merged.push(...chain);
      chain = [];
    };
    for (const d of list) {
      const prev = chain.at(-1);
      if (prev) {
        const last = prev.places.at(-1)!.d;
        const first = d.places[0].d;
        if (daysBetween(last, first) > 21 || homeBetween(last, first)) flush();
      }
      chain.push(d);
    }
    flush();
  }

  let trips: FoundTrip[] = merged.map((d) => {
    const from = d.places[0].d;
    const to = d.places[d.places.length - 1].d;
    const best = [...d.places].sort((a, b) => b.f - a.f || b.n - a.n);
    const covers = [...new Set(best.map((p) => p.a))].slice(0, 6);
    return {
      id: `${d.code}-${from}`,
      code: d.code,
      from,
      to,
      photoDays: new Set(d.places.map((p) => p.d)).size,
      photos: d.places.reduce((s, p) => s + p.n, 0),
      favourites: d.places.reduce((s, p) => s + p.f, 0),
      kind: daysBetween(from, to) >= 60 ? "lived" : "trip",
      covers,
      spots: d.places.map((p) => ({ d: p.d, la: p.la, ln: p.ln, n: p.n })),
      journey: `${d.code}-${from}`,
      sure: true,
    };
  });

  // A day with a couple of photos in a country passed through on the way
  // to a bigger trip (a layover, a border crossing) isn't a trip of its own.
  trips = trips.filter((t) => {
    if (t.photos >= 3 || t.favourites > 0) return true;
    if (t.photoDays > 1) return true;
    return !trips.some((o) => o !== t && o.photos > t.photos && o.from <= t.from && o.to >= t.from);
  });
  // One stray photo with a place is too thin to call a trip.
  trips = trips.filter((t) => t.photos >= 2 || t.favourites > 0);

  // A short stop with a handful of photos might be a trip, or a day across
  // a border: it's offered, not assumed.
  for (const t of trips) t.sure = !(t.photos < 6 && t.photoDays === 1 && t.favourites === 0);

  // Photos placed in the wrong country: the phone's position over the sea
  // near a border (Lebanon, seen from Cyprus), or from a plane (Russia and
  // Mongolia on the way to China). Their days are all days with many more
  // photos somewhere else, so they're offered, not assumed.
  const perDay = new Map<string, Map<string, number>>();
  for (const p of located) {
    const day = perDay.get(p.d) ?? new Map<string, number>();
    day.set(p.code, (day.get(p.code) ?? 0) + p.n);
    perDay.set(p.d, day);
  }
  for (const t of trips) {
    if (!t.sure || t.photoDays > 3 || t.favourites > 2) continue;
    const days = [...new Set(t.spots.map((s) => s.d))];
    const elsewhere = days.every((d) => {
      const counts = perDay.get(d);
      const mine = counts?.get(t.code) ?? 0;
      const other = Math.max(0, ...[...(counts ?? new Map<string, number>()).entries()].filter(([c]) => c !== t.code).map(([, n]) => n));
      return other >= Math.max(3, mine * 3);
    });
    if (elsewhere) t.sure = false;
  }

  // Journeys: one trip after another (a day or two between at most, nothing
  // at home in between) is one journey through several countries.
  const inOrder = [...trips].sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  let journeyId = "";
  let journeyEnd = "";
  for (const t of inOrder) {
    if (journeyId && daysBetween(journeyEnd, t.from) <= 2 && !homeBetween(journeyEnd, t.from)) {
      t.journey = journeyId;
      if (t.to > journeyEnd) journeyEnd = t.to;
    } else {
      journeyId = t.id;
      journeyEnd = t.to;
      t.journey = t.id;
    }
  }

  const firstDay = new Map<string, string>();
  for (const t of [...trips].sort((a, b) => a.from.localeCompare(b.from))) if (!firstDay.has(t.code)) firstDay.set(t.code, t.from);

  const years = located.map((p) => Number(p.d.slice(0, 4)));
  return {
    homeCode: home,
    countries: [...firstDay.entries()].map(([code, d]) => ({ code, firstDay: d })),
    trips: trips.sort((a, b) => b.from.localeCompare(a.from)),
    homeCandidates: candidates.slice(0, 6),
    firstYear: Math.min(...years),
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "3–8 May 2024", "28 Apr – 2 May 2024", "Dec 2023 – Jan 2024" (long), "12 May 2024". */
export function tripDates(from: string, to: string): string {
  const f = new Date(`${from}T12:00:00Z`);
  const t = new Date(`${to}T12:00:00Z`);
  const month = (d: Date) => MONTHS[d.getUTCMonth()];
  const sameYear = f.getUTCFullYear() === t.getUTCFullYear();
  if (daysBetween(from, to) >= 45) {
    return sameYear ? `${month(f)} – ${month(t)} ${t.getUTCFullYear()}` : `${month(f)} ${f.getUTCFullYear()} – ${month(t)} ${t.getUTCFullYear()}`;
  }
  if (from === to) return `${f.getUTCDate()} ${month(f)} ${f.getUTCFullYear()}`;
  if (sameYear && f.getUTCMonth() === t.getUTCMonth()) return `${f.getUTCDate()}–${t.getUTCDate()} ${month(t)} ${t.getUTCFullYear()}`;
  if (sameYear) return `${f.getUTCDate()} ${month(f)} – ${t.getUTCDate()} ${month(t)} ${t.getUTCFullYear()}`;
  return `${f.getUTCDate()} ${month(f)} ${f.getUTCFullYear()} – ${t.getUTCDate()} ${month(t)} ${t.getUTCFullYear()}`;
}

/** "6 days", "5 months". */
export function tripLength(from: string, to: string): string {
  const days = daysBetween(from, to) + 1;
  if (days >= 60) {
    const months = Math.round(days / 30.4);
    return `${months} months`;
  }
  return days === 1 ? "1 day" : `${days} days`;
}
