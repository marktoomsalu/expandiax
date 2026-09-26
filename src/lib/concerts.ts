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
  source: "bandsintown" | "ticketmaster";
};

// ---------------------------------------------------------------- setlist.fm (past shows)

type SetlistSong = { name?: string };
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
  const songs = (s.sets?.set ?? []).flatMap((set) => (set.song ?? []).map((song) => song.name?.trim() ?? "")).filter(Boolean);
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
    source: "bandsintown",
  };
}

type TicketmasterEvent = {
  id: string;
  url?: string;
  dates?: { start?: { localDate?: string } };
  _embedded?: {
    venues?: { name?: string; city?: { name?: string }; country?: { countryCode?: string; name?: string } }[];
    attractions?: { name?: string }[];
  };
};

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
    source: "ticketmaster",
  };
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
    const params = new URLSearchParams({
      apikey: process.env.TICKETMASTER_API_KEY,
      keyword: artistName,
      classificationName: "music",
      sort: "date,asc",
      size: "50",
    });
    const res = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`, { next: { revalidate: 60 * 60 * 6 } });
    if (res.ok) {
      const data = (await res.json()) as { _embedded?: { events?: TicketmasterEvent[] } };
      shows = (data._embedded?.events ?? []).map((e) => upcomingFromTicketmaster(e, artistName)).filter((s): s is UpcomingShow => s !== null);
    }
  } else {
    throw new Error("not_configured");
  }

  const seen = new Set<string>();
  return shows
    .filter((s) => s.date >= today)
    .filter((s) => {
      const key = `${s.date}|${normalize(s.venue)}|${normalize(s.city)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit);
}

// ---------------------------------------------------------------- feed: your artists on tour

/** The artists someone has seen live, most recently seen first, one entry per artist. */
export function artistsSeenLive(
  events: { event_type: string; title: string; spotify_artist_name: string | null; event_date: string }[],
  limit = 4
): string[] {
  const seen = new Map<string, { name: string; last: string }>();
  for (const e of events) {
    if (e.event_type !== "concert") continue;
    const name = (e.spotify_artist_name || e.title).trim();
    const key = normalize(name);
    if (!key) continue;
    const prev = seen.get(key);
    if (!prev || e.event_date > prev.last) seen.set(key, { name: prev?.name ?? name, last: e.event_date });
  }
  return [...seen.values()]
    .sort((a, b) => b.last.localeCompare(a.last))
    .slice(0, limit)
    .map((a) => a.name);
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
