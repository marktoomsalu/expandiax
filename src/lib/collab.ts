// Collaborative posts (migration 075): a trip or event shared by the people
// who were there. The post stays its owner's — one post, the same photos,
// words, likes and comments — and shows for each collaborator who accepted:
// on their profile, in their Countries or Events, in their stats, and in
// their followers' feeds.

import type { SupabaseClient } from "@supabase/supabase-js";

export type CollabKind = "trip" | "event";

export type CollabPerson = { id: string; username: string; display_name: string; avatar_url: string | null };

export type Collaborator = {
  id: string;
  kind: CollabKind;
  target_id: string;
  owner_id: string;
  user_id: string;
  status: "invited" | "accepted";
  can_edit: boolean;
  person: CollabPerson | null;
};

const PERSON = "id, username, display_name, avatar_url";
const one = <T,>(x: unknown) => (Array.isArray(x) ? x[0] : x) as T | null;

/** Everyone invited to or part of one trip or event (whom the viewer may see), with their profiles. */
export async function loadCollaborators(supabase: SupabaseClient, kind: CollabKind, targetId: string): Promise<Collaborator[]> {
  const { data, error } = await supabase
    .from("post_collaborators")
    .select(`id, kind, target_id, owner_id, user_id, status, can_edit, person:profiles!post_collaborators_user_id_fkey(${PERSON})`)
    .eq("kind", kind)
    .eq("target_id", targetId)
    .order("created_at", { ascending: true });
  // Before migration 075 there's no table: no collaborators.
  if (error) return [];
  return (data ?? []).map((r) => ({ ...(r as unknown as Collaborator), person: one<CollabPerson>((r as { person: unknown }).person) }));
}

/** The accepted collaborators of many posts at once, by "kind:id". */
export async function loadCollaboratorsFor(supabase: SupabaseClient, kind: CollabKind, targetIds: string[]): Promise<Map<string, Collaborator[]>> {
  const out = new Map<string, Collaborator[]>();
  if (!targetIds.length) return out;
  const { data, error } = await supabase
    .from("post_collaborators")
    .select(`id, kind, target_id, owner_id, user_id, status, can_edit, person:profiles!post_collaborators_user_id_fkey(${PERSON})`)
    .eq("kind", kind)
    .eq("status", "accepted")
    .in("target_id", targetIds.slice(0, 300));
  if (error) return out;
  for (const r of data ?? []) {
    const c = { ...(r as unknown as Collaborator), person: one<CollabPerson>((r as { person: unknown }).person) };
    out.set(`${kind}:${c.target_id}`, [...(out.get(`${kind}:${c.target_id}`) ?? []), c]);
  }
  return out;
}

/** Someone's own part in others' posts: the trips and events they've accepted (or been invited to). */
export async function loadMyCollabs(
  supabase: SupabaseClient,
  userId: string,
  status: "accepted" | "invited" = "accepted"
): Promise<{ id: string; kind: CollabKind; target_id: string; owner_id: string; can_edit: boolean }[]> {
  const { data, error } = await supabase
    .from("post_collaborators")
    .select("id, kind, target_id, owner_id, can_edit")
    .eq("user_id", userId)
    .eq("status", status);
  if (error) return [];
  return (data ?? []) as { id: string; kind: CollabKind; target_id: string; owner_id: string; can_edit: boolean }[];
}

/** "Mark & Melody", "Mark, Melody & Anna", "Mark, Melody & 3 others" — first names. */
export function namesTogether(names: string[]): string {
  const first = names.map((n) => n.trim().split(" ")[0]).filter(Boolean);
  if (first.length <= 1) return first[0] ?? "";
  if (first.length <= 3) return `${first.slice(0, -1).join(", ")} & ${first.at(-1)}`;
  return `${first.slice(0, 2).join(", ")} & ${first.length - 2} others`;
}
