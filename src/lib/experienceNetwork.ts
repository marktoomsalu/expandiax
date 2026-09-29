// The experience network: who has been where, seen from where you stand —
// people you follow first, then people from your country, people who lived
// there, people who were there lately. Pure functions, fed by rows the
// viewer's own session could read (so the database's privacy rules have
// already decided who's in them).

import { placeKey } from "@/lib/photoPlaces";

export type Person = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

export type Stay = {
  id: string;
  name: string; // "Around Norway"
  kind: "trip" | "lived";
  when: string; // "24 – 27 Apr 2025"
  lastDay: string; // yyyy-mm-dd, for "lately"
  places: string[];
};

export type Traveller = Person & {
  home: string | null;
  following: boolean;
  stays: Stay[]; // latest first
};

export type Group = { key: "network" | "home" | "lived" | "recent"; people: Traveller[] };

/**
 * LinkedIn-style rows for a place: people you follow, people from your own
 * country, people who lived there, people who were there in the last year.
 * Empty rows are left out.
 */
export function groupTravellers(ts: Traveller[], viewerHome: string | null, now = new Date()): Group[] {
  const yearAgo = new Date(now.getTime() - 365 * 86_400_000).toISOString().slice(0, 10);
  const groups: Group[] = [
    { key: "network", people: ts.filter((t) => t.following) },
    { key: "home", people: viewerHome ? ts.filter((t) => t.home === viewerHome) : [] },
    { key: "lived", people: ts.filter((t) => t.stays.some((s) => s.kind === "lived")) },
    { key: "recent", people: ts.filter((t) => t.stays.some((s) => s.lastDay >= yearAgo)) },
  ];
  return groups.filter((g) => g.people.length > 0);
}

/** The towns people went to, busiest first: [name, people]. */
export function townsOf(ts: Traveller[]): { name: string; people: Traveller[] }[] {
  const towns = new Map<string, { name: string; people: Traveller[] }>();
  for (const t of ts) {
    const seen = new Set<string>();
    for (const s of t.stays) {
      for (const p of s.places) {
        const k = placeKey(p);
        if (!k || seen.has(k)) continue;
        seen.add(k);
        const e = towns.get(k) ?? towns.set(k, { name: p.trim(), people: [] }).get(k)!;
        e.people.push(t);
      }
    }
  }
  return [...towns.values()].sort((a, b) => b.people.length - a.people.length || a.name.localeCompare(b.name));
}

/** Who to show first in a list: people you follow, then people who lived there, then the most recent. */
export function byCloseness(a: Traveller, b: Traveller): number {
  const lived = (t: Traveller) => t.stays.some((s) => s.kind === "lived");
  const last = (t: Traveller) => t.stays[0]?.lastDay ?? "";
  return Number(b.following) - Number(a.following) || Number(lived(b)) - Number(lived(a)) || last(b).localeCompare(last(a));
}

// ---------- Places for you ----------

export type TownRow = { userId: string; country: string; town: string; lat: number | null; lng: number | null; cityId: string };

export type PlaceForYou = {
  key: string; // country + town
  country: string;
  name: string;
  lat: number | null;
  lng: number | null;
  network: string[]; // people you follow who've been
  people: string[]; // everyone you can see who's been
  cityIds: string[];
};

/**
 * Towns worth a look: where people you follow have been, then where many
 * people have — and a boost for countries and towns you dream of. Towns you've been to yourself are left out.
 */
export function placesForYou(
  rows: TownRow[],
  viewer: { id: string; following: Set<string>; dreamCountries: Set<string>; dreamTowns: Set<string> },
  limit = 10
): PlaceForYou[] {
  const mine = new Set(rows.filter((r) => r.userId === viewer.id).map((r) => `${r.country}:${placeKey(r.town)}`));
  const places = new Map<string, PlaceForYou>();
  for (const r of rows) {
    if (r.userId === viewer.id) continue;
    const key = `${r.country}:${placeKey(r.town)}`;
    if (!placeKey(r.town) || mine.has(key)) continue;
    const p = places.get(key) ?? places.set(key, { key, country: r.country, name: r.town.trim(), lat: null, lng: null, network: [], people: [], cityIds: [] }).get(key)!;
    if (!p.people.includes(r.userId)) p.people.push(r.userId);
    if (viewer.following.has(r.userId) && !p.network.includes(r.userId)) p.network.push(r.userId);
    p.cityIds.push(r.cityId);
    if (p.lat == null && r.lat != null && r.lng != null) {
      p.lat = r.lat;
      p.lng = r.lng;
    }
  }
  const score = (p: PlaceForYou) =>
    p.network.length * 3 + p.people.length + (viewer.dreamTowns.has(p.key) ? 8 : 0) + (viewer.dreamCountries.has(p.country) ? 4 : 0);
  return [...places.values()].sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name)).slice(0, limit);
}

// ---------- People you may want to meet ----------

export type Reason = { icon: "home" | "globe" | "pin" | "flag" | "ticket"; text: string };

export type MeetFacts = {
  countries: number;
  home: string | null; // their home country's name, if it's the same as yours
  livedIn: string | null; // a town they lived in — in a country you're interested in, if any
  sharedTowns: number;
  sharedLive: string | null; // an artist or event you both went to
};

/** Up to three short reasons to meet someone, the strongest first. */
export function meetReasons(f: MeetFacts): Reason[] {
  const out: Reason[] = [];
  if (f.livedIn) out.push({ icon: "home", text: `Lived in ${f.livedIn}` });
  if (f.sharedLive) out.push({ icon: "ticket", text: `Also saw ${f.sharedLive}` });
  if (f.sharedTowns > 0) out.push({ icon: "pin", text: `${f.sharedTowns} shared ${f.sharedTowns === 1 ? "place" : "places"}` });
  if (f.home) out.push({ icon: "flag", text: `Also from ${f.home}` });
  if (f.countries > 0) out.push({ icon: "globe", text: `Visited ${f.countries} ${f.countries === 1 ? "country" : "countries"}` });
  return out.slice(0, 3);
}

/** How much two people have in common, for ordering suggestions. */
export function meetScore(f: MeetFacts, livedInWanted: boolean): number {
  return f.sharedTowns * 2 + (f.sharedLive ? 3 : 0) + (f.home ? 1 : 0) + (f.livedIn ? (livedInWanted ? 4 : 1) : 0) + Math.min(f.countries, 30) / 10;
}

/** "3 people you follow have been here" — the row titles. */
export function groupLabel(key: Group["key"], n: number, homeName: string | null): string {
  const people = n === 1 ? "person" : "people";
  switch (key) {
    case "network":
      return `${n} ${people} you follow ${n === 1 ? "has" : "have"} been here`;
    case "home":
      return `${n} from ${homeName ?? "your country"} ${n === 1 ? "has" : "have"} been here`;
    case "lived":
      return `${n} lived here - they know it like locals`;
    case "recent":
      return `${n} ${n === 1 ? "was" : "were"} here in the last 12 months`;
  }
}
