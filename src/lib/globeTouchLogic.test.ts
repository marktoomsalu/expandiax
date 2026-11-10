import { describe, expect, it } from "vitest";
import { approachProgress, compareGlobes, decideTouch, isFreshBumpPair, randomCode } from "./globeTouchLogic";

const at = (pairs: [number, number][]) => pairs.map(([meters, t]) => ({ meters, at: t }));

describe("decideTouch", () => {
  it("is a touch when the phones come together", () => {
    expect(decideTouch(at([[0.7, 0], [0.4, 200], [0.28, 400], [0.25, 450]]), 500)).toBe(true);
  });

  it("is not a touch for phones that were already lying together", () => {
    expect(decideTouch(at([[0.15, 0], [0.12, 200], [0.1, 400], [0.12, 450]]), 500)).toBe(false);
  });

  it("is a touch when they start close and come slowly closer", () => {
    expect(decideTouch(at([[0.42, 0], [0.38, 2000], [0.33, 4000], [0.26, 6000], [0.24, 6300]]), 6400)).toBe(true);
  });

  it("needs two close readings in a row", () => {
    expect(decideTouch(at([[0.7, 0], [0.5, 200], [0.4, 400], [0.28, 450]]), 500)).toBe(false);
  });

  it("forgets an approach from long ago", () => {
    expect(decideTouch(at([[0.7, 0], [0.15, 9000], [0.12, 9200], [0.1, 9300]]), 9400)).toBe(false);
  });
});

describe("bumps", () => {
  it("pairs knocks close in time", () => {
    expect(isFreshBumpPair(1000, 1500)).toBe(true);
    expect(isFreshBumpPair(1000, 2000)).toBe(false);
    expect(isFreshBumpPair(0, 300)).toBe(false);
  });
});

describe("approachProgress", () => {
  it("goes from 0 far away to 1 touching", () => {
    expect(approachProgress(2)).toBe(0);
    expect(approachProgress(0.25)).toBe(1);
    expect(approachProgress(0.5)).toBeGreaterThan(0);
    expect(approachProgress(0.5)).toBeLessThan(approachProgress(0.35));
  });
});

describe("randomCode", () => {
  it("makes 32 hex characters, different each time", () => {
    const a = randomCode();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(randomCode()).not.toBe(a);
  });
});

describe("compareGlobes", () => {
  it("splits countries into both, only mine and only theirs, leaving out territories", () => {
    const mine = [{ code: "EE", lived: true }, { code: "IT", lived: false }, { code: "GL", lived: false }];
    const theirs = [{ code: "IT", lived: false }, { code: "XK", lived: false }];
    expect(compareGlobes(mine, theirs)).toEqual({ both: ["IT"], onlyMine: ["EE"], onlyTheirs: ["XK"], together: 3 });
  });
});
