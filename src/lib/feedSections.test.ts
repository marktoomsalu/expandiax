import { describe, expect, it } from "vitest";
import { groupCountryBursts, pickResurfacedMemory, splitFresh, type OwnCountryLite, type OwnEventLite } from "./feedSections";

const NOW = new Date("2026-09-23T12:00:00");

const event = (over: Partial<OwnEventLite> & { id: string }): OwnEventLite => ({
  title: over.id,
  event_date: "2023-07-15",
  cover_media_id: null,
  is_favourite: false,
  media_count: 0,
  ...over,
});

const country = (over: Partial<OwnCountryLite> & { id: string }): OwnCountryLite => ({
  country_code: "DE",
  country_name: "Germany",
  cover_media_id: null,
  is_favourite: false,
  media_count: 0,
  country_visits: [{ year: 2022, visited_from: null, visited_to: null, date_precision: "year" }],
  ...over,
});

describe("pickResurfacedMemory", () => {
  it("prefers an anniversary and links to the public view", () => {
    const picked = pickResurfacedMemory(
      [event({ id: "fav", is_favourite: true, media_count: 3 }), event({ id: "anniv", event_date: "2024-09-23" })],
      [],
      "u1",
      NOW,
      "mark"
    );
    expect(picked).toMatchObject({ id: "anniv", isAnniversary: true, subtitle: "2 years ago today", href: "/u/mark/events/anniv" });
  });

  it("picks a memory with photos over a favourite without any", () => {
    const picked = pickResurfacedMemory([event({ id: "fav-no-photos", is_favourite: true }), event({ id: "photos", media_count: 4 })], [], "u1", NOW, "mark");
    expect(picked?.id).toBe("photos");
  });

  it("prefers favourites with photos over other memories with photos", () => {
    const picked = pickResurfacedMemory(
      [event({ id: "a", media_count: 2 }), event({ id: "b", media_count: 2 })],
      [country({ id: "c", is_favourite: true, media_count: 5 })],
      "u1",
      NOW,
      "mark"
    );
    expect(picked).toMatchObject({ id: "c", kind: "country", href: "/u/mark/countries/de", isAnniversary: false });
  });

  it("prefers older memories, but shows a recent one when that's all there is", () => {
    const recent = event({ id: "recent", event_date: "2026-09-01", is_favourite: true, media_count: 9 });
    expect(pickResurfacedMemory([recent, event({ id: "old", event_date: "2022-03-03" })], [], "u1", NOW, "mark")?.id).toBe("old");
    expect(pickResurfacedMemory([recent], [], "u1", NOW, "mark")?.id).toBe("recent");
  });

  it("shows any memory when there's nothing better, and nothing when there are none", () => {
    expect(pickResurfacedMemory([event({ id: "plain" })], [], "u1", NOW, "mark")?.id).toBe("plain");
    expect(pickResurfacedMemory([], [], "u1", NOW, "mark")).toBeNull();
  });

  it("then months ago today, when there's no year anniversary", () => {
    const picked = pickResurfacedMemory([event({ id: "fav", is_favourite: true, media_count: 3 }), event({ id: "m3", event_date: "2026-06-23" })], [], "u1", NOW, "mark");
    expect(picked).toMatchObject({ id: "m3", isAnniversary: true, subtitle: "3 months ago today" });
  });

  it("says a long stretch of months in years and months", () => {
    const picked = pickResurfacedMemory([event({ id: "m15", event_date: "2025-06-23" })], [], "u1", NOW, "mark");
    expect(picked?.subtitle).toBe("1 year and 3 months ago today");
  });

  it("prefers an anniversary with photos over one without", () => {
    const picked = pickResurfacedMemory([event({ id: "bare", event_date: "2026-06-23" }), event({ id: "pics", event_date: "2026-07-23", media_count: 2 })], [], "u1", NOW, "mark");
    expect(picked?.id).toBe("pics");
  });

  it("counts a trip's exact days for anniversaries", () => {
    const trip = country({ id: "trip", country_visits: [{ year: 2025, visited_from: "2025-09-20", visited_to: "2025-09-23", date_precision: "day" }] });
    expect(pickResurfacedMemory([], [trip], "u1", NOW, "mark")).toMatchObject({ id: "trip", subtitle: "1 year ago today" });
  });

  it("doesn't show yesterday's memory again when there's another", () => {
    const events = [event({ id: "a", media_count: 1 }), event({ id: "b", media_count: 1 }), event({ id: "c", media_count: 1 })];
    const ids = Array.from({ length: 12 }, (_, i) => pickResurfacedMemory(events, [], "u1", new Date(2026, 2, i + 1, 12), "mark")?.id);
    for (let i = 1; i < ids.length; i++) expect(ids[i]).not.toBe(ids[i - 1]);
    // Every one has its turn.
    expect(new Set(ids.slice(0, 3)).size).toBe(3);
  });

  it("keeps the same pick all day", () => {
    const events = [event({ id: "a", media_count: 1 }), event({ id: "b", media_count: 1 }), event({ id: "c", media_count: 1 })];
    const morning = pickResurfacedMemory(events, [], "u1", new Date("2026-09-23T08:00:00"), "mark");
    const evening = pickResurfacedMemory(events, [], "u1", new Date("2026-09-23T22:00:00"), "mark");
    expect(morning?.id).toBe(evening?.id);
  });
});

describe("splitFresh", () => {
  const at = (h: number) => ({ id: h, created_at: `2026-09-26T${String(h).padStart(2, "0")}:00:00.000000+00:00` });
  const items = [at(12), at(11), at(10), at(9), at(8)]; // newest first

  it("new since the last visit go first, the rest after the caught-up point", () => {
    const { fresh, earlier } = splitFresh(items, "2026-09-26T09:30:00.000Z");
    expect(fresh.map((i) => i.id)).toEqual([12, 11, 10]);
    expect(earlier.map((i) => i.id)).toEqual([9, 8]);
  });
  it("nothing new: caught up straight away", () => {
    expect(splitFresh(items, "2026-09-26T13:00:00+00:00").fresh).toEqual([]);
  });
  it("after a long break only the newest few count as new", () => {
    expect(splitFresh(items, "2026-01-01T00:00:00Z", { maxFresh: 2 }).fresh.map((i) => i.id)).toEqual([12, 11]);
  });
  it("first-ever visit: the newest few", () => {
    expect(splitFresh(items, null, { firstVisit: 3 }).fresh).toHaveLength(3);
    expect(splitFresh([], null).fresh).toEqual([]);
  });
});

describe("groupCountryBursts", () => {
  const c = (id: string, actor: string, time: string, bare = true, kind = "country") => ({ id, kind, actor_id: actor, created_at: `2026-09-26T${time}:00Z`, bare });
  const isBare = (i: { bare: boolean }) => i.bare;

  it("a burst of bare countries from one person becomes one card, where the newest was", () => {
    const items = [c("e1", "anna", "12:00", false, "event"), c("c1", "mark", "11:50"), c("c2", "mark", "11:49"), c("x", "anna", "11:30"), c("c3", "mark", "11:00"), c("c4", "mark", "09:00")];
    const out = groupCountryBursts(items, isBare);
    expect(out.map((o) => ("items" in o ? `burst:${o.items.map((i) => i.id).join(",")}` : o.id))).toEqual(["e1", "burst:c1,c2,c3,c4", "x"]);
  });

  it("countries with photos or a story stay as their own posts; small groups aren't merged", () => {
    const out = groupCountryBursts([c("c1", "mark", "11:50"), c("photo", "mark", "11:49", false), c("c2", "mark", "11:48")], isBare);
    expect(out.map((o) => ("items" in o ? "burst" : o.id))).toEqual(["c1", "photo", "c2"]);
  });

  it("additions far apart in time aren't grouped", () => {
    const out = groupCountryBursts([c("a", "mark", "20:00"), c("b", "mark", "12:00"), c("c", "mark", "04:00")], isBare);
    expect(out.every((o) => !("items" in o))).toBe(true);
  });
});

describe("groupCountryBursts for new members", () => {
  const c = (id: string, day: string, time: string, actor = "new") => ({ id, kind: "country", actor_id: actor, created_at: `2026-09-${day}T${time}:00Z` });
  const joinedAt = (actor: string) => (actor === "new" ? "2026-09-20T10:00:00Z" : "2025-01-01T00:00:00Z");

  it("everything bare from someone's first week becomes one welcome card, even days apart and just two", () => {
    const out = groupCountryBursts([c("a", "24", "09:00"), c("b", "21", "18:00")], () => true, { joinedAt });
    expect(out).toHaveLength(1);
    expect("items" in out[0] && out[0].items.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("after the first week, the usual rule applies", () => {
    const out = groupCountryBursts([c("late", "29", "09:00"), c("a", "24", "09:00"), c("b", "21", "18:00")], () => true, { joinedAt });
    expect(out.map((o) => ("items" in o ? "burst" : o.id))).toEqual(["late", "burst"]);
  });

  it("long-time members still need 3 within a few hours", () => {
    const out = groupCountryBursts([c("a", "24", "09:00", "old"), c("b", "21", "18:00", "old")], () => true, { joinedAt });
    expect(out.every((o) => !("items" in o))).toBe(true);
  });
});
