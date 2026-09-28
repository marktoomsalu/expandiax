import { describe, expect, it } from "vitest";
import { coverScore, fitWithin, measure } from "./photoPrepare";

describe("fitWithin", () => {
  it("shrinks the longest side to the limit, keeping the shape", () => {
    expect(fitWithin(4032, 3024)).toEqual({ w: 2560, h: 1920 });
    expect(fitWithin(3024, 4032)).toEqual({ w: 1920, h: 2560 });
  });
  it("never enlarges", () => {
    expect(fitWithin(1200, 800)).toEqual({ w: 1200, h: 800 });
  });
});

describe("measure", () => {
  it("finds a flat image blurry and a checkerboard sharp", () => {
    const w = 16;
    const flat = new Float32Array(w * w).fill(128);
    const checker = new Float32Array(w * w).map((_, i) => ((i % w) + Math.floor(i / w)) % 2 ? 255 : 0);
    expect(measure(flat, w, w).sharpness).toBe(0);
    expect(measure(checker, w, w).sharpness).toBeGreaterThan(1000);
    expect(measure(flat, w, w).brightness).toBeCloseTo(128 / 255);
  });
});

describe("coverScore", () => {
  const good = { w: 4032, h: 3024, sharpness: 800, brightness: 0.5 };
  it("prefers landscape", () => {
    expect(coverScore(good)).toBeGreaterThan(coverScore({ ...good, w: 3024, h: 4032 }));
  });
  it("prefers sharp and well lit", () => {
    expect(coverScore(good)).toBeGreaterThan(coverScore({ ...good, sharpness: 40 }));
    expect(coverScore(good)).toBeGreaterThan(coverScore({ ...good, brightness: 0.05 }));
  });
});
