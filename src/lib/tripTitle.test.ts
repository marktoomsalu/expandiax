import { describe, expect, it } from "vitest";
import { tripTitle } from "./tripTitle";

const day = (from: string, to: string | null = null) => ({ year: Number(from.slice(0, 4)), visited_from: from, visited_to: to, date_precision: "day" as const });

describe("tripTitle", () => {
  it("month is the headline, the days are the small line", () => {
    expect(tripTitle(day("2026-09-07", "2026-09-08"))).toEqual({ headline: "September 2026", days: "7–8 September" });
    expect(tripTitle(day("2026-09-07", "2026-09-07"))).toEqual({ headline: "September 2026", days: "7 September" });
    expect(tripTitle(day("2026-09-07"))).toEqual({ headline: "September 2026", days: "7 September" });
  });
  it("across months and years stays short", () => {
    expect(tripTitle(day("2025-08-30", "2025-09-02"))).toEqual({ headline: "Aug – Sep 2025", days: "30 Aug – 2 Sep" });
    expect(tripTitle(day("2025-12-30", "2026-01-02"))).toEqual({ headline: "Dec 2025 – Jan 2026", days: "30 Dec – 2 Jan" });
  });
  it("month- and year-only trips", () => {
    expect(tripTitle({ year: 2025, visited_from: "2025-08-01", visited_to: "2025-08-31", date_precision: "month" })).toEqual({ headline: "August 2025", days: null });
    expect(tripTitle({ year: 2024, visited_from: null, visited_to: null, date_precision: "year" })).toEqual({ headline: "2024", days: null });
  });
});
