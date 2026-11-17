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
  /** They made their own memory of it, linked to this one (migration 078): its id. */
  own_target_id?: string | null;
  person: CollabPerson | null;
};

const PERSON = "id, username, display_name, avatar_url";
const one = <T,>(x: unknown) => (Array.isArray(x) ? x[0] : x) as T | null;
const FIELDS = "id, kind, target_id, owner_id, user_id, status, can_edit, own_target_id";
const FIELDS_075 = "id, kind, target_id, owner_id, user_id, status, can_edit";

/** The rows, with own_target_id once migration 078 is in (and without it before). */
async function collabRows<T>(
  build: (fields: string) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
  withPerson: boolean
): Promise<T[] | null> {
  const person = withPerson ? `, person:profiles!post_collaborators_user_id_fkey(${PERSON})` : "";
  let { data, error } = await build(FIELDS + person);
  if (error) ({ data, error } = await build(FIELDS_075 + person));
  if (error) return null;
  return (data ?? []).map((r) => (withPerson ? { ...(r as object), person: one<CollabPerson>((r as { person: unknown }).person) } : r) as T);
}

/** Everyone invited to or part of one trip or event (whom the viewer may see), with their profiles. */
export async function loadCollaborators(supabase: SupabaseClient, kind: CollabKind, targetId: string): Promise<Collaborator[]> {
  const rows = await collabRows<Collaborator>(
    (f) => supabase.from("post_collaborators").select(f).eq("kind", kind).eq("target_id", targetId).order("created_at", { ascending: true }),
    true
  );
  // Before migration 075 there's no table: no collaborators.
  return rows ?? [];
}

/** The accepted collaborators of many posts at once, by "kind:id". */
export async function loadCollaboratorsFor(supabase: SupabaseClient, kind: CollabKind, targetIds: string[]): Promise<Map<string, Collaborator[]>> {
  const out = new Map<string, Collaborator[]>();
  if (!targetIds.length) return out;
  const rows = await collabRows<Collaborator>(
    (f) => supabase.from("post_collaborators").select(f).eq("kind", kind).eq("status", "accepted").in("target_id", targetIds.slice(0, 300)),
    true
  );
  for (const c of rows ?? []) {
    out.set(`${kind}:${c.target_id}`, [...(out.get(`${kind}:${c.target_id}`) ?? []), c]);
  }
  return out;
}

/**
 * Someone's own part in others' posts: the trips and events they joined (or
 * were invited to). Ones they made their own memory of aren't here: that
 * memory is already theirs, so the original would only show twice.
 */
export async function loadMyCollabs(
  supabase: SupabaseClient,
  userId: string,
  status: "accepted" | "invited" = "accepted"
): Promise<{ id: string; kind: CollabKind; target_id: string; owner_id: string; can_edit: boolean }[]> {
  type Row = { id: string; kind: CollabKind; target_id: string; owner_id: string; can_edit: boolean; own_target_id?: string | null };
  const rows = await collabRows<Row>((f) => supabase.from("post_collaborators").select(f).eq("user_id", userId).eq("status", status), false);
  return (rows ?? []).filter((r) => !r.own_target_id);
}

export type MomentPerson = { person: CollabPerson; href: string; own: boolean; current: boolean };
export type Moment = {
  kind: CollabKind;
  /** The original trip or event, its poster first. */
  originId: string;
  /** The poster and everyone who made their own memory: each with a link to theirs. */
  memories: MomentPerson[];
  /** People who joined the poster's memory (no post of their own). */
  joined: CollabPerson[];
};

/**
 * Everyone on one trip or event, seen from it or from someone's own linked
 * memory of it: the poster's memory first, then each own memory (each its
 * own post and page), and the people who just joined. Null when it's no one's
 * shared memory. What the viewer may see decides what's linked.
 */
export async function loadMoment(supabase: SupabaseClient, kind: CollabKind, id: string, hrefFor: (username: string, id: string) => string): Promise<Moment | null> {
  // Opened from someone's own memory: the original it's linked to.
  const { data: link, error } = await supabase.from("post_collaborators").select("target_id").eq("kind", kind).eq("own_target_id", id).maybeSingle();
  const originId = !error && link ? (link.target_id as string) : id;
  const people = (await loadCollaborators(supabase, kind, originId)).filter((c) => c.status === "accepted" && c.person);
  if (!people.length) return null;
  const ownerId = people[0].owner_id;
  const { data: owner } = await supabase.from("profiles").select(PERSON).eq("id", ownerId).maybeSingle();
  const memories: MomentPerson[] = [];
  if (owner) memories.push({ person: owner as CollabPerson, href: hrefFor((owner as CollabPerson).username, originId), own: false, current: originId === id });
  for (const c of people) {
    if (c.own_target_id) memories.push({ person: c.person!, href: hrefFor(c.person!.username, c.own_target_id), own: true, current: c.own_target_id === id });
  }
  return { kind, originId, memories, joined: people.filter((c) => !c.own_target_id).map((c) => c.person!) };
}

/** "Mark & Melody", "Mark, Melody & Anna", "Mark, Melody & 3 others" — first names. */
export function namesTogether(names: string[]): string {
  const first = names.map((n) => n.trim().split(" ")[0]).filter(Boolean);
  if (first.length <= 1) return first[0] ?? "";
  if (first.length <= 3) return `${first.slice(0, -1).join(", ")} & ${first.at(-1)}`;
  return `${first.slice(0, 2).join(", ")} & ${first.length - 2} others`;
}
