import { COUNTRIES } from "./countries";

// Country names in a chat message, found as they're written ("I loved
// visiting Italy") so they can become links to that country's page, and
// the first one can tag the message with its place.
//
// Careful with words that mean other things too: Jordan and Chad are
// names, Georgia is also a US state, turkey and china are also a bird and
// plates. Those only count written with a capital and right after a
// travel word ("in Turkey", "back from Jordan", "visited Georgia").
// USA, UK and UAE count only in capitals ("us" is just us).

export type Mention = { start: number; end: number; code: string };
export type Segment = { text: string; code?: string };

const EXTRA: Record<string, string> = {
  usa: "US",
  uk: "GB",
  uae: "AE",
  "united states": "US",
  "united kingdom": "GB",
  "great britain": "GB",
  britain: "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  "northern ireland": "GB",
  "czech republic": "CZ",
  czechia: "CZ",
  turkey: "TR",
  türkiye: "TR",
  holland: "NL",
  "the netherlands": "NL",
  burma: "MM",
  "south korea": "KR",
  "north korea": "KP",
  korea: "KR",
  bosnia: "BA",
  vatican: "VA",
  "ivory coast": "CI",
  trinidad: "TT",
  kosova: "XK",
};

const UPPERCASE_ONLY = new Set(["usa", "uk", "uae"]);
const AMBIGUOUS = new Set(["jordan", "chad", "georgia", "turkey", "china", "japan", "guinea", "niger", "panama", "togo", "mali", "oman", "korea"]);
const TRAVEL_CUE = /(?:^|[^\p{L}])(?:in|to|from|into|visit|visits|visited|visiting|trip|travel|travels|travelled|traveled|travelling|traveling|through|across|around|via|been|explore|explored|exploring|flew|fly|flying|moved|living|lived|live|back|tour|toured|touring|holiday|vacation|honeymoon|summer|winter)\s+$/iu;

const byName = new Map<string, string>();
for (const c of COUNTRIES) byName.set(c.name.toLowerCase(), c.code);
for (const [name, code] of Object.entries(EXTRA)) byName.set(name, code);

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Longest first, so "South Korea" wins over "Korea" and "Papua New Guinea" over "Guinea".
const NAMES = [...byName.keys()].sort((a, b) => b.length - a.length);
// (No lookbehind: older iPhones' Safari can't read it. The character
// before a name is matched instead, and skipped.)
const PATTERN = new RegExp(`(^|[^\\p{L}\\p{N}])(${NAMES.map(escape).join("|")})(?![\\p{L}\\p{N}])`, "giu");

/** Where the countries are in this text. */
export function findCountries(text: string): Mention[] {
  const out: Mention[] = [];
  for (const m of text.matchAll(PATTERN)) {
    const word = m[2];
    const key = word.toLowerCase();
    const start = (m.index ?? 0) + m[1].length;
    if (UPPERCASE_ONLY.has(key) && word !== word.toUpperCase()) continue;
    if (AMBIGUOUS.has(key)) {
      const capital = word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase();
      if (!capital || !TRAVEL_CUE.test(text.slice(Math.max(0, start - 24), start))) continue;
    }
    const code = byName.get(key);
    if (code) out.push({ start, end: start + word.length, code });
  }
  return out;
}

/** The text in pieces: plain, and country names with their code. */
export function splitMentions(text: string): Segment[] {
  const parts: Segment[] = [];
  let at = 0;
  for (const m of findCountries(text)) {
    if (m.start > at) parts.push({ text: text.slice(at, m.start) });
    parts.push({ text: text.slice(m.start, m.end), code: m.code });
    at = m.end;
  }
  if (at < text.length) parts.push({ text: text.slice(at) });
  return parts;
}

/** The first country a message mentions, to tag it with (or null). */
export function firstCountry(text: string): string | null {
  return findCountries(text)[0]?.code ?? null;
}
