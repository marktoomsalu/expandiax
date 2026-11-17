import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { invitePreview, type InvitePreview } from "@/lib/invitePreview";

// Links for people not on ExpandiaX yet (migration 078): "Mark added you to
// Portugal 2025". Read and claimed with the service role, because the person
// opening the link isn't signed in (or isn't on the trip) yet.

export type MomentPreview = {
  token: string;
  kind: "trip" | "event";
  targetId: string;
  ownerId: string;
  ownerName: string;
  ownerAvatar: string | null;
  ownerUsername: string;
} & InvitePreview;

const TOKEN = /^[0-9a-f]{32}$/;

/** What a link is for, if it's still open (and, given `ownerId`, was made by them): with its cover, for the invitation card. */
export async function loadMomentInvite(token: string | null | undefined, ownerId?: string): Promise<MomentPreview | null> {
  if (!token || !TOKEN.test(token)) return null;
  const admin = createAdminClient();
  const { data: inv, error } = await admin.from("moment_invites").select("kind, target_id, owner_id, claimed_by").eq("token", token).maybeSingle();
  if (error || !inv || inv.claimed_by || (ownerId && inv.owner_id !== ownerId)) return null;
  const [preview, { data: owner }] = await Promise.all([
    // Link previews in other apps are fetched later: a longer-lived link to the cover.
    invitePreview(admin, inv.kind as "trip" | "event", inv.target_id as string, 30),
    admin.from("profiles").select("username, display_name, avatar_url").eq("id", inv.owner_id).maybeSingle(),
  ]);
  if (!preview || !owner) return null;
  return {
    token,
    kind: inv.kind as "trip" | "event",
    targetId: inv.target_id as string,
    ownerId: inv.owner_id as string,
    ownerName: owner.display_name as string,
    ownerAvatar: (owner.avatar_url as string | null) ?? null,
    ownerUsername: owner.username as string,
    ...preview,
  };
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
