import { describe, expect, it } from "vitest";
import { mapStays, stayDuring, tripsDuring } from "./stays";

describe("map stays", () => {
  it("counts trips only, and marks where you lived", () => {
    const { visitCounts, livedCodes } = mapStays([
      { country_code: "IT", country_visits: [{ kind: "lived" }, { kind: "trip" }, { kind: "trip" }] },
      { country_code: "FR", country_visits: [{ kind: "trip" }] },
      { country_code: "ES", country_visits: [] },
      { country_code: "PT", country_visits: [{}] }, // older rows without a kind are trips
    ]);
    expect(visitCounts).toEqual({ IT: 2, FR: 1, ES: 0, PT: 1 });
    expect(livedCodes).toEqual(["IT"]);
  });
});

describe("trips while living somewhere", () => {
  const stay = { id: "s", kind: "lived", visited_from: "2023-09-01", visited_to: "2024-08-31" };
  const now = { id: "n", kind: "lived", visited_from: "2025-03-01", visited_to: null };
  const rome = { id: "r", kind: "trip", visited_from: "2024-02-10", visited_to: "2024-02-12" };
  const before = { id: "b", kind: "trip", visited_from: "2022-05-01", visited_to: "2022-05-04" };
  const recent = { id: "c", kind: "trip", visited_from: "2026-01-03", visited_to: "2026-01-05" };
  const yearOnly = { id: "y", kind: "trip", visited_from: null, visited_to: null };

  it("finds the stay a trip happened during, including one still going on", () => {
    expect(stayDuring(rome, [stay, now])).toBe(stay);
    expect(stayDuring(recent, [stay, now])).toBe(now);
    expect(stayDuring(before, [stay, now])).toBeNull();
    expect(stayDuring(yearOnly, [stay, now])).toBeNull();
    expect(stayDuring(stay, [stay, now])).toBeNull();
  });

  it("lists a stay's trips", () => {
    expect(tripsDuring(stay, [stay, now, rome, before, recent]).map((t) => t.id)).toEqual(["r"]);
    expect(tripsDuring(rome, [stay, rome])).toEqual([]);
  });

  it("doesn't count trips during a stay as visits on the map", () => {
    const { visitCounts } = mapStays([{ country_code: "IT", country_visits: [stay, rome, before, recent] }]);
    expect(visitCounts).toEqual({ IT: 2 });
  });
});
