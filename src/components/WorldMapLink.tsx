"use client";

import { useRouter } from "next/navigation";
import { WorldMap } from "./WorldMap";

export function WorldMapLink({ visitedCodes, username }: { visitedCodes: string[]; username: string }) {
  const router = useRouter();
  const set = new Set(visitedCodes);
  return (
    <WorldMap
      visitedCodes={visitedCodes}
      onSelect={(code) => {
        if (set.has(code)) router.push(`/u/${username}/countries/${code.toLowerCase()}`);
      }}
    />
  );
}
