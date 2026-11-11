import { describe, expect, it } from "vitest";
import { byTripDate } from "./tripOrder";

const t = (id: string, visit_date: string | null, visit_year: number | null, created_at: string) => ({ id, visit_date, visit_year, created_at });

describe("byTripDate", () => {
  it("puts trips in the order they happened, not when they were added", () => {
    const out = byTripDate([t("old-added-today", "2022-05-01", 2022, "2026-11-11"), t("recent", "2026-09-21", 2026, "2026-09-25")]);
    expect(out.map((x) => x.id)).toEqual(["recent", "old-added-today"]);
  });
  it("counts a year-only trip as mid-year", () => {
    const out = byTripDate([t("spring", "2025-03-01", 2025, "2026-01-01"), t("year", null, 2025, "2026-02-01"), t("autumn", "2025-10-01", 2025, "2026-01-01")]);
    expect(out.map((x) => x.id)).toEqual(["autumn", "year", "spring"]);
  });
  it("puts undated trips last, newest added first", () => {
    const out = byTripDate([t("u1", null, null, "2026-01-01"), t("d", "2020-01-01", 2020, "2020-02-01"), t("u2", null, null, "2026-06-01")]);
    expect(out.map((x) => x.id)).toEqual(["d", "u2", "u1"]);
  });
});
