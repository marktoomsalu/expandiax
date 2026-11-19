import { countryByCode } from "./countries";

/** What the admin form sends for a placement (create or edit). */
export type PlacementInput = {
  kind?: string;
  partner?: string;
  countryCode?: string;
  url?: string;
  imageUrl?: string | null;
  name?: string;
  eventDate?: string;
  venue?: string;
  city?: string;
  /** Country codes; empty = everyone. */
  audience?: string[];
  title?: string;
  body?: string;
  cta?: string;
  startsOn?: string | null;
  until?: string | null;
  active?: boolean;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const clean = (s: string | undefined | null, max: number) => (s ?? "").trim().slice(0, max);
const https = (s: string | undefined | null) => {
  const v = (s ?? "").trim();
  try {
    return new URL(v).protocol === "https:" && v.length <= 1000 ? v : null;
  } catch {
    return null;
  }
};

/**
 * The checked row to save, or what's wrong in words the admin can act on.
 * The database checks the same things (migration 084); this says them first.
 */
export function parsePlacement(i: PlacementInput): { row: Record<string, unknown> } | { error: string } {
  const kind = i.kind === "place" ? "place" : i.kind === "event" ? "event" : null;
  if (!kind) return { error: "Choose an event or a country card." };
  const partner = clean(i.partner, 80);
  if (!partner) return { error: "Who's the partner?" };
  const countryCode = clean(i.countryCode, 2).toUpperCase();
  if (!countryByCode(countryCode)) return { error: "Choose the country." };
  const url = https(i.url);
  if (!url) return { error: "The link must be a full https:// address." };
  const imageUrl = i.imageUrl ? https(i.imageUrl) : null;
  if (i.imageUrl && !imageUrl) return { error: "The picture must be an https:// address (or upload one)." };
  const startsOn = i.startsOn && DAY.test(i.startsOn) ? i.startsOn : null;
  const until = i.until && DAY.test(i.until) ? i.until : null;
  if (startsOn && until && until < startsOn) return { error: "It ends before it starts." };

  const common = { kind, partner, country_code: countryCode, url, image_url: imageUrl, starts_on: startsOn, until, active: i.active ?? true };

  if (kind === "event") {
    const name = clean(i.name, 120);
    if (!name) return { error: "What's the event called?" };
    if (!i.eventDate || !DAY.test(i.eventDate)) return { error: "When is the event?" };
    const audience = [...new Set((i.audience ?? []).map((c) => c.trim().toUpperCase()).filter((c) => countryByCode(c)))];
    return {
      row: { ...common, name, event_date: i.eventDate, venue: clean(i.venue, 120) || null, city: clean(i.city, 80) || null, audience, title: null, body: null, cta: null },
    };
  }

  const title = clean(i.title, 120);
  const body = clean(i.body, 400);
  const cta = clean(i.cta, 40);
  if (!title || !body || !cta) return { error: "A country card needs a title, its text and the button's words." };
  return { row: { ...common, title, body, cta, name: null, event_date: null, venue: null, city: null, audience: [] } };
}
