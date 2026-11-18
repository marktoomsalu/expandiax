// After a big moment (a badge, a milestone) the celebration is the whole
// message: suggestions stay away for the rest of that visit.

export const QUIET_EVENT = "expandiax:quiet-visit";
const KEY = "expandiax:quiet-until";
const VISIT_MS = 30 * 60_000;

export function startQuietVisit() {
  try {
    sessionStorage.setItem(KEY, String(Date.now() + VISIT_MS));
  } catch {
    // Quiet for this page at least.
  }
  window.dispatchEvent(new Event(QUIET_EVENT));
}

export function isQuietVisit(): boolean {
  try {
    return Number(sessionStorage.getItem(KEY) ?? 0) > Date.now();
  } catch {
    return false;
  }
}
