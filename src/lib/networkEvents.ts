import type { createClient } from "@/lib/supabase/server";
import { nearbyEvents, type NearbyCategory, type NearbyEvent, type NearbyWhere } from "@/lib/concerts";
import type { Person } from "@/lib/experienceNetwork";
import type { EventSource } from "@/lib/eventSources";

// "Events your network is into": upcoming events people you follow are
// interested in (the ♥), most friends first — then what's on near you, so
// the row is never empty even before anyone has tapped a heart.

type Supabase = ReturnType<typeof createClient>;

export type InterestRow = {
  user_id: string;
  event_key: string;
  name: string;
  event_date: string;
  venue: string;
  city: string;
  country_code: string | null;
  category: NearbyCategory;
  url: string | null;
  image: string | null;
};

export type NetworkEvent = {
  key: string;
  name: string;
  date: string;
  venue: string;
  city: string;
  countryCode: string | null;
  category: NearbyCategory;
  url: string | null;
  image: string | null;
  friendIds: string[];
  mine: boolean; // you've tapped ♥
  source?: EventSource;
};

/** Friends' events first (most friends, then soonest), then nearby ones not already there. */
export function mergeNetworkEvents(rows: InterestRow[], nearby: NearbyEvent[], viewerId: string, following: Set<string>, limit = 16): NetworkEvent[] {
  const byKey = new Map<string, NetworkEvent>();
  for (const r of rows) {
    if (r.user_id !== viewerId && !following.has(r.user_id)) continue;
    const e =
      byKey.get(r.event_key) ??
      byKey
        .set(r.event_key, { key: r.event_key, name: r.name, date: r.event_date, venue: r.venue, city: r.city, countryCode: r.country_code, category: r.category, url: r.url, image: r.image, friendIds: [], mine: false })
        .get(r.event_key)!;
    if (r.user_id === viewerId) e.mine = true;
    else if (!e.friendIds.includes(r.user_id)) e.friendIds.push(r.user_id);
  }
  const network = [...byKey.values()]
    .filter((e) => e.friendIds.length > 0 || e.mine)
    .sort((a, b) => b.friendIds.length - a.friendIds.length || a.date.localeCompare(b.date));
  const near = nearby
    .filter((n) => !byKey.has(n.id))
    .map((n) => ({ key: n.id, name: n.name, date: n.date, venue: n.venue, city: n.city, countryCode: n.countryCode, category: n.category, url: n.url, image: n.image, friendIds: [], mine: false, source: n.source }));
  return [...network, ...near].slice(0, limit);
}

export type NetworkEventCard = NetworkEvent & { friends: Person[] };

export async function loadNetworkEvents(supabase: Supabase, viewerId: string, where: NearbyWhere | null, nearbyLimit = 24): Promise<NetworkEventCard[]> {
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: follows }, { data: rows }, nearby] = await Promise.all([
    supabase.from("follows").select("followee_id").eq("follower_id", viewerId),
    supabase
      .from("event_interest")
      .select("user_id, event_key, name, event_date, venue, city, country_code, category, url, image")
      .gte("event_date", today)
      .order("event_date")
      .limit(500),
    where ? nearbyEvents(where, nearbyLimit).catch(() => [] as NearbyEvent[]) : Promise.resolve([] as NearbyEvent[]),
  ]);
  const following = new Set((follows ?? []).map((f) => f.followee_id));
  const events = mergeNetworkEvents((rows ?? []) as InterestRow[], nearby, viewerId, following);
  const ids = [...new Set(events.flatMap((e) => e.friendIds.slice(0, 3)))];
  const { data: faces } = ids.length
    ? await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", ids)
    : { data: [] as Person[] };
  const byId = new Map((faces ?? []).map((p) => [p.id, p as Person]));
  return events.map((e) => ({ ...e, friends: e.friendIds.map((id) => byId.get(id)).filter((x): x is Person => !!x) }));
}
