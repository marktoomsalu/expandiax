import { describe, expect, it } from "vitest";
import { pickResurfacedMemory, type OwnCountryLite, type OwnEventLite } from "./feedSections";

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

  it("never resurfaces something from the last two months", () => {
    const recent = event({ id: "recent", event_date: "2026-09-01", is_favourite: true, media_count: 9 });
    expect(pickResurfacedMemory([recent], [], "u1", NOW, "mark")).toBeNull();
  });

  it("returns null when there's nothing worth resurfacing", () => {
    expect(pickResurfacedMemory([event({ id: "plain" })], [], "u1", NOW, "mark")).toBeNull();
  });

  it("keeps the same pick all day", () => {
    const events = [event({ id: "a", media_count: 1 }), event({ id: "b", media_count: 1 }), event({ id: "c", media_count: 1 })];
    const morning = pickResurfacedMemory(events, [], "u1", new Date("2026-09-23T08:00:00"), "mark");
    const evening = pickResurfacedMemory(events, [], "u1", new Date("2026-09-23T22:00:00"), "mark");
    expect(morning?.id).toBe(evening?.id);
  });
});
