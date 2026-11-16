"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, Loader2, LogOut, Pencil, Search, UserPlus, Users, X } from "lucide-react";
import { Basket } from "./Basket";
import { createClient } from "@/lib/supabase/client";
import type { CollabKind, CollabPerson, Collaborator } from "@/lib/collab";
import { cn } from "@/lib/utils";

function Avatar({ p, size = 36 }: { p: CollabPerson | null; size?: number }) {
  return (
    <span className="relative shrink-0 overflow-hidden rounded-full bg-raised" style={{ width: size, height: size }}>
      {p?.avatar_url ? (
        <Image src={p.avatar_url} alt="" fill sizes={`${size}px`} className="object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-serif text-accent">{p?.display_name.slice(0, 1) ?? "?"}</span>
      )}
    </span>
  );
}

/**
 * Who shared this trip or event. Its owner invites people (they're asked
 * first, and it's on their profile only once they accept), gives or takes
 * edit rights, and removes people. A collaborator sees who's on it and can
 * leave (the post stays for everyone else).
 */
export function CollaboratorsManager({
  kind,
  targetId,
  me,
  isOwner,
  initial,
}: {
  kind: CollabKind;
  targetId: string;
  me: string;
  isOwner: boolean;
  initial: Collaborator[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [people, setPeople] = useState(initial);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<CollabPerson[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const noun = kind === "trip" ? "trip" : "event";

  useEffect(() => setPeople(initial), [initial]);

  useEffect(() => {
    if (!isOwner) return;
    const term = q.replace(/[%_,()*\\:.]/g, " ").trim();
    if (term.length < 2) {
      setFound([]);
      return;
    }
    let alive = true;
    const t = setTimeout(async () => {
      const like = `%${term}%`;
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .or(`display_name.ilike.${like},username.ilike.${like}`)
        .neq("id", me)
        .limit(8);
      if (alive) setFound((data ?? []) as CollabPerson[]);
    }, 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, isOwner, me, supabase]);

  async function reload() {
    const { loadCollaborators } = await import("@/lib/collab");
    setPeople(await loadCollaborators(supabase, kind, targetId));
    router.refresh();
  }

  async function invite(p: CollabPerson) {
    setBusy(p.id);
    setError(null);
    const { data, error: err } = await supabase.rpc("invite_collaborator", { p_kind: kind, p_target: targetId, p_user: p.id });
    setBusy(null);
    if (err || (data !== "ok" && data !== null)) {
      setError(data === "too_many" ? "That's the most people one post can have." : data === "blocked" ? "You can't add this person." : "Couldn't add them. Try again.");
      return;
    }
    setQ("");
    setFound([]);
    await reload();
  }

  async function setEdit(c: Collaborator, can: boolean) {
    setBusy(c.id);
    setPeople((cur) => cur.map((x) => (x.id === c.id ? { ...x, can_edit: can } : x)));
    const { error: err } = await supabase.rpc("set_collab_edit", { p_id: c.id, p_can_edit: can });
    setBusy(null);
    if (err) {
      setError("Couldn't change that. Try again.");
      await reload();
    }
  }

  async function remove(c: Collaborator) {
    setBusy(c.id);
    const { error: err } = await supabase.rpc("remove_collab", { p_id: c.id });
    setBusy(null);
    if (err) {
      setError("Couldn't do that. Try again.");
      return;
    }
    // Leaving your own part: back to your own things.
    if (c.user_id === me) {
      router.push(kind === "trip" ? "/my-world" : "/events");
      router.refresh();
      return;
    }
    await reload();
  }

  const taken = new Set(people.map((p) => p.user_id));
  const mine = people.find((p) => p.user_id === me);

  return (
    <div className="space-y-3">
      {people.length > 0 ? (
        <ul className="space-y-2">
          {people.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-xl border border-line bg-raised/40 px-3 py-2">
              <Avatar p={c.person} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{c.person?.display_name ?? "Someone"}</span>
                <span className="block text-xs text-muted">
                  {c.status === "invited" ? "Waiting for them to accept" : c.can_edit ? "Can edit" : "On this post"}
                </span>
              </span>
              {isOwner && c.status === "accepted" && (
                <button
                  type="button"
                  onClick={() => void setEdit(c, !c.can_edit)}
                  disabled={busy === c.id}
                  aria-pressed={c.can_edit}
                  title={c.can_edit ? "Can add photos and change the details. Tap to take that away." : "Let them add photos and change the details too"}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    c.can_edit ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-ink"
                  )}
                >
                  <Pencil size={11} aria-hidden /> {c.can_edit ? "Can edit" : "View only"}
                </button>
              )}
              {isOwner && (
                <button type="button" onClick={() => void remove(c)} disabled={busy === c.id} aria-label={`Remove ${c.person?.display_name ?? "them"}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-raised hover:text-ink">
                  {busy === c.id ? <Loader2 size={14} className="animate-spin" /> : <X size={15} />}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {isOwner && (
        <div>
          <label htmlFor={`collab-search-${targetId}`} className="sr-only">Add someone who was there</label>
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <input
              id={`collab-search-${targetId}`}
              className="field !pl-9"
              placeholder="Search by name"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              // Inside the event form: Enter searches, it doesn't save the form.
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              autoComplete="off"
            />
          </div>
          {found.length > 0 && (
            <ul className="mt-2 overflow-hidden rounded-xl border border-line bg-surface">
              {found.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={taken.has(p.id) || busy === p.id}
                    onClick={() => void invite(p)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-raised disabled:opacity-60"
                  >
                    <Avatar p={p} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.display_name}</span>
                      <span className="block truncate text-xs text-muted">@{p.username}</span>
                    </span>
                    {taken.has(p.id) ? (
                      <Check size={16} className="text-accent" aria-label="Already added" />
                    ) : busy === p.id ? (
                      <Loader2 size={16} className="animate-spin text-accent" />
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent">
                        <UserPlus size={14} aria-hidden /> Add
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {people.some((c) => c.status === "accepted") && (
            <p className="mt-1.5 text-xs text-muted">&ldquo;Can edit&rdquo; lets them add photos and change the details.</p>
          )}
        </div>
      )}

      {!isOwner && mine && (
        <button type="button" onClick={() => void remove(mine)} disabled={busy === mine.id} className="inline-flex items-center gap-1.5 text-sm font-medium text-red-700 hover:underline dark:text-red-400">
          <LogOut size={14} aria-hidden /> Leave this {noun}
        </button>
      )}

      {error && <p role="alert" className="text-sm text-red-800 dark:text-red-400">{error}</p>}
    </div>
  );
}

/**
 * The "Who was there?" box on a trip or event's edit page, just above Save:
 * add the people who were there, and it's one post on all their profiles.
 */
export function WhoWasThere(props: { kind: CollabKind; targetId: string; me: string; isOwner: boolean; initial: Collaborator[] }) {
  return (
    <Basket
      id="collaborators"
      icon={Users}
      title="Who was there?"
      hint={props.isOwner ? "Add them and it\u2019s on their profile too, as one post. They accept first." : `This ${props.kind} is shared between you.`}
    >
      <CollaboratorsManager {...props} />
    </Basket>
  );
}
