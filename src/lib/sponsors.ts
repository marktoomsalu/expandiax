// Paid placements: a partner card on a country's page (a tourism board's
// guide, a hotel's offer), and one featured event on Explore. Each shows
// clearly labelled, at most one per screen, and only where it's relevant —
// the page's country, or Explore's "On your radar" for the people it
// targets. Added, scheduled and ended in the admin space (/admin/partners,
// migration 084); the rules for where they show are the pure functions here.

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
  /** First and last day it runs (yyyy-mm-dd), inclusive. */
  startsOn?: string;
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
  startsOn?: string;
  until?: string;
};

export type Sponsor = PlaceSponsor | EventSponsor;

const live = (s: Sponsor, today: string) => (!s.startsOn || s.startsOn <= today) && (!s.until || s.until >= today);

/** The partner card for a country's page, if one's running. */
export function placeSponsor(countryCode: string, today: string, list: Sponsor[]): PlaceSponsor | null {
  return (list.find((s) => s.kind === "place" && s.countryCode === countryCode && live(s, today)) as PlaceSponsor | undefined) ?? null;
}

/** The featured event for this person, if one's running and they're in its audience. */
export function featuredEvent(
  viewer: { home: string | null; dreams: string[] },
  today: string,
  list: Sponsor[]
): EventSponsor | null {
  const mine = new Set([viewer.home, ...viewer.dreams].filter(Boolean) as string[]);
  return (
    (list.find(
      (s) => s.kind === "event" && live(s, today) && s.date >= today && (!s.audience?.length || s.audience.some((c) => mine.has(c)))
    ) as EventSponsor | undefined) ?? null
  );
}

/** A row of partner_placements (migration 084) as the app uses it. */
export type PlacementRow = {
  id: string;
  kind: "event" | "place";
  partner: string;
  country_code: string;
  url: string;
  image_url: string | null;
  name: string | null;
  event_date: string | null;
  venue: string | null;
  city: string | null;
  audience: string[] | null;
  title: string | null;
  body: string | null;
  cta: string | null;
  starts_on: string | null;
  until: string | null;
};

export function fromRow(r: PlacementRow): Sponsor {
  const common = { id: r.id, partner: r.partner, countryCode: r.country_code, url: r.url, image: r.image_url ?? undefined, startsOn: r.starts_on ?? undefined, until: r.until ?? undefined };
  return r.kind === "event"
    ? { ...common, kind: "event", name: r.name ?? "", date: r.event_date ?? "", venue: r.venue ?? "", city: r.city ?? "", audience: r.audience ?? [] }
    : { ...common, kind: "place", title: r.title ?? "", body: r.body ?? "", cta: r.cta ?? "" };
}

/** Where a placement's button goes: through ExpandiaX first, so the click is counted for the partner. */
export const placementHref = (id: string) => `/api/partners/click/${id}`;
