export type Territory = {
  numeric: string; // ISO 3166-1 numeric, matches world-atlas geography ids.
  // For the handful of entries with no ISO 3166-1 identity at all (Azores,
  // Madeira, Canary Islands — just Portugal/Spain internally), this is set
  // to the same value as `code` instead: a harmless sentinel that's unique
  // in the map and will never collide with a real numeric id or match a
  // globe polygon (those are always plain 3-digit strings).
  code: string; // ISO 3166-1 alpha-2, or an ISO 3166-2 subdivision code
  // ("PT-20") for the no-ISO-3166-1-code exceptions above.
  name: string;
  continent: string; // display only — deliberately not the Country CONTINENTS
  // union, so it can't accidentally add a 7th (mostly-empty) card to the
  // "browse all 195 by continent" grid, which only ever iterates COUNTRIES.
  flag?: string; // override for codes territoryFlag() can't compute a flag
  // from (anything that isn't exactly 2 letters) — falls back to the
  // parent country's flag, since Unicode has no flag of its own for these.
};

// Non-sovereign territories and dependencies — travelers commonly track
// these alongside the 195 recognised countries, but they deliberately don't
// count toward TOTAL_COUNTRIES. Genuinely disputed sovereignty cases
// (Taiwan, Kosovo, Northern Cyprus, Western Sahara, Somaliland) are left out
// on purpose rather than us deciding that for the user.
//
// Kept in sync by hand with the `territories` reference table in
// supabase/schema.sql, which Premium-gates adding one via visited_countries.
export const TERRITORIES: Territory[] = [
  { numeric: "010", code: "AQ", name: "Antarctica", continent: "Antarctica" },
  { numeric: "304", code: "GL", name: "Greenland", continent: "North America" },
  { numeric: "744", code: "SJ", name: "Svalbard and Jan Mayen", continent: "Europe" },

  { numeric: "234", code: "FO", name: "Faroe Islands", continent: "Europe" },
  { numeric: "292", code: "GI", name: "Gibraltar", continent: "Europe" },
  { numeric: "833", code: "IM", name: "Isle of Man", continent: "Europe" },
  { numeric: "832", code: "JE", name: "Jersey", continent: "Europe" },
  { numeric: "831", code: "GG", name: "Guernsey", continent: "Europe" },
  { numeric: "248", code: "AX", name: "Åland Islands", continent: "Europe" },

  { numeric: "344", code: "HK", name: "Hong Kong", continent: "Asia" },
  { numeric: "446", code: "MO", name: "Macau", continent: "Asia" },

  { numeric: "630", code: "PR", name: "Puerto Rico", continent: "North America" },
  { numeric: "850", code: "VI", name: "US Virgin Islands", continent: "North America" },
  { numeric: "092", code: "VG", name: "British Virgin Islands", continent: "North America" },
  { numeric: "136", code: "KY", name: "Cayman Islands", continent: "North America" },
  { numeric: "060", code: "BM", name: "Bermuda", continent: "North America" },
  { numeric: "533", code: "AW", name: "Aruba", continent: "North America" },
  { numeric: "531", code: "CW", name: "Curaçao", continent: "North America" },
  { numeric: "534", code: "SX", name: "Sint Maarten", continent: "North America" },
  { numeric: "796", code: "TC", name: "Turks and Caicos Islands", continent: "North America" },
  { numeric: "660", code: "AI", name: "Anguilla", continent: "North America" },
  { numeric: "500", code: "MS", name: "Montserrat", continent: "North America" },
  { numeric: "312", code: "GP", name: "Guadeloupe", continent: "North America" },
  { numeric: "474", code: "MQ", name: "Martinique", continent: "North America" },

  { numeric: "316", code: "GU", name: "Guam", continent: "Oceania" },
  { numeric: "016", code: "AS", name: "American Samoa", continent: "Oceania" },
  { numeric: "580", code: "MP", name: "Northern Mariana Islands", continent: "Oceania" },
  { numeric: "258", code: "PF", name: "French Polynesia", continent: "Oceania" },
  { numeric: "540", code: "NC", name: "New Caledonia", continent: "Oceania" },
  { numeric: "184", code: "CK", name: "Cook Islands", continent: "Oceania" },
  { numeric: "570", code: "NU", name: "Niue", continent: "Oceania" },

  { numeric: "254", code: "GF", name: "French Guiana", continent: "South America" },
  { numeric: "638", code: "RE", name: "Réunion", continent: "Africa" },
  { numeric: "175", code: "YT", name: "Mayotte", continent: "Africa" },
  { numeric: "238", code: "FK", name: "Falkland Islands", continent: "South America" },
  { numeric: "654", code: "SH", name: "Saint Helena", continent: "Africa" },

  // No ISO 3166-1 code exists for these — they're just Portugal/Spain
  // internally, not a distinct country-level entity. Identified by their
  // ISO 3166-2 subdivision codes instead (see the Territory type above).
  { numeric: "PT-20", code: "PT-20", name: "Azores", continent: "Europe", flag: "🇵🇹" },
  { numeric: "PT-30", code: "PT-30", name: "Madeira", continent: "Africa", flag: "🇵🇹" },
  { numeric: "ES-CN", code: "ES-CN", name: "Canary Islands", continent: "Africa", flag: "🇪🇸" },
];

export const TOTAL_TERRITORIES = TERRITORIES.length;

const byNumeric = new Map(TERRITORIES.map((t) => [t.numeric, t]));
const byCode = new Map(TERRITORIES.map((t) => [t.code, t]));

export function territoryByNumeric(numeric: string): Territory | undefined {
  return byNumeric.get(numeric);
}

export function territoryByCode(code: string | null | undefined): Territory | undefined {
  return code ? byCode.get(code.toUpperCase()) : undefined;
}

export function isTerritoryCode(code: string | null | undefined): boolean {
  return !!territoryByCode(code);
}

// Territories don't carry a hardcoded flag like COUNTRIES does — computed
// from the alpha-2 code instead (each letter maps to a Regional Indicator
// Symbol; every plain alpha-2 territory code here has a valid one,
// Antarctica included). Only valid for real 2-letter codes — use
// territoryFlagFor() below for anything that might have an explicit
// `flag` override instead (the ISO-3166-2-coded entries).
export function territoryFlag(code: string): string {
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));
}

export function territoryFlagFor(t: Territory): string {
  return t.flag ?? territoryFlag(t.code);
}

// Country-shaped view of a territory, for reusing CountryEditor/the
// /my-world/[code] page as-is — capital is deliberately blank (unused by
// either today, and not meaningfully defined for several of these anyway).
export function territoryToMeta(t: Territory): { code: string; name: string; flag: string; capital: string; continent: string } {
  return { code: t.code, name: t.name, flag: territoryFlagFor(t), capital: "", continent: t.continent };
}
