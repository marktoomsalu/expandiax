// A country's stays are trips or somewhere you lived. The map counts only
// trips as visits ("visited 2x"), and shows places you lived in pink, the
// same as home.

type Stay = { kind?: string | null };
type CountryStays = { country_code: string; country_visits: Stay[] };

export function mapStays(countries: CountryStays[]): { visitCounts: Record<string, number>; livedCodes: string[] } {
  const visitCounts: Record<string, number> = {};
  const livedCodes: string[] = [];
  for (const c of countries) {
    const stays = c.country_visits ?? [];
    visitCounts[c.country_code] = stays.filter((s) => s.kind !== "lived").length;
    if (stays.some((s) => s.kind === "lived")) livedCodes.push(c.country_code);
  }
  return { visitCounts, livedCodes };
}
