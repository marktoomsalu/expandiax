import { describe, expect, it } from "vitest";
import { cn, formatDate, formatMonthYear, formatRelative, formatVisitRange, hexToRgbTriplet, visitSortKey } from "./utils";

describe("cn", () => {
  it("joins truthy class names and drops falsy ones", () => {
    expect(cn("a", false, "b", undefined, null, "c")).toBe("a b c");
  });
});

describe("hexToRgbTriplet", () => {
  it("converts a hex color to a space-separated RGB triplet", () => {
    expect(hexToRgbTriplet("#ff6347")).toBe("255 99 71");
  });

  it("accepts hex without a leading #", () => {
    expect(hexToRgbTriplet("ff6347")).toBe("255 99 71");
  });

  it("returns null for invalid input", () => {
    expect(hexToRgbTriplet("not-a-color")).toBeNull();
    expect(hexToRgbTriplet("#fff")).toBeNull();
  });
});

describe("formatDate", () => {
  it("formats an ISO date string", () => {
    expect(formatDate("2024-03-05")).toBe("5 March 2024");
  });
});

describe("formatMonthYear", () => {
  it("formats an ISO date to month + year only", () => {
    expect(formatMonthYear("2024-03-05")).toBe("March 2024");
  });
});

describe("formatVisitRange", () => {
  it("shows just the year when precision is year", () => {
    expect(formatVisitRange({ year: 2022, visited_from: null, visited_to: null, date_precision: "year" })).toBe("2022");
  });

  it("shows month + year when precision is month", () => {
    expect(
      formatVisitRange({ year: 2022, visited_from: "2022-06-01", visited_to: null, date_precision: "month" })
    ).toBe("June 2022");
  });

  it("shows a single date when from and to match", () => {
    expect(
      formatVisitRange({ year: 2022, visited_from: "2022-06-01", visited_to: "2022-06-01", date_precision: "day" })
    ).toBe("1 June 2022");
  });

  it("shows a date range when from and to differ", () => {
    expect(
      formatVisitRange({ year: 2022, visited_from: "2022-06-01", visited_to: "2022-06-10", date_precision: "day" })
    ).toBe("1 June 2022 – 10 June 2022");
  });
});

describe("visitSortKey", () => {
  it("prefers visited_to, then visited_from, then year fallback", () => {
    expect(visitSortKey({ year: 2020, visited_from: "2020-01-01", visited_to: "2020-01-05" })).toBe("2020-01-05");
    expect(visitSortKey({ year: 2020, visited_from: "2020-01-01", visited_to: null })).toBe("2020-01-01");
    expect(visitSortKey({ year: 2020, visited_from: null, visited_to: null })).toBe("2020-12-31");
  });
});

describe("formatRelative", () => {
  it("shows 'just now' for very recent timestamps", () => {
    expect(formatRelative(new Date().toISOString())).toBe("just now");
  });

  it("shows minutes ago for timestamps within the last hour", () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    expect(formatRelative(tenMinutesAgo)).toBe("10m ago");
  });

  it("shows years ago for old timestamps", () => {
    const twoYearsAgo = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelative(twoYearsAgo)).toBe("2y ago");
  });
});
