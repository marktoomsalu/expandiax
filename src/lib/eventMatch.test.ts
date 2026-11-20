import { describe, expect, it } from "vitest";
import { decide, sameVenue, venuesFromRows, venuesNear, type MomentQuery } from "./eventMatch";

const moment = (over: Partial<MomentQuery> = {}): MomentQuery => ({
  id: "m1",
  day: "2025-07-12",
  city: "Bologna",
  countryCode: "IT",
  venues: [{ name: "Unipol Arena", kind: "a" }],
  photos: 40,
  hours: 3,
  ...over,
});

describe("sameVenue", () => {
  it("matches the same place written differently", () => {
    expect(sameVenue("The O2", "The O2 Arena")).toBe(true);
    expect(sameVenue("Stadio Renato Dall'Ara", "Stadio Renato Dall’Ara")).toBe(true);
    expect(sameVenue("Unipol Arena", "Unipol Arena (Casalecchio di Reno)")).toBe(true);
    expect(sameVenue("Verona Arena", "Arena di Verona")).toBe(true);
  });
  it("doesn't match different places sharing only a kind of word", () => {
    expect(sameVenue("Olympiastadion", "Stadio Olimpico")).toBe(false);
    expect(sameVenue("The O2", "O2 Academy Brixton")).toBe(false);
    expect(sameVenue("Arena di Verona", "Arena Pula")).toBe(false);
  });
});

describe("venuesNear", () => {
  const venues = venuesFromRows([
    ["Stadio Renato Dall'Ara", 44.4922, 11.3098, "s"],
    ["Teatro Comunale", 44.4955, 11.3488, "t"],
    ["Somewhere", 44.49, 11.31, "x"],
  ]);
  it("reaches further for a stadium than for a theatre", () => {
    expect(venues).toHaveLength(2);
    expect(venuesNear({ lat: 44.4955, lng: 11.3098 }, venues).map((v) => v.name)).toEqual(["Stadio Renato Dall'Ara"]);
    expect(venuesNear({ lat: 44.4985, lng: 11.3488 }, venues)).toEqual([]);
  });
});

describe("decide", () => {
  it("is sure when a show played at the venue they were at", () => {
    const e = decide(moment(), [
      { artist: "Coldplay", venue: "Unipol Arena", city: "Bologna", countryCode: "IT" },
      { artist: "Someone", venue: "Locomotiv Club", city: "Bologna", countryCode: "IT" },
    ]);
    expect(e).toMatchObject({ type: "concert", title: "Coldplay", artist: "Coldplay", venue: "Unipol Arena", sure: true });
  });
  it("knows a venue by its other names", () => {
    const e = decide(moment({ venues: [{ name: "Giuseppe Meazza Stadium", kind: "s", aka: ["San Siro", "Stadio San Siro"] }] }), [{ artist: "Taylor Swift", venue: "Stadio San Siro", city: "Milan", countryCode: "IT" }]);
    expect(e).toMatchObject({ title: "Taylor Swift", venue: "Stadio San Siro", sure: true });
  });
  it("offers the stadium itself when no show is listed", () => {
    expect(decide(moment({ venues: [{ name: "Stadio Renato Dall'Ara", kind: "s" }] }), [])).toMatchObject({ type: "sport", title: "Stadio Renato Dall'Ara", sure: false });
  });
  it("offers the only show in town when they were at a stage", () => {
    expect(decide(moment({ venues: [{ name: "Teatro Europauditorium", kind: "m" }] }), [{ artist: "Vasco Rossi", venue: "Elsewhere", city: "Bologna", countryCode: "IT" }])).toMatchObject({ title: "Vasco Rossi", sure: false });
  });
  it("finds a festival from a long day of photos", () => {
    expect(decide(moment({ venues: [], hours: 6, photos: 80 }), [{ artist: "Muse", venue: "Rock in Roma Festival", city: "Rome", countryCode: "IT" }])).toMatchObject({ type: "festival", title: "Rock in Roma Festival" });
  });
  it("is nothing without a venue or a festival", () => {
    expect(decide(moment({ venues: [] }), [])).toBeNull();
  });
});
