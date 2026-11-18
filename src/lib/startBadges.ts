import { evaluateBadges, type EvaluatedBadge } from "./badges";
import { buildAllTimeStats, type EventStatInput } from "./stats";
import { isTerritoryCode } from "./territories";
import type { EventType } from "./types";

/**
 * The badges the first steps earn (before there's an account, from the
 * draft), and the nearest next one: "Explorer: 2 more countries". The same
 * rules as the badges on a profile, so they're there after signing up too.
 */
export function startBadges(input: {
  countryCodes: string[];
  event?: { type: EventType; countryCode: string; date: string; title: string; hasPhoto: boolean } | null;
}): { earned: EvaluatedBadge[]; next: EvaluatedBadge | null } {
  const codes = [...new Set(input.countryCodes)].filter((c) => !isTerritoryCode(c));
  const events: EventStatInput[] = input.event
    ? [
        {
          id: "start",
          title: input.event.title,
          country_code: input.event.countryCode,
          event_type: input.event.type,
          event_date: input.event.date,
          rating: null,
          is_favourite: false,
          photo_count: input.event.hasPhoto ? 1 : 0,
          video_count: 0,
        },
      ]
    : [];
  const all = evaluateBadges(
    buildAllTimeStats(
      codes.map((country_code) => ({ country_code, is_favourite: false, photo_count: 0, visits: [] })),
      events
    ),
    { antarctica: input.countryCodes.includes("AQ") }
  );
  const earned = all.filter((b) => b.isUnlocked);
  // The next one to aim for, on the path they took: the fewest steps away.
  const groups = input.event ? ["events", "types", "countries"] : ["countries", "continents"];
  const next =
    all
      .filter((b) => !b.isUnlocked && groups.includes(b.group) && b.target - b.current <= 10 && b.id !== "antarctica")
      .sort((a, b) => a.target - a.current - (b.target - b.current) || groups.indexOf(a.group) - groups.indexOf(b.group))[0] ?? null;
  return { earned, next };
}
