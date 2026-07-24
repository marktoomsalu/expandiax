import { describe, expect, it } from "vitest";
import { BADGES, evaluateBadges } from "./badges";
import type { AllTimeStats } from "./stats";

function stats(overrides: Partial<AllTimeStats> = {}): AllTimeStats {
  return {
    totalCountries: 0,
    continentsVisited: 0,
    totalEvents: 0,
    eventsByType: { concert: 0, festival: 0, sport: 0, conference: 0, personal: 0, other: 0 },
    totalPhotos: 0,
    totalVideos: 0,
    favouriteCount: 0,
    topRating: null,
    yearsActive: [],
    oldestYear: null,
    newestYear: null,
    ...overrides,
  };
}

describe("evaluateBadges", () => {
  it("unlocks the first-country badge exactly at 1 country, not before", () => {
    const locked = evaluateBadges(stats({ totalCountries: 0 })).find((b) => b.id === "country-1");
    const unlocked = evaluateBadges(stats({ totalCountries: 1 })).find((b) => b.id === "country-1");
    expect(locked?.isUnlocked).toBe(false);
    expect(unlocked?.isUnlocked).toBe(true);
  });

  it("caps progress at the badge's target even when the stat exceeds it", () => {
    const badge = evaluateBadges(stats({ totalCountries: 500 })).find((b) => b.id === "country-195");
    expect(badge?.current).toBe(195);
    expect(badge?.isUnlocked).toBe(true);
  });

  it("unlocks perfect-night only for an exact rating of 10", () => {
    const nine = evaluateBadges(stats({ topRating: 9 })).find((b) => b.id === "perfect-night");
    const ten = evaluateBadges(stats({ topRating: 10 })).find((b) => b.id === "perfect-night");
    expect(nine?.isUnlocked).toBe(false);
    expect(ten?.isUnlocked).toBe(true);
  });

  it("unlocks renaissance-traveller only once every event type has at least one entry", () => {
    const partial = evaluateBadges(
      stats({ eventsByType: { concert: 1, festival: 1, sport: 0, conference: 0, personal: 0, other: 0 } })
    ).find((b) => b.id === "type-all");
    const complete = evaluateBadges(
      stats({ eventsByType: { concert: 1, festival: 1, sport: 1, conference: 1, personal: 1, other: 1 } })
    ).find((b) => b.id === "type-all");
    expect(partial?.isUnlocked).toBe(false);
    expect(complete?.isUnlocked).toBe(true);
  });

  it("unlocks old-soul only once the oldest memory is at least 5 years old", () => {
    const currentYear = new Date().getFullYear();
    const recent = evaluateBadges(stats({ oldestYear: currentYear })).find((b) => b.id === "old-soul");
    const old = evaluateBadges(stats({ oldestYear: currentYear - 5 })).find((b) => b.id === "old-soul");
    expect(recent?.isUnlocked).toBe(false);
    expect(old?.isUnlocked).toBe(true);
  });

  it("evaluates every defined badge without throwing", () => {
    const evaluated = evaluateBadges(stats());
    expect(evaluated).toHaveLength(BADGES.length);
    expect(evaluated.every((b) => !b.isUnlocked)).toBe(true);
  });
});
