"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Images, Loader2, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { tapSuccess } from "@/lib/haptics";

/** Where your own new memory is finished: its edit page. */
export function ownMemoryEditHref(kind: "trip" | "event", id: string, countryCode?: string | null) {
  return kind === "trip" ? `/my-world/${(countryCode ?? "").toLowerCase()}/visits/${id}/edit` : `/events/${id}/edit`;
}

/**
 * Someone added you to their trip or event (migrations 075, 078). You choose
 * how it goes on your profile:
 *   Join their memory: nothing to make; their photos and story show on your
 *   profile too.
 *   Create my own memory: your own trip or event, linked to theirs, with the
 *   dates and places filled in; your own photos and videos.
 * Or "Not me".
 */
export function CollabInviteActions({
  collabId,
  kind,
  ownerName,
  countryCode,
  openHref,
  match = null,
}: {
  collabId: string;
  kind: "trip" | "event";
  ownerName: string;
  countryCode?: string | null;
  openHref: string;
  /** Your own trip or event of the same thing, already logged: linked instead of making a second one. */
  match?: { id: string; label: string } | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"join" | "own" | "no" | null>(null);
  const [done, setDone] = useState<"joined" | "declined" | null>(null);
  const [error, setError] = useState(false);
  const first = ownerName.trim().split(" ")[0] || "their";
  const noun = kind === "trip" ? "trip" : "event";

  async function join() {
    setBusy("join");
    setError(false);
    const { data, error: err } = await createClient().rpc("respond_collab", { p_id: collabId, p_accept: true });
    setBusy(null);
    if (err || data === "not_found") return setError(true);
    tapSuccess();
    setDone("joined");
    router.refresh();
  }

  async function own() {
    setBusy("own");
    setError(false);
    const { data, error: err } = match
      ? await createClient().rpc("link_existing_memory", { p_id: collabId, p_own: match.id })
      : await createClient().rpc("make_own_memory", { p_id: collabId });
    if (err || !data) {
      setBusy(null);
      return setError(true);
    }
    tapSuccess();
    // Linked your own: back to it as it was. A new one: to finish it.
    router.push(match && kind === "trip" ? `/my-world/${(countryCode ?? "").toLowerCase()}/visits/${data}` : ownMemoryEditHref(kind, data as string, countryCode));
    router.refresh();
  }

  async function decline() {
    setBusy("no");
    const { error: err } = await createClient().rpc("respond_collab", { p_id: collabId, p_accept: false });
    setBusy(null);
    if (err) return setError(true);
    setDone("declined");
    router.refresh();
  }

  if (done === "joined") {
    return (
      <p className="mt-2 text-sm text-accent">
        It&rsquo;s on your profile now.{" "}
        <a href={openHref} className="font-medium underline-offset-4 hover:underline">
          Open it
        </a>
      </p>
    );
  }
  if (done === "declined") return <p className="mt-2 text-sm text-muted">Okay, it&rsquo;s not on your profile.</p>;

  const option = "flex w-full items-start gap-3 rounded-2xl border bg-surface p-3 text-left text-ink transition-colors disabled:opacity-60";
  return (
    <div className="mt-2.5 space-y-2">
      <button type="button" onClick={() => void join()} disabled={!!busy} className={`${option} border-accent/60 hover:border-accent`}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
          {busy === "join" ? <Loader2 size={17} className="animate-spin" /> : <MapPin size={17} aria-hidden />}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">Join {first}&rsquo;s memory</span>
          <span className="block text-xs leading-snug text-muted">
            You don&rsquo;t have to make your own post. {first}&rsquo;s photos and story of this {noun} show on your profile too.
          </span>
        </span>
      </button>
      <button type="button" onClick={() => void own()} disabled={!!busy} className={`${option} border-line hover:border-accent`}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-raised text-ink">
          {busy === "own" ? <Loader2 size={17} className="animate-spin" /> : <Images size={17} aria-hidden />}
        </span>
        <span className="min-w-0">
          {match ? (
            <>
              <span className="block text-sm font-semibold">Link my own {noun}</span>
              <span className="block text-xs leading-snug text-muted">
                You already have it: {match.label}. It stays as it is, with your photos, and is linked to {first}&rsquo;s. One {noun}, not two.
              </span>
            </>
          ) : (
            <>
              <span className="block text-sm font-semibold">Create my own memory</span>
              <span className="block text-xs leading-snug text-muted">
                Your own {noun}, linked to {first}&rsquo;s{kind === "trip" ? ", with the dates and places filled in" : ""}. You choose your own photos and videos.
              </span>
            </>
          )}
        </span>
      </button>
      <button type="button" onClick={() => void decline()} disabled={!!busy} className="px-1 py-1.5 text-sm text-muted hover:text-ink">
        {busy === "no" ? "…" : "Not me"}
      </button>
      {error && <p className="text-xs text-red-800 dark:text-red-400">That didn&rsquo;t work. It may no longer be open; try again.</p>}
    </div>
  );
}

/** Joined someone's memory, and now want your own photos and words on it: your own, linked; photos you added come along. */
export function MakeItMineButton({ collabId, kind, ownerName, countryCode }: { collabId: string; kind: "trip" | "event"; ownerName: string; countryCode?: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const first = ownerName.trim().split(" ")[0] || "their";
  async function go() {
    setBusy(true);
    setError(false);
    const { data, error: err } = await createClient().rpc("make_own_memory", { p_id: collabId });
    if (err || !data) {
      setBusy(false);
      return setError(true);
    }
    tapSuccess();
    router.push(ownMemoryEditHref(kind, data as string, countryCode));
    router.refresh();
  }
  return (
    <section className="mt-6 rounded-2xl border border-line bg-surface p-4">
      <p className="font-medium">You joined {first}&rsquo;s memory</p>
      <p className="mt-0.5 text-sm text-muted">
        Want your own photos and words? Make it your own memory: your own {kind}, still linked to {first}&rsquo;s. Nothing is copied, and anything you added moves with you.
      </p>
      <button type="button" onClick={() => void go()} disabled={busy} className="btn-accent mt-3 !py-2 text-sm">
        {busy && <Loader2 size={14} className="animate-spin" />} Make it my own
      </button>
      {error && <p className="mt-1.5 text-xs text-red-800 dark:text-red-400">That didn&rsquo;t work. Try again.</p>}
    </section>
  );
}

/** "I was with Mark" on someone's trip or event: asks them to add you (migration 078). */
export function RequestCollabButton({ kind, targetId, ownerName }: { kind: "trip" | "event"; targetId: string; ownerName: string }) {
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");
  const first = ownerName.trim().split(" ")[0] || "them";
  async function ask() {
    setState("busy");
    const { data, error } = await createClient().rpc("request_collab", { p_kind: kind, p_target: targetId });
    setState(error || (data !== "sent" && data !== "already") ? "error" : "sent");
  }
  if (state === "sent") return <span className="text-sm text-accent">Asked {first} to add you</span>;
  return (
    <span className="inline-flex flex-col">
      <button type="button" onClick={() => void ask()} disabled={state === "busy"} className="btn-ghost !py-2 text-sm">
        {state === "busy" && <Loader2 size={14} className="animate-spin" />} {kind === "trip" ? `I was with ${first}` : `I went with ${first}`}
      </button>
      {state === "error" && <span className="mt-1 text-xs text-red-800 dark:text-red-400">Couldn&rsquo;t ask. Try again.</span>}
    </span>
  );
}

/** On "Lukas was with you and asks to be added": add them (they then choose how it goes on their profile). */
export function AddRequesterButton({ kind, targetId, userId, name }: { kind: "trip" | "event"; targetId: string; userId: string; name: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "added" | "full" | "error">("idle");
  const first = name.trim().split(" ")[0] || "them";
  async function add() {
    setState("busy");
    const { data, error } = await createClient().rpc("invite_collaborator", { p_kind: kind, p_target: targetId, p_user: userId });
    setState(error ? "error" : data === "ok" ? "added" : data === "too_many" ? "full" : "error");
    if (data === "ok") router.refresh();
  }
  if (state === "added") return <p className="mt-2 text-sm text-accent">Added. {first} chooses how it goes on their profile.</p>;
  return (
    <div className="mt-2">
      <button type="button" onClick={() => void add()} disabled={state === "busy"} className="btn-accent !px-3.5 !py-1.5 text-sm">
        {state === "busy" && <Loader2 size={14} className="animate-spin" />} Add {first}
      </button>
      {state === "full" && <p className="mt-1.5 text-xs text-muted">This already has 20 people, the most it can have.</p>}
      {state === "error" && <p className="mt-1.5 text-xs text-red-800 dark:text-red-400">Couldn&rsquo;t add them. Try again.</p>}
    </div>
  );
}

/**
 * On your own memory of someone's trip or event, when you'd already logged
 * it before: use that one instead (what's in this one moves over, and this
 * one goes), so it's one, not two (migration 079).
 */
export function UseExistingButton({ collabId, match, kind, countryCode }: { collabId: string; match: { id: string; label: string }; kind: "trip" | "event"; countryCode?: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function go() {
    setBusy(true);
    setError(false);
    const { data, error: err } = await createClient().rpc("link_existing_memory", { p_id: collabId, p_own: match.id });
    if (err || !data) {
      setBusy(false);
      return setError(true);
    }
    tapSuccess();
    router.push(kind === "trip" ? `/my-world/${(countryCode ?? "").toLowerCase()}/visits/${data}` : `/events/${data}/edit`);
    router.refresh();
  }
  return (
    <section className="mt-6 rounded-2xl border border-accent/40 bg-accent-soft/40 p-4">
      <p className="font-medium">Is this the same {kind} as your {match.label}?</p>
      <p className="mt-0.5 text-sm text-muted">Use that one instead: it stays your {kind}, linked to this one, and anything here moves over. Then it counts once, not twice.</p>
      <button type="button" onClick={() => void go()} disabled={busy} className="btn-accent mt-3 !py-2 text-sm">
        {busy && <Loader2 size={14} className="animate-spin" />} Use my earlier {kind}
      </button>
      {error && <p className="mt-1.5 text-xs text-red-800 dark:text-red-400">That didn&rsquo;t work. Try again.</p>}
    </section>
  );
}
