import type { createClient } from "@/lib/supabase/server";
import { hasRealName } from "./profileName";
import { isTerritoryCode } from "./territories";
import { pickNextStep, type CountrySignal, type History, type MemorySignal, type NextStep, type Screen, type Signals, type Stage } from "./nextStep";

type Supabase = ReturnType<typeof createClient>;

type MediaLite = { id: string; country_visit_id?: string | null; caption: string | null; media_type?: string };
type CountryRow = {
  id: string;
  country_code: string;
  country_name: string;
  created_at: string;
  photo_reminder_off: boolean | null;
  country_media: MediaLite[];
  country_visits: { id: string; kind: string | null; year: number; visited_from: string | null; highlight: string | null; spotify_track_id: string | null; title: string | null }[];
};
type EventRow = {
  id: string;
  title: string;
  event_type: string;
  event_date: string;
  country_code: string;
  country_name: string;
  review: string | null;
  highlight: string | null;
  spotify_favourite_track_id: string | null;
  spotify_artist_name: string | null;
  memory_reminder_off: boolean | null;
  event_media: MediaLite[];
};

const said = (s: string | null | undefined) => !!s?.trim();

/** Everything Next Step decides from, in one round of queries. */
export async function loadSignals(supabase: Supabase, userId: string): Promise<{ signals: Signals; history: History }> {
  const [countriesRes, eventsRes, journalsRes, followingRes, followersRes, ownedCollabsRes, myCollabsRes, dreamsRes, connectsRes, profileRes, progressRes] =
    await Promise.all([
      supabase
        .from("visited_countries")
        .select(
          "id, country_code, country_name, created_at, photo_reminder_off, country_media!country_media_visited_country_id_fkey(id, country_visit_id, caption), country_visits(id, kind, year, visited_from, highlight, spotify_track_id, title)"
        )
        .eq("user_id", userId),
      supabase
        .from("events")
        .select(
          "id, title, event_type, event_date, country_code, country_name, review, highlight, spotify_favourite_track_id, spotify_artist_name, memory_reminder_off, event_media!event_media_event_id_fkey(id, caption, media_type)"
        )
        .eq("user_id", userId),
      supabase.from("trip_journals").select("visit_id, body").eq("user_id", userId),
      supabase.from("follows").select("followee_id").eq("follower_id", userId),
      supabase.from("follows").select("follower_id").eq("followee_id", userId),
      supabase.from("post_collaborators").select("kind, target_id").eq("owner_id", userId),
      supabase.from("post_collaborators").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "accepted"),
      supabase.from("want_to_go").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.rpc("world_connect_count", { p_user: userId }),
      supabase.from("profiles").select("display_name").eq("id", userId).single(),
      supabase.from("member_progress").select("stage, moments, paused_until").eq("user_id", userId).maybeSingle(),
    ]);

  const countryRows = ((countriesRes.data ?? []) as unknown as CountryRow[]).filter((c) => !isTerritoryCode(c.country_code));
  const eventRows = (eventsRes.data ?? []) as unknown as EventRow[];
  const journals = new Set(((journalsRes.data ?? []) as { visit_id: string; body: string }[]).filter((j) => said(j.body)).map((j) => j.visit_id));
  const peopleOn = new Map<string, number>();
  for (const c of (ownedCollabsRes.data ?? []) as { kind: string; target_id: string }[]) {
    const key = `${c.kind}:${c.target_id}`;
    peopleOn.set(key, (peopleOn.get(key) ?? 0) + 1);
  }

  const memories: MemorySignal[] = [];
  const countries: CountrySignal[] = [];
  for (const c of countryRows) {
    const visits = [...(c.country_visits ?? [])].sort((a, b) => (b.visited_from ?? String(b.year)).localeCompare(a.visited_from ?? String(a.year)));
    countries.push({
      code: c.country_code,
      name: c.country_name,
      photos: c.country_media?.length ?? 0,
      latestTripId: visits[0]?.id ?? null,
      reminderOff: !!c.photo_reminder_off,
      addedAt: c.created_at,
    });
    for (const v of visits) {
      const media = (c.country_media ?? []).filter((m) => m.country_visit_id === v.id);
      memories.push({
        kind: "trip",
        id: v.id,
        label: said(v.title) ? v.title!.trim() : c.country_name,
        countryCode: c.country_code,
        countryName: c.country_name,
        date: v.visited_from ?? `${v.year}-01-01`,
        photos: media.length,
        isStay: v.kind === "lived",
        hasSong: !!v.spotify_track_id,
        hasWords: said(v.highlight) || media.some((m) => said(m.caption)),
        hasJournal: journals.has(v.id),
        people: peopleOn.get(`trip:${v.id}`) ?? 0,
        reminderOff: !!c.photo_reminder_off,
      });
    }
  }
  for (const e of eventRows) {
    const photos = (e.event_media ?? []).filter((m) => m.media_type !== "video");
    memories.push({
      kind: "event",
      id: e.id,
      label: e.title,
      countryCode: e.country_code,
      countryName: e.country_name,
      date: e.event_date,
      photos: photos.length,
      // A concert's highlight is its song; for anything else it's their words.
      hasSong: !!e.spotify_favourite_track_id || (e.event_type === "concert" && said(e.highlight)),
      hasWords: said(e.review) || (e.event_type !== "concert" && said(e.highlight)) || (e.event_media ?? []).some((m) => said(m.caption)),
      hasJournal: false,
      people: peopleOn.get(`event:${e.id}`) ?? 0,
      artist: e.event_type === "concert" ? e.spotify_artist_name : null,
      reminderOff: !!e.memory_reminder_off,
    });
  }

  const following = new Set(((followingRes.data ?? []) as { followee_id: string }[]).map((f) => f.followee_id));
  const mutuals = ((followersRes.data ?? []) as { follower_id: string }[]).filter((f) => following.has(f.follower_id)).length;
  const progress = progressRes.data as { stage: number; moments: History["moments"] | null; paused_until: string | null } | null;

  return {
    signals: {
      countries,
      memories,
      following: following.size,
      mutuals,
      peopleLinked: [...peopleOn.values()].reduce((n, x) => n + x, 0) + (myCollabsRes.count ?? 0),
      dreams: dreamsRes.count ?? 0,
      worldConnects: typeof connectsRes.data === "number" ? connectsRes.data : 0,
      hasRealName: hasRealName((profileRes.data as { display_name: string | null } | null)?.display_name),
    },
    history: { stage: progress?.stage ?? 0, moments: progress?.moments ?? {}, pausedUntil: progress?.paused_until ?? null },
  };
}

/**
 * The one suggestion for this screen (or null), and the member's stage. The
 * stage is saved when it goes up, so it never goes back.
 */
export async function loadNextStep(supabase: Supabase, userId: string, screen: Screen): Promise<{ stage: Stage; step: NextStep | null }> {
  try {
    const { signals, history } = await loadSignals(supabase, userId);
    const picked = pickNextStep(signals, history, { screen });
    if (picked.stage > history.stage) await supabase.rpc("raise_member_stage", { p_stage: picked.stage });
    return picked;
  } catch {
    // Before migration 082, or a hiccup: no suggestion, the page as before.
    return { stage: 4, step: null };
  }
}
