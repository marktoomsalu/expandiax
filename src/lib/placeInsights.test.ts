import { describe, expect, it } from "vitest";
import { alsoLoved, bestMonths, describeStay, monthCounts, typicalStay, type VisitFacts } from "./placeInsights";

const trip = (from: string | null, to: string | null, precision = "day", kind: VisitFacts["kind"] = "trip"): VisitFacts => ({
  kind,
  visited_from: from,
  visited_to: to,
  date_precision: precision,
});

describe("best time to go", () => {
  it("counts trips by the month they started, ignoring year-only trips and places people lived", () => {
    const counts = monthCounts([trip("2025-05-02", "2025-05-10"), trip("2024-05-20", null, "month"), trip("2023-01-01", null, "year"), trip("2022-09-01", null, "day", "lived")]);
    expect(counts[4]).toBe(2);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(2);
  });

  it("names the busiest months in calendar order, once there are enough trips", () => {
    const counts = Array(12).fill(0);
    counts[8] = 3;
    counts[4] = 4;
    counts[0] = 1;
    counts[5] = 2;
    expect(bestMonths(counts)).toEqual([4, 5, 8]);
    expect(bestMonths([1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])).toBeNull();
  });
});

describe("typical stay", () => {
  it("is the middle half of day-exact trips", () => {
    const visits = [trip("2025-01-01", "2025-01-03"), trip("2025-02-01", "2025-02-08"), trip("2025-03-01", "2025-03-10"), trip("2025-04-01", "2025-04-14"), trip("2025-05-01", "2025-05-30")];
    expect(typicalStay(visits)).toEqual({ low: 8, high: 14 });
    expect(describeStay({ low: 8, high: 14 })).toBe("8–14 days");
    expect(describeStay({ low: 1, high: 1 })).toBe("1 day");
  });

  it("needs a few trips with real dates", () => {
    expect(typicalStay([trip("2025-01-01", "2025-01-03"), trip("2025-02-01", null, "month")])).toBeNull();
  });
});

describe("also loved", () => {
  it("lists other countries at least two of this country's travellers have been to", () => {
    const rows = [
      { user_id: "a", country_code: "JP" },
      { user_id: "a", country_code: "KR" },
      { user_id: "a", country_code: "TH" },
      { user_id: "b", country_code: "JP" },
      { user_id: "b", country_code: "KR" },
      { user_id: "c", country_code: "KR" },
      { user_id: "c", country_code: "FR" },
    ];
    expect(alsoLoved(rows, "JP")).toEqual([{ code: "KR", people: 2 }]);
  });
});
