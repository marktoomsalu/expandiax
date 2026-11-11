// How "Suggested for you" orders people (lib/suggestPeople gathers them).

export type WhyKind = "follows_you" | "mutual" | "shared" | "home" | "new" | "traveller";

export type Candidate = { id: string; kind: WhyKind; text: string; score: number; faces?: string[] };

const WEIGHT: Record<WhyKind, number> = { follows_you: 1000, mutual: 400, shared: 200, new: 120, home: 100, traveller: 10 };

/**
 * One entry per person, keeping their strongest reason (mutuals beat a
 * shared event, unless the event says more), people with a photo first
 * among equals. Pure, for tests.
 */
export function rankSuggestions(candidates: Candidate[], hasPhoto: (id: string) => boolean, limit: number): Candidate[] {
  const best = new Map<string, Candidate & { total: number }>();
  for (const c of candidates) {
    const total = WEIGHT[c.kind] + c.score + (hasPhoto(c.id) ? 5 : 0);
    const had = best.get(c.id);
    if (!had || total > had.total) best.set(c.id, { ...c, total });
  }
  return [...best.values()].sort((a, b) => b.total - a.total).slice(0, limit);
}
