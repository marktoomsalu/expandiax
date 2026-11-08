import { NAME_ALIASES } from "./countries";

/**
 * Lower case without accents, so "Tur" finds Türkiye, "Cote" finds Côte
 * d'Ivoire and "Sao" finds São Tomé - for keyboards that don't have the
 * letter, and people who don't know it's there.
 */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/ß/g, "ss")
    .replace(/ı/g, "i")
    .replace(/ł/g, "l")
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[’`]/g, "'")
    .trim();
}

const ALIASES_BY_CODE = new Map<string, string[]>();
for (const [alias, code] of Object.entries(NAME_ALIASES)) ALIASES_BY_CODE.set(code, [...(ALIASES_BY_CODE.get(code) ?? []), fold(alias)]);

/**
 * Places whose name (or another common name, like "Turkey") matches what
 * was typed, best first: names that start with it, then a word in the name
 * that does, then other names, then anything containing it.
 */
export function searchPlaces<T extends { code: string; name: string }>(query: string, places: T[], limit = 8): T[] {
  const q = fold(query);
  if (!q) return [];
  const rank = (p: T): number => {
    const name = fold(p.name);
    if (p.code.toLowerCase() === q || name.startsWith(q)) return 0;
    if (name.split(/[\s\-'(]+/).some((w) => w.startsWith(q))) return 1;
    const aliases = ALIASES_BY_CODE.get(p.code) ?? [];
    if (aliases.some((a) => a.startsWith(q))) return 2;
    if (name.includes(q) || aliases.some((a) => a.includes(q))) return 3;
    return -1;
  };
  return places
    .map((p) => ({ p, r: rank(p) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.p.name.localeCompare(b.p.name))
    .slice(0, limit)
    .map((x) => x.p);
}
