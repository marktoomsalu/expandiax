import { describe, expect, it } from "vitest";
import { duration, pageKey, PAGE_LABELS } from "./usage";

describe("anonymous page kinds", () => {
  it("never keeps a trip, country or person, only the kind of page", () => {
    expect(pageKey("/my-world/it/visits/8f3a")).toBe("trip");
    expect(pageKey("/my-world/it/visits/8f3a/edit")).toBe("trip_edit");
    expect(pageKey("/my-world/pt")).toBe("country");
    expect(pageKey("/u/karla")).toBe("profile");
    expect(pageKey("/u/karla/trips/77")).toBe("profile_post");
    expect(pageKey("/u/karla/countries")).toBe("profile_list");
    expect(pageKey("/events/123/edit")).toBe("event_edit");
  });

  it("tells the feed and Explore apart", () => {
    expect(pageKey("/feed")).toBe("feed");
    expect(pageKey("/feed", "?tab=explore")).toBe("explore");
    expect(pageKey("/explore/country/jp")).toBe("explore_country");
  });

  it("leaves out sign-in, legal and admin pages", () => {
    for (const p of ["/", "/sign-in", "/privacy", "/admin", "/admin/partners", "/join/mark"]) expect(pageKey(p)).toBeNull();
  });

  it("every kind has a name for the dashboard", () => {
    const kinds = ["/feed", "/my-world", "/my-world/light-up", "/my-world/states", "/events", "/events/new", "/u/a/followers", "/explore/people", "/explore/trending", "/notifications", "/together", "/touch", "/journey", "/stats", "/invite", "/settings", "/start", "/delete-account"].map((p) => pageKey(p)!);
    for (const k of kinds) expect(PAGE_LABELS[k]).toBeTruthy();
  });

  it("time in words", () => {
    expect(duration(260)).toBe("4 min 20 s");
    expect(duration(45)).toBe("45 s");
    expect(duration(0)).toBe("–");
  });
});
