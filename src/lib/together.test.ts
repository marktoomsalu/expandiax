import { describe, expect, it } from "vitest";
import { findTogether, sameEvent, titlesMatch, tripOverlap, tripRange, type TogetherEvent, type TogetherTrip } from "./together";

const ev = (over: Partial<TogetherEvent>): TogetherEvent => ({
  id: "x", user_id: "me", title: "Coldplay", event_type: "concert", event_date: "2025-07-20", venue: "", city: "", country_code: "EE",
  spotify_artist_id: null, spotify_artist_name: null, ...over,
});
const trip = (user_id: string, country_code: string, from: string, to: string): TogetherTrip => ({ user_id, country_code, from, to });

describe("titlesMatch", () => {
  it("matches the same thing named differently", () => {
    expect(titlesMatch("Coldplay", "Coldplay – Music of the Spheres")).toBe(true);
    expect(titlesMatch("Tallinn Marathon", "Tallinn marathon 2025")).toBe(true);
    expect(titlesMatch("Beyoncé", "BEYONCE")).toBe(true);
  });
  it("doesn't match different things", () => {
    expect(titlesMatch("Tallinn Marathon", "Riga Marathon")).toBe(false);
    expect(titlesMatch("Metallica", "Coldplay")).toBe(false);
    expect(titlesMatch("Summer Festival", "Winter Festival")).toBe(false);
  });
});

describe("sameEvent", () => {
  it("same night + same artist = same show, whatever the titles", () => {
    expect(sameEvent(ev({ title: "Coldplay", spotify_artist_id: "cp" }), ev({ title: "Music of the Spheres", spotify_artist_id: "cp" }))).toBe(true);
  });
  it("same night + same venue", () => {
    expect(sameEvent(ev({ title: "Our night out", venue: "Saku Suurhall", city: "Tallinn" }), ev({ title: "Big gig", venue: "Saku suurhall", city: "tallinn" }))).toBe(true);
  });
  it("a festival or race logged on a different day of the same edition", () => {
    expect(sameEvent(ev({ title: "Positivus", event_type: "festival", event_date: "2025-07-18" }), ev({ title: "Positivus Festival 2025", event_type: "festival", event_date: "2025-07-20" }))).toBe(true);
    expect(sameEvent(ev({ title: "Positivus", event_type: "festival", event_date: "2025-07-18" }), ev({ title: "Positivus", event_type: "festival", event_date: "2024-07-18" }))).toBe(false);
  });
  it("a concert must be the same day, and not in another country", () => {
    expect(sameEvent(ev({ event_date: "2025-07-20" }), ev({ event_date: "2025-07-21" }))).toBe(false);
    expect(sameEvent(ev({ country_code: "EE" }), ev({ country_code: "LV" }))).toBe(false);
  });
});

describe("trips", () => {
  it("month-precision trips cover the whole month; year-only is too vague", () => {
    expect(tripRange({ visited_from: "2025-04-01", visited_to: "2025-04-01", date_precision: "month" })).toEqual({ from: "2025-04-01", to: "2025-04-30" });
    expect(tripRange({ visited_from: "2025-02-01", visited_to: null, date_precision: "month" })).toEqual({ from: "2025-02-01", to: "2025-02-28" });
    expect(tripRange({ visited_from: "2025-01-01", visited_to: null, date_precision: "year" })).toBeNull();
  });
  it("overlap only in the same country", () => {
    expect(tripOverlap(trip("me", "JP", "2025-04-01", "2025-04-14"), trip("anna", "JP", "2025-04-10", "2025-04-20"))).toEqual({ from: "2025-04-10", to: "2025-04-14" });
    expect(tripOverlap(trip("me", "JP", "2025-04-01", "2025-04-14"), trip("anna", "JP", "2025-05-01", "2025-05-02"))).toBeNull();
    expect(tripOverlap(trip("me", "JP", "2025-04-01", "2025-04-14"), trip("anna", "KR", "2025-04-01", "2025-04-14"))).toBeNull();
  });
});

describe("findTogether", () => {
  const today = "2026-09-26";
  const mine = [ev({ id: "m1", title: "Coldplay", spotify_artist_id: "cp", event_date: "2025-07-20" })];
  const myTrips = [trip("me", "IT", "2026-09-20", "2026-09-30")];

  it("finds shared events and trips, newest first", () => {
    const { shared } = findTogether({
      myEvents: mine,
      myTrips: [...myTrips, trip("me", "JP", "2025-04-01", "2025-04-14")],
      theirEvents: [ev({ id: "t1", user_id: "anna", title: "Music of the Spheres", spotify_artist_id: "cp", event_date: "2025-07-20" })],
      theirTrips: [trip("anna", "JP", "2025-04-10", "2025-04-20")],
      homeCountry: "EE",
      today,
    });
    expect(shared.map((s) => [s.kind, s.date])).toEqual([["event", "2025-07-20"], ["trip", "2025-04-10"]]);
  });

  it("only prompts where you could have been there, best reason first, and never for personal events", () => {
    const { prompts } = findTogether({
      myEvents: mine,
      myTrips,
      theirEvents: [
        ev({ id: "home", user_id: "anna", title: "Metsatöll", country_code: "EE", event_date: "2026-05-01" }),
        ev({ id: "abroad", user_id: "anna", title: "Some gig", country_code: "US", event_date: "2026-05-01" }),
        ev({ id: "trip", user_id: "bob", title: "Bologna derby", event_type: "sport", country_code: "IT", event_date: "2026-09-24" }),
        ev({ id: "artist", user_id: "bob", title: "Coldplay Berlin", spotify_artist_id: "cp", country_code: "DE", event_date: "2025-08-01" }),
        ev({ id: "bday", user_id: "anna", title: "My birthday", event_type: "personal", country_code: "EE", event_date: "2026-06-01" }),
        ev({ id: "old", user_id: "anna", title: "Old gig", country_code: "EE", event_date: "2023-01-01" }),
        ev({ id: "same", user_id: "cara", title: "Metsatöll", country_code: "EE", event_date: "2026-05-01" }),
      ],
      theirTrips: [],
      homeCountry: "EE",
      today,
    });
    expect(prompts.map((p) => [p.event.id, p.reason])).toEqual([["trip", "trip"], ["artist", "artist"], ["home", "home"]]);
  });
});
