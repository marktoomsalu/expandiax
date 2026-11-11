import { describe, expect, it } from "vitest";
import { ASK_AGAIN_DAYS, MAX_NOT_NOW, mayAskAgain } from "./pushAsk";

const day = 86_400_000;

describe("mayAskAgain", () => {
  it("asks the first time", () => {
    expect(mayAskAgain({ notNow: 0, lastAt: 0 }, Date.now())).toBe(true);
  });
  it("waits a few days after Not now", () => {
    const now = 100 * day;
    expect(mayAskAgain({ notNow: 1, lastAt: now - day }, now)).toBe(false);
    expect(mayAskAgain({ notNow: 1, lastAt: now - ASK_AGAIN_DAYS * day }, now)).toBe(true);
  });
  it("stops after three Not nows", () => {
    expect(mayAskAgain({ notNow: MAX_NOT_NOW, lastAt: 0 }, 100 * day)).toBe(false);
  });
});
