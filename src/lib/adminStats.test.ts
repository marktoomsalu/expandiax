import { describe, expect, it } from "vitest";
import { activeCounts, activePerDay, cameBack, pct, perDay } from "./adminStats";

const today = "2026-11-10";

describe("dashboard numbers", () => {
  it("counts per day, with empty days as zero", () => {
    expect(perDay(["2026-11-10", "2026-11-10", "2026-11-08"], 3, today)).toEqual([
      { day: "2026-11-08", n: 1 },
      { day: "2026-11-09", n: 0 },
      { day: "2026-11-10", n: 2 },
    ]);
  });

  it("counts distinct active members today, this week and this month", () => {
    const activity = [
      { user_id: "a", day: "2026-11-10" },
      { user_id: "a", day: "2026-11-09" },
      { user_id: "b", day: "2026-11-05" },
      { user_id: "c", day: "2026-10-20" },
      { user_id: "d", day: "2026-09-01" },
    ];
    expect(activeCounts(activity, today)).toEqual({ day: 1, week: 2, month: 3 });
    expect(activePerDay(activity, 2, today)).toEqual([
      { day: "2026-11-09", n: 1 },
      { day: "2026-11-10", n: 1 },
    ]);
  });

  it("counts who came back, only among members who joined after recording began", () => {
    const members = [
      { id: "old", joined: "2026-10-01" }, // joined before recording — left out
      { id: "a", joined: "2026-11-01" },
      { id: "b", joined: "2026-11-02" },
      { id: "new", joined: "2026-11-09" }, // too recent for a 7-day check
    ];
    const activity = [
      { user_id: "a", day: "2026-11-09" },
      { user_id: "b", day: "2026-11-03" },
      { user_id: "old", day: "2026-11-10" },
    ];
    expect(cameBack(members, activity, 7, today, "2026-11-01")).toEqual({ eligible: 2, returned: 1 });
    expect(cameBack(members, activity, 7, today, null)).toEqual({ eligible: 0, returned: 0 });
    expect(pct(1, 2)).toBe("50%");
    expect(pct(1, 0)).toBe("–");
  });
});
