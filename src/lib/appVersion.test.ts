import { describe, expect, it } from "vitest";
import { compareVersions, joinedBeforeFeatures } from "./appVersion";

describe("compareVersions", () => {
  it("orders versions like the App Store", () => {
    expect(compareVersions("1.1", "1.0")).toBe(1);
    expect(compareVersions("1.0", "1.1")).toBe(-1);
    expect(compareVersions("1.1", "1.1.0")).toBe(0);
    expect(compareVersions("1.10", "1.9")).toBe(1);
  });
});

describe("who gets What's new", () => {
  it("is people who were here before 1.1, not new members", () => {
    expect(joinedBeforeFeatures("2026-06-01T10:00:00Z")).toBe(true);
    expect(joinedBeforeFeatures("2026-11-14T16:15:19Z")).toBe(true);
    expect(joinedBeforeFeatures("2026-11-14T18:00:00Z")).toBe(false);
    expect(joinedBeforeFeatures(null)).toBe(false);
  });
});
