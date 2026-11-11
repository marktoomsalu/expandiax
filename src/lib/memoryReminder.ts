import { countryByCode } from "@/lib/countries";
import { pickResurfacedMemory, type OwnCountryLite, type OwnEventLite, type ResurfacedMemory } from "@/lib/feedSections";

// What a weekly memory reminder is about, chosen from the person's own
// trips and events (pure, so it can be tested). In order:
//   anniversary  something that happened on this day in an earlier year
//   photos       a trip or event that has no photos yet (the latest one,
//                and not the one the last reminder was about)
//   memory       the day's "One to remember" from the feed
// Nothing logged at all → no reminder: there's nothing to remember yet.
// Every reminder opens the feed's "One to remember" showing that memory.

export type ReminderKind = "anniversary" | "photos" | "memory";
export type ReminderPick = {
  kind: ReminderKind;
  /** "country:<id>" or "event:<id>": what the feed shows, and what the next reminder avoids. */
  target: string;
  values: { title: string; flag: string; ago: string; year: string };
};

function eventDate(e: OwnEventLite) {
  return new Date(`${e.event_date}T00:00:00`);
}
function countryDate(c: OwnCountryLite): Date | null {
  const dates = c.country_visits.map((v) => v.visited_to ?? v.visited_from ?? `${v.year}-07-01`).sort();
  return dates.length ? new Date(`${dates.at(-1)}T00:00:00`) : null;
}

/** "3 years ago", "Last month", "5 months ago". */
export function agoText(date: Date | null, now: Date): string {
  if (!date) return "a while ago";
  const months = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
  if (months >= 12) {
    const years = Math.floor(months / 12);
    return `${years} year${years === 1 ? "" : "s"} ago`;
  }
  return months <= 1 ? "last month" : `${months} months ago`;
}

export function pickReminder(events: OwnEventLite[], countries: OwnCountryLite[], userId: string, now: Date, lastTarget: string | null): ReminderPick | null {
  const describe = (kind: "event" | "country", id: string) => {
    if (kind === "event") {
      const e = events.find((x) => x.id === id);
      if (!e) return null;
      const d = eventDate(e);
      return { title: e.title, flag: "", ago: agoText(d, now), year: String(d.getFullYear()) };
    }
    const c = countries.find((x) => x.id === id);
    if (!c) return null;
    const d = countryDate(c);
    return { title: c.country_name, flag: countryByCode(c.country_code)?.flag ?? "", ago: agoText(d, now), year: d ? String(d.getFullYear()) : "" };
  };
  const from = (m: ResurfacedMemory, kind: ReminderKind): ReminderPick | null => {
    const values = describe(m.kind, m.id);
    return values ? { kind, target: `${m.kind}:${m.id}`, values } : null;
  };

  // The username only shapes links, which a reminder doesn't use.
  const resurfaced = pickResurfacedMemory(events, countries, userId, now, "_");
  if (resurfaced?.isAnniversary) return from(resurfaced, "anniversary");

  // Something that happened (at least a few days ago) and has no photos.
  const settled = now.getTime() - 3 * 86_400_000;
  const missing = [
    ...events.filter((e) => e.media_count === 0).map((e) => ({ kind: "event" as const, id: e.id, date: eventDate(e) })),
    ...countries.filter((c) => c.media_count === 0).map((c) => ({ kind: "country" as const, id: c.id, date: countryDate(c) })),
  ]
    .filter((m) => m.date && m.date.getTime() <= settled && `${m.kind}:${m.id}` !== lastTarget)
    .sort((a, b) => b.date!.getTime() - a.date!.getTime());
  if (missing.length) {
    const m = missing[0];
    const values = describe(m.kind, m.id);
    if (values) return { kind: "photos", target: `${m.kind}:${m.id}`, values };
  }

  return resurfaced ? from(resurfaced, "memory") : null;
}

/** Where a reminder opens: the feed's "One to remember", showing this memory. */
export const reminderLink = (target: string) => `/feed?remember=${encodeURIComponent(target)}#one-to-remember`;
