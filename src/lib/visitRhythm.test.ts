import { describe, expect, it } from "vitest";
import { emptyRhythm, mayPopUp, poppedUp, touch, type Rhythm } from "./visitRhythm";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const T0 = new Date(2026, 10, 18, 9, 0).getTime();

/** Opens the app at these times; pops up whenever it may. Returns the opens that got one. */
function run(times: number[]): number[] {
  let r: Rhythm = emptyRhythm();
  const got: number[] = [];
  times.forEach((t, i) => {
    r = touch(r, t);
    if (mayPopUp(r, t)) {
      got.push(i);
      r = poppedUp(r, t);
    }
  });
  return got;
}

describe("how often it pops up", () => {
  it("not again a few minutes later, or the same afternoon", () => {
    expect(run([T0, T0 + 5 * MIN, T0 + 2 * HOUR, T0 + 5 * HOUR])).toEqual([0]);
  });

  it("someone here now and then sees it each time they come", () => {
    expect(run([T0, T0 + 4 * DAY, T0 + 9 * DAY])).toEqual([0, 1, 2]);
  });

  it("never twice on the first day, however often they open it", () => {
    expect(run([T0, T0 + 3 * HOUR, T0 + 6 * HOUR, T0 + 9 * HOUR])).toEqual([0]);
  });

  it("someone here every day: once the habit shows, every other day at most", () => {
    const daily = Array.from({ length: 21 }, (_, i) => T0 + i * DAY);
    const steady = run(daily).filter((i) => i >= 7);
    for (let i = 1; i < steady.length; i++) expect(daily[steady[i]] - daily[steady[i - 1]]).toBeGreaterThanOrEqual(2 * DAY);
  });

  it("a few days a week: about once a day they come", () => {
    const days = [0, 2, 3, 5, 7, 9, 10, 12, 14].map((d) => T0 + d * DAY);
    expect(run(days)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
