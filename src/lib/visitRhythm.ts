/**
 * How often someone comes to the app, so Next Step can pop up at a pace
 * that suits them: at most once a visit, and less often the more often
 * they're here. A visit starts after 30 minutes away.
 *
 *   up to 2 visits a week   every visit, 6 hours apart at least
 *   3–6 a week              every 2nd visit, 12 hours apart at least
 *   7 or more (daily)       every 3rd visit, a day apart at least
 *
 * Kept on the device: pure functions below, the storage wrapper at the end.
 */

export type Rhythm = {
  /** When each visit in the last two weeks started. */
  visits: number[];
  lastSeen: number;
  lastPopupAt: number;
  /** The visit (by its start) the last pop-up was in. */
  popupVisit: number;
  visitsSincePopup: number;
};

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
export const VISIT_GAP_MS = 30 * MIN;

export const emptyRhythm = (): Rhythm => ({ visits: [], lastSeen: 0, lastPopupAt: 0, popupVisit: 0, visitsSincePopup: 99 });

/** Someone is here now: a new visit if they'd been away a while. */
export function touch(r: Rhythm, now: number): Rhythm {
  if (r.visits.length && now - r.lastSeen < VISIT_GAP_MS) return { ...r, lastSeen: now };
  return {
    ...r,
    visits: [...r.visits.filter((t) => now - t < 14 * DAY), now],
    lastSeen: now,
    visitsSincePopup: r.visitsSincePopup + 1,
  };
}

/**
 * Visits a week, from the gaps between them over the last week (so a first
 * day with three visits already reads as someone who's here a lot).
 */
export function visitsPerWeek(r: Rhythm, now: number): number {
  const recent = r.visits.filter((t) => now - t < 7 * DAY);
  // Two visits say little about a habit: treat it as now and then until there are more.
  if (recent.length < 3) return recent.length;
  const span = Math.max(now - recent[0], DAY);
  return ((recent.length - 1) / span) * 7 * DAY;
}

export function pace(weekly: number): { everyNth: number; minGapMs: number } {
  if (weekly <= 2) return { everyNth: 1, minGapMs: 6 * HOUR };
  if (weekly <= 6) return { everyNth: 2, minGapMs: 12 * HOUR };
  return { everyNth: 3, minGapMs: DAY };
}

/** Whether this visit gets a pop-up. */
export function mayPopUp(r: Rhythm, now: number): boolean {
  const visit = r.visits.at(-1);
  if (visit === undefined || r.popupVisit === visit) return false;
  const { everyNth, minGapMs } = pace(visitsPerWeek(r, now));
  return r.visitsSincePopup >= everyNth && now - r.lastPopupAt >= minGapMs;
}

export const poppedUp = (r: Rhythm, now: number): Rhythm => ({ ...r, popupVisit: r.visits.at(-1) ?? now, lastPopupAt: now, visitsSincePopup: 0 });

/* ------------------------------------------------------------------ */

const KEY = "expandiax:visit-rhythm";

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
    // Without storage every visit looks like the first: still once per page load at most.
  }
}

/** Note that they're here (on every page and on coming back to the app). */
export function noteVisit(now = Date.now()): Rhythm {
  const r = touch(readRhythm(), now);
  saveRhythm(r);
  return r;
}
