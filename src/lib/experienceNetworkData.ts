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

async function viewerCircle(supabase: Supabase, viewerId: string | null) {
  if (!viewerId) return { following: new Set<string>(), home: null as string | null, dreams: [] as DreamPlace[] };
  const [{ data: f }, { data: me }, { data: dreams }] = await Promise.all([
    supabase.from("follows").select("followee_id").eq("follower_id", viewerId),
    supabase.from("profiles").select("home_country_code").eq("id", viewerId).single(),
    supabase.from("want_to_go").select("country_code, place_name").order("created_at", { ascending: false }),
  ]);
  return { following: new Set((f ?? []).map((r) => r.followee_id)), home: me?.home_country_code ?? null, dreams: (dreams ?? []) as DreamPlace[] };
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

export type PlaceCard = PlaceForYou & { faces: Person[]; photo: string | null };
export type Interest = { country: string; town: string | null; why: "dream" | "network"; people: number; places: number; events: number; photo: string | null };
export type PersonCard = Person & { visibility: ProfileVisibility; headline: Reason | null; reasons: Reason[] };
export type NetworkHome = { interest: Interest | null; places: PlaceCard[]; people: PersonCard[]; dreams: DreamPlace[] };

export async function loadNetworkHome(supabase: Supabase, viewerId: string): Promise<NetworkHome> {
  const circle = await viewerCircle(supabase, viewerId);
  const [{ data: townRows }, { data: countryRows }, { data: liveData }, { data: blocked }] = await Promise.all([
    supabase
      .from("country_cities")
      .select("id, city_name, lat, lng, visited_countries!inner(user_id, country_code, is_public), country_visits(kind)")
      .limit(5000),
    supabase.from("visited_countries").select("user_id, country_code").limit(5000),
    supabase.from("events").select("id, user_id, event_type, title, spotify_artist_name, spotify_artist_image, event_date").in("event_type", [...LIVE_TYPES]).limit(3000),
    supabase.from("blocks").select("blocked_id").eq("blocker_id", viewerId),
  ]);
  const blockedIds = new Set((blocked ?? []).map((b) => b.blocked_id));

  type Raw = { id: string; city_name: string; lat: number | null; lng: number | null; visited_countries: unknown; country_visits: unknown };
  const one = <T,>(x: unknown) => (Array.isArray(x) ? x[0] : x) as T | undefined;
  const towns: (TownRow & { lived: boolean })[] = [];
  for (const r of (townRows ?? []) as Raw[]) {
    const vc = one<{ user_id: string; country_code: string; is_public: boolean }>(r.visited_countries);
    if (!vc || blockedIds.has(vc.user_id) || (!vc.is_public && vc.user_id !== viewerId)) continue;
    towns.push({ userId: vc.user_id, country: vc.country_code, town: r.city_name, lat: r.lat, lng: r.lng, cityId: r.id, lived: one<{ kind: string }>(r.country_visits)?.kind === "lived" });
  }

  const dreamCountries = new Set(circle.dreams.map((w) => w.country_code));
  const dreamTowns = new Set(circle.dreams.filter((w) => w.place_name).map((w) => `${w.country_code}:${placeKey(w.place_name)}`));
  const places = placesForYou(towns, { id: viewerId, following: circle.following, dreamCountries, dreamTowns }, 10);

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
    people.push({ id: p.id, username: p.username, display_name: p.display_name, avatar_url: p.avatar_url, visibility: p.visibility as ProfileVisibility, headline: reasons[0] ?? null, reasons: reasons.slice(1), score });
  }
  people.sort((a, b) => b.score - a.score);

  // ---- Faces and photos for the place cards
  const faceIds = [...new Set(places.flatMap((p) => (p.network.length ? p.network : p.people).slice(0, 3)))];
  const cityIds = places.flatMap((p) => p.cityIds.slice(0, 20));
  const [{ data: faces }, { data: photos }] = await Promise.all([
    faceIds.length ? supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", faceIds) : Promise.resolve({ data: [] as Person[] }),
    cityIds.length
      ? signMedia(await supabase.from("country_media").select("city_id, public_url").in("city_id", cityIds).eq("media_type", "image").limit(200))
      : Promise.resolve({ data: [] as { city_id: string; public_url: string }[] }),
  ]);
  const faceById = new Map((faces ?? []).map((f) => [f.id, f as Person]));
  const photoByCity = new Map<string, string>();
  for (const m of (photos ?? []) as { city_id: string; public_url: string }[]) if (!photoByCity.has(m.city_id)) photoByCity.set(m.city_id, m.public_url);
  const cards: PlaceCard[] = places.map((p) => ({
    ...p,
    faces: (p.network.length ? p.network : p.people)
      .slice(0, 3)
      .map((id) => faceById.get(id))
      .filter((x): x is Person => !!x),
    photo: p.cityIds.map((id) => photoByCity.get(id)).find(Boolean) ?? null,
  }));

  // ---- The place to start: somewhere you dream of, else your network's favourite
  let interest: Interest | null = null;
  const dreamFirst = circle.dreams[0];
  const pick = dreamFirst
    ? { country: dreamFirst.country_code, town: dreamFirst.place_name || cards.find((c) => c.country === dreamFirst.country_code)?.name || null, why: "dream" as const }
    : cards[0]
      ? { country: cards[0].country, town: cards[0].name, why: "network" as const }
      : null;
  if (pick) {
    const [counts, { count: events }] = await Promise.all([
      travellerCounts(supabase, pick.country),
      supabase.from("events").select("id", { count: "exact", head: true }).eq("country_code", pick.country),
    ]);
    const townCount = pick.town ? counts.towns.get(placeKey(pick.town))?.n : undefined;
    interest = {
      ...pick,
      people: townCount ?? counts.total,
      places: counts.towns.size,
      events: events ?? 0,
      photo: cards.find((c) => c.country === pick.country && pick.town && placeKey(c.name) === placeKey(pick.town))?.photo ?? null,
    };
  }

  people.length = Math.min(people.length, 8);
  return { interest, places: cards, people, dreams: circle.dreams };
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
