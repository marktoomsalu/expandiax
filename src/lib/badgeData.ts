import type { createClient } from "@/lib/supabase/server";
import { collabEventsOf, collabTripsOf } from "./collabData";
import { evaluateBadges, type EvaluatedBadge } from "./badges";
import { buildAllTimeStats, type CountryStatInput, type EventStatInput } from "./stats";
import { isTerritoryCode } from "./territories";
import type { EventType } from "./types";

type Supabase = ReturnType<typeof createClient>;

type CountryRow = {
  country_code: string;
  is_favourite: boolean;
  country_visits: { year: number; visited_from: string | null; visited_to: string | null; kind: string | null }[];
  country_media: { id: string }[];
};
type EventRow = {
  id: string;
  title: string;
  country_code: string;
  event_type: EventType;
  event_date: string;
  rating: number | null;
  is_favourite: boolean;
  event_media: { id: string; media_type: "image" | "video" }[];
};

/**
 * Someone's badges, counted exactly as the Stats page counts them: their own
 * countries and events, the trips and events shared with them, friends
 * they've brought and World Connects.
 */
export async function loadBadges(supabase: Supabase, userId: string): Promise<EvaluatedBadge[]> {
  const [{ data: countriesData }, { data: eventsData }, { data: invited }, { data: connects }, sharedEvents, sharedTrips] = await Promise.all([
    supabase
      .from("visited_countries")
      .select("country_code, is_favourite, country_visits(year, visited_from, visited_to, kind), country_media!country_media_visited_country_id_fkey(id)")
      .eq("user_id", userId),
    supabase
      .from("events")
      .select("id, title, country_code, event_type, event_date, rating, is_favourite, event_media!event_media_event_id_fkey(id, media_type)")
      .eq("user_id", userId),
    supabase.rpc("invite_count", { p_user: userId }),
    supabase.rpc("world_connect_count", { p_user: userId }),
    collabEventsOf(supabase, userId),
    collabTripsOf(supabase, userId),
  ]);

  const countryRows = ((countriesData ?? []) as unknown as CountryRow[]).map((c) => {
    const more = sharedTrips.filter((t) => t.visited_countries.country_code === c.country_code);
    return more.length ? { ...c, country_visits: [...c.country_visits, ...more.map((t) => ({ year: t.year, visited_from: t.visited_from, visited_to: t.visited_to, kind: t.kind }))] } : c;
  });
  const eventRows = [...((eventsData ?? []) as unknown as EventRow[]), ...(sharedEvents as unknown as EventRow[])];

  const countries: CountryStatInput[] = countryRows
    .filter((c) => !isTerritoryCode(c.country_code))
    .map((c) => ({ country_code: c.country_code, is_favourite: c.is_favourite, photo_count: c.country_media?.length ?? 0, visits: c.country_visits ?? [] }));
  const events: EventStatInput[] = eventRows.map((e) => ({
    id: e.id,
    title: e.title,
    country_code: e.country_code,
    event_type: e.event_type,
    event_date: e.event_date,
    rating: e.rating,
    is_favourite: e.is_favourite,
    photo_count: (e.event_media ?? []).filter((m) => m.media_type === "image").length,
    video_count: (e.event_media ?? []).filter((m) => m.media_type === "video").length,
  }));

  return evaluateBadges(buildAllTimeStats(countries, events), {
    invitedFriends: typeof invited === "number" ? invited : 0,
    worldConnects: typeof connects === "number" ? connects : 0,
    antarctica: countryRows.some((c) => c.country_code === "AQ"),
  });
}

/**
 * Badges earned since they were last celebrated. The first time (nothing
 * recorded yet) everything they already have is recorded quietly, so
 * people who were here before don't get a pile of old badges at once.
 */
export async function newBadges(supabase: Supabase, userId: string): Promise<{ ids: string[]; next: { id: string; current: number; target: number } | null }> {
  const [badges, { data: progress, error }] = await Promise.all([
    loadBadges(supabase, userId),
    supabase.from("member_progress").select("badges_seen").eq("user_id", userId).maybeSingle(),
  ]);
  if (error) return { ids: [], next: null }; // before migration 082
  const unlocked = badges.filter((b) => b.isUnlocked).map((b) => b.id);
  const seen = (progress as { badges_seen: string[] | null } | null)?.badges_seen ?? null;
  if (seen === null) {
    await supabase.rpc("mark_badges_seen", { p_ids: unlocked });
    return { ids: [], next: null };
  }
  const fresh = unlocked.filter((id) => !seen.includes(id));
  if (!fresh.length) return { ids: [], next: null };
  // The nearest one still to get, in the same group as the newest badge.
  const group = badges.find((b) => b.id === fresh.at(-1))?.group;
  const next =
    badges
      .filter((b) => !b.isUnlocked && b.group === group && b.id !== "antarctica")
      .sort((a, b) => a.target - a.current - (b.target - b.current))[0] ?? null;
  return { ids: fresh, next: next ? { id: next.id, current: next.current, target: next.target } : null };
}
