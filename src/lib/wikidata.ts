// Sport events (a marathon, an Ironman, a Grand Prix, a final…) from
// Wikidata — free, open data (CC0) covering every sport. Used to fill in a
// sport event when logging it. Only the typed text is sent.

export type SportEventHit = {
  id: string; // Q-id
  name: string;
  description: string | null;
  sport: string | null;
  date: string | null; // yyyy-mm-dd, when this is one dated edition
  endDate: string | null;
  year: number | null; // known even when the exact days aren't
  venue: string | null;
  city: string | null;
  countryCode: string | null;
  url: string;
};

const API = "https://www.wikidata.org/w/api.php";
// Wikimedia asks every client to identify itself.
const HEADERS = { "User-Agent": "ExpandiaX/1.0 (https://expandiax.com; team@expandiax.com)", Accept: "application/json" };
const WEEK = 60 * 60 * 24 * 7;

type Snak = { datavalue?: { value?: unknown } };
type Claims = Record<string, { mainsnak: Snak; rank?: string }[]>;
type Entity = {
  id: string;
  labels?: Record<string, { value: string }>;
  descriptions?: Record<string, { value: string }>;
  claims?: Claims;
};

async function wikidata<T>(params: Record<string, string>): Promise<T | null> {
  const qs = new URLSearchParams({ format: "json", formatversion: "2", ...params });
  const res = await fetch(`${API}?${qs}`, { headers: HEADERS, next: { revalidate: WEEK } });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

async function entities(ids: string[], props: string): Promise<Map<string, Entity>> {
  const out = new Map<string, Entity>();
  const unique = [...new Set(ids)];
  // The API takes up to 50 ids at a time.
  for (let i = 0; i < unique.length; i += 50) {
    const data = await wikidata<{ entities?: Record<string, Entity> }>({
      action: "wbgetentities",
      ids: unique.slice(i, i + 50).join("|"),
      props,
      languages: "en",
      languagefallback: "1",
    });
    for (const e of Object.values(data?.entities ?? {})) if (e.id) out.set(e.id, e);
  }
  return out;
}

/** Best statements first (Wikidata marks the current/preferred value). */
function values(e: Entity | undefined, prop: string): unknown[] {
  const list = e?.claims?.[prop] ?? [];
  const preferred = list.filter((s) => s.rank === "preferred");
  return (preferred.length ? preferred : list.filter((s) => s.rank !== "deprecated")).map((s) => s.mainsnak.datavalue?.value).filter((v) => v != null);
}

const itemId = (v: unknown) => (typeof v === "object" && v && "id" in v ? String((v as { id: string }).id) : null);
const firstItem = (e: Entity | undefined, prop: string) => values(e, prop).map(itemId).find(Boolean) ?? null;

/** A Wikidata time value as yyyy-mm-dd — only when it's precise to the day. */
export function dayFromTime(v: unknown): string | null {
  if (typeof v !== "object" || !v) return null;
  const { time, precision } = v as { time?: string; precision?: number };
  const m = /^\+(\d{4})-(\d{2})-(\d{2})T/.exec(time ?? "");
  if (!m || (precision !== undefined && precision < 11) || m[2] === "00" || m[3] === "00") return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/** The year of a Wikidata time value precise to at least the year. */
export function yearFromTime(v: unknown): number | null {
  if (typeof v !== "object" || !v) return null;
  const { time, precision } = v as { time?: string; precision?: number };
  const m = /^\+(\d{4})-/.exec(time ?? "");
  return m && (precision === undefined || precision >= 9) ? Number(m[1]) : null;
}

// Kinds of place that are a city or town (as opposed to a district, region or venue).
const CITY_TYPES = new Set([
  "Q515", // city
  "Q1549591", // big city
  "Q1637706", // city with millions of inhabitants
  "Q200250", // metropolis
  "Q5119", // capital
  "Q3957", // town
  "Q7930989", // city or town
  "Q1093829", // city in the United States
  "Q747074", // comune of Italy
  "Q484170", // commune of France
  "Q262166", // municipality of Germany
  "Q42744322", // urban municipality of Germany
  "Q2039348", // municipality of the Netherlands
  "Q2074737", // municipality of Spain
  "Q15284", // municipality
  "Q532", // village
]);

const isCity = (e: Entity | undefined) => values(e, "P31").some((v) => CITY_TYPES.has(itemId(v) ?? ""));

/** Walks up "located in" (stadium → district → city) until it reaches a city or town. */
function cityOf(start: Entity | undefined, related: Map<string, Entity>): Entity | undefined {
  let cur = start;
  for (let i = 0; i < 4 && cur; i++) {
    if (isCity(cur)) return cur;
    cur = related.get(firstItem(cur, "P131") ?? "");
  }
  return undefined;
}

const label = (e: Entity | undefined) => e?.labels?.en?.value ?? (e?.labels ? Object.values(e.labels)[0]?.value : undefined) ?? null;
const POPULATION = "P1082";

/** Turns fetched entities into a hit. `related` holds the places, countries and sports it points to. */
export function hitFromEntity(e: Entity, related: Map<string, Entity>): SportEventHit | null {
  const name = label(e);
  if (!name) return null;
  const when = values(e, "P585")[0] ?? values(e, "P580")[0];
  const date = dayFromTime(when);
  const endDate = dayFromTime(values(e, "P582")[0]);

  // P276 "location" may be a venue (a stadium) or a settlement (a city).
  const place = related.get(firstItem(e, "P276") ?? "");
  const placeIsCity = !!place && (isCity(place) || (values(place, POPULATION).length > 0 && !firstItem(place, "P131")));
  const cityEntity = placeIsCity ? place : cityOf(place ?? related.get(firstItem(e, "P131") ?? ""), related);
  const countryEntity = related.get(firstItem(e, "P17") ?? firstItem(place, "P17") ?? "");
  const iso = values(countryEntity, "P297")[0];

  return {
    id: e.id,
    name,
    description: e.descriptions?.en?.value ?? null,
    sport: label(related.get(firstItem(e, "P641") ?? "")),
    date,
    endDate: endDate && endDate !== date ? endDate : null,
    year: yearFromTime(when),
    venue: place && !placeIsCity ? label(place) : null,
    city: label(cityEntity),
    countryCode: typeof iso === "string" ? iso.toUpperCase() : null,
    url: `https://www.wikidata.org/wiki/${e.id}`,
  };
}

/**
 * Keeps the search's relevance order between different events, but lists
 * one race's editions together: the race itself first, then newest year first
 * ("Berlin Marathon", "2024 Berlin Marathon", "2023 Berlin Marathon"…).
 */
export function groupEditions(hits: SportEventHit[]): SportEventHit[] {
  const base = (name: string) => name.replace(/\b(19|20)\d{2}(\s*[-–]\s*\d{2,4})?\b/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  const groups = new Map<string, SportEventHit[]>();
  for (const h of hits) {
    const key = base(h.name);
    groups.set(key, [...(groups.get(key) ?? []), h]);
  }
  return [...groups.values()].flatMap((g) => [...g].sort((a, b) => (b.year ?? Infinity) - (a.year ?? Infinity)));
}

/** Sport events matching what was typed, in any language, in Wikidata's relevance order. */
export async function searchSportEvents(query: string, limit = 10): Promise<SportEventHit[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  // Full-text search over every language's names, limited to items that have a sport.
  const found = await wikidata<{ query?: { search?: { title: string }[] } }>({
    action: "query",
    list: "search",
    srsearch: `${q} haswbstatement:P641`,
    srlimit: "20",
  });
  const ids = (found?.query?.search ?? []).map((h) => h.title).filter((t) => /^Q\d+$/.test(t));
  if (ids.length === 0) return [];

  const main = await entities(ids, "labels|descriptions|claims");
  const refs = (props: string[]) => [...main.values()].flatMap((e) => props.flatMap((p) => values(e, p).map(itemId))).filter((x): x is string => !!x);
  const level1 = await entities(refs(["P276", "P17", "P641", "P131"]), "labels|claims");
  // Venues point on to their district, city and country — follow "located in" up a few steps.
  const related = new Map(level1);
  let frontier = [...level1.values()];
  for (let step = 0; step < 3 && frontier.length; step++) {
    const next = frontier
      .filter((e) => !isCity(e))
      .flatMap((e) => ["P131", "P17"].flatMap((p) => values(e, p).map(itemId)))
      .filter((x): x is string => !!x && !related.has(x));
    if (next.length === 0) break;
    const fetched = await entities(next, "labels|claims");
    fetched.forEach((v, k) => related.set(k, v));
    frontier = [...fetched.values()];
  }

  const hits = ids.map((id) => main.get(id)).filter((e): e is Entity => !!e).map((e) => hitFromEntity(e, related)).filter((h): h is SportEventHit => !!h);
  return groupEditions(hits).slice(0, limit);
}
