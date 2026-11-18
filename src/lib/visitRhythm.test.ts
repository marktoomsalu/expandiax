import { describe, expect, it } from "vitest";
import { emptyRhythm, mayPopUp, poppedUp, touch, type Rhythm } from "./visitRhythm";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const T0 = Date.parse("2026-11-18T09:00:00Z");

/** Visits at these times; pops up whenever it may. Returns the visits that got one. */
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

describe("visit rhythm", () => {
  it("once per visit: moving between pages doesn't bring it back", () => {
    let r = touch(emptyRhythm(), T0);
    expect(mayPopUp(r, T0)).toBe(true);
    r = poppedUp(r, T0);
    r = touch(r, T0 + 5 * MIN);
    expect(mayPopUp(r, T0 + 5 * MIN)).toBe(false);
    r = touch(r, T0 + 25 * MIN);
    expect(mayPopUp(r, T0 + 25 * MIN)).toBe(false);
  });

  it("someone who comes now and then sees it every visit", () => {
    expect(run([T0, T0 + 4 * DAY, T0 + 9 * DAY])).toEqual([0, 1, 2]);
  });

  it("a few times a week: every other visit once the habit shows", () => {
    const times = [0, 1, 2, 3, 4, 5, 6].map((d) => T0 + d * 1.5 * DAY);
    expect(run(times)).toEqual([0, 1, 3, 5]);
  });

  it("coming back the same evening still counts as a new visit early on", () => {
    expect(run([T0, T0 + 7 * HOUR])).toEqual([0, 1]);
  });

  it("several times a day: at most once a day, every third visit", () => {
    const times = Array.from({ length: 12 }, (_, i) => T0 + i * 3 * HOUR);
    const got = run(times);
    for (let i = 1; i < got.length; i++) expect(times[got[i]] - times[got[i - 1]]).toBeGreaterThanOrEqual(DAY);
    expect(got.length).toBeLessThanOrEqual(2);
  });
});
