// Reading someone's own year for Wrapped (their session: only their own).

import type { createClient } from "@/lib/supabase/server";
import { countryByCode } from "@/lib/countries";
import { signMedia } from "@/lib/signedMedia";
import { buildWrapped, type WrappedEventRow, type WrappedPhoto, type WrappedVisit, type WrappedYear } from "@/lib/wrapped";

type Supabase = ReturnType<typeof createClient>;

export async function loadWrapped(supabase: Supabase, userId: string, year: number): Promise<WrappedYear> {
  const [{ data: profile }, { data: countries }, { data: events }] = await Promise.all([
    supabase.from("profiles").select("display_name, username, home_country_code").eq("id", userId).maybeSingle(),
    supabase.from("visited_countries").select("id, country_code, country_visits(id, year, visited_from, visited_to, date_precision, kind)").eq("user_id", userId),
    supabase.from("events").select("*").eq("user_id", userId),
  ]);
  const countryIds = (countries ?? []).map((c) => c.id as string);
  const eventIds = (events ?? []).map((e) => e.id as string);
  const [{ data: cities }, { data: tripMedia }, { data: eventMedia }] = await Promise.all([
    countryIds.length ? supabase.from("country_cities").select("country_visit_id, city_name, lat, lng").in("visited_country_id", countryIds) : Promise.resolve({ data: [] }),
    countryIds.length
      ? supabase.from("country_media").select("id, public_url, country_visit_id, taken_at, visited_country_id, display_order").in("visited_country_id", countryIds).eq("media_type", "image")
      : Promise.resolve({ data: [] }),
    eventIds.length ? supabase.from("event_media").select("id, public_url, event_id, taken_at, display_order").in("event_id", eventIds).eq("media_type", "image") : Promise.resolve({ data: [] }),
  ]);

  const codeOfCountry = new Map((countries ?? []).map((c) => [c.id as string, c.country_code as string]));
  const visits: WrappedVisit[] = [];
  const undatedCodes: string[] = [];
  for (const c of countries ?? []) {
    const vs = (c.country_visits ?? []) as { id: string; year: number; visited_from: string | null; visited_to: string | null; date_precision: string | null; kind: string | null }[];
    if (!vs.length) undatedCodes.push(c.country_code as string);
    for (const v of vs) {
      visits.push({
        id: v.id,
        code: c.country_code as string,
        year: v.year,
        from: v.visited_from,
        to: v.visited_to,
        precision: v.date_precision ?? (v.visited_from ? "day" : "year"),
        kind: v.kind ?? "trip",
        places: (cities ?? [])
          .filter((p) => p.country_visit_id === v.id)
          .map((p) => ({ name: p.city_name as string, lat: (p.lat as number) ?? null, lng: (p.lng as number) ?? null })),
      });
    }
  }

  // Each event's picture: its own first photo, or the artist's.
  const firstPhoto = new Map<string, string>();
  for (const m of [...(eventMedia ?? [])].sort((a, b) => (a.display_order as number) - (b.display_order as number))) {
    if (!firstPhoto.has(m.event_id as string)) firstPhoto.set(m.event_id as string, m.public_url as string);
  }
  const eventRows: WrappedEventRow[] = (events ?? []).map((e) => ({
    id: e.id as string,
    title: (e.title as string) || "A day to remember",
    type: (e.event_type as string) ?? "other",
    date: e.event_date as string,
    endDate: (e.end_date as string) || null,
    venue: (e.venue as string) || null,
    city: (e.city as string) || null,
    code: (e.country_code as string) || null,
    photo: firstPhoto.get(e.id as string) ?? ((e.spotify_artist_image as string) || null),
  }));
  const eventTitle = new Map(eventRows.map((e) => [e.id, e]));

  const photos: (WrappedPhoto & { visitId?: string | null; eventId?: string | null })[] = [
    ...(tripMedia ?? []).map((m) => {
      const code = codeOfCountry.get(m.visited_country_id as string) ?? null;
      return {
        id: m.id as string,
        url: m.public_url as string,
        takenAt: (m.taken_at as string) ?? null,
        label: (code && countryByCode(code)?.name) || "",
        code,
        visitId: (m.country_visit_id as string) ?? null,
      };
    }),
    ...(eventMedia ?? []).map((m) => {
      const ev = eventTitle.get(m.event_id as string);
      return { id: m.id as string, url: m.public_url as string, takenAt: (m.taken_at as string) ?? ev?.date ?? null, label: ev?.title ?? "", code: ev?.code ?? null, eventId: m.event_id as string };
    }),
  ];

  const name = ((profile?.display_name as string) || (profile?.username as string) || "").trim().split(" ")[0];
  const built = buildWrapped({ year, firstName: name, homeCode: (profile?.home_country_code as string) ?? null, visits, undatedCodes, events: eventRows, photos });
  // Memory photos are private: signed links, for this viewing only.
  return signMedia(built);
}
