"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Sparkles, UserPlus, X } from "lucide-react";
import { FollowButton } from "@/components/FollowButton";
import { FaceStack } from "./FaceStack";
import { createClient } from "@/lib/supabase/client";
import { tapLight } from "@/lib/haptics";
import type { Suggestion } from "@/lib/suggestPeople";

/**
 * "Suggested for you": a row of people cards to swipe through, each with
 * why (mutuals with their faces, "Follows you", a shared event, home
 * country), Follow, and × to never suggest them again.
 */
export function SuggestedPeople({
  people,
  title = "Suggested for you",
  seeAll = "/explore/people",
  grid = false,
}: {
  people: Suggestion[];
  title?: string | null;
  seeAll?: string | null;
  /** All of them in a grid (the See all page) instead of a row to swipe. */
  grid?: boolean;
}) {
  const [gone, setGone] = useState<Set<string>>(new Set());
  const list = people.filter((p) => !gone.has(p.id));
  if (!list.length) return grid ? <p className="mt-10 text-center text-sm text-muted">No suggestions right now. They appear as more people join and add their trips.</p> : null;

  function dismiss(id: string) {
    tapLight();
    setGone((g) => new Set(g).add(id));
    void createClient().from("suggestion_dismissals").insert({ dismissed_id: id }).then(() => {});
  }

  return (
    <section aria-labelledby="suggested-h">
      <div className="flex items-end justify-between gap-3">
        {title && (
          <h2 id="suggested-h" className="font-serif text-xl leading-tight">
            {title}
          </h2>
        )}
        {seeAll && (
          <Link href={seeAll} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-accent">
            See all <ArrowRight size={14} aria-hidden />
          </Link>
        )}
      </div>
      <ul className={grid ? "mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3" : "no-scrollbar -mx-5 mt-3 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-2"}>
        {list.map((p) => (
          <li key={p.id} className={`suggest-in relative flex ${grid ? "" : "w-44 shrink-0 snap-start"} flex-col items-center rounded-2xl border border-line bg-surface px-3 pb-3 pt-5 text-center shadow-sm`}>
            <button
              type="button"
              onClick={() => dismiss(p.id)}
              aria-label={`Don't suggest ${p.display_name}`}
              className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-raised hover:text-ink"
            >
              <X size={16} />
            </button>
            <Link href={`/u/${p.username}`} className="group flex w-full flex-col items-center">
              <span
                className="relative flex h-24 w-24 flex-none items-center justify-center overflow-hidden rounded-full bg-accent-soft font-serif text-3xl text-accent ring-2 ring-accent/30 ring-offset-2 ring-offset-surface"
                style={{ aspectRatio: "1 / 1" }}
              >
                {p.avatar_url ? <Image src={p.avatar_url} alt="" fill sizes="96px" className="rounded-full object-cover" /> : p.display_name.charAt(0)}
              </span>
              <span className="mt-3 block w-full truncate font-medium group-hover:text-accent">{p.display_name}</span>
              <span className="block w-full truncate text-xs text-muted">@{p.username}</span>
            </Link>
            <span className="mt-1.5 flex h-6 min-w-0 max-w-full items-center justify-center gap-1.5 text-xs text-muted">
              {p.faces.length > 0 ? (
                <FaceStack people={p.faces} size={20} className="shrink-0" />
              ) : p.why.kind === "follows_you" || p.why.kind === "new" ? (
                <Sparkles size={13} className="shrink-0 text-accent" aria-hidden />
              ) : null}
              <span className="truncate">{p.why.text}</span>
            </span>
            <div className="mt-3 w-full">
              <FollowButton targetId={p.id} visibility={p.visibility} initialFollowing={false} back={p.why.kind === "follows_you"} full compact refresh={false} />
            </div>
          </li>
        ))}
        {!grid && (
          // The last card: bring your own friends.
          <li className="flex w-44 shrink-0 snap-start">
            <Link href="/invite" className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-accent/40 px-3 py-5 text-center hover:border-accent">
              <span className="flex h-16 w-16 items-center justify-center rounded-full gradient-travel text-white shadow-md">
                <UserPlus size={26} aria-hidden />
              </span>
              <span className="mt-3 font-medium">Invite friends</span>
              <span className="mt-1 text-xs text-muted">You&rsquo;ll follow each other when they join</span>
            </Link>
          </li>
        )}
      </ul>
      <style>{`.suggest-in{animation:suggest-in .4s cubic-bezier(.2,.9,.3,1) both}@keyframes suggest-in{from{opacity:0;transform:translateY(8px)}}@media (prefers-reduced-motion:reduce){.suggest-in{animation:none}}`}</style>
    </section>
  );
}
