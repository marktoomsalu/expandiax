"use client";

import { useRouter } from "next/navigation";
import { WorldMap } from "./WorldMap";

export function WorldMapLink({
  visitedCodes,
  visitCounts,
  username,
}: {
  visitedCodes: string[];
  visitCounts?: Record<string, number>;
  username: string;
}) {
  const router = useRouter();
  const set = new Set(visitedCodes);
  return (
    <WorldMap
      visitedCodes={visitedCodes}
      visitCounts={visitCounts}
      onSelect={(code) => {
        if (set.has(code)) router.push(`/u/${username}/countries/${code.toLowerCase()}`);
      }}
    />
  );
}
