import { loadCollaboratorsFor, type CollabPerson } from "@/lib/collab";
import type { createClient } from "@/lib/supabase/server";
import { signMedia } from "@/lib/signedMedia";
import type { CommentWithAuthor, FeedEvent, Profile } from "@/lib/types";
import type { FeedMediaItem } from "@/components/FeedMemoryCard";

// Posts as the feed shows them (feed_events: trips and events shared to the
// feed), with everything a post card needs: who posted, your likes, the
// comments and the photos. Read with the viewer's session, so the same
// privacy rules as the feed decide what's in it. Used by the feed, a single
// post's page, and a profile's recent trips and events.

type Supabase = ReturnType<typeof createClient>;

export type PostActor = Pick<Profile, "id" | "username" | "display_name" | "avatar_url" | "created_at">;
export type RawMedia = FeedMediaItem & { displayOrder: number };
export type PostContext = {
  actors: Map<string, PostActor>;
  likedByMe: Set<string>;
  commentsByKey: Map<string, CommentWithAuthor[]>;
  mediaByKey: Map<string, RawMedia[]>;
  /** A country post's latest trip (that the viewer may see): where tapping it goes. */
  latestTrip: Map<string, string>;
  /** Who shared a post with its owner (migration 075), by "event:<id>" or "trip:<visit id>". */
  collabs: Map<string, CollabPerson[]>;
};

export const postKey = (item: Pick<FeedEvent, "kind" | "ref_id">) => `${item.kind}:${item.ref_id}`;

/** Likes, comments, photos and posters for these posts. */
export async function loadPostContext(supabase: Supabase, viewerId: string | null, items: FeedEvent[], extraTripIds?: string[]): Promise<PostContext> {
  const ctx: PostContext = { actors: new Map(), likedByMe: new Set(), commentsByKey: new Map(), mediaByKey: new Map(), latestTrip: new Map(), collabs: new Map() };
  if (!items.length) return ctx;
  const actorIds = [...new Set(items.map((i) => i.actor_id))];
  const refIds = items.map((i) => i.ref_id);
  const countryRefIds = items.filter((i) => i.kind === "country").map((i) => i.ref_id);
  const eventRefIds = items.filter((i) => i.kind === "event").map((i) => i.ref_id);
  type MediaRow = { id: string; public_url: string; media_type: "image" | "video"; display_order: number; caption: string; focal_x: number | null; focal_y: number | null };
  const [{ data: profiles }, { data: likeRows }, { data: commentRows }, { data: countryMediaRows }, { data: eventMediaRows }, { data: visitRows }] = await Promise.all([
    supabase.from("profiles").select("id, username, display_name, avatar_url, created_at").in("id", actorIds),
    viewerId ? supabase.from("likes").select("kind, target_id").eq("user_id", viewerId).in("target_id", refIds) : Promise.resolve({ data: [] as { kind: string; target_id: string }[] }),
    supabase.from("comments").select("*, profiles(username, display_name, avatar_url)").in("target_id", refIds).order("created_at", { ascending: true }),
    countryRefIds.length
      ? supabase.from("country_media").select("id, visited_country_id, public_url, media_type, display_order, caption, focal_x, focal_y").in("visited_country_id", countryRefIds)
      : Promise.resolve({ data: [] as (MediaRow & { visited_country_id: string })[] }),
    eventRefIds.length
      ? supabase.from("event_media").select("id, event_id, public_url, media_type, display_order, caption, focal_x, focal_y").in("event_id", eventRefIds)
      : Promise.resolve({ data: [] as (MediaRow & { event_id: string })[] }),
    countryRefIds.length
      ? supabase.from("country_visits").select("*").in("visited_country_id", countryRefIds)
      : Promise.resolve({ data: [] as VisitRow[] }),
  ]).then((r) => signMedia(r));
  type VisitRow = { id: string; visited_country_id: string; year: number; visited_from: string | null; visited_to: string | null; show_in_feed?: boolean; is_current?: boolean };
  // A stay still going on is the latest; trips kept out of feeds aren't the post.
  const tripKey = (v: VisitRow) => (v.is_current ? "9999" : v.visited_to ?? v.visited_from ?? `${v.year}-12-31`);
  const latest = new Map<string, { id: string; key: string }>();
  for (const v of ((visitRows ?? []) as VisitRow[]).filter((x) => x.show_in_feed !== false)) {
    const had = latest.get(v.visited_country_id);
    if (!had || tripKey(v) > had.key) latest.set(v.visited_country_id, { id: v.id, key: tripKey(v) });
  }
  for (const [country, v] of latest) ctx.latestTrip.set(country, v.id);
  ctx.actors = new Map((profiles ?? []).map((p) => [p.id, p as PostActor]));
  for (const row of likeRows ?? []) ctx.likedByMe.add(`${row.kind}:${row.target_id}`);
  for (const row of (commentRows ?? []) as CommentWithAuthor[]) {
    const key = `${row.kind}:${row.target_id}`;
    ctx.commentsByKey.set(key, [...(ctx.commentsByKey.get(key) ?? []), row]);
  }
  const add = (key: string, row: MediaRow) => {
    const list = ctx.mediaByKey.get(key) ?? [];
    list.push({ id: row.id, url: row.public_url, type: row.media_type, alt: row.caption || "", displayOrder: row.display_order, focalX: row.focal_x, focalY: row.focal_y });
    ctx.mediaByKey.set(key, list);
  };
  for (const row of countryMediaRows ?? []) add(`country:${row.visited_country_id}`, row);
  for (const row of eventMediaRows ?? []) add(`event:${row.event_id}`, row);
  for (const list of ctx.mediaByKey.values()) list.sort((a, b) => a.displayOrder - b.displayOrder);
  // Shared posts: everyone who was there, for the header ("Mark & Melody").
  const [eventCollabs, tripCollabs] = await Promise.all([
    loadCollaboratorsFor(supabase, "event", eventRefIds),
    loadCollaboratorsFor(supabase, "trip", [...ctx.latestTrip.values(), ...(extraTripIds ?? [])]),
  ]);
  for (const [key, list] of [...eventCollabs, ...tripCollabs]) ctx.collabs.set(key, list.flatMap((c) => (c.person ? [c.person] : [])));
  return ctx;
}

/** Someone's posts, newest first: trips ("country") or events, or both. */
export async function loadUserPosts(
  supabase: Supabase,
  actorId: string,
  /** alsoEvents: events shared with them (migration 075), which are posts of theirs too. */
  opts: { kind?: "country" | "event"; limit: number; offset?: number; alsoEvents?: string[] }
) {
  let q = supabase.from("feed_events").select("*");
  const shared = (opts.alsoEvents ?? []).filter((id) => /^[0-9a-f-]{36}$/.test(id));
  q = shared.length ? q.or(`actor_id.eq.${actorId},and(kind.eq.event,ref_id.in.(${shared.join(",")}))`) : q.eq("actor_id", actorId);
  if (opts.kind) q = q.eq("kind", opts.kind);
  const from = opts.offset ?? 0;
  // When it happened, newest first (as trips are); the same day, the one
  // added last first; no date at all, by when it was added.
  const { data } = await signMedia(
    await q
      .order("visit_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(from, from + opts.limit - 1)
  );
  return (data ?? []) as FeedEvent[];
}

/** One post, if the viewer may see it. */
export async function loadPost(supabase: Supabase, kind: "country" | "event", refId: string) {
  const { data } = await signMedia(await supabase.from("feed_events").select("*").eq("kind", kind).eq("ref_id", refId).maybeSingle());
  return (data as FeedEvent | null) ?? null;
}
