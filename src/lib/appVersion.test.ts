import { describe, expect, it } from "vitest";
import { compareVersions } from "./appVersion";

describe("compareVersions", () => {
  it("orders versions like the App Store", () => {
    expect(compareVersions("1.1", "1.0")).toBe(1);
    expect(compareVersions("1.0", "1.1")).toBe(-1);
    expect(compareVersions("1.1", "1.1.0")).toBe(0);
    expect(compareVersions("1.10", "1.9")).toBe(1);
  });
});
