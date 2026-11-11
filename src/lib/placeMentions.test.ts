import { describe, expect, it } from "vitest";
import { findCountries, firstCountry, splitMentions } from "./placeMentions";

const codes = (t: string) => findCountries(t).map((m) => m.code);

describe("findCountries", () => {
  it("finds countries in ordinary sentences, any case", () => {
    expect(codes("I loved visiting Italy")).toEqual(["IT"]);
    expect(codes("italy or france next summer?")).toEqual(["IT", "FR"]);
    expect(codes("Italy's coast was unreal")).toEqual(["IT"]);
  });
  it("prefers the longest name", () => {
    expect(codes("We flew to South Korea")).toEqual(["KR"]);
    expect(codes("Papua New Guinea is wild")).toEqual(["PG"]);
    expect(codes("New Zealand!")).toEqual(["NZ"]);
  });
  it("doesn't link words that mean something else", () => {
    expect(codes("Jordan said hi")).toEqual([]);
    expect(codes("we had turkey for dinner")).toEqual([]);
    expect(codes("Chad is coming too")).toEqual([]);
    expect(codes("the good china plates")).toEqual([]);
    expect(codes("tell us more")).toEqual([]);
    expect(codes("Italyish vibes")).toEqual([]);
  });
  it("links them after a travel word", () => {
    expect(codes("Just back from Jordan")).toEqual(["JO"]);
    expect(codes("I loved my trip to Turkey")).toEqual(["TR"]);
    expect(codes("visited Georgia last spring")).toEqual(["GE"]);
  });
  it("knows USA and UK only in capitals", () => {
    expect(codes("road trip across the USA")).toEqual(["US"]);
    expect(codes("living in the UK")).toEqual(["GB"]);
    expect(codes("uk")).toEqual([]);
  });
});

describe("splitMentions", () => {
  it("keeps the text whole around the links", () => {
    const parts = splitMentions("Loved Italy, and Spain too");
    expect(parts.map((p) => p.text).join("")).toBe("Loved Italy, and Spain too");
    expect(parts.filter((p) => p.code).map((p) => p.code)).toEqual(["IT", "ES"]);
  });
  it("tags with the first country", () => {
    expect(firstCountry("Spain then Portugal")).toBe("ES");
    expect(firstCountry("hello")).toBeNull();
  });
});
