// "Find my world": what someone kept from their photo scan, and saving it.
//
// Before there's an account it waits on the phone (localStorage, so it
// survives the app closing during sign-up and email confirmation) and is
// written once there's a session (FlushOnboardingDraft). Members save it
// straight away. Nothing is sent before then.

import { createClient } from "@/lib/supabase/client";
import { countryByCode } from "@/lib/countries";
import { enqueueUploads, getUploads } from "@/lib/uploadQueue";
import { photoFile } from "@/lib/photoScan";
import { daysBetween } from "@/lib/tripFinder";

export type KeptTrip = {
  code: string;
  from: string;
  to: string;
  kind: "trip" | "lived";
  /** Photo library ids, best first; the first becomes the trip's cover. */
  covers: string[];
};

export type KeptWorld = { homeCode: string | null; trips: KeptTrip[] };

const KEY = "expandiax:world-scan";
const KEEP_DAYS = 14;

/** How many of each kept trip's best photos go up with it. */
export const PHOTOS_PER_TRIP = 3;

export function saveKeptWorld(world: KeptWorld) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, savedAt: Date.now(), ...world }));
  } catch {
    // Full or blocked storage: the map still shows, it just can't wait for sign-up.
  }
}

export function loadKeptWorld(): KeptWorld | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as KeptWorld & { v: number; savedAt: number };
    if (data.v !== 1 || Date.now() - data.savedAt > KEEP_DAYS * 86_400_000) {
      localStorage.removeItem(KEY);
      return null;
    }
    return { homeCode: data.homeCode ?? null, trips: Array.isArray(data.trips) ? data.trips : [] };
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

/** The countries a kept world puts on the map: home first, then each trip's. */
export function keptCountries(world: KeptWorld): string[] {
  const codes = [...(world.homeCode ? [world.homeCode] : []), ...world.trips.map((t) => t.code)];
  return [...new Set(codes)].filter((c) => !!countryByCode(c));
}

type ExistingVisit = { visited_country_id: string; year: number; visited_from: string | null; visited_to: string | null };

/** Whether a found trip is one already saved (same country, overlapping dates or the same year with no dates). */
export function alreadySaved(trip: KeptTrip, visits: ExistingVisit[]): boolean {
  return visits.some((v) => {
    if (v.visited_from) {
      const to = v.visited_to ?? v.visited_from;
      return v.visited_from <= trip.to && to >= trip.from;
    }
    return v.year === Number(trip.from.slice(0, 4));
  });
}

/**
 * Writes a kept world for real: the countries (home saved as home if none
 * yet), a trip for each kept trip not already there, and each trip's best
 * photos through the upload queue (in the background, survives closing).
 * Only the newest trip goes to followers' feeds; the rest of the past fills
 * the map and profile without a burst of posts.
 */
export async function saveWorld(userId: string, world: KeptWorld): Promise<{ countries: number; trips: number }> {
  const supabase = createClient();
  const codes = keptCountries(world);
  if (!codes.length) return { countries: 0, trips: 0 };

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
    if (!error && visit) created.push({ trip, countryId, visitId: visit.id as string });
  }

  // The photos follow in the background, newest trips first (what people
  // open first), a few at a time so the phone's memory isn't filled.
  void uploadTripPhotos(userId, [...created].reverse());

  return { countries: codes.filter((c) => !had.has(c)).length, trips: created.length };
}

const MAX_WAITING_UPLOADS = 6;

async function uploadTripPhotos(userId: string, list: { trip: KeptTrip; countryId: string; visitId: string }[]) {
  for (const { trip, countryId, visitId } of list) {
    while (getUploads().filter((j) => j.status !== "done" && j.status !== "failed").length >= MAX_WAITING_UPLOADS) {
      await new Promise((r) => setTimeout(r, 700));
    }
    const photos: File[] = [];
    for (const id of trip.covers.slice(0, PHOTOS_PER_TRIP)) {
      const file = await photoFile(id, 2048);
      if (file) photos.push(file);
    }
    if (!photos.length) continue;
    enqueueUploads(
      photos.map((file, i) => ({
        file,
        kind: "image" as const,
        target: {
          userId,
          scope: "countries" as const,
          parentId: visitId,
          table: "country_media" as const,
          fields: { visited_country_id: countryId, country_visit_id: visitId },
          displayOrder: i,
          cover: i === 0 ? { table: "country_visits" as const, id: visitId } : undefined,
        },
      }))
    );
  }
}
