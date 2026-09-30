import { unstable_cache } from "next/cache";
import { countryByCode } from "@/lib/countries";
import type { NearbyCategory, NearbyEvent } from "@/lib/concerts";

// Upcoming events from more than Ticketmaster: Fienta (no key — strongest in
// Estonia, Latvia, Finland and the rest of Europe), Skiddle (UK, needs
// SKIDDLE_API_KEY) and SeatGeek (US and Canada, needs SEATGEEK_CLIENT_ID).
// Each turns its listings into the same NearbyEvent the app already shows.
// Only a city or a rough point is ever sent to them — never who's asking.

export type EventWindow = { from: string; until: string }; // yyyy-mm-dd
export type EventArea = { lat?: number; lng?: number; countryCode?: string | null; city?: string | null };

const TWELVE_HOURS = 60 * 60 * 12;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status}`);
  return (await res.json()) as T;
}

// The finished list of events (a few kB — not the source's raw answer, which
// for Fienta is ~1 MB) is kept for 12 hours and shared by everyone asking
// about the same place: listings change slowly, and Fienta limits how often
// it can be asked. A failure — "too many requests", a timeout — is never
// kept, so it can't hide a country's events for hours; the next visitor tries
// again. Keys never include API keys.
async function cachedEvents(key: string[], work: () => Promise<NearbyEvent[]>): Promise<NearbyEvent[]> {
  try {
    return await unstable_cache(work, ["event-list", ...key], { revalidate: TWELVE_HOURS })();
  } catch {
    return [];
  }
}

/** "5 EUR", "£15.00", "15" → an amount and currency, or null for free/unknown. */
export function parsePrice(text: string | null | undefined, fallbackCurrency: string | null = null): { amount: number; currency: string } | null {
  if (!text) return null;
  const amount = Number(text.replace(/[^\d.,]/g, "").replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const symbol = /£/.test(text) ? "GBP" : /€/.test(text) ? "EUR" : /\$/.test(text) ? "USD" : null;
  const code = text.match(/\b[A-Z]{3}\b/)?.[0] ?? symbol ?? fallbackCurrency;
  return code ? { amount, currency: code } : null;
}

// ---------------------------------------------------------------- Fienta

export type FientaEvent = {
  id: number;
  title: string;
  starts_at: string; // "2026-10-08 17:00:00", local time
  event_status?: string;
  attendance_mode?: string;
  venue?: string;
  url?: string;
  buy_tickets_url?: string;
  image_url?: string;
  image_small_url?: string;
  categories?: string[] | null;
  price_from_string?: string;
};

// Going-out categories, each under its own chip; kids' workshops, wellness
// and guided tours stay out. Checked in this order, so an event tagged both
// "festival" and "music" counts as a festival.
const FIENTA_CATEGORY: [string, NearbyCategory][] = [
  ["festival", "festival"],
  ["music", "music"],
  ["sports", "sport"],
  ["conference", "conference"],
  ["business", "conference"],
  ["theatre", "arts"],
  ["dance", "arts"],
  ["film", "arts"],
  ["exhibition", "arts"],
  ["art", "arts"],
  ["food", "other"],
];

export function nearbyFromFienta(e: FientaEvent, place: { countryCode: string | null; city: string | null }): NearbyEvent | null {
  const date = e.starts_at?.slice(0, 10);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !e.title?.trim()) return null;
  if (e.event_status === "cancelled" || (e.attendance_mode && e.attendance_mode !== "offline")) return null;
  const tags = e.categories ?? [];
  const match = FIENTA_CATEGORY.find(([tag]) => tags.includes(tag));
  if (!match) return null;
  const time = e.starts_at.slice(11, 16);
  return {
    id: `fienta-${e.id}`,
    name: e.title.trim(),
    date,
    time: /^\d{2}:\d{2}$/.test(time) && time !== "00:00" ? time : null,
    // "Rooside Maja, Peetri 5" — the place's name, not the street address.
    venue: (e.venue ?? "").split(",")[0].trim(),
    city: place.city ?? "",
    countryCode: place.countryCode,
    url: e.buy_tickets_url || e.url || null,
    image: e.image_small_url || e.image_url || null,
    category: match[1],
    genre: null,
    performers: [],
    priceFrom: parsePrice(e.price_from_string),
    moreDates: 0,
    source: "fienta",
  };
}

async function fientaQuery(params: Record<string, string>, place: { countryCode: string | null; city: string | null }, w: EventWindow): Promise<NearbyEvent[]> {
  // Soonest first; the rows only ever show the next couple of dozen.
  const qs = new URLSearchParams({ starts_from: `${w.from} 00:00:00`, page: "1", per_page: "150", locale: "en", ...params });
  return cachedEvents(["fienta", qs.toString(), w.until], async () => {
    const data = await getJson<{ events?: FientaEvent[] }>(`https://fienta.com/api/v1/public/events?${qs}`);
    return (data?.events ?? [])
      .map((e) => nearbyFromFienta(e, place))
      .filter((e): e is NearbyEvent => !!e && e.date >= w.from && e.date <= w.until);
  });
}

/** Fienta by town when we know it (falling back to the whole country when the town is quiet). */
export async function fientaNearby(area: EventArea, w: EventWindow): Promise<NearbyEvent[]> {
  const cc = countryByCode(area.countryCode)?.code ?? null;
  // Town and country at once (both cached), rather than one after the other.
  const [town, country] = await Promise.all([
    area.city ? fientaQuery({ city: area.city, ...(cc ? { country: cc } : {}) }, { countryCode: cc, city: area.city }, w) : Promise.resolve([] as NearbyEvent[]),
    cc ? fientaQuery({ country: cc }, { countryCode: cc, city: null }, w) : Promise.resolve([] as NearbyEvent[]),
  ]);
  if (town.length >= 8 || !cc) return town;
  const seen = new Set(town.map((e) => e.id));
  return [...town, ...country.filter((e) => !seen.has(e.id))];
}

// ---------------------------------------------------------------- Skiddle (UK)

export type SkiddleEvent = {
  id: string | number;
  eventname?: string;
  date?: string;
  startdate?: string;
  cancelled?: string | number | boolean;
  EventCode?: string;
  link?: string;
  largeimageurl?: string;
  imageurl?: string;
  entryprice?: string;
  openingtimes?: { doorsopen?: string };
  venue?: { name?: string; town?: string; country?: string };
  artists?: { name?: string }[];
};

const SKIDDLE_CATEGORY: Record<string, NearbyCategory> = {
  LIVE: "music",
  FEST: "festival",
  CLUB: "music",
  SPORT: "sport",
  THEATRE: "arts",
  COMEDY: "arts",
  EXHIB: "arts",
  ARTS: "arts",
};

export function skiddleConfigured(): boolean {
  return !!process.env.SKIDDLE_API_KEY;
}

const inUK = (a: EventArea) =>
  a.countryCode ? ["GB", "IE"].includes(a.countryCode) : a.lat != null && a.lng != null && a.lat > 49.8 && a.lat < 60.9 && a.lng > -8.7 && a.lng < 1.8;

export function nearbyFromSkiddle(e: SkiddleEvent): NearbyEvent | null {
  const date = (e.date ?? e.startdate ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !e.eventname?.trim()) return null;
  if (e.cancelled === true || e.cancelled === "1" || e.cancelled === 1) return null;
  const doors = e.openingtimes?.doorsopen?.slice(0, 5);
  return {
    id: `skiddle-${e.id}`,
    name: e.eventname.trim(),
    date,
    time: doors && /^\d{2}:\d{2}$/.test(doors) ? doors : null,
    venue: e.venue?.name?.trim() ?? "",
    city: e.venue?.town?.trim() ?? "",
    countryCode: countryByCode(e.venue?.country)?.code ?? "GB",
    url: e.link ?? null,
    image: e.largeimageurl || e.imageurl || null,
    category: SKIDDLE_CATEGORY[e.EventCode ?? ""] ?? "other",
    genre: null,
    performers: (e.artists ?? []).map((a) => a.name?.trim() ?? "").filter(Boolean),
    priceFrom: parsePrice(e.entryprice, "GBP"),
    moreDates: 0,
    source: "skiddle",
  };
}

export async function skiddleNearby(area: EventArea, w: EventWindow): Promise<NearbyEvent[]> {
  if (!skiddleConfigured() || !inUK(area)) return [];
  const qs = new URLSearchParams({ api_key: process.env.SKIDDLE_API_KEY!, minDate: w.from, maxDate: w.until, limit: "100" });
  if (area.lat != null && area.lng != null) {
    qs.set("latitude", String(area.lat));
    qs.set("longitude", String(area.lng));
    qs.set("radius", "30"); // miles
  } else if (area.countryCode) {
    qs.set("country", area.countryCode);
  }
  const key = ["skiddle", [...qs.entries()].filter(([k]) => k !== "api_key").map((kv) => kv.join("=")).join("&")];
  return cachedEvents(key, async () => {
    const data = await getJson<{ results?: SkiddleEvent[] }>(`https://www.skiddle.com/api/v1/events/search/?${qs}`);
    return (data?.results ?? []).map(nearbyFromSkiddle).filter((e): e is NearbyEvent => !!e && e.date >= w.from && e.date <= w.until && e.category !== "other");
  });
}

// ---------------------------------------------------------------- SeatGeek (US & Canada)

export type SeatGeekEvent = {
  id: number;
  title?: string;
  short_title?: string;
  datetime_local?: string; // "2026-10-01T19:30:00"
  datetime_tbd?: boolean;
  type?: string;
  url?: string;
  venue?: { name?: string; city?: string; country?: string };
  performers?: { name?: string; image?: string | null }[];
  taxonomies?: { name?: string }[];
  stats?: { lowest_price?: number | null };
};

export function seatgeekConfigured(): boolean {
  return !!process.env.SEATGEEK_CLIENT_ID;
}

const inNorthAmerica = (a: EventArea) =>
  a.countryCode ? ["US", "CA"].includes(a.countryCode) : a.lat != null && a.lng != null && a.lat > 14 && a.lat < 72 && a.lng > -170 && a.lng < -50;

function seatgeekCategory(e: SeatGeekEvent): NearbyCategory {
  const kinds = [e.type ?? "", ...(e.taxonomies ?? []).map((t) => t.name ?? "")].join(" ").toLowerCase();
  if (/festival/.test(kinds)) return "festival";
  if (/concert|music/.test(kinds)) return "music";
  if (/conference|convention|expo/.test(kinds)) return "conference";
  if (/sports|nba|nfl|mlb|nhl|mls|ncaa|soccer|football|baseball|basketball|hockey|tennis|golf|racing|boxing|mma|wrestling/.test(kinds)) return "sport";
  if (/theat|broadway|comedy|dance|classical|opera|family_show|cirque/.test(kinds)) return "arts";
  return "other";
}

export function nearbyFromSeatGeek(e: SeatGeekEvent): NearbyEvent | null {
  const date = e.datetime_local?.slice(0, 10) ?? "";
  const name = (e.short_title || e.title || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !name) return null;
  const performer = (e.performers ?? []).find((p) => p.image);
  return {
    id: `seatgeek-${e.id}`,
    name,
    date,
    time: e.datetime_tbd ? null : e.datetime_local?.slice(11, 16) ?? null,
    venue: e.venue?.name?.trim() ?? "",
    city: e.venue?.city?.trim() ?? "",
    countryCode: countryByCode(e.venue?.country)?.code ?? null,
    url: e.url ?? null,
    image: performer?.image ?? null,
    category: seatgeekCategory(e),
    genre: null,
    performers: (e.performers ?? []).map((p) => p.name?.trim() ?? "").filter(Boolean),
    priceFrom: e.stats?.lowest_price ? { amount: e.stats.lowest_price, currency: "USD" } : null,
    moreDates: 0,
    source: "seatgeek",
  };
}

export async function seatgeekNearby(area: EventArea, w: EventWindow): Promise<NearbyEvent[]> {
  if (!seatgeekConfigured() || !inNorthAmerica(area)) return [];
  const qs = new URLSearchParams({
    client_id: process.env.SEATGEEK_CLIENT_ID!,
    per_page: "100",
    sort: "datetime_local.asc",
    "datetime_local.gte": w.from,
    "datetime_local.lte": `${w.until}T23:59:59`,
  });
  if (area.lat != null && area.lng != null) {
    qs.set("lat", String(area.lat));
    qs.set("lon", String(area.lng));
    qs.set("range", "100km");
  } else if (area.countryCode) {
    qs.set("venue.country", area.countryCode);
  }
  const key = ["seatgeek", [...qs.entries()].filter(([k]) => k !== "client_id").map((kv) => kv.join("=")).join("&")];
  return cachedEvents(key, async () => {
    const data = await getJson<{ events?: SeatGeekEvent[] }>(`https://api.seatgeek.com/2/events?${qs}`);
    return (data?.events ?? []).map(nearbyFromSeatGeek).filter((e): e is NearbyEvent => !!e && e.date >= w.from && e.date <= w.until);
  });
}

// ---------------------------------------------------------------- together

export type EventSource = "ticketmaster" | "fienta" | "skiddle" | "seatgeek";

export const SOURCE_NAMES: Record<EventSource, string> = { ticketmaster: "Ticketmaster", fienta: "Fienta", skiddle: "Skiddle", seatgeek: "SeatGeek" };

/** "Events from Ticketmaster and Fienta" — credit for exactly the sources shown. */
export function sourcesCredit(sources: (EventSource | undefined)[]): string | null {
  const names = [...new Set(sources.filter((s): s is EventSource => !!s))].map((s) => SOURCE_NAMES[s]);
  if (!names.length) return null;
  return `Events from ${names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`}`;
}

/**
 * Several sources' lists as one: soonest first, but taking from each source
 * in turn — so a busy one (hundreds of Tallinn workshops) can't crowd out
 * the rest — and the same show listed twice appears once.
 */
export function weave(lists: NearbyEvent[][], limit: number): NearbyEvent[] {
  const queues = lists.map((l) => [...l].sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""))).filter((l) => l.length);
  const seen = new Set<string>();
  const key = (e: NearbyEvent) => `${e.date}|${e.name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "")}`;
  const out: NearbyEvent[] = [];
  while (out.length < limit && queues.some((q) => q.length)) {
    for (const q of queues) {
      const e = q.shift();
      if (!e || seen.has(key(e))) continue;
      seen.add(key(e));
      out.push(e);
      if (out.length >= limit) break;
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
}
