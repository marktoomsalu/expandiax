"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One places row with a switch between your friends' places and the wider
 * network's — instead of two rows saying nearly the same thing.
 */
export function PlacesSwitch({ friends, network }: { friends: React.ReactNode | null; network: React.ReactNode | null }) {
  const [tab, setTab] = useState<"friends" | "network">(friends ? "friends" : "network");
  const both = !!friends && !!network;
  return (
    <section aria-labelledby="places-h">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="places-h" className="font-serif text-xl leading-tight">
            Postcards from your people
          </h2>
          <p className="mt-0.5 text-xs text-muted">{tab === "friends" ? "Where friends - who follow you back - have been." : "Where others you follow have been."}</p>
        </div>
        <Link
          href={`/explore/places${tab === "network" ? "?circle=network" : ""}`}
          className="inline-flex shrink-0 items-center gap-1 pb-0.5 text-xs font-medium text-accent hover:underline"
        >
          See all <ArrowRight size={13} aria-hidden />
        </Link>
      </div>
      {both && (
        <div role="tablist" aria-label="Whose places" className="mt-3 inline-flex rounded-full border border-line bg-surface p-0.5 text-xs font-semibold">
          {(["friends", "network"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn("rounded-full px-3.5 py-1.5 transition-colors", tab === t ? "bg-accent text-white" : "text-muted hover:text-ink")}
            >
              {t === "friends" ? "Friends" : "Network"}
            </button>
          ))}
        </div>
      )}
      <div>{tab === "friends" ? friends : network}</div>
    </section>
  );
}
