import type { createClient } from "@/lib/supabase/server";
import { countryByCode } from "@/lib/countries";
import { liveKey, liveName, matchReason, overlap, popularPlaces, trendingLive, type LiveRow, type PopularPlace, type Taste, type Trending } from "@/lib/explore";
import type { Here } from "@/lib/location";
import type { ProfileVisibility } from "@/lib/types";

type Supabase = ReturnType<typeof createClient>;

export type ExplorePerson = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  visibility: ProfileVisibility;
  countries: number;
};
export type Local = ExplorePerson & { knows: string }; // "Has been to Bologna"
export type ClickWith = ExplorePerson & { reason: string; score: number; following: false };

export type ExploreData = {
  trending: Trending[];
  places: PopularPlace[];
  locals: Local[];
  clickWith: ClickWith[];
};

export const LIVE_TYPES = ["concert", "festival", "sport", "conference"] as const;
const LIVE_FIELDS = "id, user_id, event_type, title, spotify_artist_name, spotify_artist_image, event_date";

/**
 * Everything Explore shows, from what people have logged. All reads go
 * through the viewer's own session, so the database's visibility and
 * block rules decide what's included — private accounts only count for
 * people allowed to see them.
 */
export async function loadExplore(supabase: Supabase, viewerId: string | null, here: Here | null): Promise<ExploreData> {
  const [{ data: liveData }, { data: placeData }, { data: counts }, following, blocked, viewerProfile] = await Promise.all([
    supabase.from("events").select(LIVE_FIELDS).eq("is_public", true).in("event_type", [...LIVE_TYPES]).order("created_at", { ascending: false }).limit(2000),
    supabase.from("visited_countries").select("user_id, country_code").limit(5000),
    supabase.from("public_country_counts").select("user_id, country_count"),
    viewerId ? supabase.from("follows").select("followee_id").eq("follower_id", viewerId) : Promise.resolve({ data: [] as { followee_id: string }[] }),
    viewerId ? supabase.from("blocks").select("blocked_id").eq("blocker_id", viewerId) : Promise.resolve({ data: [] as { blocked_id: string }[] }),
    viewerId ? supabase.from("profiles").select("home_country_code").eq("id", viewerId).single() : Promise.resolve({ data: null }),
  ]);
  const live = (liveData ?? []) as LiveRow[];
  const placeRows = placeData ?? [];
  const countryCount = new Map((counts ?? []).map((r) => [r.user_id, Number(r.country_count)]));
  const followingIds = new Set((following.data ?? []).map((r) => r.followee_id));
  const blockedIds = new Set((blocked.data ?? []).map((r) => r.blocked_id));
  const skip = (id: string) => id === viewerId || blockedIds.has(id);

  // Travellers who know where you are: that city first, then its country.
  const localIds = new Map<string, string>();
  if (here?.city) {
    const { data: cityRows } = await supabase
      .from("country_cities")
      .select("city_name, visited_countries!inner(user_id)")
      .ilike("city_name", here.city)
      .limit(200);
    for (const r of cityRows ?? []) {
      const vc = r.visited_countries as unknown as { user_id: string } | { user_id: string }[];
      const uid = Array.isArray(vc) ? vc[0]?.user_id : vc?.user_id;
      if (uid && !skip(uid)) localIds.set(uid, `Has been to ${here.city}`);
    }
  }
  const countryName = countryByCode(here?.countryCode)?.name;
  if (here?.countryCode && countryName) {
    for (const r of placeRows) if (r.country_code === here.countryCode && !skip(r.user_id) && !localIds.has(r.user_id)) localIds.set(r.user_id, `Has been to ${countryName}`);
  }

  // People you'd click with: the most overlap with your own map and nights out.
  let clickWithIds: { id: string; reason: string; score: number }[] = [];
  if (viewerId) {
    const tastes = new Map<string, Taste>();
    const taste = (id: string) => tastes.get(id) ?? tastes.set(id, { countries: new Set(), live: new Set(), home: null }).get(id)!;
    const names = new Map<string, string>();
    for (const r of placeRows) taste(r.user_id).countries.add(r.country_code);
    const { data: ownLive } = await supabase.from("events").select(LIVE_FIELDS).eq("user_id", viewerId).in("event_type", [...LIVE_TYPES]);
    for (const e of [...live, ...((ownLive ?? []) as LiveRow[])]) {
      const name = liveName(e);
      const key = liveKey(name);
      if (!key) continue;
      names.set(key, name);
      taste(e.user_id).live.add(key);
    }
    const me = taste(viewerId);
    me.home = viewerProfile.data?.home_country_code ?? null;
    const candidates = [...tastes.keys()].filter((id) => !skip(id) && !followingIds.has(id));
    const { data: homes } = candidates.length
      ? await supabase.from("profiles").select("id, home_country_code").in("id", candidates.slice(0, 500))
      : { data: [] as { id: string; home_country_code: string | null }[] };
    for (const h of homes ?? []) taste(h.id).home = h.home_country_code;
    const homeName = countryByCode(me.home)?.name;
    clickWithIds = candidates
      .map((id) => {
        const m = overlap(me, taste(id), names);
        return { id, score: m.score, reason: matchReason(m, homeName) };
      })
      .filter((c) => c.score >= 2 && c.reason)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }

  const ids = [...new Set([...[...localIds.keys()].slice(0, 12), ...clickWithIds.map((c) => c.id)])];
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, username, display_name, avatar_url, visibility").in("id", ids).eq("discoverable", true)
    : { data: [] as Omit<ExplorePerson, "countries">[] };
  // People who opted out of suggestions never appear here.
  const byId = new Map((profiles ?? []).map((p) => [p.id, { ...(p as Omit<ExplorePerson, "countries">), countries: countryCount.get(p.id) ?? 0 }]));

  return {
    trending: trendingLive(live),
    places: popularPlaces(placeRows),
    locals: [...localIds.entries()]
      .map(([id, knows]) => (byId.get(id) ? { ...byId.get(id)!, knows } : null))
      .filter((x): x is Local => !!x)
      .sort((a, b) => Number(b.knows.endsWith(here?.city ?? "\u0000")) - Number(a.knows.endsWith(here?.city ?? "\u0000")) || b.countries - a.countries)
      .slice(0, 8),
    clickWith: clickWithIds
      .map((c) => (byId.get(c.id) ? { ...byId.get(c.id)!, reason: c.reason, score: c.score, following: false as const } : null))
      .filter((x): x is ClickWith => !!x),
  };
}
