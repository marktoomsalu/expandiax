"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { PartyPopper } from "lucide-react";
import { readInvite } from "@/lib/invite";
import { tapSuccess } from "@/lib/haptics";

type Inviter = { username: string; display_name: string; avatar_url: string | null };

/**
 * On /onboarding, right after signing up: if a friend's invite link brought
 * you here, you two now follow each other (and it says so). Otherwise, a
 * small "Did a friend invite you?" for when the link was opened elsewhere
 * (say, in Safari before installing the app).
 */
export function AcceptInvite() {
  const [inviter, setInviter] = useState<Inviter | null>(null);
  const [asking, setAsking] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  async function accept(username?: string) {
    const res = await fetch("/api/invite/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(username ? { username } : {}) });
    const data = (await res.json().catch(() => ({}))) as { status?: string; inviter?: Inviter | null };
    if ((data.status === "ok" || data.status === "already") && data.inviter) {
      tapSuccess();
      setInviter(data.inviter);
      setAsking(false);
      return;
    }
    if (username) setProblem(data.status === "unknown" ? "Nobody by that username. Check the spelling?" : data.status === "self" ? "That's you!" : "That didn't work. You can follow them from their profile.");
    else if (data.status === "none") setAsking(true);
  }

  useEffect(() => {
    void accept(readInvite() ?? undefined);
  }, []);

  if (inviter) {
    const first = inviter.display_name.trim().split(" ")[0];
    return (
      <div className="mb-8 flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3">
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface font-serif text-accent ring-2 ring-accent">
          {inviter.avatar_url ? <Image src={inviter.avatar_url} alt="" fill sizes="44px" className="object-cover" /> : first.charAt(0)}
        </span>
        <p className="text-sm">
          <span className="font-semibold">You and {first} now follow each other.</span>{" "}
          <PartyPopper size={14} className="inline text-accent" aria-hidden /> Their trips will be in your feed.
        </p>
      </div>
    );
  }
  if (!asking) return null;
  return (
    <div className="mb-8">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-accent">
          Did a friend invite you?
        </button>
      ) : (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setProblem(null);
            if (name.trim()) void accept(name.trim().toLowerCase());
          }}
        >
          <label htmlFor="inviter" className="w-full text-sm">
            Their username, and you&rsquo;ll follow each other
          </label>
          <input id="inviter" className="field flex-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="@username" autoCapitalize="none" autoCorrect="off" />
          <button type="submit" className="btn-accent">
            Connect
          </button>
          {problem && <p className="w-full text-xs text-red-700 dark:text-red-400">{problem}</p>}
        </form>
      )}
    </div>
  );
}
