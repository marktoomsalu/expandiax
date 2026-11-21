// Fills our own catalogue of real events (migration 087: event_catalog)
// from open sources, so "Find my world" and adding an event can recognise
// more than concerts. Only events since 2019, each with a date and a place.
//
//   football    openfootball/football.json (CC0): every league match, placed
//               at the home team's stadium (Wikidata, CC0)
//   festival    Wikidata music festival editions (Tomorrowland 2025…)
//   race        Wikidata marathon editions (2025 Berlin Marathon…)
//   race_series Wikidata races that come back yearly at one place (IRONMAN,
//               marathons, Challenge Roth…), without dates
//   conference  Wikidata academic conferences, and confs.tech (MIT) tech
//               conferences, placed at their city
//
// Run monthly by /api/cron/event-catalog, one source per run.

import rawCountries from "@/data/countries.json";
import rawGrounds from "@/data/football-grounds.json";

export type CatalogKind = "football" | "festival" | "race" | "race_series" | "conference";
export type CatalogRow = {
  kind: CatalogKind;
  title: string;
  starts_on: string | null;
  ends_on: string | null;
  venue: string | null;
  city: string | null;
  country_code: string | null;
  lat: number | null;
  lng: number | null;
  source: string;
  source_id: string;
  url: string | null;
};

export const SINCE = "2019-01-01";
const UA = { "User-Agent": "ExpandiaX-catalog/1.0 (https://expandiax.com)" };
const countries = rawCountries as { code: string; name: string }[];
const footballGrounds = rawGrounds as Club[];
const CODES = new Set(countries.map((c) => c.code));
const codeOk = (c: unknown): string | null => (typeof c === "string" && CODES.has(c.toUpperCase()) ? c.toUpperCase() : null);

// ---------------------------------------------------------------- Wikidata

type Binding = Record<string, { value: string } | undefined>;

async function sparql(query: string): Promise<Binding[]> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch("https://query.wikidata.org/sparql", {
      method: "POST",
      headers: { ...UA, Accept: "application/sparql-results+json", "Content-Type": "application/x-www-form-urlencoded" },
      body: `query=${encodeURIComponent(query)}`,
      cache: "no-store",
    });
    if (res.ok) return ((await res.json()) as { results: { bindings: Binding[] } }).results.bindings;
    await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
  }
  throw new Error("wikidata_unavailable");
}

const qid = (b: Binding, k = "e") => b[k]?.value.split("/").pop() ?? "";
const day = (v: string | undefined) => (v ? v.slice(0, 10) : null);
function point(v: string | undefined): { lat: number; lng: number } | null {
  const m = v && /Point\(([-\d.eE]+) ([-\d.eE]+)\)/.exec(v);
  return m ? { lng: Number(m[1]), lat: Number(m[2]) } : null;
}

// Dated to the day (not just the year), since `since`, placed by its own
// coordinates or its location's.
const dated = (since: string) => `
  ?e p:P580|p:P585 ?st . ?st psv:P580|psv:P585 ?sv . ?sv wikibase:timeValue ?start ; wikibase:timePrecision 11 .
  FILTER(?start >= "${since}T00:00:00Z"^^xsd:dateTime)
  OPTIONAL { ?e wdt:P582 ?end }
  { ?e wdt:P625 ?coord } UNION { ?e wdt:P276 ?loc . ?loc wdt:P625 ?coord }
  OPTIONAL { ?e wdt:P276 ?loc2 . ?loc2 rdfs:label ?venue FILTER(LANG(?venue) = "en") }
  OPTIONAL { ?e wdt:P17/wdt:P297 ?cc }
  ?e rdfs:label ?l FILTER(LANG(?l) = "en")`;

function datedRows(rows: Binding[], kind: CatalogKind): CatalogRow[] {
  const out = new Map<string, CatalogRow>();
  for (const b of rows) {
    const id = qid(b);
    const at = point(b.coord?.value);
    if (!id || !at || out.has(id)) continue;
    const start = day(b.start?.value);
    const end = day(b.end?.value);
    out.set(id, {
      kind,
      title: b.l!.value.slice(0, 200),
      starts_on: start,
      ends_on: end && start && end >= start ? end : null,
      venue: b.venue?.value ?? null,
      city: null,
      country_code: codeOk(b.cc?.value),
      lat: at.lat,
      lng: at.lng,
      source: "wikidata",
      source_id: id,
      url: `https://www.wikidata.org/wiki/${id}`,
    });
  }
  return [...out.values()];
}

export async function wikidataFestivals(since = SINCE): Promise<CatalogRow[]> {
  return datedRows(await sparql(`SELECT ?e ?l ?start ?end ?coord ?venue ?cc WHERE { VALUES ?c { wd:Q41582469 wd:Q27968043 } ?e wdt:P31 ?c . ${dated(since)} }`), "festival");
}

/** Marathon and half marathon editions ("2025 Berlin Marathon"). */
export async function wikidataRaces(since = SINCE): Promise<CatalogRow[]> {
  return datedRows(
    await sparql(`SELECT ?e ?l ?start ?end ?coord ?venue ?cc WHERE { ?e wdt:P31 ?series . VALUES ?k { wd:Q40244 wd:Q215677 } ?series wdt:P31 ?k . ${dated(since)} }`),
    "race"
  );
}

export async function wikidataConferences(since = SINCE): Promise<CatalogRow[]> {
  return datedRows(await sparql(`SELECT ?e ?l ?start ?end ?coord ?venue ?cc WHERE { ?e wdt:P31/wdt:P279* wd:Q2020153 . ${dated(since)} }`), "conference");
}

/** Races that come back every year at one place: marathons, half marathons, IRONMAN and other triathlons. */
export async function wikidataRaceSeries(): Promise<CatalogRow[]> {
  const rows = await sparql(`SELECT ?e ?l ?coord ?cc WHERE {
    { VALUES ?k { wd:Q40244 wd:Q215677 } ?e wdt:P31 ?k . }
    UNION { VALUES ?s { wd:Q1338800 wd:Q1673112 } ?e wdt:P361|wdt:P179 ?s . }
    UNION { ?e wdt:P641 wd:Q10980 ; wdt:P31/wdt:P279* wd:Q15275719 . }
    FILTER NOT EXISTS { ?e wdt:P576 ?gone }
    { ?e wdt:P625 ?coord } UNION { ?e wdt:P276 ?loc . ?loc wdt:P625 ?coord } UNION { ?e wdt:P131 ?adm . ?adm wdt:P625 ?coord }
    OPTIONAL { ?e wdt:P17/wdt:P297 ?cc }
    ?e rdfs:label ?l FILTER(LANG(?l) = "en")
  }`);
  const out = new Map<string, CatalogRow>();
  for (const b of rows) {
    const id = qid(b);
    const at = point(b.coord?.value);
    // A year in the name is a one-off (the 2007 European Championships), not a race that comes back.
    if (!id || !at || out.has(id) || /\b(19|20)\d{2}\b/.test(b.l!.value)) continue;
    out.set(id, { kind: "race_series", title: b.l!.value.slice(0, 200), starts_on: null, ends_on: null, venue: null, city: null, country_code: codeOk(b.cc?.value), lat: at.lat, lng: at.lng, source: "wikidata", source_id: id, url: `https://www.wikidata.org/wiki/${id}` });
  }
  return [...out.values()];
}

// ---------------------------------------------------------------- towns

export type TownLookup = (countryCode: string) => Promise<[string, number, number, number][]>;

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

async function placeTown(towns: TownLookup, cc: string, city: string): Promise<{ lat: number; lng: number; name: string } | null> {
  const list = await towns(cc).catch(() => []);
  const want = norm(city);
  const hit = list.filter((t) => norm(t[0]) === want).sort((a, b) => b[3] - a[3])[0];
  return hit ? { name: hit[0], lat: hit[1], lng: hit[2] } : null;
}

// ---------------------------------------------------------------- confs.tech

type ConfsTech = { name?: string; url?: string; startDate?: string; endDate?: string; city?: string; country?: string; online?: boolean };

const COUNTRY_ALIASES: Record<string, string> = { "u.s.a.": "US", usa: "US", "united states": "US", uk: "GB", "u.k.": "GB", "united kingdom": "GB", england: "GB", scotland: "GB", wales: "GB", "the netherlands": "NL", netherlands: "NL", czechia: "CZ", "czech republic": "CZ", "south korea": "KR", korea: "KR", russia: "RU", turkey: "TR", "türkiye": "TR", uae: "AE", "united arab emirates": "AE" };
function countryCodeOf(name: string | undefined): string | null {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  return COUNTRY_ALIASES[n] ?? countries.find((c) => c.name.toLowerCase() === n)?.code ?? null;
}

export async function confsTech(towns: TownLookup, years: number[], since = SINCE): Promise<CatalogRow[]> {
  const out = new Map<string, CatalogRow>();
  for (const year of years) {
    const res = await fetch(`https://api.github.com/repos/tech-conferences/conference-data/contents/conferences/${year}`, { headers: UA, cache: "no-store" });
    if (!res.ok) continue;
    const files = ((await res.json()) as { name: string; download_url: string }[]).filter((f) => f.name.endsWith(".json"));
    for (const f of files) {
      const list = (await (await fetch(f.download_url, { headers: UA, cache: "no-store" })).json().catch(() => [])) as ConfsTech[];
      for (const c of list) {
        if (!c.name || !c.startDate || c.online || !c.city || c.startDate < since) continue;
        const cc = countryCodeOf(c.country);
        if (!cc) continue;
        const id = `${c.startDate}|${norm(c.name)}`;
        if (out.has(id)) continue;
        const at = await placeTown(towns, cc, c.city);
        if (!at) continue;
        out.set(id, {
          kind: "conference",
          title: c.name.slice(0, 200),
          starts_on: c.startDate,
          ends_on: c.endDate && c.endDate >= c.startDate ? c.endDate : null,
          venue: null,
          city: at.name,
          country_code: cc,
          lat: at.lat,
          lng: at.lng,
          source: "confs.tech",
          source_id: id,
          url: c.url ?? null,
        });
      }
    }
  }
  return [...out.values()];
}

// ---------------------------------------------------------------- football


export type Club = { names: string[]; venue: string; lat: number; lng: number; cc: string | null };

// Countries Wikidata files clubs under without an ISO code of their own.
const EXTRA_COUNTRY: Record<string, string> = { NL: "wd:Q55 wd:Q29999", DK: "wd:Q756617" };

/** Football clubs with a home ground (Wikidata), by their names: one country and one kind of name at a time (light to answer). */
export async function clubs(countryCodes: string[]): Promise<Club[]> {
  const by = new Map<string, Club>();
  for (const cc of countryCodes) {
    const country = EXTRA_COUNTRY[cc] ? `{ ?country wdt:P297 "${cc}" } UNION { VALUES ?country { ${EXTRA_COUNTRY[cc]} } }` : `?country wdt:P297 "${cc}" .`;
    for (const names of [`?e rdfs:label ?n FILTER(LANG(?n) = "en")`, `?e skos:altLabel ?n FILTER(LANG(?n) = "en")`]) {
      const rows = await sparql(`SELECT ?e ?n ?venue ?coord WHERE {
        ${country}
        ?e wdt:P31 wd:Q476028 ; wdt:P17 ?country ; p:P115 ?gs .
        ?gs ps:P115 ?ground .
        FILTER NOT EXISTS { ?gs pq:P582 ?groundUntil }
        FILTER NOT EXISTS { ?e wdt:P576 ?dissolved }
        ?ground wdt:P625 ?coord .
        OPTIONAL { ?ground rdfs:label ?venue FILTER(LANG(?venue) = "en") }
        ${names}
      }`).catch(() => [] as Binding[]);
      for (const b of rows) {
        const id = qid(b);
        const at = point(b.coord?.value);
        // A club's women's, reserve or youth side plays elsewhere: only first teams.
        if (!id || !at || !b.n || (!by.has(id) && SIDE_TEAM.test(b.n.value))) continue;
        const club = by.get(id) ?? { names: [], venue: b.venue?.value ?? "", lat: at.lat, lng: at.lng, cc };
        if (!club.names.includes(b.n.value)) club.names.push(b.n.value);
        by.set(id, club);
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return [...by.values()];
}

// Names of a club's other sides: women's, reserves, youth.
const SIDE_TEAM = /\b(women|ladies|femenino|feminine|féminine|frauen|femminile|reserves?|academy|youth|juniors?|u-?\d{2}|ii|b team)\b/i;

// Words that say "football club", not which one.
const CLUB_WORDS = new Set("fc afc cf sc ac as ss ssc us sv vfb vfl tsg fsv rb rc cd ud sd rcd ca cs sl sporting club de del la le 1 04 05 1899 1909 1846 calcio football futbol".split(" "));
const clubKey = (s: string) =>
  norm(s)
    .split(" ")
    // Single letters too: "Liverpool F.C." is "Liverpool".
    .filter((w) => w.length > 1 && !CLUB_WORDS.has(w))
    .join(" ");

function findClub(name: string, cc: string | null, list: Club[]): Club | null {
  const key = clubKey(name);
  // A reserve or women's side in the fixtures ("Sturm Graz II") isn't its first team's ground.
  if (!key || SIDE_TEAM.test(name)) return null;
  const pool = list.filter((c) => !cc || !c.cc || c.cc === cc);
  // The same telling words; otherwise a name that contains the other ("Bayern" in "Bayern München").
  return (
    pool.find((c) => c.names.some((n) => clubKey(n) === key)) ??
    pool.find((c) => c.names.some((n) => {
      const k = clubKey(n);
      return k.length >= 4 && (k.startsWith(`${key} `) || key.startsWith(`${k} `));
    })) ??
    null
  );
}

// Each league file's country (openfootball names files after the country).
const LEAGUE_COUNTRY: Record<string, string> = { en: "GB", sco: "GB", de: "DE", es: "ES", it: "IT", fr: "FR", nl: "NL", pt: "PT", be: "BE", at: "AT", gr: "GR", tr: "TR", ch: "CH", br: "BR", ar: "AR", mx: "MX", us: "US", jp: "JP", cn: "CN", ru: "RU", ua: "UA", pl: "PL", cz: "CZ", dk: "DK", se: "SE", no: "NO", fi: "FI", hu: "HU", ro: "RO", hr: "HR", rs: "RS", ie: "IE", is: "IS" };

type OfMatch = { date?: string; team1?: string; team2?: string; round?: string };

/** Clubs used by the last full football run (src/data/football-grounds.json): the monthly run reads them instead of asking Wikidata. */
export const usedClubs = new Set<Club>();

export async function openfootball(since = SINCE, known?: Club[]): Promise<CatalogRow[]> {
  // Every file in the repository, from jsDelivr (no request limit, unlike GitHub's own listing).
  const listing = (await (await fetch("https://data.jsdelivr.com/v1/packages/gh/openfootball/football.json@master?structure=flat", { headers: UA, cache: "no-store" })).json()) as { files?: { name: string }[] };
  const files: { season: string; file: string; cc: string }[] = [];
  for (const { name } of listing.files ?? []) {
    // "/2024-25/en.1.json": a season that starts in 2024 (or a calendar-year season "2025"), from the one `since` falls in.
    const m = /^\/(\d{4}(?:-\d{2})?)\/(([a-z]+)\.\d+\.json)$/.exec(name);
    if (!m || !LEAGUE_COUNTRY[m[3]] || Number(m[1].slice(0, 4)) < Number(since.slice(0, 4)) - 1) continue;
    files.push({ season: m[1], file: m[2], cc: LEAGUE_COUNTRY[m[3]] });
  }
  const allClubs = known ?? (await clubs([...new Set(files.map((f) => f.cc))]));
  const out = new Map<string, CatalogRow>();
  for (const { season, file, cc } of files) {
    const res = await fetch(`https://raw.githubusercontent.com/openfootball/football.json/master/${season}/${file}`, { headers: UA, cache: "no-store" });
    if (!res.ok) continue;
    const data = (await res.json()) as { name?: string; matches?: OfMatch[] };
    for (const m of data.matches ?? []) {
      if (!m.date || !m.team1 || !m.team2 || m.date < since) continue;
      const home = findClub(m.team1, cc, allClubs);
      if (!home) continue;
      usedClubs.add(home);
      const id = `${m.date}|${norm(m.team1)}|${norm(m.team2)}`;
      out.set(id, {
        kind: "football",
        title: `${m.team1} – ${m.team2}`.slice(0, 200),
        starts_on: m.date,
        ends_on: null,
        venue: home.venue,
        city: null,
        country_code: home.cc ?? cc,
        lat: home.lat,
        lng: home.lng,
        source: "openfootball",
        source_id: id,
        url: null,
      });
    }
  }
  return [...out.values()];
}

// ---------------------------------------------------------------- saving

/** Saves rows in batches, updating ones already there (same source and id). */
export async function upsertCatalog(rows: CatalogRow[], supabaseUrl: string, serviceKey: string): Promise<number> {
  let saved = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500).map((r) => ({ ...r, updated_at: new Date().toISOString() }));
    const res = await fetch(`${supabaseUrl}/rest/v1/event_catalog?on_conflict=source,source_id`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) throw new Error(`event_catalog ${res.status}: ${(await res.text()).slice(0, 200)}`);
    saved += batch.length;
  }
  return saved;
}

export const SOURCES = ["football", "festivals", "races", "race-series", "conferences", "tech-conferences"] as const;
export type SourceName = (typeof SOURCES)[number];

/**
 * One source's rows. With `locate`, each row's country is the one its place
 * is in (Wikidata's own country is sometimes missing or wrong).
 */
export async function fetchSource(
  name: SourceName,
  towns: TownLookup,
  locate?: (lat: number, lng: number) => string | null,
  since = SINCE
): Promise<CatalogRow[]> {
  const rows = await fetchRaw(name, towns, since);
  if (!locate) return rows;
  return rows.map((r) => (r.lat != null && r.lng != null ? { ...r, country_code: locate(r.lat, r.lng) ?? r.country_code } : r));
}

async function fetchRaw(name: SourceName, towns: TownLookup, since: string): Promise<CatalogRow[]> {
  const thisYear = new Date().getUTCFullYear();
  const from = Number(since.slice(0, 4));
  switch (name) {
    case "football":
      return openfootball(since, footballGrounds.length ? footballGrounds : undefined);
    case "festivals":
      return wikidataFestivals(since);
    case "races":
      return wikidataRaces(since);
    case "race-series":
      return wikidataRaceSeries();
    case "conferences":
      return wikidataConferences(since);
    case "tech-conferences":
      return confsTech(towns, Array.from({ length: thisYear - from + 2 }, (_, i) => from + i), since);
  }
}
