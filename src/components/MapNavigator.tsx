"use client";

import { useRouter } from "next/navigation";
import { WorldMap } from "./WorldMap";
import { CountrySearch } from "./CountrySearch";

export function MapNavigator({ visitedCodes, visitCounts }: { visitedCodes: string[]; visitCounts?: Record<string, number> }) {
  const router = useRouter();
  const go = (code: string) => router.push(`/my-world/${code.toLowerCase()}`);
  return (
    <div>
      <CountrySearch onSelect={go} visitedCodes={visitedCodes} className="max-w-md" />
      <div className="mt-4 overflow-hidden rounded-card border border-line bg-surface p-1.5 sm:p-3">
        <WorldMap visitedCodes={visitedCodes} visitCounts={visitCounts} onSelect={go} />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-2 pb-1 pt-3 text-xs text-muted">
          <span className="flex items-center gap-2">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-accent" /> Visited
          </span>
          <span className="flex items-center gap-2">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-unvisited ring-1 ring-line" /> Not yet
          </span>
          <span className="flex items-center gap-2">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_6px_rgb(var(--accent))]" /> Brighter = visited more than once
          </span>
          <span className="ml-auto hidden sm:block">Click a country, or search above — every country is reachable by search.</span>
        </div>
      </div>
    </div>
  );
}
