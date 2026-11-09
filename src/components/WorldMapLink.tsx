"use client";

import { useRouter } from "next/navigation";
import { WorldMap } from "./WorldMap";

export function WorldMapLink({
  visitedCodes,
  visitCounts,
  homeCode,
  livedCodes,
  username,
}: {
  visitedCodes: string[];
  visitCounts?: Record<string, number>;
  homeCode?: string | null;
  livedCodes?: string[];
  username: string;
}) {
  const router = useRouter();
  const set = new Set(visitedCodes);
  return (
    <WorldMap
      visitedCodes={visitedCodes}
      visitCounts={visitCounts}
      homeCode={homeCode}
      livedCodes={livedCodes}
      onSelect={(code) => {
        if (set.has(code)) router.push(`/u/${username}/countries/${code.toLowerCase()}`);
      }}
    />
  );
}
