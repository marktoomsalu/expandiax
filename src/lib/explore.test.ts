import { describe, expect, it } from "vitest";
import { liveName, matchReason, overlap, popularPlaces, slugify, trendingLive, type LiveRow } from "./explore";

const ev = (over: Partial<LiveRow>): LiveRow => ({
  id: "x", user_id: "u1", event_type: "concert", title: "Show", spotify_artist_name: null, spotify_artist_image: null, event_date: "2026-07-01", ...over,
});

describe("liveName and slugify", () => {
  it("a concert is its artist; a festival drops the year", () => {
    expect(liveName(ev({ title: "Music of the Spheres", spotify_artist_name: "Coldplay" }))).toBe("Coldplay");
    expect(liveName(ev({ event_type: "festival", title: "Positivus 2025" }))).toBe("Positivus");
    expect(liveName(ev({ event_type: "sport", title: "Tallinn Marathon – 2026" }))).toBe("Tallinn Marathon");
  });
  it("slugs are URL-safe", () => {
    expect(slugify("Beyoncé")).toBe("beyonce");
    expect(slugify("AC/DC")).toBe("ac-dc");
    expect(slugify("Lenny Kravitz")).toBe("lenny-kravitz");
  });
});

describe("trendingLive", () => {
  it("groups by artist or festival, counts people and memories, and only shows real repeats", () => {
    const out = trendingLive([
      ev({ user_id: "a", spotify_artist_name: "Coldplay", spotify_artist_image: "img" }),
      ev({ user_id: "b", title: "Coldplay", event_date: "2026-08-01" }),
      ev({ user_id: "b", spotify_artist_name: "COLDPLAY" }),
      ev({ user_id: "a", event_type: "festival", title: "Positivus 2025" }),
      ev({ user_id: "a", event_type: "festival", title: "Positivus 2026" }),
      ev({ user_id: "c", title: "Only once" }),
      ev({ user_id: "c", event_type: "personal", title: "Birthday" }),
      ev({ user_id: "d", event_type: "personal", title: "Birthday" }),
    ]);
    expect(out.map((t) => [t.name, t.people, t.memories, t.slug])).toEqual([
      ["Coldplay", 2, 3, "coldplay"],
      ["Positivus", 1, 2, "positivus"],
    ]);
    expect(out[0].image).toBe("img");
    expect(out[0].latest).toBe("2026-08-01");
  });
});

describe("popularPlaces", () => {
  it("counts travellers, not rows, and hides places only one person has been", () => {
    const rows = [{ user_id: "a", country_code: "IT" }, { user_id: "b", country_code: "IT" }, { user_id: "a", country_code: "JP" }];
    expect(popularPlaces(rows)).toEqual([{ code: "IT", travellers: 2 }]);
  });
});

describe("overlap", () => {
  it("scores shared artists above shared countries, and explains why", () => {
    const me = { countries: new Set(["IT", "FR", "JP"]), live: new Set(["coldplay"]), home: "EE" };
    const them = { countries: new Set(["IT", "FR", "US"]), live: new Set(["coldplay", "metallica"]), home: "EE" };
    const m = overlap(me, them, new Map([["coldplay", "Coldplay"]]));
    expect(m).toEqual({ sharedCountries: 2, sharedLive: ["Coldplay"], sameHome: true, score: 2 + 3 + 2 });
    expect(matchReason(m, "Estonia")).toBe("You've both seen Coldplay live · 2 countries in common · Also from Estonia");
  });
});
