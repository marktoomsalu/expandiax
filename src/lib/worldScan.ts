// "Find my world": what someone kept from their photo scan, and saving it.
//
// Before there's an account it waits on the phone (localStorage, so it
// survives the app closing during sign-up and email confirmation) and is
// written once there's a session (FlushOnboardingDraft). Members save it
// straight away. Nothing is sent before then.

import { createClient } from "@/lib/supabase/client";
import { countryByCode } from "@/lib/countries";
import { daysBetween } from "@/lib/tripFinder";
import { sameVenue } from "@/lib/eventMatch";
import { placeKey } from "@/lib/photoPlaces";
import { savePlaces } from "@/components/PhotoPlaceSuggestion";
import type { EventType } from "@/lib/types";
import { alreadySaved, keptCountries, type ExistingVisit } from "@/lib/worldNews";

export { alreadySaved, keptCountries } from "@/lib/worldNews";

export type KeptTrip = {
  code: string;
  from: string;
  to: string;
  kind: "trip" | "lived";
  /** Photo library ids, best first; the first becomes the trip's cover. */
  covers: string[];
  /** Its towns, with their days, saved as the trip's places. */
  towns?: { name: string; lat: number; lng: number; arrived: string | null; departed: string | null }[];
};

export type KeptEvent = {
  type: EventType;
  title: string;
  artist: string | null;
  venue: string | null;
  city: string | null;
  code: string;
  date: string;
  covers: string[];
};

export type KeptWorld = {
  homeCode: string | null;
  trips: KeptTrip[];
  /** Countries added by hand (no trips behind them). */
  countries?: string[];
  events?: KeptEvent[];
};

const KEY = "expandiax:world-scan";
const KEEP_DAYS = 14;

export function saveKeptWorld(world: KeptWorld) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 2, savedAt: Date.now(), ...world }));
  } catch {
    // Full or blocked storage: the map still shows, it just can't wait for sign-up.
  }
}

export function loadKeptWorld(): KeptWorld | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as KeptWorld & { v: number; savedAt: number };
    if ((data.v !== 1 && data.v !== 2) || Date.now() - data.savedAt > KEEP_DAYS * 86_400_000) {
      localStorage.removeItem(KEY);
      return null;
    }
    return {
      homeCode: data.homeCode ?? null,
      trips: Array.isArray(data.trips) ? data.trips : [],
      countries: Array.isArray(data.countries) ? data.countries : [],
      events: Array.isArray(data.events) ? data.events : [],
    };
  } catch {
    return null;
  }
}

export function clearKeptWorld() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing to do
  }
}

const SCANNED_KEY = "expandiax:world-scanned";

/** A member has been through "Find my world" on this phone (its card on My World goes away). */
export function markWorldScanned() {
  try {
    localStorage.setItem(SCANNED_KEY, String(Date.now()));
  } catch {
    // nothing to do
  }
}

export function worldScanned(): boolean {
  try {
    return !!localStorage.getItem(SCANNED_KEY);
  } catch {
    return false;
  }
}



/**
 * Writes a kept world for real: the countries (home saved as home if none
 * yet), a trip for each kept trip not already there (with its towns as its
 * places), and the events kept. No photos: people add their own later.
 * Only the newest trip goes to followers' feeds; the rest of the past fills
 * the map and profile without a burst of posts.
 */
export async function saveWorld(userId: string, world: KeptWorld): Promise<{ countries: number; trips: number; events: number }> {
  const supabase = createClient();
  const codes = keptCountries(world);
  if (!codes.length) return { countries: 0, trips: 0, events: 0 };

  const { data: before } = await supabase.from("visited_countries").select("country_code").eq("user_id", userId).in("country_code", codes);
  const had = new Set((before ?? []).map((r) => r.country_code as string));
  const rows = codes.map((code) => ({ user_id: userId, country_code: code, country_name: countryByCode(code)!.name }));
  await supabase.from("visited_countries").upsert(rows, { onConflict: "user_id,country_code", ignoreDuplicates: true });
  if (world.homeCode) {
    await supabase.from("profiles").update({ home_country_code: world.homeCode }).eq("id", userId).is("home_country_code", null);
  }

  const { data: countries } = await supabase.from("visited_countries").select("id, country_code").eq("user_id", userId).in("country_code", codes);
  const idOf = new Map((countries ?? []).map((c) => [c.country_code as string, c.id as string]));
  const ids = [...idOf.values()];
  const { data: existing } = ids.length
    ? await supabase.from("country_visits").select("visited_country_id, year, visited_from, visited_to").in("visited_country_id", ids)
    : { data: [] as ExistingVisit[] };

  const newest = [...world.trips].sort((a, b) => b.from.localeCompare(a.from))[0];
  const created: { trip: KeptTrip; countryId: string; visitId: string }[] = [];
  // Oldest first, so trips are created in the order they happened.
  for (const trip of [...world.trips].sort((a, b) => a.from.localeCompare(b.from))) {
    const countryId = idOf.get(trip.code);
    if (!countryId) continue;
    if (alreadySaved(trip, (existing ?? []).filter((v) => v.visited_country_id === countryId))) continue;

    const { data: visit, error } = await supabase
      .from("country_visits")
      .insert({
        visited_country_id: countryId,
        year: Number(trip.from.slice(0, 4)),
        visited_from: trip.from,
        visited_to: trip.to,
        date_precision: "day",
        kind: daysBetween(trip.from, trip.to) >= 60 ? "lived" : trip.kind,
        show_in_feed: trip === newest,
      })
      .select("id")
      .single();
    if (error || !visit) continue;
    created.push({ trip, countryId, visitId: visit.id as string });
    // Its towns, with their days, as the trip's places.
    if (trip.towns?.length) {
      await savePlaces(supabase, {
        visitedCountryId: countryId,
        visitId: visit.id as string,
        places: [...trip.towns]
          .sort((a, b) => (a.arrived ?? "").localeCompare(b.arrived ?? ""))
          .map((t) => ({ key: placeKey(t.name), name: t.name, lat: t.lat, lng: t.lng, arrived: t.arrived, departed: t.departed })),
      }).catch(() => {});
    }
  }

  const events = await saveEvents(userId, world.events ?? []);

  // No photos are chosen for anyone: their own go up when they add them
  // (Chapter One's "Your first trip"), from each trip's own days.

  return { countries: codes.filter((c) => !had.has(c)).length, trips: created.length, events: events.length };
}

/** Events found in photos, unless one's already there (same day, same venue or name). Only the newest goes to feeds. */
async function saveEvents(userId: string, list: KeptEvent[]): Promise<{ id: string; event: KeptEvent }[]> {
  if (!list.length) return [];
  const supabase = createClient();
  const dates = [...new Set(list.map((e) => e.date))];
  const { data: existing } = await supabase.from("events").select("event_date, title, venue").eq("user_id", userId).in("event_date", dates);
  const newest = [...list].sort((a, b) => b.date.localeCompare(a.date))[0];
  const out: { id: string; event: KeptEvent }[] = [];
  for (const e of [...list].sort((a, b) => a.date.localeCompare(b.date))) {
    const country = countryByCode(e.code);
    if (!country) continue;
    const twin = (existing ?? []).some(
      (x) => x.event_date === e.date && ((e.venue && x.venue && sameVenue(x.venue as string, e.venue)) || (x.title as string).toLowerCase() === e.title.toLowerCase())
    );
    if (twin) continue;
    const { data, error } = await supabase
      .from("events")
      .insert({
        user_id: userId,
        title: e.title.slice(0, 120),
        event_date: e.date,
        event_type: e.type,
        venue: (e.venue ?? "").slice(0, 120),
        city: (e.city ?? "").slice(0, 120),
        country_code: country.code,
        country_name: country.name,
        share_to_feed: e === newest,
        ...(e.artist ? { spotify_artist_name: e.artist } : {}),
      })
      .select("id")
      .single();
    if (!error && data) out.push({ id: data.id as string, event: e });
  }
  return out;
}
