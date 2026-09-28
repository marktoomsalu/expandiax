import { describe, expect, it } from "vitest";
import { describeDays, localDay, nearestPlace, rangeOf } from "./photoDates";

describe("photo dates", () => {
  it("uses the photo's local day, not UTC (a 00:30 photo stays on its own day)", () => {
    expect(localDay(new Date(2026, 8, 7, 0, 30))).toBe("2026-09-07");
    expect(localDay(new Date(2026, 8, 7, 23, 59))).toBe("2026-09-07");
  });
  it("spans first to last photo, skipping impossible dates", () => {
    expect(rangeOf(["2026-09-08", "2026-09-07", "2026-09-08"], "2026-09-28")).toEqual({ from: "2026-09-07", to: "2026-09-08", count: 3 });
    expect(rangeOf(["1970-01-01", "2030-01-01", "2026-09-07"], "2026-09-28")).toEqual({ from: "2026-09-07", to: "2026-09-07", count: 1 });
    expect(rangeOf([], "2026-09-28")).toBeNull();
  });
});

describe("describeDays", () => {
  it("reads naturally", () => {
    expect(describeDays("2026-09-07", "2026-09-07")).toBe("7 September 2026");
    expect(describeDays("2026-09-07", "2026-09-08")).toBe("7–8 September 2026");
    expect(describeDays("2025-08-30", "2025-09-02")).toBe("30 Aug – 2 Sep 2025");
    expect(describeDays("2025-12-30", "2026-01-02")).toBe("30 Dec 2025 – 2 Jan 2026");
  });
});

describe("nearestPlace", () => {
  const places = [
    { id: "bled", lat: 46.3683, lng: 14.1146 },
    { id: "lj", lat: 46.0511, lng: 14.5051 },
    { id: "unknown", lat: null, lng: null },
  ];
  it("picks the closest place with a map position", () => {
    expect(nearestPlace({ lat: 46.36, lng: 14.09 }, places)?.id).toBe("bled"); // the lake
    expect(nearestPlace({ lat: 46.05, lng: 14.5 }, places)?.id).toBe("lj");
  });
  it("gives nothing when the photo is far from every place", () => {
    expect(nearestPlace({ lat: 48.2, lng: 16.37 }, places)).toBeNull(); // Vienna
  });
});
