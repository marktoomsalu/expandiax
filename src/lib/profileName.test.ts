import { describe, expect, it } from "vitest";
import { hasRealName, nameFromParts } from "./profileName";

describe("profile names", () => {
  it("treats the placeholder and blanks as no name", () => {
    expect(hasRealName("Traveller")).toBe(false);
    expect(hasRealName(" Traveller ")).toBe(false);
    expect(hasRealName("")).toBe(false);
    expect(hasRealName(null)).toBe(false);
    expect(hasRealName("Ingeli")).toBe(true);
  });
  it("joins Apple's name parts, skipping missing ones", () => {
    expect(nameFromParts("Ingeli", "Tamm")).toBe("Ingeli Tamm");
    expect(nameFromParts("Ingeli", null)).toBe("Ingeli");
    expect(nameFromParts(" ", null)).toBeNull();
    expect(nameFromParts(null, null)).toBeNull();
  });
});
