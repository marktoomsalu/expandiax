import type { FeedEvent } from "./types";

// Trips in the order they happened, newest first, not the order they were
// added: a 2022 trip added today comes after a 2026 one. Trips with only a
// year count as the middle of that year. Trips with no date at all come
// after every dated one, the most recently added first.

const when = (t: Pick<FeedEvent, "visit_date" | "visit_year">) => t.visit_date ?? (t.visit_year ? `${t.visit_year}-07-01` : null);

export function byTripDate<T extends Pick<FeedEvent, "visit_date" | "visit_year" | "created_at">>(trips: T[]): T[] {
  return [...trips].sort((a, b) => {
    const wa = when(a);
    const wb = when(b);
    if (wa && wb) return wb.localeCompare(wa) || b.created_at.localeCompare(a.created_at);
    if (wa) return -1;
    if (wb) return 1;
    return b.created_at.localeCompare(a.created_at);
  });
}
