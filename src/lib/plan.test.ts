import { describe, expect, it } from "vitest";
import { PHOTO_CAP, VIDEO_CAP } from "./plan";

describe("limits", () => {
  it("gives everyone the same photo and video allowance per trip or event", () => {
    expect(PHOTO_CAP).toBe(15);
    expect(VIDEO_CAP).toBe(8);
  });
});
