import raw from "@/data/countries.json";

export type Country = {
  code: string; // ISO 3166-1 alpha-2
  numeric: string; // ISO 3166-1 numeric, matches world-atlas geography ids
  name: string;
  continent: string;
  flag: string;
  capital: string;
};

// The canonical country list used everywhere in the product:
// 193 UN member states plus Palestine and Vatican City = 195 countries.
export const COUNTRIES = raw as Country[];
export const TOTAL_COUNTRIES = COUNTRIES.length; // 195

export const CONTINENTS = [
  "Africa",
  "Asia",
  "Europe",
  "North America",
  "South America",
  "Oceania",
] as const;

// One vivid, distinct hue per continent — a travel-poster palette used on
// progress bars and legends so "more countries" reads as "more color".
export const CONTINENT_COLORS: Record<(typeof CONTINENTS)[number], string> = {
  Africa: "#f59e0b",
  Asia: "#e11d8f",
  Europe: "#0d9488",
  "North America": "#ff6347",
  "South America": "#7c3aed",
  Oceania: "#0ea5e9",
};

const byCode = new Map(COUNTRIES.map((c) => [c.code, c]));
const byNumeric = new Map(COUNTRIES.map((c) => [c.numeric, c]));

export function countryByCode(code: string | null | undefined): Country | undefined {
  return code ? byCode.get(code.toUpperCase()) : undefined;
}

export function countryByNumeric(numeric: string): Country | undefined {
  return byNumeric.get(numeric);
}

export function continentCounts(codes: string[]) {
  const totals = new Map<string, number>();
  const visited = new Map<string, number>();
  for (const c of COUNTRIES) totals.set(c.continent, (totals.get(c.continent) ?? 0) + 1);
  for (const code of codes) {
    const c = byCode.get(code);
    if (c) visited.set(c.continent, (visited.get(c.continent) ?? 0) + 1);
  }
  return CONTINENTS.map((name) => ({
    name,
    visited: visited.get(name) ?? 0,
    total: totals.get(name) ?? 0,
  }));
}
