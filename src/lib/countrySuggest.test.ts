import { describe, expect, it } from "vitest";
import { matchCountries } from "./countrySuggest";

const codes = (q: string) => matchCountries(q).map((h) => h.country.code);

describe("matchCountries", () => {
  it("finds a country as you type its name", () => {
    expect(codes("ita")[0]).toBe("IT");
    expect(codes("Esto")[0]).toBe("EE");
    expect(codes("zealand")[0]).toBe("NZ");
  });
  it("knows other names and capitals", () => {
    expect(codes("holland")[0]).toBe("NL");
    expect(codes("usa")[0]).toBe("US");
    const paris = matchCountries("paris");
    expect(paris[0].country.code).toBe("FR");
    expect(paris[0].via).toBe("Paris");
  });
  it("ignores accents and needs two letters", () => {
    expect(codes("cote")).toContain("CI");
    expect(codes("i")).toEqual([]);
  });
});
