import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/components/PhotoPlaceSuggestion", () => ({ savePlaces: async () => new Map() }));

import { matchMemories, type Saved, type SavedVisit, type SavedEvent } from "./memoryFinder";
import type { FoundTrip } from "./tripFinder";
import type { FoundEvent, TripTown } from "./worldStory";

const trip = (code: string, from: string, to: string, sure = true): FoundTrip => ({
  id: `${code}-${from}`,
  code,
  from,
  to,
  photoDays: 3,
  photos: 40,
  favourites: 0,
  kind: "trip",
  covers: [],
  spots: [],
  journey: "",
  sure,
});
const visit = (code: string, v: Partial<SavedVisit>): SavedVisit => ({ id: `v-${code}-${v.year ?? v.from}`, countryId: `c-${code}`, code, year: 2023, from: null, to: null, precision: "year", cities: [], ...v });
const town = (name: string): TripTown => ({ name, lat: 0, lng: 0, arrived: null, departed: null, photos: 5 });
const event = (e: Partial<FoundEvent>): FoundEvent => ({ id: "e", type: "concert", title: "Coldplay", artist: "Coldplay", venue: null, city: null, code: "FI", date: "2025-07-31", sure: true, photos: 30, covers: [], ...e });
const savedEvent = (e: Partial<SavedEvent>): SavedEvent => ({ id: "s1", title: "Coldplay", date: "2025-07-31", venue: null, city: null, code: "FI", artist: null, ...e });

function run(o: { trips?: FoundTrip[]; towns?: Record<string, TripTown[]>; visits?: SavedVisit[]; events?: FoundEvent[]; savedEvents?: SavedEvent[]; home?: string; skipped?: string[] }) {
  const visits = o.visits ?? [];
  const saved: Saved = { visits, countries: new Map(visits.map((v) => [v.code, v.countryId])), events: o.savedEvents ?? [] };
  return matchMemories({ trips: o.trips ?? [], towns: o.towns ?? {}, homeCode: o.home ?? "EE", saved, events: o.events ?? [], skipped: new Set(o.skipped ?? []) });
}

describe("matchMemories: trips", () => {
  it("fills in a year-only trip with its days and places, instead of adding another", () => {
    const t = trip("IT", "2023-07-12", "2023-07-19");
    const r = run({ trips: [t], towns: { [t.id]: [town("Rome"), town("Florence")] }, visits: [visit("IT", { year: 2023 })] });
    expect(r.suggestions).toHaveLength(1);
    expect(r.suggestions[0]).toMatchObject({ kind: "better-trip", dates: true });
    expect((r.suggestions[0] as { towns: TripTown[] }).towns.map((x) => x.name)).toEqual(["Rome", "Florence"]);
  });

  it("asks which one when a year-only trip could be two", () => {
    const r = run({ trips: [trip("ES", "2019-04-08", "2019-04-14"), trip("ES", "2019-08-02", "2019-08-16")], visits: [visit("ES", { year: 2019 })] });
    expect(r.suggestions.map((s) => s.kind)).toEqual(["which-trip"]);
  });

  it("pairs two year-only trips with two finds that year", () => {
    const r = run({
      trips: [trip("ES", "2019-04-08", "2019-04-14"), trip("ES", "2019-08-02", "2019-08-16")],
      visits: [visit("ES", { id: "a", year: 2019 }), visit("ES", { id: "b", year: 2019 })],
    });
    expect(r.suggestions.map((s) => s.kind)).toEqual(["better-trip", "better-trip"]);
  });

  it("leaves an exact-day trip alone unless it's missing places", () => {
    const t = trip("PT", "2024-05-03", "2024-05-09");
    const v = visit("PT", { from: "2024-05-03", to: "2024-05-09", precision: "day", year: 2024, cities: ["Lisbon"] });
    expect(run({ trips: [t], towns: { [t.id]: [town("Lisbon")] }, visits: [v] })).toMatchObject({ suggestions: [], matchedTrips: 1 });
    const more = run({ trips: [t], towns: { [t.id]: [town("Lisbon"), town("Sintra")] }, visits: [v] });
    expect(more.suggestions[0]).toMatchObject({ kind: "better-trip", dates: false });
    expect((more.suggestions[0] as { towns: TripTown[] }).towns.map((x) => x.name)).toEqual(["Sintra"]);
  });

  it("matches a month-only trip to the find in that month", () => {
    const r = run({ trips: [trip("FR", "2022-08-10", "2022-08-14")], visits: [visit("FR", { year: 2022, from: "2022-08-01", to: "2022-08-31", precision: "month" })] });
    expect(r.suggestions[0]).toMatchObject({ kind: "better-trip", dates: true });
  });

  it("adds trips nothing saved covers, marking new countries; never home, never unsure ones, never skipped ones", () => {
    const r = run({
      trips: [trip("NO", "2025-04-25", "2025-04-27"), trip("EE", "2025-01-01", "2025-01-05"), trip("LV", "2025-02-01", "2025-02-01", false), trip("IT", "2021-05-01", "2021-05-04")],
      visits: [visit("IT", { year: 2023 })],
      skipped: [],
    });
    expect(r.suggestions.map((s) => [s.kind, (s as { trip: FoundTrip }).trip.code, (s as { newCountry: boolean }).newCountry])).toEqual([
      ["new-trip", "NO", true],
      ["new-trip", "IT", false],
    ]);
    expect(run({ trips: [trip("NO", "2025-04-25", "2025-04-27")], skipped: ["nt:NO:2025-04-25"] }).suggestions).toEqual([]);
  });
});

describe("matchMemories: events", () => {
  it("adds the venue to a saved event on the same day", () => {
    const r = run({ events: [event({ venue: "Olympic Stadium", city: "Helsinki" })], savedEvents: [savedEvent({})] });
    expect(r.suggestions[0]).toMatchObject({ kind: "better-event", changes: { venue: "Olympic Stadium", city: "Helsinki", artist: "Coldplay" } });
  });

  it("knows a saved event a couple of days off, and offers the right date", () => {
    const r = run({ events: [event({ venue: "Olympic Stadium" })], savedEvents: [savedEvent({ date: "2025-08-01", venue: "Olympic Stadium", artist: "Coldplay" })] });
    expect(r.suggestions[0]).toMatchObject({ kind: "better-event", changes: { date: "2025-07-31" } });
  });

  it("counts a complete match as already there", () => {
    const r = run({ events: [event({ venue: "Olympic Stadium" })], savedEvents: [savedEvent({ title: "Coldplay in Helsinki", venue: "Olympic Stadium", artist: "Coldplay" })] });
    expect(r).toMatchObject({ suggestions: [], matchedEvents: 1 });
  });

  it("adds an event it can't match, but not a different show the same day at another venue as the same", () => {
    const r = run({
      events: [event({ title: "Billie Eilish", artist: "Billie Eilish", venue: "Unity Arena", code: "NO", date: "2025-04-26" })],
      savedEvents: [savedEvent({ title: "Football", date: "2025-04-26", venue: "Ullevaal", code: "NO" })],
    });
    expect(r.suggestions[0]).toMatchObject({ kind: "new-event" });
  });
});

describe("matchMemories: events over several days", () => {
  it("a find on a saved festival's second day is that festival, not a new event or a date fix", () => {
    const r = run({
      events: [event({ title: "Roskilde Festival", artist: null, venue: "Roskilde Festival", code: "DK", date: "2025-07-03" })],
      savedEvents: [savedEvent({ title: "Roskilde Festival", date: "2025-07-02", end: "2025-07-05", venue: "Roskilde Festival", code: "DK" })],
    });
    expect(r).toMatchObject({ suggestions: [], matchedEvents: 1 });
  });
});
