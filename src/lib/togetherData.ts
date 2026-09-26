import type { createClient } from "@/lib/supabase/server";
import { findTogether, tripRange, type Prompt, type Shared, type TogetherEvent, type TogetherTrip } from "@/lib/together";
import type { DatePrecision } from "@/lib/types";

export type TogetherPerson = { id: string; username: string; display_name: string; avatar_url: string | null };
export type TogetherData = {
  shared: Shared[];
  prompts: Prompt[];
  people: Record<string, TogetherPerson>;
  covers: Record<string, string>; // event id → cover photo
};

type Supabase = ReturnType<typeof createClient>;
type EventRow = TogetherEvent & { cover_media_id: string | null };
type VisitRow = { user_id: string; country_code: string; country_visits: { visited_from: string | null; visited_to: string | null; date_precision: DatePrecision }[] };

const EVENT_FIELDS =
  "id, user_id, title, event_type, event_date, venue, city, country_code, country_name, spotify_artist_id, spotify_artist_name, spotify_artist_image, cover_media_id";

function trips(rows: VisitRow[]): TogetherTrip[] {
  return rows.flatMap((r) =>
    (r.country_visits ?? []).map((v) => tripRange(v)).filter((x): x is { from: string; to: string } => !!x).map((range) => ({ user_id: r.user_id, country_code: r.country_code, ...range }))
  );
}

/**
 * Everything you share with the people you follow, across all of what
 * you've each logged (not just what's in the feed right now). What's
 * readable is decided by the database's own visibility and block rules.
 */
export async function loadTogether(supabase: Supabase, userId: string, followeeIds: string[], homeCountry: string | null): Promise<TogetherData> {
  const empty: TogetherData = { shared: [], prompts: [], people: {}, covers: {} };
  if (followeeIds.length === 0) return empty;

  const [{ data: mine }, { data: theirs }, { data: myVisits }, { data: theirVisits }, { data: people }] = await Promise.all([
    supabase.from("events").select(EVENT_FIELDS).eq("user_id", userId),
    supabase.from("events").select(EVENT_FIELDS).in("user_id", followeeIds).order("event_date", { ascending: false }).limit(1000),
    supabase.from("visited_countries").select("user_id, country_code, country_visits(visited_from, visited_to, date_precision)").eq("user_id", userId),
    supabase
      .from("visited_countries")
      .select("user_id, country_code, country_visits(visited_from, visited_to, date_precision)")
      .in("user_id", followeeIds)
      .limit(2000),
    supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", followeeIds),
  ]);

  const { shared, prompts } = findTogether({
    myEvents: (mine ?? []) as EventRow[],
    myTrips: trips((myVisits ?? []) as unknown as VisitRow[]),
    theirEvents: (theirs ?? []) as EventRow[],
    theirTrips: trips((theirVisits ?? []) as unknown as VisitRow[]),
    homeCountry,
    today: new Date().toISOString().slice(0, 10),
  });

  // Cover photos for the shared events — yours and theirs.
  const events = shared.flatMap((s) => (s.kind === "event" ? [s.mine, s.theirs] : [])) as EventRow[];
  const covers: Record<string, string> = {};
  if (events.length) {
    const { data: media } = await supabase
      .from("event_media")
      .select("id, event_id, public_url, media_type, display_order")
      .in("event_id", events.map((e) => e.id))
      .eq("media_type", "image")
      .order("display_order", { ascending: true });
    for (const e of events) {
      const own = (media ?? []).filter((m) => m.event_id === e.id);
      const cover = own.find((m) => m.id === e.cover_media_id) ?? own[0];
      const url = cover?.public_url ?? e.spotify_artist_image;
      if (url) covers[e.id] = url;
    }
  }

  return {
    shared,
    prompts,
    people: Object.fromEntries((people ?? []).map((p) => [p.id, p as TogetherPerson])),
    covers,
  };
}
