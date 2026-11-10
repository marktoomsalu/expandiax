import { countryByCode } from "./countries";

// The rules of touching globes, apart from the radio: when two phones count
// as touching, and what two globes have in common.

export type Reading = { meters: number; at: number };

/**
 * Closer than this, the phones connect. Deliberately well before they
 * touch: iOS's own NameDrop (contact sharing) starts when two iPhones are
 * a few centimetres apart, so World Connect gets there first.
 */
export const TOUCH_METERS = 0.3;
/** Brought together: at least this much closer than a moment before. */
export const APPROACH_METERS = 0.15;
/** How far back "a moment before" reaches. */
export const APPROACH_WINDOW_MS = 8000;
/** Two knocks this close together in time are the same knock. */
export const BUMP_WINDOW_MS = 700;

/**
 * Connecting: the last two readings are both close enough, and in the last
 * few seconds the phones came closer by a good hand's width. The second
 * part keeps two phones that are just lying next to each other on a table
 * from sharing anything: someone has to bring them together. It doesn't
 * matter how far apart they started, or how slowly they came.
 */
export function decideTouch(readings: Reading[], now: number): boolean {
  const recent = readings.filter((r) => now - r.at < APPROACH_WINDOW_MS);
  if (recent.length < 3) return false;
  const [a, b] = recent.slice(-2);
  const close = a.meters <= TOUCH_METERS && b.meters <= TOUCH_METERS && b.at - a.at < 600;
  const farthest = Math.max(...recent.slice(0, -2).map((r) => r.meters));
  return close && farthest - b.meters >= APPROACH_METERS;
}

export function isFreshBumpPair(a: number, b: number): boolean {
  return a > 0 && b > 0 && Math.abs(a - b) <= BUMP_WINDOW_MS;
}

/** 0 at a metre or more, 1 when close enough to connect, eased so the last few centimetres feel the biggest. */
export function approachProgress(meters: number): number {
  const t = Math.min(1, Math.max(0, (1 - meters) / (1 - TOUCH_METERS)));
  return t * t;
}

export function randomCode(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export type GlobeCountry = { code: string; lived: boolean };

/** Countries (not territories) both, one or the other has been to. */
export function compareGlobes(mine: GlobeCountry[], theirs: GlobeCountry[]) {
  const isCountry = (c: GlobeCountry) => !!countryByCode(c.code);
  const a = new Set(mine.filter(isCountry).map((c) => c.code));
  const b = new Set(theirs.filter(isCountry).map((c) => c.code));
  const byName = (x: string, y: string) => (countryByCode(x)?.name ?? x).localeCompare(countryByCode(y)?.name ?? y);
  const both = [...a].filter((c) => b.has(c)).sort(byName);
  const onlyMine = [...a].filter((c) => !b.has(c)).sort(byName);
  const onlyTheirs = [...b].filter((c) => !a.has(c)).sort(byName);
  return { both, onlyMine, onlyTheirs, together: a.size + onlyTheirs.length };
}
