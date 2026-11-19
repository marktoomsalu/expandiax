"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, Link2, Loader2, LogOut, Pencil, Search, Share2, UserPlus, Users, X } from "lucide-react";
import { Basket } from "./Basket";
import { createClient } from "@/lib/supabase/client";
import type { CollabKind, CollabPerson, Collaborator } from "@/lib/collab";
import type { Companion } from "@/lib/companions";
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

type Link = { id: string; token: string; name: string; sent_at?: string | null };
const MAX = 20;
const DISMISSED = "expandiax:companions-no";

/**
 * Who was with you on this trip or event (migrations 075, 078). Its owner
 * adds people: each then chooses to join this memory or create their own,
 * linked. Up to 20, links for people not on ExpandiaX yet included. People
 * who joined can be allowed to add photos. A collaborator sees who's on it
 * and can leave.
 */
export function CollaboratorsManager({
  kind,
  targetId,
  me,
  isOwner,
  initial,
  myUsername,
  suggestions = [],
}: {
  kind: CollabKind;
  targetId: string;
  me: string;
  isOwner: boolean;
  initial: Collaborator[];
  myUsername?: string;
  suggestions?: Companion[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [people, setPeople] = useState(initial);
  const [links, setLinks] = useState<Link[]>([]);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<CollabPerson[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noThanks, setNoThanks] = useState<string[]>([]);
  const [inviting, setInviting] = useState(false);
  const [newName, setNewName] = useState("");
  const [shared, setShared] = useState<string | null>(null);
  const noun = kind === "trip" ? "trip" : "event";

  useEffect(() => setPeople(initial), [initial]);
  useEffect(() => {
    try {
      setNoThanks(JSON.parse(localStorage.getItem(DISMISSED) ?? "[]") as string[]);
    } catch {}
  }, []);

  // Links sent to people not on ExpandiaX yet (migration 078).
  useEffect(() => {
    if (!isOwner) return;
    const load = (fields: string) =>
      supabase.from("moment_invites").select(fields).eq("kind", kind).eq("target_id", targetId).is("claimed_by", null).order("created_at", { ascending: true });
    void (async () => {
      // sent_at arrives with migration 079.
      let { data, error: err } = await load("id, token, name, sent_at");
      if (err) ({ data, error: err } = await load("id, token, name"));
      if (!err) setLinks((data ?? []) as unknown as Link[]);
    })();
  }, [isOwner, kind, targetId, supabase]);

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

  const count = people.filter((p) => p.status !== "declined").length + links.length;
  const full = count >= MAX;

  async function invite(p: { id: string }) {
    setBusy(p.id);
    setError(null);
    const { data, error: err } = await supabase.rpc("invite_collaborator", { p_kind: kind, p_target: targetId, p_user: p.id });
    setBusy(null);
    if (err || (data !== "ok" && data !== null)) {
      setError(data === "too_many" ? `Up to ${MAX} people can be on one ${noun}.` : data === "blocked" ? "You can't add this person." : "Couldn't add them. Try again.");
      return;
    }
    setQ("");
    setFound([]);
    await reload();
  }

  function dismiss(id: string) {
    const next = [...noThanks, `${targetId}:${id}`];
    setNoThanks(next);
    try {
      localStorage.setItem(DISMISSED, JSON.stringify(next.slice(-200)));
    } catch {}
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

  const linkUrl = (token: string) => `${window.location.origin}/join/${myUsername ?? ""}?m=${token}`;
  // Sent only once it's really been shared (the share sheet finished) or copied.
  async function shareLink(l: Link) {
    const url = linkUrl(l.token);
    const text = `You were part of this memory! I added you to our ${noun} on ExpandiaX.`;
    try {
      if (navigator.share) await navigator.share({ text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setShared(l.id);
      }
    } catch {
      return; // Closed the share sheet: not sent.
    }
    setLinks((cur) => cur.map((x) => (x.id === l.id ? { ...x, sent_at: x.sent_at ?? new Date().toISOString() } : x)));
    await supabase.rpc("mark_moment_invite_sent", { p_id: l.id });
  }

  async function createLink() {
    setBusy("link");
    setError(null);
    const { data, error: err } = await supabase.rpc("create_moment_invite", { p_kind: kind, p_target: targetId, p_name: newName.trim() });
    setBusy(null);
    if (err || !data || data === "too_many") {
      setError(data === "too_many" ? `Up to ${MAX} people can be on one ${noun}.` : "Couldn't make a link. Try again.");
      return;
    }
    const { data: row } = await supabase.from("moment_invites").select("id, token, name").eq("token", data as string).maybeSingle();
    if (row) {
      setLinks((cur) => [...cur, row as Link]);
      void shareLink(row as Link);
    }
    setNewName("");
    setInviting(false);
  }

  async function dropLink(l: Link) {
    setLinks((cur) => cur.filter((x) => x.id !== l.id));
    await supabase.from("moment_invites").delete().eq("id", l.id);
  }

  const taken = new Set(people.filter((p) => p.status !== "declined").map((p) => p.user_id));
  const mine = people.find((p) => p.user_id === me);
  const suggested = isOwner ? suggestions.filter((s) => !taken.has(s.id) && !noThanks.includes(`${targetId}:${s.id}`)) : [];
  const status = (c: Collaborator) =>
    c.status === "invited"
      ? "Invitation sent · waiting for them to choose"
      : c.status === "declined"
        ? "Declined"
        : c.own_target_id
        ? "Their own memory, linked"
        : "Joined your memory";

  return (
    <div className="space-y-3">
      {/* "Anna was also in Portugal 13 – 15 Aug. Were you together?" */}
      {!full &&
        suggested.slice(0, 2).map((s) => (
          <div key={s.id} className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent-soft/50 px-3 py-2.5">
            <Avatar p={s} />
            <span className="min-w-0 flex-1 text-sm leading-snug">
              <span className="font-medium">{s.display_name.split(" ")[0]}</span> {s.reason}. Were you together?
            </span>
            <button type="button" onClick={() => void invite(s)} disabled={busy === s.id} className="btn-accent !px-3 !py-1.5 text-xs">
              {busy === s.id ? <Loader2 size={13} className="animate-spin" /> : "Add"}
            </button>
            <button type="button" onClick={() => dismiss(s.id)} className="px-1 text-xs text-muted hover:text-ink">
              No
            </button>
          </div>
        ))}

      {isOwner && <p className="text-right text-xs text-muted">{count} of {MAX}</p>}

      {(people.length > 0 || links.length > 0) && (
        <ul className="space-y-2">
          {people.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-xl border border-line bg-raised/40 px-3 py-2">
              <Avatar p={c.person} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{c.person?.display_name ?? "Someone"}</span>
                <span className="block text-xs text-muted">{status(c)}</span>
              </span>
              {isOwner && c.status === "declined" && !full && (
                <button type="button" onClick={() => c.person && void invite(c.person)} disabled={busy === c.person?.id} className="shrink-0 rounded-full border border-line px-2.5 py-1 text-xs font-medium text-muted hover:text-ink">
                  Invite again
                </button>
              )}
              {isOwner && c.status === "accepted" && !c.own_target_id && (
                <button
                  type="button"
                  onClick={() => void setEdit(c, !c.can_edit)}
                  disabled={busy === c.id}
                  aria-pressed={c.can_edit}
                  title={c.can_edit ? "They can add photos and change the details. Tap to take that away." : "Let them add photos and change the details too"}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    c.can_edit ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-ink"
                  )}
                >
                  <Pencil size={11} aria-hidden /> {c.can_edit ? "Can add photos" : "View only"}
                </button>
              )}
              {isOwner && (
                <button type="button" onClick={() => void remove(c)} disabled={busy === c.id} aria-label={`Remove ${c.person?.display_name ?? "them"}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-raised hover:text-ink">
                  {busy === c.id ? <Loader2 size={14} className="animate-spin" /> : <X size={15} />}
                </button>
              )}
            </li>
          ))}
          {links.map((l) => (
            <li key={l.id} className="flex items-center gap-3 rounded-xl border border-dashed border-accent/50 px-3 py-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed border-accent font-serif text-accent">
                {(l.name || "?").slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{l.name || "Someone new"}</span>
                <span className="block text-xs text-muted">
                  {shared === l.id ? "Link copied · paste it to them" : l.sent_at ? "Invitation sent · not on ExpandiaX yet" : "Not on ExpandiaX yet · not sent"}
                </span>
              </span>
              {l.sent_at ? (
                <button type="button" onClick={() => void shareLink(l)} aria-label="Send the invitation again" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-raised hover:text-ink">
                  <Share2 size={14} />
                </button>
              ) : (
                <button type="button" onClick={() => void shareLink(l)} className="btn-accent shrink-0 !px-3 !py-1.5 text-xs">
                  <Share2 size={12} /> Send invite
                </button>
              )}
              <button type="button" onClick={() => void dropLink(l)} aria-label="Remove the link" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-raised hover:text-ink">
                <X size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {isOwner && !full && (
        <div>
          <label htmlFor={`collab-search-${targetId}`} className="sr-only">Add someone who was with you</label>
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
                        <UserPlus size={14} aria-hidden /> Invite
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Someone not on ExpandiaX yet: a link, and after joining they choose like everyone else. */}
          {myUsername &&
            (inviting ? (
              <div className="mt-3 flex gap-2">
                <label htmlFor={`collab-new-${targetId}`} className="sr-only">Their name</label>
                <input
                  id={`collab-new-${targetId}`}
                  className="field min-w-0 flex-1"
                  placeholder="Their name"
                  value={newName}
                  maxLength={60}
                  autoFocus
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void createLink();
                    }
                  }}
                />
                <button type="button" onClick={() => void createLink()} disabled={busy === "link"} className="btn-accent !px-3.5 text-sm">
                  {busy === "link" ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />} Invite
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setInviting(true)} className="mt-3 text-sm font-medium text-accent hover:underline">
                Someone not on ExpandiaX yet
              </button>
            ))}
        </div>
      )}
      {isOwner && full && <p className="text-xs text-muted">That&rsquo;s {MAX} people, the most one {noun} can have.</p>}

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
 * "Who was with you?" on a trip's or event's edit page, just above Save:
 * the people who were there with you. Each chooses to join your memory or
 * create their own, linked to yours.
 */
export function WhoWasThere(props: {
  kind: CollabKind;
  targetId: string;
  me: string;
  isOwner: boolean;
  initial: Collaborator[];
  myUsername?: string;
  suggestions?: Companion[];
}) {
  return (
    <Basket
      id="collaborators"
      icon={Users}
      title={props.kind === "trip" ? "Who was with you?" : "Who went with you?"}
      hint={
        props.isOwner
          ? "Invite them: each can join your memory (no post of their own needed) or link their own."
          : `You're on this ${props.kind}.`
      }
    >
      <CollaboratorsManager {...props} />
    </Basket>
  );
}
