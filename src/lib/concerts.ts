import { countryByCode, countryByName } from "@/lib/countries";

// Concert data from outside services, used to make logging a concert quick
// (pick the show you were at) and to show what's coming up. Only an artist's
// name is ever sent to these services — nothing about the person using
// ExpandiaX. Each one needs its own key; without it that feature just hides.

export type PastShow = {
  id: string;
  date: string; // yyyy-mm-dd
  venue: string;
  city: string;
  countryCode: string | null;
  countryName: string | null;
  tour: string | null;
  songs: string[];
  url: string | null;
};

export type UpcomingShow = {
  id: string;
  date: string; // yyyy-mm-dd
  venue: string;
  city: string;
  countryCode: string | null;
  countryName: string | null;
  url: string | null; // event page (with ticket links)
  image: string | null;
  source: "bandsintown" | "ticketmaster";
};

// ---------------------------------------------------------------- setlist.fm (past shows)

type SetlistSong = { name?: string; tape?: boolean }; // tape = recorded intro/outro, not played live
type SetlistFmSetlist = {
  id: string;
  eventDate: string; // dd-MM-yyyy
  url?: string;
  tour?: { name?: string };
  venue?: { name?: string; city?: { name?: string; country?: { code?: string; name?: string } } };
  sets?: { set?: { song?: SetlistSong[] }[] };
};

export function pastShowFromSetlist(s: SetlistFmSetlist): PastShow | null {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s.eventDate ?? "");
  if (!m) return null;
  const code = s.venue?.city?.country?.code?.toUpperCase() ?? null;
  const country = countryByCode(code) ?? countryByName(s.venue?.city?.country?.name);
  const songs = (s.sets?.set ?? [])
    .flatMap((set) => (set.song ?? []).filter((song) => !song.tape).map((song) => song.name?.trim() ?? ""))
    .filter(Boolean);
  return {
    id: s.id,
    date: `${m[3]}-${m[2]}-${m[1]}`,
    venue: s.venue?.name?.trim() ?? "",
    city: s.venue?.city?.name?.trim() ?? "",
    countryCode: country?.code ?? null,
    countryName: country?.name ?? s.venue?.city?.country?.name ?? null,
    tour: s.tour?.name?.trim() || null,
    songs: [...new Set(songs)],
    url: s.url ?? null,
  };
}

async function setlistFm<T>(path: string): Promise<T | null> {
  const key = process.env.SETLISTFM_API_KEY;
  if (!key) throw new Error("not_configured");
  const res = await fetch(`https://api.setlist.fm/rest/1.0${path}`, {
    headers: { "x-api-key": key, Accept: "application/json", "Accept-Language": "en" },
    next: { revalidate: 60 * 60 * 24 },
  });
  if (res.status === 404) return null; // setlist.fm answers "not found" when there are no results
  if (!res.ok) throw new Error(`setlistfm_${res.status}`);
  return (await res.json()) as T;
}

const normalize = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]/gu, "");

/** Compare artist names loosely ("AC/DC" = "ACDC", "Beyoncé" = "Beyonce"). */
export const artistKey = normalize;

/** The artist's MusicBrainz id — the exact artist, not every band with a similar name. */
async function artistMbid(artistName: string): Promise<string | null> {
  const data = await setlistFm<{ artist?: { mbid: string; name: string }[] }>(
    `/search/artists?artistName=${encodeURIComponent(artistName)}&sort=relevance&p=1`
  );
  const artists = data?.artist ?? [];
  const exact = artists.find((a) => normalize(a.name) === normalize(artistName));
  return (exact ?? artists[0])?.mbid ?? null;
}

export async function searchPastShows(
  artistName: string,
  opts: { year?: number; page?: number } = {}
): Promise<{ shows: PastShow[]; total: number; page: number; perPage: number }> {
  const mbid = await artistMbid(artistName);
  if (!mbid) return { shows: [], total: 0, page: 1, perPage: 20 };
  const params = new URLSearchParams({ artistMbid: mbid, p: String(opts.page ?? 1) });
  if (opts.year) params.set("year", String(opts.year));
  const data = await setlistFm<{ setlist?: SetlistFmSetlist[]; total?: number; page?: number; itemsPerPage?: number }>(
    `/search/setlists?${params}`
  );
  const shows = (data?.setlist ?? []).map(pastShowFromSetlist).filter((s): s is PastShow => s !== null);
  // Newest first, and no future-dated entries (setlist.fm lists announced shows too).
  const today = new Date().toISOString().slice(0, 10);
  return {
    shows: shows.filter((s) => s.date <= today).sort((a, b) => b.date.localeCompare(a.date)),
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    perPage: data?.itemsPerPage ?? 20,
  };
}

// ---------------------------------------------------------------- upcoming shows

type BandsintownEvent = {
  id: string | number;
  datetime: string; // 2026-10-01T19:00:00
  url?: string;
  venue?: { name?: string; city?: string; country?: string };
};

export function upcomingFromBandsintown(e: BandsintownEvent): UpcomingShow | null {
  const date = e.datetime?.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) return null;
  const country = countryByName(e.venue?.country);
  return {
    id: `bit-${e.id}`,
    date,
    venue: e.venue?.name?.trim() ?? "",
    city: e.venue?.city?.trim() ?? "",
    countryCode: country?.code ?? null,
    countryName: country?.name ?? e.venue?.country ?? null,
    url: e.url ?? null,
    image: null,
    source: "bandsintown",
  };
}

type TicketmasterImage = { ratio?: string; url: string; width?: number; fallback?: boolean };
type TicketmasterEvent = {
  id: string;
  name?: string;
  url?: string;
  images?: TicketmasterImage[];
  dates?: { start?: { localDate?: string; localTime?: string }; status?: { code?: string } };
  classifications?: { segment?: { name?: string }; genre?: { name?: string } }[];
  priceRanges?: { min?: number; currency?: string }[];
  _embedded?: {
    venues?: { name?: string; city?: { name?: string }; country?: { countryCode?: string; name?: string } }[];
    attractions?: { name?: string }[];
  };
};

/** A wide photo that's sharp on a phone but not huge: the smallest 16:9 at least 640px wide. */
export function ticketmasterImage(images: TicketmasterImage[] | undefined): string | null {
  const list = (images ?? []).filter((i) => i.url);
  const real = list.filter((i) => !i.fallback);
  const pool = real.length ? real : list;
  const wide = pool.filter((i) => i.ratio === "16_9").sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  return (wide.find((i) => (i.width ?? 0) >= 640) ?? wide.at(-1) ?? pool[0])?.url ?? null;
}

/** Ticketmaster searches by keyword, so keep only events the artist is actually on the bill of. */
export function upcomingFromTicketmaster(e: TicketmasterEvent, artistName: string): UpcomingShow | null {
  const date = e.dates?.start?.localDate;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const onBill = (e._embedded?.attractions ?? []).some((a) => a.name && normalize(a.name) === normalize(artistName));
  if (!onBill) return null;
  const venue = e._embedded?.venues?.[0];
  const country = countryByCode(venue?.country?.countryCode) ?? countryByName(venue?.country?.name);
  return {
    id: `tm-${e.id}`,
    date,
    venue: venue?.name?.trim() ?? "",
    city: venue?.city?.name?.trim() ?? "",
    countryCode: country?.code ?? null,
    countryName: country?.name ?? venue?.country?.name ?? null,
    url: e.url ?? null,
    image: ticketmasterImage(e.images),
    source: "ticketmaster",
  };
}

async function ticketmasterAttractionId(artistName: string, apikey: string): Promise<string | null> {
  const params = new URLSearchParams({ apikey, keyword: artistName, classificationName: "music", size: "10" });
  const res = await fetch(`https://app.ticketmaster.com/discovery/v2/attractions.json?${params}`, { next: { revalidate: 60 * 60 * 24 } });
  if (!res.ok) return null;
  const data = (await res.json()) as { _embedded?: { attractions?: { id: string; name?: string }[] } };
  return data._embedded?.attractions?.find((a) => a.name && normalize(a.name) === normalize(artistName))?.id ?? null;
}

export function upcomingConfigured(): boolean {
  return !!(process.env.BANDSINTOWN_APP_ID || process.env.TICKETMASTER_API_KEY);
}

/** An artist's next shows, soonest first. Bandsintown if configured, otherwise Ticketmaster. */
export async function upcomingShows(artistName: string, limit = 20): Promise<UpcomingShow[]> {
  const today = new Date().toISOString().slice(0, 10);
  let shows: UpcomingShow[] = [];

  if (process.env.BANDSINTOWN_APP_ID) {
    const res = await fetch(
      `https://rest.bandsintown.com/artists/${encodeURIComponent(artistName)}/events?app_id=${encodeURIComponent(process.env.BANDSINTOWN_APP_ID)}&date=upcoming`,
      { next: { revalidate: 60 * 60 * 6 } }
    );
    if (res.ok) {
      const data = (await res.json()) as unknown;
      if (Array.isArray(data)) shows = data.map((e) => upcomingFromBandsintown(e as BandsintownEvent)).filter((s): s is UpcomingShow => s !== null);
    }
  } else if (process.env.TICKETMASTER_API_KEY) {
    const apikey = process.env.TICKETMASTER_API_KEY;
    // Find the artist itself first: a keyword search for events returns
    // tributes and festivals that crowd out the artist's own shows.
    const attractionId = await ticketmasterAttractionId(artistName, apikey);
    const params = new URLSearchParams({ apikey, sort: "date,asc", size: "50" });
    if (attractionId) params.set("attractionId", attractionId);
    else {
      params.set("keyword", artistName);
      params.set("classificationName", "music");
    }
    const res = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`, { next: { revalidate: 60 * 60 * 6 } });
    if (res.ok) {
      const data = (await res.json()) as { _embedded?: { events?: TicketmasterEvent[] } };
      shows = (data._embedded?.events ?? []).map((e) => upcomingFromTicketmaster(e, artistName)).filter((s): s is UpcomingShow => s !== null);
    }
  } else {
    throw new Error("not_configured");
  }

  // One row per night: services list the same show twice, sometimes with a
  // different city name for the same venue.
  const seen = new Set<string>();
  return shows
    .filter((s) => s.date >= today)
    .filter((s) => {
      const key = `${s.date}|${normalize(s.venue) || normalize(s.city)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit);
}

// ---------------------------------------------------------------- feed: your artists on tour

export type SeenArtist = { name: string; image: string | null };

/** The artists someone has seen live, most recently seen first, one entry per artist. */
export function artistsSeenLive(
  events: { event_type: string; title: string; spotify_artist_name: string | null; spotify_artist_image?: string | null; event_date: string }[],
  limit = 4
): SeenArtist[] {
  const seen = new Map<string, SeenArtist & { last: string }>();
  for (const e of events) {
    if (e.event_type !== "concert") continue;
    const name = (e.spotify_artist_name || e.title).trim();
    const key = normalize(name);
    if (!key) continue;
    const prev = seen.get(key);
    const image = prev?.image ?? e.spotify_artist_image ?? null;
    if (!prev || e.event_date > prev.last) seen.set(key, { name: prev?.name ?? name, image, last: e.event_date });
    else if (!prev.image && image) prev.image = image;
  }
  return [...seen.values()]
    .sort((a, b) => b.last.localeCompare(a.last))
    .slice(0, limit)
    .map(({ name, image }) => ({ name, image }));
}

/** For each artist, the dates worth showing: ones in your home country first, then the soonest. */
export function tourHighlights(
  byArtist: { artist: string; shows: UpcomingShow[] }[],
  homeCountry: string | null,
  perArtist = 2
): { artist: string; shows: UpcomingShow[]; total: number }[] {
  return byArtist
    .filter((a) => a.shows.length > 0)
    .map((a) => {
      const near = a.shows.filter((s) => homeCountry && s.countryCode === homeCountry);
      const rest = a.shows.filter((s) => !near.includes(s));
      return { artist: a.artist, shows: [...near, ...rest].slice(0, perArtist), total: a.shows.length, hasNear: near.length > 0 };
    })
    .sort((a, b) => Number(b.hasNear) - Number(a.hasNear) || a.shows[0].date.localeCompare(b.shows[0].date))
    .map(({ artist, shows, total }) => ({ artist, shows, total }));
}

// ---------------------------------------------------------------- feed: happening near you

export type NearbyCategory = "music" | "sport" | "arts" | "other";

export type NearbyEvent = {
  id: string;
  name: string;
  date: string; // yyyy-mm-dd, the first date when it runs several nights
  time: string | null; // HH:mm
  venue: string;
  city: string;
  countryCode: string | null;
  url: string | null;
  image: string | null;
  category: NearbyCategory;
  genre: string | null;
  performers: string[];
  priceFrom: { amount: number; currency: string } | null;
  moreDates: number;
};

// Listings that aren't events someone would go to.
const NOT_AN_EVENT = /\b(parking|car park|vip package|hospitality package|upgrade|voucher|gift ?card|add-?on|shuttle)\b/i;

function categoryOf(segment: string | undefined): NearbyCategory {
  if (segment === "Music") return "music";
  if (segment === "Sports") return "sport";
  if (segment === "Arts & Theatre") return "arts";
  return "other";
}

export function nearbyFromTicketmaster(e: TicketmasterEvent): NearbyEvent | null {
  const date = e.dates?.start?.localDate;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !e.name) return null;
  if (NOT_AN_EVENT.test(e.name) || ["cancelled", "offsale"].includes(e.dates?.status?.code ?? "")) return null;
  const venue = e._embedded?.venues?.[0];
  const cls = e.classifications?.[0];
  const genre = cls?.genre?.name;
  const price = (e.priceRanges ?? []).filter((p) => typeof p.min === "number" && p.min > 0 && p.currency).sort((a, b) => a.min! - b.min!)[0];
  return {
    id: `tm-${e.id}`,
    name: e.name.trim(),
    date,
    time: e.dates?.start?.localTime?.slice(0, 5) ?? null,
    venue: venue?.name?.trim() ?? "",
    city: venue?.city?.name?.trim() ?? "",
    countryCode: (countryByCode(venue?.country?.countryCode) ?? countryByName(venue?.country?.name))?.code ?? null,
    url: e.url ?? null,
    image: ticketmasterImage(e.images),
    category: categoryOf(cls?.segment?.name),
    genre: genre && genre !== "Undefined" && genre !== "Other" ? genre : null,
    performers: (e._embedded?.attractions ?? []).map((a) => a.name?.trim() ?? "").filter(Boolean),
    priceFrom: price ? { amount: price.min!, currency: price.currency! } : null,
    moreDates: 0,
  };
}

/** A musical playing 40 nights is one card ("+39 more dates"), not 40. Keeps date order. */
export function collapseRuns(events: NearbyEvent[]): NearbyEvent[] {
  const byKey = new Map<string, NearbyEvent>();
  for (const e of events) {
    const key = `${normalize(e.name)}|${normalize(e.venue)}`;
    const first = byKey.get(key);
    if (first) first.moreDates += 1;
    else byKey.set(key, { ...e });
  }
  return [...byKey.values()];
}

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

/** Geohash of a point; 4 characters is a ~20 km cell — plenty for "near you", and never an exact spot. */
export function geohash(lat: number, lng: number, precision = 4): string {
  let [latMin, latMax, lngMin, lngMax] = [-90, 90, -180, 180];
  let hash = "";
  let bits = 0;
  let ch = 0;
  let even = true;
  while (hash.length < precision) {
    if (even) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) { ch = (ch << 1) | 1; lngMin = mid; } else { ch <<= 1; lngMax = mid; }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) { ch = (ch << 1) | 1; latMin = mid; } else { ch <<= 1; latMax = mid; }
    }
    even = !even;
    if (++bits === 5) {
      hash += BASE32[ch];
      bits = 0;
      ch = 0;
    }
  }
  return hash;
}

export function nearbyConfigured(): boolean {
  return !!process.env.TICKETMASTER_API_KEY;
}

export type NearbyWhere = { lat: number; lng: number } | { countryCode: string };

async function ticketmasterEvents(params: Record<string, string>): Promise<TicketmasterEvent[]> {
  const qs = new URLSearchParams({ apikey: process.env.TICKETMASTER_API_KEY!, locale: "*", sort: "date,asc", size: "100", ...params });
  const res = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${qs}`, { next: { revalidate: 60 * 60 * 6 } });
  if (!res.ok) return [];
  const data = (await res.json()) as { _embedded?: { events?: TicketmasterEvent[] } };
  return data._embedded?.events ?? [];
}

/**
 * What's on near a place over the next ~3 months: soonest first, one card per
 * run. Around a point it starts at 100 km and widens to 400 km when that's
 * quiet (a small city next to a big one).
 */
export async function nearbyEvents(where: NearbyWhere, limit = 24): Promise<NearbyEvent[]> {
  if (!nearbyConfigured()) throw new Error("not_configured");
  // Whole days, so everyone asking today shares one cached answer.
  const today = new Date().toISOString().slice(0, 10);
  const until = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);
  const window = { startDateTime: `${today}T00:00:00Z`, endDateTime: `${until}T23:59:59Z` };

  const collect = (raw: TicketmasterEvent[]) =>
    collapseRuns(raw.map(nearbyFromTicketmaster).filter((e): e is NearbyEvent => e !== null && e.date >= today));

  let events: NearbyEvent[];
  if ("countryCode" in where) {
    events = collect(await ticketmasterEvents({ ...window, countryCode: where.countryCode }));
  } else {
    const geoPoint = geohash(where.lat, where.lng);
    events = collect(await ticketmasterEvents({ ...window, geoPoint, radius: "100", unit: "km" }));
    if (events.length < 8) events = collect(await ticketmasterEvents({ ...window, geoPoint, radius: "400", unit: "km" }));
  }
  return events.slice(0, limit);
}
