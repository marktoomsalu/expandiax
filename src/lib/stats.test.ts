import { describe, expect, it } from "vitest";
import { buildAllTimeStats, buildYearStats, mostRepeatedTitle, type CountryStatInput, type EventStatInput } from "./stats";

const countries: CountryStatInput[] = [
  { country_code: "EE", is_favourite: true, photo_count: 3, visits: [{ year: 2020 }, { year: 2021 }] },
  { country_code: "FI", is_favourite: false, photo_count: 2, visits: [{ year: 2022, visited_from: "2022-07-01", visited_to: "2022-07-05" }] },
];

const events: EventStatInput[] = [
  { id: "1", title: "Metsatöll", country_code: "EE", event_type: "concert", event_date: "2020-05-01", rating: 8, is_favourite: false, photo_count: 1, video_count: 0 },
  { id: "2", title: "Positivus", country_code: "FI", event_type: "festival", event_date: "2022-07-01", rating: 10, is_favourite: true, photo_count: 0, video_count: 2 },
];

describe("buildAllTimeStats", () => {
  const stats = buildAllTimeStats(countries, events);

  it("counts total countries and events", () => {
    expect(stats.totalCountries).toBe(2);
    expect(stats.totalEvents).toBe(2);
  });

  it("counts continents visited, deduping same-continent countries", () => {
    // Estonia and Finland are both Europe, so this should collapse to 1.
    expect(stats.continentsVisited).toBe(1);
  });

  it("tallies events by type", () => {
    expect(stats.eventsByType.concert).toBe(1);
    expect(stats.eventsByType.festival).toBe(1);
    expect(stats.eventsByType.sport).toBe(0);
  });

  it("sums photos and videos across countries and events", () => {
    expect(stats.totalPhotos).toBe(6);
    expect(stats.totalVideos).toBe(2);
  });

  it("counts favourites across both countries and events", () => {
    expect(stats.favouriteCount).toBe(2);
  });

  it("tracks the highest rating seen", () => {
    expect(stats.topRating).toBe(10);
  });

  it("collects active years from both country visits and event dates", () => {
    expect(stats.yearsActive).toEqual([2020, 2021, 2022]);
    expect(stats.oldestYear).toBe(2020);
    expect(stats.newestYear).toBe(2022);
  });
});

describe("buildAllTimeStats with no data", () => {
  it("returns zeroed-out stats without throwing", () => {
    const stats = buildAllTimeStats([], []);
    expect(stats.totalCountries).toBe(0);
    expect(stats.topRating).toBeNull();
    expect(stats.oldestYear).toBeNull();
    expect(stats.newestYear).toBeNull();
  });
});

describe("buildYearStats", () => {
  it("scopes countries, events and media to the given year", () => {
    const year2022 = buildYearStats(2022, countries, events);
    expect(year2022.countryCodes).toEqual(["FI"]);
    expect(year2022.events).toHaveLength(1);
    expect(year2022.events[0].title).toBe("Positivus");
    expect(year2022.photos).toBe(0);
    expect(year2022.videos).toBe(2);
  });

  it("only counts a country as 'new' the year of its first visit", () => {
    // Estonia's first visit is 2020, so 2021 shouldn't count it as new.
    const year2021 = buildYearStats(2021, countries, events);
    expect(year2021.countryCodes).toEqual(["EE"]);
    expect(year2021.newCountryCodes).toEqual([]);
  });

  it("computes the longest trip length in days from visited_from/visited_to", () => {
    const year2022 = buildYearStats(2022, countries, events);
    expect(year2022.longestTripDays).toBe(5);
  });

  it("picks the highest-rated event of the year", () => {
    const year2022 = buildYearStats(2022, countries, events);
    expect(year2022.topRated?.title).toBe("Positivus");
  });
});

describe("mostRepeatedTitle", () => {
  it("returns null when no title repeats", () => {
    expect(mostRepeatedTitle(events)).toBeNull();
  });

  it("finds the most repeated event title", () => {
    const repeated: EventStatInput[] = [
      ...events,
      { id: "3", title: "Positivus", country_code: "FI", event_type: "festival", event_date: "2023-07-01", rating: 9, is_favourite: false, photo_count: 0, video_count: 0 },
    ];
    expect(mostRepeatedTitle(repeated)).toEqual({ title: "Positivus", count: 2 });
  });
});
