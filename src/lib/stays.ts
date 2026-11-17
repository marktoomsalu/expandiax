// A country's stays are trips or somewhere you lived. The map counts only
// trips as visits ("visited 2x"), and shows places you lived in pink, the
// same as home. A trip taken while you lived in that country (its start
// falls inside the stay) is part of that time there, not another visit: it
// keeps its own page and post, but isn't counted again.

type Stay = { kind?: string | null; visited_from?: string | null; visited_to?: string | null };
type CountryStays = { country_code: string; country_visits: Stay[] };

/**
 * The stay (somewhere they lived) a trip happened during, if any: the trip
 * starts on or after the stay began and before it ended, or the stay is
 * still going on. Both need real dates (a year alone can't tell).
 */
export function stayDuring<T extends Stay>(trip: Stay, stays: T[]): T | null {
  if (trip.kind === "lived" || !trip.visited_from) return null;
  const start = trip.visited_from;
  return stays.find((s) => s.kind === "lived" && !!s.visited_from && start >= s.visited_from && (!s.visited_to || start <= s.visited_to)) ?? null;
}

/** The trips that happened while living somewhere (`stay`), from all of that country's stays. */
export function tripsDuring<T extends Stay & { id: string }>(stay: T, all: T[]): T[] {
  if (stay.kind !== "lived") return [];
  return all.filter((t) => t.id !== stay.id && stayDuring(t, [stay]) === stay);
}

export function mapStays(countries: CountryStays[]): { visitCounts: Record<string, number>; livedCodes: string[] } {
  const visitCounts: Record<string, number> = {};
  const livedCodes: string[] = [];
  for (const c of countries) {
    const stays = c.country_visits ?? [];
    visitCounts[c.country_code] = stays.filter((s) => s.kind !== "lived" && !stayDuring(s, stays)).length;
    if (stays.some((s) => s.kind === "lived")) livedCodes.push(c.country_code);
  }
  return { visitCounts, livedCodes };
}
