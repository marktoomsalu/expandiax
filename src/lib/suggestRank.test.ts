import { describe, expect, it } from "vitest";
import { rankSuggestions, type Candidate } from "./suggestRank";

describe("rankSuggestions", () => {
  const photo = (id: string) => id !== "nophoto";
  it("puts people who follow you first, then mutuals, then the rest", () => {
    const c: Candidate[] = [
      { id: "t", kind: "traveller", text: "Visited 40 countries", score: 40 },
      { id: "h", kind: "home", text: "From Estonia", score: 30 },
      { id: "m", kind: "mutual", text: "2 mutuals", score: 80, faces: ["a", "b"] },
      { id: "f", kind: "follows_you", text: "Follows you", score: 0 },
      { id: "s", kind: "shared", text: "Also saw Coldplay", score: 20 },
    ];
    expect(rankSuggestions(c, photo, 10).map((x) => x.id)).toEqual(["f", "m", "s", "h", "t"]);
  });
  it("keeps one entry per person, with their strongest reason", () => {
    const c: Candidate[] = [
      { id: "x", kind: "home", text: "From Estonia", score: 30 },
      { id: "x", kind: "mutual", text: "1 mutual", score: 40, faces: ["a"] },
    ];
    const out = rankSuggestions(c, photo, 10);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("mutual");
  });
  it("prefers people with a photo among equals, and stops at the limit", () => {
    const c: Candidate[] = [
      { id: "nophoto", kind: "home", text: "From Estonia", score: 10 },
      { id: "photo", kind: "home", text: "From Estonia", score: 10 },
      { id: "z", kind: "traveller", text: "Visited 3 countries", score: 3 },
    ];
    expect(rankSuggestions(c, photo, 2).map((x) => x.id)).toEqual(["photo", "nophoto"]);
  });
});
