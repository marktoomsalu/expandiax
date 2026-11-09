"use client";

import { useRouter } from "next/navigation";
import { WorldMap } from "./WorldMap";
import { CountrySearch } from "./CountrySearch";
import { MapLegend } from "./MapLegend";

export function MapNavigator({
  visitedCodes,
  visitCounts,
  homeCode,
  livedCodes = [],
  dreamCodes = [],
}: {
  visitedCodes: string[];
  visitCounts?: Record<string, number>;
  homeCode?: string | null;
  livedCodes?: string[];
  dreamCodes?: string[];
}) {
  const router = useRouter();
  const go = (code: string) => router.push(`/my-world/${code.toLowerCase()}`);
  return (
    <div id="country-search">
      <CountrySearch onSelect={go} visitedCodes={visitedCodes} className="max-w-md" />
      <div className="mt-4 overflow-hidden rounded-card border border-line bg-surface p-1.5 sm:p-3">
        <WorldMap
          visitedCodes={visitedCodes}
          visitCounts={visitCounts}
          homeCode={homeCode}
          livedCodes={livedCodes}
          dreamCodes={dreamCodes}
          onSelect={go}
        />
        <MapLegend
          hasHome={!!homeCode}
          hasLived={livedCodes.length > 0}
          hasDreams={dreamCodes.some((c) => !visitedCodes.includes(c))}
          hint="Click a country, or search above - every country is reachable by search."
        />
      </div>
    </div>
  );
}
