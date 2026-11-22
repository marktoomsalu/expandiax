// A new member's world, for their welcome card in the feed: every country,
// trip and event the viewer is allowed to see (read with the viewer's
// session, so their privacy choices decide it: a private profile, an
// "Only me" trip or event, a "Friends" one for someone who isn't). Not just
// what went to the feed: their whole start.

import type { createClient } from "@/lib/supabase/server";
import { signMedia } from "@/lib/signedMedia";

type Supabase = ReturnType<typeof createClient>;

export type WelcomeEvent = { title: string; type: string; date: string; endDate: string | null; venue: string | null; city: string | null; code: string | null };

export type WelcomeWorld = {
  countries: string[];
  homeCode: string | null;
  trips: number;
  events: WelcomeEvent[];
  eventCount: number;
  /** Their newest memory's picture (their photo, or the artist's): the card's star when they started with a memory. */
  memoryPhoto: string | null;
};

export async function loadWelcomeWorlds(supabase: Supabase, actorIds: string[]): Promise<Map<string, WelcomeWorld>> {
  const out = new Map<string, WelcomeWorld>();
  if (!actorIds.length) return out;
  const [{ data: profiles }, { data: countries }, { data: trips }, { data: events }] = await Promise.all([
    supabase.from("profiles").select("id, home_country_code").in("id", actorIds),
    supabase.from("visited_countries").select("user_id, country_code, created_at").in("user_id", actorIds).order("created_at"),
    supabase.from("country_visits").select("id, visited_countries!inner(user_id)").in("visited_countries.user_id", actorIds),
    supabase.from("events").select("*").in("user_id", actorIds).order("event_date", { ascending: false }).limit(400),
  ]);
  // The newest memory's picture, for those who start with one.
  const newest = new Map<string, { id: string; cover: string | null; artist: string | null }>();
  for (const e of events ?? []) if (!newest.has(e.user_id as string)) newest.set(e.user_id as string, { id: e.id as string, cover: (e.cover_media_id as string) ?? null, artist: (e.spotify_artist_image as string) || null });
  const ids = [...newest.values()].map((v) => v.id);
  const { data: media } = ids.length
    ? await supabase.from("event_media").select("id, event_id, public_url, media_type, display_order").in("event_id", ids).eq("media_type", "image").order("display_order")
    : { data: [] };
  const photos = await signMedia(
    Object.fromEntries(
      [...newest.entries()].map(([user, v]) => {
        const mine = (media ?? []).filter((m) => m.event_id === v.id);
        const pick = mine.find((m) => m.id === v.cover) ?? mine[0];
        return [user, { public_url: (pick?.public_url as string) ?? null, artist: v.artist }];
      })
    )
  ).catch(() => ({}) as Record<string, { public_url: string | null; artist: string | null }>);

  for (const id of actorIds) {
    const home = (profiles ?? []).find((p) => p.id === id)?.home_country_code ?? null;
    const codes = (countries ?? []).filter((c) => c.user_id === id).map((c) => c.country_code as string);
    // Home first, then in the order they were added.
    const ordered = home && codes.includes(home) ? [home, ...codes.filter((c) => c !== home)] : codes;
    const mine = (events ?? []).filter((e) => e.user_id === id);
    out.set(id, {
      countries: ordered,
      homeCode: home,
      trips: (trips ?? []).filter((t) => (t.visited_countries as unknown as { user_id: string }).user_id === id).length,
      events: mine.slice(0, 3).map((e) => ({
        title: e.title as string,
        type: e.event_type as string,
        date: e.event_date as string,
        endDate: (e.end_date as string) || null,
        venue: (e.venue as string) || null,
        city: (e.city as string) || null,
        code: (e.country_code as string) || null,
      })),
      eventCount: mine.length,
      memoryPhoto: photos[id]?.public_url ?? photos[id]?.artist ?? null,
    });
  }
  return out;
}
