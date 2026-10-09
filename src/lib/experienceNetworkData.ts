import type { createClient } from "@/lib/supabase/server";
import { countryByCode } from "@/lib/countries";
import { liveKey, liveName, slugify, type LiveRow } from "@/lib/explore";
import { LIVE_TYPES } from "@/lib/exploreData";
import { placeKey } from "@/lib/photoPlaces";
import { signMedia } from "@/lib/signedMedia";
import { orderStops, stayWhen, tripName } from "@/lib/tripPlaces";
import type { DatePrecision, ProfileVisibility } from "@/lib/types";
import type { Row, RowPerson } from "@/components/network/NetworkRows";
import {
  byCloseness,
  groupLabel,
  groupTravellers,
  meetReasons,
  meetScore,
  placesForYou,
  type Person,
  type PlaceForYou,
  type Reason,
  type Stay,
  type TownRow,
  type Traveller,
} from "@/lib/experienceNetwork";

// Everything here reads through the viewer's own session: the database's
// visibility, "Only me" and block rules decide whose trips are in it. The
// only numbers that include people you can't see come from
// place_traveller_counts, which returns counts and never names.

type Supabase = ReturnType<typeof createClient>;

/** A dream place: a town, or the whole country when place_name is empty (stored in want_to_go). */
export type DreamPlace = { country_code: string; place_name: string };

type VisitRow = { id: string; title: string; kind: "trip" | "lived"; year: number; visited_from: string | null; visited_to: string | null; date_precision: DatePrecision };
type CityRow = { city_name: string; country_visit_id: string; position: number; arrived: string | null };

/** Who you follow, and your friends among them: people who follow you back. */
async function viewerCircle(supabase: Supabase, viewerId: string | null) {
  if (!viewerId) return { following: new Set<string>(), friends: new Set<string>(), home: null as string | null, dreams: [] as DreamPlace[] };
  const [{ data: f }, { data: back }, { data: me }, { data: dreams }] = await Promise.all([
    supabase.from("follows").select("followee_id").eq("follower_id", viewerId),
    supabase.from("follows").select("follower_id").eq("followee_id", viewerId),
    supabase.from("profiles").select("home_country_code").eq("id", viewerId).single(),
    supabase.from("want_to_go").select("country_code, place_name").order("created_at", { ascending: false }),
  ]);
  const following = new Set((f ?? []).map((r) => r.followee_id));
  const friends = new Set((back ?? []).map((r) => r.follower_id).filter((id) => following.has(id)));
  return { following, friends, home: me?.home_country_code ?? null, dreams: (dreams ?? []) as DreamPlace[] };
}

/** The anonymous counts for a country: total, and per town (lower-cased key). */
export async function travellerCounts(supabase: Supabase, countryCode: string): Promise<{ total: number; towns: Map<string, { name: string; n: number }> }> {
  const { data } = await supabase.rpc("place_traveller_counts", { p_country: countryCode });
  const rows = (data ?? []) as { place: string; travellers: number }[];
  const towns = new Map<string, { name: string; n: number }>();
  let total = 0;
  for (const r of rows) {
    if (!r.place) total = Number(r.travellers);
    else towns.set(placeKey(r.place), { name: r.place, n: Number(r.travellers) });
  }
  return { total, towns };
}

/**
 * Everyone you can see who has been to a country (or one of its towns),
 * with what they did there — latest first.
 */
export async function loadTravellers(
  supabase: Supabase,
  viewerId: string | null,
  countryCode: string,
  /** A town, as its web address slug ("novo-mesto"). */
  townSlug?: string
): Promise<{ travellers: Traveller[]; home: string | null; dreams: DreamPlace[]; townName: string | null }> {
  const country = countryByCode(countryCode);
  const [circle, { data }] = await Promise.all([
    viewerCircle(supabase, viewerId),
    supabase
      .from("visited_countries")
      .select(
        "user_id, profiles!inner(id, username, display_name, avatar_url, home_country_code, discoverable), country_visits(id, title, kind, year, visited_from, visited_to, date_precision), country_cities(city_name, country_visit_id, position, arrived)"
      )
      .eq("country_code", countryCode)
      .eq("is_public", true)
      .limit(1000),
  ]);
  const wanted = townSlug ?? null;
  let townName: string | null = null;
  const travellers: Traveller[] = [];
  for (const row of data ?? []) {
    const p = (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles) as (Person & { home_country_code: string | null; discoverable: boolean }) | null;
    if (!p || p.id === viewerId) continue;
    const following = circle.following.has(p.id);
    // Out of search and suggestions: only the people who follow them see them here.
    if (!p.discoverable && !following) continue;
    const cities = (row.country_cities ?? []) as CityRow[];
    const stays: Stay[] = ((row.country_visits ?? []) as VisitRow[])
      .map((v) => {
        const places = orderStops(cities.filter((c) => c.country_visit_id === v.id)).map((c) => c.city_name);
        return {
          id: v.id,
          name: tripName(v, country?.name ?? countryCode, places),
          kind: v.kind,
          when: stayWhen(v),
          lastDay: v.visited_to ?? v.visited_from ?? `${v.year}-12-31`,
          places,
        };
      })
      .filter((s) => {
        if (!wanted) return true;
        const hit = s.places.find((pl) => slugify(pl) === wanted);
        townName ??= hit ?? null;
        return !!hit;
      })
      .sort((a, b) => b.lastDay.localeCompare(a.lastDay));
    if (wanted && !stays.length) continue;
    travellers.push({ id: p.id, username: p.username, display_name: p.display_name, avatar_url: p.avatar_url, home: p.home_country_code, following, stays });
  }
  return { travellers, home: circle.home, dreams: circle.dreams, townName };
}

// ---------- For the feed: places for you, a place to start, people to meet ----------

/** A town to show: whose it is ("friends" or the wider "network" you follow), their faces, and a photo. */
export type PlaceCard = PlaceForYou & { circle: "friends" | "network"; faces: Person[]; photo: string | null };
export type PersonCard = Person & { visibility: ProfileVisibility; headline: Reason | null; reasons: Reason[]; photos: string[] };
/** A country for your next trip: where people you follow (or, early on, anyone) have been and you haven't. */
export type TripIdea = { country: string; friends: Person[]; network: number; people: number };
export type NetworkHome = { friendPlaces: PlaceCard[]; networkPlaces: PlaceCard[]; people: PersonCard[]; ideas: TripIdea[]; dreams: DreamPlace[] };

const TOWNS_QUERY = "id, city_name, lat, lng, visited_countries!inner(user_id, country_code, is_public), country_visits(kind)";
const one = <T,>(x: unknown) => (Array.isArray(x) ? x[0] : x) as T | undefined;

/** Every town anyone you can see has logged (public ones, and your own), minus people you've blocked. */
function parseTowns(rows: unknown[] | null, blockedIds: Set<string>, viewerId: string) {
  type Raw = { id: string; city_name: string; lat: number | null; lng: number | null; visited_countries: unknown; country_visits: unknown };
  const towns: (TownRow & { lived: boolean })[] = [];
  for (const r of (rows ?? []) as Raw[]) {
    const vc = one<{ user_id: string; country_code: string; is_public: boolean }>(r.visited_countries);
    if (!vc || blockedIds.has(vc.user_id) || (!vc.is_public && vc.user_id !== viewerId)) continue;
    towns.push({ userId: vc.user_id, country: vc.country_code, town: r.city_name, lat: r.lat, lng: r.lng, cityId: r.id, lived: one<{ kind: string }>(r.country_visits)?.kind === "lived" });
  }
  return towns;
}

/**
 * Splits ranked towns into friends' places and the wider network's (people
 * you follow who don't follow you back, or friends' places past the first
 * `limit`), each town in one list only.
 */
function splitPlaces(ranked: PlaceForYou[], limit: number) {
  const friends = ranked.filter((p) => p.friends.length > 0).sort((a, b) => b.friends.length - a.friends.length);
  const shown = new Set(friends.slice(0, limit).map((p) => p.key));
  const network = ranked.filter((p) => p.network.length > 0 && !shown.has(p.key));
  return { friends: friends.slice(0, limit), network: network.slice(0, limit) };
}

/** Faces (of friends, or of people you follow) and a trip photo for each town. */
async function decoratePlaces(supabase: Supabase, groups: { circle: "friends" | "network"; places: PlaceForYou[] }[], known = new Map<string, Person>()) {
  const who = (p: PlaceForYou, circle: "friends" | "network") => (circle === "friends" ? p.friends : p.network);
  const faceIds = [...new Set(groups.flatMap((g) => g.places.flatMap((p) => who(p, g.circle).slice(0, 3))))].filter((id) => !known.has(id));
  const cityIds = groups.flatMap((g) => g.places.flatMap((p) => p.cityIds.slice(0, 20)));
  const [{ data: faces }, { data: photos }] = await Promise.all([
    faceIds.length ? supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", faceIds) : Promise.resolve({ data: [] as Person[] }),
    cityIds.length
      ? signMedia(await supabase.from("country_media").select("city_id, public_url").in("city_id", cityIds.slice(0, 1000)).eq("media_type", "image").limit(400))
      : Promise.resolve({ data: [] as { city_id: string; public_url: string }[] }),
  ]);
  for (const f of faces ?? []) known.set(f.id, f as Person);
  const photoByCity = new Map<string, string>();
  for (const m of (photos ?? []) as { city_id: string; public_url: string }[]) if (!photoByCity.has(m.city_id)) photoByCity.set(m.city_id, m.public_url);
  const cards = groups.map((g) =>
    g.places.map(
      (p): PlaceCard => ({
        ...p,
        circle: g.circle,
        faces: who(p, g.circle)
          .slice(0, 3)
          .map((id) => known.get(id))
          .filter((x): x is Person => !!x),
        photo: p.cityIds.map((id) => photoByCity.get(id)).find(Boolean) ?? null,
      })
    )
  );
  return { cards, faceById: known };
}

/** All the towns your friends, and the wider network you follow, have been to — for "See all". */
export async function loadNetworkPlaces(supabase: Supabase, viewerId: string): Promise<{ friends: PlaceCard[]; network: PlaceCard[] }> {
  const circle = await viewerCircle(supabase, viewerId);
  if (circle.following.size === 0) return { friends: [], network: [] };
  const [{ data: townRows }, { data: blocked }] = await Promise.all([
    supabase.from("country_cities").select(TOWNS_QUERY).limit(5000),
    supabase.from("blocks").select("blocked_id").eq("blocker_id", viewerId),
  ]);
  const towns = parseTowns(townRows, new Set((blocked ?? []).map((b) => b.blocked_id)), viewerId);
  const dreamCountries = new Set(circle.dreams.map((w) => w.country_code));
  const dreamTowns = new Set(circle.dreams.filter((w) => w.place_name).map((w) => `${w.country_code}:${placeKey(w.place_name)}`));
  const ranked = placesForYou(towns, { id: viewerId, following: circle.following, friends: circle.friends, dreamCountries, dreamTowns }, Infinity);
  const { friends, network } = splitPlaces(ranked, 120);
  const { cards } = await decoratePlaces(supabase, [
    { circle: "friends", places: friends },
    { circle: "network", places: network },
  ]);
  return { friends: cards[0], network: cards[1] };
}

/** The Explore tab's network rows — `limits` lift the row sizes for a "See all" page. */
export async function loadNetworkHome(supabase: Supabase, viewerId: string, limits: { people?: number; ideas?: number } = {}): Promise<NetworkHome> {
  const circle = await viewerCircle(supabase, viewerId);
  const [{ data: townRows }, { data: countryRows }, { data: liveData }, { data: blocked }] = await Promise.all([
    supabase.from("country_cities").select(TOWNS_QUERY).limit(5000),
    supabase.from("visited_countries").select("user_id, country_code").limit(5000),
    supabase.from("events").select("id, user_id, event_type, title, spotify_artist_name, spotify_artist_image, event_date").in("event_type", [...LIVE_TYPES]).limit(3000),
    supabase.from("blocks").select("blocked_id").eq("blocker_id", viewerId),
  ]);
  const blockedIds = new Set((blocked ?? []).map((b) => b.blocked_id));

  const towns = parseTowns(townRows, blockedIds, viewerId);

  const dreamCountries = new Set(circle.dreams.map((w) => w.country_code));
  const dreamTowns = new Set(circle.dreams.filter((w) => w.place_name).map((w) => `${w.country_code}:${placeKey(w.place_name)}`));
  const ranked = placesForYou(towns, { id: viewerId, following: circle.following, friends: circle.friends, dreamCountries, dreamTowns }, Infinity);
  const split = splitPlaces(ranked, 10);

  // ---- People you may want to meet
  const countriesOf = new Map<string, Set<string>>();
  for (const r of countryRows ?? []) (countriesOf.get(r.user_id) ?? countriesOf.set(r.user_id, new Set()).get(r.user_id)!).add(r.country_code);
  const townsOfUser = new Map<string, Set<string>>();
  const livedOf = new Map<string, { town: string; country: string }[]>();
  for (const t of towns) {
    (townsOfUser.get(t.userId) ?? townsOfUser.set(t.userId, new Set()).get(t.userId)!).add(`${t.country}:${placeKey(t.town)}`);
    if (t.lived) (livedOf.get(t.userId) ?? livedOf.set(t.userId, []).get(t.userId)!).push({ town: t.town, country: t.country });
  }
  const liveOf = new Map<string, Map<string, string>>();
  for (const e of (liveData ?? []) as LiveRow[]) {
    const name = liveName(e);
    const k = liveKey(name);
    if (k) (liveOf.get(e.user_id) ?? liveOf.set(e.user_id, new Map()).get(e.user_id)!).set(k, name);
  }
  const myTowns = townsOfUser.get(viewerId) ?? new Set<string>();
  const myLive = liveOf.get(viewerId) ?? new Map<string, string>();
  const homeName = countryByCode(circle.home)?.name ?? null;
  const candidates = [...new Set([...countriesOf.keys(), ...townsOfUser.keys()])].filter((id) => id !== viewerId && !circle.following.has(id) && !blockedIds.has(id));

  const { data: candProfiles } = candidates.length
    ? await supabase.from("profiles").select("id, username, display_name, avatar_url, home_country_code, visibility").in("id", candidates.slice(0, 400)).eq("discoverable", true)
    : { data: [] as (Person & { home_country_code: string | null; visibility: ProfileVisibility })[] };
  const people: (PersonCard & { score: number })[] = [];
  for (const p of candProfiles ?? []) {
    const theirTowns = townsOfUser.get(p.id) ?? new Set<string>();
    const lived = livedOf.get(p.id) ?? [];
    const livedWanted = lived.find((l) => dreamCountries.has(l.country));
    const sharedLiveKey = [...(liveOf.get(p.id)?.keys() ?? [])].find((k) => myLive.has(k));
    const facts = {
      countries: countriesOf.get(p.id)?.size ?? 0,
      home: circle.home && p.home_country_code === circle.home ? homeName : null,
      livedIn: (livedWanted ?? lived[0])?.town ?? null,
      sharedTowns: [...theirTowns].filter((k) => myTowns.has(k)).length,
      sharedLive: sharedLiveKey ? myLive.get(sharedLiveKey) ?? null : null,
    };
    const score = meetScore(facts, !!livedWanted);
    if (score < 1.5) continue;
    const reasons = meetReasons(facts);
    people.push({ id: p.id, username: p.username, display_name: p.display_name, avatar_url: p.avatar_url, visibility: p.visibility as ProfileVisibility, photos: [], headline: reasons[0] ?? null, reasons: reasons.slice(1), score });
  }
  people.sort((a, b) => b.score - a.score);

  // ---- Faces and photos for the place cards
  const {
    cards: [friendPlaces, networkPlaces],
    faceById,
  } = await decoratePlaces(supabase, [
    { circle: "friends", places: split.friends },
    { circle: "network", places: split.network },
  ]);

  // ---- Ideas for your next trip: countries your network knows and you don't
  const mineCountries = countriesOf.get(viewerId) ?? new Set<string>();
  const byCountry = new Map<string, { network: Set<string>; people: Set<string> }>();
  for (const [uid, set] of countriesOf) {
    if (uid === viewerId || blockedIds.has(uid)) continue;
    for (const c of set) {
      if (mineCountries.has(c)) continue;
      const e = byCountry.get(c) ?? byCountry.set(c, { network: new Set(), people: new Set() }).get(c)!;
      e.people.add(uid);
      if (circle.following.has(uid)) e.network.add(uid);
    }
  }
  const ideaScore = (i: { country: string; network: string[]; people: number }) => i.network.length * 3 + i.people + (dreamCountries.has(i.country) ? 5 : 0);
  const ideaRows = [...byCountry.entries()]
    .map(([country, e]) => ({ country, network: [...e.network], people: e.people.size }))
    .sort((a, b) => ideaScore(b) - ideaScore(a))
    .slice(0, limits.ideas ?? 9);

  // ---- Faces for ideas, and a couple of trip photos for each person
  const topPeople = people.slice(0, limits.people ?? 8);
  const ideaFaceIds = [...new Set(ideaRows.flatMap((i) => i.network.slice(0, 3)))].filter((id) => !faceById.has(id));
  const [{ data: ideaFaces }, { data: theirPhotos }] = await Promise.all([
    ideaFaceIds.length ? supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", ideaFaceIds) : Promise.resolve({ data: [] as Person[] }),
    topPeople.length
      ? signMedia(
          await supabase
            .from("country_media")
            .select("public_url, visited_countries!inner(user_id)")
            .in("visited_countries.user_id", topPeople.map((p) => p.id))
            .eq("media_type", "image")
            .limit(80)
        )
      : Promise.resolve({ data: [] as { public_url: string; visited_countries: unknown }[] }),
  ]);
  for (const f of ideaFaces ?? []) faceById.set(f.id, f as Person);
  for (const m of (theirPhotos ?? []) as { public_url: string; visited_countries: unknown }[]) {
    const uid = one<{ user_id: string }>(m.visited_countries)?.user_id;
    const person = topPeople.find((p) => p.id === uid);
    if (person && person.photos.length < 3) person.photos.push(m.public_url);
  }
  const ideas: TripIdea[] = ideaRows.map((i) => ({
    country: i.country,
    network: i.network.length,
    people: i.people,
    friends: i.network
      .slice(0, 3)
      .map((id) => faceById.get(id))
      .filter((x): x is Person => !!x),
  }));

  return { friendPlaces, networkPlaces, people: topPeople, ideas, dreams: circle.dreams };
}

/** The rows for a country's or town's page: circles first, then everyone you can see. */
export function networkRows(travellers: Traveller[], viewerHome: string | null, countryCode: string, now = new Date()): Row[] {
  const homeName = countryByCode(viewerHome)?.name ?? null;
  const toPerson = (t: Traveller): RowPerson => {
    const s = t.stays[0];
    const more = t.stays.length > 1 ? ` · +${t.stays.length - 1} more` : "";
    return {
      id: t.id,
      username: t.username,
      display_name: t.display_name,
      avatar_url: t.avatar_url,
      following: t.following,
      line: s ? `${s.kind === "lived" ? "Lived here" : s.name} · ${s.when}${more}` : "",
      href: `/u/${t.username}/countries/${countryCode.toLowerCase()}`,
    };
  };
  const sorted = [...travellers].sort(byCloseness);
  const rows: Row[] = groupTravellers(sorted, viewerHome, now).map((g) => ({ key: g.key, label: groupLabel(g.key, g.people.length, homeName), people: g.people.map(toPerson) }));
  if (sorted.length) rows.push({ key: "all", label: `Everyone you can see who's been here (${sorted.length})`, people: sorted.map(toPerson) });
  return rows;
}
