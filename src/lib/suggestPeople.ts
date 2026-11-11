import type { createClient } from "@/lib/supabase/server";
import { countryByCode } from "@/lib/countries";
import { loadNetworkHome } from "@/lib/experienceNetworkData";
import type { ProfileVisibility } from "@/lib/types";
import { rankSuggestions, type Candidate, type WhyKind } from "@/lib/suggestRank";

// "Suggested for you": people you may know, strongest reason first.
//
//   follows_you  they follow you and you don't follow back
//   mutual       people you follow follow them ("3 mutuals", with faces)
//   shared       you were at the same event, or the same towns
//                (the Experience Network's own reasons)
//   home         from your home country (and new here, if they just joined)
//   traveller    for someone brand new with nothing else to go on: the
//                most travelled members, so the carousel is never empty
//
// Everything is read with the viewer's session, so the database's privacy
// and block rules decide what's in it; anyone who switched off "Suggest my
// profile" (discoverable) only appears if they already follow you.
// Dismissed people (×) stay gone (migration 070).

type Supabase = ReturnType<typeof createClient>;

export type Face = { id: string; username: string; display_name: string; avatar_url: string | null };
export type Suggestion = Face & {
  visibility: ProfileVisibility;
  why: { kind: WhyKind; text: string };
  /** For mutuals: who of the people you follow follows them. */
  faces: Face[];
};

export async function loadSuggestions(supabase: Supabase, viewerId: string, limit = 15): Promise<Suggestion[]> {
  const [{ data: following }, { data: followers }, { data: requested }, { data: blocked }, dismissedRes, { data: me }] = await Promise.all([
    supabase.from("follows").select("followee_id").eq("follower_id", viewerId),
    supabase.from("follows").select("follower_id").eq("followee_id", viewerId),
    supabase.from("follow_requests").select("target_id").eq("requester_id", viewerId),
    supabase.from("blocks").select("blocked_id").eq("blocker_id", viewerId),
    supabase.from("suggestion_dismissals").select("dismissed_id").eq("user_id", viewerId),
    supabase.from("profiles").select("home_country_code").eq("id", viewerId).single(),
  ]);
  const iFollow = new Set((following ?? []).map((r) => r.followee_id as string));
  const skip = new Set<string>([
    viewerId,
    ...iFollow,
    ...(requested ?? []).map((r) => r.target_id as string),
    ...(blocked ?? []).map((r) => r.blocked_id as string),
    ...(dismissedRes.error ? [] : (dismissedRes.data ?? []).map((r) => r.dismissed_id as string)),
  ]);
  const home = (me?.home_country_code as string | null) ?? null;
  const homeName = countryByCode(home)?.name ?? null;
  const candidates: Candidate[] = [];

  // They follow you.
  for (const r of followers ?? []) if (!skip.has(r.follower_id)) candidates.push({ id: r.follower_id, kind: "follows_you", text: "Follows you", score: 0 });

  // Friends of the people you follow.
  const [mutualRes, network, homeRes, travellers] = await Promise.all([
    iFollow.size
      ? supabase.from("follows").select("follower_id, followee_id").in("follower_id", [...iFollow].slice(0, 300)).limit(5000)
      : Promise.resolve({ data: [] as { follower_id: string; followee_id: string }[] }),
    loadNetworkHome(supabase, viewerId, { people: 20 }).catch(() => ({ people: [] as { id: string; headline: { text: string } | null }[] })),
    home
      ? supabase.from("profiles").select("id, created_at").eq("home_country_code", home).eq("discoverable", true).neq("id", viewerId).order("created_at", { ascending: false }).limit(40)
      : Promise.resolve({ data: [] as { id: string; created_at: string }[] }),
    supabase.from("public_country_counts").select("user_id, country_count").order("country_count", { ascending: false }).limit(30),
  ]);
  const via = new Map<string, string[]>();
  for (const r of mutualRes.data ?? []) if (!skip.has(r.followee_id)) via.set(r.followee_id, [...(via.get(r.followee_id) ?? []), r.follower_id]);
  for (const [id, by] of via) candidates.push({ id, kind: "mutual", text: `${by.length} ${by.length === 1 ? "mutual" : "mutuals"}`, score: by.length * 40, faces: by });

  // The same events and places as you.
  for (const p of network.people) if (!skip.has(p.id) && p.headline) candidates.push({ id: p.id, kind: "shared", text: p.headline.text, score: 20 });

  // From your home country; the newest first.
  const monthAgo = Date.now() - 30 * 86_400_000;
  (homeRes.data ?? []).forEach((p, i) => {
    if (skip.has(p.id)) return;
    const fresh = Date.parse(p.created_at as string) > monthAgo;
    candidates.push({ id: p.id, kind: fresh ? "new" : "home", text: fresh ? `New · from ${homeName}` : `From ${homeName}`, score: 40 - i });
  });

  // Nothing else to go on yet: well-travelled members.
  for (const t of travellers.data ?? []) {
    if (skip.has(t.user_id)) continue;
    const n = Number(t.country_count);
    candidates.push({ id: t.user_id, kind: "traveller", text: `Visited ${n} ${n === 1 ? "country" : "countries"}`, score: Math.min(n, 60) });
  }

  // Who they are (and whether they can be suggested at all).
  const ids = [...new Set(candidates.map((c) => c.id))].slice(0, 300);
  if (!ids.length) return [];
  const faceIds = [...new Set(candidates.flatMap((c) => c.faces ?? []))].slice(0, 300);
  const [{ data: profiles }, { data: faceRows }] = await Promise.all([
    supabase.from("profiles").select("id, username, display_name, avatar_url, visibility, discoverable").in("id", ids),
    faceIds.length ? supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", faceIds) : Promise.resolve({ data: [] as Face[] }),
  ]);
  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p as Face & { visibility: ProfileVisibility; discoverable: boolean }]));
  const faceById = new Map((faceRows ?? []).map((f) => [f.id as string, f as Face]));
  const usable = candidates.filter((c) => {
    const p = byId.get(c.id);
    return p && p.username && (p.discoverable || c.kind === "follows_you");
  });

  return rankSuggestions(usable, (id) => !!byId.get(id)?.avatar_url, limit).map((c) => {
    const p = byId.get(c.id)!;
    return {
      id: p.id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      visibility: p.visibility,
      why: { kind: c.kind, text: c.text },
      faces: (c.faces ?? []).map((id) => faceById.get(id)).filter((f): f is Face => !!f).slice(0, 3),
    };
  });
}
