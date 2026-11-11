import { COUNTRIES, NAME_ALIASES, countryByCode, type Country } from "./countries";

// Countries matching what's being typed in a search box: "ita" → Italy,
// "holland" → Netherlands, "paris" → France (by its capital). Accents and
// case don't matter. Best matches first: the name starting with it, a word
// in the name starting with it, another name for it, its capital, then the
// name merely containing it.

export type CountryHit = { country: Country; via: string | null; score: number };

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const OTHER_NAMES: [string, string][] = Object.entries(NAME_ALIASES).filter(([name]) => !name.includes(","));

export function matchCountries(query: string, limit = 3): CountryHit[] {
  const q = plain(query);
  if (q.length < 2) return [];
  const best = new Map<string, CountryHit>();
  const offer = (country: Country | undefined, score: number, via: string | null) => {
    if (!country) return;
    const had = best.get(country.code);
    if (!had || score > had.score) best.set(country.code, { country, via, score });
  };
  for (const c of COUNTRIES) {
    const name = plain(c.name);
    if (name === q) offer(c, 5, null);
    else if (name.startsWith(q)) offer(c, 4, null);
    else if (name.split(/[\s-]+/).some((w) => w.startsWith(q))) offer(c, 3, null);
    else if (q.length >= 3 && name.includes(q)) offer(c, 1, null);
    const capital = plain(c.capital ?? "");
    if (capital && q.length >= 3 && capital.startsWith(q)) offer(c, 2, c.capital);
  }
  for (const [name, code] of OTHER_NAMES) {
    if (name.startsWith(q) && q.length >= 2) offer(countryByCode(code), name === q ? 4.5 : 2.5, name.replace(/\b\w/g, (l) => l.toUpperCase()));
  }
  return [...best.values()].sort((a, b) => b.score - a.score || a.country.name.localeCompare(b.country.name)).slice(0, limit);
}
