"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Plane, RefreshCw } from "lucide-react";
import { tapLight } from "@/lib/haptics";
import { FollowButton } from "@/components/FollowButton";
import type { ClickWith } from "@/lib/exploreData";

type Face = { display_name: string; avatar_url: string | null };

function Passenger({ p, label, href }: { p: Face; label: string; href?: string }) {
  const face = (
    <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-soft font-serif text-xl text-accent ring-2 ring-surface">
      {p.avatar_url ? <Image src={p.avatar_url} alt="" fill sizes="56px" className="object-cover" /> : p.display_name.charAt(0)}
    </span>
  );
  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      {href ? <Link href={href}>{face}</Link> : face}
      <p className="mt-1.5 font-mono text-[9px] tracking-[0.2em] text-muted">{label}</p>
      <p className="max-w-[7.5rem] truncate font-serif text-base leading-tight">{href ? <Link href={href} className="hover:text-accent">{p.display_name}</Link> : p.display_name}</p>
    </div>
  );
}

/** A torn edge between the pass and its stub: two half-circle notches and a dashed line. */
function Perforation() {
  return (
    <div className="relative h-0" aria-hidden>
      <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-canvas" />
      <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-canvas" />
      <span className="absolute inset-x-4 top-0 border-t-2 border-dashed border-line" />
    </div>
  );
}

// Twins you asked to swap, remembered on this phone so they don't come straight back.
const SKIPPED = "expandiax.skippedTwins";
const readSkipped = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(SKIPPED) ?? "[]");
  } catch {
    return [];
  }
};
const writeSkipped = (ids: string[]) => {
  try {
    localStorage.setItem(SKIPPED, JSON.stringify(ids.slice(-50)));
  } catch {
    // Private mode: the swap still works for now.
  }
};

/**
 * Your travel twin as a boarding pass: you and them as passengers, why you
 * match, and a stub with the Follow button. "Someone else" swaps to your
 * next-best match (round again once you've seen them all). Without a twin
 * yet, the pass says how to get one.
 */
export function BoardingPass({ me, twins }: { me: Face & { username: string }; twins: ClickWith[] }) {
  const [skipped, setSkipped] = useState<string[]>([]);
  useEffect(() => setSkipped(readSkipped()), []);
  const fresh = twins.filter((t) => !skipped.includes(t.id));
  // Everyone seen: start again from the best match.
  const twin = fresh[0] ?? twins[0] ?? null;

  function next() {
    if (!twin) return;
    tapLight();
    const seenAll = fresh.length <= 1;
    const nextSkipped = seenAll ? [] : [...skipped.filter((id) => id !== twin.id), twin.id];
    setSkipped(nextSkipped);
    writeSkipped(nextSkipped);
  }

  return (
    <section aria-labelledby="twin-h" className="overflow-hidden rounded-2xl bg-surface shadow-lg shadow-black/5 ring-1 ring-line">
      <div className="gradient-travel flex items-center justify-between px-4 py-2 text-white">
        <h2 id="twin-h" className="font-mono text-[11px] font-semibold tracking-[0.25em]">
          BOARDING PASS
        </h2>
        {twin && twins.length > 1 ? (
          <button
            type="button"
            onClick={next}
            className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 font-mono text-[10px] tracking-[0.15em] text-white hover:bg-white/25"
          >
            <RefreshCw size={11} aria-hidden /> SOMEONE ELSE
          </button>
        ) : (
          <p className="font-mono text-[10px] tracking-[0.2em] text-white/85">YOUR TRAVEL TWIN</p>
        )}
      </div>

      {twin ? (
        <div key={twin.id} className="animate-[twin-in_.35s_ease-out]">
          <style>{`@keyframes twin-in{from{opacity:0;transform:translateX(12px)}}@media (prefers-reduced-motion:reduce){[class*="twin-in"]{animation:none!important}}`}</style>
          <div className="px-4 pb-5 pt-4">
            <div className="flex items-center justify-between gap-2">
              <Passenger p={me} label="PASSENGER" href={`/u/${me.username}`} />
              <div className="flex flex-1 items-center gap-1 px-1 text-accent" aria-hidden>
                <span className="h-px flex-1 border-t border-dashed border-accent/50" />
                <Plane size={18} />
                <span className="h-px flex-1 border-t border-dashed border-accent/50" />
              </div>
              <Passenger p={twin} label="TRAVEL TWIN" href={`/u/${twin.username}`} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <dt className="font-mono text-[9px] tracking-[0.2em] text-muted">WHY YOU MATCH</dt>
                <dd className="mt-0.5 text-sm leading-snug">{twin.reason}</dd>
              </div>
              <div>
                <dt className="font-mono text-[9px] tracking-[0.2em] text-muted">THEIR COUNTRIES</dt>
                <dd className="font-serif text-xl">{twin.countries}</dd>
              </div>
              <div>
                <dt className="font-mono text-[9px] tracking-[0.2em] text-muted">SEAT</dt>
                <dd className="font-serif text-xl">1A</dd>
              </div>
            </dl>
          </div>
          <Perforation />
          <div className="flex items-center justify-between gap-3 px-4 pb-4 pt-5">
            <span
              aria-hidden
              className="h-8 flex-1 opacity-70 [background:repeating-linear-gradient(90deg,currentColor_0_2px,transparent_2px_4px,currentColor_4px_5px,transparent_5px_8px)]"
            />
            <FollowButton key={twin.id} targetId={twin.id} visibility={twin.visibility} initialFollowing={false} refresh={false} />
          </div>
        </div>
      ) : (
        <div className="px-4 py-5">
          <p className="font-serif text-lg leading-snug">Your travel twin is waiting.</p>
          <p className="mt-1 text-sm text-muted">Add a few more countries and the concerts or matches you&rsquo;ve been to - we&rsquo;ll find the person whose world overlaps yours the most.</p>
          <Link href="/my-world" className="btn-ghost mt-3 inline-flex !py-2 text-sm">
            Add to my world
          </Link>
        </div>
      )}
    </section>
  );
}
