/**
 * How often someone uses the app, so Next Step pops up at a pace that suits
 * them: the more days a week they're here, the longer between pop-ups.
 *
 *   on 0–2 of the last 7 days   at least 12 hours apart (never twice a day)
 *   on 3–5 days                 at least a day apart
 *   on 6–7 days (daily)         at least 2 days apart
 *
 * Kept on the device: pure functions below, the storage wrapper at the end.
 */

export type Rhythm = {
  /** The days (local, "2026-11-18") they used the app in the last two weeks. */
  days: string[];
  lastPopupAt: number;
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const emptyRhythm = (): Rhythm => ({ days: [], lastPopupAt: 0 });

const dayOf = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** They're here now. */
export function touch(r: Rhythm, now: number): Rhythm {
  const today = dayOf(now);
  if (r.days.includes(today)) return r;
  const twoWeeksAgo = dayOf(now - 14 * DAY);
  return { ...r, days: [...r.days.filter((d) => d > twoWeeksAgo), today] };
}

/** Days with the app in the last 7, today included. */
export function daysThisWeek(r: Rhythm, now: number): number {
  const weekAgo = dayOf(now - 7 * DAY);
  return r.days.filter((d) => d > weekAgo).length;
}

export function gapFor(activeDays: number): number {
  if (activeDays <= 2) return 12 * HOUR;
  if (activeDays <= 5) return DAY;
  return 2 * DAY;
}

export function mayPopUp(r: Rhythm, now: number): boolean {
  return now - r.lastPopupAt >= gapFor(daysThisWeek(r, now));
}

export const poppedUp = (r: Rhythm, now: number): Rhythm => ({ ...r, lastPopupAt: now });

/* ------------------------------------------------------------------ */

const KEY = "expandiax:use-rhythm";

export function readRhythm(): Rhythm {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...emptyRhythm(), ...(JSON.parse(raw) as Partial<Rhythm>) } : emptyRhythm();
  } catch {
    return emptyRhythm();
  }
}

export function saveRhythm(r: Rhythm) {
  try {
    localStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    // Without storage it can't keep count; the gap still holds within a page.
  }
}

/** Note that they're using the app today. */
export function noteUse(now = Date.now()): Rhythm {
  const r = touch(readRhythm(), now);
  saveRhythm(r);
  return r;
}
