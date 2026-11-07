// Paid placements, sold by hand for now: a partner card on a country's
// page (a tourism board's guide, a hotel's offer), and one featured event on
// Explore. Each shows clearly labelled, at most one per screen, and only
// where it's relevant — the page's country, or Explore's "On your radar"
// for the people it targets. Add a placement here; remove it (or let its
// `until` pass) to end it.

export type PlaceSponsor = {
  kind: "place";
  id: string;
  /** The country page it appears on (ISO code, "JP"). */
  countryCode: string;
  /** Who's paying, shown on the label: "Partner · Visit Portugal". */
  partner: string;
  title: string;
  body: string;
  cta: string;
  url: string;
  image?: string;
  /** Last day it runs (yyyy-mm-dd), inclusive. */
  until?: string;
};

export type EventSponsor = {
  kind: "event";
  id: string;
  partner: string;
  name: string;
  date: string; // yyyy-mm-dd
  venue: string;
  city: string;
  countryCode: string;
  url: string;
  image?: string;
  /** Show it only to people with one of these countries on their dream list or as home; empty = everyone. */
  audience?: string[];
  until?: string;
};

export type Sponsor = PlaceSponsor | EventSponsor;

export const SPONSORS: Sponsor[] = [];

const live = (s: Sponsor, today: string) => !s.until || s.until >= today;

/** The partner card for a country's page, if one's running. */
export function placeSponsor(countryCode: string, today = new Date().toISOString().slice(0, 10), list = SPONSORS): PlaceSponsor | null {
  return (list.find((s) => s.kind === "place" && s.countryCode === countryCode && live(s, today)) as PlaceSponsor | undefined) ?? null;
}

/** The featured event for this person, if one's running and they're in its audience. */
export function featuredEvent(
  viewer: { home: string | null; dreams: string[] },
  today = new Date().toISOString().slice(0, 10),
  list = SPONSORS
): EventSponsor | null {
  const mine = new Set([viewer.home, ...viewer.dreams].filter(Boolean) as string[]);
  return (
    (list.find(
      (s) => s.kind === "event" && live(s, today) && s.date >= today && (!s.audience?.length || s.audience.some((c) => mine.has(c)))
    ) as EventSponsor | undefined) ?? null
  );
}
