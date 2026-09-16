import type { EventType } from "./types";

// "I was there" hands the shared, public facts of someone else's event over
// to a fresh /events/new draft — never their personal fields (rating,
// review, highlight, notes, media, favourite track). Mirrors the
// sessionStorage handoff pattern in onboardingDraft.ts.
export type EventPrefill = {
  title: string;
  event_type: EventType;
  event_date: string;
  venue: string;
  city: string;
  country_code: string;
  country_name: string;
  spotify_artist_id: string | null;
  spotify_artist_name: string | null;
  spotify_artist_image: string | null;
};

const STORAGE_KEY = "expandiax:event-prefill";

export function savePrefill(prefill: EventPrefill): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(prefill));
  } catch {
    // Storage full/unavailable — worst case the form just opens blank.
  }
}

/** One-shot: returns the pending prefill (if any) and clears it immediately. */
export function loadAndClearPrefill(): EventPrefill | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(STORAGE_KEY);
    return JSON.parse(raw) as EventPrefill;
  } catch {
    return null;
  }
}
