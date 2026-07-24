import { describe, expect, it } from "vitest";
import { COUNTRY_CAP, EVENT_CAP, PHOTO_CAP, VIDEO_CAP } from "./plan";

describe("plan caps", () => {
  it("gives premium strictly higher media caps than free", () => {
    expect(PHOTO_CAP.premium).toBeGreaterThan(PHOTO_CAP.free);
    expect(VIDEO_CAP.premium).toBeGreaterThan(VIDEO_CAP.free);
  });

  it("caps free-plan countries and events at fixed limits", () => {
    expect(COUNTRY_CAP.free).toBe(40);
    expect(EVENT_CAP.free).toBe(20);
  });

  it("removes the entry cap entirely for premium", () => {
    expect(COUNTRY_CAP.premium).toBeNull();
    expect(EVENT_CAP.premium).toBeNull();
  });
});
