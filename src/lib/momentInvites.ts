import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { tripTitle } from "@/lib/tripTitle";
import { formatDate } from "@/lib/utils";
import type { CountryVisit } from "@/lib/types";

// Links for people not on ExpandiaX yet (migration 078): "Mark added you to
// Portugal 2025". Read and claimed with the service role, because the person
// opening the link isn't signed in (or isn't on the trip) yet.

export type MomentPreview = { token: string; kind: "trip" | "event"; targetId: string; ownerId: string; title: string; when: string; photos: number };

const TOKEN = /^[0-9a-f]{32}$/;

/** What a link is for, if it's open and was made by `ownerId`. */
export async function loadMomentInvite(token: string | null | undefined, ownerId: string): Promise<MomentPreview | null> {
  if (!token || !TOKEN.test(token)) return null;
  const admin = createAdminClient();
  const { data: inv, error } = await admin.from("moment_invites").select("kind, target_id, owner_id, claimed_by").eq("token", token).maybeSingle();
  if (error || !inv || inv.claimed_by || inv.owner_id !== ownerId) return null;
  if (inv.kind === "trip") {
    const { data: v } = await admin
      .from("country_visits")
      .select("*, visited_countries!inner(country_name), country_media!country_media_country_visit_id_fkey(id)")
      .eq("id", inv.target_id)
      .maybeSingle();
    if (!v) return null;
    const vc = (Array.isArray(v.visited_countries) ? v.visited_countries[0] : v.visited_countries) as { country_name: string };
    return {
      token,
      kind: "trip",
      targetId: inv.target_id,
      ownerId,
      title: (v.title as string)?.trim() || `${vc.country_name} ${v.year}`,
      when: tripTitle(v as CountryVisit).headline,
      photos: (v.country_media as unknown[])?.length ?? 0,
    };
  }
  const { data: e } = await admin.from("events").select("title, event_date, event_media!event_media_event_id_fkey(id)").eq("id", inv.target_id).maybeSingle();
  if (!e) return null;
  return { token, kind: "event", targetId: inv.target_id, ownerId, title: e.title as string, when: formatDate(e.event_date as string), photos: (e.event_media as unknown[])?.length ?? 0 };
}

/**
 * The person who opened the link has an account now: it becomes a normal
 * invitation for them (they choose to join the memory or create their own),
 * and the link is used up.
 */
export async function claimMomentInvite(token: string | null | undefined, userId: string): Promise<boolean> {
  if (!token || !TOKEN.test(token)) return false;
  const admin = createAdminClient();
  const { data: inv, error } = await admin.from("moment_invites").select("id, kind, target_id, owner_id, claimed_by").eq("token", token).maybeSingle();
  if (error || !inv || inv.claimed_by || inv.owner_id === userId) return false;
  const { error: claimErr } = await admin.from("moment_invites").update({ claimed_by: userId, claimed_at: new Date().toISOString() }).eq("id", inv.id).is("claimed_by", null);
  if (claimErr) return false;
  const { error: insErr } = await admin
    .from("post_collaborators")
    .insert({ kind: inv.kind, target_id: inv.target_id, owner_id: inv.owner_id, user_id: userId });
  // Already on it: nothing more to ask.
  if (insErr) return true;
  await admin.from("notifications").insert({ user_id: userId, actor_id: inv.owner_id, kind: "collab_invite", target_kind: inv.kind, target_id: inv.target_id });
  return true;
}
