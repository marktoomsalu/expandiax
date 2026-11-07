// What a country's trips say, worked out from everyone's public trips there:
// when people go, how long they stay, and where else they love. Counts only
// — nothing here names anyone. Each insight needs a few trips behind it
// before it's shown, so one trip never passes for a pattern.

export type VisitFacts = { kind: "trip" | "lived"; visited_from: string | null; visited_to: string | null; date_precision: string | null };

export const MIN_TRIPS = 3;
export const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Trips that started in each month (index 0 = January) — trips with at least a month. */
export function monthCounts(visits: VisitFacts[]): number[] {
  const counts = Array(12).fill(0) as number[];
  for (const v of visits) {
    if (v.kind !== "trip" || !v.visited_from || v.date_precision === "year") continue;
    const m = Number(v.visited_from.slice(5, 7));
    if (m >= 1 && m <= 12) counts[m - 1]++;
  }
  return counts;
}

/** The busiest months, in calendar order ("May", "Jun", "Sep") — null with too few dated trips. */
export function bestMonths(counts: number[], top = 3): number[] | null {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total < MIN_TRIPS) return null;
  const ranked = counts
    .map((n, m) => ({ n, m }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || a.m - b.m)
    .slice(0, top);
  return ranked.map((x) => x.m).sort((a, b) => a - b);
}

/** How long most trips last: the middle half of day-exact trips ("8–14 days") — null with too few. */
export function typicalStay(visits: VisitFacts[]): { low: number; high: number } | null {
  const days = visits
    .filter((v) => v.kind === "trip" && v.visited_from && v.visited_to && v.date_precision === "day")
    .map((v) => Math.round((Date.parse(v.visited_to!) - Date.parse(v.visited_from!)) / 86_400_000) + 1)
    .filter((d) => d >= 1 && d <= 365)
    .sort((a, b) => a - b);
  if (days.length < MIN_TRIPS) return null;
  const at = (q: number) => days[Math.min(days.length - 1, Math.floor(q * (days.length - 1) + 0.5))];
  return { low: at(0.25), high: at(0.75) };
}

export function describeStay(s: { low: number; high: number }): string {
  if (s.low === s.high) return `${s.low} ${s.low === 1 ? "day" : "days"}`;
  return `${s.low}–${s.high} days`;
}

/**
 * Where people who've been here also went, most shared first: other
 * countries at least two of them have been to.
 */
export function alsoLoved(rows: { user_id: string; country_code: string }[], here: string, limit = 5): { code: string; people: number }[] {
  const people = new Set(rows.filter((r) => r.country_code === here).map((r) => r.user_id));
  const counts = new Map<string, Set<string>>();
  for (const r of rows) {
    if (r.country_code === here || !people.has(r.user_id)) continue;
    (counts.get(r.country_code) ?? counts.set(r.country_code, new Set()).get(r.country_code)!).add(r.user_id);
  }
  return [...counts.entries()]
    .map(([code, set]) => ({ code, people: set.size }))
    .filter((x) => x.people >= 2)
    .sort((a, b) => b.people - a.people || a.code.localeCompare(b.code))
    .slice(0, limit);
}
