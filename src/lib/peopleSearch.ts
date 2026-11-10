import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProfileVisibility } from "./types";

export type PersonHit = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  visibility?: ProfileVisibility;
  countries: number;
  following: boolean;
};

/**
 * People matching a search, best first, like Instagram: the exact name or
 * username, then names that start with it, then anyone containing it;
 * people you follow before others, then the most travelled. Private
 * accounts are found too (to be asked to follow); people who switched off
 * "Show me in search" only turn up for those who already follow them.
 */
export async function searchPeople(supabase: SupabaseClient, query: string, viewerId: string, limit = 20): Promise<PersonHit[]> {
  const q = query.replace(/[%_,()*\\:.]/g, " ").trim();
  if (!q) return [];
  const like = `%${q}%`;
  const fields = "id, username, display_name, avatar_url, visibility, discoverable";
  const [{ data: byUsername }, { data: byName }, { data: followRows }] = await Promise.all([
    supabase.from("profiles").select(fields).ilike("username", like).limit(40),
    supabase.from("profiles").select(fields).ilike("display_name", like).limit(40),
    supabase.from("follows").select("followee_id").eq("follower_id", viewerId),
  ]);
  const following = new Set((followRows ?? []).map((r) => r.followee_id as string));
  type Row = Omit<PersonHit, "countries" | "following"> & { discoverable: boolean };
  const found = new Map<string, Row>();
  for (const p of [...(byUsername ?? []), ...(byName ?? [])] as Row[]) {
    if (p.id === viewerId) continue;
    if (p.discoverable || following.has(p.id)) found.set(p.id, p);
  }
  if (found.size === 0) return [];

  const { data: countRows } = await supabase.from("public_country_counts").select("user_id, country_count").in("user_id", [...found.keys()]);
  const counts = new Map((countRows ?? []).map((r) => [r.user_id as string, Number(r.country_count)]));

  const lower = q.toLowerCase();
  const rank = (p: Row) => {
    const name = p.display_name.toLowerCase();
    const user = p.username.toLowerCase();
    if (name === lower || user === lower) return 0;
    if (name.startsWith(lower) || user.startsWith(lower) || name.split(/\s+/).some((w) => w.startsWith(lower))) return 1;
    return 2;
  };
  return [...found.values()]
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        Number(following.has(b.id)) - Number(following.has(a.id)) ||
        (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0)
    )
    .slice(0, limit)
    .map((p) => ({
      id: p.id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      visibility: p.visibility,
      countries: counts.get(p.id) ?? 0,
      following: following.has(p.id),
    }));
}
