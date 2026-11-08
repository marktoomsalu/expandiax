import { describe, expect, it } from "vitest";
import { canShift, monthGrid, shiftMonth, startMonth } from "./calendar";

describe("date picker calendar", () => {
  it("lays a month out in Monday-first weeks", () => {
    const july = monthGrid({ y: 2023, m: 7 }); // 1 July 2023 was a Saturday
    expect(july[0]).toEqual([null, null, null, null, null, "2023-07-01", "2023-07-02"]);
    expect(july.at(-1)).toEqual(["2023-07-31", null, null, null, null, null, null]);
    expect(july).toHaveLength(6);
    expect(monthGrid({ y: 2024, m: 2 }).flat().filter(Boolean)).toHaveLength(29); // leap year
  });

  it("moves across year ends", () => {
    expect(shiftMonth({ y: 2026, m: 12 }, 1)).toEqual({ y: 2027, m: 1 });
    expect(shiftMonth({ y: 2026, m: 1 }, -1)).toEqual({ y: 2025, m: 12 });
    expect(shiftMonth({ y: 2026, m: 3 }, -15)).toEqual({ y: 2024, m: 12 });
  });

  it("opens on the chosen date, else the start date, else today, within limits", () => {
    const today = "2026-11-08";
    expect(startMonth("2023-07-08", undefined, undefined, undefined, today)).toEqual({ y: 2023, m: 7 });
    // An empty end date opens on the start date's month, not today's.
    expect(startMonth("", "2023-07-08", "2023-07-08", undefined, today)).toEqual({ y: 2023, m: 7 });
    expect(startMonth("", undefined, undefined, undefined, today)).toEqual({ y: 2026, m: 11 });
    expect(startMonth("", undefined, undefined, "2025-03-01", today)).toEqual({ y: 2025, m: 3 });
  });

  it("stops at the months min and max allow", () => {
    expect(canShift({ y: 2023, m: 7 }, -1, "2023-07-08")).toBe(false);
    expect(canShift({ y: 2023, m: 7 }, 1, "2023-07-08")).toBe(true);
    expect(canShift({ y: 2026, m: 11 }, 1, undefined, "2026-11-08")).toBe(false);
  });
});
