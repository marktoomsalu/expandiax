import { describe, expect, it } from "vitest";
import { decide, headliner, isBigDay, sameVenue, venuesFromRows, venuesNear, type Moment, type ShowFound, type Venue } from "./eventMatch";

const wembley: Venue = { name: "Wembley Stadium", lat: 51.5556, lng: -0.2794, kind: "s", aka: ["New Wembley"] };
const moment = (over: Partial<Moment> = {}): Moment => ({ id: "m", lat: 51.556, lng: -0.2795, day: "2025-08-31", photos: 70, hours: 3, near: [wembley], ...over });
const show = (over: Partial<ShowFound>): ShowFound => ({ artist: "X", venue: null, city: null, lat: null, lng: null, atVenue: false, songs: 10, ...over });

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
    ["Stadio Renato Dall'Ara", 44.4922, 11.3098, "s", ["Dall'Ara"]],
    ["Teatro Comunale", 44.4955, 11.3488, "t"],
    ["Somewhere", 44.49, 11.31, "x"],
  ]);
  it("reaches further for a stadium than for a theatre, and keeps other names", () => {
    expect(venues).toHaveLength(2);
    expect(venues[0].aka).toEqual(["Dall'Ara"]);
    expect(venuesNear({ lat: 44.4965, lng: 11.3098 }, venues).map((v) => v.name)).toEqual(["Stadio Renato Dall'Ara"]);
    expect(venuesNear({ lat: 44.4985, lng: 11.3488 }, venues)).toEqual([]);
  });
});

describe("decide", () => {
  it("names the headliner, not the support acts (the longest setlist)", () => {
    const night = [
      show({ artist: "Orquesta Sinfónica Simón Bolívar", venue: "Wembley Stadium", atVenue: true, songs: 2 }),
      show({ artist: "Elyanna", venue: "Wembley Stadium", atVenue: true, songs: 7 }),
      show({ artist: "Coldplay", venue: "Wembley Stadium", atVenue: true, songs: 25 }),
    ];
    expect(headliner(night).artist).toBe("Coldplay");
    expect(decide(moment(), night)).toMatchObject({ kind: "event", title: "Coldplay", sure: true });
  });
  it("is sure when the town's show was at the venue it was at, by any name", () => {
    expect(decide(moment(), [show({ artist: "Muse", venue: "New Wembley" }), show({ artist: "Someone", venue: "The Camden Club" })])).toMatchObject({ title: "Muse", sure: true });
  });
  it("is sure when a listed venue is right where the photos were", () => {
    const m = moment({ lat: 59.4451, lng: 24.8061, near: [] });
    expect(decide(m, [show({ artist: "The Weeknd", venue: "Tallinna Lauluväljak", lat: 59.44506, lng: 24.80606, songs: 30 })])).toMatchObject({ title: "The Weeknd", sure: true });
  });
  it("uses a small town's middle when the venue can't be placed (Fornebu)", () => {
    const m = moment({ lat: 59.9031, lng: 10.6239, near: [] });
    expect(decide(m, [show({ artist: "Billie Eilish", venue: "Unity Arena", cityLat: 59.9022, cityLng: 10.6292 })])).toMatchObject({ title: "Billie Eilish", sure: true });
  });
  it("offers a show a little further away, not sure", () => {
    const m = moment({ lat: 60.1869, lng: 24.9271, near: [] });
    expect(decide(m, [show({ artist: "Band", venue: "Somewhere", lat: 60.1869, lng: 24.9551 })])).toMatchObject({ title: "Band", sure: false });
  });
  it("offers the only show in town on a big night when its venue can't be found (Adele in Munich)", () => {
    expect(decide(moment({ near: [], lat: 48.136, lng: 11.695 }), [show({ artist: "Adele", venue: "Sonderfreifläche Messe", cityLat: 48.137, cityLng: 11.575 })])).toMatchObject({ title: "Adele", sure: false });
  });
  it("asks what it was at a stadium with nothing listed", () => {
    expect(decide(moment({ near: [{ ...wembley, name: "Helsinki Olympic Stadium" }] }), [])).toEqual({ kind: "name", place: "Helsinki Olympic Stadium", venueKind: "s" });
  });
  it("asks about a big day anywhere (a race, a wedding), and lets small evenings go", () => {
    expect(decide(moment({ near: [], photos: 200, hours: 9 }), [])).toEqual({ kind: "name", place: null, venueKind: null });
    expect(decide(moment({ near: [], photos: 10, hours: 1 }), [])).toBeNull();
    expect(isBigDay({ photos: 30, hours: 2.5 })).toBe(true);
  });
});
