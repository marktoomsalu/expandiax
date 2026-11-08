import { describe, expect, it } from "vitest";
import { COUNTRIES } from "./countries";
import { fold, searchPlaces } from "./countrySearch";

const names = (q: string) => searchPlaces(q, COUNTRIES).map((c) => c.name);

describe("country search", () => {
  it("ignores accents and special letters", () => {
    expect(fold("Türkiye")).toBe("turkiye");
    expect(fold("Côte d’Ivoire")).toBe("cote d'ivoire");
    expect(fold("Ålesund Ø")).toBe("alesund o");
  });

  it("finds Türkiye from plain letters, and first", () => {
    expect(names("Tur")[0]).toBe("Türkiye");
    expect(names("turkiye")).toContain("Türkiye");
    expect(names("turkey")).toContain("Türkiye");
  });

  it("finds countries by other common names", () => {
    expect(names("holland")).toContain("Netherlands");
    expect(names("ivory")).toContain("Ivory Coast");
    expect(names("cote")).toContain("Ivory Coast");
    expect(names("sao")[0]).toMatch(/^São Tomé/);
  });

  it("puts names that start with the letters before ones that merely contain them", () => {
    const r = names("ma");
    expect(r[0].toLowerCase().startsWith("ma")).toBe(true);
    expect(names("")).toEqual([]);
    expect(names("ee")[0]).toBe("Estonia");
  });
});
