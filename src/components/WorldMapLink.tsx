"use client";

import { useRouter } from "next/navigation";
import { WorldMap } from "./WorldMap";

export function WorldMapLink({
  visitedCodes,
  visitCounts,
  homeCode,
  username,
}: {
  visitedCodes: string[];
  visitCounts?: Record<string, number>;
  homeCode?: string | null;
  username: string;
}) {
  const router = useRouter();
  const set = new Set(visitedCodes);
  return (
    <WorldMap
      visitedCodes={visitedCodes}
      visitCounts={visitCounts}
      homeCode={homeCode}
      onSelect={(code) => {
        if (set.has(code)) router.push(`/u/${username}/countries/${code.toLowerCase()}`);
      }}
    />
  );
}
