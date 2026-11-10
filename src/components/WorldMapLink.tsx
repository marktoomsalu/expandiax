"use client";

import { WorldMap } from "./WorldMap";

/**
 * The globe on a profile: turn it, zoom it, and tap a country to see its
 * name. A tap doesn't open anything; the trips and the Countries list do.
 */
export function WorldMapLink({
  visitedCodes,
  visitCounts,
  homeCode,
  livedCodes,
}: {
  visitedCodes: string[];
  visitCounts?: Record<string, number>;
  homeCode?: string | null;
  livedCodes?: string[];
  username?: string;
}) {
  return <WorldMap visitedCodes={visitedCodes} visitCounts={visitCounts} homeCode={homeCode} livedCodes={livedCodes} />;
}
