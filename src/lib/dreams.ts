import type { createClient } from "@/lib/supabase/server";
import { liveKey, liveName, slugify, type LiveRow } from "@/lib/explore";
import { travellerCounts, type DreamPlace } from "@/lib/experienceNetworkData";
import { upcomingConfigured, upcomingShows, type UpcomingShow } from "@/lib/concerts";
import type { Person } from "@/lib/experienceNetwork";
import type { EventType } from "@/lib/types";

// Your dreams — places and events you'd love to go to — and, for each, who
// you follow has already been (read through your own session, so only
// trips and events you're allowed to see count), plus how many travellers
// have been in all (a number, never who).

type Supabase = ReturnType<typeof createClient>;

export type DreamPlaceCard = DreamPlace & { friends: Person[]; travellers: number };
export type DreamEvent = { id: string; name: string; event_type: EventType; image: string | null };
export type DreamEventCard = DreamEvent & { friends: Person[]; next: UpcomingShow | null };

async function followees(supabase: Supabase, viewerId: string): Promise<string[]> {
  const { data } = await supabase.from("follows").select("followee_id").eq("follower_id", viewerId);
  return (data ?? []).map((r) => r.followee_id);
}

async function faces(supabase: Supabase, ids: string[]): Promise<Map<string, Person>> {
  if (!ids.length) return new Map();
  const { data } = await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", ids);
  return new Map((data ?? []).map((p) => [p.id, p as Person]));
}

export async function loadDreamPlaces(supabase: Supabase, viewerId: string): Promise<DreamPlaceCard[]> {
  const [{ data }, following] = await Promise.all([
    supabase.from("want_to_go").select("country_code, place_name").order("created_at", { ascending: false }),
    followees(supabase, viewerId),
  ]);
  const dreams = (data ?? []) as DreamPlace[];
  if (!dreams.length) return [];
  const countries = [...new Set(dreams.map((d) => d.country_code))];

  const [{ data: seen }, ...counts] = await Promise.all([
    following.length
      ? supabase.from("visited_countries").select("user_id, country_code, country_cities(city_name)").in("user_id", following).in("country_code", countries).eq("is_public", true)
      : Promise.resolve({ data: [] as { user_id: string; country_code: string; country_cities: { city_name: string }[] }[] }),
    ...countries.map((c) => travellerCounts(supabase, c)),
  ]);
  const countsBy = new Map(countries.map((c, i) => [c, counts[i]]));

  const friendIds = new Map<string, string[]>();
  for (const d of dreams) {
    const slug = slugify(d.place_name);
    const ids = (seen ?? [])
      .filter((r) => r.country_code === d.country_code && (!d.place_name || (r.country_cities ?? []).some((c) => slugify(c.city_name) === slug)))
      .map((r) => r.user_id);
    friendIds.set(`${d.country_code}:${slug}`, [...new Set(ids)]);
  }
  const byId = await faces(supabase, [...new Set([...friendIds.values()].flat())]);

  return dreams.map((d) => {
    const slug = slugify(d.place_name);
    const c = countsBy.get(d.country_code);
    const travellers = d.place_name ? [...(c?.towns.values() ?? [])].find((t) => slugify(t.name) === slug)?.n ?? 0 : c?.total ?? 0;
    return {
      ...d,
      friends: (friendIds.get(`${d.country_code}:${slug}`) ?? []).map((id) => byId.get(id)).filter((x): x is Person => !!x),
      travellers,
    };
  });
}

export async function loadDreamEvents(supabase: Supabase, viewerId: string): Promise<DreamEventCard[]> {
  const [{ data }, following] = await Promise.all([
    supabase.from("dream_events").select("id, name, event_type, image").order("created_at", { ascending: false }),
    followees(supabase, viewerId),
  ]);
  const dreams = (data ?? []) as DreamEvent[];
  if (!dreams.length) return [];

  const { data: theirs } = following.length
    ? await supabase.from("events").select("user_id, event_type, title, spotify_artist_name").in("user_id", following).limit(3000)
    : { data: [] as Pick<LiveRow, "user_id" | "event_type" | "title" | "spotify_artist_name">[] };
  const friendIds = new Map<string, Set<string>>();
  for (const e of theirs ?? []) {
    const k = liveKey(liveName(e));
    if (k) (friendIds.get(k) ?? friendIds.set(k, new Set()).get(k)!).add(e.user_id);
  }
  const byId = await faces(supabase, [...new Set([...friendIds.values()].flatMap((s) => [...s]))]);

  // The next show near-ish, for artists (a handful, so the page stays quick).
  const nextShows = await Promise.all(
    dreams.map((d, i) => (d.event_type === "concert" && i < 8 && upcomingConfigured() ? upcomingShows(d.name, 1).then((s) => s[0] ?? null).catch(() => null) : Promise.resolve(null)))
  );

  return dreams.map((d, i) => ({
    ...d,
    friends: [...(friendIds.get(liveKey(d.name)) ?? [])].map((id) => byId.get(id)).filter((x): x is Person => !!x),
    next: nextShows[i],
  }));
}

/** Whether an event (by its name) is one of your dreams. */
export async function isDreamEvent(supabase: Supabase, name: string): Promise<boolean> {
  const { data } = await supabase.from("dream_events").select("name").limit(200);
  return (data ?? []).some((d) => liveKey(d.name) === liveKey(name));
}
