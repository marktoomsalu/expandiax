import type { createClient } from "@/lib/supabase/server";
import { loadMyCollabs } from "@/lib/collab";
import { signMedia } from "@/lib/signedMedia";
import type { CountryCity, CountryMedia, CountryVisit, Event, EventMedia } from "@/lib/types";

// Someone's part in others' posts (migration 075), loaded as their own
// lists are, so shared trips and events can join their Countries, Events,
// profile and stats. Each says whose it is and whether they may edit it.

type Supabase = ReturnType<typeof createClient>;

export type CollabMark = { ownerId: string; ownerName: string; canEdit: boolean; collabId: string };
export type CollabEvent = Event & { event_media: EventMedia[]; collab: CollabMark };
export type CollabTrip = CountryVisit & {
  visited_countries: { id: string; user_id: string; country_code: string; country_name: string; created_at: string; cover_media_id: string | null };
  country_media: CountryMedia[];
  country_cities: CountryCity[];
  collab: CollabMark;
};

async function ownerNames(supabase: Supabase, ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const { data } = await supabase.from("profiles").select("id, display_name").in("id", [...new Set(ids)]);
  return new Map((data ?? []).map((p) => [p.id as string, p.display_name as string]));
}

/** The events someone has accepted to share (whichever of them the viewer may see). */
export async function collabEventsOf(supabase: Supabase, userId: string): Promise<CollabEvent[]> {
  const mine = (await loadMyCollabs(supabase, userId)).filter((c) => c.kind === "event");
  if (!mine.length) return [];
  const [{ data }, names] = await Promise.all([
    supabase.from("events").select("*, event_media!event_media_event_id_fkey(*)").in("id", mine.map((c) => c.target_id)).then((r) => signMedia(r)),
    ownerNames(supabase, mine.map((c) => c.owner_id)),
  ]);
  const byTarget = new Map(mine.map((c) => [c.target_id, c]));
  return ((data ?? []) as (Event & { event_media: EventMedia[] })[]).map((e) => {
    const c = byTarget.get(e.id)!;
    return { ...e, collab: { ownerId: c.owner_id, ownerName: names.get(c.owner_id) ?? "", canEdit: c.can_edit, collabId: c.id } };
  });
}

/** The trips someone has accepted to share, optionally in one country (whichever the viewer may see). */
export async function collabTripsOf(supabase: Supabase, userId: string, countryCode?: string): Promise<CollabTrip[]> {
  const mine = (await loadMyCollabs(supabase, userId)).filter((c) => c.kind === "trip");
  if (!mine.length) return [];
  let q = supabase
    .from("country_visits")
    .select(
      "*, visited_countries!inner(id, user_id, country_code, country_name, created_at, cover_media_id), country_media!country_media_country_visit_id_fkey(*), country_cities(*)"
    )
    .in("id", mine.map((c) => c.target_id));
  if (countryCode) q = q.eq("visited_countries.country_code", countryCode.toUpperCase());
  const [{ data }, names] = await Promise.all([q.then((r) => signMedia(r)), ownerNames(supabase, mine.map((c) => c.owner_id))]);
  const byTarget = new Map(mine.map((c) => [c.target_id, c]));
  return ((data ?? []) as Omit<CollabTrip, "collab">[]).map((v) => {
    const c = byTarget.get(v.id)!;
    return { ...v, collab: { ownerId: c.owner_id, ownerName: names.get(c.owner_id) ?? "", canEdit: c.can_edit, collabId: c.id } };
  });
}
